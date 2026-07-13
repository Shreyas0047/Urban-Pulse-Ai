const assert = require("assert");
const fs = require("fs");
const path = require("path");
const CityOperationalEvent = require("../src/models/CityOperationalEvent");
const CityOperationalIncident = require("../src/models/CityOperationalIncident");
const {
  SLO_RULES,
  acknowledgeOperationalIncident,
  calculateOperationalHealth,
  evaluateCityCircuitBreaker,
  safeMetadata
} = require("../src/services/cityOperationalHealthService");
const { updateCityRollout } = require("../src/services/cityRolloutService");

function events(domain, total, affectedOutcome, affected) {
  return Array.from({ length: total }, (_, index) => ({
    domain,
    outcome: index < affected ? affectedOutcome : "success"
  }));
}

async function expectCode(action, code) {
  try {
    await action();
    assert.fail(`Expected ${code}`);
  } catch (error) {
    assert.equal(error.code, code);
  }
}

async function run() {
  const belowMinimum = calculateOperationalHealth(events("complaint_processing", 9, "failure", 9));
  assert.equal(belowMinimum.breachedRules.length, 0, "small samples must not open the circuit");

  const complaintFailure = calculateOperationalHealth(events("complaint_processing", 10, "failure", 4));
  assert(complaintFailure.breachedRules.some((rule) => rule.trigger === "complaint_failure_rate"));
  const aiDegradation = calculateOperationalHealth(events("complaint_processing", 15, "degraded", 9));
  assert(aiDegradation.breachedRules.some((rule) => rule.trigger === "ai_degradation_rate"));
  const authorityFailure = calculateOperationalHealth(events("authority_delivery", 5, "failure", 3));
  assert(authorityFailure.breachedRules.some((rule) => rule.trigger === "authority_failure_rate"));
  const broadcastFailure = calculateOperationalHealth(events("broadcast_delivery", 5, "failure", 3));
  assert(broadcastFailure.breachedRules.some((rule) => rule.trigger === "broadcast_failure_rate"));

  const metadata = safeMetadata({
    aiFallbackUsed: true,
    email: "citizen@example.com",
    complaintText: "private complaint",
    apiKey: "secret",
    adapter: "email",
    providerStatus: "submitted"
  });
  assert.deepEqual(Object.keys(metadata).sort(), ["adapter", "aiFallbackUsed", "providerStatus", "recipientCount", "visionFallbackUsed"].sort());
  assert(!JSON.stringify(metadata).includes("citizen@example.com"));

  const now = new Date("2026-07-13T10:00:00.000Z");
  const recentEvents = events("complaint_processing", 10, "failure", 4).map((event) => ({ ...event, cityId: "bengaluru", occurredAt: now }));
  class FakeEventModel {
    static find() { return { lean: async () => recentEvents }; }
  }
  class FakeIncidentModel {
    static records = [];
    constructor(value) { Object.assign(this, value, { _id: `incident-${FakeIncidentModel.records.length + 1}` }); }
    async save() {
      if (!FakeIncidentModel.records.includes(this)) FakeIncidentModel.records.push(this);
      return this;
    }
    static async findOne(filter) {
      return FakeIncidentModel.records.find((item) =>
        (!filter._id || item._id === filter._id) &&
        item.cityId === filter.cityId &&
        (!filter.trigger || item.trigger === filter.trigger) &&
        (!filter.status || (filter.status.$in ? filter.status.$in.includes(item.status) : item.status === filter.status))
      ) || null;
    }
    static async updateMany(filter, update) {
      for (const item of FakeIncidentModel.records.filter((record) => record.cityId === filter.cityId && record.status === filter.status)) {
        Object.assign(item, update.$set || {});
        if (update.$unset?.activeKey !== undefined) delete item.activeKey;
        if (update.$push?.timeline) item.timeline.push(update.$push.timeline);
      }
    }
  }
  class FakeRolloutModel {
    static records = [];
    constructor(value) { Object.assign(this, value, { _id: "rollout-1", history: value.history || [] }); }
    async save() {
      if (!FakeRolloutModel.records.includes(this)) FakeRolloutModel.records.push(this);
      return this;
    }
    static async findOne(filter) { return FakeRolloutModel.records.find((item) => item.cityId === filter.cityId) || null; }
  }

  await evaluateCityCircuitBreaker("bengaluru", {
    eventModel: FakeEventModel,
    incidentModel: FakeIncidentModel,
    rolloutModel: FakeRolloutModel,
    now
  });
  assert.equal(FakeRolloutModel.records[0].mode, "paused", "breach must pause only the affected city");
  assert.equal(FakeIncidentModel.records.length, 1, "breach must create an auditable incident");
  await evaluateCityCircuitBreaker("bengaluru", {
    eventModel: FakeEventModel,
    incidentModel: FakeIncidentModel,
    rolloutModel: FakeRolloutModel,
    now
  });
  assert.equal(FakeIncidentModel.records.length, 1, "repeated evaluation must not duplicate an active incident");

  await expectCode(
    () => updateCityRollout(
      "bengaluru",
      { mode: "open", pilotPercentage: 100, dailyComplaintLimit: 0, reason: "Resume after service recovery" },
      { role: "Admin", userId: "admin-1" },
      { rolloutModel: FakeRolloutModel, incidentModel: FakeIncidentModel, now }
    ),
    "CITY_INCIDENT_ACK_REQUIRED"
  );
  await acknowledgeOperationalIncident("bengaluru", FakeIncidentModel.records[0]._id, "Provider recovered and test delivery passed.", { role: "Admin", userId: "admin-1" }, { incidentModel: FakeIncidentModel, now });
  await updateCityRollout(
    "bengaluru",
    { mode: "open", pilotPercentage: 100, dailyComplaintLimit: 0, reason: "Resume after verified recovery" },
    { role: "Admin", userId: "admin-1" },
    { rolloutModel: FakeRolloutModel, incidentModel: FakeIncidentModel, now }
  );
  assert.equal(FakeIncidentModel.records[0].status, "resolved", "resuming must resolve acknowledged incidents");

  const eventValidation = new CityOperationalEvent({
    cityId: "bengaluru",
    cityName: "Bengaluru",
    domain: "complaint_processing",
    outcome: "success",
    eventType: "complaint_created",
    expiresAt: new Date(now.getTime() + 1000)
  }).validateSync();
  assert.equal(eventValidation, undefined);
  const incidentValidation = new CityOperationalIncident({
    activeKey: "bengaluru:complaint_failure_rate",
    cityId: "bengaluru",
    cityName: "Bengaluru",
    trigger: "complaint_failure_rate",
    domain: "complaint_processing",
    reason: "Threshold reached during verification.",
    windowMinutes: 15,
    sampleSize: 10,
    affectedCount: 4,
    observedRate: 0.4,
    threshold: 0.35
  }).validateSync();
  assert.equal(incidentValidation, undefined);

  const root = path.join(__dirname, "..");
  const routes = fs.readFileSync(path.join(root, "src/routes/api.js"), "utf8");
  const complaintController = fs.readFileSync(path.join(root, "src/controllers/complaintController.js"), "utf8");
  const authorityController = fs.readFileSync(path.join(root, "src/controllers/authorityTicketController.js"), "utf8");
  const ui = fs.readFileSync(path.join(root, "public/app.js"), "utf8");
  assert(routes.includes('requirePermission("update_complaint_status"), getOperationalHealth'));
  assert(routes.includes('requirePermission("update_complaint_status"), acknowledgeIncident'));
  assert(complaintController.includes("recordOperationalEventSafely"));
  assert(authorityController.includes("recordAuthorityDelivery"));
  assert(ui.includes("loadCityOperationalHealth(data.operationsScope)"));
  assert.equal(SLO_RULES.length, 4);

  console.log(JSON.stringify({
    passed: true,
    minimumSamplesEnforced: true,
    complaintAndAiSignalsCovered: true,
    authorityAndBroadcastSignalsCovered: true,
    sensitiveMetadataDiscarded: true,
    automaticCityPauseVerified: true,
    duplicateIncidentsSuppressed: true,
    acknowledgementRequiredForResume: true,
    acknowledgedIncidentsResolvedOnResume: true,
    protectedApiAndAdminUiWired: true
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
