const CityDailyIntake = require("../models/CityDailyIntake");
const { registeredCity } = require("../services/cityActivationService");
const { activationConfigurationHash } = require("../services/cityActivationService");
const { getCityRollout, publicRolloutSnapshot, updateCityRollout, utcDateKey } = require("../services/cityRolloutService");

function requireAssignedCity(req) {
  const city = registeredCity(req.params.slug);
  const allowedCityIds = req.auth.operationalCityIds?.length ? req.auth.operationalCityIds : ["bengaluru"];
  if (!allowedCityIds.includes(city.slug)) {
    const error = new Error("This Admin account is not assigned to the selected operations city.");
    error.statusCode = 403;
    throw error;
  }
  return city;
}

function adminRolloutSnapshot(state) {
  return {
    ...publicRolloutSnapshot(state),
    cityId: state.cityId,
    cityName: state.cityName,
    previousActiveMode: state.previousActiveMode || "closed",
    pilotStartedAt: state.pilotStartedAt || null,
    configurationStale: state.configurationHash !== activationConfigurationHash(state.cityId),
    persisted: state.persisted !== false,
    history: (state.history || []).slice(-20).reverse().map((entry) => ({
      fromMode: entry.fromMode,
      toMode: entry.toMode,
      reason: entry.reason,
      changedByRole: entry.changedByRole,
      changedAt: entry.changedAt
    }))
  };
}

async function getRollout(req, res, next) {
  try {
    const city = requireAssignedCity(req);
    const state = await getCityRollout(city.slug);
    const usage = await CityDailyIntake.findOne({ key: `${city.slug}:${utcDateKey()}` }).lean();
    res.json({ rollout: { ...adminRolloutSnapshot(state), todayUsed: Number(usage?.count || 0) } });
  } catch (error) {
    next(error);
  }
}

async function updateRollout(req, res, next) {
  try {
    const city = requireAssignedCity(req);
    const state = await updateCityRollout(city.slug, req.body || {}, req.auth);
    res.json({
      message: state.mode === "paused" ? `${city.name} complaint intake paused immediately.` : `${city.name} rollout updated to ${state.mode}.`,
      rollout: adminRolloutSnapshot(state)
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getRollout, updateRollout };
