#!/usr/bin/env python3
"""Run leak-free, image-only AI evaluation on an immutable benchmark split."""

import argparse
import base64
import hashlib
import json
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
AI_SERVICE_DIR = ROOT / "ai_service"
sys.path.insert(0, str(AI_SERVICE_DIR))

from benchmarkMetrics import calculate_metrics, evaluate_policy, normalize_severity  # noqa: E402
from manageBenchmarkDataset import ACCEPTED_STATUS, validate_manifest  # noqa: E402
from model_runtime import runtime_status  # noqa: E402
from pipeline import run_hybrid_pipeline  # noqa: E402


DEFAULT_MANIFEST = ROOT / "dataset" / "benchmark" / "manifest.json"
DEFAULT_SPLITS = ROOT / "dataset" / "benchmark" / "splits.json"
DEFAULT_POLICY = ROOT / "dataset" / "benchmark" / "evaluation-policy.json"
CATEGORY_PATH = ROOT / "shared" / "aiCategories.json"


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def file_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def percentile(values, percentage):
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((len(ordered) - 1) * percentage)))
    return ordered[index]


def candidate_ids(result):
    candidates = []
    image_prediction = (result.get("decision") or {}).get("imagePrediction") or {}
    if image_prediction.get("categoryId"):
        candidates.append(image_prediction["categoryId"])
    for item in (result.get("vision") or {}).get("candidates") or []:
        category_id = item.get("category_id") or item.get("categoryId")
        if category_id and category_id not in candidates:
            candidates.append(category_id)
    return candidates[:5]


def evaluate_record(record, benchmark_dir):
    image_path = benchmark_dir / record["media"]["path"]
    payload = {
        "textComplaint": "",
        "voiceTranscript": "",
        "imageHint": "",
        "imageBase64": base64.b64encode(image_path.read_bytes()).decode("ascii"),
        "imageMimeType": record["media"]["mimeType"],
        # Fixed city context prevents labels or area-specific shortcuts entering inference.
        "location": "Bengaluru",
        "previousComplaints": [],
        "recentAreaComplaints": [],
    }
    started = time.perf_counter()
    result = run_hybrid_pipeline(payload)
    latency_ms = (time.perf_counter() - started) * 1000
    predicted_category = str((result.get("decision") or {}).get("finalCategoryId") or result.get("category") or "general")
    predicted_severity = normalize_severity((result.get("priority") or {}).get("level"))
    return {
        "id": record["id"],
        "expectedCategoryId": record["labels"]["categoryId"],
        "predictedCategoryId": predicted_category,
        "expectedSeverity": record["labels"]["severity"],
        "predictedSeverity": predicted_severity,
        "confidence": float((result.get("decision") or {}).get("confidence") or result.get("confidence") or 0),
        "abstained": bool((result.get("decision") or {}).get("abstained") or predicted_category == "general"),
        "reviewRequired": bool((result.get("decision") or {}).get("reviewRequired")),
        "candidateCategoryIds": candidate_ids(result),
        "latencyMs": round(latency_ms, 3),
        "visionProvider": str((result.get("vision") or {}).get("provider") or "unknown"),
        "visionFallbackUsed": bool((result.get("vision") or {}).get("fallbackUsed", True)),
        "engine": str((result.get("aiMeta") or {}).get("engine") or "unknown"),
        "evaluationVersion": str((result.get("aiMeta") or {}).get("evaluationVersion") or "unknown"),
    }


def readiness_report(manifest, policy, reason, warnings=None):
    return {
        "reportVersion": "1.0.0",
        "status": "not_ready",
        "reason": reason,
        "datasetVersion": manifest.get("datasetVersion"),
        "acceptedRecords": sum(1 for item in manifest.get("records", []) if item.get("annotation", {}).get("status") == ACCEPTED_STATUS),
        "minimumTestRecords": policy.get("minimumTestRecords"),
        "warnings": warnings or [],
    }


def write_report(report, output_path):
    serialized = json.dumps(report, indent=2, ensure_ascii=True) + "\n"
    if output_path:
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(serialized, encoding="utf-8")
    print(serialized, end="")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--splits", default=str(DEFAULT_SPLITS))
    parser.add_argument("--policy", default=str(DEFAULT_POLICY))
    parser.add_argument("--split", default="test", choices=["train", "validation", "test"])
    parser.add_argument("--output", default="")
    parser.add_argument("--allow-empty", action="store_true", help="Return a not-ready report instead of failing before collection.")
    args = parser.parse_args()

    manifest_path = Path(args.manifest).resolve()
    manifest, errors, warnings = validate_manifest(manifest_path, strict=False)
    policy = load_json(args.policy)
    if errors:
        write_report(readiness_report(manifest or {}, policy, "Benchmark validation failed.", errors + warnings), args.output)
        return 2

    accepted_records = [item for item in manifest.get("records", []) if item.get("annotation", {}).get("status") == ACCEPTED_STATUS]
    if not accepted_records:
        write_report(readiness_report(manifest, policy, "No adjudicated benchmark records are available.", warnings), args.output)
        return 0 if args.allow_empty else 2

    split_path = Path(args.splits).resolve()
    if not split_path.is_file():
        write_report(readiness_report(manifest, policy, "Split file is missing. Run npm run dataset:split.", warnings), args.output)
        return 2
    split_data = load_json(split_path)
    if split_data.get("manifestSha256") != file_hash(manifest_path):
        write_report(readiness_report(manifest, policy, "Split file is stale because the manifest hash changed.", warnings), args.output)
        return 2

    selected_ids = split_data.get("splits", {}).get(args.split) or []
    records_by_id = {item["id"]: item for item in accepted_records}
    missing_ids = [record_id for record_id in selected_ids if record_id not in records_by_id]
    if missing_ids:
        write_report(readiness_report(manifest, policy, f"Split references missing or unaccepted records: {missing_ids[:5]}", warnings), args.output)
        return 2
    selected_records = [records_by_id[record_id] for record_id in selected_ids]
    if not selected_records:
        write_report(readiness_report(manifest, policy, f"The {args.split} split contains no records.", warnings), args.output)
        return 0 if args.allow_empty else 2

    samples = []
    inference_errors = []
    for record in selected_records:
        try:
            samples.append(evaluate_record(record, manifest_path.parent))
        except Exception as error:  # Continue so one corrupt runtime sample cannot hide the rest of the report.
            inference_errors.append({"id": record["id"], "errorType": type(error).__name__})
            samples.append(
                {
                    "id": record["id"],
                    "expectedCategoryId": record["labels"]["categoryId"],
                    "predictedCategoryId": "general",
                    "expectedSeverity": record["labels"]["severity"],
                    "predictedSeverity": "Needs Review",
                    "confidence": 0.0,
                    "abstained": True,
                    "reviewRequired": True,
                    "candidateCategoryIds": [],
                    "latencyMs": 0.0,
                    "visionProvider": "runtime-error",
                    "visionFallbackUsed": True,
                    "engine": "runtime-error",
                    "evaluationVersion": "unknown",
                }
            )

    incident_categories = [item["id"] for item in load_json(CATEGORY_PATH)]
    metrics = calculate_metrics(samples, incident_categories)
    represented = len({item["expectedCategoryId"] for item in samples if item["expectedCategoryId"] != "general"})
    policy_result = evaluate_policy(metrics, policy, represented)
    if inference_errors:
        policy_result["passed"] = False
        policy_result["checks"]["inferenceCompletedWithoutErrors"] = False
    latencies = [item["latencyMs"] for item in samples]
    providers = sorted({item["visionProvider"] for item in samples})
    engines = sorted({item["engine"] for item in samples})
    evaluation_versions = sorted({item["evaluationVersion"] for item in samples})

    report = {
        "reportVersion": "1.0.0",
        "status": "passed" if policy_result["passed"] else "failed",
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "evaluationMode": "image_only_no_ground_truth_hints",
        "dataset": {
            "version": manifest["datasetVersion"],
            "manifestSha256": file_hash(manifest_path),
            "splitFileSha256": file_hash(split_path),
            "split": args.split,
            "records": len(selected_records),
        },
        "runtime": {
            "models": runtime_status(),
            "visionProviders": providers,
            "engines": engines,
            "evaluationVersions": evaluation_versions,
            "fallbackCount": sum(1 for item in samples if item["visionFallbackUsed"]),
            "latencyMs": {
                "mean": round(statistics.mean(latencies), 3),
                "median": round(statistics.median(latencies), 3),
                "p95": round(percentile(latencies, 0.95), 3),
            },
        },
        "policy": {"version": policy.get("policyVersion"), **policy_result},
        "metrics": metrics,
        "inferenceErrors": inference_errors,
        "samples": samples,
        "limitations": [
            "Metrics describe only the immutable selected split and model/runtime versions recorded here.",
            "Results are not valid population-wide accuracy claims without representative collection coverage.",
            "The test split must not be used for prompt, threshold, rule, or model tuning.",
        ],
    }
    write_report(report, args.output)
    return 0 if policy_result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
