const Complaint = require("../models/Complaint");
const {
  aggregateCorrectionFeedback,
  eventsToCsv,
  verifyDecisionAudit
} = require("../services/decisionAuditService");
const { assertOperationalCityAccess, operationalCityDataFilter } = require("../services/operationalAccessService");

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

async function exportComplaintDecisionAudit(req, res, next) {
  try {
    const complaint = await Complaint.findById(req.params.id).lean();
    if (!complaint) throw notFound("Complaint not found");
    assertOperationalCityAccess(req.auth, complaint);
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
    const requestedCityId = req.query.cityId || req.auth.operationalCityIds?.[0] || "bengaluru";
    const cityId = assertOperationalCityAccess(req.auth, requestedCityId);
    const complaints = await Complaint.find(operationalCityDataFilter(cityId), { _id: 1 }).lean();
    const feedback = await aggregateCorrectionFeedback({ complaintIds: complaints.map((complaint) => complaint._id) });
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
