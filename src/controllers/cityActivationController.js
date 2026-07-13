const CityActivationReview = require("../models/CityActivationReview");
const {
  approveCityActivation,
  buildCityActivationReadiness,
  recordActivationEvidence,
  registeredCity
} = require("../services/cityActivationService");

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

async function getActivationReadiness(req, res, next) {
  try {
    const city = requireAssignedCity(req);
    const review = await CityActivationReview.findOne({ cityId: city.slug });
    const readiness = await buildCityActivationReadiness(city.slug, review);
    res.json({ readiness });
  } catch (error) {
    next(error);
  }
}

async function updateActivationEvidence(req, res, next) {
  try {
    requireAssignedCity(req);
    const { readiness } = await recordActivationEvidence(req.params.slug, req.body || {}, req.auth);
    res.json({
      message: readiness.status === "ready"
        ? "Operational evidence saved. This city is ready for activation approval."
        : "Operational evidence saved. Remaining readiness checks are still blocking activation.",
      readiness
    });
  } catch (error) {
    next(error);
  }
}

async function approveActivation(req, res, next) {
  try {
    requireAssignedCity(req);
    const { readiness } = await approveCityActivation(req.params.slug, req.auth);
    res.json({ message: `${readiness.city.name} activation readiness approved.`, readiness });
  } catch (error) {
    next(error);
  }
}

module.exports = { approveActivation, getActivationReadiness, updateActivationEvidence };
