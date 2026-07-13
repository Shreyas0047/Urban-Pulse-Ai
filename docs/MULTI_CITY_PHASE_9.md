# Multi-City Phase 9: Authority Response Governance

## Objective

Phase 9 adds measurable authority-response governance without pretending Urban Pulse AI has access to authority systems that do not expose a verified integration. Every tracked ticket receives severity-based deadlines for platform handoff, authority acknowledgement, and final resolution. Overdue stages become auditable escalations in the assigned city's Admin console.

## SLA Policy

| Severity | Confirmed handoff | Acknowledgement after submission | Resolution after submission |
| --- | ---: | ---: | ---: |
| Critical | 30 minutes | 2 hours | 24 hours |
| High | 2 hours | 8 hours | 72 hours |
| Medium | 8 hours | 24 hours | 7 days |
| Low | 24 hours | 48 hours | 14 days |

These are Urban Pulse operational targets, not contractual claims about a municipality. The immutable policy identifier is `authority-sla-v1`.

## Truthful Stage Transitions

1. Ticket creation starts the handoff clock.
2. A manual portal ticket remains in the handoff stage until an Admin records the official portal reference.
3. A verified email or webhook starts the acknowledgement and resolution clocks only after the adapter records successful submission.
4. Reconciliation requires an authority-response evidence note of at least 10 characters; `acknowledged` or `in_progress` then moves monitoring to resolution without extending the original resolution deadline.
5. `resolved` or `rejected` completes SLA monitoring while preserving escalation history.

Opening an official portal, preparing a payload, or receiving an Urban Pulse ticket code does not count as authority submission.

## Escalation Levels

- Level 1 begins immediately after the current deadline.
- Level 2 begins after one additional stage window has elapsed.
- Level 3 begins after two additional stage windows have elapsed.

Each level is appended once. Repeated scheduler or dashboard evaluations are idempotent and do not duplicate history or rewrite healthy tickets.

## Evaluation And Access

The backend evaluates ticket SLAs at startup and every five minutes. Assigned Admins can also trigger an evaluation from the dashboard. Scheduler errors are isolated and do not stop the API or alter complaint truth.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/cities/:slug/authority-governance` | Evaluate and read city-scoped authority deadline metrics |
| `POST` | `/api/cities/:slug/authority-governance/evaluate` | Trigger an assigned-city SLA evaluation |

Both endpoints require `update_complaint_status` and operational access to the selected city. The response excludes destination addresses, delivery errors, complaint content, citizen identities, and credentials.

## Verification

```bash
npm run verify:multi-city-phase9
npm run verify:release
```

The Phase 9 suite verifies policy ordering, exact deadline boundaries, three escalation levels, idempotency, stage transitions, immutable resolution deadlines, response minimization, scheduler lifecycle, route protection, and Admin UI wiring.
