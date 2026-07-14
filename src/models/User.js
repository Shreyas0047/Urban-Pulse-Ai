const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    mobileNumber: { type: String, unique: true, sparse: true, trim: true },
    passwordHash: { type: String, required: true },
    tokenVersion: { type: Number, default: 0 },
    role: { type: String, required: true, enum: ["Admin", "Citizen"] },
    disabledAt: { type: Date, default: null },
    disabledBy: { type: String, default: "" },
    lastLoginAt: { type: Date, default: null },
    localAlertPreferences: {
      enabled: { type: Boolean, default: false },
      areas: [
        {
          label: { type: String, trim: true },
          normalized: { type: String, trim: true },
          addedAt: { type: Date, default: Date.now }
        }
      ],
      severityThreshold: { type: String, default: "High", enum: ["Medium", "High", "Critical"] },
      updatedAt: { type: Date, default: null }
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ "localAlertPreferences.enabled": 1 });

module.exports = mongoose.model("User", userSchema);
