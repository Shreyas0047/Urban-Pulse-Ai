import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "ai_service"))

from pipeline import run_hybrid_pipeline  # noqa: E402
from resolution_analysis import compare_resolution_evidence  # noqa: E402


CASES = [
    {
        "name": "text_tree_obstruction",
        "payload": {
            "textComplaint": "A fallen tree is blocking the main road near the school.",
            "location": "Main road near school",
        },
        "expectedCategory": "tree_obstruction",
        "expectReview": False,
    },
    {
        "name": "text_utility_fault",
        "payload": {
            "textComplaint": "There is a live wire hanging from the streetlight pole and sparks are visible.",
            "location": "Market junction",
        },
        "expectedCategory": "utility_fault",
        "expectReview": False,
    },
    {
        "name": "image_only_tree_obstruction",
        "payload": {
            "imageFeatures": {
                "width": 800,
                "height": 600,
                "averageBrightness": 0.42,
                "averageSaturation": 0.48,
                "edgeDensity": 0.28,
                "redHeatRatio": 0.01,
                "smokeLikeRatio": 0.05,
                "darkRatio": 0.26,
                "greenRatio": 0.42,
                "blueRatio": 0.03,
                "hotspotRatio": 0.01,
                "neutralRatio": 0.18,
                "contrast": 0.24,
            },
            "location": "Main road",
        },
        "expectedCategory": "tree_obstruction",
        "expectReview": False,
    },
    {
        "name": "image_only_electrical_short_circuit",
        "payload": {
            "imageFeatures": {
                "width": 800,
                "height": 600,
                "averageBrightness": 0.38,
                "averageSaturation": 0.31,
                "edgeDensity": 0.5,
                "redHeatRatio": 0.35,
                "smokeLikeRatio": 0.02,
                "darkRatio": 0.3,
                "greenRatio": 0.02,
                "blueRatio": 0.04,
                "hotspotRatio": 0.75,
                "neutralRatio": 0.2,
                "contrast": 0.52,
            },
            "location": "Electrical pole near market",
        },
        "expectedCategory": "utility_fault",
        "expectReview": False,
    },
    {
        "name": "ambiguous_dark_image_abstains",
        "payload": {
            "imageFeatures": {
                "width": 800,
                "height": 600,
                "averageBrightness": 0.2,
                "averageSaturation": 0.12,
                "edgeDensity": 0.18,
                "redHeatRatio": 0.03,
                "smokeLikeRatio": 0.08,
                "darkRatio": 0.72,
                "greenRatio": 0.03,
                "blueRatio": 0.03,
                "hotspotRatio": 0.01,
                "neutralRatio": 0.7,
                "contrast": 0.18,
            },
            "location": "Bengaluru",
        },
        "expectedCategory": "general",
        "expectReview": True,
    },
    {
        "name": "text_image_conflict",
        "payload": {
            "textComplaint": "Garbage has overflowed near the apartment entrance.",
            "imageFeatures": {
                "width": 800,
                "height": 600,
                "averageBrightness": 0.42,
                "averageSaturation": 0.48,
                "edgeDensity": 0.28,
                "redHeatRatio": 0.01,
                "smokeLikeRatio": 0.05,
                "darkRatio": 0.26,
                "greenRatio": 0.42,
                "blueRatio": 0.03,
                "hotspotRatio": 0.01,
                "neutralRatio": 0.18,
                "contrast": 0.24,
            },
            "location": "Apartment entrance",
        },
        "expectedConflict": True,
        "expectReview": True,
    },
    {
        "name": "high_risk_fire_escalation",
        "payload": {
            "textComplaint": "There is fire and smoke from a transformer with sparks near the hospital entrance. People are nearby.",
            "location": "Hospital entrance",
            "imageFeatures": {
                "redHeatRatio": 0.72,
                "smokeLikeRatio": 0.68,
                "hotspotRatio": 0.45,
                "edgeDensity": 0.4,
                "contrast": 0.5,
            },
        },
        "expectedCategory": "safety_fire",
        "expectedPriority": "CRITICAL",
        "expectedThreat": "Critical",
        "expectReview": False,
    },
    {
        "name": "water_electrical_contact_escalation",
        "payload": {
            "textComplaint": "Water is flooding around an electric pole with live wire sparks on the main road.",
            "location": "Main road",
            "imageFeatures": {
                "blueRatio": 0.42,
                "neutralRatio": 0.42,
                "edgeDensity": 0.3,
                "redHeatRatio": 0.32,
                "hotspotRatio": 0.3,
            },
        },
        "expectedPriority": "CRITICAL",
        "expectedThreat": "Critical",
        "expectReview": True,
    },
    {
        "name": "malformed_context_and_features_do_not_crash",
        "payload": {
            "textComplaint": "There is smoke and sparks near a transformer by the school gate.",
            "location": "School gate",
            "imageFeatures": {
                "greenRatio": "bad",
                "edgeDensity": 2,
                "blueRatio": -1,
                "contrast": None,
            },
            "previousComplaints": {"bad": "shape"},
            "recentAreaComplaints": "bad",
        },
        "expectedPriority": "CRITICAL",
        "expectedThreat": "Critical",
        "expectReview": True,
    },
    {
        "name": "vague_text_abstains_instead_of_guessing",
        "payload": {
            "textComplaint": "Please check this issue in my area.",
            "location": "Unknown",
        },
        "expectedCategory": "general",
        "expectedAbstained": True,
        "expectReview": True,
    },
    {
        "name": "weak_image_abstains_instead_of_guessing",
        "payload": {
            "imageFeatures": {
                "edgeDensity": 0.12,
                "contrast": 0.1,
                "neutralRatio": 0.2,
                "averageBrightness": 0.5,
            },
            "location": "Unknown",
        },
        "expectedCategory": "general",
        "expectedAbstained": True,
        "expectReview": True,
    },
]


REQUIRED_DECISION_KEYS = {
    "finalCategory",
    "finalCategoryId",
    "confidence",
    "confidenceLabel",
    "reviewRequired",
    "abstained",
    "conflictDetected",
    "evidenceUsed",
    "reasoning",
    "quality",
}


def evaluate_case(case):
    result = run_hybrid_pipeline(
        {
            "voiceTranscript": "",
            "previousComplaints": [],
            "recentAreaComplaints": [],
            **case["payload"],
        }
    )
    decision = result.get("decision") or {}
    missing = sorted(REQUIRED_DECISION_KEYS - set(decision))
    category = result.get("aiMeta", {}).get("categoryId") or result.get("category")
    passed = not missing

    if case.get("expectedCategory"):
        passed = passed and category == case["expectedCategory"]
    if "expectedConflict" in case:
        passed = passed and bool(decision.get("conflictDetected")) == case["expectedConflict"]
    if "expectReview" in case:
        passed = passed and bool(decision.get("reviewRequired")) == case["expectReview"]
    if "expectedAbstained" in case:
        passed = passed and bool(decision.get("abstained")) == case["expectedAbstained"]
    if case.get("expectedPriority"):
        passed = passed and result.get("priority", {}).get("level") == case["expectedPriority"]
    if case.get("expectedThreat"):
        passed = passed and result.get("threatAssessment", {}).get("threatLevel") == case["expectedThreat"]

    return {
        "name": case["name"],
        "passed": passed,
        "category": category,
        "priority": result.get("priority", {}).get("level"),
        "threat": result.get("threatAssessment", {}).get("threatLevel"),
        "confidence": decision.get("confidence"),
        "confidenceLabel": decision.get("confidenceLabel"),
        "reviewRequired": decision.get("reviewRequired"),
        "abstained": decision.get("abstained"),
        "conflictDetected": decision.get("conflictDetected"),
        "missingDecisionKeys": missing,
    }


def main():
    results = [evaluate_case(case) for case in CASES]
    resolution_cases = [
        {
            "name": "resolved_high_risk_requires_review",
            "payload": {"originalCategoryId": "utility_fault", "originalType": "Utility Fault", "originalPriority": "High", "vote": "resolved", "note": "The wire was repaired."},
            "expectedOutcome": "needs_admin_review",
        },
        {
            "name": "still_there_requests_rework",
            "payload": {"originalCategoryId": "garbage", "originalType": "Garbage Overflow", "originalPriority": "Low", "vote": "still_there", "note": "Garbage is still on the road."},
            "expectedOutcome": "needs_rework",
        },
    ]
    for case in resolution_cases:
        comparison = compare_resolution_evidence(case["payload"])
        results.append(
            {
                "name": case["name"],
                "passed": comparison.get("outcome") == case["expectedOutcome"],
                "outcome": comparison.get("outcome"),
                "confidence": comparison.get("confidence"),
            }
        )
    failures = [result for result in results if not result["passed"]]
    report = {
        "evaluated": len(results),
        "passed": len(results) - len(failures),
        "failed": len(failures),
        "engine": "ai-service-decision-engine-v5",
        "failures": failures,
        "results": results,
    }
    print(json.dumps(report, indent=2))
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
