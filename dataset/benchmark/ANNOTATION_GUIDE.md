# Urban Pulse Civic Incident Benchmark

This directory is the Phase 1 real-world evaluation dataset. It is deliberately separate from `dataset/dataset.json`, which is a small legacy regression fixture containing transformed variants of a few source images. Legacy results must not be reported as real-world model accuracy.

## Dataset Goal

Build an independently labelled Bengaluru civic-incident benchmark with enough diversity to measure category classification, severity assessment, abstention, and evidence-quality behavior on unseen data.

Initial target:

- 300 minimum adjudicated records for a defensible pilot evaluation.
- 600 preferred records, with at least 30 independent scene groups per primary category where collection is feasible.
- 1,000 records for stronger category-level confidence intervals.
- At least 20% difficult evidence, plus a preferred 60 negative examples where no supported civic incident is clearly visible.
- No transformed copy of the same original scene may cross train, validation, or test boundaries.

## Collection Rules

1. Collect only public civic conditions relevant to the twelve IDs in `shared/aiCategories.json`.
2. Do not photograph people as the subject. Blur every visible face, vehicle plate, house number, phone number, and private-property identifier before import.
3. Store only city and broad area or ward. Never store exact residential addresses or precise coordinates.
4. Record a source reference, licence, and permission state. Internet search-result URLs alone are not licences.
5. Put photographs, crops, compressions, and edits derived from one original scene under the same `media.groupId`.
6. Do not use test images to tune prompts, thresholds, category aliases, or fallback rules.
7. Keep source files outside Git when permission or licence terms prohibit redistribution.

## Annotation Protocol

Each candidate begins as `draft` and cannot enter a generated split. Two annotators independently answer:

1. Is a supported civic incident visibly present?
2. What is the primary category ID?
3. Are secondary category IDs visible?
4. What hazards are directly supported by the image or accompanying verified collection context?
5. Is a school, hospital, major road, crowd, electrical asset, or other sensitive context verified?
6. What severity is justified by the rubric below?

Annotators must not inspect model predictions before submitting labels. Record annotator IDs as pseudonymous project IDs, not personal email addresses.

An adjudicator resolves disagreements. Set `annotation.status` to `adjudicated` only after privacy, provenance, and label review. `annotation.agreement` is the proportion of independent label fields that agreed before adjudication, from `0` to `1`.

## Severity Rubric

| Severity | Evidence requirement |
| --- | --- |
| `Low` | Limited inconvenience, no visible immediate hazard, access remains available |
| `Medium` | Material service disruption or localized safety concern requiring scheduled response |
| `High` | Serious obstruction, exposure, contamination, or credible risk of injury requiring expedited response |
| `Critical` | Immediate threat to life, fire/explosion, live electrical contact, collapse, trapped access, or equivalent emergency evidence |
| `Needs Review` | Evidence is insufficient, conflicting, or depends on unavailable context |

Severity must not be inferred from dramatic appearance alone. When the image cannot establish risk, use `Needs Review`.

For a true negative example, set `incidentPresent` to `false` and `categoryId` to `general`. Do not use `general` merely because annotators disagree; unresolved positive incidents remain `Needs Review` and must be adjudicated.

## Import Workflow

Import creates a draft record and copies the image into the benchmark directory:

```bash
python3 scripts/manageBenchmarkDataset.py import \
  --image /path/to/photo.jpg \
  --id UPB-2026-000001 \
  --group-id original-scene-000001 \
  --category tree_obstruction \
  --area Indiranagar \
  --source-type field_capture \
  --source-reference consent-batch-2026-01 \
  --license consented-research-use
```

Then edit `manifest.json` to complete privacy review, provenance permission, independent labels, and adjudication. Use `record.template.json` as the complete reference.

## Quality Gates

```bash
# Safe during collection: drafts produce warnings but accepted records remain strict.
python3 scripts/manageBenchmarkDataset.py validate

# Release gate: also requires at least one record.
python3 scripts/manageBenchmarkDataset.py validate --strict

python3 scripts/manageBenchmarkDataset.py stats
python3 scripts/manageBenchmarkDataset.py split
```

`split` includes only adjudicated records. It uses category-stratified scene groups and writes a manifest SHA-256 into `splits.json`. Any manifest change therefore makes the previous split traceably stale.

## Versioning And Release

- Use `0.x.y-collection` while records are being gathered or relabelled.
- Create a new immutable manifest version before publishing evaluation results.
- Preserve the exact manifest, split file, code revision, model version, and metric output used in every report.
- Never remove a failed example to improve a reported score. Mark invalid data as `rejected` with a reason.

Phase 1 is complete as infrastructure when the schema, collection protocol, validator, and leakage-safe split process work. The benchmark becomes academically defensible only after real, licensed, independently adjudicated records are collected.
