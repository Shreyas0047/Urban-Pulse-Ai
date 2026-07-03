const { inferWard } = require("./routingService");

const PRIORITY_WEIGHT = {
  Critical: 1,
  High: 0.78,
  Medium: 0.48,
  Low: 0.24
};

function normalizePriority(priority) {
  const value = String(priority || "Low").toLowerCase();
  if (value === "critical") return "Critical";
  if (value === "high") return "High";
  if (value === "medium") return "Medium";
  return "Low";
}

function daysOpen(complaint) {
  const start = new Date(complaint.createdAt || Date.now()).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / (24 * 60 * 60 * 1000)));
}

function healthBand(score) {
  if (score >= 80) return "Stable";
  if (score >= 62) return "Watch";
  if (score >= 42) return "Stressed";
  return "Critical";
}

function hasActiveIncident(complaint) {
  return Boolean(
    complaint.incidentCommand?.triggered &&
      !["Closed", "Resolved"].includes(String(complaint.incidentCommand?.status || "Active"))
  );
}

function createZoneSnapshot(zoneKey, complaints) {
  const total = complaints.length;
  const open = complaints.filter((complaint) => complaint.status !== "Resolved").length;
  const critical = complaints.filter((complaint) => normalizePriority(complaint.priority) === "Critical").length;
  const high = complaints.filter((complaint) => normalizePriority(complaint.priority) === "High").length;
  const broadcasts = complaints.filter((complaint) => complaint.broadcast?.triggered).length;
  const incidents = complaints.filter(hasActiveIncident).length;
  const avgAge = open
    ? complaints
        .filter((complaint) => complaint.status !== "Resolved")
        .reduce((sum, complaint) => sum + daysOpen(complaint), 0) / open
    : 0;
  const pressure =
    Math.min(38, open * 4.2) +
    Math.min(22, critical * 9 + high * 5) +
    Math.min(16, broadcasts * 5) +
    Math.min(14, incidents * 5) +
    Math.min(10, avgAge * 1.4);
  const healthScore = Math.max(0, Math.round(100 - pressure));
  const issueCounts = new Map();

  complaints.forEach((complaint) => {
    const key = complaint.type || "Civic Issue";
    issueCounts.set(key, (issueCounts.get(key) || 0) + 1);
  });

  const topIssues = [...issueCounts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 4);

  return {
    zone: zoneKey,
    healthScore,
    healthBand: healthBand(healthScore),
    totalComplaints: total,
    openComplaints: open,
    criticalComplaints: critical,
    highComplaints: high,
    emergencyBroadcasts: broadcasts,
    activeIncidents: incidents,
    averageOpenAgeDays: Number(avgAge.toFixed(1)),
    topIssues,
    recommendation:
      healthScore < 42
        ? "Immediate command review recommended."
        : healthScore < 62
          ? "Increase department monitoring for this zone."
          : healthScore < 80
            ? "Keep zone under observation."
            : "Zone is stable."
  };
}

function buildCivicDigitalTwin(complaints = []) {
  const zoneMap = new Map();

  complaints.forEach((complaint) => {
    const zone = complaint.routing?.ward || inferWard(complaint.location);
    if (!zoneMap.has(zone)) {
      zoneMap.set(zone, []);
    }
    zoneMap.get(zone).push(complaint);
  });

  const zones = [...zoneMap.entries()]
    .map(([zone, zoneComplaints]) => createZoneSnapshot(zone, zoneComplaints))
    .sort((left, right) => left.healthScore - right.healthScore || right.openComplaints - left.openComplaints);

  const avgHealth = zones.length
    ? Math.round(zones.reduce((sum, zone) => sum + zone.healthScore, 0) / zones.length)
    : 100;
  const openComplaints = complaints.filter((complaint) => complaint.status !== "Resolved").length;
  const activeIncidents = complaints.filter(hasActiveIncident).length;

  return {
    generatedAt: new Date().toISOString(),
    cityHealthScore: avgHealth,
    cityHealthBand: healthBand(avgHealth),
    zones,
    summary: {
      totalZones: zones.length,
      stressedZones: zones.filter((zone) => ["Stressed", "Critical"].includes(zone.healthBand)).length,
      openComplaints,
      activeIncidents,
      emergencyBroadcasts: complaints.filter((complaint) => complaint.broadcast?.triggered).length
    }
  };
}

module.exports = {
  buildCivicDigitalTwin
};
