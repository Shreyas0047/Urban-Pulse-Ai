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
    try:
        return max(0.0, min(1.0, float(value or 0)))
    except (TypeError, ValueError):
        return 0.0


def safe_feature(features, key, default=0.0):
    if not isinstance(features, dict):
        return default
    return clamp01(features.get(key, default))


def sanitize_feature_payload(image_features):
    if not isinstance(image_features, dict):
        return {}

    sanitized = {}
    for key, value in image_features.items():
        if key in {"width", "height"}:
            try:
                sanitized[key] = int(max(0, min(12000, float(value or 0))))
            except (TypeError, ValueError):
                sanitized[key] = 0
        else:
            sanitized[key] = safe_feature(image_features, key)
    return sanitized


VISUAL_CONCEPTS = {
    "safety_fire": [
        ("Active fire or visible flames", "a real civic incident photo with active fire and visible flames"),
        ("Heavy smoke or burning hazard", "a real urban incident photo with heavy smoke from something burning"),
        ("Transformer fire or explosion", "a real photo of an electrical transformer on fire or exploding"),
    ],
    "utility_fault": [
        ("Electrical short circuit or arcing", "a real close photo of an electrical short circuit with bright sparks and electric arcing"),
        ("Exposed or fallen live wire", "a real civic hazard photo of exposed fallen or hanging electrical wires"),
        ("Damaged transformer or electrical equipment", "a real photo of damaged transformer electrical equipment without an active fire"),
        ("Broken street light", "a real street photo of a broken damaged street light pole"),
    ],
    "road_damage": [
        ("Pothole or collapsed road surface", "a real street photo of a deep pothole or collapsed damaged road surface"),
        ("Cracked or broken roadway", "a real close photo of severe cracks and breakage in asphalt road"),
    ],
    "tree_obstruction": [
        ("Fallen tree blocking the road", "a real civic incident photo of a fallen uprooted tree blocking a road"),
        ("Large broken branch obstructing access", "a real street photo of a large broken tree branch obstructing traffic"),
    ],
    "garbage": [
        ("Overflowing garbage or waste pile", "a real civic complaint photo of an overflowing garbage bin and visible trash pile"),
        ("Illegal waste dumping", "a real street photo of illegally dumped solid waste and litter"),
    ],
    "sewage_overflow": [
        ("Open manhole hazard", "a real road hazard photo with a clearly open uncovered sewer manhole"),
        ("Visible sewage overflow", "a real civic incident photo of sewage sludge overflowing from a sewer drain"),
    ],
    "water_drainage": [
        ("Road waterlogging or flooding", "a real street photo of deep standing flood water and road waterlogging"),
        ("Blocked storm-water drain", "a real civic complaint photo of a visibly blocked overflowing storm-water drain"),
    ],
    "water_leakage": [
        ("Burst water pipe", "a real street photo of a burst water pipe spraying clean water"),
        ("Continuous public water leak", "a real civic complaint photo of continuous water leakage from a public pipe"),
    ],
    "wall_damage": [
        ("Dangerous structural wall crack", "a real building photo with a large dangerous structural crack in a wall"),
        ("Collapsed wall or ceiling", "a real civic hazard photo of a partially collapsed wall or ceiling"),
    ],
    "security": [
        ("Damaged security gate or forced entry", "a real security incident photo of a broken gate lock or forced entry damage"),
    ],
    "animal_intrusion": [
        ("Stray animal obstructing a public area", "a real street photo of stray dogs cattle or animals obstructing a public area"),
    ],
    "vehicle_obstruction": [
        ("Vehicle illegally blocking access", "a real street photo of a vehicle illegally blocking a gate road or emergency access"),
    ],
}


def build_category_prompts(category):
    concepts = VISUAL_CONCEPTS.get(category["id"], [])
    generic = [
        (category["label"], f"a real civic complaint photo clearly showing {category['label']}"),
        *[(category["label"], f"a real photo clearly showing {alias}") for alias in category.get("aliases", [])[:4]],
    ]
    return [{"label": label, "prompt": prompt} for label, prompt in [*concepts, *generic]]


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
        return np.array(model.encode([item["prompt"] for item in prompts], normalize_embeddings=True), dtype=float)
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
    features = sanitize_feature_payload(image_features)
    normalized_hint = normalize_text(image_hint)
    vegetation_strength = clamp01(
        safe_feature(features, "greenRatio") * 1.12
        + safe_feature(features, "averageSaturation") * 0.24
        + safe_feature(features, "edgeDensity") * 0.18
        - safe_feature(features, "blueRatio") * 0.14
    )
    pooled_water_strength = clamp01(
        safe_feature(features, "blueRatio") * 0.92
        + safe_feature(features, "neutralRatio") * 0.34
        + (1 - safe_feature(features, "averageSaturation")) * 0.18
        - safe_feature(features, "greenRatio") * 0.42
    )
    electrical_arcing_strength = clamp01(
        safe_feature(features, "hotspotRatio") * 0.74
        + safe_feature(features, "edgeDensity") * 0.24
        + safe_feature(features, "redHeatRatio") * 0.22
        - safe_feature(features, "smokeLikeRatio") * 0.2
    )
    visible_sewage_strength = clamp01(
        safe_feature(features, "neutralRatio") * 0.18
        + safe_feature(features, "darkRatio") * 0.14
        + safe_feature(features, "blueRatio") * 0.12
        + safe_feature(features, "contrast") * 0.08
    )
    signals = [
        ("active fire or heavy smoke hazard", "safety_fire", clamp01(safe_feature(features, "redHeatRatio") * 0.55 + safe_feature(features, "smokeLikeRatio") * 0.9 + safe_feature(features, "hotspotRatio") * 0.25)),
        ("road damage", "road_damage", clamp01(safe_feature(features, "edgeDensity") * 0.72 + safe_feature(features, "contrast") * 0.54 + safe_feature(features, "darkRatio") * 0.2 - safe_feature(features, "greenRatio") * 0.1)),
        ("tree obstruction", "tree_obstruction", clamp01(vegetation_strength + safe_feature(features, "contrast") * 0.12)),
        ("garbage overflow", "garbage", clamp01(safe_feature(features, "edgeDensity") * 0.34 + safe_feature(features, "contrast") * 0.26 + safe_feature(features, "averageSaturation") * 0.2 - safe_feature(features, "greenRatio") * 0.16)),
        ("possible sewage or manhole overflow", "sewage_overflow", visible_sewage_strength),
        ("waterlogging", "water_drainage", clamp01(pooled_water_strength)),
        ("water leakage", "water_leakage", clamp01(safe_feature(features, "blueRatio") * 0.36 + safe_feature(features, "neutralRatio") * 0.18 + safe_feature(features, "averageBrightness") * 0.12)),
        ("wall or structural damage", "wall_damage", clamp01(safe_feature(features, "edgeDensity") * 0.46 + safe_feature(features, "contrast") * 0.3 + safe_feature(features, "neutralRatio") * 0.2)),
        ("security concern", "security", clamp01(safe_feature(features, "darkRatio") * 0.34 + safe_feature(features, "contrast") * 0.18)),
        ("electrical short circuit or arcing hazard", "utility_fault", electrical_arcing_strength),
        ("animal intrusion", "animal_intrusion", clamp01(safe_feature(features, "edgeDensity") * 0.24 + safe_feature(features, "contrast") * 0.2 + safe_feature(features, "greenRatio") * 0.14)),
        ("vehicle obstruction", "vehicle_obstruction", clamp01(safe_feature(features, "neutralRatio") * 0.24 + safe_feature(features, "edgeDensity") * 0.26 + safe_feature(features, "contrast") * 0.2)),
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
        if category_id in {"road_damage", "wall_damage"} and electrical_arcing_strength > 0.48:
            score = clamp01(score - 0.3)
        if any(term in normalized_hint for term in hint_boosts.get(category_id, [])):
            score = max(score, 0.44)
        if category_id == "tree_obstruction" and vegetation_strength > 0.28:
            score = clamp01(score + 0.12 + vegetation_strength * 0.12)
        if category_id == "water_drainage" and safe_feature(features, "greenRatio") > 0.24:
            score = clamp01(score - (0.14 + safe_feature(features, "greenRatio") * 0.18))
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
            scores = [cosine_similarity(image_vector, prompt_vector) for prompt_vector in prompt_vectors]
            best_index = max(range(len(scores)), key=scores.__getitem__)
            score = scores[best_index]
            concept = CATEGORY_PROMPTS[category["id"]][best_index]
            candidates.append(
                {
                    "label": concept["label"],
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
                category_scores[category_id].append(
                    (float(candidate.get("confidence") or 0), candidate.get("label") or candidate.get("category_label"))
                )

    aggregate_candidates = []
    for category in COMPLAINT_CATEGORIES:
        scored_labels = category_scores.get(category["id"], [])
        if not scored_labels:
            continue

        scores = [item[0] for item in scored_labels]
        best_label = max(scored_labels, key=lambda item: item[0])[1]
        score = max(scores) * 0.62 + (sum(scores) / len(scores)) * 0.38
        aggregate_candidates.append(
            {
                "label": best_label or category["label"],
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
    sanitized_features = sanitize_feature_payload(image_features)
    feature_items = feature_signal_candidates(sanitized_features, image_hint)
    image = decode_image(image_base64)
    clip_items, pass_diagnostics = clip_candidates_multi_pass(image)
    candidates = merge_candidates(clip_items, feature_items) if clip_items else feature_items
    has_text_context = bool(normalize_text(image_hint))
    top_score = float(candidates[0]["confidence"]) if candidates else 0
    runner_score = float(candidates[1]["confidence"]) if len(candidates) > 1 else 0
    candidate_margin = max(0.0, top_score - runner_score)
    if clip_items:
        threshold = max(VISION_CONFIDENCE_THRESHOLD, 0.54)
        reliable_top = top_score >= threshold and candidate_margin >= 0.012
    else:
        threshold = 0.58 if not has_text_context else 0.52
        reliable_top = top_score >= threshold and candidate_margin >= 0.08
    detections = [item for item in candidates if item["confidence"] >= threshold] if reliable_top else []
    top_detection = detections[0] if detections else None
    fallback_used = not bool(clip_items)
    threat_assessment = build_threat_assessment(
        image=image,
        image_base64=image_base64,
        image_mime_type=image_mime_type,
        image_features=sanitized_features,
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
            "candidateMargin": round(candidate_margin, 3),
            "reliableVisualDecision": reliable_top,
            "threatRisk": threat_assessment.get("riskScore", 0),
            "threatConfidence": threat_assessment.get("confidence", 0),
        },
    }


def map_visual_labels_to_categories(vision_result):
    return [detection["category_id"] for detection in vision_result["detections"] if detection.get("category_id")]
