# Phase 7: Authority Ticket Integration Adapter

Phase 7 distinguishes a tracked authority ticket from an untracked email action. An Admin can submit a reviewed complaint through a configured email or webhook adapter and see delivery, retry, external-reference, and reconciliation state in the complaint detail view.

## Safety And Idempotency

Complaints requiring human review cannot be submitted until an Admin confirms or corrects the AI decision. Each complaint has one `AuthorityTicket` and one stable idempotency key. Repeated clicks return or retry the same ticket instead of creating duplicate municipal reports.

The adapter payload contains complaint ID, decision, severity, location, routing, confidence, review status, and audit head. It excludes reporter email, user ID, password data, OTPs, tokens, and API credentials.

## Adapters

- `disabled`: explicit default; records `not_configured` and never claims delivery.
- `email`: sends a tracked plain-text ticket to `AUTHORITY_TICKET_EMAIL` and stores the SMTP message ID as an external reference.
- `webhook`: POSTs versioned JSON with an `Idempotency-Key` header and optional bearer token. Successful responses may return `ticketId` or `reference`.

Failures store bounded error metadata and exponential retry times. Tokens and full webhook destinations are not persisted or returned. Admin reconciliation supports acknowledged, in-progress, resolved, and rejected states with a role-level history.

Reconciling a ticket as resolved also moves the linked complaint into the existing citizen-verification phase, closes automatic follow-up while verification is pending, and resolves any linked incident command. It does not bypass the citizen outcome loop.

## Environment

```env
AUTHORITY_ADAPTER=disabled
AUTHORITY_TICKET_EMAIL=
AUTHORITY_WEBHOOK_URL=
AUTHORITY_WEBHOOK_TOKEN=
AUTHORITY_TIMEOUT_MS=8000
AUTHORITY_MAX_ATTEMPTS=3
```

Use either email or webhook settings according to an actual authority agreement. A generic webhook adapter is integration infrastructure, not evidence that BBMP exposes or accepts this API.

## Verification

```bash
npm run verify:authority-tickets
```

Tests cover payload privacy, idempotency, successful delivery, failure state, retry schedule, reconciliation validation, disabled configuration, and schema validity.

## Phase 8 Boundary

Authority adapters complete the operational workflow. Phase 8 validates whether people and infrastructure can use that workflow reliably through accessibility contracts, keyboard and reduced-motion support, static UI audits, load scenarios, timeout/failure tests, and deployment readiness checks.
