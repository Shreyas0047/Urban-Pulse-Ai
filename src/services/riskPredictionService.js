const { inferWard, canonicalPriority } = require("./routingService");

const RISK_WINDOW_DAYS = 7;
const RECENT_WINDOW_DAYS = 2;
const WEATHER_SENSITIVE_CATEGORY_IDS = new Set([
  "water_drainage",
  "sewage_overflow",
  "water_leakage",
  "tree_obstruction",
  "road_damage",
  "utility_fault",
  "safety_fire",
  "vehicle_obstruction"
]);

const PRIORITY_WEIGHT = {
  Critical: 28,
  High: 20,
  Medium: 11,
  Low: 5
};

function daysSince(value) {
  const timestamp = new Date(value || Date.now()).getTime();
  if (!Number.isFinite(timestamp)) {
    return 999;
  }

  return Math.max(0, (Date.now() - timestamp) / (24 * 60 * 60 * 1000));
}

function normalizeCategoryId(complaint) {
  return complaint.ai?.categoryId || complaint.aiMeta?.categoryId || "general";
}

function weatherPressure(complaint) {
  const weather = complaint.weather || {};
  if (weather.status !== "available") {
    return 0;
  }

  const categoryId = normalizeCategoryId(complaint);
  if (!WEATHER_SENSITIVE_CATEGORY_IDS.has(categoryId)) {
    return 0;
  }

  const condition = String(weather.condition || "").toLowerCase();
  const rainy = Number(weather.precipitationMm || 0) > 0 || /\b(rain|drizzle|storm|thunder|shower|mist|fog|overcast)\b/.test(condition);
  const windy = Number(weather.windKph || 0) >= 28;
  return (rainy ? 10 : 0) + (windy ? 8 : 0) + (weather.note ? 6 : 0);
}

function riskBand(score) {
  if (score >= 76) return "Severe";
  if (score >= 56) return "High";
  if (score >= 34) return "Watch";
  return "Low";
}

function confidenceBand(confidence) {
  if (confidence >= 0.74) return "High confidence";
  if (confidence >= 0.52) return "Medium confidence";
  return "Early signal";
}

function createZonePrediction(zone, complaints) {
  const recentComplaints = complaints.filter((complaint) => daysSince(complaint.createdAt) <= RISK_WINDOW_DAYS);
  const veryRecent = complaints.filter((complaint) => daysSince(complaint.createdAt) <= RECENT_WINDOW_DAYS);
  const open = complaints.filter((complaint) => complaint.status !== "Resolved");
  const issueCounts = new Map();
  const categoryCounts = new Map();
  let priorityPressure = 0;
  let weatherScore = 0;
  let broadcastPressure = 0;
  let incidentPressure = 0;

  recentComplaints.forEach((complaint) => {
    const priority = canonicalPriority(complaint.priority);
    const issueType = complaint.type || "Civic issue";
    const categoryId = normalizeCategoryId(complaint);
    priorityPressure += PRIORITY_WEIGHT[priority] || PRIORITY_WEIGHT.Low;
    weatherScore += weatherPressure(complaint);
    if (complaint.broadcast?.triggered) broadcastPressure += 14;
    if (complaint.incidentCommand?.triggered && !["Closed", "Resolved"].includes(String(complaint.incidentCommand?.status || ""))) {
      incidentPressure += 16;
    }
    issueCounts.set(issueType, (issueCounts.get(issueType) || 0) + 1);
    categoryCounts.set(categoryId, (categoryCounts.get(categoryId) || 0) + 1);
  });

  const topIssue = [...issueCounts.entries()].sort((left, right) => right[1] - left[1])[0] || ["Civic issue", 0];
  const repeatPressure = Math.max(0, (topIssue[1] - 1) * 9);
  const trendPressure = Math.min(24, veryRecent.length * 8);
  const unresolvedPressure = Math.min(20, open.length * 4);
  const rawScore = priorityPressure + weatherScore + broadcastPressure + incidentPressure + repeatPressure + trendPressure + unresolvedPressure;
  const score = Math.min(100, Math.round(rawScore));
  const categoryId = [...categoryCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "general";
  const confidence = Math.min(0.94, Math.max(0.28, (recentComplaints.length * 0.12) + (topIssue[1] * 0.08) + (weatherScore ? 0.12 : 0) + (incidentPressure ? 0.1 : 0)));
  const riskHorizonHours = score >= 76 ? 24 : score >= 56 ? 48 : 72;
  const drivers = [
    recentComplaints.length ? `${recentComplaints.length} recent complaint${recentComplaints.length === 1 ? "" : "s"}` : "",
    topIssue[1] > 1 ? `${topIssue[1]} repeated ${topIssue[0]} report${topIssue[1] === 1 ? "" : "s"}` : "",
    weatherScore ? "weather-sensitive conditions" : "",
    broadcastPressure ? "emergency broadcast activity" : "",
    incidentPressure ? "active incident command pressure" : "",
    open.length ? `${open.length} unresolved case${open.length === 1 ? "" : "s"}` : ""
  ].filter(Boolean);

  return {
    zone,
    score,
    band: riskBand(score),
    confidence: Number(confidence.toFixed(2)),
    confidenceLabel: confidenceBand(confidence),
    horizonHours: riskHorizonHours,
    likelyIssue: topIssue[0],
    categoryId,
    openComplaints: open.length,
    recentComplaints: recentComplaints.length,
    drivers,
    recommendation:
      score >= 76
        ? "Pre-position response teams and monitor this zone closely for the next 24 hours."
        : score >= 56
          ? "Increase inspection priority and watch for repeat complaints in this zone."
          : score >= 34
            ? "Keep this zone under observation for emerging complaint clusters."
            : "No immediate predictive escalation required."
  };
}

function buildCivicRiskPredictions(complaints = []) {
  const zoneMap = new Map();

  complaints.forEach((complaint) => {
    const zone = complaint.routing?.ward || inferWard(complaint.location);
    if (!zoneMap.has(zone)) {
      zoneMap.set(zone, []);
    }
    zoneMap.get(zone).push(complaint);
  });

  const predictions = [...zoneMap.entries()]
    .map(([zone, zoneComplaints]) => createZonePrediction(zone, zoneComplaints))
    .filter((prediction) => prediction.recentComplaints > 0 || prediction.openComplaints > 0)
    .sort((left, right) => right.score - left.score || right.recentComplaints - left.recentComplaints)
    .slice(0, 8);

  const highestRisk = predictions[0] || null;
  const severeZones = predictions.filter((prediction) => prediction.band === "Severe").length;
  const highZones = predictions.filter((prediction) => prediction.band === "High").length;

  return {
    generatedAt: new Date().toISOString(),
    horizonHours: 72,
    summary: {
      predictedZones: predictions.length,
      severeZones,
      highZones,
      watchZones: predictions.filter((prediction) => prediction.band === "Watch").length,
      highestRiskZone: highestRisk?.zone || "",
      highestRiskScore: highestRisk?.score || 0,
      primaryRisk: highestRisk?.likelyIssue || ""
    },
    predictions
  };
}

module.exports = {
  buildCivicRiskPredictions
};
