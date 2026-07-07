const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    reporter: { type: String, required: true },
    reporterUserId: { type: String, default: "" },
    reporterUsername: { type: String, required: true },
    type: { type: String, required: true },
    priority: { type: String, required: true },
    status: { type: String, required: true },
    source: { type: String, required: true },
    confidence: { type: Number, required: true },
    location: { type: String, required: true },
    assignedAuthority: { type: String, default: "Gram Panchayat" },
    routing: {
      authority: String,
      department: String,
      unit: String,
      unitId: String,
      ward: String,
      escalationLevel: String,
      workloadScore: Number,
      activeCaseLoad: Number,
      maxActiveCases: Number,
      contactEmail: String,
      portalUrl: String,
      routingReason: String,
      alternatives: [
        {
          unitId: String,
          department: String,
          unit: String,
          authority: String,
          score: Number,
          activeCaseLoad: Number,
          workloadScore: Number
        }
      ],
      assignedAt: Date
    },
    broadcast: {
      triggered: { type: Boolean, default: false },
      broadcastId: { type: mongoose.Schema.Types.ObjectId, ref: "EmergencyBroadcast", default: null },
      status: { type: String, default: "" },
      channels: [{ type: String }],
      recipientCount: { type: Number, default: 0 },
      message: { type: String, default: "" },
      sentAt: { type: Date, default: null }
    },
    incidentCommand: {
      triggered: { type: Boolean, default: false },
      incidentId: { type: mongoose.Schema.Types.ObjectId, ref: "IncidentCommand", default: null },
      incidentCode: { type: String, default: "" },
      status: { type: String, default: "" },
      severity: { type: String, default: "" },
      assignedUnit: { type: String, default: "" },
      slaDueAt: { type: Date, default: null },
      checklistTotal: { type: Number, default: 0 },
      checklistDone: { type: Number, default: 0 },
      riskScore: { type: Number, default: 0 },
      summary: { type: String, default: "" }
    },
    mapLocation: {
      lat: Number,
      lng: Number
    },
    weather: {
      status: { type: String, default: "unavailable" },
      provider: { type: String, default: "weatherstack" },
      reason: { type: String, default: "" },
      observedAt: { type: String, default: "" },
      locationName: { type: String, default: "" },
      temperatureC: { type: Number, default: null },
      condition: { type: String, default: "" },
      precipitationMm: { type: Number, default: null },
      humidity: { type: Number, default: null },
      windKph: { type: Number, default: null },
      note: { type: String, default: "" },
      quota: mongoose.Schema.Types.Mixed
    },
    civicEvidence: {
      status: { type: String, default: "unavailable" },
      provider: { type: String, default: "zenserp" },
      reason: { type: String, default: "" },
      quota: mongoose.Schema.Types.Mixed,
      officialSources: [
        {
          title: String,
          url: String,
          snippet: String,
          sourceType: String,
          query: String,
          domain: String,
          official: Boolean
        }
      ],
      publicContext: [
        {
          title: String,
          url: String,
          snippet: String,
          sourceType: String,
          query: String,
          domain: String
        }
      ]
    },
    description: { type: String, required: true },
    alerts: [{ type: String }],
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: { type: String, default: "system" },
        changedAt: { type: Date, default: Date.now },
        note: { type: String, default: "" }
      }
    ],
    ai: {
      nlpCategory: String,
      cvDetection: String,
      cvReason: String,
      mlPriorityScore: Number,
      recommendedTeam: String,
      explanation: String,
      confidenceLabel: String,
      reviewRequired: { type: Boolean, default: false },
      geocodingSource: String,
      provider: String,
      engine: String,
      model: String,
      fallbackUsed: { type: Boolean, default: false },
      categoryId: String,
      visionEngine: String,
      visionProvider: String,
      visionFallbackUsed: { type: Boolean, default: false },
      visionCandidates: [
        {
          label: String,
          categoryId: String,
          confidence: Number,
          source: String
        }
      ],
      confidenceBreakdown: mongoose.Schema.Types.Mixed,
      evaluationVersion: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Complaint", complaintSchema);
