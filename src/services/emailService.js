const nodemailer = require("nodemailer");
const env = require("../config/env");

let cachedTransporter = null;

function isEmailConfigured() {
  return Boolean(env.smtpHost && env.smtpPort && env.smtpUser && env.smtpPass && env.smtpFrom);
}

function createTransporter() {
  if (!isEmailConfigured()) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in .env.");
  }

  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    requireTLS: !env.smtpSecure && env.smtpPort === 587,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass
    },
    tls: {
      minVersion: "TLSv1.2"
    }
  });

  return cachedTransporter;
}

function getFromAddress() {
  const from = String(env.smtpFrom || env.smtpUser || "").trim();
  if (!from) {
    return "";
  }
  return from.includes("<") ? from : `"Urban Pulse AI" <${from}>`;
}

function normalizeEmailError(error) {
  const code = error?.code || error?.responseCode || "SMTP_ERROR";
  const message = error?.response || error?.message || "SMTP request failed.";
  const details = `${code}: ${message}`;

  if (String(message).toLowerCase().includes("invalid login") || error?.responseCode === 535) {
    return new Error(`${details} Check SMTP_USER and SMTP_PASS. Gmail requires an App Password, not the normal account password.`);
  }

  if (String(message).toLowerCase().includes("self signed") || String(message).toLowerCase().includes("certificate")) {
    return new Error(`${details} Check SMTP TLS settings for the provider.`);
  }

  return new Error(details);
}

async function verifySmtpConnection() {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return {
      ok: true,
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      from: getFromAddress()
    };
  } catch (error) {
    throw normalizeEmailError(error);
  }
}

async function sendMail(options) {
  try {
    const transporter = createTransporter();
    return await transporter.sendMail({
      ...options,
      from: options.from || getFromAddress()
    });
  } catch (error) {
    throw normalizeEmailError(error);
  }
}

async function sendRegistrationOtpEmail({ email, otp, username }) {
  const safeEmail = String(email || "").trim();
  const safeUsername = String(username || "Citizen").trim() || "Citizen";
  const code = String(otp || "").trim();

  if (!safeEmail || !code) {
    throw new Error("Email and OTP are required before sending the registration mail.");
  }

  const bodyLines = [
    `Hello ${safeUsername},`,
    "",
    "Your one-time password for AI Smart Community System registration is:",
    "",
    code,
    "",
    "This OTP is valid for 90 seconds. Do not share it with anyone.",
    "",
    "If you did not request this registration, you can ignore this email."
  ];

  const info = await sendMail({
    to: safeEmail,
    subject: "Your registration OTP",
    text: bodyLines.join("\n")
  });

  return {
    messageId: info.messageId
  };
}

async function sendPasswordResetOtpEmail({ email, otp }) {
  const safeEmail = String(email || "").trim();
  const code = String(otp || "").trim();

  if (!safeEmail || !code) {
    throw new Error("Email and OTP are required before sending the password reset mail.");
  }

  const bodyLines = [
    "Hello,",
    "",
    "Your one-time password for resetting your Urban Pulse AI password is:",
    "",
    code,
    "",
    "This OTP is valid for 90 seconds. Do not share it with anyone.",
    "",
    "If you did not request this password reset, you can ignore this email."
  ];

  const info = await sendMail({
    to: safeEmail,
    subject: "Your password reset OTP",
    text: bodyLines.join("\n")
  });

  return {
    messageId: info.messageId
  };
}

async function sendBbmpComplaintEmail({ subject, report, pdfBase64, filename }) {
  const safeSubject = String(subject || report?.issueType || "Citizen Complaint Report").trim();
  const mailSubject = safeSubject || "Citizen Complaint Report";

  const bodyLines = [
    "Respected Sir/Madam,",
    "",
    "Greetings from the AI Powered Smart Community Problem Detection System.",
    "",
    "Please find attached the formal complaint report submitted by a citizen for your kind attention and necessary action.",
    "",
    `Complaint ID: ${report?.complaintId || "Pending"}`,
    `Issue Type: ${report?.issueType || "Civic Complaint"}`,
    `Location: ${report?.location || "Unknown"}`,
    `Severity: ${report?.priority || "Low"}`,
    `Assigned Authority: ${report?.assignedAuthority || "Gram Panchayat"}`,
    "",
    "Complaint Description:",
    report?.textComplaint || "No complaint text provided.",
    "",
    "AI Description:",
    report?.aiDescription || "No AI description generated.",
    "",
    `Google Maps Link: ${report?.googleMapsUrl || "N/A"}`,
    "",
    "Kindly review the attached complaint report and take the necessary action.",
    "",
    "Regards,",
    `${report?.reporter || "Citizen"}`,
    "AI Powered Smart Community Problem Detection System"
  ];

  const info = await sendMail({
    to: env.bbmpEmailTo,
    subject: mailSubject,
    text: bodyLines.join("\n"),
    attachments: [
      {
        filename: filename || "complaint-report.pdf",
        content: pdfBase64,
        encoding: "base64",
        contentType: "application/pdf"
      }
    ]
  });

  return {
    messageId: info.messageId
  };
}

function getSeverityWarning(severity) {
  const level = String(severity || "Low").trim().toLowerCase();

  if (level === "critical") {
    return "Warning: This complaint has been marked CRITICAL. Please stay alert, avoid the affected area if needed, and take immediate precautions.";
  }

  if (level === "high") {
    return "Warning: This complaint has been marked HIGH severity. Please be careful around the affected area and act quickly if it impacts your safety.";
  }

  if (level === "medium") {
    return "Warning: This complaint has been marked MEDIUM severity. Please remain cautious and keep an eye on the issue until it is resolved.";
  }

  return "Warning: This complaint has been marked LOW severity, but it still needs attention. Please stay aware and avoid ignoring the issue.";
}

async function sendCloseContactsComplaintEmail({ emails, report, reporter }) {
  const safeEmails = Array.isArray(emails) ? emails.map((email) => String(email || "").trim()).filter(Boolean) : [];
  const safeReporter = String(reporter || report?.reporter || "Citizen").trim() || "Citizen";
  const severity = report?.priority || report?.severity || "Low";

  if (!safeEmails.length) {
    throw new Error("At least one contact email is required.");
  }

  const bodyLines = [
    "Hello,",
    "",
    "This is an important community safety update from the AI Powered Smart Community Problem Detection System.",
    "",
    getSeverityWarning(severity),
    "",
    `Complaint from: ${safeReporter}`,
    `Severity: ${severity}`,
    "",
    "Complaint Description:",
    report?.textComplaint || "No complaint description was provided.",
    "",
    "Please take care of this issue and stay safe until it is resolved.",
    "",
    "Regards,",
    "AI Powered Smart Community Problem Detection System"
  ];

  const info = await sendMail({
    to: safeEmails,
    subject: `Community issue warning: ${severity} severity complaint`,
    text: bodyLines.join("\n")
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted || []
  };
}

async function sendEmergencyBroadcastEmail({ emails, complaint, routing, message }) {
  const safeEmails = [...new Set((Array.isArray(emails) ? emails : []).map((email) => String(email || "").trim().toLowerCase()).filter(Boolean))];

  if (!safeEmails.length) {
    throw new Error("At least one emergency broadcast recipient is required.");
  }

  const bodyLines = [
    "Emergency civic alert from Urban Pulse AI.",
    "",
    message,
    "",
    `Issue: ${complaint.type}`,
    `Severity: ${complaint.priority}`,
    `Location: ${complaint.location}`,
    `Assigned unit: ${routing?.unit || complaint.assignedAuthority}`,
    `Department: ${routing?.department || "Response team"}`,
    "",
    "Please avoid the affected area if needed and follow local authority instructions.",
    "",
    "This alert was generated because the complaint was classified as high-risk."
  ];

  const info = await sendMail({
    to: safeEmails,
    subject: `Emergency civic alert: ${complaint.type}`,
    text: bodyLines.join("\n")
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted || []
  };
}

module.exports = {
  isEmailConfigured,
  sendBbmpComplaintEmail,
  sendCloseContactsComplaintEmail,
  sendEmergencyBroadcastEmail,
  sendPasswordResetOtpEmail,
  sendRegistrationOtpEmail,
  verifySmtpConnection
};
