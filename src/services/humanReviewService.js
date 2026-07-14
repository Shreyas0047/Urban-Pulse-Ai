const aiCategories = require("../../shared/aiCategories.json");
const { buildFollowUpSchedule } = require("./followUpService");
const { DEFAULT_DEPARTMENT_UNITS, ROUTING_REGISTRY_VERSION } = require("./routingService");

const REVIEW_OUTCOMES = new Set(["confirmed", "corrected", "insufficient_evidence"]);
const PRIORITIES = new Set(["Low", "Medium", "High", "Critical"]);
const CATEGORY_BY_ID = new Map(aiCategories.map((category) => [category.id, category]));
const MIN_REASON_LENGTH = 15;
const MAX_REASON_LENGTH = 500;
const MAX_DEPARTMENT_LENGTH = 120;

function createReviewError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeText(value, maxLength = Infinity) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function getReviewOptions() {
  const routingUnits = DEFAULT_DEPARTMENT_UNITS;
  const unitByCategory = new Map();
  routingUnits.forEach((unit) => unit.handlesCategoryIds.forEach((categoryId) => unitByCategory.set(categoryId, unit)));
  return {
    outcomes: [
      { id: "confirmed", label: "Confirm AI decision" },
      { id: "corrected", label: "Correct AI decision" },
      { id: "insufficient_evidence", label: "Request better evidence" }
    ],
    priorities: [...PRIORITIES],
    categories: aiCategories.map((category) => ({
      id: category.id,
      label: category.label,
      group: category.group,
      team: unitByCategory.get(category.id)?.department || category.team,
      unitId: unitByCategory.get(category.id)?.unitId || "",
      authority: unitByCategory.get(category.id)?.authority || category.authority
    })),
    routingRegistryVersion: ROUTING_REGISTRY_VERSION,
    routingUnits: routingUnits.map((unit) => ({
      unitId: unit.unitId,
      department: unit.department,
      unitName: unit.unitName,
      authority: unit.authority,
      handlesCategoryIds: unit.handlesCategoryIds
    }))
  };
}

function currentDecision(complaint) {
  return {
    categoryId: String(complaint.ai?.categoryId || "general"),
    type: String(complaint.type || "Civic Complaint"),
    priority: String(complaint.priority || "Low"),
    department: String(complaint.routing?.department || complaint.ai?.recommendedTeam || "Help Desk"),
    authority: String(complaint.routing?.authority || complaint.assignedAuthority || "Gram Panchayat")
  };
}

function normalizeReviewPayload(payload, complaint) {
  const outcome = normalizeText(payload.outcome);
  const reason = normalizeText(payload.reason, MAX_REASON_LENGTH + 1);
  const categoryId = normalizeText(payload.categoryId);
  const priority = normalizeText(payload.priority);
  const department = normalizeText(payload.department, MAX_DEPARTMENT_LENGTH + 1);
  const unitId = normalizeText(payload.unitId, 120);
  const expectedVersion = Number(payload.expectedVersion);

  if (!REVIEW_OUTCOMES.has(outcome)) {
    throw createReviewError("Choose a valid human-review outcome.");
  }
  if (reason.length < MIN_REASON_LENGTH || reason.length > MAX_REASON_LENGTH) {
    throw createReviewError(`Review reasoning must be between ${MIN_REASON_LENGTH} and ${MAX_REASON_LENGTH} characters.`);
  }
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw createReviewError("Complaint version is missing. Refresh the case and try again.", 409);
  }

  const current = currentDecision(complaint);
  if (outcome === "insufficient_evidence") {
    return { outcome, reason, expectedVersion, ...current };
  }
  if (outcome === "confirmed") {
    const changedFields = [
      [categoryId, current.categoryId],
      [priority, current.priority],
      [department, current.department]
    ].filter(([proposed, existing]) => proposed && proposed !== existing);
    if (changedFields.length) {
      throw createReviewError("A confirmed review must keep the current category, severity, and department.");
    }
    return { outcome, reason, expectedVersion, ...current, changedFields: [] };
  }

  const category = CATEGORY_BY_ID.get(categoryId);
  if (!category) {
    throw createReviewError("Choose a valid incident category.");
  }
  if (!PRIORITIES.has(priority)) {
    throw createReviewError("Choose a valid severity.");
  }
  const cityId = "bengaluru";
  const allowedUnits = DEFAULT_DEPARTMENT_UNITS.filter((unit) => unit.handlesCategoryIds.includes(categoryId));
  const selectedUnit = allowedUnits.find((unit) => unit.unitId === unitId || unit.department === department);
  if (!selectedUnit) throw createReviewError("Choose the registered department that owns this Bengaluru category.");

  const proposed = {
    categoryId,
    type: category.label,
    priority,
    department: selectedUnit.department,
    authority: selectedUnit.authority,
    unitId: selectedUnit.unitId,
    unitName: selectedUnit.unitName,
    portalUrl: selectedUnit.portalUrl,
    handoffMode: selectedUnit.handoffMode,
    handoffVerifiedAt: selectedUnit.handoffVerifiedAt,
    escalationDestination: selectedUnit.escalationDestination,
    routingRegistryVersion: selectedUnit.routingRegistryVersion,
    cityId,
    category
  };
  const changedFields = ["categoryId", "type", "priority", "department", "authority"]
    .filter((field) => proposed[field] !== current[field]);

  if (!changedFields.length) {
    throw createReviewError("Change at least one decision field before submitting a correction.");
  }

  return { outcome, reason, expectedVersion, ...proposed, changedFields };
}

function escalationLevel(priority) {
  if (priority === "Critical") return "Emergency";
  if (priority === "High") return "Expedited";
  if (priority === "Medium") return "Standard";
  return "Routine";
}

function openStatusForPriority(priority) {
  if (["Critical", "High"].includes(priority)) return "Escalated";
  if (priority === "Medium") return "In Progress";
  return "Queued";
}

function applyHumanReview(complaint, normalizedReview, auth, reviewedAt = new Date()) {
  const before = currentDecision(complaint);
  const storedOriginal = complaint.humanReview?.original;
  const original = storedOriginal?.categoryId
    ? {
        categoryId: String(storedOriginal.categoryId || ""),
        type: String(storedOriginal.type || ""),
        priority: String(storedOriginal.priority || ""),
        department: String(storedOriginal.department || ""),
        authority: String(storedOriginal.authority || "")
      }
    : before;
  const isCorrection = normalizedReview.outcome === "corrected";
  const insufficient = normalizedReview.outcome === "insufficient_evidence";
  const priorityChanged = Boolean(normalizedReview.changedFields?.includes("priority"));

  complaint.ai = complaint.ai || {};
  if (isCorrection) {
    complaint.type = normalizedReview.type;
    complaint.priority = normalizedReview.priority;
    complaint.assignedAuthority = normalizedReview.authority;
    complaint.ai.categoryId = normalizedReview.categoryId;
    complaint.ai.nlpCategory = normalizedReview.category.group;
    complaint.ai.recommendedTeam = normalizedReview.department;
    complaint.routing = {
      ...(complaint.routing || {}),
      authority: normalizedReview.authority,
      department: normalizedReview.department,
      unit: normalizedReview.unitName,
      unitId: normalizedReview.unitId,
      cityId: normalizedReview.cityId,
      cityName: complaint.cityName,
      routingRegistryVersion: normalizedReview.routingRegistryVersion,
      portalUrl: normalizedReview.portalUrl,
      handoff: {
        mode: normalizedReview.handoffMode,
        supportsDirectApi: false,
        portalUrl: normalizedReview.portalUrl,
        verifiedAt: normalizedReview.handoffVerifiedAt
      },
      escalationDestination: normalizedReview.escalationDestination || complaint.routing?.escalationDestination || "BBMP zonal administration",
      deliveryStatus: "pending_handoff",
      escalationLevel: escalationLevel(normalizedReview.priority),
      workloadScore: 0,
      activeCaseLoad: 0,
      alternatives: [],
      routingReason: `Human review correction assigned to the registered ${complaint.cityName || "city"} category owner by an authorized ${auth.role || "Admin"} reviewer.`,
      assignedAt: reviewedAt
    };
    if (complaint.status !== "Resolved" && (priorityChanged || complaint.status === "Needs Review")) {
      complaint.status = openStatusForPriority(normalizedReview.priority);
    }
  }

  complaint.ai.reviewRequired = insufficient ? true : false;
  if (insufficient && complaint.status !== "Resolved") {
    complaint.status = "Needs Review";
  }

  const decision = insufficient ? before : currentDecision(complaint);
  const changedFields = insufficient ? ["reviewRequired"] : (normalizedReview.changedFields || []);
  complaint.humanReview = {
    status: normalizedReview.outcome,
    original,
    decision,
    changedFields,
    reason: normalizedReview.reason,
    reviewerRole: auth.role || "Admin",
    reviewedAt
  };

  const readableOutcome = normalizedReview.outcome.replace(/_/g, " ");
  const auditNote = `Human review ${readableOutcome}: ${normalizedReview.reason}`;
  complaint.statusHistory = [
    ...(complaint.statusHistory || []),
    {
      status: complaint.status,
      changedBy: "authorized-human-review",
      changedAt: reviewedAt,
      note: auditNote
    }
  ];
  complaint.alerts = [...(complaint.alerts || []), auditNote];
  if (priorityChanged) {
    complaint.followUp = {
      ...(complaint.followUp || {}),
      ...buildFollowUpSchedule(complaint, reviewedAt)
    };
  } else if (insufficient) {
    complaint.followUp = {
      ...(complaint.followUp || {}),
      status: "due",
      escalationNote: "Human review requested clearer evidence before automatic classification."
    };
  }
  return complaint.humanReview;
}

module.exports = {
  applyHumanReview,
  createReviewError,
  currentDecision,
  getReviewOptions,
  normalizeReviewPayload
};
