from category_catalog import CATEGORY_BY_ID
from context_analysis import context_features
from decision_engine import build_structured_decision
from reasoning import build_explanation, merge_multi_modal_categories, predict_priority
from text_processing import analyze_sentiment_and_severity, keyword_extract, normalize_text, semantic_multi_label_classification
from vision_analysis import detect_objects_from_features


def clamp01(value):
    return max(0.0, min(1.0, value))


def category_to_team(category_id):
    return CATEGORY_BY_ID.get(category_id, {}).get("team", "Help Desk")


def category_to_authority(priority, category_id):
    if str(priority or "").upper() in {"HIGH", "CRITICAL"}:
        return "Municipality"
    return CATEGORY_BY_ID.get(category_id, {}).get("authority", "Gram Panchayat")


def build_alerts(priority, category_label, location):
    priority_value = str(priority or "").upper()
    if priority_value == "CRITICAL":
        return [
            f"Emergency alert for {category_label}",
            f"Residents near {location or 'the affected area'} should avoid the immediate hazard zone",
        ]
    if priority_value == "HIGH":
        return [
            f"High priority alert for {category_label}",
            f"Residents near {location or 'the affected area'} should remain cautious",
        ]
    if priority_value == "MEDIUM":
        return [f"Maintenance alert created for {category_label}"]
    return [f"Complaint logged for {category_label}"]


def build_status(priority):
    priority_value = str(priority or "").upper()
    if priority_value == "CRITICAL":
        return "Escalated"
    if priority_value == "HIGH":
        return "Escalated"
    if priority_value == "MEDIUM":
        return "In Progress"
    return "Queued"


def build_map_location(location):
    base_lat = 12.9716
    base_lng = 77.5946
    seed = sum(ord(char) for char in str(location or "unknown"))
    lat_offset = ((seed % 35) - 17) / 1000
    lng_offset = (((seed // 7) % 35) - 17) / 1000
    return {"lat": round(base_lat + lat_offset, 6), "lng": round(base_lng + lng_offset, 6)}


def apply_threat_escalation(priority, priority_score, threat_assessment):
    threat_level = (threat_assessment or {}).get("threatLevel")
    threat_confidence = float((threat_assessment or {}).get("confidence") or 0)
    risk_score = float((threat_assessment or {}).get("riskScore") or 0)
    safety_gate = (threat_assessment or {}).get("safetyGate") or {}

    if safety_gate.get("abstained"):
        return priority, priority_score

    if threat_level == "Critical" and threat_confidence >= 0.46:
        return "CRITICAL", round(max(priority_score, risk_score, 0.86), 3)
    if threat_level == "High" and threat_confidence >= 0.44 and str(priority or "").upper() not in {"CRITICAL", "HIGH"}:
        return "HIGH", round(max(priority_score, risk_score, 0.74), 3)
    if threat_level == "Medium" and str(priority or "").upper() == "LOW":
        return "MEDIUM", round(max(priority_score, risk_score, 0.54), 3)

    return priority, priority_score


def run_hybrid_pipeline(payload):
    primary_text = " ".join(
        value
        for value in [
            str(payload.get("textComplaint") or "").strip(),
            str(payload.get("voiceTranscript") or "").strip(),
        ]
        if value
    ).strip()
    visual_context_hint = " ".join(
        value
        for value in [
            str(payload.get("textComplaint") or "").strip(),
            str(payload.get("voiceTranscript") or "").strip(),
        ]
        if value
    ).strip()
    normalized_text = normalize_text(primary_text)
    semantic_result = semantic_multi_label_classification(primary_text) if primary_text else {"labels": [], "fallback": None, "all_scores": []}
    vision_result = detect_objects_from_features(
        payload.get("imageFeatures"),
        visual_context_hint,
        payload.get("imageBase64"),
        payload.get("imageMimeType"),
        payload.get("previousComplaints"),
        payload.get("recentAreaComplaints"),
        payload.get("location"),
    )
    final_categories = merge_multi_modal_categories(semantic_result["labels"], vision_result)
    sentiment_bundle = analyze_sentiment_and_severity(primary_text, final_categories)
    context_bundle = context_features(payload, semantic_result)
    priority, priority_score = predict_priority(primary_text, sentiment_bundle, final_categories, context_bundle["repeat_count"])
    threat_assessment = vision_result.get("threatAssessment") or {}
    priority, priority_score = apply_threat_escalation(priority, priority_score, threat_assessment)

    top_category = final_categories[0] if final_categories else None
    fallback = semantic_result["fallback"]
    primary_category_id = top_category["id"] if top_category else (fallback["suggested_category"] if fallback else "general")
    primary_category_label = top_category["label"] if top_category else (fallback["suggested_label"] if fallback else "General")
    confidence = top_category["confidence"] if top_category else (fallback["confidence"] if fallback else 0.28)
    reason = build_explanation(primary_text, final_categories, sentiment_bundle, priority, context_bundle, fallback)
    decision = build_structured_decision(
        primary_category_id,
        primary_category_label,
        confidence,
        semantic_result,
        vision_result,
        context_bundle,
        sentiment_bundle,
        priority,
        primary_text,
        threat_assessment,
    )
    confidence = decision["confidence"]
    abstained = bool(decision.get("abstained"))

    # Do not expose a weak fallback as if it were a verified incident type.
    if abstained:
        primary_category_id = "general"
        primary_category_label = "Needs Manual Review"
        final_categories = []
        fallback = None
        reason = "Evidence is insufficient for a precise automatic category. Manual review is required."
        decision["finalCategory"] = primary_category_label
        decision["finalCategoryId"] = primary_category_id

    return {
        "category": primary_category_id,
        "confidence": round(confidence, 3),
        "sentiment": sentiment_bundle["sentiment_label"],
        "sentiment_score": sentiment_bundle["sentiment_score"],
        "severity": sentiment_bundle["severity_score"],
        "priority": {"level": priority, "score": priority_score},
        "priority_score": priority_score,
        "reason": reason,
        "categories": [item["id"] for item in final_categories] if final_categories else ([fallback["suggested_category"]] if fallback else []),
        "category_labels": [item["label"] for item in final_categories] if final_categories else ([fallback["suggested_label"]] if fallback else []),
        "category_confidence": [item["confidence"] for item in final_categories] if final_categories else ([fallback["confidence"]] if fallback else []),
        "keywords": keyword_extract(primary_text, limit=6),
        "vision": vision_result,
        "threatAssessment": threat_assessment,
        "context": context_bundle,
        "fallback": fallback,
        "decision": decision,
        "textPrediction": decision["textPrediction"],
        "imagePrediction": decision["imagePrediction"],
        "conflictDetected": decision["conflictDetected"],
        "reviewRequired": decision["reviewRequired"],
        "abstained": abstained,
        "confidenceLabel": decision["confidenceLabel"],
        "evidenceUsed": decision["evidenceUsed"],
        "reasoning": decision["reasoning"],
        "quality": decision["quality"],
        "unified_text": primary_text or "Complaint submitted with image evidence.",
        "nlp": {
            "category": primary_category_label,
            "issueType": primary_category_label,
            "team": category_to_team(primary_category_id),
            "confidence": round(confidence, 3),
            "categories": [item["label"] for item in final_categories] if final_categories else ([fallback["suggested_label"]] if fallback else []),
        },
        "cv": {
            "detected": vision_result["top_detection"]["label"] if vision_result["top_detection"] else ("Image uploaded; incident unclear" if vision_result.get("imageAccepted") else "No image uploaded"),
            "score": vision_result["top_detection"]["confidence"] if vision_result["top_detection"] else 0.18,
            "reason": "Local vision model and image features were fused for hybrid inference." if vision_result["detections"] else "No strong visual detection available.",
            "detections": vision_result["detections"],
            "candidates": vision_result.get("candidates", []),
            "model": vision_result.get("model", "feature-signals"),
            "provider": vision_result.get("provider", "feature-fallback"),
            "fallbackUsed": vision_result.get("fallbackUsed", True),
            "confidenceBreakdown": vision_result.get("confidenceBreakdown", {}),
            "passDiagnostics": vision_result.get("passDiagnostics", {}),
            "threatAssessment": threat_assessment,
        },
        "status": build_status(priority),
        "assignedAuthority": category_to_authority(priority, primary_category_id),
        "mapLocation": build_map_location(payload.get("location")),
        "alerts": build_alerts(priority, primary_category_label, payload.get("location")),
        "notifications": [
            "Admin dashboard updated",
            "Residents received an emergency warning"
            if priority == "CRITICAL"
            else ("Residents received a high-priority warning" if priority == "HIGH" else "Users subscribed to the zone were notified"),
        ],
        "imageUpload": "Processed by modular hybrid AI pipeline",
        "aiMeta": {
            "provider": "flask",
            "engine": "hybrid-semantic-feature-v3",
            "model": "sentence-transformers-or-hash-fallback",
            "fallbackUsed": False,
            "categoryId": primary_category_id,
            "visionEngine": vision_result.get("model", "shared-feature-signals-v2"),
            "visionProvider": vision_result.get("provider", "feature-fallback"),
            "visionFallbackUsed": vision_result.get("fallbackUsed", True),
            "machineHintIgnoredForClassification": True,
            "evaluationVersion": "ai-service-decision-engine-v4",
            "confidenceLabel": decision["confidenceLabel"],
            "reviewRequired": decision["reviewRequired"],
            "abstained": abstained,
            "conflictDetected": decision["conflictDetected"],
            "threatEngine": threat_assessment.get("engine", "visual-consensus-threat-v1"),
            "threatStatus": threat_assessment.get("status", "not_available"),
            "threatLevel": threat_assessment.get("threatLevel", "Not assessed"),
            "threatRiskScore": threat_assessment.get("riskScore", 0),
            "imageFingerprint": (threat_assessment.get("integrity") or {}).get("sha256", ""),
        },
    }
