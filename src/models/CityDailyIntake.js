const mongoose = require("mongoose");

const cityDailyIntakeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    cityId: { type: String, required: true, lowercase: true, trim: true, index: true },
    utcDate: { type: String, required: true, trim: true },
    count: { type: Number, required: true, default: 0, min: 0 },
    lastReservedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

cityDailyIntakeSchema.index({ cityId: 1, utcDate: 1 }, { unique: true });

module.exports = mongoose.model("CityDailyIntake", cityDailyIntakeSchema);
