const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { _analyzeComplaintLocally } = require("../src/services/aiClient");

const datasetPath = path.join(process.cwd(), "dataset", "dataset.json");
const minimumAccuracy = Number(process.env.AI_EVAL_MIN_ACCURACY || 0.65);

const datasetCategoryMap = {
  plumbing: ["water_leakage"],
  electrical: ["utility_fault", "safety_fire"],
  sanitation: ["garbage", "sewage_overflow"],
  maintenance: ["wall_damage"],
  infrastructure: ["road_damage", "tree_obstruction", "water_drainage", "vehicle_obstruction"],
  security: ["security"]
};

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function evaluateItem(item) {
  const expected = datasetCategoryMap[normalize(item.category)] || [normalize(item.category)];
  const analysis = _analyzeComplaintLocally({
    textComplaint: item.issue,
    imageHint: item.issue,
    voiceTranscript: "",
    imageFeatures: null,
    location: `${item.category} zone`,
    iotTriggered: false,
    previousComplaints: [],
    recentAreaComplaints: []
  });
  const predicted = analysis.aiMeta?.categoryId || "general";

  return {
    image: item.image,
    issue: item.issue,
    expected,
    predicted,
    passed: expected.includes(predicted),
    confidence: analysis.confidence,
    priority: analysis.priority?.level || "Low"
  };
}

function main() {
  const items = JSON.parse(fs.readFileSync(datasetPath, "utf8"));
  const results = items.map(evaluateItem);
  const passed = results.filter((item) => item.passed).length;
  const accuracy = results.length ? passed / results.length : 0;
  const failures = results.filter((item) => !item.passed);
  const confusion = failures.reduce((acc, item) => {
    const key = `${item.expected.join("|")} -> ${item.predicted}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const report = {
    evaluated: results.length,
    passed,
    failed: failures.length,
    accuracy: Number(accuracy.toFixed(3)),
    minimumAccuracy,
    confusion,
    failures: failures.slice(0, 12)
  };

  console.log(JSON.stringify(report, null, 2));

  if (accuracy < minimumAccuracy) {
    process.exitCode = 1;
  }

  if (process.env.AI_EVAL_WITH_VISION === "true") {
    const vision = spawnSync("python", ["scripts/evaluateVision.py"], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env
    });

    if (vision.status) {
      process.exitCode = vision.status;
    }
  }
}

main();
