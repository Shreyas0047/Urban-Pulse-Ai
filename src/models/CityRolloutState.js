const mongoose = require("mongoose");

const cityRolloutStateSchema = new mongoose.Schema(
  {
    cityId: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    cityName: { type: String, required: true, trim: true, maxlength: 80 },
    mode: { type: String, required: true, enum: ["closed", "pilot", "open", "paused"], default: "closed", index: true },
    previousActiveMode: { type: String, enum: ["closed", "pilot", "open"], default: "closed" },
    pilotPercentage: { type: Number, required: true, min: 1, max: 100, default: 10 },
    dailyComplaintLimit: { type: Number, required: true, min: 0, max: 100000, default: 0 },
    pilotStartedAt: { type: Date, default: null },
    configurationHash: { type: String, required: true, minlength: 64, maxlength: 64, trim: true },
    activationReviewId: { type: mongoose.Schema.Types.ObjectId, ref: "CityActivationReview", default: null },
    pauseReason: { type: String, default: "", trim: true, maxlength: 500 },
    pausedAt: { type: Date, default: null },
    changedByRole: { type: String, default: "Admin", trim: true, maxlength: 40 },
    changedByUserId: { type: String, default: "", trim: true, maxlength: 80 },
    history: [
      {
        fromMode: { type: String, required: true },
        toMode: { type: String, required: true },
        reason: { type: String, required: true, maxlength: 500 },
        changedByRole: { type: String, default: "Admin", maxlength: 40 },
        changedByUserId: { type: String, default: "", maxlength: 80 },
        changedAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true, optimisticConcurrency: true }
);

cityRolloutStateSchema.index({ mode: 1, updatedAt: -1 });

module.exports = mongoose.model("CityRolloutState", cityRolloutStateSchema);
