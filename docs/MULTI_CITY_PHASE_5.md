# Multi-City Expansion Phase 5: City-Scoped Operations And Alerts

Phase 5 establishes the isolation boundary required before another jurisdiction can be activated. It prevents complaints, operational metrics, incident commands, clusters, community proof, and emergency recipients from being mixed across cities.

## Operations Scope

Every Admin has an explicit `operationalCityIds` assignment. Existing Admin records without that field are treated as Bengaluru-only, never global. The Admin dashboard requires a registered and assigned `cityId`; the selected city scopes:

- Complaint lists, alerts, maps, and status actions.
- Civic health, risk predictions, hotspot intelligence, and aggregate metrics.
- Active incident commands and incident clusters.
- AI observability events, selected through the scoped complaint IDs.

The account-management panel can assign an Admin to an operations city. Assignment changes increment the account token version so stale sessions cannot retain earlier access. Planned-city dashboards may be assigned for readiness checks, but planned cities still cannot accept reports.

## Alert And Community Isolation

Local-alert preferences now store city ID, city name, and registry version. Saving preferences requires a current reporting-enabled city, so users cannot subscribe through stale or planned registry data.

Emergency broadcasts store complaint city identity and match:

- Admins assigned to that operations city.
- Citizens whose alert city, severity threshold, and saved area all match.
- Prior reporters drawn from the already city-scoped recent-complaint set.

Community proof applies the same city boundary before area matching. A Bengaluru subscription can never surface or email a Mumbai complaint merely because both locations contain a similar area or ward name.

## Compatibility Rules

- Legacy complaints, Admin assignments, commands, broadcasts, and alert preferences without city metadata are interpreted as Bengaluru records only.
- Non-Bengaluru queries never include records without `cityId`.
- New broadcasts and incident commands always persist `cityId` and `cityName`.
- City access controls do not activate reporting. Bengaluru remains the only reporting-enabled jurisdiction.

## Verification

```bash
npm run verify:multi-city-phase5
npm run verify:release
```

The Phase 5 verifier uses same-area complaints from two cities and confirms that alerts and community proof return only the subscribed city. It also checks Admin assignment enforcement, city-scoped operational queries, models, and frontend controls.
