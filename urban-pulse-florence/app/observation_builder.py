import re

from app.contract import normalize_observations


ISSUE_RULES = (
    (r"\b(spark|sparking|exposed wire|broken wire|power line|electric cable|transformer)\b", "Visible electrical infrastructure hazard", "electrical equipment or wiring"),
    (r"\b(fallen tree|tree fallen|uprooted tree|broken branch)\b", "Fallen tree or branch obstructing the area", "fallen tree or branch"),
    (r"\b(pothole|road crack|broken road|damaged road|road damage)\b", "Visible damage to the road surface", "damaged road surface"),
    (r"\b(flood|flooded|waterlogged|standing water)\b", "Standing water or flooding is visible", "standing water"),
    (r"\b(open manhole|uncovered manhole|sewer opening)\b", "Open or uncovered manhole is visible", "uncovered opening"),
    (r"\b(garbage|trash|rubbish|waste pile|overflowing bin)\b", "Accumulated or overflowing waste is visible", "visible waste accumulation"),
    (r"\b(sewage|sewer overflow|dirty drain|drain overflow)\b", "Sewage or drain overflow is visible", "visible contaminated overflow"),
    (r"\b(smoke|flame|fire|burning)\b", "Smoke or fire is visible", "visible smoke or flame"),
    (r"\b(broken streetlight|damaged street light|street lamp.*broken)\b", "Damaged street-lighting equipment is visible", "damaged lighting equipment"),
    (r"\b(collapse|collapsed wall|damaged building|debris)\b", "Damaged structure or debris is visible", "structural damage or debris"),
    (r"\b(dead animal|injured animal|stray dog|stray cattle)\b", "Animal-related issue is visible", "animal in the affected area"),
)


def build_observations(caption, quality):
    description = " ".join(str(caption or "").split())[:900]
    lowered = description.lower()
    issues = []
    damaged = []
    hazards = []
    conditions = []
    for pattern, issue, evidence in ISSUE_RULES:
        if re.search(pattern, lowered):
            issues.append({"issue": issue, "visibleEvidence": [evidence], "confidence": 0.68})

    if any(term in lowered for term in ("wire", "cable", "transformer", "streetlight", "lamp")):
        damaged.append("electrical or lighting infrastructure")
    if any(term in lowered for term in ("road", "pothole", "manhole")):
        damaged.append("road or street infrastructure")
    if any(term in lowered for term in ("spark", "wire", "fire", "smoke")):
        hazards.append("Possible immediate safety hazard; keep a safe distance")
    if any(term in lowered for term in ("blocking", "obstruct", "pothole", "manhole")):
        hazards.append("Possible obstruction or collision hazard")
    if any(term in lowered for term in ("rain", "wet", "water", "flood")):
        conditions.append("wet or water-affected surroundings")

    uncertain = not issues
    reason = "No specific civic issue could be reliably extracted from the visual caption." if uncertain else ""
    return normalize_observations({
        "sceneDescription": description or "The image did not produce a usable visual description.",
        "visibleCivicIssues": issues,
        "damagedInfrastructure": damaged,
        "hazards": hazards,
        "environmentalConditions": conditions,
        "multipleProblems": len(issues) > 1,
        "imageQuality": quality,
        "uncertainty": {"present": uncertain, "reason": reason},
        "humanReviewRecommended": uncertain or quality.get("status") != "usable",
    })
