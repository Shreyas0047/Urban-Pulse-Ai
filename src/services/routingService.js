const DepartmentUnit = require("../models/DepartmentUnit");

const ACTIVE_STATUSES = ["Queued", "In Progress", "Needs Review", "Escalated"];

const DEFAULT_DEPARTMENT_UNITS = [
  {
    unitId: "bbmp-emergency-city",
    authority: "Municipality",
    department: "Emergency Response Cell",
    unitName: "City Emergency Rapid Response",
    ward: "Citywide",
    coverageKeywords: ["city", "main road", "market", "junction", "school", "hospital"],
    handlesCategoryIds: ["safety_fire", "security", "utility_fault", "tree_obstruction"],
    severityLevels: ["Critical", "High"],
    contactEmail: "",
    portalUrl: "https://nammabengaluru.org.in/home/department/list?displayName=BBMP",
    maxActiveCases: 8,
    active: true
  },
  {
    unitId: "bbmp-road-maintenance",
    authority: "Municipality",
    department: "Road Maintenance Department",
    unitName: "Roads and Obstruction Response",
    ward: "Municipal Ward",
    coverageKeywords: ["road", "street", "lane", "junction", "bridge", "ward"],
    handlesCategoryIds: ["road_damage", "tree_obstruction", "vehicle_obstruction"],
    severityLevels: ["Low", "Medium", "High", "Critical"],
    contactEmail: "",
    portalUrl: "https://nammabengaluru.org.in/home/department/list?displayName=BBMP",
    maxActiveCases: 14,
    active: true
  },
  {
    unitId: "bescom-electrical",
    authority: "Municipality",
    department: "Electrical Department",
    unitName: "Electrical and Streetlight Response",
    ward: "Citywide",
    coverageKeywords: ["streetlight", "pole", "transformer", "market", "junction", "power"],
    handlesCategoryIds: ["utility_fault", "safety_fire"],
    severityLevels: ["Medium", "High", "Critical"],
    contactEmail: "",
    portalUrl: "https://bescom.karnataka.gov.in/",
    maxActiveCases: 10,
    active: true
  },
  {
    unitId: "bwssb-water-drainage",
    authority: "Municipality",
    department: "Water and Drainage Department",
    unitName: "Water Supply and Drainage Response",
    ward: "Citywide",
    coverageKeywords: ["drain", "water", "basement", "colony", "layout"],
    handlesCategoryIds: ["water_drainage", "water_leakage", "sewage_overflow"],
    severityLevels: ["Low", "Medium", "High", "Critical"],
    contactEmail: "",
    portalUrl: "https://bwssb.karnataka.gov.in/",
    maxActiveCases: 12,
    active: true
  },
  {
    unitId: "bbmp-sanitation",
    authority: "Municipality",
    department: "Sanitation Department",
    unitName: "Solid Waste and Public Health Response",
    ward: "Municipal Ward",
    coverageKeywords: ["market", "street", "colony", "ward", "layout"],
    handlesCategoryIds: ["garbage", "sewage_overflow", "animal_intrusion"],
    severityLevels: ["Low", "Medium", "High"],
    contactEmail: "",
    portalUrl: "https://nammabengaluru.org.in/home/department/list?displayName=BBMP",
    maxActiveCases: 16,
    active: true
  },
  {
    unitId: "gram-panchayat-civic",
    authority: "Gram Panchayat",
    department: "Local Civic Works",
    unitName: "Gram Panchayat Civic Response",
    ward: "Rural Panchayat",
    coverageKeywords: ["village", "gram", "panchayat", "rural", "taluk", "halli"],
    handlesCategoryIds: ["garbage", "water_drainage", "water_leakage", "wall_damage", "animal_intrusion", "road_damage"],
    severityLevels: ["Low", "Medium", "High"],
    contactEmail: "",
    portalUrl: "",
    maxActiveCases: 10,
    active: true
  },
  {
    unitId: "traffic-enforcement",
    authority: "Municipality",
    department: "Traffic Enforcement",
    unitName: "Traffic and Access Control",
    ward: "Citywide",
    coverageKeywords: ["parking", "gate", "driveway", "junction", "main road", "entrance"],
    handlesCategoryIds: ["vehicle_obstruction", "road_damage", "tree_obstruction"],
    severityLevels: ["Medium", "High", "Critical"],
    contactEmail: "",
    portalUrl: "https://btp.gov.in/",
    maxActiveCases: 10,
    active: true
  }
];

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

async function loadRoutingUnits() {
  const configuredUnits = await DepartmentUnit.find({ active: true }).lean().catch(() => []);
  return configuredUnits.length ? configuredUnits : DEFAULT_DEPARTMENT_UNITS;
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

  if (priority === "Critical" && unit.authority === "Municipality") {
    score += 0.08;
    reasons.push("critical municipal escalation");
  }

  return {
    score: Number(score.toFixed(3)),
    workloadRatio: Number(workloadRatio.toFixed(3)),
    reasons
  };
}

async function routeComplaint({ analysis, location, mapLocation, activeComplaints = [] }) {
  const categoryId = analysis.aiMeta?.categoryId || "general";
  const priority = canonicalPriority(analysis.priority?.level);
  const ward = inferWard(location);
  const units = await loadRoutingUnits();
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
    escalationLevel,
    workloadScore,
    activeCaseLoad: selected.workload || 0,
    maxActiveCases: selected.maxActiveCases || 10,
    contactEmail: selected.contactEmail || "",
    portalUrl: selected.portalUrl || "",
    mapLocation,
    routingReason: `${reasonParts.join(", ")}. ${selected.unitName || selected.department} selected for ${analysis.nlp?.issueType || "civic issue"}.`,
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
  canonicalPriority,
  inferWard,
  routeComplaint
};
