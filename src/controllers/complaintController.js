const Complaint = require("../models/Complaint");
const IncidentCommand = require("../models/IncidentCommand");
const { transcribeAudio } = require("../services/aiClient");
const { createComplaintFromPayload, createHttpError } = require("../services/complaintService");

const ALLOWED_STATUSES = ["Queued", "Needs Review", "In Progress", "Resolved", "Escalated"];
const ALLOWED_PRIORITIES = ["Low", "Medium", "High", "Critical"];

function commandStatusForComplaintStatus(status) {
  if (status === "Resolved") return "Resolved";
  if (status === "Escalated") return "Active";
  if (status === "In Progress") return "Active";
  return "Monitoring";
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
      mapLocation: analysis.mapLocation,
      weather: analysis.weather,
      civicEvidence: analysis.civicEvidence,
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

    if (!audioBase64) {
      throw createHttpError("Upload an audio file before requesting transcription.", 400);
    }

    const transcription = await transcribeAudio({
      audioBase64,
      filename,
      mimeType
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

    if (req.body.status) {
      if (!ALLOWED_STATUSES.includes(req.body.status)) {
        throw createHttpError("Invalid complaint status.", 400);
      }
      complaint.status = req.body.status;
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

module.exports = {
  analyzeAndCreateComplaint,
  getComplaint,
  transcribeComplaintAudio,
  updateComplaintStatus,
  acknowledgeAlert
};
