import base64
import io

import numpy as np

from ai_config import VISION_CONFIDENCE_THRESHOLD, VISION_MAX_IMAGE_BYTES, VISION_MODEL_NAME
from category_catalog import COMPLAINT_CATEGORIES, CATEGORY_BY_ID
from model_runtime import cosine_similarity, get_vision_model
from text_processing import normalize_text

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None


def clamp01(value):
    return max(0.0, min(1.0, value))


def build_category_prompts(category):
    aliases = category.get("aliases", [])[:5]
    return [
        f"a civic complaint photo showing {category['label']}",
        f"an urban community issue: {category['label']}",
        f"evidence photo for {category['group']} problem",
        *[f"a photo of {alias}" for alias in aliases],
    ]


CATEGORY_PROMPTS = {
    category["id"]: build_category_prompts(category)
    for category in COMPLAINT_CATEGORIES
}


def decode_image(image_base64):
    if not image_base64 or Image is None:
        return None

    payload = str(image_base64).strip()
    if "," in payload:
        payload = payload.split(",", 1)[1]

    try:
        raw = base64.b64decode(payload, validate=True)
    except Exception:
        return None

    if not raw or len(raw) > VISION_MAX_IMAGE_BYTES:
        return None

    try:
        image = Image.open(io.BytesIO(raw))
        return image.convert("RGB")
    except Exception:
        return None


def feature_signal_candidates(image_features, image_hint):
    features = image_features or {}
    normalized_hint = normalize_text(image_hint)
    vegetation_strength = clamp01(
        features.get("greenRatio", 0) * 1.12
        + features.get("averageSaturation", 0) * 0.24
        + features.get("edgeDensity", 0) * 0.18
        - features.get("blueRatio", 0) * 0.14
    )
    pooled_water_strength = clamp01(
        features.get("blueRatio", 0) * 0.92
        + features.get("neutralRatio", 0) * 0.34
        + (1 - features.get("averageSaturation", 0)) * 0.18
        - features.get("greenRatio", 0) * 0.42
    )
    signals = [
        ("fire or smoke hazard", "safety_fire", clamp01(features.get("redHeatRatio", 0) * 1.05 + features.get("smokeLikeRatio", 0) * 0.88 + features.get("hotspotRatio", 0) * 0.76)),
        ("road damage", "road_damage", clamp01(features.get("edgeDensity", 0) * 0.72 + features.get("contrast", 0) * 0.54 + features.get("darkRatio", 0) * 0.2 - features.get("greenRatio", 0) * 0.1)),
        ("tree obstruction", "tree_obstruction", clamp01(vegetation_strength + features.get("contrast", 0) * 0.12)),
        ("garbage overflow", "garbage", clamp01(features.get("edgeDensity", 0) * 0.34 + features.get("contrast", 0) * 0.26 + features.get("averageSaturation", 0) * 0.2 - features.get("greenRatio", 0) * 0.16)),
        ("sewage or manhole overflow", "sewage_overflow", clamp01(features.get("neutralRatio", 0) * 0.34 + features.get("darkRatio", 0) * 0.3 + (1 - features.get("blueRatio", 0)) * 0.12)),
        ("waterlogging", "water_drainage", clamp01(pooled_water_strength)),
        ("water leakage", "water_leakage", clamp01(features.get("blueRatio", 0) * 0.36 + features.get("neutralRatio", 0) * 0.18 + features.get("averageBrightness", 0) * 0.12)),
        ("wall or structural damage", "wall_damage", clamp01(features.get("edgeDensity", 0) * 0.46 + features.get("contrast", 0) * 0.3 + features.get("neutralRatio", 0) * 0.2)),
        ("security concern", "security", clamp01(features.get("darkRatio", 0) * 0.34 + features.get("contrast", 0) * 0.18)),
        ("utility fault", "utility_fault", clamp01(features.get("hotspotRatio", 0) * 0.38 + features.get("edgeDensity", 0) * 0.22 + features.get("redHeatRatio", 0) * 0.18)),
        ("animal intrusion", "animal_intrusion", clamp01(features.get("edgeDensity", 0) * 0.24 + features.get("contrast", 0) * 0.2 + features.get("greenRatio", 0) * 0.14)),
        ("vehicle obstruction", "vehicle_obstruction", clamp01(features.get("neutralRatio", 0) * 0.24 + features.get("edgeDensity", 0) * 0.26 + features.get("contrast", 0) * 0.2)),
    ]
    hint_boosts = {
        "safety_fire": ["fire", "smoke", "gas", "spark"],
        "road_damage": ["pothole", "road", "crack"],
        "tree_obstruction": ["tree", "branch", "vegetation"],
        "garbage": ["garbage", "waste", "trash"],
        "sewage_overflow": ["sewage", "manhole", "dirty water", "gutter"],
        "water_drainage": ["waterlogging", "stagnant", "drainage"],
        "water_leakage": ["leak", "pipe", "seepage"],
        "wall_damage": ["wall", "building", "ceiling", "plaster"],
        "security": ["intruder", "theft", "suspicious", "gate"],
        "utility_fault": ["wire", "streetlight", "transformer", "power"],
        "animal_intrusion": ["dog", "animal", "cattle", "monkey"],
        "vehicle_obstruction": ["vehicle", "parking", "car", "truck"],
    }
    candidates = []

    for label, category_id, score in signals:
        if any(term in normalized_hint for term in hint_boosts.get(category_id, [])):
            score = max(score, 0.44)
        if category_id == "tree_obstruction" and vegetation_strength > 0.28:
            score = clamp01(score + 0.12 + vegetation_strength * 0.12)
        if category_id == "water_drainage" and features.get("greenRatio", 0) > 0.24:
            score = clamp01(score - (0.14 + features.get("greenRatio", 0) * 0.18))
        if category_id == "garbage" and vegetation_strength > 0.28:
            score = clamp01(score - 0.14)
        if score >= 0.2:
            category = CATEGORY_BY_ID.get(category_id, {})
            candidates.append(
                {
                    "label": label,
                    "category_id": category_id,
                    "category_label": category.get("label", label),
                    "confidence": round(score, 3),
                    "source": "feature",
                }
            )

    candidates.sort(key=lambda item: item["confidence"], reverse=True)
    return candidates


def clip_candidates(image):
    model = get_vision_model()
    if model is None or image is None:
        return []

    try:
        image_vector = np.array(model.encode([image], normalize_embeddings=True)[0], dtype=float)
        candidates = []
        for category in COMPLAINT_CATEGORIES:
            prompt_vectors = np.array(model.encode(CATEGORY_PROMPTS[category["id"]], normalize_embeddings=True), dtype=float)
            score = max(cosine_similarity(image_vector, prompt_vector) for prompt_vector in prompt_vectors)
            candidates.append(
                {
                    "label": category["label"],
                    "category_id": category["id"],
                    "category_label": category["label"],
                    "confidence": round(clamp01((score + 1) / 2), 3),
                    "source": "clip",
                }
            )

        candidates.sort(key=lambda item: item["confidence"], reverse=True)
        return candidates
    except Exception:
        return []


def merge_candidates(clip_items, feature_items):
    by_category = {}

    for item in feature_items:
        by_category[item["category_id"]] = dict(item)

    for item in clip_items:
        existing = by_category.get(item["category_id"])
        if existing:
            merged_confidence = clamp01(item["confidence"] * 0.72 + existing["confidence"] * 0.28)
            existing.update(
                {
                    "label": item["label"],
                    "category_label": item["category_label"],
                    "confidence": round(merged_confidence, 3),
                    "source": "clip+feature",
                    "clipConfidence": item["confidence"],
                    "featureConfidence": existing["confidence"],
                }
            )
        else:
            by_category[item["category_id"]] = dict(item)

    candidates = sorted(by_category.values(), key=lambda item: item["confidence"], reverse=True)
    return candidates


def detect_objects_from_features(image_features, image_hint, image_base64=None, image_mime_type=None):
    feature_items = feature_signal_candidates(image_features, image_hint)
    image = decode_image(image_base64)
    clip_items = clip_candidates(image)
    candidates = merge_candidates(clip_items, feature_items) if clip_items else feature_items
    threshold = VISION_CONFIDENCE_THRESHOLD if clip_items else 0.34
    detections = [item for item in candidates if item["confidence"] >= threshold]
    top_detection = detections[0] if detections else None
    fallback_used = not bool(clip_items)

    return {
        "detections": detections[:6],
        "top_detection": top_detection,
        "candidates": candidates[:5],
        "model": VISION_MODEL_NAME if clip_items else "feature-signals",
        "provider": "local-clip" if clip_items else "feature-fallback",
        "fallbackUsed": fallback_used,
        "imageAccepted": image is not None,
        "imageMimeType": image_mime_type or "",
        "confidenceBreakdown": {
            "clipTop": clip_items[0]["confidence"] if clip_items else 0,
            "featureTop": feature_items[0]["confidence"] if feature_items else 0,
            "fusedTop": top_detection["confidence"] if top_detection else 0,
        },
    }


def map_visual_labels_to_categories(vision_result):
    return [detection["category_id"] for detection in vision_result["detections"] if detection.get("category_id")]
