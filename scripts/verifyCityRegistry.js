const assert = require("assert");
const CityRegistry = require("../src/models/CityRegistry");
const Complaint = require("../src/models/Complaint");
const CityRolloutState = require("../src/models/CityRolloutState");
const registry = require("../shared/cityRegistry.json");
const {
  DEFAULT_CITY_ID,
  DEFAULT_CITY_NAME,
  REGISTRY_VERSION,
  publicCity,
  registryDocuments,
  syncCityRegistry,
  validateRegistry
} = require("../src/services/cityRegistryService");
const { legacyCityFilter, legacyCityUpdate, migrationReport } = require("./migrateComplaintCities");
const { getCities, getCity } = require("../src/controllers/cityController");

async function main() {
  assert.deepEqual(validateRegistry(), []);
  assert.equal(registry.cities.length, 5);
  assert.equal(DEFAULT_CITY_ID, "bengaluru");
  assert.equal(DEFAULT_CITY_NAME, "Bengaluru");
  assert.equal(REGISTRY_VERSION, "1.0.0");
  assert.deepEqual(registry.cities.filter((city) => city.reportingEnabled).map((city) => city.slug), ["bengaluru"]);
  assert.ok(registry.cities.every((city) => city.officialChannels.supportsDirectApi === false));
  assert.ok(registry.cities.every((city) => city.locationEnvelope.quality === "approximate"));

  const badRegistry = JSON.parse(JSON.stringify(registry));
  badRegistry.cities[1].slug = "bengaluru";
  badRegistry.cities[1].officialChannels.supportsDirectApi = true;
  const errors = validateRegistry(badRegistry);
  assert.ok(errors.some((error) => error.includes("duplicated")));
  assert.ok(errors.some((error) => error.includes("direct API")));

  const wrongDefaultRegistry = JSON.parse(JSON.stringify(registry));
  wrongDefaultRegistry.defaultCityId = "mumbai";
  wrongDefaultRegistry.cities[0].reportingEnabled = false;
  wrongDefaultRegistry.cities[0].rolloutStatus = "planned";
  wrongDefaultRegistry.cities[1].reportingEnabled = true;
  wrongDefaultRegistry.cities[1].rolloutStatus = "active";
  assert.ok(validateRegistry(wrongDefaultRegistry).some((error) => error.includes("must remain Bengaluru")));

  const documents = registryDocuments();
  assert.equal(documents.length, 5);
  assert.ok(documents.every((city) => city.supportedCategoryIds.length === 12));
  assert.ok(documents.every((city) => city.officialChannels.verifiedAt instanceof Date));

  const sanitized = publicCity(documents[0]);
  assert.equal(sanitized.id, "bengaluru");
  assert.equal(sanitized.reportingEnabled, true);
  assert.equal(sanitized.locationEnvelope, undefined);
  assert.equal(sanitized.officialChannels.sourceUrl, undefined);
  assert.equal(sanitized.supportedCategoryIds, undefined);

  let operations;
  const syncResult = await syncCityRegistry({
    model: {
      async bulkWrite(received) {
        operations = received;
        return { upsertedCount: 5, modifiedCount: 0 };
      }
    }
  });
  assert.equal(syncResult.cities, 5);
  assert.equal(operations.length, 5);
  assert.ok(operations.every((operation) => operation.updateOne.upsert === true));
  assert.deepEqual(operations.map((operation) => operation.updateOne.filter.slug), ["bengaluru", "mumbai", "delhi", "chennai", "hyderabad"]);

  for (const document of documents) {
    const model = new CityRegistry(document);
    assert.ifError(model.validateSync());
  }
  const complaint = new Complaint({
    reporter: "Citizen",
    reporterUsername: "citizen@example.com",
    type: "Road Damage",
    priority: "Medium",
    status: "Queued",
    source: "Test",
    confidence: 80,
    location: "Bengaluru",
    description: "A pothole is visible."
  });
  assert.ifError(complaint.validateSync());
  assert.equal(complaint.cityId, "bengaluru");
  assert.equal(complaint.cityName, "Bengaluru");
  assert.equal(complaint.citySource, "system_default");

  const filter = legacyCityFilter();
  assert.equal(filter.$or.length, 3);
  const at = new Date("2026-07-13T12:00:00.000Z");
  const update = legacyCityUpdate(at);
  assert.equal(update.$set.cityId, "bengaluru");
  assert.equal(update.$set.citySource, "legacy_migration");
  assert.equal(update.$set.cityAssignedAt, at);

  const cityModel = {
    findOne() { return { async lean() { return { slug: "bengaluru", reportingEnabled: true }; } }; },
    async distinct() { return registry.cities.map((city) => city.slug); }
  };
  let updateCalls = 0;
  const safeComplaintModel = {
    async countDocuments(query) {
      if (!Object.keys(query).length) return 20;
      if (query.$or) return 7;
      return 0;
    },
    async updateMany(receivedFilter, receivedUpdate) {
      updateCalls += 1;
      assert.deepEqual(receivedFilter, filter);
      assert.equal(receivedUpdate.$set.cityId, "bengaluru");
      return { modifiedCount: 7 };
    }
  };
  const dryRun = await migrationReport({ complaintModel: safeComplaintModel, cityModel, at });
  assert.equal(dryRun.mode, "dry_run");
  assert.equal(dryRun.modifiedComplaints, 0);
  assert.equal(updateCalls, 0);
  const applied = await migrationReport({ apply: true, complaintModel: safeComplaintModel, cityModel, at });
  assert.equal(applied.mode, "apply");
  assert.equal(applied.modifiedComplaints, 7);
  assert.equal(updateCalls, 1);

  const invalidComplaintModel = {
    async countDocuments(query) {
      if (!Object.keys(query).length) return 20;
      if (query.$or) return 7;
      return 1;
    },
    async updateMany() { throw new Error("Blocked migration must not update records."); }
  };
  const blocked = await migrationReport({ apply: true, complaintModel: invalidComplaintModel, cityModel, at });
  assert.equal(blocked.mode, "apply_blocked");
  assert.equal(blocked.modifiedComplaints, 0);
  assert.equal(blocked.safeToApply, false);

  const originalFind = CityRegistry.find;
  const originalFindOne = CityRegistry.findOne;
  const originalRolloutFind = CityRolloutState.find;
  const originalRolloutFindOne = CityRolloutState.findOne;
  try {
    CityRegistry.find = () => ({ sort() { return this; }, async lean() { return documents; } });
    CityRegistry.findOne = ({ slug }) => ({ async lean() { return documents.find((city) => city.slug === slug) || null; } });
    CityRolloutState.find = () => ({ async lean() { return []; } });
    CityRolloutState.findOne = () => ({ async lean() { return null; } });
    let listPayload;
    await getCities({}, { json(value) { listPayload = value; } }, (error) => { throw error; });
    assert.equal(listPayload.cities.length, 5);
    assert.equal(listPayload.cities[0].id, "bengaluru");
    assert.equal(listPayload.cities.filter((city) => city.reportingEnabled).length, 1);
    let cityPayload;
    await getCity({ params: { slug: "CHENNAI" } }, { json(value) { cityPayload = value; } }, (error) => { throw error; });
    assert.equal(cityPayload.city.id, "chennai");
    assert.equal(cityPayload.city.reportingEnabled, false);
  } finally {
    CityRegistry.find = originalFind;
    CityRegistry.findOne = originalFindOne;
    CityRolloutState.find = originalRolloutFind;
    CityRolloutState.findOne = originalRolloutFindOne;
  }

  console.log(JSON.stringify({
    passed: true,
    citiesValidated: 5,
    onlyBengaluruActive: true,
    directApiClaimsRejected: true,
    publicRegistryRedacted: true,
    publicDiscoveryEndpointsValidated: true,
    idempotentUpsertsPrepared: true,
    complaintDefaultsValidated: true,
    dryRunPreservesData: true,
    unknownCityValuesBlockApply: true
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
