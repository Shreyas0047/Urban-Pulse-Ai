const mongoose = require("mongoose");

const incidentCommandSchema = new mongoose.Schema(
  {
    complaintId: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", required: true, unique: true, index: true },
    incidentCode: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    categoryId: { type: String, required: true, trim: true },
    severity: { type: String, required: true, trim: true },
    ward: { type: String, default: "Citywide", trim: true },
    location: { type: String, required: true, trim: true },
    commandStatus: { type: String, default: "Active", enum: ["Active", "Monitoring", "Resolved", "Closed"] },
    assignedAuthority: { type: String, default: "", trim: true },
    assignedDepartment: { type: String, default: "", trim: true },
    assignedUnit: { type: String, default: "", trim: true },
    slaMinutes: { type: Number, default: 180 },
    slaDueAt: { type: Date, required: true },
    escalationLevel: { type: String, default: "Standard", trim: true },
    checklist: [
      {
        label: { type: String, required: true, trim: true },
        status: { type: String, default: "pending", enum: ["pending", "done", "skipped"] },
        completedAt: { type: Date, default: null }
      }
    ],
    timeline: [
      {
        event: { type: String, required: true, trim: true },
        at: { type: Date, default: Date.now },
        by: { type: String, default: "system", trim: true }
      }
    ],
    broadcastId: { type: mongoose.Schema.Types.ObjectId, ref: "EmergencyBroadcast", default: null },
    riskScore: { type: Number, default: 0 },
    summary: { type: String, default: "", trim: true }
  },
  {
    timestamps: true
  }
);

incidentCommandSchema.index({ commandStatus: 1, slaDueAt: 1 });
incidentCommandSchema.index({ severity: 1, ward: 1 });

module.exports = mongoose.model("IncidentCommand", incidentCommandSchema);
