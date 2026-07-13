const assert = require("assert");
const fs = require("fs");
const path = require("path");
const EmergencyBroadcast = require("../src/models/EmergencyBroadcast");
const IncidentCommand = require("../src/models/IncidentCommand");
const User = require("../src/models/User");
const { cityDataFilter, resolveOperationsCity } = require("../src/controllers/dashboardController");
const { buildCommunityCases } = require("../src/services/communityProofService");
const { localAlertMatch } = require("../src/services/broadcastService");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function main() {
  assert.deepEqual(cityDataFilter("mumbai"), { cityId: "mumbai" });
  assert.deepEqual(cityDataFilter("bengaluru"), { $or: [{ cityId: "bengaluru" }, { cityId: { $exists: false } }] });
  assert.equal(resolveOperationsCity("mumbai", ["bengaluru", "mumbai"]).name, "Mumbai");
  assert.throws(() => resolveOperationsCity("mumbai", ["bengaluru"]), /not assigned/);
  assert.throws(() => resolveOperationsCity("unknown", ["bengaluru"]), /registered operations city/);

  const preferences = {
    enabled: true,
    cityId: "bengaluru",
    cityName: "Bengaluru",
    severityThreshold: "High",
    areas: [{ label: "Indiranagar", normalized: "indiranagar" }]
  };
  const alertUser = { localAlertPreferences: preferences };
  assert.equal(localAlertMatch(alertUser, ["Indiranagar"], "High", "bengaluru"), "Indiranagar");
  assert.equal(localAlertMatch(alertUser, ["Indiranagar"], "High", "mumbai"), null);

  const complaint = (id, cityId, cityName) => ({
    _id: id,
    cityId,
    cityName,
    type: "Tree obstruction",
    priority: "High",
    status: "In Progress",
    location: "Indiranagar",
    areaIntelligence: { likelyArea: "Indiranagar" },
    routing: { ward: "Central Ward" },
    communityProof: { signals: [], summary: { total: 0 } }
  });
  const cases = buildCommunityCases(
    [complaint("bengaluru-case", "bengaluru", "Bengaluru"), complaint("mumbai-case", "mumbai", "Mumbai")],
    preferences,
    "current-user",
    "citizen@example.com"
  );
  assert.equal(cases.length, 1);
  assert.equal(cases[0].id, "bengaluru-case");
  assert.equal(cases[0].cityId, "bengaluru");

  assert.ok(User.schema.path("operationalCityIds"));
  assert.ok(User.schema.path("localAlertPreferences.cityId"));
  assert.ok(EmergencyBroadcast.schema.path("cityId"));
  assert.ok(IncidentCommand.schema.path("cityId"));

  const dashboard = read("src/controllers/dashboardController.js");
  const broadcast = read("src/services/broadcastService.js");
  const frontend = read("public/app.js");
  const html = read("public/index.html");
  assert.match(dashboard, /complaintId: \{ \$in: complaintDocs\.map/);
  assert.match(dashboard, /IncidentCommand\.find\(\{ \.\.\.cityDataFilter/);
  assert.match(dashboard, /IncidentCluster\.find\(\{ \.\.\.cityDataFilter/);
  assert.match(broadcast, /operationalCityIds: cityId/);
  assert.match(frontend, /params\.set\("cityId", operationsCityId\)/);
  assert.match(html, /id="dashboardCityFilter"/);
  assert.match(html, /id="localAlertCity"/);

  console.log(JSON.stringify({
    passed: true,
    operationsAccessEnforced: true,
    dashboardQueriesCityScoped: true,
    observabilityEventsComplaintScoped: true,
    localAlertCrossCityMatchBlocked: true,
    communityProofCrossCityMatchBlocked: true,
    broadcastAndCommandCityIdentityStored: true,
    legacyRecordsRestrictedToBengaluru: true
  }, null, 2));
}

main();
