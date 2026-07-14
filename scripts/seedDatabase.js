const { connectDatabase } = require("../src/config/db");
const Complaint = require("../src/models/Complaint");
const EmergencyBroadcast = require("../src/models/EmergencyBroadcast");
const IncidentCluster = require("../src/models/IncidentCluster");
const IncidentCommand = require("../src/models/IncidentCommand");
const DecisionAuditEvent = require("../src/models/DecisionAuditEvent");
const AuthorityTicket = require("../src/models/AuthorityTicket");
const DepartmentUnit = require("../src/models/DepartmentUnit");
const User = require("../src/models/User");
const { seedAll } = require("../src/services/seedService");
const { hashPassword } = require("../src/utils/auth");

async function run() {
  await connectDatabase();

  if (process.argv.includes("--fresh")) {
    await Promise.all([
      Complaint.deleteMany({}),
      EmergencyBroadcast.deleteMany({}),
      IncidentCluster.deleteMany({}),
      IncidentCommand.deleteMany({}),
      DecisionAuditEvent.collection.deleteMany({}),
      AuthorityTicket.deleteMany({}),
      DepartmentUnit.deleteMany({}),
      User.deleteMany({})
    ]);
  }

  await seedAll();
  const userCount = await User.countDocuments();
  if (!userCount) {
    await User.insertMany([
      { username: "admin", passwordHash: hashPassword("admin123"), role: "Admin" },
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
