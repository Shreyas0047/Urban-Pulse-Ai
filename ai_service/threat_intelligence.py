import base64
import hashlib
import io
from datetime import datetime, timezone

from ai_config import VISION_MAX_IMAGE_BYTES
from category_catalog import CATEGORY_BY_ID
from text_processing import normalize_text

try:
    from PIL import Image, ImageStat
except ImportError:  # pragma: no cover
    Image = None
    ImageStat = None


SEVERITY_SCORES = {
    "Critical": 0.32,
    "High": 0.22,
    "Medium": 0.12,
    "Low": 0.04,
}

TEXT_RISK_TERMS = [
    "urgent",
    "immediately",
    "danger",
    "critical",
    "emergency",
    "injury",
    "injured",
    "people",
    "children",
    "school",
    "hospital",
    "main road",
    "junction",
    "ambulance",
    "blocked",
    "live wire",
    "spark",
    "smoke",
    "fire",
    "collapse",
]

CATEGORY_ASSETS = {
    "safety_fire": ["fire/smoke", "electrical or gas asset", "nearby people or property"],
    "road_damage": ["road surface", "vehicle path", "pedestrian path"],
    "tree_obstruction": ["tree/branch", "road or public access path", "nearby traffic"],
    "garbage": ["waste pile", "public space", "sanitation zone"],
    "sewage_overflow": ["drain/manhole", "contaminated water", "pedestrian path"],
    "water_drainage": ["standing water", "drainage path", "road surface"],
    "wall_damage": ["wall/ceiling", "building structure", "occupied area"],
    "security": ["entry point", "public safety area", "nearby residents"],
    "utility_fault": ["wire/pole/streetlight", "electrical asset", "public path"],
    "water_leakage": ["pipe/tank", "wet surface", "nearby electrical or structural assets"],
    "animal_intrusion": ["animal", "public path", "nearby residents"],
    "vehicle_obstruction": ["vehicle", "road/access path", "traffic flow"],
}

CATEGORY_HAZARDS = {
    "safety_fire": ("Fire, smoke, gas, or electrical ignition risk", "Critical"),
    "road_damage": ("Vehicle impact, fall, or traffic disruption risk", "Medium"),
    "tree_obstruction": ("Blocked road or falling branch risk", "High"),
    "garbage": ("Public health and sanitation risk", "Low"),
    "sewage_overflow": ("Contamination, fall, or open-drain risk", "High"),
    "water_drainage": ("Flooding, slip, or traffic slowdown risk", "Medium"),
    "wall_damage": ("Structural instability risk", "High"),
    "security": ("Personal safety or unauthorized access risk", "High"),
    "utility_fault": ("Electrical shock, outage, or fire escalation risk", "High"),
    "water_leakage": ("Water loss, slip, or asset damage risk", "Medium"),
    "animal_intrusion": ("Bite, obstruction, or public safety risk", "Medium"),
    "vehicle_obstruction": ("Access blockage or traffic safety risk", "Medium"),
}


def clamp01(value):
    return max(0.0, min(1.0, float(value or 0)))


def _safe_round(value, digits=3):
    return round(clamp01(value), digits)


def decode_image_bytes(image_base64):
    if not image_base64:
        return b""

    payload = str(image_base64).strip()
    if "," in payload:
        payload = payload.split(",", 1)[1]

    try:
        raw = base64.b64decode(payload, validate=True)
    except Exception:
        return b""

    if not raw or len(raw) > VISION_MAX_IMAGE_BYTES:
        return b""

    return raw


def dhash(image):
    if Image is None or image is None:
        return ""

    try:
        gray = image.convert("L").resize((9, 8))
        pixels = list(gray.getdata())
        bits = []
        for row in range(8):
            offset = row * 9
            for col in range(8):
                bits.append(1 if pixels[offset + col] > pixels[offset + col + 1] else 0)
        value = 0
        for bit in bits:
            value = (value << 1) | bit
        return f"{value:016x}"
    except Exception:
        return ""


def hamming_hex(left, right):
    try:
        return bin(int(left, 16) ^ int(right, 16)).count("1")
    except Exception:
        return 64


def _image_quality_notes(image):
    if image is None or ImageStat is None:
        return []

    notes = []
    try:
        stat = ImageStat.Stat(image.convert("L"))
        brightness = stat.mean[0] / 255
        contrast = stat.stddev[0] / 255
        if brightness < 0.12:
            notes.append("Image is very dark, which can reduce visual certainty.")
        if brightness > 0.92:
            notes.append("Image is very bright, which can hide fine details.")
        if contrast < 0.08:
            notes.append("Image has low contrast, so small hazards may be harder to verify.")
    except Exception:
        return notes

    return notes


def build_image_integrity(image_base64, image, image_mime_type):
    raw = decode_image_bytes(image_base64)
    sha256 = hashlib.sha256(raw).hexdigest() if raw else ""
    metadata_present = False
    gps_present = False
    image_format = ""
    width = getattr(image, "width", None)
    height = getattr(image, "height", None)
    notes = []

    if raw and Image is not None:
        try:
            original = Image.open(io.BytesIO(raw))
            image_format = original.format or ""
            width = original.width
            height = original.height
            exif = original.getexif()
            metadata_present = bool(exif)
            gps_present = 34853 in exif if exif else False
        except Exception:
            notes.append("Image bytes were received but metadata could not be inspected.")

    if raw and not metadata_present:
        notes.append("No EXIF metadata found; this is common for browser-compressed uploads.")
    if raw:
        notes.extend(_image_quality_notes(image))
    if image_mime_type and image_format and image_mime_type.split("/")[-1].lower() not in image_format.lower():
        notes.append("MIME type and decoded image format differ; review if the upload looks suspicious.")

    return {
        "status": "checked" if raw and image is not None else ("invalid_or_missing" if image_base64 else "no_image"),
        "sha256": sha256,
        "dHash": dhash(image) if image is not None else "",
        "width": width or 0,
        "height": height or 0,
        "format": image_format,
        "mimeType": image_mime_type or "",
        "bytes": len(raw),
        "metadataPresent": metadata_present,
        "hasExif": metadata_present,
        "gpsPresent": gps_present,
        "possibleScreenshot": bool(raw and not metadata_present),
        "possibleManipulation": "inconclusive",
        "notes": notes[:4],
    }


def _candidate_category_ids(candidates):
    return {
        item.get("category_id") or item.get("categoryId")
        for item in candidates or []
        if item.get("category_id") or item.get("categoryId")
    }


def _candidate_confidence(candidates, category_id, default=0.0):
    for item in candidates or []:
        if (item.get("category_id") or item.get("categoryId")) == category_id:
            return clamp01(item.get("confidence", default))
    return clamp01(default)


def _top_margin(candidates):
    if len(candidates or []) < 2:
        return 0.0
    return clamp01(float(candidates[0].get("confidence") or 0) - float(candidates[1].get("confidence") or 0))


def _has_any(text, terms):
    return any(term in text for term in terms)


def _relationship(rule_id, label, severity, confidence, evidence):
    return {
        "rule": rule_id,
        "label": label,
        "severity": severity,
        "confidence": _safe_round(confidence),
        "evidence": evidence[:4],
    }


def infer_relationships(category_ids, normalized_text, candidates):
    relationships = []

    def has_category(category_id):
        return category_id in category_ids

    def strong_category(category_id, minimum=0.46):
        return has_category(category_id) and _candidate_confidence(candidates, category_id) >= minimum

    road_context = _has_any(normalized_text, ["road", "street", "main road", "junction", "lane", "traffic", "blocked"])
    electrical_context = _has_any(normalized_text, ["wire", "live wire", "electric", "electrical", "pole", "transformer", "spark", "streetlight", "power"])
    water_context = _has_any(normalized_text, ["water", "flood", "wet", "drain", "sewage", "leak", "overflow"])
    sewage_context = _has_any(normalized_text, ["open manhole", "manhole", "sewage", "drain overflow", "dirty water", "gutter", "sludge"])

    if strong_category("tree_obstruction", 0.36) and road_context:
        relationships.append(
            _relationship(
                "tree_blocks_route",
                "Tree or branch appears related to a road/access obstruction.",
                "High",
                0.78 + _candidate_confidence(candidates, "tree_obstruction") * 0.12,
                ["tree obstruction visual candidate", "road/access wording or location context"],
            )
        )
    if strong_category("tree_obstruction", 0.36) and electrical_context:
        relationships.append(
            _relationship(
                "tree_near_electrical_asset",
                "Tree obstruction may involve live wires or electrical assets.",
                "Critical",
                0.82,
                ["tree obstruction candidate", "electrical-risk wording"],
            )
        )
    if (strong_category("water_drainage") or strong_category("water_leakage") or water_context) and (strong_category("utility_fault") or electrical_context):
        relationships.append(
            _relationship(
                "water_electrical_contact",
                "Water near electrical infrastructure can create shock or fire risk.",
                "Critical",
                0.84,
                ["water/drainage signal", "electrical-risk signal"],
            )
        )
    if strong_category("safety_fire") or _has_any(normalized_text, ["fire", "smoke", "gas leak", "burning", "explosion"]):
        relationships.append(
            _relationship(
                "fire_smoke_immediate_risk",
                "Fire, smoke, gas, or ignition wording indicates immediate safety risk.",
                "Critical",
                0.88,
                ["fire/smoke/gas category or wording"],
            )
        )
    if strong_category("sewage_overflow", 0.5) and sewage_context and _has_any(normalized_text, ["open manhole", "manhole", "children", "school", "hospital", "road"]):
        relationships.append(
            _relationship(
                "sewage_open_manhole_exposure",
                "Sewage or manhole issue may expose people to fall or contamination risk.",
                "High",
                0.76,
                ["sewage/manhole candidate", "public-exposure wording"],
            )
        )
    if strong_category("road_damage", 0.52) and _has_any(normalized_text, ["sinkhole", "collapse", "junction", "ambulance", "school bus"]):
        relationships.append(
            _relationship(
                "road_damage_traffic_hazard",
                "Road damage may create a serious vehicle or emergency-route hazard.",
                "High",
                0.74,
                ["road damage candidate", "traffic-sensitive context"],
            )
        )
    if strong_category("wall_damage", 0.5) and _has_any(normalized_text, ["collapse", "ceiling falling", "people inside", "school building", "structural"]):
        relationships.append(
            _relationship(
                "structural_failure_exposure",
                "Structural damage may expose people to collapse or falling-debris risk.",
                "Critical",
                0.82,
                ["wall/building damage candidate", "collapse/exposure wording"],
            )
        )
    if strong_category("vehicle_obstruction", 0.5) and _has_any(normalized_text, ["ambulance", "hospital", "fire lane", "blocked entrance", "driveway", "gate"]):
        relationships.append(
            _relationship(
                "emergency_access_blocked",
                "Vehicle obstruction may block emergency or essential access.",
                "High",
                0.76,
                ["vehicle obstruction candidate", "access-sensitive context"],
            )
        )
    if strong_category("animal_intrusion", 0.5) and _has_any(normalized_text, ["bite", "attack", "children", "school", "pack", "aggressive"]):
        relationships.append(
            _relationship(
                "animal_public_safety",
                "Animal intrusion may create bite, attack, or child-safety risk.",
                "High",
                0.74,
                ["animal candidate", "public-safety wording"],
            )
        )
    if strong_category("garbage", 0.5) and _has_any(normalized_text, ["hospital", "school", "food", "market", "foul smell"]):
        relationships.append(
            _relationship(
                "sanitation_sensitive_zone",
                "Garbage issue is in a sensitive public-health context.",
                "Medium",
                0.66,
                ["garbage candidate", "sensitive-location wording"],
            )
        )

    return relationships[:6]


def build_hazards(category_ids, candidates, relationships, primary_category_id, normalized_text):
    hazards = []
    top_confidence = _candidate_confidence(candidates, primary_category_id, 0)
    secondary_threshold = max(0.5, top_confidence - 0.22)

    for category_id in category_ids:
        if category_id not in CATEGORY_HAZARDS:
            continue
        label, severity = CATEGORY_HAZARDS[category_id]
        raw_confidence = _candidate_confidence(candidates, category_id, 0)
        required_confidence = 0.36 if category_id == primary_category_id else secondary_threshold
        if category_id != primary_category_id:
            if category_id == "road_damage" and not _has_any(normalized_text, ["pothole", "road crack", "broken road", "damaged road", "sinkhole", "road collapse", "cave in"]):
                continue
            if category_id == "sewage_overflow" and not _has_any(normalized_text, ["open manhole", "manhole", "sewage", "drain overflow", "dirty water", "gutter", "sludge"]):
                continue
            if category_id == "wall_damage" and not _has_any(normalized_text, ["wall", "ceiling", "crack", "structural", "collapse", "plaster"]):
                continue
        if raw_confidence < required_confidence:
            continue
        confidence = max(raw_confidence, 0.42)
        hazards.append(
            {
                "id": category_id,
                "label": label,
                "severity": severity,
                "confidence": _safe_round(confidence),
                "evidence": [f"{CATEGORY_BY_ID.get(category_id, {}).get('label', category_id)} visual/text signal"],
            }
        )

    for relation in relationships:
        if relation["severity"] in {"Critical", "High"}:
            hazards.append(
                {
                    "id": relation["rule"],
                    "label": relation["label"],
                    "severity": relation["severity"],
                    "confidence": relation["confidence"],
                    "evidence": relation["evidence"],
                }
            )

    hazards.sort(key=lambda item: (SEVERITY_SCORES.get(item["severity"], 0), item["confidence"]), reverse=True)
    return hazards[:6]


def build_affected_objects(category_id, candidates):
    assets = CATEGORY_ASSETS.get(category_id, ["public asset", "affected area"])
    base_confidence = _candidate_confidence(candidates, category_id, 0.42)
    return [
        {
            "label": asset,
            "confidence": _safe_round(max(0.36, base_confidence - index * 0.06)),
            "evidence": "category-specific threat model",
        }
        for index, asset in enumerate(assets[:4])
    ]


def build_consensus(candidates, pass_diagnostics, fallback_used):
    top_category = (candidates[0].get("category_id") or candidates[0].get("categoryId")) if candidates else ""
    pass_summaries = (pass_diagnostics or {}).get("passes") or []
    matching_passes = [
        item for item in pass_summaries if (item.get("topCategoryId") or item.get("category_id")) == top_category
    ]
    pass_count = len(pass_summaries)
    agreement = len(matching_passes) / pass_count if pass_count else (1.0 if top_category else 0.0)

    return {
        "passCount": pass_count,
        "agreement": round(agreement, 3),
        "topMargin": round(_top_margin(candidates), 3),
        "cropAgreement": round(agreement, 3),
        "sources": ["feature-fallback"] if fallback_used else ["clip-full-image", "clip-crops", "feature-signals"],
    }


def _month_bucket(value):
    if not value:
        return ""
    try:
        if isinstance(value, datetime):
            return value.astimezone(timezone.utc).strftime("%Y-%m")
        text = str(value).replace("Z", "+00:00")
        return datetime.fromisoformat(text).astimezone(timezone.utc).strftime("%Y-%m")
    except Exception:
        return ""


def build_duplicate_correlation(integrity, category_id, normalized_text, previous_complaints, recent_area_complaints):
    current_hash = integrity.get("sha256") or ""
    current_dhash = integrity.get("dHash") or ""
    exact_matches = []
    near_matches = []
    related_ids = set()
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")

    for complaint in list(previous_complaints or []) + list(recent_area_complaints or []):
        complaint_id = str(complaint.get("_id") or complaint.get("id") or "")
        stored_hash = complaint.get("threatFingerprint") or complaint.get("imageFingerprint") or ""
        stored_dhash = complaint.get("threatDHash") or complaint.get("dHash") or ""
        stored_category = complaint.get("threatCategoryId") or complaint.get("categoryId") or ""
        stored_type = normalize_text(complaint.get("type") or complaint.get("description") or "")
        same_month = _month_bucket(complaint.get("createdAt")) == current_month

        if current_hash and stored_hash and current_hash == stored_hash:
            exact_matches.append(complaint_id or "stored complaint")
        if current_dhash and stored_dhash and hamming_hex(current_dhash, stored_dhash) <= 8:
            near_matches.append(complaint_id or "stored complaint")
        if same_month and (stored_category == category_id or (stored_type and normalized_text and stored_type[:28] in normalized_text)):
            if complaint_id:
                related_ids.add(complaint_id)

    exact_matches = list(dict.fromkeys(exact_matches))[:5]
    near_matches = list(dict.fromkeys(near_matches))[:5]
    related_recent_count = len(related_ids)
    cluster_risk = "elevated" if exact_matches or near_matches or related_recent_count >= 3 else "normal"
    reason = "No matching recent threat cluster found."
    if exact_matches:
        reason = "Exact image fingerprint matched an earlier complaint."
    elif near_matches:
        reason = "Near-duplicate image fingerprint matched an earlier complaint."
    elif related_recent_count:
        reason = f"{related_recent_count} related recent complaint(s) found in the area."

    return {
        "status": "matched" if cluster_risk == "elevated" else "clear",
        "exactMatches": len(exact_matches),
        "nearMatches": len(near_matches),
        "relatedRecentCount": related_recent_count,
        "clusterRisk": cluster_risk,
        "matchedComplaintIds": list(dict.fromkeys(exact_matches + near_matches + list(related_ids)))[:8],
        "reason": reason,
    }


def decide_status(confidence, consensus, relationships, image_present, has_text):
    if not image_present:
        return "no_image"
    if confidence >= 0.78 and consensus.get("agreement", 0) >= 0.5 and relationships:
        return "confirmed"
    if confidence >= 0.52 and consensus.get("topMargin", 0) >= 0.06:
        return "probable"
    if confidence >= 0.44 and has_text:
        return "probable"
    return "uncertain"


def build_threat_assessment(
    *,
    image,
    image_base64,
    image_mime_type,
    image_features,
    image_hint,
    candidates,
    top_detection,
    pass_diagnostics=None,
    fallback_used=True,
    previous_complaints=None,
    recent_area_complaints=None,
    location="",
):
    normalized_text = normalize_text(" ".join([str(image_hint or ""), str(location or "")]))
    candidates = candidates or []
    top_detection = top_detection or (candidates[0] if candidates else None)
    category_id = (top_detection or {}).get("category_id") or (top_detection or {}).get("categoryId") or "general"
    category = CATEGORY_BY_ID.get(category_id, {})
    top_confidence = clamp01((top_detection or {}).get("confidence") or 0)
    category_ids = _candidate_category_ids(candidates)
    if category_id and category_id != "general":
        category_ids.add(category_id)

    integrity = build_image_integrity(image_base64, image, image_mime_type)
    image_present = integrity["status"] == "checked" or bool(image_features)
    consensus = build_consensus(candidates, pass_diagnostics, fallback_used)
    relationships = infer_relationships(category_ids, normalized_text, candidates)
    hazards = build_hazards(category_ids, candidates, relationships, category_id, normalized_text)
    affected_objects = build_affected_objects(category_id, candidates)

    base_priority = float(category.get("base_priority", 0.42))
    max_relationship_score = max((SEVERITY_SCORES.get(item["severity"], 0) for item in relationships), default=0)
    risk_text_boost = 0.12 if _has_any(normalized_text, TEXT_RISK_TERMS) else 0
    cluster = build_duplicate_correlation(
        integrity,
        category_id,
        normalized_text,
        previous_complaints,
        recent_area_complaints,
    )
    cluster_boost = 0.08 if cluster["clusterRisk"] == "elevated" else 0
    risk_score = clamp01(base_priority * 0.66 + top_confidence * 0.18 + max_relationship_score + risk_text_boost + cluster_boost)

    if any(item["severity"] == "Critical" for item in hazards) or risk_score >= 0.86:
        threat_level = "Critical"
    elif any(item["severity"] == "High" for item in hazards) or risk_score >= 0.72:
        threat_level = "High"
    elif risk_score >= 0.52:
        threat_level = "Medium"
    elif image_present:
        threat_level = "Low"
    else:
        threat_level = "Needs Review"

    confidence = clamp01(top_confidence * 0.72 + consensus.get("agreement", 0) * 0.16 + consensus.get("topMargin", 0) * 0.3)
    if fallback_used:
        confidence -= 0.05
    if cluster["clusterRisk"] == "elevated":
        confidence += 0.04
    confidence = clamp01(confidence)
    status = decide_status(confidence, consensus, relationships, image_present, bool(normalized_text))

    visual_evidence = []
    if top_detection:
        visual_evidence.append(
            f"Top visual candidate: {(top_detection.get('label') or top_detection.get('category_label') or category.get('label') or 'incident')} ({top_confidence:.2f})."
        )
    for item in hazards[:3]:
        visual_evidence.append(f"{item['severity']} hazard: {str(item['label']).rstrip('.')}.")
    for item in integrity.get("notes", [])[:2]:
        visual_evidence.append(item)

    alternatives = [
        {
            "categoryId": item.get("category_id") or item.get("categoryId") or "",
            "label": item.get("category_label") or item.get("label") or "",
            "confidence": _safe_round(item.get("confidence")),
        }
        for item in candidates[1:4]
    ]

    counter_evidence = []
    if len(candidates) > 1 and _top_margin(candidates) < 0.08:
        counter_evidence.append("Top visual alternatives are close together, so the exact incident type should be reviewed.")
    if fallback_used:
        counter_evidence.append("Vision used deterministic fallback signals instead of the optional CLIP model.")

    missing_evidence = []
    if not normalized_text:
        missing_evidence.append("No written or voice description was available to confirm the image interpretation.")
    if not location:
        missing_evidence.append("No location context was available for exposure assessment.")
    if integrity["status"] != "checked" and image_base64:
        missing_evidence.append("Uploaded image could not be fully decoded for integrity checks.")

    follow_up_questions = []
    if threat_level in {"Critical", "High"}:
        follow_up_questions.append("Are people, vehicles, or emergency access currently affected?")
    if any(item["rule"] == "water_electrical_contact" for item in relationships):
        follow_up_questions.append("Is the electrical supply isolated from the wet area?")
    if status == "uncertain":
        follow_up_questions.append("Can the reporter provide one clearer photo or a short description?")

    people_at_risk = _has_any(normalized_text, ["people", "children", "school", "hospital", "main road", "junction", "traffic", "ambulance"]) or any(
        item["severity"] == "Critical" for item in relationships
    )
    abstained = status == "uncertain" and confidence < 0.46
    safety_action = "auto_route"
    if abstained:
        safety_action = "request_more_evidence"
    elif image_present and (status == "uncertain" or (threat_level in {"Critical", "High"} and confidence < 0.52)):
        safety_action = "needs_review"

    return {
        "status": status,
        "provider": "ai-service-threat-intelligence",
        "engine": "visual-consensus-threat-v1",
        "incident": category.get("label") or (top_detection or {}).get("label") or "Civic incident",
        "incidentCategoryId": category_id,
        "threatLevel": threat_level,
        "riskScore": round(risk_score, 3),
        "confidence": round(confidence, 3),
        "peopleAtRisk": bool(people_at_risk) if image_present else None,
        "hazards": hazards,
        "affectedObjects": affected_objects,
        "relationships": relationships,
        "visualEvidence": visual_evidence[:6],
        "counterEvidence": counter_evidence[:4],
        "missingEvidence": missing_evidence[:4],
        "followUpQuestions": follow_up_questions[:4],
        "alternatives": alternatives,
        "consensus": consensus,
        "integrity": integrity,
        "duplicateCorrelation": cluster,
        "safetyGate": {
            "action": safety_action,
            "reason": "Threat signal is clear enough for routing." if safety_action == "auto_route" else "Threat signal needs confirmation before relying on it fully.",
            "abstained": abstained,
        },
    }
