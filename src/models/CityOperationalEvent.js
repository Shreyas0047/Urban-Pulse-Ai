const mongoose = require("mongoose");

const cityOperationalEventSchema = new mongoose.Schema(
  {
    cityId: { type: String, required: true, lowercase: true, trim: true, index: true },
    cityName: { type: String, required: true, trim: true, maxlength: 80 },
    domain: {
      type: String,
      required: true,
      enum: ["complaint_processing", "authority_delivery", "broadcast_delivery"],
      index: true
    },
    outcome: { type: String, required: true, enum: ["success", "degraded", "failure"], index: true },
    eventType: { type: String, required: true, trim: true, maxlength: 80 },
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", default: null },
    latencyMs: { type: Number, default: null, min: 0, max: 3600000 },
    metadata: {
      aiFallbackUsed: { type: Boolean, default: false },
      visionFallbackUsed: { type: Boolean, default: false },
      adapter: { type: String, default: "", maxlength: 40 },
      providerStatus: { type: String, default: "", maxlength: 60 },
      recipientCount: { type: Number, default: 0, min: 0, max: 1000000 }
    },
    occurredAt: { type: Date, required: true, default: Date.now, index: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

cityOperationalEventSchema.index({ cityId: 1, domain: 1, occurredAt: -1 });
cityOperationalEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("CityOperationalEvent", cityOperationalEventSchema);
