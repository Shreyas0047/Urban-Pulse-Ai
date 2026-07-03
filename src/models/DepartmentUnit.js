const mongoose = require("mongoose");

const departmentUnitSchema = new mongoose.Schema(
  {
    unitId: { type: String, required: true, unique: true, trim: true },
    authority: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    unitName: { type: String, required: true, trim: true },
    ward: { type: String, default: "Citywide", trim: true },
    coverageKeywords: [{ type: String, trim: true }],
    handlesCategoryIds: [{ type: String, trim: true }],
    severityLevels: [{ type: String, trim: true }],
    contactEmail: { type: String, default: "", trim: true, lowercase: true },
    portalUrl: { type: String, default: "", trim: true },
    maxActiveCases: { type: Number, default: 12 },
    active: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

departmentUnitSchema.index({ active: 1, authority: 1, department: 1 });
departmentUnitSchema.index({ handlesCategoryIds: 1 });

module.exports = mongoose.model("DepartmentUnit", departmentUnitSchema);
