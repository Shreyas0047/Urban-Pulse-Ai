const mongoose = require("mongoose");
const { connectDatabase } = require("../src/config/db");
const CityRegistry = require("../src/models/CityRegistry");
const Complaint = require("../src/models/Complaint");
const { DEFAULT_CITY_ID, DEFAULT_CITY_NAME, REGISTRY_VERSION } = require("../src/services/cityRegistryService");

const MIGRATION_ID = "multi-city-phase-1-bengaluru-v1";

function legacyCityFilter() {
  return {
    $or: [
      { cityId: { $exists: false } },
      { cityId: null },
      { cityId: "" }
    ]
  };
}

function legacyCityUpdate(at = new Date()) {
  return {
    $set: {
      cityId: DEFAULT_CITY_ID,
      cityName: DEFAULT_CITY_NAME,
      citySource: "legacy_migration",
      cityRegistryVersion: REGISTRY_VERSION,
      cityAssignedAt: at
    }
  };
}

async function migrationReport({ apply = false, complaintModel = Complaint, cityModel = CityRegistry, at = new Date() } = {}) {
  const bengaluru = await cityModel.findOne({ slug: DEFAULT_CITY_ID, reportingEnabled: true }).lean();
  if (!bengaluru) throw new Error("The active Bengaluru city registry entry is missing. Synchronize the registry first.");
  const validCityIds = await cityModel.distinct("slug");
  const [totalComplaints, legacyComplaints, invalidCityComplaints] = await Promise.all([
    complaintModel.countDocuments({}),
    complaintModel.countDocuments(legacyCityFilter()),
    complaintModel.countDocuments({ cityId: { $exists: true, $nin: ["", null, ...validCityIds] } })
  ]);
  let modifiedComplaints = 0;
  const blocked = apply && invalidCityComplaints > 0;
  if (apply && !blocked && legacyComplaints) {
    const result = await complaintModel.updateMany(legacyCityFilter(), legacyCityUpdate(at), { runValidators: true });
    modifiedComplaints = Number(result.modifiedCount || 0);
  }
  return {
    migrationId: MIGRATION_ID,
    mode: blocked ? "apply_blocked" : apply ? "apply" : "dry_run",
    registryVersion: REGISTRY_VERSION,
    defaultCityId: DEFAULT_CITY_ID,
    totalComplaints,
    legacyComplaints,
    invalidCityComplaints,
    modifiedComplaints,
    safeToApply: invalidCityComplaints === 0,
    note: blocked
      ? "Migration was blocked because complaints with unknown city IDs require manual review. No records were changed."
      : apply
      ? "Only complaints without a city identity were assigned to Bengaluru. Existing city values were preserved."
      : "No complaints were changed. Re-run with --apply after reviewing this report."
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  await connectDatabase();
  try {
    const report = await migrationReport({ apply });
    console.log(JSON.stringify(report, null, 2));
    if (report.invalidCityComplaints) process.exitCode = 2;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { MIGRATION_ID, legacyCityFilter, legacyCityUpdate, migrationReport };
