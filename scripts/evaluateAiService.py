import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "ai_service"))

from pipeline import run_hybrid_pipeline  # noqa: E402


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
]


REQUIRED_DECISION_KEYS = {
    "finalCategory",
    "finalCategoryId",
    "confidence",
    "confidenceLabel",
    "reviewRequired",
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

    return {
        "name": case["name"],
        "passed": passed,
        "category": category,
        "confidence": decision.get("confidence"),
        "confidenceLabel": decision.get("confidenceLabel"),
        "reviewRequired": decision.get("reviewRequired"),
        "conflictDetected": decision.get("conflictDetected"),
        "missingDecisionKeys": missing,
    }


def main():
    results = [evaluate_case(case) for case in CASES]
    failures = [result for result in results if not result["passed"]]
    report = {
        "evaluated": len(results),
        "passed": len(results) - len(failures),
        "failed": len(failures),
        "engine": "ai-service-decision-engine-v4",
        "failures": failures,
        "results": results,
    }
    print(json.dumps(report, indent=2))
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
