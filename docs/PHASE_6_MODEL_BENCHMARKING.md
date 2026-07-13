# Phase 6: Baseline And Model Benchmarking

Phase 6 adds a champion/challenger release decision on top of the Phase 2 evaluator. It compares two completed reports only when dataset version, manifest hash, split hash, split name, record count, and evaluation mode are identical.

## Release Gates

The candidate must first pass every absolute Phase 2 quality gate. It must then remain within versioned non-regression limits for macro incident F1, Critical recall, negative recall, selective accuracy, dangerous under-triage, false-Critical escalation, calibration error, p95 latency, and fallback use.

Critical recall has zero permitted regression by default. A candidate with better average F1 is therefore still rejected if it becomes less safe for Critical incidents. Reports from different datasets or splits return `invalid_comparison` instead of producing misleading deltas.

## Usage

```bash
npm run evaluate:benchmark -- --output artifacts/baseline.json
# Evaluate the challenger in its pinned runtime to artifacts/candidate.json.
npm run benchmark:compare -- --baseline artifacts/baseline.json --candidate artifacts/candidate.json --output artifacts/comparison.json
```

`dataset/benchmark/model-registry.json` intentionally has no champion until adjudicated benchmark data exists and a candidate passes both absolute and comparative gates. Controlled fixtures cannot promote a model.

## Verification

```bash
npm run verify:benchmark-comparison
```

Tests cover safe promotion, Critical-recall rejection, immutable-dataset mismatch, absolute-policy failure, and honest `not_ready` behavior.

## Phase 7 Boundary

Benchmarking establishes whether a decision runtime is releasable. Phase 7 carries approved complaint decisions into real authority systems through explicit adapters, idempotent external references, retry state, and reconciliation rather than pretending that an email equals a municipal ticket.
