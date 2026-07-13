const mongoose = require("mongoose");

const emergencyBroadcastSchema = new mongoose.Schema(
  {
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", required: true, index: true },
    cityId: { type: String, required: true, default: "bengaluru", lowercase: true, trim: true, index: true },
    cityName: { type: String, required: true, default: "Bengaluru", trim: true },
    categoryId: { type: String, required: true, trim: true },
    issueType: { type: String, required: true, trim: true },
    severity: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    mapLocation: {
      lat: Number,
      lng: Number
    },
    radiusKm: { type: Number, default: 2 },
    channels: [{ type: String, trim: true }],
    recipients: [
      {
        email: { type: String, trim: true, lowercase: true },
        role: { type: String, trim: true },
        reason: { type: String, trim: true },
        status: { type: String, default: "pending", trim: true }
      }
    ],
    message: { type: String, required: true },
    status: { type: String, default: "created", enum: ["created", "sent", "partial", "skipped", "failed"] },
    delivery: {
      email: {
        attempted: { type: Boolean, default: false },
        sent: { type: Boolean, default: false },
        messageId: { type: String, default: "" },
        error: { type: String, default: "" },
        accepted: [{ type: String }]
      },
      inApp: {
        created: { type: Boolean, default: true }
      },
      sms: {
        attempted: { type: Boolean, default: false },
        sent: { type: Boolean, default: false },
        error: { type: String, default: "SMS channel not configured" }
      }
    },
    triggeredBy: { type: String, default: "system", trim: true },
    sentAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

emergencyBroadcastSchema.index({ status: 1, createdAt: -1 });
emergencyBroadcastSchema.index({ severity: 1, categoryId: 1 });
emergencyBroadcastSchema.index({ cityId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("EmergencyBroadcast", emergencyBroadcastSchema);
