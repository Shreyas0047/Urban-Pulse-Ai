const mongoose = require("mongoose");

const externalApiUsageSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, trim: true, lowercase: true },
    month: { type: String, required: true, trim: true },
    count: { type: Number, default: 0, min: 0 },
    limit: { type: Number, required: true, min: 0 },
    lastUsedAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

externalApiUsageSchema.index({ provider: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("ExternalApiUsage", externalApiUsageSchema);
