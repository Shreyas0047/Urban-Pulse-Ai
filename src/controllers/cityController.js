const CityRegistry = require("../models/CityRegistry");
const { CITY_IDS, DEFAULT_CITY_ID, REGISTRY_VERSION, publicCity } = require("../services/cityRegistryService");
const { ROUTING_REGISTRY_VERSION, publicRoutingUnit, routingUnitsForCity } = require("../services/routingRegistryService");

async function getCities(_req, res, next) {
  try {
    const cities = await CityRegistry.find({ slug: { $in: CITY_IDS }, registryVersion: REGISTRY_VERSION }).sort({ reportingEnabled: -1, name: 1 }).lean();
    res.json({
      registryVersion: REGISTRY_VERSION,
      defaultCityId: DEFAULT_CITY_ID,
      cities: cities.map(publicCity)
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
    res.json({ registryVersion: REGISTRY_VERSION, city: publicCity(city) });
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

module.exports = { getCities, getCity, getCityRoutingUnits };
