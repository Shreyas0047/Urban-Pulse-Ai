const DepartmentUnit = require("../models/DepartmentUnit");
const { ROUTING_REGISTRY_VERSION, routingDocuments, routingUnitsForCity } = require("./routingRegistryService");

const ACTIVE_STATUSES = ["Queued", "In Progress", "Needs Review", "Escalated"];
const ALL_ROUTING_UNITS = routingDocuments();
const ROUTING_UNIT_IDS = ALL_ROUTING_UNITS.map((unit) => unit.unitId);
const DEFAULT_DEPARTMENT_UNITS = routingUnitsForCity("bengaluru");

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function canonicalPriority(value) {
  const normalized = normalize(value);
  if (normalized === "critical") return "Critical";
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  return "Low";
}

function inferWard(location) {
  const text = String(location || "").trim();
  const wardMatch = text.match(/\bward\s*[-#:]?\s*(\d{1,3})\b/i);
  if (wardMatch) {
    return `Ward ${wardMatch[1]}`;
  }

  if (/\b(village|gram|panchayat|rural|taluk|halli)\b/i.test(text)) {
    return "Rural Panchayat";
  }

  if (/\b(main road|market|junction|school|hospital|street|layout|colony|bangalore|bengaluru)\b/i.test(text)) {
    return "Municipal Ward";
  }

  return "Citywide";
}

function isActiveComplaint(complaint) {
  return ACTIVE_STATUSES.includes(String(complaint.status || ""));
}

function unitWorkload(unit, activeComplaints) {
  return activeComplaints.filter((complaint) => {
    const routing = complaint.routing || {};
    return routing.unitId === unit.unitId || routing.department === unit.department || complaint.ai?.recommendedTeam === unit.department;
  }).length;
}

async function loadRoutingUnits(cityId, model = DepartmentUnit) {
  const fallbackUnits = routingUnitsForCity(cityId);
  if (!fallbackUnits.length) throw new Error(`No routing profile exists for city ${cityId}.`);
  const configuredUnits = await model.find({
    cityId,
    active: true,
    routingRegistryVersion: ROUTING_REGISTRY_VERSION,
    unitId: { $in: ROUTING_UNIT_IDS }
  }).lean().catch(() => []);
  return configuredUnits.length === fallbackUnits.length ? configuredUnits : fallbackUnits;
}

function scoreUnit(unit, context) {
  const locationText = normalize(context.location);
  const categoryId = context.categoryId;
  const priority = context.priority;
  const ward = context.ward;
  const workloadRatio = Math.min(1, context.workload / Math.max(1, unit.maxActiveCases || 10));
  let score = 0;
  const reasons = [];

  if ((unit.handlesCategoryIds || []).includes(categoryId)) {
    score += 0.44;
    reasons.push("category match");
  }

  if ((unit.severityLevels || []).includes(priority)) {
    score += 0.18;
    reasons.push("severity capacity");
  }

  if (unit.ward === ward || unit.ward === "Citywide" || ward === "Citywide") {
    score += 0.16;
    reasons.push("ward coverage");
  }

  if ((unit.coverageKeywords || []).some((keyword) => locationText.includes(normalize(keyword)))) {
    score += 0.12;
    reasons.push("location keyword match");
  }

  score += Math.max(0, 0.2 - workloadRatio * 0.2);
  if (workloadRatio < 0.75) {
    reasons.push("available workload");
  }

  if (priority === "Critical" && /emergency|safety/i.test(`${unit.department} ${unit.unitName}`)) {
    score += 0.08;
    reasons.push("critical municipal escalation");
  }

  return {
    score: Number(score.toFixed(3)),
    workloadRatio: Number(workloadRatio.toFixed(3)),
    reasons
  };
}

async function routeComplaint({ analysis, city, location, mapLocation, activeComplaints = [], unitModel = DepartmentUnit }) {
  const cityId = String(city?.slug || city?.cityId || "").trim().toLowerCase();
  const cityName = String(city?.name || city?.cityName || "").trim();
  if (!cityId || !cityName) throw new Error("City identity is required for department routing.");
  const categoryId = analysis.aiMeta?.categoryId || "general";
  const priority = canonicalPriority(analysis.priority?.level);
  const ward = inferWard(location);
  const units = await loadRoutingUnits(cityId, unitModel);
  const active = activeComplaints.filter((complaint) => {
    const complaintCityId = String(complaint.cityId || "bengaluru").trim().toLowerCase();
    return complaintCityId === cityId && isActiveComplaint(complaint);
  });
  const scoredUnits = units
    .map((unit) => {
      const workload = unitWorkload(unit, active);
      const score = scoreUnit(unit, {
        categoryId,
        priority,
        ward,
        workload,
        location
      });
      return {
        ...unit,
        workload,
        ...score
      };
    })
    .sort((left, right) => right.score - left.score || left.workload - right.workload);

  const selected = scoredUnits[0] || routingUnitsForCity(cityId)[0];
  const escalationLevel = priority === "Critical" ? "Emergency" : priority === "High" ? "Expedited" : priority === "Medium" ? "Standard" : "Routine";
  const workloadScore = selected.workloadRatio ?? 0;
  const reasonParts = selected.reasons?.length ? selected.reasons : ["default routing"];

  return {
    cityId,
    cityName,
    routingRegistryVersion: ROUTING_REGISTRY_VERSION,
    authority: selected.authority || analysis.assignedAuthority || "Gram Panchayat",
    department: selected.department || analysis.nlp?.team || "Help Desk",
    unit: selected.unitName || selected.department || "Response Unit",
    unitId: selected.unitId || "default-response-unit",
    ward,
    escalationLevel,
    workloadScore,
    activeCaseLoad: selected.workload || 0,
    maxActiveCases: selected.maxActiveCases || 10,
    contactEmail: selected.contactEmail || "",
    portalUrl: selected.portalUrl || "",
    handoff: {
      mode: selected.handoffMode || "manual_portal",
      supportsDirectApi: Boolean(selected.supportsDirectApi),
      portalUrl: selected.portalUrl || "",
      verifiedAt: selected.handoffVerifiedAt || null
    },
    mapLocation,
    routingReason: `${reasonParts.join(", ")}. ${selected.unitName || selected.department} selected for ${analysis.nlp?.issueType || "civic issue"}.`,
    alternatives: scoredUnits.slice(1, 4).map((unit) => ({
      unitId: unit.unitId,
      department: unit.department,
      unit: unit.unitName,
      authority: unit.authority,
      cityId: unit.cityId,
      score: unit.score,
      activeCaseLoad: unit.workload,
      workloadScore: unit.workloadRatio
    })),
    assignedAt: new Date()
  };
}

module.exports = {
  DEFAULT_DEPARTMENT_UNITS,
  loadRoutingUnits,
  canonicalPriority,
  inferWard,
  routeComplaint
};
