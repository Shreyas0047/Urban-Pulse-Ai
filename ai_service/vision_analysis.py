import base64
import io
from functools import lru_cache

import numpy as np

from ai_config import VISION_CONFIDENCE_THRESHOLD, VISION_MAX_IMAGE_BYTES, VISION_MODEL_NAME
from category_catalog import COMPLAINT_CATEGORIES, CATEGORY_BY_ID
from model_runtime import cosine_similarity, get_vision_model
from text_processing import normalize_text
from threat_intelligence import build_threat_assessment

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


@lru_cache(maxsize=None)
def category_prompt_vectors(category_id):
    model = get_vision_model()
    if model is None:
        return None

    prompts = CATEGORY_PROMPTS.get(category_id)
    if not prompts:
        return None

    try:
        return np.array(model.encode(prompts, normalize_embeddings=True), dtype=float)
    except Exception:
        return None


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
        "road_damage": ["pothole", "road crack", "damaged road", "broken road", "sinkhole"],
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
        structural_hint = any(term in normalized_hint for term in ["crack", "cracked", "ceiling", "plaster"]) or (
            "wall" in normalized_hint and not any(term in normalized_hint for term in ["water leakage", "leakage", "leak", "pipe"])
        )
        if category_id == "wall_damage" and structural_hint:
            score = max(score, 0.68)
        if category_id == "water_leakage" and any(term in normalized_hint for term in ["crack", "cracked", "ceiling", "plaster"]):
            score = clamp01(score - 0.24)
        if category_id == "water_leakage" and any(term in normalized_hint for term in ["water leakage", "pipe leak", "burst pipe", "seepage"]):
            score = max(score, 0.82)
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
            prompt_vectors = category_prompt_vectors(category["id"])
            if prompt_vectors is None:
                continue
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


def image_passes(image):
    if image is None:
        return []

    width, height = image.size
    if width < 64 or height < 64:
        return [("full", image)]

    center_margin_x = int(width * 0.15)
    center_margin_y = int(height * 0.15)
    mid_x = width // 2
    mid_y = height // 2

    boxes = [
        ("full", (0, 0, width, height)),
        ("center", (center_margin_x, center_margin_y, width - center_margin_x, height - center_margin_y)),
        ("top", (0, 0, width, max(mid_y, 1))),
        ("bottom", (0, mid_y, width, height)),
        ("left", (0, 0, max(mid_x, 1), height)),
        ("right", (mid_x, 0, width, height)),
    ]

    passes = []
    for name, box in boxes:
        left, top, right, bottom = box
        if right - left >= 32 and bottom - top >= 32:
            passes.append((name, image.crop(box) if name != "full" else image))

    return passes


def clip_candidates_multi_pass(image):
    passes = image_passes(image)
    if not passes:
        return [], {"passes": [], "aggregate": {}}

    category_scores = {category["id"]: [] for category in COMPLAINT_CATEGORIES}
    pass_summaries = []

    for pass_name, pass_image in passes:
        pass_candidates = clip_candidates(pass_image)
        if not pass_candidates:
            continue

        top = pass_candidates[0]
        pass_summaries.append(
            {
                "name": pass_name,
                "topCategoryId": top.get("category_id"),
                "topLabel": top.get("category_label") or top.get("label"),
                "confidence": top.get("confidence", 0),
            }
        )

        for candidate in pass_candidates:
            category_id = candidate.get("category_id")
            if category_id in category_scores:
                category_scores[category_id].append(float(candidate.get("confidence") or 0))

    aggregate_candidates = []
    for category in COMPLAINT_CATEGORIES:
        scores = category_scores.get(category["id"], [])
        if not scores:
            continue

        score = max(scores) * 0.62 + (sum(scores) / len(scores)) * 0.38
        aggregate_candidates.append(
            {
                "label": category["label"],
                "category_id": category["id"],
                "category_label": category["label"],
                "confidence": round(clamp01(score), 3),
                "source": "clip-multipass",
                "passCount": len(scores),
            }
        )

    aggregate_candidates.sort(key=lambda item: item["confidence"], reverse=True)
    aggregate = {
        "passCount": len(pass_summaries),
        "topCategories": pass_summaries[:6],
    }
    return aggregate_candidates, {"passes": pass_summaries[:8], "aggregate": aggregate}


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


def detect_objects_from_features(
    image_features,
    image_hint,
    image_base64=None,
    image_mime_type=None,
    previous_complaints=None,
    recent_area_complaints=None,
    location="",
):
    feature_items = feature_signal_candidates(image_features, image_hint)
    image = decode_image(image_base64)
    clip_items, pass_diagnostics = clip_candidates_multi_pass(image)
    candidates = merge_candidates(clip_items, feature_items) if clip_items else feature_items
    has_text_context = bool(normalize_text(image_hint))
    threshold = VISION_CONFIDENCE_THRESHOLD if clip_items else (0.28 if not has_text_context else 0.34)
    detections = [item for item in candidates if item["confidence"] >= threshold]
    top_detection = detections[0] if detections else None
    fallback_used = not bool(clip_items)
    threat_assessment = build_threat_assessment(
        image=image,
        image_base64=image_base64,
        image_mime_type=image_mime_type,
        image_features=image_features,
        image_hint=image_hint,
        candidates=candidates,
        top_detection=top_detection,
        pass_diagnostics=pass_diagnostics,
        fallback_used=fallback_used,
        previous_complaints=previous_complaints,
        recent_area_complaints=recent_area_complaints,
        location=location,
    )

    return {
        "detections": detections[:6],
        "top_detection": top_detection,
        "candidates": candidates[:5],
        "model": VISION_MODEL_NAME if clip_items else "feature-signals",
        "provider": "local-clip" if clip_items else "feature-fallback",
        "fallbackUsed": fallback_used,
        "imageAccepted": image is not None,
        "imageMimeType": image_mime_type or "",
        "passDiagnostics": pass_diagnostics,
        "threatAssessment": threat_assessment,
        "confidenceBreakdown": {
            "clipTop": clip_items[0]["confidence"] if clip_items else 0,
            "featureTop": feature_items[0]["confidence"] if feature_items else 0,
            "fusedTop": top_detection["confidence"] if top_detection else 0,
            "threatRisk": threat_assessment.get("riskScore", 0),
            "threatConfidence": threat_assessment.get("confidence", 0),
        },
    }


def map_visual_labels_to_categories(vision_result):
    return [detection["category_id"] for detection in vision_result["detections"] if detection.get("category_id")]
