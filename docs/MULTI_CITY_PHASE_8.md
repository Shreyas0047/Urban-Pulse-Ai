# Multi-City Phase 8: Operational SLO And Automatic Circuit Breaker

## Objective

Phase 8 closes the controlled city rollout loop. The platform now measures real complaint processing, AI degradation, authority delivery, and emergency broadcast outcomes for each city. Sustained unhealthy behavior can pause only the affected city's intake, while an auditable incident and Admin acknowledgement prevent silent or unsafe recovery.

This is an operational safeguard, not a claim that provider availability or AI accuracy is guaranteed.

## Rolling SLO Rules

All rules use a rolling 15-minute UTC window. A rate cannot trip the circuit until its minimum sample is met.

| Signal | Minimum samples | Pause threshold |
| --- | ---: | ---: |
| Complaint processing failures | 10 | 35% |
| AI degraded/fallback results | 15 | 60% |
| Authority delivery failures | 5 | 60% |
| Emergency broadcast failures | 5 | 60% |

Partial or skipped broadcasts are recorded as degraded rather than failed. Manual authority handoffs are not treated as delivery failures while awaiting a real portal submission.

## Circuit-Breaker Lifecycle

1. A completed operation records a compact city, domain, outcome, latency, and provider-state event.
2. MongoDB evaluates events in the current rolling window.
3. A breach creates one deduplicated operational incident and changes that city's rollout mode to `paused`.
4. The Admin dashboard shows the measured rate, sample count, threshold, incident reason, and timeline.
5. An assigned Admin records an investigation note and acknowledges the incident.
6. Intake remains paused until the Admin deliberately resumes the rollout.
7. A successful resume resolves acknowledged incidents and appends the recovery reason to both audit trails.

An unacknowledged incident blocks resume with `CITY_INCIDENT_ACK_REQUIRED`. Manual pauses without an operational incident retain the existing rollout recovery behavior.

## Privacy And Failure Isolation

Operational events never store complaint text, image data, voice data, location text, email addresses, usernames, recipient identities, API keys, or provider credentials. Only an allowlisted metadata object is persisted. Events expire automatically after 30 days.

Telemetry is failure-safe: event or health-evaluation errors are logged without rejecting a complaint or authority action that already succeeded. Circuit state and incidents are city-scoped, so one city's provider failure does not pause another city.

## Protected API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/cities/:slug/operational-health` | Read rolling SLO measurements and recent incidents for an assigned city |
| `POST` | `/api/cities/:slug/operational-incidents/:incidentId/acknowledge` | Record an Admin investigation acknowledgement |

Both endpoints require `update_complaint_status` and enforce the Admin's operational city assignments.

## Verification

Run:

```bash
npm run verify:multi-city-phase8
npm run verify:release
```

The Phase 8 check covers minimum samples, exact rate breaches, all four signals, sensitive-data exclusion, city pause, duplicate suppression, acknowledgement-gated recovery, incident resolution, protected routes, and dashboard wiring.
