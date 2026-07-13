# Multi-City Expansion Phase 1: Registry And Bengaluru Migration

This phase establishes city identity without changing the complaint form or activating cross-city routing. Bengaluru remains the only city that accepts reports. Mumbai, Delhi, Chennai, and Hyderabad are visible as planned jurisdictions and cannot be selected for reporting yet.

## Registry Contract

`shared/cityRegistry.json` is the source-controlled registry definition. Each city records a stable slug, display name, state, timezone, aliases, default municipal authority, rollout state, AI category compatibility, approximate location envelope, center point, and official complaint-channel provenance.

Location envelopes are coarse validation aids, not official ward or administrative boundaries. All five direct-API flags are false. A city cannot claim API delivery until a separately approved and tested adapter exists.

At database connection, the application validates the complete registry and performs idempotent upserts into `CityRegistry`. Invalid slugs, duplicate cities, unknown AI categories, malformed envelopes, missing provenance, multiple active cities, or unsupported API claims prevent startup.

## Complaint Compatibility

New complaints explicitly store:

```json
{
  "cityId": "bengaluru",
  "cityName": "Bengaluru",
  "citySource": "system_default",
  "cityRegistryVersion": "1.0.0",
  "cityAssignedAt": "<creation time>"
}
```

The server does not accept a user-provided city during Phase 1. This prevents clients from submitting Mumbai or Chennai complaints before city-first validation and routing exist. Authority-ticket payloads now include the stored city identity.

## Public Discovery

```http
GET /api/cities
GET /api/cities/:slug
```

These unauthenticated endpoints return rollout availability and public official channels. They omit aliases, approximate envelopes, category internals, and source-maintenance metadata. Phase 2 will consume this endpoint for the city-first interface.

## Production Migration

Registry synchronization and complaint migration are separate operations. Application startup synchronizes the registry but never rewrites existing complaints.

1. Deploy Phase 1 so new complaints receive explicit Bengaluru identity.
2. Run the migration in dry-run mode from a trusted one-off shell:

```bash
npm run migrate:cities
```

3. Confirm `invalidCityComplaints` is `0` and review `legacyComplaints`.
4. Apply exactly once:

```bash
npm run migrate:cities -- --apply
```

5. Run the dry-run again and confirm `legacyComplaints` is `0`.

The migration updates only missing, null, or empty `cityId` values. Existing valid city identities are preserved. Unknown city IDs block the entire apply operation so legacy records cannot be partially migrated around an unresolved data problem.

## Commands

```bash
npm run cities:sync
npm run migrate:cities
npm run migrate:cities -- --apply
npm run verify:city-registry
```

## Phase 2 Boundary

Phase 1 deliberately does not add the city selector. Phase 2 will place city selection before complaint evidence entry, load availability from `/api/cities`, preserve a safe draft preference, and continue to reject disabled cities on the server.
