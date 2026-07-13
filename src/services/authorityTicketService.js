const crypto = require("crypto");
const AuthorityTicket = require("../models/AuthorityTicket");
const env = require("../config/env");
const { sendAuthorityTicketEmail } = require("./emailService");

const RECONCILE_STATUSES = new Set(["acknowledged", "in_progress", "resolved", "rejected"]);

function clean(value, limit = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function buildAuthorityPayload(complaint) {
  return {
    schemaVersion: "1.0.0",
    complaintId: String(complaint._id),
    issueType: clean(complaint.type, 120),
    categoryId: clean(complaint.ai?.categoryId || "general", 80),
    severity: clean(complaint.priority, 30),
    status: clean(complaint.status, 40),
    location: clean(complaint.location, 240),
    coordinates: Number.isFinite(Number(complaint.mapLocation?.lat)) && Number.isFinite(Number(complaint.mapLocation?.lng))
      ? { lat: Number(complaint.mapLocation.lat), lng: Number(complaint.mapLocation.lng) }
      : null,
    description: clean(complaint.description, 1500),
    authority: clean(complaint.routing?.authority || complaint.assignedAuthority, 120),
    department: clean(complaint.routing?.department || complaint.ai?.recommendedTeam, 120),
    ward: clean(complaint.routing?.ward, 100),
    confidence: Number(complaint.confidence || 0),
    reviewStatus: clean(complaint.humanReview?.status || "unreviewed", 40),
    decisionAuditHead: clean(complaint.decisionAudit?.headHash, 64),
    submittedAt: new Date().toISOString()
  };
}

function payloadHash(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function ticketCode(complaintId) {
  return `UP-${String(complaintId).slice(-8).toUpperCase()}`;
}

async function createOrGetAuthorityTicket(complaint) {
  const existing = await AuthorityTicket.findOne({ complaintId: complaint._id });
  if (existing) return { ticket: existing, created: false };
  const payload = buildAuthorityPayload(complaint);
  const adapter = ["email", "webhook"].includes(env.authorityAdapter) ? env.authorityAdapter : "disabled";
  const code = ticketCode(complaint._id);
  try {
    const ticket = await AuthorityTicket.create({
      complaintId: complaint._id,
      ticketCode: code,
      idempotencyKey: `urban-pulse:${complaint._id}`,
      adapter,
      status: adapter === "disabled" ? "not_configured" : "queued",
      destination: adapter === "email" ? clean(env.authorityTicketEmail, 180) : adapter === "webhook" ? "configured webhook" : "not configured",
      payloadHash: payloadHash(payload)
    });
    return { ticket, created: true };
  } catch (error) {
    if (error?.code === 11000) return { ticket: await AuthorityTicket.findOne({ complaintId: complaint._id }), created: false };
    throw error;
  }
}

function retryDate(attemptCount, now = new Date()) {
  const delayMinutes = [1, 5, 15, 60][Math.min(Math.max(attemptCount - 1, 0), 3)];
  return new Date(now.getTime() + delayMinutes * 60000);
}

async function webhookSubmit(ticket, payload, fetchImpl = fetch) {
  if (!env.authorityWebhookUrl) throw Object.assign(new Error("Authority webhook URL is not configured."), { code: "WEBHOOK_NOT_CONFIGURED", retryable: false });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.authorityTimeoutMs);
  try {
    const response = await fetchImpl(env.authorityWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": ticket.idempotencyKey,
        ...(env.authorityWebhookToken ? { Authorization: `Bearer ${env.authorityWebhookToken}` } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(`Authority webhook returned HTTP ${response.status}.`), { code: "WEBHOOK_HTTP_ERROR", statusCode: response.status, retryable: response.status >= 500 || response.status === 429 });
    return { externalReference: clean(body.ticketId || body.reference || response.headers.get("x-ticket-id") || ticket.ticketCode, 180), statusCode: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

async function dispatchAuthorityTicket(ticket, complaint, dependencies = {}) {
  if (["submitted", "acknowledged", "in_progress", "resolved"].includes(ticket.status)) return ticket;
  if (ticket.attemptCount >= env.authorityMaxAttempts) {
    const error = new Error("Authority ticket reached the maximum delivery attempts.");
    error.statusCode = 409;
    throw error;
  }
  const payload = buildAuthorityPayload(complaint);
  ticket.status = "submitting";
  ticket.attemptCount += 1;
  await ticket.save();
  const attemptedAt = new Date();
  try {
    let result;
    if (ticket.adapter === "email") {
      if (!env.authorityTicketEmail) throw Object.assign(new Error("Authority ticket email is not configured."), { code: "EMAIL_NOT_CONFIGURED", retryable: false });
      result = await (dependencies.sendEmail || sendAuthorityTicketEmail)({ to: env.authorityTicketEmail, ticket, payload });
      result = { externalReference: clean(result.messageId || ticket.ticketCode, 180), statusCode: 202 };
    } else if (ticket.adapter === "webhook") {
      result = await webhookSubmit(ticket, payload, dependencies.fetch);
    } else {
      throw Object.assign(new Error("Authority adapter is disabled."), { code: "ADAPTER_DISABLED", retryable: false, notConfigured: true });
    }
    ticket.status = "submitted";
    ticket.externalReference = result.externalReference;
    ticket.submittedAt = attemptedAt;
    ticket.lastError = "";
    ticket.nextRetryAt = null;
    ticket.attempts.push({ attemptedAt, outcome: "submitted", statusCode: result.statusCode, message: "Authority adapter accepted the ticket." });
  } catch (error) {
    const retryable = error.retryable !== false && ticket.attemptCount < env.authorityMaxAttempts;
    ticket.status = error.notConfigured ? "not_configured" : "failed";
    ticket.lastError = clean(error.message || "Authority submission failed.", 300);
    ticket.nextRetryAt = retryable ? retryDate(ticket.attemptCount, attemptedAt) : null;
    ticket.attempts.push({ attemptedAt, outcome: error.notConfigured ? "not_configured" : "failed", statusCode: error.statusCode || null, errorCode: clean(error.code || "DELIVERY_ERROR", 80), message: ticket.lastError });
  }
  await ticket.save();
  return ticket;
}

async function reconcileAuthorityTicket(ticket, { status, note, role, session = null }) {
  const normalizedStatus = clean(status, 40);
  if (!RECONCILE_STATUSES.has(normalizedStatus)) {
    const error = new Error("Choose a valid authority ticket status.");
    error.statusCode = 400;
    throw error;
  }
  ticket.status = normalizedStatus;
  ticket.reconciledAt = new Date();
  ticket.reconciliationHistory.push({ status: normalizedStatus, note: clean(note, 300), changedByRole: clean(role || "Admin", 40), changedAt: ticket.reconciledAt });
  await ticket.save(session ? { session } : undefined);
  return ticket;
}

module.exports = { buildAuthorityPayload, createOrGetAuthorityTicket, dispatchAuthorityTicket, payloadHash, reconcileAuthorityTicket, retryDate };
