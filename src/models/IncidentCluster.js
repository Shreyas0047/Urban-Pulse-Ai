const mongoose = require("mongoose");

const incidentClusterSchema = new mongoose.Schema(
  {
    clusterCode: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    categoryId: { type: String, required: true, trim: true, index: true },
    issueType: { type: String, required: true, trim: true },
    status: { type: String, default: "active", enum: ["active", "monitoring", "resolved"], index: true },
    priority: { type: String, default: "Low", trim: true },
    location: { type: String, required: true, trim: true },
    area: { type: String, default: "", trim: true, index: true },
    normalizedArea: { type: String, default: "", trim: true, index: true },
    mapLocation: {
      lat: Number,
      lng: Number
    },
    complaintIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Complaint" }],
    reporterUsernames: [{ type: String, trim: true }],
    imageFingerprints: [{ type: String, trim: true }],
    confidence: { type: Number, default: 0 },
    matchReason: { type: String, default: "" },
    firstReportedAt: { type: Date, default: Date.now },
    lastReportedAt: { type: Date, default: Date.now },
    mergedCount: { type: Number, default: 1 }
  },
  {
    timestamps: true
  }
);

incidentClusterSchema.index({ categoryId: 1, normalizedArea: 1, status: 1 });
incidentClusterSchema.index({ lastReportedAt: -1 });

module.exports = mongoose.model("IncidentCluster", incidentClusterSchema);
