const assert = require("assert");
const { _analyzeComplaintLocally: analyze } = require("../src/services/aiClient");

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

console.log(JSON.stringify({ passed: true, electrical: electrical.aiMeta.categoryId, ambiguous: ambiguous.aiMeta.categoryId, tree: tree.aiMeta.categoryId }, null, 2));
