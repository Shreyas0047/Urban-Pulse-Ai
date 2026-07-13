#!/usr/bin/env python3
"""Compare champion and challenger reports from the same immutable benchmark split."""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_POLICY = ROOT / "dataset" / "benchmark" / "comparison-policy.json"


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def nested(report, *keys, default=0.0):
    value = report
    for key in keys:
        if not isinstance(value, dict):
            return default
        value = value.get(key)
    return default if value is None else value


def metric_values(report):
    samples = max(1, int(nested(report, "metrics", "sampleCount", default=0)))
    return {
        "macroIncidentF1": float(nested(report, "metrics", "classification", "incidentClasses", "macroF1")),
        "criticalRecall": float(nested(report, "metrics", "severity", "criticalRecall")),
        "negativeRecall": float(nested(report, "metrics", "classification", "perClass", "general", "recall")),
        "selectiveAccuracy": float(nested(report, "metrics", "classification", "selectiveAccuracy")),
        "dangerousUndertriageRate": float(nested(report, "metrics", "severity", "dangerousUndertriageRate")),
        "falseCriticalRate": float(nested(report, "metrics", "severity", "falseCriticalRate")),
        "expectedCalibrationError": float(nested(report, "metrics", "calibration", "expectedCalibrationError")),
        "p95LatencyMs": float(nested(report, "runtime", "latencyMs", "p95")),
        "fallbackRate": float(nested(report, "runtime", "fallbackCount")) / samples,
    }


def identity(report):
    return {
        "datasetVersion": nested(report, "dataset", "version", default=""),
        "manifestSha256": nested(report, "dataset", "manifestSha256", default=""),
        "splitFileSha256": nested(report, "dataset", "splitFileSha256", default=""),
        "split": nested(report, "dataset", "split", default=""),
        "records": nested(report, "dataset", "records", default=0),
        "evaluationMode": report.get("evaluationMode", ""),
    }


def compare_reports(baseline, candidate, policy):
    if baseline.get("status") == "not_ready" or candidate.get("status") == "not_ready":
        return {"status": "not_ready", "promote": False, "reason": "Both benchmark reports must contain completed adjudicated-split evaluations."}
    baseline_identity = identity(baseline)
    candidate_identity = identity(candidate)
    mismatches = [key for key in baseline_identity if baseline_identity[key] != candidate_identity[key]]
    if mismatches:
        return {"status": "invalid_comparison", "promote": False, "reason": "Reports do not use the same immutable evaluation data.", "identityMismatches": mismatches}

    old = metric_values(baseline)
    new = metric_values(candidate)
    delta = {key: round(new[key] - old[key], 6) for key in old}
    gates = policy.get("gates") or {}
    checks = {
        "candidateAbsolutePolicyPassed": candidate.get("status") == "passed" and nested(candidate, "policy", "passed", default=False) is True,
        "macroIncidentF1NonRegression": delta["macroIncidentF1"] >= -float(gates.get("macroIncidentF1MaximumRegression", 0)),
        "criticalRecallNonRegression": delta["criticalRecall"] >= -float(gates.get("criticalRecallMaximumRegression", 0)),
        "negativeRecallNonRegression": delta["negativeRecall"] >= -float(gates.get("negativeRecallMaximumRegression", 0)),
        "selectiveAccuracyNonRegression": delta["selectiveAccuracy"] >= -float(gates.get("selectiveAccuracyMaximumRegression", 0)),
        "dangerousUndertriageNonRegression": delta["dangerousUndertriageRate"] <= float(gates.get("dangerousUndertriageMaximumIncrease", 0)),
        "falseCriticalNonRegression": delta["falseCriticalRate"] <= float(gates.get("falseCriticalMaximumIncrease", 0)),
        "calibrationNonRegression": delta["expectedCalibrationError"] <= float(gates.get("expectedCalibrationErrorMaximumIncrease", 0)),
        "latencyWithinBudget": new["p95LatencyMs"] <= max(old["p95LatencyMs"], 1.0) * float(gates.get("p95LatencyMaximumRatio", 2)),
        "fallbackWithinBudget": delta["fallbackRate"] <= float(gates.get("fallbackRateMaximumIncrease", 0)),
    }
    promote = all(checks.values())
    return {
        "status": "passed" if promote else "failed",
        "promote": promote,
        "policyVersion": policy.get("policyVersion"),
        "dataset": baseline_identity,
        "baseline": {"runtime": baseline.get("runtime", {}), "metrics": old},
        "candidate": {"runtime": candidate.get("runtime", {}), "metrics": new},
        "deltas": delta,
        "checks": checks,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--candidate", required=True)
    parser.add_argument("--policy", default=str(DEFAULT_POLICY))
    parser.add_argument("--output", default="")
    parser.add_argument("--allow-not-ready", action="store_true")
    args = parser.parse_args()
    report = {
        "reportVersion": "1.0.0",
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        **compare_reports(load(args.baseline), load(args.candidate), load(args.policy)),
    }
    serialized = json.dumps(report, indent=2, ensure_ascii=True) + "\n"
    if args.output:
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(serialized, encoding="utf-8")
    print(serialized, end="")
    if report["status"] == "not_ready" and args.allow_not_ready:
        return 0
    return 0 if report.get("promote") else 1


if __name__ == "__main__":
    raise SystemExit(main())
