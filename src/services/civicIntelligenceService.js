const { inferWard, canonicalPriority } = require("./routingService");

const PRIORITY_WEIGHT = { Critical: 4, High: 3, Medium: 2, Low: 1 };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function categoryId(complaint) {
  return complaint.ai?.categoryId || complaint.aiMeta?.categoryId || "general";
}

function areaName(complaint) {
  return complaint.areaIntelligence?.likelyArea || complaint.routing?.ward || inferWard(complaint.location) || "Unknown area";
}

function active(complaint) {
  return complaint.status !== "Resolved";
}

function buildIncidentDna(complaint) {
  const threat = complaint.ai?.threatAssessment || {};
  const verification = complaint.verification?.summary || {};
  const resolution = complaint.resolution?.aiAssessment || {};
  const strands = [
    { id: "text", label: "Report", value: complaint.description ? "Present" : "Missing", strength: complaint.description ? 0.78 : 0.12, detail: complaint.description ? "Citizen description supplied" : "No written description" },
    { id: "vision", label: "Image", value: complaint.ai?.imageFingerprint ? "Checked" : "None", strength: complaint.ai?.imageFingerprint ? 0.72 : 0.08, detail: threat.integrity?.status || "No image integrity record" },
    { id: "place", label: "Place", value: areaName(complaint), strength: Number(complaint.areaIntelligence?.confidence || 0.36), detail: complaint.location || "Location not recorded" },
    { id: "risk", label: "Risk", value: threat.threatLevel || complaint.priority || "Low", strength: Number(threat.riskScore || (PRIORITY_WEIGHT[canonicalPriority(complaint.priority)] || 1) / 4), detail: threat.incident || "Priority and routing signals" },
    { id: "context", label: "Context", value: complaint.weather?.status === "available" ? "Weather linked" : "Local history", strength: complaint.weather?.status === "available" ? 0.58 : Number(complaint.incidentCluster?.confidence || 0.28), detail: complaint.weather?.note || complaint.incidentCluster?.matchReason || "No external context" },
    { id: "community", label: "Community", value: `${Number(complaint.communityProof?.summary?.total || 0) + Number(verification.total || 0)} signals`, strength: clamp((Number(complaint.communityProof?.summary?.corroborates || 0) + Number(verification.stillThere || 0) + Number(verification.resolved || 0)) / 5, 0.08, 0.9), detail: resolution.reason || verification.citizenStatus || "No citizen confirmation yet" }
  ];

  return { strands, confidence: Math.round((strands.reduce((sum, strand) => sum + strand.strength, 0) / strands.length) * 100) };
}

function buildTimeMachine(complaint) {
  const events = [
    { at: complaint.createdAt, kind: "reported", title: "Issue reported", detail: complaint.description || complaint.type }
  ];
  (complaint.statusHistory || []).forEach((entry) => events.push({
    at: entry.changedAt,
    kind: "status",
    title: entry.status || "Status updated",
    detail: entry.note || `Updated by ${entry.changedBy || "system"}`
  }));
  (complaint.resolution?.citizenEvidence || []).forEach((entry) => events.push({
    at: entry.submittedAt,
    kind: "community",
    title: `Follow-up: ${String(entry.vote || "evidence").replace(/_/g, " ")}`,
    detail: entry.note || "Citizen follow-up evidence"
  }));
  (complaint.communityProof?.signals || []).forEach((entry) => events.push({
    at: entry.createdAt,
    kind: "proof",
    title: `Community: ${String(entry.signal || "signal").replace(/_/g, " ")}`,
    detail: entry.note || "Nearby community signal"
  }));
  return events
    .filter((event) => event.at)
    .sort((left, right) => new Date(left.at) - new Date(right.at))
    .slice(-12);
}

function buildConsequenceScenario(complaint) {
  const priority = canonicalPriority(complaint.priority);
  const threat = complaint.ai?.threatAssessment || {};
  const activeHours = Math.max(0, Math.round((Date.now() - new Date(complaint.createdAt || Date.now()).getTime()) / 3600000));
  const urgency = clamp((PRIORITY_WEIGHT[priority] || 1) * 21 + Number(threat.riskScore || 0) * 22 + (activeHours > 48 ? 12 : 0), 0, 100);
  const effects = [
    priority === "Critical" || priority === "High" ? "Local safety exposure may remain elevated." : "Repeated reports may increase while the issue stays open.",
    complaint.routing?.ward ? `Response workload may increase in ${complaint.routing.ward}.` : "Response workload may increase in the affected area.",
    complaint.incidentCluster?.clustered ? "Related reports could reinforce this incident cluster." : "No linked cluster is currently required."
  ];
  if (complaint.weather?.status === "available" && complaint.weather?.note) effects.push("Current weather context may amplify the reported condition.");
  return {
    horizonHours: priority === "Critical" ? 12 : priority === "High" ? 24 : 48,
    impactScore: Math.round(urgency),
    band: urgency >= 76 ? "Immediate attention" : urgency >= 52 ? "Elevated attention" : "Monitor",
    effects,
    disclaimer: "Scenario based on recorded complaint signals. It is a planning aid, not a forecast of a real-world outcome."
  };
}

function buildUrbanPulseRadar(complaints = []) {
  const zones = new Map();
  complaints.filter(active).forEach((complaint) => {
    const zone = areaName(complaint);
    if (!zones.has(zone)) zones.set(zone, []);
    zones.get(zone).push(complaint);
  });

  return [...zones.entries()]
    .map(([zone, zoneComplaints]) => {
      const risk = zoneComplaints.reduce((sum, complaint) => {
        const threat = complaint.ai?.threatAssessment || {};
        return sum + (PRIORITY_WEIGHT[canonicalPriority(complaint.priority)] || 1) * 17 + Number(threat.riskScore || 0) * 18;
      }, 0);
      const coords = zoneComplaints.map((item) => item.mapLocation).filter((point) => Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng)));
      return {
        zone,
        intensity: Math.round(clamp(risk, 8, 100)),
        radiusKm: Number(clamp(0.45 + zoneComplaints.length * 0.28, 0.5, 2.4).toFixed(1)),
        activeCases: zoneComplaints.length,
        primaryIssue: zoneComplaints[0]?.type || "Civic issue",
        mapLocation: coords.length ? {
          lat: coords.reduce((sum, point) => sum + Number(point.lat), 0) / coords.length,
          lng: coords.reduce((sum, point) => sum + Number(point.lng), 0) / coords.length
        } : null,
        drivers: [...new Set(zoneComplaints.map((item) => item.priority).filter(Boolean))].slice(0, 3)
      };
    })
    .sort((left, right) => right.intensity - left.intensity)
    .slice(0, 8);
}

function buildCivicIntelligence(complaints = []) {
  const radar = buildUrbanPulseRadar(complaints);
  const scenarios = complaints.filter(active).map((complaint) => ({
    complaintId: String(complaint._id || ""),
    type: complaint.type,
    location: complaint.location,
    ...buildConsequenceScenario(complaint)
  })).sort((left, right) => right.impactScore - left.impactScore).slice(0, 6);

  return {
    generatedAt: new Date().toISOString(),
    radar,
    scenarios,
    summary: {
      activeWaves: radar.length,
      strongestZone: radar[0]?.zone || "No active zone",
      strongestIntensity: radar[0]?.intensity || 0
    }
  };
}

function buildComplaintIntelligence(complaint) {
  return {
    dna: buildIncidentDna(complaint),
    timeMachine: buildTimeMachine(complaint),
    consequenceScenario: buildConsequenceScenario(complaint)
  };
}

module.exports = { buildCivicIntelligence, buildComplaintIntelligence };
