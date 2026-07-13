const Complaint = require("../models/Complaint");
const {
  aggregateCorrectionFeedback,
  eventsToCsv,
  verifyDecisionAudit
} = require("../services/decisionAuditService");

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

async function exportComplaintDecisionAudit(req, res, next) {
  try {
    const complaint = await Complaint.findById(req.params.id).lean();
    if (!complaint) throw notFound("Complaint not found");
    const audit = await verifyDecisionAudit(complaint._id, { complaint });
    if (String(req.query.format || "json").toLowerCase() === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="decision-audit-${complaint._id}.csv"`);
      return res.send(eventsToCsv(audit.events));
    }
    return res.json({ complaintId: complaint._id, integrity: { ...audit, events: undefined }, events: audit.events });
  } catch (error) {
    next(error);
  }
}

async function getCorrectionFeedback(req, res, next) {
  try {
    const feedback = await aggregateCorrectionFeedback();
    if (String(req.query.format || "json").toLowerCase() === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=human-review-feedback.csv");
      return res.send(eventsToCsv(feedback.events));
    }
    return res.json(feedback);
  } catch (error) {
    next(error);
  }
}

module.exports = { exportComplaintDecisionAudit, getCorrectionFeedback };
