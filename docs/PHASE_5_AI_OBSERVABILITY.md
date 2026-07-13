# Phase 5: AI Observability And Drift Dashboard

Phase 5 monitors how the production decision pipeline behaves over time. It uses stored complaint metadata and Phase 4 human-review events; it does not treat unreviewed production traffic as ground truth.

## Rolling Comparison

The Admin dashboard compares the latest 30 days with the preceding 30 days. Each window reports sample count, average confidence, review-required rate, abstention rate, fallback rate, correction rate, insufficient-evidence rate, and category, severity, and provider distributions.

Category and severity movement use Jensen-Shannon divergence. Alert thresholds cover material distribution shift, confidence drops, increased review demand, high fallback usage, and high correction rates. Thresholds are operational warning levels, not estimates of accuracy.

## Honest Sample Handling

Both windows require at least 10 complaints before drift alerts are evaluated. Smaller windows return `insufficient_data` and no alerts. A correction-rate alert additionally requires at least 10 current review events. This prevents one unusual complaint or review from being presented as model drift.

## Privacy And Access

Observability appears only in the Admin dashboard. It aggregates category and operational metadata and does not expose reporter identity, complaint text, uploaded media, reviewer email, OTP data, or API credentials.

## Verification

```bash
npm run verify:observability
```

The test verifies divergence math, insufficient-sample behavior, stable windows, and simulated category, severity, confidence, fallback, review, and correction drift.

## Phase 6 Boundary

Production observability detects change but cannot identify which model is better. Phase 6 adds reproducible baseline-versus-candidate evaluation on the same immutable benchmark split and release gates that prevent regressions from being promoted.
