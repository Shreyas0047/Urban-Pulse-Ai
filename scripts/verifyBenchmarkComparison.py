#!/usr/bin/env python3
"""Known-answer tests for Phase 6 champion/challenger release gates."""

import copy
import json

from compareBenchmarkReports import compare_reports


POLICY = {
    "policyVersion": "test",
    "gates": {
        "macroIncidentF1MaximumRegression": 0.02,
        "criticalRecallMaximumRegression": 0,
        "negativeRecallMaximumRegression": 0.02,
        "selectiveAccuracyMaximumRegression": 0.02,
        "dangerousUndertriageMaximumIncrease": 0.01,
        "falseCriticalMaximumIncrease": 0.01,
        "expectedCalibrationErrorMaximumIncrease": 0.02,
        "p95LatencyMaximumRatio": 2,
        "fallbackRateMaximumIncrease": 0.1,
    },
}


def report():
    return {
        "status": "passed",
        "evaluationMode": "image_only_no_ground_truth_hints",
        "dataset": {"version": "1", "manifestSha256": "abc", "splitFileSha256": "def", "split": "test", "records": 100},
        "policy": {"passed": True},
        "runtime": {"engines": ["baseline"], "fallbackCount": 5, "latencyMs": {"p95": 100}},
        "metrics": {
            "sampleCount": 100,
            "classification": {"incidentClasses": {"macroF1": 0.75}, "selectiveAccuracy": 0.82, "perClass": {"general": {"recall": 0.8}}},
            "severity": {"criticalRecall": 0.92, "dangerousUndertriageRate": 0.03, "falseCriticalRate": 0.02},
            "calibration": {"expectedCalibrationError": 0.08},
        },
    }


def main():
    baseline = report()
    better = copy.deepcopy(baseline)
    better["runtime"]["engines"] = ["candidate"]
    better["metrics"]["classification"]["incidentClasses"]["macroF1"] = 0.79
    better["metrics"]["severity"]["dangerousUndertriageRate"] = 0.02
    passed = compare_reports(baseline, better, POLICY)
    assert passed["promote"] is True

    unsafe = copy.deepcopy(better)
    unsafe["metrics"]["severity"]["criticalRecall"] = 0.9
    failed = compare_reports(baseline, unsafe, POLICY)
    assert failed["promote"] is False
    assert failed["checks"]["criticalRecallNonRegression"] is False

    mismatch = copy.deepcopy(better)
    mismatch["dataset"]["manifestSha256"] = "changed"
    invalid = compare_reports(baseline, mismatch, POLICY)
    assert invalid["status"] == "invalid_comparison"

    not_ready = compare_reports({"status": "not_ready"}, {"status": "not_ready"}, POLICY)
    assert not_ready["status"] == "not_ready"
    assert not_ready["promote"] is False

    absolute_failure = copy.deepcopy(better)
    absolute_failure["status"] = "failed"
    absolute_failure["policy"]["passed"] = False
    rejected = compare_reports(baseline, absolute_failure, POLICY)
    assert rejected["checks"]["candidateAbsolutePolicyPassed"] is False

    print(json.dumps({
        "passed": True,
        "safeCandidatePromoted": True,
        "criticalRecallRegressionRejected": True,
        "datasetMismatchRejected": True,
        "notReadyRemainsHonest": True,
        "absolutePolicyRequired": True,
    }, indent=2))


if __name__ == "__main__":
    main()
