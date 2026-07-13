const AuthorityTicket = require("../models/AuthorityTicket");
const Complaint = require("../models/Complaint");
const IncidentCommand = require("../models/IncidentCommand");
const mongoose = require("mongoose");
const { confirmManualAuthorityHandoff, createOrGetAuthorityTicket, dispatchAuthorityTicket, reconcileAuthorityTicket } = require("../services/authorityTicketService");
const { recordOperationalEventSafely } = require("../services/cityOperationalHealthService");
const { assertOperationalCityAccess } = require("../services/operationalAccessService");

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function requireComplaint(id, auth) {
  const complaint = await Complaint.findById(id);
  if (!complaint) throw httpError("Complaint not found", 404);
  assertOperationalCityAccess(auth, complaint);
  return complaint;
}

async function recordAuthorityDelivery(ticket) {
  if (!["submitted", "failed"].includes(ticket.status)) return;
  await recordOperationalEventSafely({
    cityId: ticket.cityId,
    domain: "authority_delivery",
    outcome: ticket.status === "submitted" ? "success" : "failure",
    eventType: `authority_${ticket.status}`,
    complaintId: ticket.complaintId,
    metadata: { adapter: ticket.adapter, providerStatus: ticket.status }
  });
}

async function submitAuthorityTicket(req, res, next) {
  try {
    const complaint = await requireComplaint(req.params.id, req.auth);
    if (complaint.ai?.reviewRequired && !["confirmed", "corrected"].includes(complaint.humanReview?.status)) {
      throw httpError("Complete the required human review before submitting this complaint to an authority.", 409);
    }
    const { ticket, created } = await createOrGetAuthorityTicket(complaint);
    const delivered = await dispatchAuthorityTicket(ticket, complaint);
    await recordAuthorityDelivery(delivered);
    res.status(created ? 201 : 200).json({
      message: delivered.status === "submitted"
        ? "Authority ticket submitted."
        : delivered.status === "awaiting_manual_submission"
          ? "Authority handoff is ready. Submit through the official portal and record its reference."
          : delivered.status === "not_configured"
            ? "Authority adapter is not configured."
            : "Authority ticket delivery failed and is tracked for retry.",
      authorityTicket: delivered
    });
  } catch (error) {
    next(error);
  }
}

async function confirmManualSubmission(req, res, next) {
  try {
    const ticket = await AuthorityTicket.findById(req.params.ticketId);
    if (!ticket) throw httpError("Authority ticket not found", 404);
    assertOperationalCityAccess(req.auth, ticket);
    const confirmed = await confirmManualAuthorityHandoff(ticket, {
      externalReference: req.body.externalReference,
      note: req.body.note,
      role: req.auth.role
    });
    await recordOperationalEventSafely({
      cityId: confirmed.cityId,
      domain: "authority_delivery",
      outcome: "success",
      eventType: "authority_manual_submission_confirmed",
      complaintId: confirmed.complaintId,
      metadata: { adapter: confirmed.adapter, providerStatus: confirmed.status }
    });
    res.json({ message: "Manual authority handoff recorded.", authorityTicket: confirmed });
  } catch (error) {
    next(error);
  }
}

async function retryAuthorityTicket(req, res, next) {
  try {
    const complaint = await requireComplaint(req.params.id, req.auth);
    const ticket = await AuthorityTicket.findOne({ complaintId: complaint._id });
    if (!ticket) throw httpError("Create the authority ticket before retrying delivery.", 404);
    if (ticket.nextRetryAt && new Date(ticket.nextRetryAt) > new Date()) {
      throw httpError(`Retry is available after ${new Date(ticket.nextRetryAt).toISOString()}.`, 429);
    }
    const delivered = await dispatchAuthorityTicket(ticket, complaint);
    await recordAuthorityDelivery(delivered);
    res.json({ message: delivered.status === "submitted" ? "Authority ticket submitted." : "Authority retry was recorded but delivery did not complete.", authorityTicket: delivered });
  } catch (error) {
    next(error);
  }
}

async function reconcileTicket(req, res, next) {
  try {
    const execute = async (session = null) => {
      let ticketQuery = AuthorityTicket.findById(req.params.ticketId);
      if (session && typeof ticketQuery.session === "function") ticketQuery = ticketQuery.session(session);
      const ticket = await ticketQuery;
      if (!ticket) throw httpError("Authority ticket not found", 404);
      assertOperationalCityAccess(req.auth, ticket);
      await reconcileAuthorityTicket(ticket, { status: req.body.status, note: req.body.note, role: req.auth.role, session });
      if (ticket.status === "resolved") {
        let complaintQuery = Complaint.findById(ticket.complaintId);
        if (session && typeof complaintQuery.session === "function") complaintQuery = complaintQuery.session(session);
        const complaint = await complaintQuery;
        if (complaint && complaint.status !== "Resolved") {
          const now = new Date();
          const note = String(req.body.note || "Authority ticket reconciled as resolved.").replace(/\s+/g, " ").trim().slice(0, 300);
          complaint.status = "Resolved";
          complaint.resolution = {
            ...(complaint.resolution?.toObject ? complaint.resolution.toObject() : complaint.resolution || {}),
            phase: "awaiting_citizen_verification",
            authorityUpdate: { markedBy: "authority-ticket-reconciliation", markedAt: now, note }
          };
          complaint.followUp = { ...(complaint.followUp || {}), status: "closed", nextDueAt: null, escalationNote: "Follow-up paused while citizens verify the authority resolution." };
          complaint.statusHistory = [...(complaint.statusHistory || []), { status: "Resolved", changedBy: "authority-ticket-reconciliation", changedAt: now, note }];
          const verificationRequest = "Authority marked this complaint resolved. Please confirm the outcome or report that the issue remains.";
          if (!(complaint.alerts || []).includes(verificationRequest)) complaint.alerts = [...(complaint.alerts || []), verificationRequest];
          if (complaint.incidentCommand?.triggered && complaint.incidentCommand?.incidentId) {
            await IncidentCommand.findByIdAndUpdate(complaint.incidentCommand.incidentId, {
              commandStatus: "Resolved",
              $push: { timeline: { event: "Authority ticket reconciled as resolved", at: now, by: "authority-ticket-reconciliation" } }
            }, session ? { session } : undefined);
            complaint.incidentCommand.status = "Resolved";
          }
          await complaint.save(session ? { session } : undefined);
        }
      }
      return ticket;
    };
    const ticket = mongoose.connection.readyState === 1
      ? await mongoose.connection.transaction((session) => execute(session))
      : await execute();
    res.json({ message: "Authority ticket status reconciled.", authorityTicket: ticket });
  } catch (error) {
    next(error);
  }
}

module.exports = { confirmManualSubmission, reconcileTicket, retryAuthorityTicket, submitAuthorityTicket };
