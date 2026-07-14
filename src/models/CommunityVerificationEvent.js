const mongoose = require("mongoose");

const communityVerificationEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  complaintId: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", required: true, index: true },
  actorHash: { type: String, required: true, select: false },
  areaKeyHash: { type: String, required: true, select: false },
  signal: { type: String, required: true, enum: ["still_present", "worsening", "resolved", "duplicate"] },
  priorSignal: { type: String, default: "" },
  duplicateComplaintId: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", default: null },
  eligibility: { type: String, default: "saved_area" },
  outcome: { type: String, required: true, enum: ["created", "revised", "idempotent", "rejected"] },
  requestId: { type: String, default: "" },
  summary: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, immutable: true }
}, { versionKey: false });

communityVerificationEventSchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "deleteOne", "deleteMany"], function rejectMutation(next) {
  next(new Error("Community verification audit events are immutable."));
});

module.exports = mongoose.model("CommunityVerificationEvent", communityVerificationEventSchema);
