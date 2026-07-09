from category_catalog import CATEGORY_BY_ID
from text_processing import keyword_extract, normalize_text


HIGH_CONFIDENCE = 0.78
MEDIUM_CONFIDENCE = 0.52
LOW_CONFIDENCE = 0.34

COMPATIBLE_CATEGORY_GROUPS = {
    frozenset(["water_drainage", "sewage_overflow"]),
    frozenset(["water_drainage", "water_leakage"]),
    frozenset(["road_damage", "tree_obstruction"]),
    frozenset(["road_damage", "vehicle_obstruction"]),
    frozenset(["utility_fault", "safety_fire"]),
}


def clamp01(value):
    return max(0.0, min(1.0, float(value or 0)))


def confidence_label(confidence):
    if confidence >= HIGH_CONFIDENCE:
        return "High"
    if confidence >= MEDIUM_CONFIDENCE:
        return "Medium"
    if confidence >= LOW_CONFIDENCE:
        return "Low"
    return "Needs Review"


def _prediction_from_category(category):
    if not category:
        return None

    category_id = category.get("id")
    catalog_item = CATEGORY_BY_ID.get(category_id, {})
    return {
        "categoryId": category_id,
        "label": category.get("label") or catalog_item.get("label", "General"),
        "confidence": round(clamp01(category.get("confidence")), 3),
        "matchedKeywords": category.get("matched_keywords", []),
        "source": "semantic",
    }


def _prediction_from_vision(vision_result):
    top_detection = (vision_result or {}).get("top_detection")
    if not top_detection:
        return None

    category_id = top_detection.get("category_id")
    catalog_item = CATEGORY_BY_ID.get(category_id, {})
    return {
        "categoryId": category_id,
        "label": top_detection.get("category_label") or catalog_item.get("label") or top_detection.get("label"),
        "detected": top_detection.get("label"),
        "confidence": round(clamp01(top_detection.get("confidence")), 3),
        "source": top_detection.get("source", "vision"),
    }


def _are_compatible(left_id, right_id):
    if not left_id or not right_id or left_id == right_id:
        return True
    return frozenset([left_id, right_id]) in COMPATIBLE_CATEGORY_GROUPS


def _collect_risk_factors(text, context_bundle, priority, category_id):
    normalized = normalize_text(text)
    factors = []

    for term in ["urgent", "immediately", "danger", "critical", "emergency", "school", "hospital", "main road", "ambulance"]:
        if term in normalized:
            factors.append(term)

    repeat_count = int((context_bundle or {}).get("repeat_count") or 0)
    if repeat_count:
        factors.append(f"{repeat_count} similar recent complaint{'s' if repeat_count != 1 else ''}")

    category = CATEGORY_BY_ID.get(category_id, {})
    if priority == "HIGH" and category.get("group"):
        factors.append(f"high-risk {category['group'].lower()} category")

    return factors[:6]


def calibrate_confidence(base_confidence, text_prediction, image_prediction, conflict_detected, context_bundle, vision_result):
    confidence = clamp01(base_confidence)
    repeat_count = int((context_bundle or {}).get("repeat_count") or 0)

    if text_prediction and image_prediction:
        if text_prediction["categoryId"] == image_prediction["categoryId"]:
            confidence += 0.08
        elif conflict_detected:
            confidence -= 0.18
        elif _are_compatible(text_prediction["categoryId"], image_prediction["categoryId"]):
            confidence += 0.03
    elif image_prediction and not text_prediction:
        confidence = max(confidence, image_prediction["confidence"] * 0.92)
        if (vision_result or {}).get("fallbackUsed"):
            confidence -= 0.06
    elif text_prediction and not image_prediction:
        confidence = max(confidence, text_prediction["confidence"] * 0.94)

    if repeat_count >= 5:
        confidence += 0.06
    elif repeat_count >= 3:
        confidence += 0.03

    top_margin = 0
    candidates = (vision_result or {}).get("candidates") or []
    if len(candidates) >= 2:
        top_margin = clamp01(float(candidates[0].get("confidence") or 0) - float(candidates[1].get("confidence") or 0))
        if image_prediction and top_margin < 0.08:
            confidence -= 0.06

    return round(clamp01(confidence), 3), round(top_margin, 3)


def build_structured_decision(
    primary_category_id,
    primary_category_label,
    base_confidence,
    semantic_result,
    vision_result,
    context_bundle,
    sentiment_bundle,
    priority,
    text,
    threat_assessment=None,
):
    text_prediction = _prediction_from_category((semantic_result.get("labels") or [None])[0] if semantic_result else None)
    if not text_prediction and semantic_result and semantic_result.get("fallback"):
        fallback = semantic_result["fallback"]
        text_prediction = {
            "categoryId": fallback.get("suggested_category"),
            "label": fallback.get("suggested_label"),
            "confidence": round(clamp01(fallback.get("confidence")), 3),
            "matchedKeywords": [],
            "source": "semantic-fallback",
        }

    image_prediction = _prediction_from_vision(vision_result)
    text_id = text_prediction.get("categoryId") if text_prediction else None
    image_id = image_prediction.get("categoryId") if image_prediction else None
    conflict_detected = bool(
        text_prediction
        and image_prediction
        and text_prediction["confidence"] >= 0.42
        and image_prediction["confidence"] >= 0.34
        and not _are_compatible(text_id, image_id)
    )

    calibrated_confidence, vision_margin = calibrate_confidence(
        base_confidence,
        text_prediction,
        image_prediction,
        conflict_detected,
        context_bundle,
        vision_result,
    )
    label = confidence_label(calibrated_confidence)
    threat_assessment = threat_assessment or (vision_result or {}).get("threatAssessment") or {}
    threat_gate = threat_assessment.get("safetyGate") or {}
    threat_status = threat_assessment.get("status")
    threat_review_required = threat_gate.get("abstained") or threat_gate.get("action") in {"needs_review", "request_more_evidence"}
    review_required = conflict_detected or calibrated_confidence < MEDIUM_CONFIDENCE or bool(threat_review_required)

    evidence_used = []
    if text_prediction:
        evidence_used.append("text")
    if image_prediction:
        evidence_used.append("image")
    if int((context_bundle or {}).get("repeat_count") or 0) > 0:
        evidence_used.append("context")
    if not evidence_used:
        evidence_used.append("fallback")

    matched_keywords = []
    if text_prediction:
        matched_keywords = text_prediction.get("matchedKeywords") or keyword_extract(text, limit=4)

    visual_signals = []
    if image_prediction:
        visual_signals.append(f"{image_prediction['detected']} ({image_prediction['confidence']:.2f})")
    if vision_margin:
        visual_signals.append(f"vision candidate margin {vision_margin:.2f}")
    if (vision_result or {}).get("fallbackUsed"):
        visual_signals.append("vision fallback used")
    if threat_assessment.get("threatLevel"):
        visual_signals.append(
            f"threat {threat_assessment.get('threatLevel')} ({float(threat_assessment.get('riskScore') or 0):.2f})"
        )

    risk_factors = _collect_risk_factors(text, context_bundle, priority, primary_category_id)
    decision_sentence = f"Final category is {primary_category_label} with {label.lower()} confidence."
    if conflict_detected:
        decision_sentence += " Text and image evidence disagree, so admin review is required."
    elif threat_review_required:
        decision_sentence += " Threat evidence needs confirmation before automatic closure."
    elif image_prediction and not text_prediction:
        decision_sentence += " Decision is based mainly on uploaded image evidence."
    elif text_prediction and image_prediction:
        decision_sentence += " Text and image evidence were fused."

    return {
        "finalCategory": primary_category_label,
        "finalCategoryId": primary_category_id,
        "confidence": calibrated_confidence,
        "confidenceLabel": label,
        "reviewRequired": review_required,
        "conflictDetected": conflict_detected,
        "evidenceUsed": evidence_used,
        "textPrediction": text_prediction,
        "imagePrediction": image_prediction,
        "reasoning": {
            "matchedKeywords": matched_keywords[:4],
            "visualSignals": visual_signals[:5],
            "contextSignals": {
                "userRepeatCount": int((context_bundle or {}).get("user_repeat_count") or 0),
                "areaRepeatCount": int((context_bundle or {}).get("area_repeat_count") or 0),
                "topRecentTypes": (context_bundle or {}).get("top_recent_types", []),
            },
            "riskFactors": risk_factors,
            "sentiment": (sentiment_bundle or {}).get("sentiment_label", "neutral"),
            "severity": (sentiment_bundle or {}).get("severity_score", "LOW"),
            "threat": {
                "status": threat_status or "not_available",
                "level": threat_assessment.get("threatLevel", "Not assessed"),
                "riskScore": threat_assessment.get("riskScore", 0),
                "safetyAction": threat_gate.get("action", "not_available"),
            },
            "decision": decision_sentence,
        },
        "quality": {
            "needsHumanReview": review_required,
            "lowConfidence": calibrated_confidence < MEDIUM_CONFIDENCE,
            "visionFallbackUsed": bool((vision_result or {}).get("fallbackUsed", True)),
            "visionCandidateMargin": vision_margin,
            "threatStatus": threat_status or "not_available",
            "threatReviewRequired": bool(threat_review_required),
        },
    }
