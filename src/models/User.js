const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    mobileNumber: { type: String, unique: true, sparse: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ["Admin", "Citizen"] },
    disabledAt: { type: Date, default: null },
    disabledBy: { type: String, default: "" },
    lastLoginAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);
