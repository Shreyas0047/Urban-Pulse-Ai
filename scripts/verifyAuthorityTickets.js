const assert = require("assert");
const env = require("../src/config/env");
const AuthorityTicket = require("../src/models/AuthorityTicket");
const Complaint = require("../src/models/Complaint");
const { reconcileTicket } = require("../src/controllers/authorityTicketController");
const {
  buildAuthorityPayload,
  confirmManualAuthorityHandoff,
  createOrGetAuthorityTicket,
  dispatchAuthorityTicket,
  payloadHash,
  reconcileAuthorityTicket,
  retryDate
} = require("../src/services/authorityTicketService");

function complaint() {
  return {
    _id: "507f1f77bcf86cd799439011",
    reporterUsername: "private@example.com",
    reporterUserId: "private-user-id",
    type: "Tree / Obstruction on Road",
    priority: "Critical",
    status: "Escalated",
    location: "Indiranagar, Bengaluru",
    description: "A fallen tree blocks the road.",
    assignedAuthority: "Municipality",
    routing: {
      authority: "Bruhat Bengaluru Mahanagara Palike",
      department: "Horticulture",
      unitId: "bengaluru-environment-public-realm",
      ward: "Ward 80",
      handoff: { mode: "manual_portal", portalUrl: "https://site.bbmp.gov.in/complaints" }
    },
    ai: { categoryId: "tree_obstruction", reviewRequired: false },
    humanReview: { status: "confirmed" },
    decisionAudit: { headHash: "a".repeat(64) }
  };
}

function ticket(adapter = "email") {
  return {
    _id: "607f1f77bcf86cd799439012",
    complaintId: "507f1f77bcf86cd799439011",
    adapter,
    status: "queued",
    ticketCode: "UP-99439011",
    idempotencyKey: "urban-pulse:507f1f77bcf86cd799439011",
    destination: adapter === "email" ? "authority@example.gov" : "configured webhook",
    attemptCount: 0,
    attempts: [],
    manualSubmission: {},
    reconciliationHistory: [],
    async save() { return this; }
  };
}

async function main() {
  const originalEnv = {
    adapter: env.authorityAdapter,
    email: env.authorityTicketEmail,
    max: env.authorityMaxAttempts
  };
  const originalFindOne = AuthorityTicket.findOne;
  const originalCreate = AuthorityTicket.create;
  const originalFindById = AuthorityTicket.findById;
  const originalComplaintFindById = Complaint.findById;
  try {
    const payload = buildAuthorityPayload(complaint());
    assert.equal(payload.categoryId, "tree_obstruction");
    assert.equal(payload.cityId, "bengaluru");
    assert.equal(payload.cityName, "Bengaluru");
    assert.ok(!JSON.stringify(payload).includes("private@example.com"));
    assert.equal(payloadHash(payload).length, 64);

    env.authorityAdapter = "email";
    env.authorityTicketEmail = "authority@example.gov";
    env.authorityMaxAttempts = 3;
    const emailTicket = ticket("email");
    const delivered = await dispatchAuthorityTicket(emailTicket, complaint(), {
      sendEmail: async ({ ticket: sentTicket }) => ({ messageId: `mail-${sentTicket.ticketCode}` })
    });
    assert.equal(delivered.status, "submitted");
    assert.equal(delivered.attemptCount, 1);
    assert.match(delivered.externalReference, /mail-UP/);

    const failedTicket = ticket("email");
    await dispatchAuthorityTicket(failedTicket, complaint(), {
      sendEmail: async () => { throw Object.assign(new Error("temporary SMTP failure"), { code: "SMTP_TEMP" }); }
    });
    assert.equal(failedTicket.status, "failed");
    assert.ok(failedTicket.nextRetryAt instanceof Date);
    assert.equal(failedTicket.attempts[0].errorCode, "SMTP_TEMP");

    env.authorityAdapter = "disabled";
    AuthorityTicket.findOne = async () => null;
    AuthorityTicket.create = async (data) => ({ ...data, _id: "ticket-id" });
    const created = await createOrGetAuthorityTicket(complaint());
    assert.equal(created.ticket.status, "awaiting_manual_submission");
    assert.equal(created.ticket.adapter, "manual_portal");
    assert.equal(created.ticket.idempotencyKey, "urban-pulse:507f1f77bcf86cd799439011");
    assert.equal(created.ticket.cityId, "bengaluru");
    assert.equal(created.ticket.department, "Horticulture");
    assert.equal(created.ticket.handoffMode, "manual_portal");

    const manualTicket = ticket("manual_portal");
    manualTicket.status = "awaiting_manual_submission";
    manualTicket.portalUrl = "https://site.bbmp.gov.in/complaints";
    await confirmManualAuthorityHandoff(manualTicket, {
      externalReference: "BBMP-2026-1042",
      note: "Portal accepted the complaint.",
      role: "Admin"
    });
    assert.equal(manualTicket.status, "submitted");
    assert.equal(manualTicket.externalReference, "BBMP-2026-1042");
    assert.equal(manualTicket.attemptCount, 1);
    assert.equal(manualTicket.manualSubmission.confirmedByRole, "Admin");
    assert.equal(manualTicket.attempts[0].outcome, "submitted");
    await confirmManualAuthorityHandoff(manualTicket, { externalReference: "BBMP-2026-1042", role: "Admin" });
    assert.equal(manualTicket.attemptCount, 1);
    await assert.rejects(
      () => confirmManualAuthorityHandoff(manualTicket, { externalReference: "BBMP-DIFFERENT", role: "Admin" }),
      /already confirmed/
    );

    const legacyTicket = ticket("disabled");
    legacyTicket.status = "not_configured";
    AuthorityTicket.findOne = async () => legacyTicket;
    const adopted = await createOrGetAuthorityTicket(complaint());
    assert.equal(adopted.created, false);
    assert.equal(adopted.ticket.adapter, "manual_portal");
    assert.equal(adopted.ticket.status, "awaiting_manual_submission");

    AuthorityTicket.findOne = async () => null;
    const complaintWithoutPortal = complaint();
    complaintWithoutPortal.routing.handoff.portalUrl = "";
    const disabled = await createOrGetAuthorityTicket(complaintWithoutPortal);
    assert.equal(disabled.ticket.adapter, "disabled");
    assert.equal(disabled.ticket.status, "not_configured");

    const reconciled = ticket("webhook");
    reconciled.status = "submitted";
    await reconcileAuthorityTicket(reconciled, { status: "in_progress", note: "Accepted by ward office", role: "Admin" });
    assert.equal(reconciled.status, "in_progress");
    assert.equal(reconciled.reconciliationHistory.length, 1);
    await assert.rejects(() => reconcileAuthorityTicket(reconciled, { status: "deleted" }), /valid authority ticket status/);
    const premature = ticket("manual_portal");
    premature.status = "awaiting_manual_submission";
    await assert.rejects(() => reconcileAuthorityTicket(premature, { status: "resolved" }), /before reconciling/);

    const controllerTicket = ticket("webhook");
    controllerTicket.status = "submitted";
    const controllerComplaint = {
      _id: complaint()._id,
      status: "In Progress",
      resolution: {},
      followUp: { status: "scheduled" },
      alerts: [],
      statusHistory: [],
      incidentCommand: { triggered: false },
      async save() { return this; }
    };
    AuthorityTicket.findById = async () => controllerTicket;
    Complaint.findById = async () => controllerComplaint;
    let controllerPayload;
    let controllerError;
    await reconcileTicket(
      { params: { ticketId: controllerTicket._id }, body: { status: "resolved", note: "Ward office completed the work." }, auth: { role: "Admin" } },
      { json(value) { controllerPayload = value; } },
      (error) => { controllerError = error; }
    );
    assert.ifError(controllerError);
    assert.equal(controllerPayload.authorityTicket.status, "resolved");
    assert.equal(controllerComplaint.status, "Resolved");
    assert.equal(controllerComplaint.resolution.phase, "awaiting_citizen_verification");
    assert.equal(controllerComplaint.followUp.status, "closed");

    const firstRetry = retryDate(1, new Date("2026-07-13T00:00:00Z"));
    assert.equal(firstRetry.toISOString(), "2026-07-13T00:01:00.000Z");

    const model = new AuthorityTicket({
      complaintId: complaint()._id,
      ticketCode: "UP-99439011",
      idempotencyKey: "urban-pulse:507f1f77bcf86cd799439011",
      adapter: "webhook",
      status: "queued",
      payloadHash: "a".repeat(64)
    });
    assert.ifError(model.validateSync());

    console.log(JSON.stringify({
      passed: true,
      payloadSanitized: true,
      idempotencyEnforced: true,
      successfulDeliveryTracked: true,
      failureAndRetryTracked: true,
      reconciliationValidated: true,
      manualPortalHandoffTracked: true,
      legacyManualTicketAdopted: true,
      prematureReconciliationBlocked: true,
      resolvedTicketOpensCitizenVerification: true,
      disabledAdapterExplicit: true
    }, null, 2));
  } finally {
    env.authorityAdapter = originalEnv.adapter;
    env.authorityTicketEmail = originalEnv.email;
    env.authorityMaxAttempts = originalEnv.max;
    AuthorityTicket.findOne = originalFindOne;
    AuthorityTicket.create = originalCreate;
    AuthorityTicket.findById = originalFindById;
    Complaint.findById = originalComplaintFindById;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
