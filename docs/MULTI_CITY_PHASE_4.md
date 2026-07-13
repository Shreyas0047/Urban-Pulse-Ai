# Multi-City Expansion Phase 4: Tracked Authority Handoff

Phase 4 turns the verified portal metadata from Phase 3 into an operational, auditable workflow without claiming that Urban Pulse has direct municipal API access. Bengaluru remains the only reporting-enabled city. Mumbai, Delhi, Chennai, and Hyderabad remain planned.

## Manual Handoff Workflow

After required AI review, an Admin prepares one idempotent authority ticket for a complaint. When no verified email or webhook connector is configured, the ticket uses the city profile's HTTPS portal and enters `awaiting_manual_submission`.

The Admin then:

1. Opens the verified official portal from the complaint detail panel.
2. Submits the complaint through the authority's own workflow.
3. Records the confirmation or complaint reference returned by that portal.
4. Optionally records a short acknowledgement note.
5. Reconciles later authority states as acknowledged, in progress, resolved, or rejected.

Opening the portal is never treated as proof of submission. A manual ticket becomes `submitted` only after a portal-issued reference is recorded. The confirmation stores its timestamp, Admin role, note, portal URL, and attempt history; it does not store API keys or repeat user identity data.

## State And Integrity Rules

- One authority ticket is created per complaint using the existing idempotency key.
- Manual tickets do not consume automated retry attempts.
- Repeating the same confirmation reference is idempotent.
- Replacing an already confirmed reference is rejected.
- Reconciliation is rejected until a ticket has actually been submitted.
- Older disabled tickets with a valid stored portal are upgraded to `manual_portal` when reopened.
- Existing verified email and generic webhook adapters continue to use bounded delivery retries.

## API And UI

The protected confirmation endpoint is:

```http
POST /api/authority-tickets/:ticketId/manual-confirmation
Content-Type: application/json

{
  "externalReference": "PORTAL-REFERENCE",
  "note": "Optional acknowledgement note"
}
```

It requires `update_complaint_status`. The complaint detail panel renders the workflow only for Admin users and only while a manual ticket is awaiting submission. External links are limited to HTTPS URLs.

## Operational Boundary

Phase 4 tracks an operator-mediated handoff; it does not automate a government portal, bypass authentication or CAPTCHA, scrape an authority site, or imply a formal integration agreement. Activating another city still requires approved contacts, staging evidence, reconciliation ownership, city-scoped alert validation, and an explicit registry change.

## Verification

```bash
npm run verify:authority-tickets
npm run verify:multi-city-phase4
npm run verify:release
```
