from pipeline import run_hybrid_pipeline


HIGH_RISK_PRIORITIES = {"HIGH", "CRITICAL"}


def _text(value, limit=1200):
    return " ".join(str(value or "").split())[:limit]


def compare_resolution_evidence(payload):
    """Compare citizen follow-up evidence with the original complaint conservatively."""
    original_category_id = _text(payload.get("originalCategoryId"), 80) or "general"
    original_type = _text(payload.get("originalType"), 180) or "the reported issue"
    original_priority = _text(payload.get("originalPriority"), 30).upper()
    vote = _text(payload.get("vote"), 40).lower()
    note = _text(payload.get("note"), 1200)

    follow_up = run_hybrid_pipeline(
        {
            "textComplaint": note,
            "imageFeatures": payload.get("imageFeatures"),
            "imageBase64": payload.get("imageBase64"),
            "imageMimeType": payload.get("imageMimeType"),
            "location": _text(payload.get("location"), 500),
            "previousComplaints": [],
            "recentAreaComplaints": [],
        }
    )
    decision = follow_up.get("decision") or {}
    detected_category_id = (follow_up.get("aiMeta") or {}).get("categoryId") or follow_up.get("category") or "general"
    has_image = bool(payload.get("imageBase64") or payload.get("imageFeatures"))
    image_prediction = decision.get("imagePrediction") or {}
    visual_category_id = image_prediction.get("categoryId") or "general"
    same_category_detected = bool(
        has_image
        and not decision.get("abstained")
        and original_category_id != "general"
        and visual_category_id == original_category_id
    )

    if vote in {"still_there", "got_worse"}:
        outcome = "needs_rework"
        confidence = 0.92 if vote == "got_worse" else 0.86
        reason = "Citizen follow-up reports that the original issue remains." if vote == "still_there" else "Citizen follow-up reports that the issue has worsened."
        if same_category_detected:
            reason += " The follow-up image also matches the original incident category."
    elif vote == "resolved" and same_category_detected:
        outcome = "needs_admin_review"
        confidence = max(0.62, float(decision.get("confidence") or 0))
        reason = "The follow-up image still contains a signal consistent with the original incident, so resolution needs admin review."
    elif vote == "resolved" and original_priority in HIGH_RISK_PRIORITIES:
        outcome = "needs_admin_review"
        confidence = 0.64
        reason = "A high-risk incident needs an authority review even after a citizen marks it resolved."
    elif vote == "resolved":
        outcome = "citizen_confirmed"
        confidence = 0.72 if has_image else 0.58
        reason = "Citizen marked the issue resolved."
        if has_image and decision.get("abstained"):
            reason += " The image was retained as follow-up evidence but was too ambiguous for an independent visual confirmation."
        elif not has_image:
            reason += " No follow-up image was provided, so this remains a citizen confirmation rather than visual proof."
    else:
        outcome = "needs_admin_review"
        confidence = 0.3
        reason = "Follow-up evidence needs manual review."

    return {
        "outcome": outcome,
        "confidence": round(max(0.0, min(1.0, confidence)), 3),
        "reason": reason,
        "originalCategoryId": original_category_id,
        "detectedCategoryId": detected_category_id,
        "visualCategoryId": visual_category_id,
        "visualComparison": "same_category_signal" if same_category_detected else ("insufficient_visual_evidence" if has_image and decision.get("abstained") else "no_conflicting_signal"),
        "followUpEvidence": {
            "hasImage": has_image,
            "imageAccepted": bool((follow_up.get("vision") or {}).get("imageAccepted")),
            "imageFingerprint": str(((follow_up.get("threatAssessment") or {}).get("integrity") or {}).get("sha256") or ""),
            "reviewRequired": bool(decision.get("reviewRequired")),
            "confidenceLabel": decision.get("confidenceLabel", "Needs Review"),
        },
        "engine": "resolution-evidence-comparator-v1",
        "disclaimer": "This comparison supports review; it does not independently prove that physical work was completed.",
        "originalType": original_type,
    }
