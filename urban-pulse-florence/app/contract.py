SCHEMA_VERSION = "1.0"
QUALITY_STATES = {"usable", "limited", "blurry", "dark", "overexposed", "invalid"}


def clean_text(value, limit):
    return " ".join(str(value or "").split())[:limit]


def clean_list(value, limit=8, item_limit=180):
    if not isinstance(value, list):
        return []
    cleaned = [clean_text(item, item_limit) for item in value[:limit]]
    return list(dict.fromkeys(item for item in cleaned if item))


def normalize_observations(value):
    if not isinstance(value, dict):
        raise ValueError("Observations must be an object")
    scene = clean_text(value.get("sceneDescription"), 900)
    if not scene:
        raise ValueError("Scene description is required")

    issues = []
    for item in value.get("visibleCivicIssues", []):
        if not isinstance(item, dict):
            continue
        issue = clean_text(item.get("issue"), 180)
        evidence = clean_list(item.get("visibleEvidence"), 5, 160)
        if issue and evidence:
            try:
                confidence = round(max(0.0, min(1.0, float(item.get("confidence", 0)))), 3)
            except (TypeError, ValueError):
                confidence = 0.0
            issues.append({"issue": issue, "visibleEvidence": evidence, "confidence": confidence})

    quality = value.get("imageQuality") if isinstance(value.get("imageQuality"), dict) else {}
    quality_status = clean_text(quality.get("status"), 20).lower()
    if quality_status not in QUALITY_STATES:
        quality_status = "limited"
    uncertainty = value.get("uncertainty") if isinstance(value.get("uncertainty"), dict) else {}
    review = bool(value.get("humanReviewRecommended") or not issues or quality_status != "usable")
    return {
        "sceneDescription": scene,
        "visibleCivicIssues": issues[:8],
        "damagedInfrastructure": clean_list(value.get("damagedInfrastructure"), 8, 160),
        "hazards": clean_list(value.get("hazards"), 8, 180),
        "environmentalConditions": clean_list(value.get("environmentalConditions"), 6, 160),
        "multipleProblems": bool(value.get("multipleProblems") or len(issues) > 1),
        "imageQuality": {"status": quality_status, "limitations": clean_list(quality.get("limitations"), 5, 180)},
        "uncertainty": {
            "present": bool(uncertainty.get("present") or not issues),
            "reason": clean_text(uncertainty.get("reason"), 400),
        },
        "humanReviewRecommended": review,
    }
