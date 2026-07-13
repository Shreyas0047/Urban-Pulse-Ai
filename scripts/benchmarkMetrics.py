#!/usr/bin/env python3
"""Pure metric calculations for independent Urban Pulse benchmark predictions."""

import math
from collections import Counter, defaultdict


ABSTAIN_CATEGORY = "general"
SEVERITY_ORDER = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}


def safe_divide(numerator, denominator):
    return numerator / denominator if denominator else 0.0


def rounded(value):
    return round(float(value), 4)


def wilson_interval(successes, total, z=1.96):
    if total <= 0:
        return {"low": 0.0, "high": 0.0}
    proportion = successes / total
    denominator = 1 + (z * z / total)
    center = (proportion + z * z / (2 * total)) / denominator
    margin = z * math.sqrt((proportion * (1 - proportion) / total) + (z * z / (4 * total * total))) / denominator
    return {"low": rounded(max(0, center - margin)), "high": rounded(min(1, center + margin))}


def normalize_severity(value):
    normalized = str(value or "").strip().lower()
    return {
        "low": "Low",
        "medium": "Medium",
        "high": "High",
        "critical": "Critical",
        "needs review": "Needs Review",
        "needs_review": "Needs Review",
    }.get(normalized, "Needs Review")


def class_metrics(samples):
    labels = sorted({item["expectedCategoryId"] for item in samples} | {item["predictedCategoryId"] for item in samples})
    metrics = {}
    confusion = {label: {predicted: 0 for predicted in labels} for label in labels}
    for item in samples:
        confusion[item["expectedCategoryId"]][item["predictedCategoryId"]] += 1

    for label in labels:
        true_positive = sum(1 for item in samples if item["expectedCategoryId"] == label and item["predictedCategoryId"] == label)
        false_positive = sum(1 for item in samples if item["expectedCategoryId"] != label and item["predictedCategoryId"] == label)
        false_negative = sum(1 for item in samples if item["expectedCategoryId"] == label and item["predictedCategoryId"] != label)
        support = sum(1 for item in samples if item["expectedCategoryId"] == label)
        precision = safe_divide(true_positive, true_positive + false_positive)
        recall = safe_divide(true_positive, true_positive + false_negative)
        f1 = safe_divide(2 * precision * recall, precision + recall)
        metrics[label] = {
            "precision": rounded(precision),
            "recall": rounded(recall),
            "f1": rounded(f1),
            "support": support,
            "truePositive": true_positive,
            "falsePositive": false_positive,
            "falseNegative": false_negative,
        }

    return metrics, confusion


def aggregate_f1(per_class, labels):
    present = [per_class[label] for label in labels if label in per_class and per_class[label]["support"] > 0]
    if not present:
        return {"macroPrecision": 0.0, "macroRecall": 0.0, "macroF1": 0.0, "weightedF1": 0.0}
    total_support = sum(item["support"] for item in present)
    return {
        "macroPrecision": rounded(sum(item["precision"] for item in present) / len(present)),
        "macroRecall": rounded(sum(item["recall"] for item in present) / len(present)),
        "macroF1": rounded(sum(item["f1"] for item in present) / len(present)),
        "weightedF1": rounded(sum(item["f1"] * item["support"] for item in present) / total_support),
    }


def calibration_metrics(samples, bin_count=10):
    samples = [item for item in samples if item["predictedCategoryId"] != ABSTAIN_CATEGORY]
    if not samples:
        return {"evaluated": 0, "brierScore": 0.0, "expectedCalibrationError": 0.0, "bins": []}
    bins = [[] for _ in range(bin_count)]
    brier = 0.0
    for item in samples:
        confidence = max(0.0, min(1.0, float(item.get("confidence") or 0)))
        correct = 1.0 if item["expectedCategoryId"] == item["predictedCategoryId"] else 0.0
        brier += (confidence - correct) ** 2
        bins[min(bin_count - 1, int(confidence * bin_count))].append((confidence, correct))

    details = []
    expected_error = 0.0
    for index, values in enumerate(bins):
        if not values:
            continue
        average_confidence = sum(value[0] for value in values) / len(values)
        accuracy = sum(value[1] for value in values) / len(values)
        expected_error += (len(values) / len(samples)) * abs(accuracy - average_confidence)
        details.append(
            {
                "range": [rounded(index / bin_count), rounded((index + 1) / bin_count)],
                "count": len(values),
                "averageConfidence": rounded(average_confidence),
                "accuracy": rounded(accuracy),
                "gap": rounded(abs(accuracy - average_confidence)),
            }
        )
    return {
        "evaluated": len(samples),
        "brierScore": rounded(brier / len(samples)),
        "expectedCalibrationError": rounded(expected_error),
        "bins": details,
    }


def severity_metrics(samples):
    comparable = [
        item
        for item in samples
        if normalize_severity(item["expectedSeverity"]) in SEVERITY_ORDER
        and normalize_severity(item["predictedSeverity"]) in SEVERITY_ORDER
    ]
    exact = 0
    within_one = 0
    absolute_error = 0
    false_critical = 0
    noncritical_expected = 0
    dangerous_undertriage = 0
    high_risk_expected = 0
    critical_expected = 0
    critical_recalled = 0
    matrix = defaultdict(Counter)

    for item in comparable:
        expected = normalize_severity(item["expectedSeverity"])
        predicted = normalize_severity(item["predictedSeverity"])
        expected_rank = SEVERITY_ORDER[expected]
        predicted_rank = SEVERITY_ORDER[predicted]
        difference = abs(expected_rank - predicted_rank)
        exact += int(difference == 0)
        within_one += int(difference <= 1)
        absolute_error += difference
        matrix[expected][predicted] += 1
        if expected != "Critical":
            noncritical_expected += 1
            false_critical += int(predicted == "Critical")
        if expected in {"High", "Critical"}:
            high_risk_expected += 1
            dangerous_undertriage += int(predicted in {"Low", "Medium"})
        if expected == "Critical":
            critical_expected += 1
            critical_recalled += int(predicted == "Critical")

    return {
        "evaluated": len(comparable),
        "exactAccuracy": rounded(safe_divide(exact, len(comparable))),
        "withinOneLevelAccuracy": rounded(safe_divide(within_one, len(comparable))),
        "meanAbsoluteLevelError": rounded(safe_divide(absolute_error, len(comparable))),
        "falseCriticalRate": rounded(safe_divide(false_critical, noncritical_expected)),
        "dangerousUndertriageRate": rounded(safe_divide(dangerous_undertriage, high_risk_expected)),
        "criticalRecall": rounded(safe_divide(critical_recalled, critical_expected)),
        "matrix": {expected: dict(sorted(predicted.items())) for expected, predicted in sorted(matrix.items())},
    }


def top_k_accuracy(samples, k):
    matches = 0
    eligible = 0
    for item in samples:
        expected = item["expectedCategoryId"]
        candidates = item.get("candidateCategoryIds") or []
        if expected == ABSTAIN_CATEGORY:
            continue
        eligible += 1
        matches += int(expected in candidates[:k])
    return rounded(safe_divide(matches, eligible))


def error_analysis(samples):
    buckets = Counter()
    errors = []
    for item in samples:
        expected = item["expectedCategoryId"]
        predicted = item["predictedCategoryId"]
        reasons = []
        if expected != predicted:
            reasons.append("incorrect_abstention" if predicted == ABSTAIN_CATEGORY and expected != ABSTAIN_CATEGORY else "misclassification")
        if expected == ABSTAIN_CATEGORY and predicted != ABSTAIN_CATEGORY:
            reasons.append("missed_negative")
        expected_severity = normalize_severity(item["expectedSeverity"])
        predicted_severity = normalize_severity(item["predictedSeverity"])
        if expected_severity in SEVERITY_ORDER and predicted_severity in SEVERITY_ORDER:
            difference = SEVERITY_ORDER[predicted_severity] - SEVERITY_ORDER[expected_severity]
            if difference >= 2:
                reasons.append("severity_overtriage")
            elif difference <= -2:
                reasons.append("severity_undertriage")
        for reason in set(reasons):
            buckets[reason] += 1
        if reasons:
            errors.append(
                {
                    "id": item["id"],
                    "expectedCategoryId": expected,
                    "predictedCategoryId": predicted,
                    "expectedSeverity": expected_severity,
                    "predictedSeverity": predicted_severity,
                    "confidence": rounded(item.get("confidence") or 0),
                    "reasons": sorted(set(reasons)),
                }
            )
    return {"buckets": dict(sorted(buckets.items())), "examples": errors}


def calculate_metrics(samples, incident_categories):
    total = len(samples)
    correct = sum(1 for item in samples if item["expectedCategoryId"] == item["predictedCategoryId"])
    abstained = sum(1 for item in samples if item["predictedCategoryId"] == ABSTAIN_CATEGORY)
    covered = total - abstained
    selective_correct = sum(
        1
        for item in samples
        if item["predictedCategoryId"] != ABSTAIN_CATEGORY and item["expectedCategoryId"] == item["predictedCategoryId"]
    )
    positives = [item for item in samples if item["expectedCategoryId"] != ABSTAIN_CATEGORY]
    incorrect_positive_abstentions = sum(1 for item in positives if item["predictedCategoryId"] == ABSTAIN_CATEGORY)
    per_class, confusion = class_metrics(samples)
    incident_labels = [label for label in incident_categories if any(item["expectedCategoryId"] == label for item in samples)]
    all_labels = [label for label, metric in per_class.items() if metric["support"] > 0]

    return {
        "sampleCount": total,
        "classification": {
            "accuracy": rounded(safe_divide(correct, total)),
            "accuracy95Ci": wilson_interval(correct, total),
            "coverage": rounded(safe_divide(covered, total)),
            "coverage95Ci": wilson_interval(covered, total),
            "selectiveAccuracy": rounded(safe_divide(selective_correct, covered)),
            "abstentionRate": rounded(safe_divide(abstained, total)),
            "incorrectPositiveAbstentionRate": rounded(safe_divide(incorrect_positive_abstentions, len(positives))),
            "top1Accuracy": top_k_accuracy(samples, 1),
            "top3Accuracy": top_k_accuracy(samples, 3),
            "allClasses": aggregate_f1(per_class, all_labels),
            "incidentClasses": aggregate_f1(per_class, incident_labels),
            "perClass": per_class,
            "confusionMatrix": confusion,
        },
        "severity": severity_metrics(samples),
        "calibration": calibration_metrics(samples),
        "errors": error_analysis(samples),
    }


def evaluate_policy(metrics, policy, represented_incident_classes):
    requirements = policy.get("gates") or {}
    classification = metrics["classification"]
    severity = metrics["severity"]
    calibration = metrics["calibration"]
    per_class = classification["perClass"]
    checks = {
        "minimumTestRecords": metrics["sampleCount"] >= int(policy.get("minimumTestRecords", 0)),
        "minimumIncidentClassesRepresented": represented_incident_classes >= int(policy.get("minimumIncidentClassesRepresented", 0)),
        "macroIncidentF1Minimum": classification["incidentClasses"]["macroF1"] >= float(requirements.get("macroIncidentF1Minimum", 0)),
        "criticalRecallMinimum": severity["criticalRecall"] >= float(requirements.get("criticalRecallMinimum", 0)),
        "negativeRecallMinimum": per_class.get(ABSTAIN_CATEGORY, {}).get("recall", 0) >= float(requirements.get("negativeRecallMinimum", 0)),
        "selectiveAccuracyMinimum": classification["selectiveAccuracy"] >= float(requirements.get("selectiveAccuracyMinimum", 0)),
        "coverageMinimum": classification["coverage"] >= float(requirements.get("coverageMinimum", 0)),
        "falseCriticalRateMaximum": severity["falseCriticalRate"] <= float(requirements.get("falseCriticalRateMaximum", 1)),
        "dangerousUndertriageRateMaximum": severity["dangerousUndertriageRate"] <= float(requirements.get("dangerousUndertriageRateMaximum", 1)),
        "expectedCalibrationErrorMaximum": calibration["expectedCalibrationError"] <= float(requirements.get("expectedCalibrationErrorMaximum", 1)),
    }
    return {"passed": all(checks.values()), "checks": checks}
