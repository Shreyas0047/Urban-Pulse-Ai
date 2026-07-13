const mongoose = require("mongoose");

const cityActivationReviewSchema = new mongoose.Schema(
  {
    cityId: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    cityName: { type: String, required: true, trim: true, maxlength: 80 },
    cityRegistryVersion: { type: String, required: true, trim: true },
    routingRegistryVersion: { type: String, required: true, trim: true },
    configurationHash: { type: String, required: true, trim: true, minlength: 64, maxlength: 64 },
    status: { type: String, required: true, enum: ["draft", "blocked", "ready", "approved", "stale"], default: "draft", index: true },
    evidence: {
      portalSubmissionTestedAt: { type: Date, default: null },
      dashboardIsolationTestedAt: { type: Date, default: null },
      alertIsolationTestedAt: { type: Date, default: null },
      reconciliationOwner: { type: String, default: "", trim: true, maxlength: 120 },
      note: { type: String, default: "", trim: true, maxlength: 1000 },
      attestedByRole: { type: String, default: "", trim: true, maxlength: 40 },
      attestedByUserId: { type: String, default: "", trim: true, maxlength: 80 },
      attestedAt: { type: Date, default: null }
    },
    checkSnapshot: [{ id: String, label: String, passed: Boolean, detail: String }],
    approvedByRole: { type: String, default: "", trim: true, maxlength: 40 },
    approvedByUserId: { type: String, default: "", trim: true, maxlength: 80 },
    approvedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

cityActivationReviewSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model("CityActivationReview", cityActivationReviewSchema);
