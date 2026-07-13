const DepartmentUnit = require("../models/DepartmentUnit");
const routingRegistry = require("../../shared/cityRoutingRegistry.json");
const cityRegistry = require("../../shared/cityRegistry.json");
const categories = require("../../shared/aiCategories.json");

const CATEGORY_IDS = categories.map((category) => category.id);
const CATEGORY_SET = new Set(CATEGORY_IDS);
const CITY_BY_ID = new Map(cityRegistry.cities.map((city) => [city.slug, city]));
const UNIT_KEY_PATTERN = /^[a-z][a-z0-9-]{2,59}$/;

function validateRoutingRegistry(registry = routingRegistry) {
  const errors = [];
  const templates = Array.isArray(registry.unitTemplates) ? registry.unitTemplates : [];
  const profiles = Array.isArray(registry.profiles) ? registry.profiles : [];
  const templateKeys = new Set();
  const coveredCategories = new Map(CATEGORY_IDS.map((id) => [id, 0]));
  const profileIds = new Set();

  if (!registry.routingRegistryVersion) errors.push("Routing registry version is required.");
  if (!templates.length) errors.push("At least one routing unit template is required.");
  templates.forEach((template, index) => {
    const prefix = `unitTemplates[${index}]`;
    if (!UNIT_KEY_PATTERN.test(String(template.key || ""))) errors.push(`${prefix}.key is invalid.`);
    if (templateKeys.has(template.key)) errors.push(`${prefix}.key is duplicated.`);
    templateKeys.add(template.key);
    if (!template.department || !template.unitName) errors.push(`${prefix} is missing ownership labels.`);
    if (!Number.isInteger(template.maxActiveCases) || template.maxActiveCases < 1) errors.push(`${prefix}.maxActiveCases is invalid.`);
    if (!Array.isArray(template.severityLevels) || !["Low", "Medium", "High", "Critical"].every((level) => template.severityLevels.includes(level))) {
      errors.push(`${prefix} must support every severity level.`);
    }
    (template.handlesCategoryIds || []).forEach((categoryId) => {
      if (!CATEGORY_SET.has(categoryId)) errors.push(`${prefix} contains unknown category ${categoryId}.`);
      else coveredCategories.set(categoryId, coveredCategories.get(categoryId) + 1);
    });
  });
  for (const [categoryId, count] of coveredCategories) {
    if (count !== 1) errors.push(`Category ${categoryId} must have exactly one primary ownership template; found ${count}.`);
  }

  profiles.forEach((profile, index) => {
    const prefix = `profiles[${index}]`;
    const city = CITY_BY_ID.get(profile.cityId);
    if (!city) errors.push(`${prefix}.cityId is not in the city registry.`);
    if (profileIds.has(profile.cityId)) errors.push(`${prefix}.cityId is duplicated.`);
    profileIds.add(profile.cityId);
    if (city && profile.authority !== city.defaultAuthority) errors.push(`${prefix}.authority must match the city registry.`);
    if (profile.handoff?.mode !== "manual_portal") errors.push(`${prefix}.handoff.mode must remain manual_portal in Phase 3.`);
    if (profile.handoff?.supportsDirectApi) errors.push(`${prefix} cannot claim direct API support.`);
    if (!/^https:\/\//.test(String(profile.handoff?.portalUrl || "")) || !/^https:\/\//.test(String(profile.handoff?.sourceUrl || ""))) {
      errors.push(`${prefix} handoff URLs must use HTTPS.`);
    }
    if (Number.isNaN(Date.parse(profile.handoff?.verifiedAt))) errors.push(`${prefix}.handoff.verifiedAt is invalid.`);
    if (city && profile.handoff?.portalUrl !== city.officialChannels?.portalUrl) errors.push(`${prefix}.handoff.portalUrl must match the city registry.`);
  });
  const expectedCities = [...CITY_BY_ID.keys()].sort();
  const actualCities = [...profileIds].sort();
  if (JSON.stringify(actualCities) !== JSON.stringify(expectedCities)) errors.push("Routing profiles must cover every registered city exactly once.");
  return errors;
}

function routingDocuments(registry = routingRegistry) {
  const errors = validateRoutingRegistry(registry);
  if (errors.length) throw new Error(`Invalid city routing registry: ${errors.join(" ")}`);
  return registry.profiles.flatMap((profile) => {
    const city = CITY_BY_ID.get(profile.cityId);
    return registry.unitTemplates.map((template) => ({
      unitId: `${profile.cityId}-${template.key}`,
      cityId: profile.cityId,
      cityName: city.name,
      routingRegistryVersion: registry.routingRegistryVersion,
      authority: profile.authority,
      department: template.department,
      unitName: `${city.name} ${template.unitName}`,
      ward: "Citywide",
      coverageKeywords: template.coverageKeywords,
      handlesCategoryIds: template.handlesCategoryIds,
      severityLevels: template.severityLevels,
      contactEmail: "",
      portalUrl: profile.handoff.portalUrl,
      handoffMode: profile.handoff.mode,
      supportsDirectApi: false,
      handoffSourceUrl: profile.handoff.sourceUrl,
      handoffVerifiedAt: new Date(profile.handoff.verifiedAt),
      maxActiveCases: template.maxActiveCases,
      active: true
    }));
  });
}

function routingUnitsForCity(cityId, registry = routingRegistry) {
  return routingDocuments(registry).filter((unit) => unit.cityId === String(cityId || "").trim().toLowerCase());
}

function publicRoutingUnit(unit) {
  return {
    unitId: unit.unitId,
    cityId: unit.cityId,
    authority: unit.authority,
    department: unit.department,
    unitName: unit.unitName,
    handlesCategoryIds: unit.handlesCategoryIds,
    handoff: {
      mode: unit.handoffMode,
      portalUrl: unit.portalUrl,
      supportsDirectApi: Boolean(unit.supportsDirectApi),
      verifiedAt: unit.handoffVerifiedAt || null
    }
  };
}

async function syncRoutingRegistry({ model = DepartmentUnit } = {}) {
  const documents = routingDocuments();
  const operations = documents.map((document) => ({
    updateOne: {
      filter: { unitId: document.unitId },
      update: { $set: document },
      upsert: true
    }
  }));
  const result = await model.bulkWrite(operations, { ordered: true });
  const canonicalUnitIds = documents.map((document) => document.unitId);
  const staleResult = typeof model.updateMany === "function"
    ? await model.updateMany({ unitId: { $nin: canonicalUnitIds }, active: true }, { $set: { active: false } })
    : { modifiedCount: 0 };
  return {
    routingRegistryVersion: routingRegistry.routingRegistryVersion,
    cities: routingRegistry.profiles.length,
    units: documents.length,
    upserted: Number(result.upsertedCount || 0),
    modified: Number(result.modifiedCount || 0),
    deactivatedStaleUnits: Number(staleResult.modifiedCount || 0)
  };
}

module.exports = {
  ROUTING_REGISTRY_VERSION: routingRegistry.routingRegistryVersion,
  publicRoutingUnit,
  routingDocuments,
  routingUnitsForCity,
  syncRoutingRegistry,
  validateRoutingRegistry
};
