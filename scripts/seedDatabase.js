const { connectDatabase } = require("../src/config/db");
const Complaint = require("../src/models/Complaint");
const EmergencyBroadcast = require("../src/models/EmergencyBroadcast");
const IncidentCluster = require("../src/models/IncidentCluster");
const IncidentCommand = require("../src/models/IncidentCommand");
const DecisionAuditEvent = require("../src/models/DecisionAuditEvent");
const AuthorityTicket = require("../src/models/AuthorityTicket");
const CityActivationReview = require("../src/models/CityActivationReview");
const CityRolloutState = require("../src/models/CityRolloutState");
const CityDailyIntake = require("../src/models/CityDailyIntake");
const CityOperationalEvent = require("../src/models/CityOperationalEvent");
const CityOperationalIncident = require("../src/models/CityOperationalIncident");
const CityRegistry = require("../src/models/CityRegistry");
const DepartmentUnit = require("../src/models/DepartmentUnit");
const User = require("../src/models/User");
const { seedAll } = require("../src/services/seedService");
const { hashPassword } = require("../src/utils/auth");
const cityRegistry = require("../shared/cityRegistry.json");

async function run() {
  await connectDatabase();

  if (process.argv.includes("--fresh")) {
    if (cityRegistry.cities.some((city) => city.slug !== cityRegistry.defaultCityId && city.reportingEnabled)) {
      throw new Error("Fresh seeding is disabled while an additional city is active.");
    }
    await Promise.all([
      Complaint.deleteMany({}),
      EmergencyBroadcast.deleteMany({}),
      IncidentCluster.deleteMany({}),
      IncidentCommand.deleteMany({}),
      DecisionAuditEvent.collection.deleteMany({}),
      AuthorityTicket.deleteMany({}),
      CityActivationReview.deleteMany({}),
      CityRolloutState.deleteMany({}),
      CityDailyIntake.deleteMany({}),
      CityOperationalEvent.deleteMany({}),
      CityOperationalIncident.deleteMany({}),
      CityRegistry.deleteMany({}),
      DepartmentUnit.deleteMany({}),
      User.deleteMany({})
    ]);
  }

  await seedAll();
  const userCount = await User.countDocuments();
  if (!userCount) {
    await User.insertMany([
      { username: "admin", passwordHash: hashPassword("admin123"), role: "Admin", operationalCityIds: ["bengaluru"] },
      { username: "citizen", passwordHash: hashPassword("citizen123"), role: "Citizen" }
    ]);
  }
  console.log("MongoDB Atlas seed completed.");
  process.exit(0);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
