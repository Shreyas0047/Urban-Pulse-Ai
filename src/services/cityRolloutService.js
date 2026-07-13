const crypto = require("crypto");
const CityRolloutState = require("../models/CityRolloutState");
const CityDailyIntake = require("../models/CityDailyIntake");
const CityActivationReview = require("../models/CityActivationReview");
const CityOperationalIncident = require("../models/CityOperationalIncident");
const cityRegistry = require("../../shared/cityRegistry.json");
const { DEFAULT_CITY_ID } = require("./cityRegistryService");
const { activationConfigurationHash, buildCityActivationReadiness, registeredCity } = require("./cityActivationService");

const MODES = new Set(["closed", "pilot", "open", "paused"]);
const MIN_PILOT_HOURS = 24;

function rolloutError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.userMessage = message;
  return error;
}

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function cohortBucket(cityId, identity) {
  const digest = crypto.createHash("sha256").update(`${String(cityId).toLowerCase()}:${String(identity || "anonymous")}`).digest();
  return digest.readUInt32BE(0) % 100;
}

function virtualRollout(cityId) {
  const city = registeredCity(cityId);
  const isDefault = city.slug === DEFAULT_CITY_ID;
  return {
    cityId: city.slug,
    cityName: city.name,
    mode: isDefault ? "open" : "closed",
    previousActiveMode: isDefault ? "open" : "closed",
    pilotPercentage: 100,
    dailyComplaintLimit: 0,
    pilotStartedAt: null,
    configurationHash: activationConfigurationHash(city.slug),
    activationReviewId: null,
    pauseReason: "",
    pausedAt: null,
    persisted: false
  };
}

async function getCityRollout(cityId, { rolloutModel = CityRolloutState } = {}) {
  const city = registeredCity(cityId);
  const state = await rolloutModel.findOne({ cityId: city.slug });
  if (!state) return virtualRollout(city.slug);
  return state;
}

function publicRolloutSnapshot(state) {
  return {
    mode: state.mode,
    pilotPercentage: state.mode === "pilot" ? Number(state.pilotPercentage || 0) : null,
    dailyComplaintLimit: Number(state.dailyComplaintLimit || 0),
    paused: state.mode === "paused",
    reason: state.mode === "paused" ? state.pauseReason || "Intake is temporarily paused." : "",
    updatedAt: state.updatedAt || null
  };
}

async function reserveDailyIntake(cityId, limit, { intakeModel = CityDailyIntake, now = new Date() } = {}) {
  const safeLimit = Number(limit || 0);
  if (!safeLimit) return { allowed: true, used: null, limit: 0, utcDate: utcDateKey(now) };
  const utcDate = utcDateKey(now);
  const key = `${cityId}:${utcDate}`;
  const filter = { key, count: { $lt: safeLimit } };
  const update = { $setOnInsert: { key, cityId, utcDate }, $inc: { count: 1 }, $set: { lastReservedAt: now } };
  try {
    const usage = await intakeModel.findOneAndUpdate(
      filter,
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (!usage) return { allowed: false, used: safeLimit, limit: safeLimit, utcDate };
    return { allowed: true, used: Number(usage.count || 0), limit: safeLimit, utcDate };
  } catch (error) {
    if (error?.code === 11000) {
      try {
        const usage = await intakeModel.findOneAndUpdate(filter, update, { upsert: false, new: true });
        return usage
          ? { allowed: true, used: Number(usage.count || 0), limit: safeLimit, utcDate }
          : { allowed: false, used: safeLimit, limit: safeLimit, utcDate };
      } catch (_retryError) {
        throw rolloutError("City intake capacity could not be verified. Try again shortly.", 503, "CITY_INTAKE_UNAVAILABLE");
      }
    }
    throw rolloutError("City intake capacity could not be verified. Try again shortly.", 503, "CITY_INTAKE_UNAVAILABLE");
  }
}

async function assertCityIntakeAllowed(city, auth, dependencies = {}) {
  const state = await getCityRollout(city.slug, dependencies);
  const currentHash = activationConfigurationHash(city.slug);
  if (state.configurationHash !== currentHash) {
    throw rolloutError(`${city.name} intake is paused because its approved configuration changed.`, 503, "CITY_ROLLOUT_STALE");
  }
  if (state.mode === "closed") throw rolloutError(`${city.name} reporting is not open yet.`, 409, "CITY_ROLLOUT_CLOSED");
  if (state.mode === "paused") throw rolloutError(`${city.name} reporting is temporarily paused. ${state.pauseReason || "Try again later."}`, 503, "CITY_ROLLOUT_PAUSED");

  const identity = auth.userId || auth.username;
  const bucket = cohortBucket(city.slug, identity);
  if (state.mode === "pilot" && bucket >= Number(state.pilotPercentage || 0)) {
    throw rolloutError(`${city.name} reporting is currently limited to a pilot group.`, 403, "CITY_PILOT_NOT_ELIGIBLE");
  }
  const daily = await reserveDailyIntake(city.slug, state.dailyComplaintLimit, dependencies);
  if (!daily.allowed) throw rolloutError(`${city.name} reached today's controlled intake limit. Try again tomorrow.`, 429, "CITY_DAILY_LIMIT_REACHED");
  return {
    mode: state.mode,
    pilotPercentage: state.mode === "pilot" ? state.pilotPercentage : null,
    cohortBucket: state.mode === "pilot" ? bucket : null,
    dailyReservation: daily,
    rolloutStateId: state._id || null
  };
}

function cleanReason(value) {
  const reason = String(value || "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (reason.length < 10) throw rolloutError("Explain the rollout change in at least 10 characters.", 400, "ROLLOUT_REASON_REQUIRED");
  return reason;
}

async function updateCityRollout(cityId, input, auth, { rolloutModel = CityRolloutState, reviewModel = CityActivationReview, incidentModel = CityOperationalIncident, userModel, now = new Date() } = {}) {
  const city = registeredCity(cityId);
  const mode = String(input.mode || "").trim().toLowerCase();
  if (!MODES.has(mode)) throw rolloutError("Choose a valid city rollout mode.", 400, "ROLLOUT_MODE_INVALID");
  const pilotPercentage = Math.round(Number(input.pilotPercentage || 10));
  const dailyComplaintLimit = Math.round(Number(input.dailyComplaintLimit || 0));
  if (pilotPercentage < 1 || pilotPercentage > 100) throw rolloutError("Pilot percentage must be between 1 and 100.", 400, "ROLLOUT_PERCENT_INVALID");
  if (dailyComplaintLimit < 0 || dailyComplaintLimit > 100000) throw rolloutError("Daily complaint limit must be between 0 and 100000.", 400, "ROLLOUT_LIMIT_INVALID");
  const reason = cleanReason(input.reason);
  let state = await rolloutModel.findOne({ cityId: city.slug });
  const previousMode = state?.mode || virtualRollout(city.slug).mode;

  if (previousMode === "paused" && mode !== "paused") {
    const openIncident = await incidentModel.findOne({ cityId: city.slug, status: "open" });
    if (openIncident) {
      throw rolloutError("Acknowledge the active operational incident before resuming city intake.", 409, "CITY_INCIDENT_ACK_REQUIRED");
    }
  }

  let review = null;
  if (city.slug !== DEFAULT_CITY_ID && ["pilot", "open"].includes(mode)) {
    review = await reviewModel.findOne({ cityId: city.slug });
    const readiness = review ? await buildCityActivationReadiness(city.slug, review, userModel ? { userModel } : {}) : null;
    if (!review || readiness.status !== "approved") throw rolloutError("Approve current city activation readiness before opening intake.", 409, "CITY_ACTIVATION_NOT_APPROVED");
    const priorActiveMode = previousMode === "paused" ? state?.previousActiveMode : previousMode;
    if (mode === "open" && !["pilot", "open"].includes(priorActiveMode)) {
      throw rolloutError("A new city must operate in pilot mode before open rollout.", 409, "CITY_PILOT_REQUIRED");
    }
    if (mode === "open" && priorActiveMode !== "open") {
      const pilotStartedAt = new Date(state?.pilotStartedAt || 0).getTime();
      if (!Number.isFinite(pilotStartedAt) || now.getTime() - pilotStartedAt < MIN_PILOT_HOURS * 60 * 60 * 1000) {
        throw rolloutError(`Pilot mode must run for at least ${MIN_PILOT_HOURS} hours before open rollout.`, 409, "CITY_PILOT_OBSERVATION_REQUIRED");
      }
    }
  }

  if (!state) state = new rolloutModel({ cityId: city.slug, cityName: city.name, configurationHash: activationConfigurationHash(city.slug) });
  if (mode === "paused" && previousMode !== "paused") state.previousActiveMode = previousMode;
  if (mode === "pilot" && !state.pilotStartedAt) state.pilotStartedAt = now;
  state.mode = mode;
  state.pilotPercentage = pilotPercentage;
  state.dailyComplaintLimit = dailyComplaintLimit;
  state.configurationHash = activationConfigurationHash(city.slug);
  state.activationReviewId = review?._id || state.activationReviewId || null;
  state.pauseReason = mode === "paused" ? reason : "";
  state.pausedAt = mode === "paused" ? now : null;
  state.changedByRole = String(auth.role || "Admin").slice(0, 40);
  state.changedByUserId = String(auth.userId || "").slice(0, 80);
  state.history.push({ fromMode: previousMode, toMode: mode, reason, changedByRole: state.changedByRole, changedByUserId: state.changedByUserId, changedAt: now });
  await state.save();
  if (previousMode === "paused" && mode !== "paused") {
    await incidentModel.updateMany(
      { cityId: city.slug, status: "acknowledged" },
      {
        $set: { status: "resolved", resolvedAt: now, resolvedByRole: state.changedByRole },
        $unset: { activeKey: "" },
        $push: { timeline: { event: "City intake resumed", note: reason, byRole: state.changedByRole, at: now } }
      }
    );
  }
  return state;
}

async function assertEnabledCityRolloutsReady({ rolloutModel = CityRolloutState } = {}) {
  for (const city of cityRegistry.cities.filter((item) => item.reportingEnabled && item.slug !== DEFAULT_CITY_ID)) {
    const state = await rolloutModel.findOne({ cityId: city.slug });
    if (!state || !MODES.has(state.mode) || state.configurationHash !== activationConfigurationHash(city.slug)) {
      throw new Error(`${city.name} reporting is enabled without a current rollout state.`);
    }
  }
  return true;
}

module.exports = {
  MIN_PILOT_HOURS,
  assertCityIntakeAllowed,
  assertEnabledCityRolloutsReady,
  cohortBucket,
  getCityRollout,
  publicRolloutSnapshot,
  reserveDailyIntake,
  updateCityRollout,
  utcDateKey,
  virtualRollout
};
