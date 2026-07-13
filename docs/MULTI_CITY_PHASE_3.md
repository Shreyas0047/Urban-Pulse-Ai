# Multi-City Expansion Phase 3: Jurisdiction Routing And Ownership

Phase 3 replaces the Bengaluru-only fallback routing table with a versioned, city-scoped ownership registry. It prepares Bengaluru, Mumbai, Delhi, Chennai, and Hyderabad for deterministic category routing without activating the four planned cities or claiming municipal API access.

## Ownership Registry

`shared/cityRoutingRegistry.json` defines five reusable ownership templates and five city profiles. The server expands them into 25 stable `DepartmentUnit` records: five units for each city. Every one of the 12 canonical AI categories has exactly one primary owner per city.

Registry validation fails startup when:

- A registered city is missing or duplicated.
- A category is missing, unknown, or assigned to multiple primary templates.
- An authority differs from the city registry.
- A unit lacks all four severity levels or valid workload capacity.
- A portal lacks HTTPS provenance.
- A profile claims direct API support.
- A Phase 3 handoff mode is anything other than `manual_portal`.

Application startup synchronizes all 25 units idempotently. The routing engine queries only allowlisted units matching the complaint `cityId` and current routing-registry version. An incomplete or unavailable database result falls back to the same source-controlled units for that city, never to another city's units.

## Routing Decision

The routing score combines category ownership, severity capacity, ward coverage, location keywords, and active workload. Complaint history and active workload are already city-scoped by Phase 2. Phase 3 adds city identity, routing-registry version, authority, unit, and handoff snapshot to the stored routing decision.

The public discovery endpoint is:

```http
GET /api/cities/:slug/routing-units
```

It returns ownership labels, category coverage, official portal URL, and handoff status. It does not expose internal source URLs, contact-email fields, or credentials.

## Truthful Authority Handoff

All Phase 3 profiles use `manual_portal` and `supportsDirectApi: false`. Internal routing means Urban Pulse identified an owner; it does not mean the authority received the complaint.

Complaint details and PDFs show the handoff mode and official portal. Authority tickets freeze city and ownership metadata. Bengaluru can continue using an explicitly configured authority email. A future city cannot inherit the Bengaluru destination: email is rejected unless that city's routing snapshot has a `verified_email` channel. The legacy `/api/email-bbmp` route remains as a compatibility alias, while the frontend uses `/api/email-authority`.

## Human Review

Admin corrections can no longer type arbitrary department names or replace a city authority with generic `Municipality` or `Gram Panchayat` labels. The review UI receives the city's registered ownership units and permits only the owner valid for the corrected category. The selected unit, authority, registry version, portal, and manual handoff state are stored with the corrected routing decision.

## Commands

```bash
npm run routing:sync
npm run verify:multi-city-phase3
npm run verify:release
```

## Activation Boundary

Phase 3 does not enable reporting outside Bengaluru. Before another city is activated, the project still needs approved operational contacts, a city-specific connector or documented manual workflow, staging delivery tests, reconciliation ownership, and city-level alert/dashboard scoping. A public portal URL alone is not evidence of an API partnership.
