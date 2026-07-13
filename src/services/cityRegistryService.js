const CityRegistry = require("../models/CityRegistry");
const cityRegistry = require("../../shared/cityRegistry.json");
const categories = require("../../shared/aiCategories.json");

const CATEGORY_IDS = categories.map((item) => item.id);
const CATEGORY_SET = new Set(CATEGORY_IDS);
const CITY_SLUG_PATTERN = /^[a-z][a-z0-9-]{1,49}$/;
const ROLLOUT_STATUSES = new Set(["active", "pilot", "planned", "disabled"]);
const DEFAULT_CITY = cityRegistry.cities.find((city) => city.slug === cityRegistry.defaultCityId);
const CITY_IDS = Object.freeze(cityRegistry.cities.map((city) => city.slug));

function cityError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.userMessage = message;
  return error;
}

function matchCityInput(value, registry = cityRegistry) {
  const normalized = String(value || "").replace(/[^a-z0-9\s-]/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalized) return null;
  return registry.cities.find((city) => {
    const terms = [city.slug, city.name, ...(city.aliases || [])].map((term) => String(term).toLowerCase());
    return terms.some((term) => normalized === term || normalized.includes(term));
  }) || null;
}

async function resolveReportingCity({ cityId, registryVersion } = {}, { model = CityRegistry } = {}) {
  const slug = String(cityId || "").trim().toLowerCase();
  if (!slug) throw cityError("Select a city before submitting the complaint.", 400, "CITY_REQUIRED");
  if (!CITY_IDS.includes(slug)) throw cityError("The selected city is not in the Urban Pulse registry.", 400, "CITY_UNKNOWN");
  if (!registryVersion) throw cityError("City registry version is required. Refresh the city list before submitting.", 400, "CITY_REGISTRY_VERSION_REQUIRED");
  if (String(registryVersion) !== cityRegistry.registryVersion) {
    throw cityError("City availability changed. Refresh the city list before submitting.", 409, "CITY_REGISTRY_STALE");
  }
  const city = await model.findOne({ slug }).lean();
  if (!city) throw cityError("City reporting is temporarily unavailable. Try again shortly.", 503, "CITY_REGISTRY_UNAVAILABLE");
  if (String(city.registryVersion || "") !== cityRegistry.registryVersion) {
    throw cityError("City availability is being updated. Try again shortly.", 503, "CITY_REGISTRY_UNAVAILABLE");
  }
  if (!city.reportingEnabled || city.rolloutStatus !== "active") {
    throw cityError(`${city.name} reporting is not open yet. Choose an available city.`, 409, "CITY_REPORTING_UNAVAILABLE");
  }
  return city;
}

function validateRegistry(registry = cityRegistry) {
  const errors = [];
  const cities = Array.isArray(registry.cities) ? registry.cities : [];
  const slugs = new Set();
  if (!registry.registryVersion) errors.push("Registry version is required.");
  if (registry.defaultCityId !== "bengaluru") errors.push("Phase 1 default city must remain Bengaluru.");
  if (cities.length < 5) errors.push("At least five cities must be defined.");
  cities.forEach((city, index) => {
    const prefix = `cities[${index}]`;
    if (!CITY_SLUG_PATTERN.test(String(city.slug || ""))) errors.push(`${prefix}.slug is invalid.`);
    if (slugs.has(city.slug)) errors.push(`${prefix}.slug is duplicated.`);
    slugs.add(city.slug);
    if (!city.name || !city.state || city.countryCode !== "IN" || !city.timezone || !city.defaultAuthority) errors.push(`${prefix} is missing identity or authority metadata.`);
    if (!ROLLOUT_STATUSES.has(city.rolloutStatus)) errors.push(`${prefix}.rolloutStatus is invalid.`);
    if (city.reportingEnabled && city.rolloutStatus !== "active") errors.push(`${prefix} must be active when reporting is enabled.`);
    if (!city.officialChannels?.sourceUrl || !city.officialChannels?.verifiedAt) errors.push(`${prefix} is missing official-channel provenance.`);
    if (!/^https:\/\//.test(String(city.officialChannels?.sourceUrl || "")) || !/^https:\/\//.test(String(city.officialChannels?.portalUrl || ""))) errors.push(`${prefix} official URLs must use HTTPS.`);
    if (Number.isNaN(Date.parse(city.officialChannels?.verifiedAt))) errors.push(`${prefix}.officialChannels.verifiedAt is invalid.`);
    if (city.officialChannels?.supportsDirectApi) errors.push(`${prefix} cannot claim direct API support without a separately approved adapter.`);
    const envelope = city.locationEnvelope || {};
    if (!(Number(envelope.south) < Number(envelope.north)) || !(Number(envelope.west) < Number(envelope.east))) {
      errors.push(`${prefix}.locationEnvelope is invalid.`);
    }
    const center = city.center || {};
    if (!Number.isFinite(Number(center.lat)) || !Number.isFinite(Number(center.lng)) || Number(center.lat) < Number(envelope.south) || Number(center.lat) > Number(envelope.north) || Number(center.lng) < Number(envelope.west) || Number(center.lng) > Number(envelope.east)) {
      errors.push(`${prefix}.center must be inside its location envelope.`);
    }
    (city.supportedCategoryIds || CATEGORY_IDS).forEach((categoryId) => {
      if (!CATEGORY_SET.has(categoryId)) errors.push(`${prefix} contains unknown category ${categoryId}.`);
    });
  });
  if (!slugs.has(registry.defaultCityId)) errors.push("Default city is not present in the registry.");
  const enabled = cities.filter((city) => city.reportingEnabled);
  if (enabled.length !== 1 || enabled[0]?.slug !== registry.defaultCityId) {
    errors.push("The current rollout requires only the default Bengaluru jurisdiction to accept reporting.");
  }
  return errors;
}

function registryDocuments(registry = cityRegistry) {
  const errors = validateRegistry(registry);
  if (errors.length) throw new Error(`Invalid city registry: ${errors.join(" ")}`);
  return registry.cities.map((city) => ({
    ...city,
    registryVersion: registry.registryVersion,
    aliases: [...new Set((city.aliases || []).map((alias) => String(alias).trim().toLowerCase()).filter(Boolean))],
    supportedCategoryIds: [...new Set(city.supportedCategoryIds || CATEGORY_IDS)],
    officialChannels: { ...city.officialChannels, verifiedAt: new Date(city.officialChannels.verifiedAt) }
  }));
}

async function syncCityRegistry({ model = CityRegistry } = {}) {
  const documents = registryDocuments();
  const operations = documents.map((document) => ({
    updateOne: {
      filter: { slug: document.slug },
      update: { $set: document },
      upsert: true
    }
  }));
  const result = await model.bulkWrite(operations, { ordered: true });
  return {
    registryVersion: cityRegistry.registryVersion,
    cities: documents.length,
    upserted: Number(result.upsertedCount || 0),
    modified: Number(result.modifiedCount || 0)
  };
}

function publicCity(city) {
  return {
    id: city.slug,
    name: city.name,
    state: city.state,
    countryCode: city.countryCode,
    timezone: city.timezone,
    rolloutStatus: city.rolloutStatus,
    reportingEnabled: Boolean(city.reportingEnabled),
    defaultAuthority: city.defaultAuthority,
    center: city.center,
    officialChannels: {
      portalUrl: city.officialChannels?.portalUrl || "",
      helpline: city.officialChannels?.helpline || "",
      mobileApp: city.officialChannels?.mobileApp || "",
      supportsDirectApi: Boolean(city.officialChannels?.supportsDirectApi),
      verifiedAt: city.officialChannels?.verifiedAt || null
    }
  };
}

module.exports = {
  CITY_IDS,
  DEFAULT_CITY_ID: cityRegistry.defaultCityId,
  DEFAULT_CITY_NAME: DEFAULT_CITY.name,
  REGISTRY_VERSION: cityRegistry.registryVersion,
  matchCityInput,
  publicCity,
  registryDocuments,
  resolveReportingCity,
  syncCityRegistry,
  validateRegistry
};
