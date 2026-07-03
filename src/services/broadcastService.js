const EmergencyBroadcast = require("../models/EmergencyBroadcast");
const User = require("../models/User");
const { isEmailConfigured, sendEmergencyBroadcastEmail } = require("./emailService");
const { canonicalPriority } = require("./routingService");

const DANGEROUS_CATEGORY_IDS = new Set([
  "safety_fire",
  "utility_fault",
  "security",
  "tree_obstruction",
  "sewage_overflow",
  "road_damage",
  "vehicle_obstruction"
]);

function shouldTriggerEmergencyBroadcast(analysis, confidenceScore) {
  const priority = canonicalPriority(analysis.priority?.level);
  const categoryId = analysis.aiMeta?.categoryId || "general";
  const reviewRequired = Boolean(analysis.reviewRequired || analysis.decision?.reviewRequired);
  const conflictDetected = Boolean(analysis.conflictDetected || analysis.decision?.conflictDetected);

  if (priority === "Critical") {
    return true;
  }

  if (priority !== "High") {
    return false;
  }

  if (!DANGEROUS_CATEGORY_IDS.has(categoryId)) {
    return false;
  }

  return confidenceScore >= 0.52 && (!conflictDetected || !reviewRequired);
}

function buildEmergencyMessage({ complaint, routing }) {
  return `${canonicalPriority(complaint.priority)} priority ${complaint.type} reported at ${complaint.location}. ${routing.unit} has been assigned under ${routing.department}.`;
}

function nearbyReporterKeys(recentAreaComplaints) {
  const usernames = new Set();
  const userIds = new Set();

  (recentAreaComplaints || []).forEach((complaint) => {
    const username = String(complaint.reporterUsername || "").trim();
    const userId = String(complaint.reporterUserId || "").trim();
    if (username) usernames.add(username);
    if (/^[a-f\d]{24}$/i.test(userId)) userIds.add(userId);
  });

  return { usernames, userIds };
}

async function resolveRecipients({ recentAreaComplaints }) {
  const { usernames, userIds } = nearbyReporterKeys(recentAreaComplaints);
  const filters = [
    { role: "Admin", disabledAt: null }
  ];

  if (usernames.size) {
    filters.push({ username: { $in: [...usernames] }, disabledAt: null });
  }

  if (userIds.size) {
    filters.push({ _id: { $in: [...userIds] }, disabledAt: null });
  }

  const users = await User.find({ $or: filters }, { email: 1, role: 1, username: 1 }).lean().catch(() => []);
  const seen = new Set();

  return users
    .filter((user) => user.email)
    .map((user) => ({
      email: String(user.email).toLowerCase(),
      role: user.role,
      reason: user.role === "Admin" ? "admin responder" : "nearby prior reporter",
      status: "pending"
    }))
    .filter((recipient) => {
      if (seen.has(recipient.email)) return false;
      seen.add(recipient.email);
      return true;
    });
}

async function createEmergencyBroadcast({ complaint, analysis, routing, mapLocation, confidenceScore, recentAreaComplaints, triggeredBy }) {
  if (!shouldTriggerEmergencyBroadcast(analysis, confidenceScore)) {
    return null;
  }

  const recipients = await resolveRecipients({ recentAreaComplaints });
  const message = buildEmergencyMessage({ complaint, routing });
  const channels = ["in-app", "email", "sms-ready"];
  const broadcast = await EmergencyBroadcast.create({
    complaintId: complaint._id,
    categoryId: analysis.aiMeta?.categoryId || "general",
    issueType: complaint.type,
    severity: canonicalPriority(complaint.priority),
    location: complaint.location,
    mapLocation,
      radiusKm: canonicalPriority(complaint.priority) === "Critical" ? 4 : 2,
    channels,
    recipients,
    message,
    triggeredBy: triggeredBy || "system",
    status: "created"
  });

  if (!recipients.length) {
    broadcast.status = "skipped";
    broadcast.delivery.email.error = "No eligible recipients with email addresses.";
    await broadcast.save();
    return broadcast;
  }

  if (!isEmailConfigured()) {
    broadcast.status = "skipped";
    broadcast.recipients = recipients.map((recipient) => ({ ...recipient, status: "in-app-only" }));
    broadcast.delivery.email.error = "SMTP is not configured; in-app broadcast record created.";
    await broadcast.save();
    return broadcast;
  }

  try {
    const emailResult = await sendEmergencyBroadcastEmail({
      emails: recipients.map((recipient) => recipient.email),
      complaint,
      routing,
      message
    });
    const accepted = new Set((emailResult.accepted || []).map((email) => String(email).toLowerCase()));
    broadcast.status = accepted.size === recipients.length ? "sent" : "partial";
    broadcast.sentAt = new Date();
    broadcast.recipients = recipients.map((recipient) => ({
      ...recipient,
      status: accepted.has(recipient.email) ? "sent" : "pending"
    }));
    broadcast.delivery.email = {
      attempted: true,
      sent: accepted.size > 0,
      messageId: emailResult.messageId || "",
      error: "",
      accepted: [...accepted]
    };
    await broadcast.save();
    return broadcast;
  } catch (error) {
    broadcast.status = "failed";
    broadcast.delivery.email = {
      attempted: true,
      sent: false,
      messageId: "",
      error: error.message || "Emergency broadcast email failed.",
      accepted: []
    };
    await broadcast.save();
    return broadcast;
  }
}

module.exports = {
  DANGEROUS_CATEGORY_IDS,
  createEmergencyBroadcast,
  shouldTriggerEmergencyBroadcast
};
