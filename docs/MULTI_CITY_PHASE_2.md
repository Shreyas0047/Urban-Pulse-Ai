# Multi-City Expansion Phase 2: City-First Complaint Intake

Phase 2 makes city identity an explicit, validated part of complaint intake. It does not activate Mumbai, Delhi, Chennai, or Hyderabad. Bengaluru remains the only reporting-enabled jurisdiction until authority channels, department mappings, and operational ownership are approved for each additional city.

## Citizen Flow

The complaint form loads `GET /api/cities` before enabling submission. City is the first field. Bengaluru is selected by default, while planned cities remain visible as disabled `Coming soon` options. The availability panel states the default civic authority and links to the official public complaint channel without claiming that Urban Pulse has a direct municipal API.

The selected city is stored in the local report draft. A saved city is restored only when it still exists and remains reporting-enabled; stale or disabled draft values fall back to the current server default. If city discovery fails, submission remains disabled and the user receives a retry action.

## Server Contract

Every new complaint submission must include:

```json
{
  "cityId": "bengaluru",
  "cityRegistryVersion": "1.0.0"
}
```

The server rejects missing cities, unknown slugs, stale registry versions, and cities whose rollout is not active. It never trusts a client-provided city name, authority, state, or availability flag. Those values are loaded from the synchronized registry and stored as the complaint's jurisdiction snapshot.

When Nominatim returns a real coordinate, the backend checks it against the selected city's coarse envelope with a small tolerance. A clear mismatch is rejected before AI analysis or quota-limited provider calls. Geocoder fallback coordinates do not trigger a false mismatch rejection.

## Isolation

Previous-report context, nearby-report context, active routing workload, and incident-cluster candidates are filtered by `cityId`. Incident clusters also store city identity. This prevents similarly named areas or complaints in different cities from influencing each other as later cities are activated.

## Chatbot

Guided chatbot reporting now follows this sequence:

1. Select city.
2. Describe the issue.
3. Provide the location.

Planned cities are explained but cannot advance the complaint draft. Legacy in-progress chatbot drafts without city identity are returned to city selection rather than silently defaulted.

## Verification

```bash
npm run verify:multi-city-phase2
npm run verify:release
```

The focused verifier covers city aliases, missing/unknown/stale/disabled rejection, location-envelope behavior, chatbot stages, cluster city defaults, selector ordering, disabled planned options, registry-version submission, and draft persistence.

Phase 3 now builds on this contract with city-scoped category ownership and truthful authority handoff. See [Multi-City Expansion Phase 3](MULTI_CITY_PHASE_3.md).
