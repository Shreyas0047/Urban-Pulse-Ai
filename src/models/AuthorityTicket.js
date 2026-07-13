const mongoose = require("mongoose");

const authorityTicketSchema = new mongoose.Schema(
  {
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", required: true, unique: true, index: true },
    ticketCode: { type: String, required: true, unique: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    adapter: { type: String, required: true, enum: ["disabled", "email", "webhook"] },
    status: {
      type: String,
      required: true,
      enum: ["queued", "submitting", "submitted", "failed", "not_configured", "acknowledged", "in_progress", "resolved", "rejected"],
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
    reconciledAt: { type: Date, default: null },
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

module.exports = mongoose.model("AuthorityTicket", authorityTicketSchema);
