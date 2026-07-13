# Multi-City Expansion Phase 6: Activation Gate And Readiness Console

Phase 6 replaces the earlier single-city hard lock with an auditable, fail-closed activation process. It does not activate another jurisdiction. Bengaluru remains active; Mumbai, Delhi, Chennai, and Hyderabad remain planned.

## Why The Gate Exists

A city cannot safely launch because `reportingEnabled` changed to `true`. Its routing, authority channel, operational ownership, handoff process, dashboard isolation, alert isolation, and reconciliation procedure must all be current and tested.

Phase 6 creates one `CityActivationReview` per candidate city. The review binds approval to a SHA-256 fingerprint of operational configuration: city identity, authority, category support, location envelope, official channels, routing profile, and unit templates. The planned-to-active flag is intentionally excluded so an approved candidate can be activated. Any meaningful routing or authority metadata change produces a new hash and makes the approval stale.

## Readiness Checks

Approval requires all of the following:

- Every AI category has a registered city owner.
- Routing authority matches the city registry.
- The handoff uses a verified HTTPS portal and does not claim unsupported direct API access.
- Authority-channel verification is no older than 180 days.
- At least one active Admin is assigned to the city.
- Portal submission, dashboard isolation, and alert isolation tests were attested within 90 days.
- A reconciliation owner and operational evidence note are recorded.

Evidence and approvals store the authenticated internal user ID and role, not email addresses. Editing evidence clears prior approval.

## Admin Workflow

An Admin assigned to the selected operations city can use the readiness console or these protected endpoints:

```http
GET  /api/cities/:slug/activation-readiness
PUT  /api/cities/:slug/activation-readiness/evidence
POST /api/cities/:slug/activation-readiness/approve
```

All require `update_complaint_status` and a matching `operationalCityIds` assignment. The console displays automatic checks separately from human attestations. Approval itself never changes city availability.

## Deployment Enforcement

At startup, Urban Pulse connects to MongoDB and runs `assertEnabledCitiesReady()` before synchronizing city or routing registries. This ordering prevents a failed deployment from publishing an unapproved active city into the database while an older instance is still serving traffic. Bengaluru is the established default. Every additional source-controlled city with reporting enabled must have:

- An approved review in MongoDB.
- A matching current configuration hash.
- Fresh evidence and authority metadata.
- An active assigned Admin.

If any condition fails, the process exits before serving traffic. This permits controlled multi-city expansion while ensuring a registry edit alone cannot expose an unprepared jurisdiction.

## Activation Procedure

1. Assign an Admin to the planned city.
2. Run staging portal, dashboard-isolation, alert-isolation, and reconciliation exercises.
3. Save evidence and resolve every blocked check.
4. Approve readiness.
5. Review and change that city's source-controlled `rolloutStatus` and `reportingEnabled` values.
6. Run `npm run verify:release` and deploy against the same MongoDB environment containing the approval.
7. Monitor the city-scoped dashboard and authority handoffs after launch.

## Verification

```bash
npm run verify:multi-city-phase6
npm run verify:release
```
