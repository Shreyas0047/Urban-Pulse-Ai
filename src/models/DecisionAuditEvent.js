const mongoose = require("mongoose");

const decisionSnapshotSchema = new mongoose.Schema(
  {
    categoryId: { type: String, default: "" },
    type: { type: String, default: "" },
    priority: { type: String, default: "" },
    department: { type: String, default: "" },
    authority: { type: String, default: "" },
    confidence: { type: Number, default: null },
    reviewRequired: { type: Boolean, default: false }
  },
  { _id: false }
);

const decisionAuditEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, immutable: true, index: true },
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", required: true, immutable: true, index: true },
    sequence: { type: Number, required: true, min: 1, immutable: true },
    eventType: { type: String, required: true, enum: ["ai_baseline", "human_review"], immutable: true },
    outcome: { type: String, required: true, trim: true, immutable: true },
    actorType: { type: String, required: true, enum: ["system", "human"], immutable: true },
    actorRole: { type: String, required: true, trim: true, immutable: true },
    before: { type: decisionSnapshotSchema, required: true, immutable: true },
    after: { type: decisionSnapshotSchema, required: true, immutable: true },
    changedFields: [{ type: String, immutable: true }],
    reason: { type: String, default: "", maxlength: 500, immutable: true },
    evidence: { type: mongoose.Schema.Types.Mixed, default: {}, immutable: true },
    previousHash: { type: String, required: true, immutable: true },
    eventHash: { type: String, required: true, immutable: true, index: true },
    occurredAt: { type: Date, required: true, immutable: true }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false
  }
);

decisionAuditEventSchema.index({ complaintId: 1, sequence: 1 }, { unique: true });
decisionAuditEventSchema.index({ eventType: 1, outcome: 1, occurredAt: -1 });

function rejectMutation(next) {
  const error = new Error("Decision audit events are append-only and cannot be changed or deleted.");
  error.statusCode = 405;
  next(error);
}

["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"].forEach((operation) => {
  decisionAuditEventSchema.pre(operation, rejectMutation);
});

module.exports = mongoose.model("DecisionAuditEvent", decisionAuditEventSchema);
