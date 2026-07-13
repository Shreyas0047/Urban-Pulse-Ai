const mongoose = require("mongoose");

const authorityTicketSchema = new mongoose.Schema(
  {
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", required: true, unique: true, index: true },
    cityId: { type: String, required: true, default: "bengaluru", lowercase: true, trim: true, index: true },
    cityName: { type: String, required: true, default: "Bengaluru", trim: true },
    authority: { type: String, required: true, default: "Unassigned authority", trim: true, maxlength: 160 },
    department: { type: String, required: true, default: "Unassigned department", trim: true, maxlength: 160 },
    severity: { type: String, required: true, enum: ["Low", "Medium", "High", "Critical"], default: "Medium", index: true },
    unitId: { type: String, required: true, default: "unassigned", trim: true, maxlength: 120 },
    handoffMode: { type: String, required: true, default: "manual_portal", enum: ["manual_portal", "verified_email", "verified_webhook"] },
    portalUrl: { type: String, default: "", maxlength: 500 },
    ticketCode: { type: String, required: true, unique: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    adapter: { type: String, required: true, enum: ["disabled", "manual_portal", "email", "webhook"] },
    status: {
      type: String,
      required: true,
      enum: ["queued", "submitting", "awaiting_manual_submission", "submitted", "failed", "not_configured", "acknowledged", "in_progress", "resolved", "rejected"],
      default: "queued",
      index: true
    },
    externalReference: { type: String, default: "", maxlength: 180 },
    destination: { type: String, default: "", maxlength: 180 },
    payloadHash: { type: String, required: true },
    attemptCount: { type: Number, default: 0 },
    attempts: [
      {
        attemptedAt: { type: Date, default: Date.now },
        outcome: { type: String, enum: ["submitted", "failed", "not_configured"] },
        statusCode: { type: Number, default: null },
        errorCode: { type: String, default: "" },
        message: { type: String, default: "", maxlength: 300 }
      }
    ],
    lastError: { type: String, default: "", maxlength: 300 },
    nextRetryAt: { type: Date, default: null, index: true },
    submittedAt: { type: Date, default: null },
    manualSubmission: {
      externalReference: { type: String, default: "", maxlength: 180 },
      note: { type: String, default: "", maxlength: 500 },
      confirmedByRole: { type: String, default: "", maxlength: 40 },
      confirmedAt: { type: Date, default: null },
      portalUrl: { type: String, default: "", maxlength: 500 }
    },
    reconciledAt: { type: Date, default: null },
    sla: {
      policyVersion: { type: String, default: "authority-sla-v1", maxlength: 40 },
      handoffDueAt: { type: Date, default: null, index: true },
      acknowledgementDueAt: { type: Date, default: null, index: true },
      resolutionDueAt: { type: Date, default: null, index: true },
      currentStage: { type: String, enum: ["handoff", "acknowledgement", "resolution", "complete"], default: "handoff" },
      status: { type: String, enum: ["on_track", "overdue", "completed"], default: "on_track", index: true },
      escalationLevel: { type: Number, default: 0, min: 0, max: 3 },
      lastEvaluatedAt: { type: Date, default: null },
      history: [
        {
          stage: { type: String, required: true, enum: ["handoff", "acknowledgement", "resolution"] },
          level: { type: Number, required: true, min: 1, max: 3 },
          dueAt: { type: Date, required: true },
          detectedAt: { type: Date, default: Date.now },
          message: { type: String, required: true, maxlength: 300 }
        }
      ]
    },
    reconciliationHistory: [
      {
        status: { type: String, required: true },
        note: { type: String, default: "", maxlength: 300 },
        changedByRole: { type: String, default: "Admin" },
        changedAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

authorityTicketSchema.index({ status: 1, nextRetryAt: 1 });
authorityTicketSchema.index({ cityId: 1, status: 1, createdAt: -1 });
authorityTicketSchema.index({ cityId: 1, "sla.status": 1, "sla.currentStage": 1 });

module.exports = mongoose.model("AuthorityTicket", authorityTicketSchema);
