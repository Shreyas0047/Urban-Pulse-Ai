const assert = require("assert");
const { _analyzeComplaintLocally: analyze } = require("../src/services/aiClient");
const { summarizeImageAnalysis } = require("../src/services/complaintService");

function run(imageFeatures) {
  return analyze({
    textComplaint: "",
    voiceTranscript: "",
    imageFeatures,
    location: "Bengaluru",
    previousComplaints: [],
    recentAreaComplaints: []
  });
}

const electrical = run({
  averageBrightness: 0.38, averageSaturation: 0.31, edgeDensity: 0.5,
  redHeatRatio: 0.35, smokeLikeRatio: 0.02, darkRatio: 0.3,
  greenRatio: 0.02, blueRatio: 0.04, hotspotRatio: 0.75,
  neutralRatio: 0.2, contrast: 0.52
});
assert.equal(electrical.aiMeta.categoryId, "utility_fault");
assert.match(electrical.cv.detected, /electrical short circuit/i);

const ambiguous = run({
  averageBrightness: 0.2, averageSaturation: 0.12, edgeDensity: 0.18,
  redHeatRatio: 0.03, smokeLikeRatio: 0.08, darkRatio: 0.72,
  greenRatio: 0.03, blueRatio: 0.03, hotspotRatio: 0.01,
  neutralRatio: 0.7, contrast: 0.18
});
assert.equal(ambiguous.aiMeta.categoryId, "general");
assert.match(ambiguous.cv.detected, /incident unclear/i);
assert(!/sewage/i.test(ambiguous.cv.detected));

const tree = run({
  averageBrightness: 0.42, averageSaturation: 0.48, edgeDensity: 0.28,
  redHeatRatio: 0.01, smokeLikeRatio: 0.05, darkRatio: 0.26,
  greenRatio: 0.42, blueRatio: 0.03, hotspotRatio: 0.01,
  neutralRatio: 0.18, contrast: 0.24
});
assert.equal(tree.aiMeta.categoryId, "tree_obstruction");

const untrustedFallback = summarizeImageAnalysis({
  cv: {
    detected: "Electrical short circuit or exposed wiring hazard",
    score: 0.91,
    provider: "feature-fallback",
    fallbackUsed: true,
    sceneStatus: "not_provided"
  }
});
assert.equal(untrustedFallback.status, "unavailable");
assert.equal(untrustedFallback.incident, "");
assert.equal(untrustedFallback.confidence, 0);

const trustedScene = summarizeImageAnalysis({
  cv: {
    schemaVersion: "1.0",
    provider: "florence-cloud-run",
    model: "microsoft/Florence-2-base-ft",
    fallbackUsed: false,
    sceneStatus: "available",
    observations: {
      description: "Sparks are visible from an exposed wire above a road.",
      detectedIssues: [{ categoryId: "utility_fault", issue: "Electrical or street-lighting fault", evidenceScore: 0.82, evidence: ["wire + exposed"] }],
      hazards: ["electric shock or ignition risk"],
      affectedInfrastructure: ["electrical infrastructure"],
      humanReviewRecommended: false
    }
  },
  decision: { reviewRequired: false }
});
assert.equal(trustedScene.status, "complete");
assert.equal(trustedScene.incident, "Electrical or street-lighting fault");
assert.equal(trustedScene.confidence, 0.82);

const trustedGeminiScene = summarizeImageAnalysis({
  cv: {
    schemaVersion: "1.0",
    provider: "gemini-vision",
    model: "gemini-2.5-flash-lite",
    fallbackUsed: false,
    sceneStatus: "available",
    observations: {
      description: "A fallen tree blocks the road.",
      detectedIssues: [{ categoryId: "tree_obstruction", issue: "Fallen tree or branch obstruction", evidenceScore: 0.82, evidence: ["fallen tree", "blocking"] }],
      imageQuality: { status: "usable", limitations: [] },
      textImageConsistency: { status: "not_provided", reason: "" },
      humanReviewRecommended: false
    }
  },
  decision: { reviewRequired: false }
});
assert.equal(trustedGeminiScene.status, "complete");
assert.equal(trustedGeminiScene.incident, "Fallen tree or branch obstruction");

const warmingScene = summarizeImageAnalysis({
  cv: { provider: "feature-fallback", fallbackUsed: true, sceneStatus: "warming_up" }
});
assert.equal(warmingScene.status, "processing");
assert.equal(warmingScene.retryable, true);

console.log(JSON.stringify({
  passed: true,
  electrical: electrical.aiMeta.categoryId,
  ambiguous: ambiguous.aiMeta.categoryId,
  tree: tree.aiMeta.categoryId,
  previewContract: { fallback: untrustedFallback.status, trusted: trustedScene.status, warming: warmingScene.status }
}, null, 2));
