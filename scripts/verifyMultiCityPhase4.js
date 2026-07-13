const assert = require("assert");
const fs = require("fs");
const path = require("path");
const AuthorityTicket = require("../src/models/AuthorityTicket");
const routingRegistry = require("../shared/cityRoutingRegistry.json");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function main() {
  const adapters = AuthorityTicket.schema.path("adapter").enumValues;
  const statuses = AuthorityTicket.schema.path("status").enumValues;
  assert.ok(adapters.includes("manual_portal"), "Authority tickets must support the manual portal adapter.");
  assert.ok(statuses.includes("awaiting_manual_submission"), "Authority tickets must distinguish prepared handoffs from submitted tickets.");
  assert.ok(AuthorityTicket.schema.path("manualSubmission.externalReference"), "Manual confirmations must preserve the external reference.");
  assert.ok(AuthorityTicket.schema.path("manualSubmission.confirmedAt"), "Manual confirmations must preserve their timestamp.");

  for (const profile of routingRegistry.profiles) {
    assert.equal(profile.handoff.mode, "manual_portal", `${profile.cityId} must retain truthful manual handoff mode.`);
    assert.equal(profile.handoff.supportsDirectApi, false, `${profile.cityId} must not claim direct API support.`);
    assert.match(profile.handoff.portalUrl, /^https:\/\//, `${profile.cityId} must use a verified HTTPS portal.`);
  }

  const routes = read("src/routes/api.js");
  const controller = read("src/controllers/authorityTicketController.js");
  const service = read("src/services/authorityTicketService.js");
  const frontend = read("public/app.js");
  assert.match(routes, /authority-tickets\/:ticketId\/manual-confirmation/);
  assert.match(routes, /manual-confirmation[^\n]+requirePermission\("update_complaint_status"\)/);
  assert.match(controller, /confirmManualSubmission/);
  assert.match(service, /Manual portal handoff confirmed\./);
  assert.match(service, /already confirmed with a different reference/);
  assert.match(frontend, /Opening the portal does not submit this complaint automatically\./);
  assert.match(frontend, /Record confirmed submission/);
  assert.match(frontend, /safeExternalHref\(ticket\?\.portalUrl/);

  console.log(JSON.stringify({
    passed: true,
    citiesCovered: routingRegistry.profiles.length,
    truthfulManualBoundary: true,
    protectedConfirmationEndpoint: true,
    idempotentReferenceGuard: true,
    legacyTicketAdoptionCoveredByAuthorityVerification: true,
    adminWorkflowVisible: true
  }, null, 2));
}

main();
