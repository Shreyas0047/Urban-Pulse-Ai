from ai_config import CONTEXT_REPEAT_HIGH, CONTEXT_REPEAT_MEDIUM, MAX_EXPLANATION_KEYWORDS, VISION_IMAGE_WEIGHT
from category_catalog import COMPLAINT_CATEGORIES, CATEGORY_BY_ID
from text_processing import keyword_extract, normalize_text
from vision_analysis import map_visual_labels_to_categories


def predict_priority(text, sentiment_bundle, categories, repeat_count):
    normalized = normalize_text(text)
    top_category = categories[0]["id"] if categories else "general"
    severity = sentiment_bundle["severity_score"]
    score = 0.24

    if severity == "HIGH":
      score += 0.42
    elif severity == "MEDIUM":
      score += 0.22

    if sentiment_bundle["sentiment_label"] == "negative":
        score += 0.18

    if repeat_count >= CONTEXT_REPEAT_HIGH:
        score += 0.24
    elif repeat_count >= CONTEXT_REPEAT_MEDIUM:
        score += 0.12

    if any(keyword in normalized for keyword in ["urgent", "immediately", "danger", "critical", "emergency"]):
        score += 0.2

    if top_category in {"safety_fire", "utility_fault"}:
        score += 0.16

    if score >= 0.82:
        return "HIGH", round(score, 3)
    if score >= 0.5:
        return "MEDIUM", round(score, 3)
    return "LOW", round(score, 3)


def merge_multi_modal_categories(text_categories, vision_result):
    merged = {item["id"]: dict(item) for item in text_categories}
    detections = vision_result.get("detections") or []
    top_detection = vision_result.get("top_detection") or {}
    top_detection_id = top_detection.get("category_id")
    top_detection_confidence = float(top_detection.get("confidence") or 0)

    for detection in detections:
        category_id = detection.get("category_id")
        detection_confidence = float(detection.get("confidence") or 0)
        visual_boost = max(0.08, detection_confidence * VISION_IMAGE_WEIGHT * 0.48)

        if category_id in merged:
            merged[category_id]["confidence"] = round(min(1.0, merged[category_id]["confidence"] + visual_boost), 3)
        else:
            category = CATEGORY_BY_ID.get(category_id) or next((item for item in COMPLAINT_CATEGORIES if item["id"] == category_id), None)
            if category:
                merged[category_id] = {
                    "id": category["id"],
                    "label": category["label"],
                    "confidence": round(max(0.18, detection_confidence * max(0.42, VISION_IMAGE_WEIGHT)), 3),
                    "matched_keywords": [],
                }

    if top_detection_id and top_detection_id in merged:
        merged[top_detection_id]["confidence"] = round(
            min(1.0, merged[top_detection_id]["confidence"] + top_detection_confidence * 0.08),
            3,
        )

    merged_values = sorted(merged.values(), key=lambda item: item["confidence"], reverse=True)

    if top_detection_id and top_detection_confidence >= 0.4 and merged_values:
        top_visual_item = next((item for item in merged_values if item["id"] == top_detection_id), None)
        top_ranked_item = merged_values[0]
        if (
            top_visual_item
            and top_visual_item["id"] != top_ranked_item["id"]
            and top_visual_item["confidence"] >= top_ranked_item["confidence"] - 0.12
        ):
            merged_values = [top_visual_item] + [item for item in merged_values if item["id"] != top_detection_id]

    return merged_values


def build_explanation(text, final_categories, sentiment_bundle, priority, context_bundle, fallback):
    normalized = normalize_text(text)
    keywords = keyword_extract(text, limit=MAX_EXPLANATION_KEYWORDS)
    reason_parts = []

    if final_categories:
        top_category = final_categories[0]
        matched_keywords = top_category.get("matched_keywords") or []
        if matched_keywords:
            reason_parts.append(f"Contains keyword(s) {', '.join(repr(keyword) for keyword in matched_keywords[:3])}")
        else:
            reason_parts.append(f"Semantically closest to {top_category['label']}")
    elif fallback:
        reason_parts.append(f"Unknown category, closest semantic match is {fallback['suggested_label']}")

    if sentiment_bundle["sentiment_label"] == "negative":
        reason_parts.append("negative sentiment increases urgency")

    if context_bundle["repeat_count"] >= CONTEXT_REPEAT_MEDIUM:
        reason_parts.append(f"{context_bundle['repeat_count']} similar recent complaints increase context severity")

    if keywords:
        reason_parts.append(f"top extracted terms: {', '.join(keywords[:3])}")

    reason_parts.append(f"predicted priority is {priority}")
    return ". ".join(reason_parts) + "."
