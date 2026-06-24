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
    mapLocation: {
      lat: Number,
      lng: Number
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
