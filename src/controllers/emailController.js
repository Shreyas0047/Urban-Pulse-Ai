const { sendBbmpComplaintEmail, sendCloseContactsComplaintEmail } = require("../services/emailService");
const Complaint = require("../models/Complaint");
const mongoose = require("mongoose");

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_SUBJECT_LENGTH = 180;
const MAX_FILENAME_LENGTH = 120;
const MAX_CLOSE_CONTACT_EMAILS = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeText(value, maxLength) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.slice(0, maxLength);
}

function sanitizeFilename(filename) {
  const cleaned = String(filename || "complaint-report.pdf")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .slice(0, MAX_FILENAME_LENGTH);

  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

function validateAttachment(pdfBase64) {
  const normalized = String(pdfBase64 || "").trim();
  if (!normalized) {
    throw createHttpError("Complaint PDF attachment is missing.", 400);
  }

  if (!/^[A-Za-z0-9+/=]+$/.test(normalized)) {
    throw createHttpError("Complaint PDF attachment is invalid.", 400);
  }

  const estimatedBytes = Math.floor((normalized.length * 3) / 4);
  if (estimatedBytes > MAX_ATTACHMENT_BYTES) {
    throw createHttpError("Complaint PDF attachment is too large.", 413);
  }

  return normalized;
}

function validateReport(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    throw createHttpError("Complaint report data is missing.", 400);
  }

  return {
    complaintId: normalizeText(report.complaintId, 60),
    textComplaint: normalizeText(report.textComplaint, 1000),
    location: normalizeText(report.location, 180),
    aiDescription: normalizeText(report.aiDescription, 400),
    authority: normalizeText(report.authority, 80),
    issueType: normalizeText(report.issueType, 100),
    severity: normalizeText(report.severity || report.priority, 40),
    priority: normalizeText(report.priority || report.severity, 40),
    mapsLink: normalizeText(report.mapsLink, 500)
  };
}

async function assertReportComplaintAccess(req, report) {
  if (!report.complaintId || report.complaintId === "Pending") {
    throw createHttpError("A saved complaint ID is required before sending email.", 400);
  }
  if (!mongoose.Types.ObjectId.isValid(report.complaintId)) {
    throw createHttpError("A valid complaint ID is required before sending email.", 400);
  }

  const complaint = await Complaint.findById(report.complaintId).lean();
  if (!complaint) {
    throw createHttpError("Complaint not found.", 404);
  }

  const canViewDashboard = req.auth?.permissions?.includes("view_dashboard");
  const ownsComplaint =
    (req.auth?.userId && complaint.reporterUserId === String(req.auth.userId)) ||
    complaint.reporterUsername === req.auth?.username;

  if (!canViewDashboard && !ownsComplaint) {
    throw createHttpError("Permission denied for this complaint email.", 403);
  }

  return complaint;
}

function validateCloseContactEmails(emails) {
  if (!Array.isArray(emails)) {
    throw createHttpError("Contact emails must be provided as a list.", 400);
  }

  const normalizedEmails = [...new Set(emails.map((email) => String(email || "").trim().toLowerCase()).filter(Boolean))];

  if (!normalizedEmails.length) {
    throw createHttpError("Enter at least one contact email.", 400);
  }

  if (normalizedEmails.length > MAX_CLOSE_CONTACT_EMAILS) {
    throw createHttpError("You can inform up to 5 email IDs only.", 400);
  }

  const invalidEmail = normalizedEmails.find((email) => !EMAIL_PATTERN.test(email));
  if (invalidEmail) {
    throw createHttpError(`Enter a valid email address for ${invalidEmail}.`, 400);
  }

  return normalizedEmails;
}

async function emailBbmpComplaint(req, res, next) {
  try {
    const report = validateReport(req.body.report);
    await assertReportComplaintAccess(req, report);
    const pdfBase64 = validateAttachment(req.body.pdfBase64);
    const filename = sanitizeFilename(req.body.filename);
    const subject = normalizeText(req.body.subject || report.textComplaint || report.issueType || "Community complaint report", MAX_SUBJECT_LENGTH);

    const emailResult = await sendBbmpComplaintEmail({
      subject,
      report,
      pdfBase64,
      filename
    });

    res.json({
      sent: true,
      message: "Complaint email sent to the configured authority channel.",
      messageId: emailResult.messageId
    });
  } catch (error) {
    next(error);
  }
}

async function informCloseContacts(req, res, next) {
  try {
    const report = validateReport(req.body.report);
    await assertReportComplaintAccess(req, report);
    const emails = validateCloseContactEmails(req.body.emails);
    const emailResult = await sendCloseContactsComplaintEmail({
      emails,
      report,
      reporter: req.auth?.username || report.reporter
    });

    res.json({
      sent: true,
      message: `Warning email sent to ${emails.length} close contact${emails.length === 1 ? "" : "s"}.`,
      messageId: emailResult.messageId
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  emailBbmpComplaint,
  informCloseContacts
};
