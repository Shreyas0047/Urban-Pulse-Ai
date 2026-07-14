const DepartmentUnit = require("../models/DepartmentUnit");
const routingProfile = require("../../shared/bengaluruRouting.json");
const BENGALURU = require("../config/bengaluru");
const { resolveBengaluruWard } = require("./bengaluruWardService");

const ACTIVE_STATUSES = ["Queued", "In Progress", "Needs Review", "Escalated"];
const ROUTING_REGISTRY_VERSION = routingProfile.version;
const DEFAULT_DEPARTMENT_UNITS = Object.freeze(routingProfile.departments.map((unit) => ({
  ...unit,
  unitId: `bengaluru-${unit.key}`,
  cityId: BENGALURU.id,
  cityName: BENGALURU.name,
  routingRegistryVersion: ROUTING_REGISTRY_VERSION,
  authority: BENGALURU.authority,
  ward: "Citywide",
  severityLevels: ["Low", "Medium", "High", "Critical"],
  contactEmail: "",
  portalUrl: routingProfile.portalUrl,
  escalationDestination: unit.escalationDestination || "BBMP zonal administration",
  handoffMode: "manual_portal",
  supportsDirectApi: false,
  handoffSourceUrl: routingProfile.portalUrl,
  handoffVerifiedAt: new Date(routingProfile.verifiedAt),
  active: true
})));
const ROUTING_UNIT_IDS = DEFAULT_DEPARTMENT_UNITS.map((unit) => unit.unitId);

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

function inferWard(location, mapLocation) {
  return resolveBengaluruWard({ location, mapLocation }).wardName;
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

async function loadRoutingUnits(model = DepartmentUnit) {
  const configuredUnits = await model.find({
    cityId: BENGALURU.id,
    active: true,
    routingRegistryVersion: ROUTING_REGISTRY_VERSION,
    unitId: { $in: ROUTING_UNIT_IDS }
  }).lean().catch(() => []);
  return configuredUnits.length === DEFAULT_DEPARTMENT_UNITS.length ? configuredUnits : DEFAULT_DEPARTMENT_UNITS;
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

async function routeComplaint({ analysis, location, mapLocation, activeComplaints = [], unitModel = DepartmentUnit }) {
  const categoryId = analysis.aiMeta?.categoryId || "general";
  const priority = canonicalPriority(analysis.priority?.level);
  const wardResolution = resolveBengaluruWard({ location, mapLocation });
  const ward = wardResolution.wardName;
  const units = await loadRoutingUnits(unitModel);
  const active = activeComplaints.filter(isActiveComplaint);
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

  const selected = scoredUnits[0] || DEFAULT_DEPARTMENT_UNITS[0];
  const escalationLevel = priority === "Critical" ? "Emergency" : priority === "High" ? "Expedited" : priority === "Medium" ? "Standard" : "Routine";
  const workloadScore = selected.workloadRatio ?? 0;
  const reasonParts = selected.reasons?.length ? selected.reasons : ["default routing"];

  return {
    authority: selected.authority || analysis.assignedAuthority || "Gram Panchayat",
    department: selected.department || analysis.nlp?.team || "Help Desk",
    unit: selected.unitName || selected.department || "Response Unit",
    unitId: selected.unitId || "default-response-unit",
    ward,
    wardCode: wardResolution.wardCode,
    wardZone: wardResolution.zone,
    wardMatchQuality: wardResolution.matchQuality,
    wardRequiresConfirmation: wardResolution.requiresConfirmation,
    routingRegistryVersion: ROUTING_REGISTRY_VERSION,
    escalationLevel,
    workloadScore,
    activeCaseLoad: selected.workload || 0,
    maxActiveCases: selected.maxActiveCases || 10,
    contactEmail: selected.contactEmail || "",
    portalUrl: selected.portalUrl || "",
    escalationDestination: selected.escalationDestination || "BBMP zonal administration",
    deliveryStatus: "pending_handoff",
    handoff: {
      mode: selected.handoffMode || "manual_portal",
      supportsDirectApi: Boolean(selected.supportsDirectApi),
      portalUrl: selected.portalUrl || "",
      verifiedAt: selected.handoffVerifiedAt || null
    },
    mapLocation,
    routingReason: `${reasonParts.join(", ")}. ${selected.unitName || selected.department} selected for ${analysis.nlp?.issueType || "civic issue"}; ward result from ${wardResolution.matchedBy}.`,
    alternatives: scoredUnits.slice(1, 4).map((unit) => ({
      unitId: unit.unitId,
      department: unit.department,
      unit: unit.unitName,
      authority: unit.authority,
      score: unit.score,
      activeCaseLoad: unit.workload,
      workloadScore: unit.workloadRatio
    })),
    assignedAt: new Date()
  };
}

module.exports = {
  DEFAULT_DEPARTMENT_UNITS,
  ROUTING_REGISTRY_VERSION,
  loadRoutingUnits,
  canonicalPriority,
  inferWard,
  routeComplaint
};
