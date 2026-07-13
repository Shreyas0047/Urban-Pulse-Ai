const crypto = require("crypto");
const DecisionAuditEvent = require("../models/DecisionAuditEvent");

const GENESIS_HASH = "0".repeat(64);
const MAX_EXPORT_EVENTS = 5000;

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
  }
  return value instanceof Date ? value.toISOString() : value;
}

function hashPayload(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(stableValue(payload))).digest("hex");
}

function decisionSnapshot(complaint) {
  return {
    categoryId: String(complaint.ai?.categoryId || "general"),
    type: String(complaint.type || "Civic Complaint"),
    priority: String(complaint.priority || "Low"),
    department: String(complaint.routing?.department || complaint.ai?.recommendedTeam || "Help Desk"),
    authority: String(complaint.routing?.authority || complaint.assignedAuthority || "Gram Panchayat"),
    confidence: Number.isFinite(Number(complaint.confidence)) ? Number(complaint.confidence) : null,
    reviewRequired: Boolean(complaint.ai?.reviewRequired)
  };
}

function evidenceSnapshot(complaint) {
  return {
    provider: String(complaint.ai?.provider || "unknown"),
    engine: String(complaint.ai?.engine || "unknown"),
    model: String(complaint.ai?.model || "unknown"),
    evaluationVersion: String(complaint.ai?.evaluationVersion || "unknown"),
    confidenceLabel: String(complaint.ai?.confidenceLabel || ""),
    threatLevel: String(complaint.ai?.threatLevel || ""),
    riskScore: Number(complaint.ai?.riskScore || 0),
    fallbackUsed: Boolean(complaint.ai?.fallbackUsed),
    visionFallbackUsed: Boolean(complaint.ai?.visionFallbackUsed),
    imageFingerprint: String(complaint.ai?.imageFingerprint || "")
  };
}

function hashableEvent(event) {
  return {
    eventId: event.eventId,
    complaintId: String(event.complaintId),
    sequence: event.sequence,
    eventType: event.eventType,
    outcome: event.outcome,
    actorType: event.actorType,
    actorRole: event.actorRole,
    before: event.before,
    after: event.after,
    changedFields: event.changedFields,
    reason: event.reason,
    evidence: event.evidence,
    previousHash: event.previousHash,
    occurredAt: new Date(event.occurredAt).toISOString()
  };
}

async function appendDecisionEvent({ complaint, eventType, outcome, actorType, actorRole, before, after, changedFields = [], reason = "", evidence, occurredAt = new Date(), session = null }) {
  const query = DecisionAuditEvent.findOne({ complaintId: complaint._id }).sort({ sequence: -1 });
  if (session) query.session(session);
  const previous = await query.lean();
  const event = {
    eventId: crypto.randomUUID(),
    complaintId: complaint._id,
    sequence: Number(previous?.sequence || 0) + 1,
    eventType,
    outcome,
    actorType,
    actorRole: String(actorRole || (actorType === "system" ? "system" : "Admin")),
    before: before || decisionSnapshot(complaint),
    after: after || decisionSnapshot(complaint),
    changedFields: [...new Set(changedFields.map(String))].sort(),
    reason: String(reason || "").replace(/\s+/g, " ").trim().slice(0, 500),
    evidence: evidence || evidenceSnapshot(complaint),
    previousHash: previous?.eventHash || GENESIS_HASH,
    occurredAt
  };
  event.eventHash = hashPayload(hashableEvent(event));
  const [created] = await DecisionAuditEvent.create([event], session ? { session } : undefined);
  complaint.decisionAudit = {
    headEventId: created.eventId,
    headHash: created.eventHash,
    eventCount: created.sequence,
    integrityStatus: "verified",
    lastRecordedAt: created.occurredAt
  };
  return created;
}

async function recordAiBaseline(complaint, { session = null } = {}) {
  const snapshot = decisionSnapshot(complaint);
  return appendDecisionEvent({
    complaint,
    eventType: "ai_baseline",
    outcome: complaint.ai?.reviewRequired ? "needs_human_review" : "accepted",
    actorType: "system",
    actorRole: "ai-decision-engine",
    before: snapshot,
    after: snapshot,
    changedFields: [],
    reason: complaint.ai?.reviewRequired
      ? "AI baseline recorded and routed for human review."
      : "AI baseline recorded after complaint analysis.",
    evidence: evidenceSnapshot(complaint),
    session
  });
}

async function verifyDecisionAudit(complaintId, { session = null, complaint = null } = {}) {
  const query = DecisionAuditEvent.find({ complaintId }).sort({ sequence: 1 }).limit(MAX_EXPORT_EVENTS);
  if (session) query.session(session);
  const events = await query.lean();
  let previousHash = GENESIS_HASH;
  const issues = [];
  events.forEach((event, index) => {
    const expectedSequence = index + 1;
    const calculatedHash = hashPayload(hashableEvent(event));
    if (event.sequence !== expectedSequence) issues.push(`Expected sequence ${expectedSequence}, found ${event.sequence}.`);
    if (event.previousHash !== previousHash) issues.push(`Hash link failed at sequence ${event.sequence}.`);
    if (event.eventHash !== calculatedHash) issues.push(`Event hash failed at sequence ${event.sequence}.`);
    previousHash = event.eventHash;
  });
  if (complaint?.decisionAudit?.eventCount && Number(complaint.decisionAudit.eventCount) !== events.length) {
    issues.push(`Complaint audit count is ${complaint.decisionAudit.eventCount}, but ${events.length} event(s) were found.`);
  }
  if (complaint?.decisionAudit?.headHash && complaint.decisionAudit.headHash !== previousHash) {
    issues.push("Complaint audit head does not match the event chain.");
  }
  return {
    status: issues.length ? "failed" : events.length ? "verified" : "not_recorded",
    checkedEvents: events.length,
    headHash: events.at(-1)?.eventHash || "",
    issues,
    events
  };
}

function csvCell(value) {
  const normalized = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${normalized.replace(/"/g, '""')}"`;
}

function eventsToCsv(events) {
  const fields = ["eventId", "complaintId", "sequence", "eventType", "outcome", "actorRole", "changedFields", "reason", "before", "after", "previousHash", "eventHash", "occurredAt"];
  return [fields.join(","), ...events.map((event) => fields.map((field) => csvCell(field === "complaintId" ? String(event.complaintId) : event[field])).join(","))].join("\n");
}

async function aggregateCorrectionFeedback() {
  const rows = await DecisionAuditEvent.find({ eventType: "human_review" }).sort({ occurredAt: -1 }).limit(MAX_EXPORT_EVENTS).lean();
  const summary = { totalReviews: rows.length, confirmed: 0, corrected: 0, insufficientEvidence: 0, changedFields: {}, categoryCorrections: {} };
  rows.forEach((event) => {
    if (event.outcome === "confirmed") summary.confirmed += 1;
    if (event.outcome === "corrected") summary.corrected += 1;
    if (event.outcome === "insufficient_evidence") summary.insufficientEvidence += 1;
    (event.changedFields || []).forEach((field) => { summary.changedFields[field] = (summary.changedFields[field] || 0) + 1; });
    if (event.before?.categoryId !== event.after?.categoryId) {
      const key = `${event.before?.categoryId || "unknown"} -> ${event.after?.categoryId || "unknown"}`;
      summary.categoryCorrections[key] = (summary.categoryCorrections[key] || 0) + 1;
    }
  });
  return { generatedAt: new Date().toISOString(), cappedAt: MAX_EXPORT_EVENTS, summary, events: rows };
}

module.exports = {
  GENESIS_HASH,
  aggregateCorrectionFeedback,
  appendDecisionEvent,
  decisionSnapshot,
  eventsToCsv,
  hashPayload,
  recordAiBaseline,
  verifyDecisionAudit
};
