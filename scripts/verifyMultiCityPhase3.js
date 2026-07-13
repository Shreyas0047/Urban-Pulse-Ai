const assert = require("assert");
const fs = require("fs");
const path = require("path");
const DepartmentUnit = require("../src/models/DepartmentUnit");
const CityRegistry = require("../src/models/CityRegistry");
const env = require("../src/config/env");
const categories = require("../shared/aiCategories.json");
const routingRegistry = require("../shared/cityRoutingRegistry.json");
const { getCityRoutingUnits } = require("../src/controllers/cityController");
const { authorityEmailDestination } = require("../src/controllers/emailController");
const { routeComplaint } = require("../src/services/routingService");
const {
  ROUTING_REGISTRY_VERSION,
  publicRoutingUnit,
  routingDocuments,
  routingUnitsForCity,
  syncRoutingRegistry,
  validateRoutingRegistry
} = require("../src/services/routingRegistryService");
const { registryDocuments } = require("../src/services/cityRegistryService");

function modelFor(units, capture = {}) {
  return {
    find(query) {
      capture.query = query;
      return { lean() { return Promise.resolve(units); } };
    }
  };
}

function analysis(categoryId, priority = "High") {
  return {
    aiMeta: { categoryId },
    priority: { level: priority },
    nlp: { issueType: categories.find((category) => category.id === categoryId)?.label || "Civic issue" },
    assignedAuthority: ""
  };
}

async function main() {
  assert.deepEqual(validateRoutingRegistry(), []);
  assert.equal(ROUTING_REGISTRY_VERSION, "1.0.0");
  assert.equal(routingRegistry.profiles.length, 5);
  assert.equal(routingRegistry.unitTemplates.length, 5);
  const documents = routingDocuments();
  assert.equal(documents.length, 25);
  assert.ok(documents.every((unit) => unit.handoffMode === "manual_portal" && unit.supportsDirectApi === false));
  assert.equal(new Set(documents.map((unit) => unit.unitId)).size, 25);

  for (const city of registryDocuments()) {
    const units = routingUnitsForCity(city.slug);
    assert.equal(units.length, 5);
    const ownership = new Map(categories.map((category) => [category.id, 0]));
    units.forEach((unit) => unit.handlesCategoryIds.forEach((categoryId) => ownership.set(categoryId, ownership.get(categoryId) + 1)));
    assert.ok([...ownership.values()].every((count) => count === 1));
    assert.ok(units.every((unit) => unit.authority === city.defaultAuthority));
    assert.ok(units.every((unit) => unit.portalUrl === city.officialChannels.portalUrl));
  }

  const badRegistry = JSON.parse(JSON.stringify(routingRegistry));
  badRegistry.profiles[0].handoff.supportsDirectApi = true;
  badRegistry.profiles[1].authority = "Wrong authority";
  badRegistry.unitTemplates[0].handlesCategoryIds = badRegistry.unitTemplates[0].handlesCategoryIds.filter((id) => id !== "security");
  const errors = validateRoutingRegistry(badRegistry);
  assert.ok(errors.some((error) => error.includes("direct API")));
  assert.ok(errors.some((error) => error.includes("must match the city registry")));
  assert.ok(errors.some((error) => error.includes("Category security")));

  documents.forEach((document) => assert.ifError(new DepartmentUnit(document).validateSync()));
  let operations = [];
  let staleFilter;
  const synced = await syncRoutingRegistry({ model: {
    async bulkWrite(received) { operations = received; return { upsertedCount: 25, modifiedCount: 0 }; },
    async updateMany(filter) { staleFilter = filter; return { modifiedCount: 7 }; }
  } });
  assert.equal(synced.units, 25);
  assert.equal(operations.length, 25);
  assert.ok(operations.every((operation) => operation.updateOne.upsert));
  assert.equal(staleFilter.unitId.$nin.length, 25);
  assert.equal(synced.deactivatedStaleUnits, 7);

  const mumbaiCity = registryDocuments().find((city) => city.slug === "mumbai");
  const mumbaiUnits = routingUnitsForCity("mumbai");
  const capture = {};
  const routed = await routeComplaint({
    analysis: analysis("road_damage", "High"),
    city: mumbaiCity,
    location: "Ward 22 main road",
    mapLocation: mumbaiCity.center,
    activeComplaints: [{ cityId: "bengaluru", status: "In Progress", routing: { department: "Roads, Structures and Obstructions" } }],
    unitModel: modelFor(mumbaiUnits, capture)
  });
  assert.equal(capture.query.cityId, "mumbai");
  assert.equal(routed.cityId, "mumbai");
  assert.equal(routed.authority, "Brihanmumbai Municipal Corporation");
  assert.equal(routed.department, "Roads, Structures and Obstructions");
  assert.equal(routed.activeCaseLoad, 0);
  assert.equal(routed.handoff.mode, "manual_portal");
  assert.equal(routed.handoff.supportsDirectApi, false);
  assert.ok(routed.alternatives.every((unit) => unit.cityId === "mumbai"));
  await assert.rejects(() => routeComplaint({ analysis: analysis("garbage"), location: "Market" }), /City identity is required/);

  const fallback = await routeComplaint({
    analysis: analysis("water_leakage", "Medium"),
    city: mumbaiCity,
    location: "Market pipe burst",
    mapLocation: mumbaiCity.center,
    unitModel: modelFor(mumbaiUnits.slice(0, 1))
  });
  assert.equal(fallback.department, "Water, Drainage and Sewerage");

  const publicUnit = publicRoutingUnit(mumbaiUnits[0]);
  assert.equal(publicUnit.handoff.supportsDirectApi, false);
  assert.equal(publicUnit.handoff.sourceUrl, undefined);
  assert.equal(publicUnit.contactEmail, undefined);

  const originalFindOne = CityRegistry.findOne;
  try {
    CityRegistry.findOne = ({ slug }) => ({ async lean() { return registryDocuments().find((city) => city.slug === slug); } });
    let payload;
    await getCityRoutingUnits({ params: { slug: "MUMBAI" } }, { json(value) { payload = value; } }, (error) => { throw error; });
    assert.equal(payload.city.id, "mumbai");
    assert.equal(payload.units.length, 5);
    assert.equal(payload.handoffPolicy, "manual_portal");
  } finally {
    CityRegistry.findOne = originalFindOne;
  }

  const previousEmail = env.bbmpEmailTo;
  env.bbmpEmailTo = "bbmp@example.gov";
  try {
    assert.equal(authorityEmailDestination({ cityId: "bengaluru", routing: {} }), "bbmp@example.gov");
    assert.throws(() => authorityEmailDestination({ cityId: "mumbai", routing: { handoff: { mode: "manual_portal" } } }), (error) => error.code === "CITY_AUTHORITY_EMAIL_UNAVAILABLE");
    assert.equal(authorityEmailDestination({ cityId: "mumbai", routing: { contactEmail: "verified@mumbai.gov.in", handoff: { mode: "verified_email" } } }), "verified@mumbai.gov.in");
  } finally {
    env.bbmpEmailTo = previousEmail;
  }

  const browser = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
  assert.match(browser, /apiRequest\("\/api\/email-authority"/);
  assert.match(browser, /Open official complaint portal/);
  assert.match(browser, /Official portal \(manual submission\)/);

  console.log(JSON.stringify({
    passed: true,
    citiesCovered: 5,
    unitsValidated: 25,
    categoriesOwnedPerCity: 12,
    cityIsolationValidated: true,
    manualHandoffTruthful: true,
    crossCityEmailBlocked: true,
    publicOwnershipDiscoveryValidated: true
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
