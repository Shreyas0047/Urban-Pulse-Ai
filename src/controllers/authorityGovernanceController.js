const { buildAuthorityGovernance } = require("../services/authoritySlaService");
const { registeredCity } = require("../services/cityActivationService");

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

async function getAuthorityGovernance(req, res, next) {
  try {
    const city = requireAssignedCity(req);
    const governance = await buildAuthorityGovernance(city.slug);
    res.json({ authorityGovernance: governance });
  } catch (error) {
    next(error);
  }
}

async function evaluateAuthorityGovernance(req, res, next) {
  try {
    const city = requireAssignedCity(req);
    const governance = await buildAuthorityGovernance(city.slug);
    res.json({
      message: `${city.name} authority SLA evaluation completed.`,
      authorityGovernance: governance
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { evaluateAuthorityGovernance, getAuthorityGovernance };
