const AuthorityTicket = require("../models/AuthorityTicket");
const { registeredCity } = require("./cityActivationService");

const POLICY_VERSION = "authority-sla-v1";
const SLA_POLICY = Object.freeze({
  Critical: Object.freeze({ handoffMinutes: 30, acknowledgementMinutes: 120, resolutionMinutes: 1440 }),
  High: Object.freeze({ handoffMinutes: 120, acknowledgementMinutes: 480, resolutionMinutes: 4320 }),
  Medium: Object.freeze({ handoffMinutes: 480, acknowledgementMinutes: 1440, resolutionMinutes: 10080 }),
  Low: Object.freeze({ handoffMinutes: 1440, acknowledgementMinutes: 2880, resolutionMinutes: 20160 })
});

const HANDOFF_PENDING = new Set(["queued", "submitting", "awaiting_manual_submission", "failed", "not_configured"]);
const RESOLUTION_PENDING = new Set(["acknowledged", "in_progress"]);

function canonicalSeverity(value) {
  return Object.prototype.hasOwnProperty.call(SLA_POLICY, value) ? value : "Medium";
}

function addMinutes(date, minutes) {
  return new Date(new Date(date).getTime() + minutes * 60 * 1000);
}

function policyForSeverity(severity) {
  const normalized = canonicalSeverity(severity);
  return { severity: normalized, ...SLA_POLICY[normalized] };
}

function newTicketSla(severity, createdAt = new Date()) {
  const policy = policyForSeverity(severity);
  return {
    policyVersion: POLICY_VERSION,
    handoffDueAt: addMinutes(createdAt, policy.handoffMinutes),
    acknowledgementDueAt: null,
    resolutionDueAt: null,
    currentStage: "handoff",
    status: "on_track",
    escalationLevel: 0,
    lastEvaluatedAt: null,
    history: []
  };
}

function ensureAuthoritySla(ticket, now = new Date()) {
  if (!ticket.sla?.handoffDueAt || ticket.sla.policyVersion !== POLICY_VERSION) {
    ticket.sla = newTicketSla(ticket.severity, ticket.createdAt || now);
  }
  const sla = ticket.sla;
  const policy = policyForSeverity(ticket.severity);
  if (["submitted", "acknowledged", "in_progress", "resolved", "rejected"].includes(ticket.status) && (!sla.acknowledgementDueAt || !sla.resolutionDueAt)) {
    const submittedAt = ticket.submittedAt || ticket.manualSubmission?.confirmedAt || ticket.createdAt || now;
    sla.acknowledgementDueAt = addMinutes(submittedAt, policy.acknowledgementMinutes);
    sla.resolutionDueAt = addMinutes(submittedAt, policy.resolutionMinutes);
  }
  if (["resolved", "rejected"].includes(ticket.status)) {
    sla.currentStage = "complete";
    sla.status = "completed";
    sla.escalationLevel = 0;
  } else if (RESOLUTION_PENDING.has(ticket.status)) {
    sla.currentStage = "resolution";
  } else if (ticket.status === "submitted") {
    sla.currentStage = "acknowledgement";
  }
  return sla;
}

function markAuthoritySubmitted(ticket, submittedAt = new Date()) {
  const policy = policyForSeverity(ticket.severity);
  const sla = ensureAuthoritySla(ticket, submittedAt);
  sla.acknowledgementDueAt = addMinutes(submittedAt, policy.acknowledgementMinutes);
  sla.resolutionDueAt = addMinutes(submittedAt, policy.resolutionMinutes);
  sla.currentStage = "acknowledgement";
  sla.status = "on_track";
  sla.escalationLevel = 0;
  sla.lastEvaluatedAt = submittedAt;
  return sla;
}

function markAuthorityReconciled(ticket, status, at = new Date()) {
  const sla = ensureAuthoritySla(ticket, at);
  if (["resolved", "rejected"].includes(status)) {
    sla.currentStage = "complete";
    sla.status = "completed";
    sla.escalationLevel = 0;
  } else if (RESOLUTION_PENDING.has(status)) {
    sla.currentStage = "resolution";
    sla.status = "on_track";
    sla.escalationLevel = 0;
  }
  sla.lastEvaluatedAt = at;
  return sla;
}

function currentSlaStage(ticket) {
  if (["resolved", "rejected"].includes(ticket.status)) return { stage: "complete", dueAt: null };
  if (HANDOFF_PENDING.has(ticket.status)) return { stage: "handoff", dueAt: ticket.sla?.handoffDueAt || null };
  if (ticket.status === "submitted") return { stage: "acknowledgement", dueAt: ticket.sla?.acknowledgementDueAt || null };
  if (RESOLUTION_PENDING.has(ticket.status)) return { stage: "resolution", dueAt: ticket.sla?.resolutionDueAt || null };
  return { stage: "complete", dueAt: null };
}

function escalationLevel(dueAt, now, policyMinutes) {
  if (!dueAt || now <= dueAt) return 0;
  const overdueMinutes = (now.getTime() - dueAt.getTime()) / 60000;
  if (overdueMinutes >= policyMinutes * 2) return 3;
  if (overdueMinutes >= policyMinutes) return 2;
  return 1;
}

function evaluateAuthorityTicketSla(ticket, now = new Date()) {
  const requiresSubmissionClocks = ["submitted", "acknowledged", "in_progress", "resolved", "rejected"].includes(ticket.status);
  const hadCurrentPolicy = Boolean(
    ticket.sla?.handoffDueAt &&
    ticket.sla?.policyVersion === POLICY_VERSION &&
    (!requiresSubmissionClocks || (ticket.sla?.acknowledgementDueAt && ticket.sla?.resolutionDueAt))
  );
  const sla = ensureAuthoritySla(ticket, now);
  const previousStage = sla.currentStage;
  const previousStatus = sla.status;
  const previousLevel = Number(sla.escalationLevel || 0);
  const policy = policyForSeverity(ticket.severity);
  const { stage, dueAt } = currentSlaStage(ticket);
  if (stage === "complete") {
    sla.currentStage = "complete";
    sla.status = "completed";
    sla.escalationLevel = 0;
    const changed = !hadCurrentPolicy || previousStage !== "complete" || previousStatus !== "completed" || previousLevel !== 0;
    if (changed) sla.lastEvaluatedAt = now;
    return {
      changed,
      stage,
      level: 0,
      dueAt: null
    };
  }

  const windowMinutes = stage === "handoff"
    ? policy.handoffMinutes
    : stage === "acknowledgement"
      ? policy.acknowledgementMinutes
      : policy.resolutionMinutes;
  const level = escalationLevel(dueAt ? new Date(dueAt) : null, now, windowMinutes);
  sla.currentStage = stage;
  sla.status = level ? "overdue" : "on_track";
  sla.escalationLevel = level;
  let historyAdded = false;
  if (level > previousLevel) {
    const message = `${ticket.cityName} ${stage} SLA overdue at escalation level ${level} for ${ticket.ticketCode}.`;
    sla.history.push({ stage, level, dueAt, detectedAt: now, message });
    historyAdded = true;
  }
  const changed = !hadCurrentPolicy || historyAdded || previousStage !== stage || previousStatus !== sla.status || previousLevel !== level;
  if (changed) sla.lastEvaluatedAt = now;
  return {
    changed,
    historyAdded,
    stage,
    level,
    dueAt
  };
}

async function evaluateAuthoritySlas({ cityId = null, ticketModel = AuthorityTicket, now = new Date() } = {}) {
  const filter = cityId ? { cityId: registeredCity(cityId).slug } : {};
  const tickets = await ticketModel.find(filter);
  let evaluated = 0;
  let updated = 0;
  let escalated = 0;
  for (const ticket of tickets) {
    const result = evaluateAuthorityTicketSla(ticket, now);
    evaluated += 1;
    if (result.historyAdded) escalated += 1;
    if (result.changed) {
      await ticket.save();
      updated += 1;
    }
  }
  return { evaluated, updated, escalated, evaluatedAt: now };
}

function authorityGovernanceSnapshot(tickets = [], city) {
  const counts = { total: tickets.length, onTrack: 0, overdue: 0, completed: 0, level1: 0, level2: 0, level3: 0 };
  for (const ticket of tickets) {
    const status = ticket.sla?.status || "on_track";
    if (status === "overdue") counts.overdue += 1;
    else if (status === "completed") counts.completed += 1;
    else counts.onTrack += 1;
    const level = Number(ticket.sla?.escalationLevel || 0);
    if (level) counts[`level${level}`] += 1;
  }
  return {
    city: { id: city.slug, name: city.name },
    policyVersion: POLICY_VERSION,
    policy: SLA_POLICY,
    counts,
    tickets: tickets
      .filter((ticket) => ticket.sla?.status === "overdue")
      .sort((left, right) => Number(right.sla?.escalationLevel || 0) - Number(left.sla?.escalationLevel || 0))
      .slice(0, 50)
      .map((ticket) => ({
        id: String(ticket._id),
        ticketCode: ticket.ticketCode,
        complaintId: String(ticket.complaintId),
        authority: ticket.authority,
        department: ticket.department,
        severity: ticket.severity,
        deliveryStatus: ticket.status,
        stage: ticket.sla.currentStage,
        escalationLevel: ticket.sla.escalationLevel,
        dueAt: ticket.sla.currentStage === "handoff"
          ? ticket.sla.handoffDueAt
          : ticket.sla.currentStage === "acknowledgement"
            ? ticket.sla.acknowledgementDueAt
            : ticket.sla.resolutionDueAt,
        externalReference: ticket.externalReference || "",
        lastEscalation: ticket.sla.history?.slice(-1)[0] || null
      }))
  };
}

async function buildAuthorityGovernance(cityId, { ticketModel = AuthorityTicket, now = new Date() } = {}) {
  const city = registeredCity(cityId);
  await evaluateAuthoritySlas({ cityId: city.slug, ticketModel, now });
  const tickets = await ticketModel.find({ cityId: city.slug }).lean();
  return authorityGovernanceSnapshot(tickets, city);
}

module.exports = {
  POLICY_VERSION,
  SLA_POLICY,
  authorityGovernanceSnapshot,
  buildAuthorityGovernance,
  ensureAuthoritySla,
  evaluateAuthoritySlas,
  evaluateAuthorityTicketSla,
  markAuthorityReconciled,
  markAuthoritySubmitted,
  newTicketSla,
  policyForSeverity
};
