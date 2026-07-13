const assert = require("assert");
const fs = require("fs");
const path = require("path");
const env = require("../src/config/env");
const User = require("../src/models/User");
const PasswordResetOtp = require("../src/models/PasswordResetOtp");
const { requestPasswordResetOtp, requestRegistrationOtp } = require("../src/controllers/authController");
const {
  assertOperationalCityAccess,
  canAccessComplaint,
  hasOperationalCityAccess,
  operationalCityDataFilter
} = require("../src/services/operationalAccessService");
const { buildPublicContextQuery, isOfficialLooking } = require("../src/services/civicEvidenceService");

async function captureController(controller, req) {
  let payload;
  let error;
  await controller(req, { json(value) { payload = value; return value; } }, (value) => { error = value; });
  return { payload, error };
}

async function run() {
  const bengaluruAdmin = {
    role: "Admin",
    username: "admin@example.com",
    userId: "admin-1",
    operationalCityIds: ["bengaluru"],
    permissions: ["view_dashboard", "update_complaint_status"]
  };
  assert(hasOperationalCityAccess(bengaluruAdmin, "bengaluru"));
  assert(!hasOperationalCityAccess(bengaluruAdmin, "mumbai"));
  assert.throws(() => assertOperationalCityAccess(bengaluruAdmin, { cityId: "mumbai" }), /not assigned/);
  assert(hasOperationalCityAccess({ ...bengaluruAdmin, operationalCityIds: [] }, {}), "legacy records must remain Bengaluru-scoped");
  assert(canAccessComplaint({ role: "Citizen", userId: "citizen-1", username: "citizen@example.com", permissions: [] }, {
    reporterUserId: "citizen-1",
    reporterUsername: "citizen@example.com",
    cityId: "mumbai"
  }), "citizens must retain access to their own complaint");
  assert.deepEqual(operationalCityDataFilter("bengaluru"), { $or: [{ cityId: "bengaluru" }, { cityId: { $exists: false } }] });

  const blockedRegistration = await captureController(requestRegistrationOtp, {
    body: { email: "new-admin@example.com", password: "StrongPassword123", role: "Admin" }
  });
  assert.equal(blockedRegistration.error?.statusCode, 403);

  const originalUserFindOne = User.findOne;
  const originalResetDeleteOne = PasswordResetOtp.deleteOne;
  try {
    User.findOne = async () => null;
    PasswordResetOtp.deleteOne = () => ({ catch: async () => {} });
    const unknownReset = await captureController(requestPasswordResetOtp, {
      body: { email: "unknown@example.com" }
    });
    assert.ifError(unknownReset.error);
    assert.equal(unknownReset.payload.deliveryStatus, "sent");
    assert.equal(unknownReset.payload.sent, true);
    assert(!Object.prototype.hasOwnProperty.call(unknownReset.payload, "acceptedCount"));
  } finally {
    User.findOne = originalUserFindOne;
    PasswordResetOtp.deleteOne = originalResetDeleteOne;
  }

  const mumbaiQuery = buildPublicContextQuery({
    analysis: { nlp: { issueType: "fallen tree" } },
    location: "Andheri, Mumbai, Maharashtra, India"
  });
  assert(mumbaiQuery.includes("Mumbai"));
  assert(!mumbaiQuery.includes("Bengaluru"));
  assert(isOfficialLooking({ url: "https://erp.chennaicorporation.gov.in/pgr/", title: "Public grievance", snippet: "" }));
  assert(isOfficialLooking({ url: "https://mcdonline.nic.in/portal/feedback", title: "Feedback", snippet: "" }));

  assert.equal(env.validateConfiguration(env), true);
  assert.throws(() => env.validateConfiguration({ ...env, authorityAdapter: "unsafe" }), /AUTHORITY_ADAPTER/);

  const root = path.join(__dirname, "..");
  const complaintController = fs.readFileSync(path.join(root, "src/controllers/complaintController.js"), "utf8");
  const authorityController = fs.readFileSync(path.join(root, "src/controllers/authorityTicketController.js"), "utf8");
  const auditController = fs.readFileSync(path.join(root, "src/controllers/decisionAuditController.js"), "utf8");
  const emailController = fs.readFileSync(path.join(root, "src/controllers/emailController.js"), "utf8");
  const authController = fs.readFileSync(path.join(root, "src/controllers/authController.js"), "utf8");
  const aiClient = fs.readFileSync(path.join(root, "src/services/aiClient.js"), "utf8");
  const frontend = fs.readFileSync(path.join(root, "public/app.js"), "utf8");
  const render = fs.readFileSync(path.join(root, "render.yaml"), "utf8");
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  const envExample = fs.readFileSync(path.join(root, ".env.example"), "utf8");
  assert(complaintController.match(/assertOperationalCityAccess/g).length >= 4);
  assert(authorityController.match(/assertOperationalCityAccess/g).length >= 4);
  assert(auditController.includes("operationalCityDataFilter"));
  assert(emailController.includes("canAccessComplaint"));
  assert(authController.match(/validateSelfRegistrationRole\(role\)/g).length >= 3);
  assert(aiClient.includes('"X-Urban-Pulse-Service-Token": env.aiServiceToken'));
  assert(!frontend.includes("ensureAudioContext"));
  assert(!frontend.includes("startAmbientLoop"));
  assert(frontend.includes("adminRoleOption.disabled = isRegisterMode"));
  assert(frontend.includes("operationsCities[0]?.id || cityRegistryState.defaultCityId"));
  assert(render.includes("buildCommand: npm ci"));
  assert(render.includes("AI_SERVICE_REQUIRE_TOKEN"));
  assert.equal((render.match(/key: AI_SERVICE_TOKEN/g) || []).length, 2, "both Render services need the same AI service token");
  ["MONGODB_URI", "JWT_SECRET", "AI_SERVICE_URL", "AI_SERVICE_TOKEN", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"].forEach((key) => {
    assert(render.includes(`key: ${key}`), `Render blueprint must declare ${key}`);
    assert(readme.includes(key), `README must document ${key}`);
    assert(envExample.includes(`${key}=`), `.env.example must declare ${key}`);
  });

  console.log(JSON.stringify({
    passed: true,
    adminSelfRegistrationBlocked: true,
    passwordResetEnumerationReduced: true,
    complaintAndAuthorityCityIsolationVerified: true,
    legacyBengaluruScopePreserved: true,
    multiCityCivicSearchVerified: true,
    productionConfigurationValidated: true,
    deterministicRenderBuildVerified: true,
    dormantAudioRuntimeRemoved: true,
    deploymentDocumentationCoverageVerified: true
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
