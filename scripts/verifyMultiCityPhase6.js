const assert = require("assert");
const fs = require("fs");
const path = require("path");
const CityActivationReview = require("../src/models/CityActivationReview");
const cityRegistry = require("../shared/cityRegistry.json");
const { validateRegistry } = require("../src/services/cityRegistryService");
const {
  activationConfigurationHash,
  approveCityActivation,
  assertEnabledCitiesReady,
  buildCityActivationReadiness,
  dateIsFresh,
  recordActivationEvidence
} = require("../src/services/cityActivationService");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const now = new Date("2026-07-13T12:00:00.000Z");
const userModel = (count = 1) => ({ async countDocuments() { return count; } });

class FakeReview {
  constructor(data = {}) {
    Object.assign(this, data);
    this.evidence = this.evidence || {};
    this.checkSnapshot = this.checkSnapshot || [];
    this.status = this.status || "draft";
  }

  async save() {
    FakeReview.current = this;
    return this;
  }

  static async findOne() {
    return FakeReview.current || null;
  }
}

function completeEvidence() {
  return {
    portalSubmissionTestedAt: now,
    dashboardIsolationTestedAt: now,
    alertIsolationTestedAt: now,
    reconciliationOwner: "Mumbai civic operations team",
    note: "Staging handoff, dashboard isolation, alerts, and reconciliation were verified.",
    attestedByRole: "Admin",
    attestedByUserId: "admin-user-id",
    attestedAt: now
  };
}

async function main() {
  assert.equal(dateIsFresh(now, 90, now), true);
  assert.equal(dateIsFresh(new Date("2026-01-01T00:00:00.000Z"), 90, now), false);
  const initialHash = activationConfigurationHash("mumbai");
  assert.equal(initialHash.length, 64);

  const mumbai = cityRegistry.cities.find((city) => city.slug === "mumbai");
  const originalStatus = mumbai.rolloutStatus;
  const originalEnabled = mumbai.reportingEnabled;
  const originalPortal = mumbai.officialChannels.portalUrl;
  mumbai.rolloutStatus = "active";
  mumbai.reportingEnabled = true;
  assert.equal(activationConfigurationHash("mumbai"), initialHash, "The planned-to-active switch must not invalidate pre-approval.");
  const multiActiveRegistry = JSON.parse(JSON.stringify(cityRegistry));
  assert.deepEqual(validateRegistry(multiActiveRegistry), []);
  mumbai.officialChannels.portalUrl = `${originalPortal}#changed`;
  assert.notEqual(activationConfigurationHash("mumbai"), initialHash, "Operational metadata changes must invalidate approval.");
  mumbai.officialChannels.portalUrl = originalPortal;
  mumbai.rolloutStatus = originalStatus;
  mumbai.reportingEnabled = originalEnabled;

  const readyReview = {
    cityId: "mumbai",
    configurationHash: initialHash,
    status: "ready",
    evidence: completeEvidence()
  };
  const ready = await buildCityActivationReadiness("mumbai", readyReview, { userModel: userModel(1), now });
  assert.equal(ready.status, "ready");
  assert.ok(ready.checks.every((item) => item.passed));
  const noAdmin = await buildCityActivationReadiness("mumbai", readyReview, { userModel: userModel(0), now });
  assert.equal(noAdmin.status, "blocked");
  assert.equal(noAdmin.checks.find((item) => item.id === "admin_ownership").passed, false);
  const stale = await buildCityActivationReadiness("mumbai", { ...readyReview, configurationHash: "a".repeat(64) }, { userModel: userModel(1), now });
  assert.equal(stale.status, "stale");

  FakeReview.current = null;
  const recorded = await recordActivationEvidence("mumbai", {
    portalSubmissionTested: true,
    dashboardIsolationTested: true,
    alertIsolationTested: true,
    reconciliationOwner: "Mumbai civic operations team",
    note: "Staging handoff, dashboard isolation, alerts, and reconciliation were verified."
  }, { role: "Admin", userId: "admin-user-id" }, { reviewModel: FakeReview, userModel: userModel(1) });
  assert.equal(recorded.readiness.status, "ready");
  assert.equal(recorded.review.evidence.attestedByUserId, "admin-user-id");
  const approved = await approveCityActivation("mumbai", { role: "Admin", userId: "approver-id" }, { reviewModel: FakeReview, userModel: userModel(1) });
  assert.equal(approved.review.status, "approved");
  assert.equal(approved.review.approvedByUserId, "approver-id");

  mumbai.rolloutStatus = "active";
  mumbai.reportingEnabled = true;
  const approvedAtStartup = await assertEnabledCitiesReady({ reviewModel: FakeReview, userModel: userModel(1) });
  assert.equal(approvedAtStartup, true);
  FakeReview.current = null;
  await assert.rejects(() => assertEnabledCitiesReady({ reviewModel: FakeReview, userModel: userModel(1) }), /without a current approved activation review/);
  mumbai.rolloutStatus = originalStatus;
  mumbai.reportingEnabled = originalEnabled;

  const model = new CityActivationReview({
    cityId: "mumbai",
    cityName: "Mumbai",
    cityRegistryVersion: "1.0.0",
    routingRegistryVersion: "1.0.0",
    configurationHash: initialHash,
    status: "approved"
  });
  assert.ifError(model.validateSync());

  const routes = read("src/routes/api.js");
  const database = read("src/config/db.js");
  const frontend = read("public/app.js");
  assert.match(routes, /cities\/:slug\/activation-readiness[^\n]+requirePermission\("update_complaint_status"\)/);
  assert.match(routes, /activation-readiness\/evidence/);
  assert.match(routes, /activation-readiness\/approve/);
  assert.match(database, /assertEnabledCitiesReady/);
  assert.ok(database.indexOf("await assertEnabledCitiesReady()") < database.indexOf("await syncCityRegistry()"));
  assert.match(frontend, /Readiness approval does not enable reporting/);

  console.log(JSON.stringify({
    passed: true,
    multiActiveRegistrySupported: true,
    plannedToActiveHashStable: true,
    operationalChangesInvalidateApproval: true,
    staleAndExpiredEvidenceBlocked: true,
    adminOwnershipRequired: true,
    authenticatedAttestationStored: true,
    startupWithoutApprovalRejected: true,
    approvalCheckedBeforeRegistryMutation: true,
    protectedAdminConsolePresent: true
  }, null, 2));
}

main().catch((error) => {
  const mumbai = cityRegistry.cities.find((city) => city.slug === "mumbai");
  mumbai.rolloutStatus = "planned";
  mumbai.reportingEnabled = false;
  console.error(error);
  process.exitCode = 1;
});
