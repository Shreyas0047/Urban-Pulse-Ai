const Complaint = require("../models/Complaint");
const IncidentCommand = require("../models/IncidentCommand");
const User = require("../models/User");
const { transcribeAudio, compareResolutionEvidence } = require("../services/aiClient");
const { createComplaintFromPayload, createHttpError } = require("../services/complaintService");
const { buildFollowUpSchedule, refreshComplaintFollowUp } = require("../services/followUpService");
const { buildComplaintIntelligence } = require("../services/civicIntelligenceService");
const { areaMatchesLocation } = require("../utils/localAlerts");

const ALLOWED_STATUSES = ["Queued", "Needs Review", "In Progress", "Resolved", "Escalated"];
const ALLOWED_PRIORITIES = ["Low", "Medium", "High", "Critical"];
const ALLOWED_VERIFICATION_VOTES = new Set(["still_there", "resolved", "got_worse"]);
const ALLOWED_COMMUNITY_SIGNALS = new Set(["corroborates", "cleared", "worsening"]);
const MAX_VERIFICATION_NOTE_LENGTH = 280;
const MAX_RESOLUTION_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_RESOLUTION_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/x-wav"
]);

function commandStatusForComplaintStatus(status) {
  if (status === "Resolved") return "Resolved";
  if (status === "Escalated") return "Active";
  if (status === "In Progress") return "Active";
  return "Monitoring";
}

function summarizeVerification(votes = []) {
  const summary = {
    stillThere: 0,
    resolved: 0,
    gotWorse: 0,
    total: votes.length,
    citizenStatus: "unverified",
    lastVoteAt: null
  };

  votes.forEach((vote) => {
    if (vote.vote === "still_there") summary.stillThere += 1;
    if (vote.vote === "resolved") summary.resolved += 1;
    if (vote.vote === "got_worse") summary.gotWorse += 1;
    if (vote.createdAt && (!summary.lastVoteAt || new Date(vote.createdAt) > new Date(summary.lastVoteAt))) {
      summary.lastVoteAt = vote.createdAt;
    }
  });

  if (summary.gotWorse > 0 && summary.gotWorse >= summary.resolved) {
    summary.citizenStatus = "getting_worse";
  } else if (summary.stillThere > summary.resolved) {
    summary.citizenStatus = "still_reported";
  } else if (summary.resolved > 0) {
    summary.citizenStatus = "citizen_confirmed_resolved";
  }

  return summary;
}

function canAccessComplaint(auth, complaint) {
  return Boolean(
    auth.permissions.includes("view_dashboard") ||
      (auth.userId && complaint.reporterUserId === String(auth.userId)) ||
      complaint.reporterUsername === auth.username
  );
}

function ownsComplaint(auth, complaint) {
  return Boolean(
    (auth.userId && complaint.reporterUserId === String(auth.userId)) ||
      complaint.reporterUsername === auth.username
  );
}

function normalizeResolutionImage(payload) {
  const imageBase64 = String(payload.imageBase64 || "").trim();
  const imageMimeType = String(payload.imageMimeType || "").trim().toLowerCase();
  if (!imageBase64) return { imageBase64: "", imageMimeType: "" };
  if (!ALLOWED_RESOLUTION_IMAGE_MIME_TYPES.has(imageMimeType)) {
    throw createHttpError("Follow-up photo must be a JPEG, PNG, or WebP image.", 400);
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
    throw createHttpError("Follow-up image payload is invalid.", 400);
  }
  if (Math.floor((imageBase64.length * 3) / 4) > MAX_RESOLUTION_IMAGE_BYTES) {
    throw createHttpError("Follow-up photo is too large. Upload an image smaller than 2 MB.", 413);
  }
  return { imageBase64, imageMimeType };
}

function summarizeCommunityProof(signals = []) {
  const summary = { total: signals.length, corroborates: 0, cleared: 0, worsening: 0, lastSignalAt: null };
  signals.forEach((entry) => {
    if (summary[entry.signal] !== undefined) summary[entry.signal] += 1;
    if (entry.createdAt && (!summary.lastSignalAt || new Date(entry.createdAt) > new Date(summary.lastSignalAt))) {
      summary.lastSignalAt = entry.createdAt;
    }
  });
  return summary;
}

async function canSubmitCommunityProof(auth, complaint) {
  if (ownsComplaint(auth, complaint)) return true;
  if (!auth.userId) return false;
  const user = await User.findById(auth.userId, { localAlertPreferences: 1 }).lean();
  const preferences = user?.localAlertPreferences || {};
  if (!preferences.enabled) return false;
  const locationParts = [complaint.location, complaint.areaIntelligence?.likelyArea, complaint.routing?.ward].filter(Boolean);
  return (preferences.areas || []).some((area) => areaMatchesLocation(area.normalized || area.label, locationParts));
}

async function analyzeAndCreateComplaint(req, res, next) {
  try {
    const { analysis, complaint } = await createComplaintFromPayload(req.auth, req.body);

    res.json({
      nlp: analysis.nlp,
      cv: analysis.cv,
      imageUpload: analysis.imageUpload,
      priority: analysis.priority,
      confidence: analysis.confidence,
      status: analysis.status,
      assignedAuthority: analysis.assignedAuthority,
      routing: analysis.routing,
      broadcast: analysis.broadcast,
      incidentCommand: analysis.incidentCommand,
      incidentCluster: analysis.incidentCluster || complaint.incidentCluster,
      followUp: complaint.followUp,
      verification: complaint.verification,
      mapLocation: analysis.mapLocation,
      areaIntelligence: analysis.areaIntelligence,
      weather: analysis.weather,
      civicEvidence: analysis.civicEvidence,
      threatAssessment: analysis.threatAssessment || analysis.explainability?.threatAssessment || analysis.cv?.threatAssessment || null,
      explainability: analysis.explainability,
      aiMeta: analysis.aiMeta,
      alerts: analysis.alerts,
      notifications: analysis.notifications,
      auth: {
        role: req.auth.role,
        permissions: req.auth.permissions
      },
      complaintId: complaint._id
    });
  } catch (error) {
    next(error);
  }
}

async function getComplaint(req, res, next) {
  try {
    const complaint = await Complaint.findById(req.params.id).lean();
    if (!complaint) {
      throw createHttpError("Complaint not found", 404);
    }

    if (!canAccessComplaint(req.auth, complaint)) {
      throw createHttpError("Permission denied", 403);
    }

    res.json({ complaint, intelligence: buildComplaintIntelligence(complaint) });
  } catch (error) {
    next(error);
  }
}

async function transcribeComplaintAudio(req, res, next) {
  try {
    const audioBase64 = String(req.body.audioBase64 || "").trim();
    const filename = String(req.body.filename || "complaint-audio").trim();
    const mimeType = String(req.body.mimeType || "application/octet-stream").trim();
    const normalizedMimeType = mimeType.toLowerCase().split(";")[0].trim();

    if (!audioBase64) {
      throw createHttpError("Upload an audio file before requesting transcription.", 400);
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(audioBase64)) {
      throw createHttpError("Audio payload is invalid.", 400);
    }
    if (!ALLOWED_AUDIO_MIME_TYPES.has(normalizedMimeType)) {
      throw createHttpError("Unsupported audio type. Record or upload WebM, MP4, MP3, WAV, or OGG audio.", 400);
    }
    const estimatedBytes = Math.floor((audioBase64.length * 3) / 4);
    if (estimatedBytes > MAX_AUDIO_BYTES) {
      throw createHttpError("Audio recording is too large. Try a shorter recording.", 413);
    }

    const transcription = await transcribeAudio({
      audioBase64,
      filename,
      mimeType: normalizedMimeType
    });

    res.json({
      transcript: String(transcription.transcript || "").trim(),
      language: transcription.language || "unknown"
    });
  } catch (error) {
    next(error);
  }
}

async function updateComplaintStatus(req, res, next) {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      const error = new Error("Complaint not found");
      error.statusCode = 404;
      throw error;
    }

    let statusOrPriorityChanged = false;

    if (req.body.status) {
      if (!ALLOWED_STATUSES.includes(req.body.status)) {
        throw createHttpError("Invalid complaint status.", 400);
      }
      complaint.status = req.body.status;
      statusOrPriorityChanged = true;
      complaint.statusHistory = [
        ...(complaint.statusHistory || []),
        {
          status: req.body.status,
          changedBy: req.auth.username,
          changedAt: new Date(),
          note: String(req.body.alertNote || req.body.note || "").trim()
        }
      ];

      if (req.body.status === "Resolved") {
        const existingResolution = complaint.resolution?.toObject ? complaint.resolution.toObject() : (complaint.resolution || {});
        const verificationRequest = "Authority marked this complaint resolved. Please confirm the outcome or report that the issue remains.";
        complaint.resolution = {
          ...existingResolution,
          phase: "awaiting_citizen_verification",
          authorityUpdate: {
            markedBy: req.auth.username,
            markedAt: new Date(),
            note: String(req.body.alertNote || req.body.note || "").trim()
          }
        };
        if (!(complaint.alerts || []).includes(verificationRequest)) {
          complaint.alerts = [...(complaint.alerts || []), verificationRequest];
        }
      } else if (complaint.resolution?.phase === "awaiting_citizen_verification") {
        complaint.resolution.phase = "not_requested";
      }

      if (complaint.incidentCommand?.triggered && complaint.incidentCommand?.incidentId) {
        const commandStatus = commandStatusForComplaintStatus(req.body.status);
        await IncidentCommand.findByIdAndUpdate(complaint.incidentCommand.incidentId, {
          commandStatus,
          $push: {
            timeline: {
              event: `Complaint status changed to ${req.body.status}`,
              at: new Date(),
              by: req.auth.username
            }
          }
        });
        complaint.incidentCommand.status = commandStatus;
      }
    }

    if (req.body.priority) {
      if (!ALLOWED_PRIORITIES.includes(req.body.priority)) {
        throw createHttpError("Invalid complaint priority.", 400);
      }
      complaint.priority = req.body.priority;
      statusOrPriorityChanged = true;
    }
    if (statusOrPriorityChanged) {
      complaint.followUp = {
        ...(complaint.followUp || {}),
        ...buildFollowUpSchedule(complaint, new Date())
      };
      refreshComplaintFollowUp(complaint);
    }
    if (req.body.alertNote) {
      complaint.alerts = [...complaint.alerts, req.body.alertNote];
    }

    await complaint.save();

    res.json({
      message: "Complaint status updated successfully.",
      complaint
    });
  } catch (error) {
    next(error);
  }
}

async function acknowledgeAlert(req, res, next) {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      const error = new Error("Complaint not found");
      error.statusCode = 404;
      throw error;
    }

    const note = `Alert acknowledged by ${req.auth.username}`;
    if (!complaint.alerts.includes(note)) {
      complaint.alerts = [...complaint.alerts, note];
      await complaint.save();
    }

    res.json({
      message: "Alert acknowledged successfully.",
      complaint
    });
  } catch (error) {
    next(error);
  }
}

async function verifyComplaintStatus(req, res, next) {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      throw createHttpError("Complaint not found", 404);
    }
    if (!ownsComplaint(req.auth, complaint)) {
      throw createHttpError("Permission denied", 403);
    }

    const vote = String(req.body.vote || "").trim();
    const note = String(req.body.note || "").replace(/\s+/g, " ").trim();
    if (!ALLOWED_VERIFICATION_VOTES.has(vote)) {
      throw createHttpError("Choose a valid verification vote.", 400);
    }
    if (note.length > MAX_VERIFICATION_NOTE_LENGTH) {
      throw createHttpError(`Verification note must be ${MAX_VERIFICATION_NOTE_LENGTH} characters or fewer.`, 400);
    }

    complaint.verification = complaint.verification || {
      summary: summarizeVerification([]),
      votes: []
    };
    const userKey = String(req.auth.userId || req.auth.username || "").trim();
    const existingIndex = (complaint.verification?.votes || []).findIndex((entry) =>
      String(entry.userId || entry.username || "") === userKey
    );
    const voteRecord = {
      userId: String(req.auth.userId || ""),
      username: req.auth.username || "",
      vote,
      note,
      createdAt: new Date()
    };

    if (existingIndex >= 0) {
      complaint.verification.votes[existingIndex] = voteRecord;
    } else {
      complaint.verification.votes = [...(complaint.verification?.votes || []), voteRecord];
    }

    complaint.verification.summary = summarizeVerification(complaint.verification.votes);
    const readableVote = vote.replace(/_/g, " ");
    const auditNote = `Citizen verification: ${readableVote}${note ? ` - ${note}` : ""}`;
    complaint.statusHistory = [
      ...(complaint.statusHistory || []),
      {
        status: complaint.status,
        changedBy: req.auth.username || "citizen",
        changedAt: new Date(),
        note: auditNote
      }
    ];

    if (vote === "got_worse") {
      complaint.alerts = [...(complaint.alerts || []), auditNote];
      if (complaint.status !== "Resolved") {
        complaint.followUp = {
          ...(complaint.followUp || {}),
          status: "overdue",
          escalationNote: "Citizen verification says the issue got worse."
        };
      }
    }

    await complaint.save();

    res.json({
      message: "Citizen verification recorded.",
      verification: complaint.verification
    });
  } catch (error) {
    next(error);
  }
}

async function submitResolutionEvidence(req, res, next) {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      throw createHttpError("Complaint not found", 404);
    }
    if (!ownsComplaint(req.auth, complaint)) {
      throw createHttpError("Permission denied", 403);
    }

    const vote = String(req.body.vote || "").trim();
    const note = String(req.body.note || "").replace(/\s+/g, " ").trim();
    if (!ALLOWED_VERIFICATION_VOTES.has(vote)) {
      throw createHttpError("Choose a valid resolution verification response.", 400);
    }
    if (note.length > MAX_VERIFICATION_NOTE_LENGTH) {
      throw createHttpError(`Resolution note must be ${MAX_VERIFICATION_NOTE_LENGTH} characters or fewer.`, 400);
    }

    const imagePayload = normalizeResolutionImage(req.body);
    const comparison = await compareResolutionEvidence({
      originalCategoryId: complaint.ai?.categoryId || "general",
      originalType: complaint.type,
      originalPriority: complaint.priority,
      location: complaint.location,
      vote,
      note,
      imageFeatures: req.body.imageFeatures || null,
      ...imagePayload
    });
    const phase = comparison.outcome || "needs_admin_review";
    const evidenceRecord = {
      userId: String(req.auth.userId || ""),
      username: req.auth.username || "citizen",
      vote,
      note,
      imageProvided: Boolean(imagePayload.imageBase64 || req.body.imageFeatures),
      imageFingerprint: String(comparison.followUpEvidence?.imageFingerprint || ""),
      submittedAt: new Date()
    };

    const existingResolution = complaint.resolution?.toObject ? complaint.resolution.toObject() : (complaint.resolution || {});
    complaint.resolution = {
      ...existingResolution,
      phase,
      citizenEvidence: [...(complaint.resolution?.citizenEvidence || []), evidenceRecord].slice(-12),
      aiAssessment: {
        outcome: phase,
        confidence: Number(comparison.confidence || 0),
        reason: String(comparison.reason || "Resolution evidence requires review."),
        visualComparison: String(comparison.visualComparison || "not_available"),
        engine: String(comparison.engine || "resolution-evidence-comparator-v1"),
        assessedAt: new Date(),
        disclaimer: String(comparison.disclaimer || "")
      }
    };

    const outcomeNote = `Resolution review: ${phase.replace(/_/g, " ")} - ${comparison.reason || "Follow-up recorded."}`;
    let reopenedStatus = "";
    if (phase === "needs_rework") {
      reopenedStatus = complaint.priority === "Critical" ? "Escalated" : "In Progress";
      complaint.status = reopenedStatus;
      complaint.followUp = {
        ...(complaint.followUp || {}),
        status: "overdue",
        escalationNote: "Citizen resolution evidence indicates the issue remains or worsened."
      };
      complaint.alerts = [...(complaint.alerts || []), outcomeNote];
    }
    if (phase === "needs_admin_review") {
      complaint.followUp = {
        ...(complaint.followUp || {}),
        status: "due",
        escalationNote: "Resolution evidence needs an authority review."
      };
    }

    complaint.statusHistory = [
      ...(complaint.statusHistory || []),
      { status: complaint.status, changedBy: req.auth.username || "citizen", changedAt: new Date(), note: outcomeNote }
    ];
    if (reopenedStatus && complaint.incidentCommand?.triggered && complaint.incidentCommand?.incidentId) {
      const commandStatus = commandStatusForComplaintStatus(reopenedStatus);
      await IncidentCommand.findByIdAndUpdate(complaint.incidentCommand.incidentId, {
        commandStatus,
        $push: {
          timeline: {
            event: `Resolution evidence reopened complaint as ${reopenedStatus}`,
            at: new Date(),
            by: req.auth.username || "citizen"
          }
        }
      });
      complaint.incidentCommand.status = commandStatus;
    }

    await complaint.save();
    res.json({ message: "Resolution evidence recorded.", resolution: complaint.resolution, complaint });
  } catch (error) {
    next(error);
  }
}

async function submitCommunityProof(req, res, next) {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) throw createHttpError("Complaint not found", 404);
    if (!(await canSubmitCommunityProof(req.auth, complaint))) {
      throw createHttpError("Community proof is available only for your saved local-alert areas.", 403);
    }
    if (complaint.status === "Resolved") {
      throw createHttpError("This incident is already resolved. Use the resolution confirmation flow instead.", 400);
    }

    const signal = String(req.body.signal || "").trim();
    const note = String(req.body.note || "").replace(/\s+/g, " ").trim();
    if (!ALLOWED_COMMUNITY_SIGNALS.has(signal)) throw createHttpError("Choose a valid community proof signal.", 400);
    if (note.length > MAX_VERIFICATION_NOTE_LENGTH) throw createHttpError(`Community note must be ${MAX_VERIFICATION_NOTE_LENGTH} characters or fewer.`, 400);

    const userKey = String(req.auth.userId || "");
    const existing = (complaint.communityProof?.signals || []).filter((entry) => String(entry.userId || "") !== userKey);
    const signals = [...existing, { userId: userKey, signal, note, createdAt: new Date() }].slice(-24);
    complaint.communityProof = { summary: summarizeCommunityProof(signals), signals };
    const audit = `Community proof: ${signal}${note ? ` - ${note}` : ""}`;
    complaint.statusHistory = [...(complaint.statusHistory || []), { status: complaint.status, changedBy: "community-proof", changedAt: new Date(), note: audit }];
    if (signal === "worsening") complaint.alerts = [...(complaint.alerts || []), audit];
    await complaint.save();
    res.json({ message: "Community proof recorded.", communityProof: complaint.communityProof });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  analyzeAndCreateComplaint,
  getComplaint,
  transcribeComplaintAudio,
  updateComplaintStatus,
  acknowledgeAlert,
  verifyComplaintStatus,
  submitResolutionEvidence,
  submitCommunityProof
};
