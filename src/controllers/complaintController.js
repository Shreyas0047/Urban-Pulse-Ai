const Complaint = require("../models/Complaint");
const IncidentCommand = require("../models/IncidentCommand");
const { transcribeAudio } = require("../services/aiClient");
const { createComplaintFromPayload, createHttpError } = require("../services/complaintService");
const { buildFollowUpSchedule, refreshComplaintFollowUp } = require("../services/followUpService");

const ALLOWED_STATUSES = ["Queued", "Needs Review", "In Progress", "Resolved", "Escalated"];
const ALLOWED_PRIORITIES = ["Low", "Medium", "High", "Critical"];
const ALLOWED_VERIFICATION_VOTES = new Set(["still_there", "resolved", "got_worse"]);
const MAX_VERIFICATION_NOTE_LENGTH = 280;
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

    const canViewDashboard = req.auth.permissions.includes("view_dashboard");
    const ownsComplaint =
      (req.auth.userId && complaint.reporterUserId === String(req.auth.userId)) ||
      complaint.reporterUsername === req.auth.username;

    if (!canViewDashboard && !ownsComplaint) {
      throw createHttpError("Permission denied", 403);
    }

    res.json({ complaint });
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

module.exports = {
  analyzeAndCreateComplaint,
  getComplaint,
  transcribeComplaintAudio,
  updateComplaintStatus,
  acknowledgeAlert,
  verifyComplaintStatus
};
