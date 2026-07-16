import re

from category_catalog import CATEGORY_BY_ID, COMPLAINT_CATEGORIES
from text_processing import normalize_text


ISSUE_RULES = {
    "safety_fire": {
        "label": "Visible fire or smoke hazard",
        "patterns": ["active fire", "visible flames", "on fire", "burning", "heavy smoke", "thick smoke", "smoke rising", "visible smoke", "gas leak"],
        "infrastructure": ["public safety area"],
        "hazards": ["burn or smoke exposure"],
    },
    "utility_fault": {
        "label": "Electrical or street-lighting fault",
        "patterns": ["short circuit", "electric arc", "electrical arc", "exposed wire", "exposed cable", "fallen wire", "downed wire", "hanging wire", "damaged transformer", "broken streetlight", "broken street light", "bent streetlight", "damaged lamp post", "fallen utility pole", "damaged utility pole"],
        "infrastructure": ["electrical infrastructure"],
        "hazards": ["electric shock or ignition risk"],
    },
    "road_damage": {
        "label": "Road surface damage",
        "patterns": ["pothole", "road crack", "cracked road", "cracked asphalt", "damaged road", "broken road", "collapsed road", "sinkhole"],
        "infrastructure": ["road surface"],
        "hazards": ["traffic and fall hazard"],
    },
    "tree_obstruction": {
        "label": "Fallen tree or branch obstruction",
        "patterns": ["fallen tree", "uprooted tree", "tree blocking", "branch blocking", "fallen branch", "broken branch across"],
        "infrastructure": ["road or public access"],
        "hazards": ["blocked access or collision risk"],
    },
    "garbage": {
        "label": "Garbage accumulation or dumping",
        "patterns": ["garbage pile", "pile of garbage", "trash pile", "pile of trash", "overflowing bin", "overflowing garbage", "waste accumulation", "illegal dumping", "scattered litter"],
        "infrastructure": ["public sanitation area"],
        "hazards": ["sanitation and public-health risk"],
    },
    "sewage_overflow": {
        "label": "Sewage overflow or open manhole",
        "patterns": ["sewage overflow", "overflowing sewage", "sewage water", "sewage spill", "open manhole", "uncovered manhole", "broken manhole", "sewer overflow", "sewage sludge"],
        "infrastructure": ["sewer or manhole"],
        "hazards": ["contamination or fall risk"],
    },
    "water_drainage": {
        "label": "Waterlogging or blocked drainage",
        "patterns": ["flooded road", "road is flooded", "waterlogged road", "waterlogging", "standing water", "stagnant water", "blocked drain", "clogged drain", "overflowing drain", "storm drain overflow"],
        "infrastructure": ["road and storm-water drainage"],
        "hazards": ["flooding, contamination, or access risk"],
    },
    "water_leakage": {
        "label": "Public water leak or pipe burst",
        "patterns": ["burst pipe", "broken water pipe", "leaking pipe", "water pipe leak", "water spraying", "water leakage", "leaking hydrant"],
        "infrastructure": ["public water supply"],
        "hazards": ["water loss and slippery-surface risk"],
    },
    "wall_damage": {
        "label": "Structural wall or building damage",
        "patterns": ["cracked wall", "large wall crack", "damaged wall", "collapsed wall", "wall collapse", "collapsed ceiling", "building damage", "structural crack"],
        "infrastructure": ["wall or building structure"],
        "hazards": ["falling debris or structural failure risk"],
    },
    "security": {
        "label": "Visible security damage",
        "patterns": ["broken lock", "forced entry", "damaged gate", "broken gate", "vandalized", "vandalism"],
        "infrastructure": ["public security fixture"],
        "hazards": ["unauthorized access risk"],
    },
    "animal_intrusion": {
        "label": "Stray animal obstruction",
        "patterns": ["stray dog", "stray dogs", "stray cattle", "cattle blocking", "cow blocking", "animal blocking", "monkey menace"],
        "infrastructure": ["road or public space"],
        "hazards": ["animal conflict or traffic risk"],
    },
    "vehicle_obstruction": {
        "label": "Vehicle obstruction or illegal parking",
        "patterns": ["vehicle blocking", "car blocking", "truck blocking", "blocked driveway", "blocking the road", "illegal parking", "parked on the sidewalk"],
        "infrastructure": ["road, footpath, or access point"],
        "hazards": ["access and traffic obstruction"],
    },
}

COMPATIBLE_GROUPS = {
    frozenset(["water_drainage", "sewage_overflow"]),
    frozenset(["water_drainage", "water_leakage"]),
    frozenset(["road_damage", "tree_obstruction"]),
    frozenset(["road_damage", "vehicle_obstruction"]),
    frozenset(["utility_fault", "safety_fire"]),
}

# Florence captions vary naturally. These relationships capture visible object + condition
# combinations without accepting a normal road, tree, pole, vehicle, or animal as an incident.
RELATION_RULES = {
    "safety_fire": [({"flame", "flames", "smoke"}, {"visible", "rising", "thick", "heavy", "burning"})],
    "utility_fault": [
        ({"wire", "wires", "cable", "cables", "power line", "power lines"}, {"exposed", "fallen", "downed", "hanging", "sparking", "sparks", "damaged", "burning"}),
        ({"transformer", "streetlight", "streetlights", "lamp post", "utility pole", "electrical panel", "electrical box", "socket", "outlet"}, {"broken", "damaged", "fallen", "bent", "sparking", "sparks", "burning"}),
    ],
    "road_damage": [({"road", "asphalt", "pavement", "roadway"}, {"hole", "holes", "crack", "cracks", "cracked", "broken", "damaged", "collapsed", "caved"})],
    "tree_obstruction": [({"tree", "branch", "branches"}, {"fallen", "uprooted", "broken", "blocking", "across", "obstructing"})],
    "garbage": [({"garbage", "trash", "waste", "litter", "rubbish", "debris"}, {"pile", "piled", "dumped", "scattered", "overflowing", "accumulated", "covering"})],
    "sewage_overflow": [({"sewage", "sewer", "manhole"}, {"open", "uncovered", "broken", "overflow", "overflowing", "spilling", "sludge"})],
    "water_drainage": [
        ({"road", "street", "underpass", "roadway"}, {"flooded", "submerged", "waterlogged", "standing water"}),
        ({"drain", "drainage", "gutter"}, {"blocked", "clogged", "overflowing", "full", "obstructed"}),
    ],
    "water_leakage": [({"pipe", "pipeline", "water main", "hydrant"}, {"burst", "broken", "leaking", "leak", "spraying", "gushing"})],
    "wall_damage": [({"wall", "building", "ceiling", "structure"}, {"crack", "cracks", "cracked", "collapsed", "damaged", "broken", "leaning"})],
    "security": [({"gate", "door", "lock", "fence"}, {"broken", "damaged", "forced", "vandalized", "cut"})],
    "animal_intrusion": [({"dog", "dogs", "cattle", "cow", "cows", "monkey", "animal"}, {"stray", "blocking", "chasing", "aggressive", "menace"})],
    "vehicle_obstruction": [({"car", "truck", "vehicle", "bus", "van"}, {"blocking", "obstructing", "illegally parked", "on the sidewalk"})],
}


def _unique(items):
    return list(dict.fromkeys(item for item in items if item))


def _contains_phrase(text, phrase):
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])", text))


def _relation_matches(text, category_id):
    matches = []
    for objects, conditions in RELATION_RULES.get(category_id, []):
        visible_objects = [term for term in objects if _contains_phrase(text, term)]
        visible_conditions = [term for term in conditions if _contains_phrase(text, term)]
        if visible_objects and visible_conditions:
            matches.append(f"{visible_objects[0]} + {visible_conditions[0]}")
    return matches


def _flatten_object_labels(objects):
    if not objects:
        return []
    if isinstance(objects, str):
        return [objects]
    if isinstance(objects, list):
        return [str(item) for item in objects if isinstance(item, (str, int, float))]
    if isinstance(objects, dict):
        labels = []
        for key, value in objects.items():
            if key.lower() in {"labels", "label", "objects", "text"}:
                labels.extend(_flatten_object_labels(value))
        return labels
    return []


def _quality_assessment(image, features):
    features = features if isinstance(features, dict) else {}
    limitations = []
    if image is None:
        return {"status": "invalid", "limitations": ["The image could not be decoded."], "width": 0, "height": 0}
    width, height = image.size
    brightness = float(features.get("averageBrightness") or 0)
    contrast = float(features.get("contrast") or 0)
    edge_density = float(features.get("edgeDensity") or 0)
    if min(width, height) < 160:
        limitations.append("Low image resolution limits fine-detail inspection.")
    if brightness and brightness < 0.08:
        limitations.append("The image is very dark.")
    if brightness > 0.96:
        limitations.append("The image is heavily overexposed.")
    if edge_density and edge_density < 0.015 and contrast < 0.05:
        limitations.append("The image may be blurred or lack visible detail.")
    return {
        "status": "limited" if limitations else "usable",
        "limitations": limitations,
        "width": width,
        "height": height,
    }


def _text_category_ids(text):
    normalized = normalize_text(text)
    ids = []
    for category in COMPLAINT_CATEGORIES:
        terms = list(category.get("aliases", [])) + [item[0] for item in category.get("keywords", [])]
        if any(_contains_phrase(normalized, normalize_text(term)) for term in terms if normalize_text(term)):
            ids.append(category["id"])
    return _unique(ids)


def compare_text_and_image(text, visual_category_ids, quality_status, evidence_score):
    text_ids = _text_category_ids(text)
    visual_ids = _unique(visual_category_ids)
    if not normalize_text(text):
        return {"status": "not_provided", "score": None, "reason": "No complaint text was provided for comparison."}
    if quality_status != "usable" and evidence_score < 0.5:
        return {"status": "too_unclear", "score": 0.2, "reason": "The image is too unclear to verify the complaint text reliably."}
    if not visual_ids:
        return {"status": "unrelated", "score": 0.18, "reason": "No visible civic issue could be linked to the submitted complaint text."}
    overlap = set(text_ids).intersection(visual_ids)
    if overlap:
        return {"status": "supports", "score": 0.9, "reason": "Visible evidence supports the incident described in the complaint."}
    if any(frozenset([left, right]) in COMPATIBLE_GROUPS for left in text_ids for right in visual_ids):
        return {"status": "partially_supports", "score": 0.62, "reason": "The image shows a related civic condition but does not verify every part of the complaint."}
    if not text_ids:
        return {"status": "partially_supports", "score": 0.5, "reason": "The complaint text is too general for a precise image comparison."}
    return {"status": "contradicts", "score": 0.12, "reason": "The strongest visible issue differs from the incident described in the complaint; human review is required."}


def build_scene_observations(raw_result, image, image_features, complaint_text):
    raw_result = raw_result if isinstance(raw_result, dict) else {}
    structured = raw_result.get("structuredObservations") if isinstance(raw_result.get("structuredObservations"), dict) else {}
    description = " ".join(str(raw_result.get("description") or "").split())[:1200]
    object_labels = _flatten_object_labels(raw_result.get("objects"))[:40]
    provider_issues = structured.get("visibleCivicIssues") if isinstance(structured.get("visibleCivicIssues"), list) else []
    provider_issue_text = []
    for item in provider_issues[:8]:
        if not isinstance(item, dict):
            continue
        provider_issue_text.append(str(item.get("issue") or ""))
        provider_issue_text.extend(str(value) for value in item.get("visibleEvidence", [])[:5] if value)
    searchable = normalize_text(" ".join([description, *object_labels, *provider_issue_text]))
    quality = _quality_assessment(image, image_features)
    provider_quality = structured.get("imageQuality") if isinstance(structured.get("imageQuality"), dict) else {}
    provider_quality_status = normalize_text(provider_quality.get("status"))
    if provider_quality_status and provider_quality_status != "usable":
        quality["status"] = "limited"
        quality["limitations"] = _unique([
            *quality["limitations"],
            *[str(item) for item in provider_quality.get("limitations", [])[:5]],
            f"Visual provider marked image quality as {provider_quality_status}.",
        ])
    detected = []

    for category_id, rule in ISSUE_RULES.items():
        matches = [phrase for phrase in rule["patterns"] if _contains_phrase(searchable, phrase)]
        matches.extend(_relation_matches(searchable, category_id))
        matches = _unique(matches)
        if not matches:
            continue
        evidence_score = min(0.92, 0.58 + min(len(matches), 3) * 0.08)
        if quality["status"] != "usable":
            evidence_score -= 0.12
        detected.append(
            {
                "categoryId": category_id,
                "categoryLabel": CATEGORY_BY_ID.get(category_id, {}).get("label", rule["label"]),
                "issue": rule["label"],
                "evidence": matches[:5],
                "evidenceScore": round(max(0.0, evidence_score), 3),
            }
        )

    detected.sort(key=lambda item: (item["evidenceScore"], len(item["evidence"])), reverse=True)
    top_score = detected[0]["evidenceScore"] if detected else 0.0
    affected = _unique(item for issue in detected for item in ISSUE_RULES[issue["categoryId"]]["infrastructure"])
    hazards = _unique(item for issue in detected for item in ISSUE_RULES[issue["categoryId"]]["hazards"])
    consistency = compare_text_and_image(complaint_text, [item["categoryId"] for item in detected], quality["status"], top_score)
    provider_uncertainty = structured.get("uncertainty") if isinstance(structured.get("uncertainty"), dict) else {}
    uncertain = (
        raw_result.get("status") != "available"
        or not detected
        or quality["status"] != "usable"
        or bool(provider_uncertainty.get("present"))
    )
    review_recommended = (
        uncertain
        or bool(structured.get("humanReviewRecommended"))
        or consistency["status"] in {"contradicts", "unrelated", "too_unclear"}
        or top_score < 0.58
    )
    if review_recommended:
        reasons = []
        if not detected:
            reasons.append("No supported civic issue phrase was visible in the scene description.")
        reasons.extend(quality["limitations"])
        if provider_uncertainty.get("reason"):
            reasons.append(str(provider_uncertainty.get("reason")))
        if consistency["status"] in {"contradicts", "unrelated", "too_unclear"}:
            reasons.append(consistency["reason"])
        uncertainty_reason = " ".join(_unique(reasons)) or raw_result.get("reason") or "Visual evidence requires human confirmation."
    else:
        uncertainty_reason = ""

    return {
        "schemaVersion": raw_result.get("schemaVersion", ""),
        "status": raw_result.get("status", "unavailable"),
        "provider": raw_result.get("provider", "local-scene-analysis"),
        "model": raw_result.get("model", "microsoft/Florence-2-base-ft"),
        "description": description or "No reliable scene description was generated.",
        "detectedIssues": detected,
        "affectedInfrastructure": affected,
        "hazards": hazards,
        "safetyConcerns": hazards,
        "visualEvidence": _unique(item for issue in detected for item in issue["evidence"])[:12],
        "possibleCivicCategories": [item["categoryId"] for item in detected],
        "imageQuality": quality,
        "uncertainty": {"present": uncertain, "reason": uncertainty_reason},
        "evidenceScore": round(top_score, 3),
        "multipleIssues": len(detected) > 1,
        "humanReviewRecommended": review_recommended,
        "textImageConsistency": consistency,
        "providerObservations": {
            "visibleCivicIssues": provider_issues[:8],
            "damagedInfrastructure": structured.get("damagedInfrastructure", [])[:8],
            "hazards": structured.get("hazards", [])[:8],
            "environmentalConditions": structured.get("environmentalConditions", [])[:6],
            "multipleProblems": bool(structured.get("multipleProblems")),
            "imageQuality": provider_quality,
            "uncertainty": provider_uncertainty,
        } if structured else None,
        "providerAttempts": raw_result.get("providerAttempts", [])[:4],
        "objectLabels": object_labels[:20],
        "cacheHit": bool(raw_result.get("cacheHit")),
        "inferenceMs": int(raw_result.get("inferenceMs") or 0),
        "degradedReason": raw_result.get("reason") or "",
    }


def observation_candidates(observations):
    candidates = []
    for issue in observations.get("detectedIssues", []):
        candidates.append(
            {
                "label": issue["issue"],
                "category_id": issue["categoryId"],
                "category_label": issue["categoryLabel"],
                "confidence": issue["evidenceScore"],
                "source": f"{observations.get('provider', 'visual')}-observation",
                "visualEvidence": issue["evidence"],
            }
        )
    return candidates
