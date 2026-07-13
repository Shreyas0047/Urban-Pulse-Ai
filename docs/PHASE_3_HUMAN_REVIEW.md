# Phase 3: Human Review And Correction Interface

Phase 3 introduces an authorized human decision layer for complaint classification. It is designed for accountable correction, not unrestricted editing.

## Outcomes

| Outcome | Meaning | Operational behavior |
| --- | --- | --- |
| `confirmed` | Submitted evidence supports the current AI category, severity, and department | Clears `ai.reviewRequired`; decision fields remain unchanged |
| `corrected` | A reviewer can justify a different category, severity, or department | Synchronizes complaint type, category ID, severity, authority, routing, follow-up schedule, status, alerts, and existing incident command |
| `insufficient_evidence` | Available evidence cannot support a safe classification | Preserves the AI decision, sets `ai.reviewRequired=true`, and moves an open complaint to `Needs Review` |

Every outcome requires a reason between 15 and 500 characters. A correction must change at least one decision field. A confirmation cannot silently change fields, and `general` cannot be used as a manual correction shortcut; use `insufficient_evidence` instead.

## Authorization And Concurrency

The endpoint requires `update_complaint_status`, which is currently granted only to Admin accounts. The browser submits the complaint document version it opened. If another process updates that complaint first, the API returns HTTP `409` and requires a refresh. This prevents one reviewer from silently overwriting newer operational work.

```http
POST /api/complaints/:id/human-review
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "outcome": "corrected",
  "categoryId": "tree_obstruction",
  "priority": "High",
  "department": "Horticulture and Maintenance Team",
  "reason": "The visible fallen tree blocks the carriageway and matches this category.",
  "expectedVersion": 7
}
```

## Preserved Information

The first pre-review category, type, severity, department, and authority are retained in `complaint.humanReview.original`. The latest reviewed decision is stored in `complaint.humanReview.decision`. Status history uses a role-level reviewer label rather than exposing an administrator email address in citizen-visible complaint details.

The original AI confidence, candidates, explanation, threat evidence, and model metadata are not rewritten. This keeps machine evidence distinguishable from the human operational decision.

## Interface Behavior

- The form appears only when the authenticated account has review permission.
- Citizens see review status and reasoning but cannot submit a review.
- Confirmation and insufficient-evidence outcomes lock category, severity, and department fields.
- Correction unlocks those fields and preselects the canonical response team when category changes.
- Department remains editable because local operational structures may differ from the catalog default.
- Citizen verification buttons are no longer shown to admins.

## Phase 4 Integration

Phase 3 stores the original decision and latest human-reviewed state on the complaint. Phase 4 adds the separate append-only prediction-correction audit model, event identifiers, correction exports, aggregate feedback analysis, and tamper-evident longitudinal records. See [Phase 4](PHASE_4_DECISION_AUDIT.md).

## Verification

```bash
npm run verify:human-review
```

The verification covers confirmation, correction, insufficient evidence, validation failures, stale-write rejection, original-decision preservation, operational synchronization, and Mongoose schema validation.
