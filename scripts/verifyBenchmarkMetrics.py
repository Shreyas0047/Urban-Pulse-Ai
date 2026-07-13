#!/usr/bin/env python3
"""Known-answer tests for Phase 2 benchmark metrics and readiness behavior."""

import json
import hashlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from benchmarkMetrics import calculate_metrics, evaluate_policy
from manageBenchmarkDataset import sha256_file
from verifyBenchmarkDataset import manifest, record, write_manifest


ROOT = Path(__file__).resolve().parent.parent
INCIDENT_CATEGORIES = ["road_damage", "tree_obstruction", "safety_fire", "utility_fault", "garbage"]


def sample(record_id, expected, predicted, expected_severity, predicted_severity, confidence, candidates=None):
    return {
        "id": record_id,
        "expectedCategoryId": expected,
        "predictedCategoryId": predicted,
        "expectedSeverity": expected_severity,
        "predictedSeverity": predicted_severity,
        "confidence": confidence,
        "candidateCategoryIds": candidates or ([predicted] if predicted != "general" else []),
    }


def main():
    samples = [
        sample("one", "road_damage", "road_damage", "High", "High", 0.9),
        sample("two", "road_damage", "tree_obstruction", "High", "Medium", 0.6, ["tree_obstruction", "road_damage"]),
        sample("three", "tree_obstruction", "tree_obstruction", "Critical", "High", 0.8),
        sample("four", "safety_fire", "safety_fire", "Critical", "Critical", 0.95),
        sample("five", "general", "general", "Needs Review", "Needs Review", 0.2),
        sample("six", "general", "garbage", "Needs Review", "High", 0.7),
        sample("seven", "utility_fault", "general", "High", "Needs Review", 0.25, ["utility_fault"]),
        sample("eight", "garbage", "garbage", "Medium", "Critical", 0.75),
    ]
    metrics = calculate_metrics(samples, INCIDENT_CATEGORIES)
    classification = metrics["classification"]
    severity = metrics["severity"]

    assert metrics["sampleCount"] == 8
    assert classification["accuracy"] == 0.625
    assert classification["coverage"] == 0.75
    assert classification["selectiveAccuracy"] == 0.6667
    assert classification["abstentionRate"] == 0.25
    assert classification["perClass"]["general"]["recall"] == 0.5
    assert classification["top3Accuracy"] == 1.0
    assert severity["criticalRecall"] == 0.5
    assert severity["falseCriticalRate"] == 0.3333
    assert severity["dangerousUndertriageRate"] == 0.25
    assert metrics["calibration"]["evaluated"] == 6
    assert metrics["errors"]["buckets"]["incorrect_abstention"] == 1
    assert metrics["errors"]["buckets"]["missed_negative"] == 1
    assert metrics["errors"]["buckets"]["severity_overtriage"] == 1

    permissive_policy = {
        "minimumTestRecords": 8,
        "minimumIncidentClassesRepresented": 5,
        "gates": {
            "macroIncidentF1Minimum": 0,
            "criticalRecallMinimum": 0.5,
            "negativeRecallMinimum": 0.5,
            "selectiveAccuracyMinimum": 0.6,
            "coverageMinimum": 0.7,
            "falseCriticalRateMaximum": 0.34,
            "dangerousUndertriageRateMaximum": 0.25,
            "expectedCalibrationErrorMaximum": 1,
        },
    }
    assert evaluate_policy(metrics, permissive_policy, 5)["passed"] is True
    strict_policy = {**permissive_policy, "gates": {**permissive_policy["gates"], "criticalRecallMinimum": 0.9}}
    assert evaluate_policy(metrics, strict_policy, 5)["passed"] is False

    readiness = subprocess.run(
        [sys.executable, "scripts/evaluateBenchmark.py", "--allow-empty"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    readiness_report = json.loads(readiness.stdout)
    assert readiness_report["status"] == "not_ready"
    assert readiness_report["acceptedRecords"] == 0

    with tempfile.TemporaryDirectory(prefix="urban-pulse-metrics-") as temp_dir:
        benchmark_dir = Path(temp_dir)
        image_dir = benchmark_dir / "images"
        image_dir.mkdir()
        source = ROOT / "dataset" / "electrical" / "electrical_1.jpg"
        destination = image_dir / "benchmark.jpg"
        shutil.copy2(source, destination)
        fixture_record = record(
            "UPB-METRIC-000001",
            destination.name,
            sha256_file(destination),
            "metric-scene-1",
            "utility_fault",
        )
        manifest_path = benchmark_dir / "manifest.json"
        write_manifest(manifest_path, manifest([fixture_record]))
        manifest_hash = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
        split_path = benchmark_dir / "splits.json"
        split_path.write_text(
            json.dumps(
                {
                    "schemaVersion": "1.0.0",
                    "datasetVersion": "test-1.0.0",
                    "manifestSha256": manifest_hash,
                    "seed": "fixture",
                    "generatedAt": "2026-07-13T00:00:00Z",
                    "policy": "test fixture",
                    "splits": {"train": [], "validation": [], "test": [fixture_record["id"]]},
                    "counts": {"train": 0, "validation": 0, "test": 1},
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        policy_path = benchmark_dir / "policy.json"
        policy_path.write_text(
            json.dumps(
                {
                    "policyVersion": "fixture",
                    "minimumTestRecords": 1,
                    "minimumIncidentClassesRepresented": 1,
                    "gates": {
                        "macroIncidentF1Minimum": 0,
                        "criticalRecallMinimum": 0,
                        "negativeRecallMinimum": 0,
                        "selectiveAccuracyMinimum": 0,
                        "coverageMinimum": 0,
                        "falseCriticalRateMaximum": 1,
                        "dangerousUndertriageRateMaximum": 1,
                        "expectedCalibrationErrorMaximum": 1,
                    },
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        evaluation = subprocess.run(
            [
                sys.executable,
                "scripts/evaluateBenchmark.py",
                "--manifest",
                str(manifest_path),
                "--splits",
                str(split_path),
                "--policy",
                str(policy_path),
            ],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        evaluation_report = json.loads(evaluation.stdout)
        assert evaluation_report["evaluationMode"] == "image_only_no_ground_truth_hints"
        assert evaluation_report["dataset"]["records"] == 1
        assert evaluation_report["dataset"]["manifestSha256"] == manifest_hash
        assert "path" not in evaluation_report["samples"][0]
        assert evaluation_report["runtime"]["evaluationVersions"]

        changed_manifest = manifest([fixture_record])
        changed_manifest["datasetVersion"] = "test-1.0.1"
        write_manifest(manifest_path, changed_manifest)
        stale = subprocess.run(
            [
                sys.executable,
                "scripts/evaluateBenchmark.py",
                "--manifest",
                str(manifest_path),
                "--splits",
                str(split_path),
                "--policy",
                str(policy_path),
            ],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
        stale_report = json.loads(stale.stdout)
        assert stale.returncode == 2
        assert stale_report["status"] == "not_ready"
        assert "stale" in stale_report["reason"].lower()

    print(
        json.dumps(
            {
                "passed": True,
                "knownAnswerMetrics": True,
                "policyPassAndFail": True,
                "emptyDatasetReadiness": True,
                "endToEndImageOnlyEvaluation": True,
                "staleSplitRejected": True,
                "metricsChecked": [
                    "precision_recall_f1",
                    "confusion_matrix",
                    "top_k",
                    "abstention",
                    "severity",
                    "calibration",
                    "error_buckets",
                ],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
