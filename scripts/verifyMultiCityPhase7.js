const assert = require("assert");
const fs = require("fs");
const path = require("path");
const CityRolloutState = require("../src/models/CityRolloutState");
const CityDailyIntake = require("../src/models/CityDailyIntake");
const cityRegistry = require("../shared/cityRegistry.json");
const { activationConfigurationHash } = require("../src/services/cityActivationService");
const {
  assertCityIntakeAllowed,
  assertEnabledCityRolloutsReady,
  cohortBucket,
  reserveDailyIntake,
  updateCityRollout,
  utcDateKey,
  virtualRollout
} = require("../src/services/cityRolloutService");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const now = new Date("2026-07-13T12:00:00.000Z");
const mumbai = cityRegistry.cities.find((city) => city.slug === "mumbai");

class FakeRollout {
  constructor(data = {}) {
    Object.assign(this, data);
    this.mode = this.mode || "closed";
    this.previousActiveMode = this.previousActiveMode || "closed";
    this.history = this.history || [];
    this.pilotPercentage = this.pilotPercentage || 10;
    this.dailyComplaintLimit = this.dailyComplaintLimit || 0;
    this.pilotStartedAt = this.pilotStartedAt || null;
  }

  async save() {
    FakeRollout.current = this;
    return this;
  }

  static async findOne() {
    return FakeRollout.current || null;
  }
}

function approvedReview() {
  return {
    _id: "507f1f77bcf86cd799439099",
    cityId: "mumbai",
    status: "approved",
    configurationHash: activationConfigurationHash("mumbai"),
    evidence: {
      portalSubmissionTestedAt: now,
      dashboardIsolationTestedAt: now,
      alertIsolationTestedAt: now,
      reconciliationOwner: "Mumbai operations team",
      note: "All staging isolation and authority handoff exercises completed successfully."
    }
  };
}

const activeAdminModel = { async countDocuments() { return 1; } };
const reviewModel = { async findOne() { return approvedReview(); } };

function identityFor(predicate) {
  for (let index = 0; index < 1000; index += 1) {
    const identity = `pilot-user-${index}`;
    if (predicate(cohortBucket("mumbai", identity))) return identity;
  }
  throw new Error("Unable to create deterministic cohort fixture.");
}

async function main() {
  assert.equal(utcDateKey(now), "2026-07-13");
  assert.equal(cohortBucket("mumbai", "citizen-1"), cohortBucket("mumbai", "citizen-1"));
  assert.ok(cohortBucket("mumbai", "citizen-1") >= 0 && cohortBucket("mumbai", "citizen-1") < 100);
  assert.equal(virtualRollout("bengaluru").mode, "open");
  assert.equal(virtualRollout("mumbai").mode, "closed");

  const permittedIdentity = identityFor((bucket) => bucket < 20);
  const blockedIdentity = identityFor((bucket) => bucket >= 20);
  const pilotState = {
    _id: "607f1f77bcf86cd799439011",
    cityId: "mumbai",
    cityName: "Mumbai",
    mode: "pilot",
    pilotPercentage: 20,
    dailyComplaintLimit: 0,
    configurationHash: activationConfigurationHash("mumbai")
  };
  const rolloutModel = { async findOne() { return pilotState; } };
  const permitted = await assertCityIntakeAllowed(mumbai, { userId: permittedIdentity }, { rolloutModel, now });
  assert.equal(permitted.mode, "pilot");
  assert.ok(permitted.cohortBucket < 20);
  await assert.rejects(
    () => assertCityIntakeAllowed(mumbai, { userId: blockedIdentity }, { rolloutModel, now }),
    (error) => error.code === "CITY_PILOT_NOT_ELIGIBLE" && error.statusCode === 403
  );

  await assert.rejects(
    () => assertCityIntakeAllowed(mumbai, { userId: permittedIdentity }, { rolloutModel: { async findOne() { return { ...pilotState, mode: "paused", pauseReason: "Authority outage" }; } } }),
    (error) => error.code === "CITY_ROLLOUT_PAUSED"
  );
  await assert.rejects(
    () => assertCityIntakeAllowed(mumbai, { userId: permittedIdentity }, { rolloutModel: { async findOne() { return { ...pilotState, configurationHash: "a".repeat(64) }; } } }),
    (error) => error.code === "CITY_ROLLOUT_STALE"
  );

  const reserved = await reserveDailyIntake("mumbai", 10, {
    now,
    intakeModel: { async findOneAndUpdate() { return { count: 7 }; } }
  });
  assert.deepEqual(reserved, { allowed: true, used: 7, limit: 10, utcDate: "2026-07-13" });
  let collisionCalls = 0;
  const collisionRecovered = await reserveDailyIntake("mumbai", 10, {
    now,
    intakeModel: { async findOneAndUpdate() { collisionCalls += 1; if (collisionCalls === 1) throw Object.assign(new Error("duplicate"), { code: 11000 }); return { count: 2 }; } }
  });
  assert.equal(collisionRecovered.allowed, true);
  const exhausted = await reserveDailyIntake("mumbai", 10, {
    now,
    intakeModel: { async findOneAndUpdate(_filter, _update, options) { if (options.upsert) throw Object.assign(new Error("duplicate"), { code: 11000 }); return null; } }
  });
  assert.equal(exhausted.allowed, false);

  FakeRollout.current = null;
  await assert.rejects(
    () => updateCityRollout("mumbai", { mode: "open", pilotPercentage: 100, dailyComplaintLimit: 100, reason: "Attempt direct open rollout" }, { role: "Admin", userId: "admin" }, { rolloutModel: FakeRollout, reviewModel, userModel: activeAdminModel, now }),
    (error) => error.code === "CITY_PILOT_REQUIRED"
  );
  const pilot = await updateCityRollout("mumbai", { mode: "pilot", pilotPercentage: 20, dailyComplaintLimit: 100, reason: "Start controlled Mumbai pilot" }, { role: "Admin", userId: "admin" }, { rolloutModel: FakeRollout, reviewModel, userModel: activeAdminModel, now });
  assert.equal(pilot.mode, "pilot");
  assert.equal(pilot.history.length, 1);
  await assert.rejects(
    () => updateCityRollout("mumbai", { mode: "open", pilotPercentage: 100, dailyComplaintLimit: 500, reason: "Attempt open before observation ends" }, { role: "Admin", userId: "admin" }, { rolloutModel: FakeRollout, reviewModel, userModel: activeAdminModel, now }),
    (error) => error.code === "CITY_PILOT_OBSERVATION_REQUIRED"
  );
  FakeRollout.current.pilotStartedAt = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const opened = await updateCityRollout("mumbai", { mode: "open", pilotPercentage: 100, dailyComplaintLimit: 500, reason: "Pilot completed with stable results" }, { role: "Admin", userId: "admin" }, { rolloutModel: FakeRollout, reviewModel, userModel: activeAdminModel, now });
  assert.equal(opened.mode, "open");
  const paused = await updateCityRollout("mumbai", { mode: "paused", pilotPercentage: 100, dailyComplaintLimit: 500, reason: "Pause immediately for authority outage" }, { role: "Admin", userId: "admin" }, { rolloutModel: FakeRollout, reviewModel, userModel: activeAdminModel, now });
  assert.equal(paused.mode, "paused");
  assert.equal(paused.previousActiveMode, "open");

  const originalStatus = mumbai.rolloutStatus;
  const originalEnabled = mumbai.reportingEnabled;
  mumbai.rolloutStatus = "pilot";
  mumbai.reportingEnabled = true;
  const readyState = { ...pilotState, mode: "pilot" };
  assert.equal(await assertEnabledCityRolloutsReady({ rolloutModel: { async findOne() { return readyState; } } }), true);
  assert.equal(await assertEnabledCityRolloutsReady({ rolloutModel: { async findOne() { return { ...readyState, mode: "paused" }; } } }), true);
  await assert.rejects(() => assertEnabledCityRolloutsReady({ rolloutModel: { async findOne() { return null; } } }), /without a current rollout state/);
  mumbai.rolloutStatus = originalStatus;
  mumbai.reportingEnabled = originalEnabled;

  const rolloutDocument = new CityRolloutState({ cityId: "mumbai", cityName: "Mumbai", mode: "pilot", pilotPercentage: 20, dailyComplaintLimit: 100, configurationHash: activationConfigurationHash("mumbai") });
  assert.ifError(rolloutDocument.validateSync());
  const intakeDocument = new CityDailyIntake({ key: "mumbai:2026-07-13", cityId: "mumbai", utcDate: "2026-07-13", count: 1 });
  assert.ifError(intakeDocument.validateSync());

  const complaintService = read("src/services/complaintService.js");
  const gateIndex = complaintService.indexOf("await assertCityIntakeAllowed(city, auth)");
  assert.ok(gateIndex > 0);
  assert.ok(gateIndex < complaintService.indexOf("await geocodeLocation", gateIndex));
  assert.ok(gateIndex < complaintService.indexOf("await analyzeComplaint", gateIndex));
  const routes = read("src/routes/api.js");
  const database = read("src/config/db.js");
  const frontend = read("public/app.js");
  assert.match(routes, /cities\/:slug\/rollout[^\n]+requirePermission\("update_complaint_status"\)/);
  assert.ok(database.indexOf("await assertEnabledCityRolloutsReady()") < database.indexOf("await syncCityRegistry()"));
  assert.match(frontend, /Pause intake now/);
  assert.match(frontend, /Pilot access uses a stable user cohort/);

  console.log(JSON.stringify({
    passed: true,
    deterministicPilotCohorts: true,
    nonEligiblePilotUsersBlocked: true,
    dailyLimitAtomicReservationCovered: true,
    firstRequestCollisionRecovered: true,
    emergencyPauseBlocksIntake: true,
    staleConfigurationBlocksIntake: true,
    pilotRequiredBeforeOpen: true,
    minimumPilotObservationEnforced: true,
    pausedCityCanRestartSafely: true,
    rolloutTransitionsAudited: true,
    gateRunsBeforeExternalProviders: true,
    startupRequiresRuntimeRollout: true
  }, null, 2));
}

main().catch((error) => {
  mumbai.rolloutStatus = "planned";
  mumbai.reportingEnabled = false;
  console.error(error);
  process.exitCode = 1;
});
