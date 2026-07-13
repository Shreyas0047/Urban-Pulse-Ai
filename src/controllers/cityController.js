const CityRegistry = require("../models/CityRegistry");
const { CITY_IDS, DEFAULT_CITY_ID, REGISTRY_VERSION, publicCity } = require("../services/cityRegistryService");
const { ROUTING_REGISTRY_VERSION, publicRoutingUnit, routingUnitsForCity } = require("../services/routingRegistryService");
const CityRolloutState = require("../models/CityRolloutState");
const { publicRolloutSnapshot, virtualRollout } = require("../services/cityRolloutService");

function withRollout(city, rolloutByCity) {
  const rollout = rolloutByCity.get(city.slug) || virtualRollout(city.slug);
  return { ...publicCity(city), rollout: publicRolloutSnapshot(rollout) };
}

async function getCities(_req, res, next) {
  try {
    const cities = await CityRegistry.find({ slug: { $in: CITY_IDS }, registryVersion: REGISTRY_VERSION }).sort({ reportingEnabled: -1, name: 1 }).lean();
    const rolloutStates = await CityRolloutState.find({ cityId: { $in: cities.map((city) => city.slug) } }).lean();
    const rolloutByCity = new Map(rolloutStates.map((state) => [state.cityId, state]));
    res.json({
      registryVersion: REGISTRY_VERSION,
      defaultCityId: DEFAULT_CITY_ID,
      cities: cities.map((city) => withRollout(city, rolloutByCity))
    });
  } catch (error) {
    next(error);
  }
}

async function getCity(req, res, next) {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    const city = CITY_IDS.includes(slug) ? await CityRegistry.findOne({ slug, registryVersion: REGISTRY_VERSION }).lean() : null;
    if (!city) {
      const error = new Error("City is not available in the Urban Pulse registry.");
      error.statusCode = 404;
      throw error;
    }
    const rollout = await CityRolloutState.findOne({ cityId: city.slug }).lean();
    res.json({ registryVersion: REGISTRY_VERSION, city: withRollout(city, new Map([[city.slug, rollout || virtualRollout(city.slug)]])) });
  } catch (error) {
    next(error);
  }
}

async function getCityRoutingUnits(req, res, next) {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    const city = CITY_IDS.includes(slug) ? await CityRegistry.findOne({ slug, registryVersion: REGISTRY_VERSION }).lean() : null;
    if (!city) {
      const error = new Error("City is not available in the Urban Pulse registry.");
      error.statusCode = 404;
      throw error;
    }
    res.json({
      routingRegistryVersion: ROUTING_REGISTRY_VERSION,
      city: publicCity(city),
      handoffPolicy: "manual_portal",
      units: routingUnitsForCity(slug).map(publicRoutingUnit)
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getCities, getCity, getCityRoutingUnits, withRollout };
