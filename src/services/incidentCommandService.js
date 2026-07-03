const IncidentCommand = require("../models/IncidentCommand");
const { canonicalPriority } = require("./routingService");

const INCIDENT_CATEGORY_IDS = new Set([
  "safety_fire",
  "utility_fault",
  "security",
  "tree_obstruction",
  "sewage_overflow",
  "road_damage",
  "vehicle_obstruction"
]);

function shouldCreateIncidentCommand({ analysis, confidenceScore }) {
  const priority = canonicalPriority(analysis.priority?.level);
  const categoryId = analysis.aiMeta?.categoryId || "general";
  const reviewRequired = Boolean(analysis.reviewRequired || analysis.decision?.reviewRequired);
  const conflictDetected = Boolean(analysis.conflictDetected || analysis.decision?.conflictDetected);

  if (priority === "Critical") {
    return !conflictDetected;
  }

  return priority === "High" && INCIDENT_CATEGORY_IDS.has(categoryId) && confidenceScore >= 0.52 && !reviewRequired && !conflictDetected;
}

function slaMinutesFor(priority, categoryId) {
  if (priority === "Critical") return 45;
  if (categoryId === "safety_fire" || categoryId === "utility_fault") return 60;
  if (categoryId === "security") return 90;
  return 180;
}

function buildChecklist(categoryId) {
  const common = [
    "Confirm exact location and access route",
    "Acknowledge department ownership",
    "Dispatch field response unit",
    "Post first status update",
    "Upload closure proof before resolving"
  ];

  const categorySteps = {
    safety_fire: ["Isolate affected area", "Notify emergency/fire response"],
    utility_fault: ["Secure electrical hazard", "Verify power isolation"],
    tree_obstruction: ["Assess road blockage", "Arrange clearance equipment"],
    sewage_overflow: ["Block public access to overflow zone", "Assign sanitation cleanup crew"],
    security: ["Alert security team", "Verify resident safety"],
    road_damage: ["Place warning markers", "Schedule road repair crew"],
    vehicle_obstruction: ["Notify traffic enforcement", "Clear emergency access path"]
  };

  return [...(categorySteps[categoryId] || []), ...common].map((label) => ({ label, status: "pending" }));
}

function buildRiskScore({ priority, confidenceScore, routing }) {
  let score = priority === "Critical" ? 0.86 : priority === "High" ? 0.72 : 0.48;
  score += Math.min(0.12, Number(confidenceScore || 0) * 0.12);
  if (routing?.workloadScore > 0.75) score += 0.06;
  if (routing?.escalationLevel === "Emergency") score += 0.08;
  return Number(Math.min(1, score).toFixed(3));
}

async function createIncidentCommand({ complaint, analysis, routing, confidenceScore, broadcast, triggeredBy }) {
  if (!shouldCreateIncidentCommand({ analysis, confidenceScore })) {
    return null;
  }

  const priority = canonicalPriority(analysis.priority?.level);
  const categoryId = analysis.aiMeta?.categoryId || "general";
  const slaMinutes = slaMinutesFor(priority, categoryId);
  const incidentCode = `INC-${new Date().getFullYear()}-${String(complaint._id).slice(-6).toUpperCase()}`;
  const slaDueAt = new Date(Date.now() + slaMinutes * 60 * 1000);
  const riskScore = buildRiskScore({ priority, confidenceScore, routing });

  return IncidentCommand.findOneAndUpdate(
    { complaintId: complaint._id },
    {
      complaintId: complaint._id,
      incidentCode,
      title: `${priority} ${complaint.type}`,
      categoryId,
      severity: priority,
      ward: routing?.ward || "Citywide",
      location: complaint.location,
      commandStatus: priority === "Critical" ? "Active" : "Monitoring",
      assignedAuthority: routing?.authority || complaint.assignedAuthority,
      assignedDepartment: routing?.department || "",
      assignedUnit: routing?.unit || "",
      slaMinutes,
      slaDueAt,
      escalationLevel: routing?.escalationLevel || "Standard",
      checklist: buildChecklist(categoryId),
      timeline: [
        {
          event: "Incident command created from high-risk complaint",
          at: new Date(),
          by: triggeredBy || "system"
        }
      ],
      broadcastId: broadcast?._id || null,
      riskScore,
      summary: `${routing?.unit || "Response unit"} assigned with ${slaMinutes} minute SLA for ${complaint.location}.`
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

function summarizeIncidentCommand(command) {
  if (!command) {
    return { triggered: false };
  }

  return {
    triggered: true,
    incidentId: String(command._id),
    incidentCode: command.incidentCode,
    status: command.commandStatus,
    severity: command.severity,
    assignedUnit: command.assignedUnit,
    slaDueAt: command.slaDueAt,
    checklistTotal: (command.checklist || []).length,
    checklistDone: (command.checklist || []).filter((item) => item.status === "done").length,
    riskScore: command.riskScore,
    summary: command.summary
  };
}

module.exports = {
  createIncidentCommand,
  shouldCreateIncidentCommand,
  summarizeIncidentCommand
};
