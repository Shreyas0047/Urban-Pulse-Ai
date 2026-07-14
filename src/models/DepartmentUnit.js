const mongoose = require("mongoose");

const departmentUnitSchema = new mongoose.Schema(
  {
    unitId: { type: String, required: true, unique: true, trim: true },
    cityId: { type: String, required: true, lowercase: true, trim: true, index: true },
    cityName: { type: String, required: true, trim: true },
    routingRegistryVersion: { type: String, required: true, trim: true },
    authority: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    unitName: { type: String, required: true, trim: true },
    ward: { type: String, default: "Citywide", trim: true },
    coverageKeywords: [{ type: String, trim: true }],
    handlesCategoryIds: [{ type: String, trim: true }],
    severityLevels: [{ type: String, trim: true }],
    contactEmail: { type: String, default: "", trim: true, lowercase: true },
    portalUrl: { type: String, default: "", trim: true },
    escalationDestination: { type: String, default: "BBMP zonal administration", trim: true },
    handoffMode: { type: String, required: true, enum: ["manual_portal", "verified_email", "verified_webhook"], default: "manual_portal" },
    supportsDirectApi: { type: Boolean, required: true, default: false },
    handoffSourceUrl: { type: String, required: true, trim: true },
    handoffVerifiedAt: { type: Date, required: true },
    maxActiveCases: { type: Number, default: 12 },
    active: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

departmentUnitSchema.index({ cityId: 1, active: 1, authority: 1, department: 1 });
departmentUnitSchema.index({ handlesCategoryIds: 1 });

module.exports = mongoose.model("DepartmentUnit", departmentUnitSchema);
