# Phase 2: Independent AI Metrics And Error Analysis

Phase 2 measures the deployed AI against an immutable benchmark split. It does not reuse the legacy regression fixture and does not pass issue descriptions, category names, image hints, area labels, prior complaints, or ground-truth severity into inference.

## Evaluation Contract

The evaluator sends only:

- Image bytes.
- Declared image MIME type.
- A fixed `Bengaluru` city context.
- Empty text, voice, image-hint, and complaint-history fields.

Every report records the manifest hash, split-file hash, dataset version, split, model/runtime status, vision provider, fallback count, engine version, latency, policy result, aggregate metrics, and per-record outcomes. It does not include media paths or image bytes.

## Commands

```bash
# Safe before data collection; currently returns status=not_ready.
npm run evaluate:benchmark:readiness

# Generate splits after adjudicated records are added.
npm run dataset:split

# Run the release-gated test evaluation. A failed policy returns a non-zero exit code.
npm run evaluate:benchmark

# Verify metric formulas, policy behavior, readiness, and image-only execution.
npm run verify:metrics
```

To preserve a report:

```bash
python3 scripts/evaluateBenchmark.py \
  --split test \
  --output reports/benchmark/phase2-test-report.json
```

## Reported Metrics

| Metric | Interpretation |
| --- | --- |
| Accuracy | Correct primary category, including correct `general` rejection, divided by all test records |
| Coverage | Fraction for which the AI returned a specific incident category instead of abstaining |
| Selective accuracy | Accuracy among covered, non-abstained predictions |
| Incorrect positive abstention | Clear incident images incorrectly sent to `general` review |
| Per-class precision/recall/F1 | Category-level false-positive and false-negative behavior |
| Macro incident F1 | Equal-weight F1 across represented civic incident categories, excluding `general` |
| Top-1/Top-3 accuracy | Whether the expected positive incident appears among image candidates |
| Negative recall | Fraction of true no-incident images correctly rejected as `general` |
| Critical recall | Fraction of adjudicated Critical cases predicted Critical |
| False-critical rate | Non-Critical cases incorrectly escalated to Critical |
| Dangerous under-triage | High/Critical cases incorrectly assigned Low/Medium |
| Severity MAE | Average distance between expected and predicted severity levels |
| Brier score | Squared confidence error for covered predictions; lower is better |
| Expected calibration error | Difference between confidence and observed correctness; lower is better |
| 95% Wilson intervals | Uncertainty bounds for accuracy and coverage |

Accuracy must always be discussed together with coverage. A system that abstains on every image can avoid unsafe guesses but is not operationally useful. Conversely, high coverage with poor precision creates confident misinformation.

## Error Buckets

The report retains traceable sample IDs for:

- Misclassification.
- Incorrect abstention on a positive incident.
- Missed negative examples.
- Severity over-triage by two or more levels.
- Severity under-triage by two or more levels.

These IDs support later qualitative error review without embedding private media or filesystem locations in reports.

## Release Policy

`evaluation-policy.json` contains the initial release gates. Policy changes require a new `policyVersion` and a written reason. Never lower a threshold after inspecting test results merely to obtain a passing report.

The test split is examination-only. Model selection, prompt changes, aliases, thresholds, feature engineering, and fallback tuning must use training and validation records. If the test split influences development, retire it and create a new untouched test split before making final claims.

## Current Readiness

Phase 2 software is complete, but the real benchmark currently has no adjudicated records. Therefore the only truthful production result is `status: not_ready`. Metric tests use controlled fixtures to verify calculations and execution; they are not evidence of model accuracy.
