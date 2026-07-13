# Phase 4: Prediction-Correction Audit Store

Phase 4 turns AI predictions and authorized human reviews into a durable feedback record. The complaint keeps its current operational state, while `DecisionAuditEvent` keeps the longitudinal decision history.

## Event Chain

Each new complaint starts with an `ai_baseline` event. Every Phase 3 review appends a `human_review` event containing:

- A random event ID and complaint-local sequence number.
- The decision before and after the event.
- The outcome, changed fields, and required review reason.
- Role-level actor metadata without reviewer email addresses.
- A compact AI evidence snapshot containing model, confidence, threat, fallback, and image-fingerprint metadata.
- The previous event hash and a SHA-256 hash of the canonical event payload.

The complaint stores only the latest event ID, hash, event count, and integrity state. Changing an old event, removing an event, reordering events, or changing the complaint audit head causes integrity verification to fail.

## Write Guarantees

New complaint creation and its baseline event use one MongoDB transaction. Human review, incident-command synchronization, complaint mutation, and the corresponding audit event also use one transaction. Production therefore requires MongoDB Atlas or another replica-set/sharded MongoDB deployment that supports transactions.

The Mongoose audit model rejects update and delete operations. Production dashboard reset is disabled to preserve complaint and audit records. Development-only fresh seed/reset operations deliberately use a direct collection purge and must not be exposed in production.

Existing complaints created before Phase 4 show `not recorded`. Their first human review adopts the current machine state as a baseline before appending the review event, in the same transaction. The system does not invent a historical creation timestamp for legacy data.

## Access And Exports

Audit details require `update_complaint_status`. Citizens receive only the current Phase 3 human-review summary and never receive the event chain, hashes, correction exports, or aggregate feedback.

```http
GET /api/complaints/:id/decision-audit
GET /api/complaints/:id/decision-audit?format=csv
GET /api/decision-audit/feedback
GET /api/decision-audit/feedback?format=csv
```

The complaint endpoint also returns a verified audit timeline to authorized reviewers. Aggregate feedback reports confirmation, correction, insufficient-evidence, changed-field, and category-transition counts. This is evidence for model improvement; it does not automatically retrain or change production classifications.

## Verification

```bash
npm run verify:decision-audit
```

The focused verification covers baseline and correction append behavior, sequence/hash links, deliberate tampering detection, reviewer identity redaction, aggregate feedback, CSV export, indexes, and schema validation.

## Phase 5 Boundary

Phase 4 captures trustworthy events. Phase 5 now turns those events into operational observability: correction-rate trends, drift signals, confidence monitoring, category-level alerts, and provider/fallback health.
