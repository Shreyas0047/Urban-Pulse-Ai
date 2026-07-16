SCHEMA_VERSION = "1.0"
QUALITY_STATES = {"usable", "limited", "blurry", "dark", "overexposed", "invalid"}


def clean_text(value, limit):
    return " ".join(str(value or "").split())[:limit]


def clean_list(value, limit=8, item_limit=180):
    if not isinstance(value, list):
        return []
    cleaned = [clean_text(item, item_limit) for item in value[:limit]]
    return list(dict.fromkeys(item for item in cleaned if item))


def clamp_confidence(value):
    try:
        return round(max(0.0, min(1.0, float(value))), 3)
    except (TypeError, ValueError):
        return 0.0


def validate_observations(value):
    """Normalize untrusted provider JSON into the shared perception contract."""
    if not isinstance(value, dict):
        raise ValueError("Vision-provider response was not a JSON object")

    quality = value.get("imageQuality") if isinstance(value.get("imageQuality"), dict) else {}
    quality_status = clean_text(quality.get("status"), 20).lower()
    if quality_status not in QUALITY_STATES:
        quality_status = "limited"

    issues = []
    source_issues = value.get("visibleCivicIssues") if isinstance(value.get("visibleCivicIssues"), list) else []
    for item in source_issues:
        if not isinstance(item, dict):
            continue
        issue = clean_text(item.get("issue"), 180)
        evidence = clean_list(item.get("visibleEvidence"), 5, 160)
        if issue and evidence:
            issues.append({
                "issue": issue,
                "visibleEvidence": evidence,
                "confidence": clamp_confidence(item.get("confidence")),
            })

    uncertainty = value.get("uncertainty") if isinstance(value.get("uncertainty"), dict) else {}
    normalized = {
        "sceneDescription": clean_text(value.get("sceneDescription"), 900),
        "visibleCivicIssues": issues[:8],
        "damagedInfrastructure": clean_list(value.get("damagedInfrastructure"), 8, 160),
        "hazards": clean_list(value.get("hazards"), 8, 180),
        "environmentalConditions": clean_list(value.get("environmentalConditions"), 6, 160),
        "multipleProblems": bool(value.get("multipleProblems") or len(issues) > 1),
        "imageQuality": {
            "status": quality_status,
            "limitations": clean_list(quality.get("limitations"), 5, 180),
        },
        "uncertainty": {
            "present": bool(uncertainty.get("present")),
            "reason": clean_text(uncertainty.get("reason"), 400),
        },
        "humanReviewRecommended": bool(value.get("humanReviewRecommended")),
    }
    if not normalized["sceneDescription"]:
        raise ValueError("Vision-provider response omitted the scene description")
    if not issues:
        normalized["uncertainty"]["present"] = True
        normalized["humanReviewRecommended"] = True
    if quality_status != "usable":
        normalized["humanReviewRecommended"] = True
    return normalized


def provider_result(provider, model, observations, **metadata):
    normalized = validate_observations(observations)
    return {
        "schemaVersion": SCHEMA_VERSION,
        "status": "available",
        "provider": provider,
        "model": clean_text(model, 120),
        "description": normalized["sceneDescription"],
        "structuredObservations": normalized,
        "reason": "",
        **metadata,
    }
