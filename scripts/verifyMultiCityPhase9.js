const assert = require("assert");
const fs = require("fs");
const path = require("path");
const AuthorityTicket = require("../src/models/AuthorityTicket");
const { reconcileAuthorityTicket } = require("../src/services/authorityTicketService");
const {
  POLICY_VERSION,
  SLA_POLICY,
  authorityGovernanceSnapshot,
  evaluateAuthoritySlas,
  evaluateAuthorityTicketSla,
  markAuthorityReconciled,
  markAuthoritySubmitted,
  newTicketSla,
  policyForSeverity
} = require("../src/services/authoritySlaService");

function ticket(overrides = {}) {
  const createdAt = overrides.createdAt || new Date("2026-07-13T00:00:00.000Z");
  return {
    _id: overrides._id || "ticket-1",
    complaintId: overrides.complaintId || "complaint-1",
    cityId: "bengaluru",
    cityName: "Bengaluru",
    ticketCode: overrides.ticketCode || "UP-00000001",
    authority: "Bruhat Bengaluru Mahanagara Palike",
    department: "Road Infrastructure",
    severity: overrides.severity || "High",
    status: overrides.status || "awaiting_manual_submission",
    externalReference: overrides.externalReference || "",
    createdAt,
    sla: overrides.sla || newTicketSla(overrides.severity || "High", createdAt),
    async save() { this.saved = (this.saved || 0) + 1; return this; },
    ...overrides
  };
}

async function run() {
  assert.equal(POLICY_VERSION, "authority-sla-v1");
  assert(SLA_POLICY.Critical.handoffMinutes < SLA_POLICY.High.handoffMinutes);
  assert(SLA_POLICY.High.resolutionMinutes < SLA_POLICY.Medium.resolutionMinutes);
  assert.equal(policyForSeverity("unknown").severity, "Medium");

  const createdAt = new Date("2026-07-13T00:00:00.000Z");
  const highSla = newTicketSla("High", createdAt);
  assert.equal(highSla.handoffDueAt.toISOString(), "2026-07-13T02:00:00.000Z");
  assert.equal(highSla.acknowledgementDueAt, null);
  assert.equal(highSla.resolutionDueAt, null);

  const handoff = ticket({ createdAt, sla: highSla });
  let result = evaluateAuthorityTicketSla(handoff, new Date("2026-07-13T02:00:00.000Z"));
  assert.equal(result.level, 0, "a ticket is not overdue at the exact deadline");
  result = evaluateAuthorityTicketSla(handoff, new Date("2026-07-13T02:00:00.001Z"));
  assert.equal(result.level, 1);
  assert.equal(handoff.sla.history.length, 1);
  evaluateAuthorityTicketSla(handoff, new Date("2026-07-13T02:30:00.000Z"));
  assert.equal(handoff.sla.history.length, 1, "repeated evaluation must not duplicate one escalation level");
  result = evaluateAuthorityTicketSla(handoff, new Date("2026-07-13T04:00:00.000Z"));
  assert.equal(result.level, 2);
  result = evaluateAuthorityTicketSla(handoff, new Date("2026-07-13T06:00:00.000Z"));
  assert.equal(result.level, 3);
  assert.deepEqual(handoff.sla.history.map((entry) => entry.level), [1, 2, 3]);

  handoff.status = "submitted";
  handoff.externalReference = "BBMP-12345";
  markAuthoritySubmitted(handoff, new Date("2026-07-13T06:00:00.000Z"));
  assert.equal(handoff.sla.currentStage, "acknowledgement");
  assert.equal(handoff.sla.status, "on_track");
  assert.equal(handoff.sla.acknowledgementDueAt.toISOString(), "2026-07-13T14:00:00.000Z");
  assert.equal(handoff.sla.resolutionDueAt.toISOString(), "2026-07-16T06:00:00.000Z");

  handoff.status = "acknowledged";
  markAuthorityReconciled(handoff, "acknowledged", new Date("2026-07-13T08:00:00.000Z"));
  assert.equal(handoff.sla.currentStage, "resolution");
  assert.equal(handoff.sla.resolutionDueAt.toISOString(), "2026-07-16T06:00:00.000Z", "acknowledgement must not silently extend resolution SLA");
  handoff.status = "resolved";
  markAuthorityReconciled(handoff, "resolved", new Date("2026-07-14T08:00:00.000Z"));
  assert.equal(handoff.sla.status, "completed");

  const legacySubmitted = ticket({
    status: "submitted",
    submittedAt: new Date("2026-07-12T10:00:00.000Z"),
    sla: undefined
  });
  evaluateAuthorityTicketSla(legacySubmitted, new Date("2026-07-13T10:01:00.000Z"));
  assert.equal(legacySubmitted.sla.acknowledgementDueAt.toISOString(), "2026-07-12T18:00:00.000Z");
  assert.equal(legacySubmitted.sla.resolutionDueAt.toISOString(), "2026-07-15T10:00:00.000Z");
  assert.equal(legacySubmitted.sla.status, "overdue", "legacy submitted tickets must enter governance from their real submission time");

  const evidenceTicket = ticket({ status: "submitted", externalReference: "BBMP-7788" });
  await assert.rejects(
    () => reconcileAuthorityTicket(evidenceTicket, { status: "acknowledged", note: "short", role: "Admin" }),
    /response evidence/
  );

  const overdueHigh = ticket({ _id: "ticket-2", complaintId: "complaint-2", ticketCode: "UP-00000002" });
  evaluateAuthorityTicketSla(overdueHigh, new Date("2026-07-13T02:01:00.000Z"));
  const onTrack = ticket({ _id: "ticket-3", complaintId: "complaint-3", ticketCode: "UP-00000003", createdAt: new Date("2026-07-13T02:00:00.000Z") });
  const snapshot = authorityGovernanceSnapshot([overdueHigh, onTrack, handoff], { slug: "bengaluru", name: "Bengaluru" });
  assert.equal(snapshot.counts.total, 3);
  assert.equal(snapshot.counts.overdue, 1);
  assert.equal(snapshot.tickets.length, 1);
  assert(!Object.prototype.hasOwnProperty.call(snapshot.tickets[0], "destination"));
  assert(!Object.prototype.hasOwnProperty.call(snapshot.tickets[0], "lastError"));

  class FakeTicketModel {
    static records = [ticket({ createdAt, sla: newTicketSla("High", createdAt) })];
    static async find() { return FakeTicketModel.records; }
  }
  const evaluation = await evaluateAuthoritySlas({ cityId: "bengaluru", ticketModel: FakeTicketModel, now: new Date("2026-07-13T02:01:00.000Z") });
  assert.equal(evaluation.escalated, 1);
  assert.equal(FakeTicketModel.records[0].saved, 1);
  await evaluateAuthoritySlas({ cityId: "bengaluru", ticketModel: FakeTicketModel, now: new Date("2026-07-13T02:30:00.000Z") });
  assert.equal(FakeTicketModel.records[0].saved, 1, "idempotent evaluation must avoid unnecessary writes");

  const validation = new AuthorityTicket({
    complaintId: "507f1f77bcf86cd799439011",
    cityId: "bengaluru",
    cityName: "Bengaluru",
    authority: "BBMP",
    department: "Roads",
    severity: "Critical",
    unitId: "bengaluru-roads",
    handoffMode: "manual_portal",
    ticketCode: "UP-TEST0001",
    idempotencyKey: "urban-pulse:test-1",
    adapter: "manual_portal",
    status: "awaiting_manual_submission",
    payloadHash: "a".repeat(64),
    sla: newTicketSla("Critical", createdAt)
  }).validateSync();
  assert.equal(validation, undefined);

  const root = path.join(__dirname, "..");
  const routes = fs.readFileSync(path.join(root, "src/routes/api.js"), "utf8");
  const server = fs.readFileSync(path.join(root, "src/server.js"), "utf8");
  const authorityService = fs.readFileSync(path.join(root, "src/services/authorityTicketService.js"), "utf8");
  const ui = fs.readFileSync(path.join(root, "public/app.js"), "utf8");
  assert(routes.includes('requirePermission("update_complaint_status"), getAuthorityGovernance'));
  assert(routes.includes('requirePermission("update_complaint_status"), evaluateAuthorityGovernance'));
  assert(server.includes("startAuthoritySlaScheduler()"));
  assert(server.includes("stopAuthoritySlaScheduler()"));
  assert(authorityService.includes("markAuthoritySubmitted"));
  assert(authorityService.includes("markAuthorityReconciled"));
  assert(ui.includes("loadAuthorityGovernance(data.operationsScope)"));

  console.log(JSON.stringify({
    passed: true,
    severityPoliciesVerified: true,
    exactDeadlineBoundaryVerified: true,
    threeLevelEscalationVerified: true,
    escalationIdempotencyVerified: true,
    handoffAcknowledgementResolutionStagesVerified: true,
    resolutionDeadlineCannotBeExtendedByAcknowledgement: true,
    reconciliationEvidenceRequired: true,
    legacySubmittedTicketBackfillVerified: true,
    governanceDataMinimized: true,
    scheduledAndManualEvaluationWired: true,
    protectedAdminUiWired: true
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
