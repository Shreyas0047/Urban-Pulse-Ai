# Multi-City Expansion Phase 7: Controlled Rollout And Kill Switch

Phase 7 controls live complaint intake after Phase 6 readiness approval. It adds deterministic pilot cohorts, daily intake limits, audited rollout transitions, and an immediate city-level pause. It does not activate another city; Bengaluru remains the only reporting-enabled jurisdiction.

## Rollout Modes

Each city can have one runtime `CityRolloutState`:

- `closed`: no complaint intake.
- `pilot`: only a deterministic percentage of registered users can submit.
- `open`: all authenticated users can submit.
- `paused`: intake stops immediately with an operational reason.

Bengaluru has a backward-compatible virtual `open` state until an Admin persists controls. Every other city defaults to `closed`. A new city cannot move directly from closed to open: it must run in pilot mode for at least 24 hours first. Pilot or open mode requires a current approved Phase 6 activation review.

## Deterministic Cohorts

Pilot eligibility hashes the city ID and authenticated internal user ID with SHA-256 and maps it to a bucket from 0 to 99. The same user always receives the same bucket for that city, percentages can be increased without reshuffling earlier participants, and cohort membership is never stored or exposed publicly.

## Daily Intake Reservations

`CityDailyIntake` uses a unique city-and-UTC-date key and an atomic conditional increment. The reservation happens after local payload validation but before geocoding, AI inference, Weatherstack, Zenserp, routing workload queries, or other external work. A rejected pilot user, paused city, stale rollout, or exhausted cap consumes no provider quota.

The daily number counts requests admitted into processing. A later AI or persistence failure can still consume that reservation; this conservative behavior prevents retries from bypassing rollout capacity.

## Admin Controls

Admins assigned to a city can inspect usage and update controls through the rollout console or:

```http
GET   /api/cities/:slug/rollout
PATCH /api/cities/:slug/rollout
```

Every change requires a reason of at least 10 characters and stores previous mode, new mode, authenticated role/user ID, and timestamp. The emergency pause action uses the same audited transition path. Public city discovery exposes only mode, percentage when relevant, daily limit, pause reason, and update time.

## Startup And Rollback Safety

For every additional source-controlled reporting city, startup now requires both:

1. A current approved Phase 6 activation review.
2. A configuration-matching Phase 7 runtime state. Closed and paused states are allowed to restart because they fail closed and admit no complaints.

Both assertions run before shared registry synchronization. A failed deployment cannot publish an unapproved city to MongoDB. Runtime pause is immediate and does not require changing the source registry or redeploying.

## Verification

```bash
npm run verify:multi-city-phase7
npm run verify:release
```
