import base64
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "ai_service"))

from category_catalog import DATASET_CATEGORY_ALIASES  # noqa: E402
from pipeline import run_hybrid_pipeline  # noqa: E402


DATASET_PATH = ROOT / "dataset" / "dataset.json"
DATASET_DIR = ROOT / "dataset"
MINIMUM_ACCURACY = float(os.getenv("AI_EVAL_MIN_VISION_ACCURACY", "0.55"))


def expected_categories(category):
    mapped = DATASET_CATEGORY_ALIASES.get(str(category or "").strip().lower())
    return [mapped] if mapped else [str(category or "").strip().lower()]


def encode_image(relative_path):
    image_path = DATASET_DIR / relative_path
    with image_path.open("rb") as handle:
        return base64.b64encode(handle.read()).decode("ascii")


def evaluate_item(item):
    expected = expected_categories(item.get("category"))
    result = run_hybrid_pipeline(
        {
            "textComplaint": item.get("issue", ""),
            "voiceTranscript": "",
            "imageHint": item.get("issue", ""),
            "imageBase64": encode_image(item["image"]),
            "imageMimeType": "image/jpeg",
            "location": f"{item.get('category', 'community')} zone",
            "previousComplaints": [],
            "recentAreaComplaints": [],
        }
    )
    predicted = result.get("aiMeta", {}).get("categoryId") or result.get("category") or "general"
    vision = result.get("vision") or {}

    return {
        "image": item["image"],
        "issue": item.get("issue", ""),
        "expected": expected,
        "predicted": predicted,
        "passed": predicted in expected,
        "visionProvider": vision.get("provider", "unknown"),
        "visionFallbackUsed": bool(vision.get("fallbackUsed", True)),
        "visionTop": (vision.get("top_detection") or {}).get("label", ""),
        "confidence": result.get("confidence", 0),
    }


def main():
    items = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    results = [evaluate_item(item) for item in items]
    passed = sum(1 for item in results if item["passed"])
    fallback_count = sum(1 for item in results if item["visionFallbackUsed"])
    accuracy = passed / len(results) if results else 0
    failures = [item for item in results if not item["passed"]]
    report = {
        "evaluated": len(results),
        "passed": passed,
        "failed": len(failures),
        "accuracy": round(accuracy, 3),
        "minimumAccuracy": MINIMUM_ACCURACY,
        "visionFallbackCount": fallback_count,
        "visionModelAvailable": fallback_count < len(results),
        "failures": failures[:12],
    }

    print(json.dumps(report, indent=2))
    if fallback_count == len(results):
        print("Vision model unavailable; feature fallback was evaluated.", file=sys.stderr)
    if accuracy < MINIMUM_ACCURACY:
        sys.exit(1)


if __name__ == "__main__":
    main()
