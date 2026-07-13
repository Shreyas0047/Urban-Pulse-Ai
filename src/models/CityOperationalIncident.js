const mongoose = require("mongoose");

const incidentTimelineSchema = new mongoose.Schema(
  {
    event: { type: String, required: true, maxlength: 160 },
    note: { type: String, default: "", maxlength: 500 },
    byRole: { type: String, default: "system", maxlength: 40 },
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const cityOperationalIncidentSchema = new mongoose.Schema(
  {
    activeKey: { type: String, unique: true, sparse: true, trim: true, maxlength: 180 },
    cityId: { type: String, required: true, lowercase: true, trim: true, index: true },
    cityName: { type: String, required: true, trim: true, maxlength: 80 },
    trigger: {
      type: String,
      required: true,
      enum: ["complaint_failure_rate", "ai_degradation_rate", "authority_failure_rate", "broadcast_failure_rate"],
      index: true
    },
    domain: { type: String, required: true, maxlength: 60 },
    status: { type: String, required: true, enum: ["open", "acknowledged", "resolved"], default: "open", index: true },
    reason: { type: String, required: true, maxlength: 500 },
    windowMinutes: { type: Number, required: true, min: 1, max: 1440 },
    sampleSize: { type: Number, required: true, min: 0 },
    affectedCount: { type: Number, required: true, min: 0 },
    observedRate: { type: Number, required: true, min: 0, max: 1 },
    threshold: { type: Number, required: true, min: 0, max: 1 },
    rolloutStateId: { type: mongoose.Schema.Types.ObjectId, ref: "CityRolloutState", default: null },
    openedAt: { type: Date, required: true, default: Date.now },
    acknowledgedAt: { type: Date, default: null },
    acknowledgedByRole: { type: String, default: "", maxlength: 40 },
    acknowledgedByUserId: { type: String, default: "", maxlength: 80 },
    acknowledgementNote: { type: String, default: "", maxlength: 500 },
    resolvedAt: { type: Date, default: null },
    resolvedByRole: { type: String, default: "", maxlength: 40 },
    timeline: { type: [incidentTimelineSchema], default: [] }
  },
  { timestamps: true, optimisticConcurrency: true }
);

cityOperationalIncidentSchema.index({ cityId: 1, status: 1, openedAt: -1 });
cityOperationalIncidentSchema.index({ cityId: 1, trigger: 1, status: 1 });

module.exports = mongoose.model("CityOperationalIncident", cityOperationalIncidentSchema);
