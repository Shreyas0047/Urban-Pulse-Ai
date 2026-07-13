const aiCategories = require("../../shared/aiCategories.json");
const { buildFollowUpSchedule } = require("./followUpService");

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
      team: category.team,
      authority: category.authority
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
  if (department.length < 3 || department.length > MAX_DEPARTMENT_LENGTH) {
    throw createReviewError(`Department must be between 3 and ${MAX_DEPARTMENT_LENGTH} characters.`);
  }

  const proposed = {
    categoryId,
    type: category.label,
    priority,
    department,
    authority: category.authority || current.authority,
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
      unit: `Manual assignment: ${normalizedReview.department}`,
      unitId: "human-review",
      escalationLevel: escalationLevel(normalizedReview.priority),
      workloadScore: 0,
      activeCaseLoad: 0,
      alternatives: [],
      routingReason: `Human review correction recorded by an authorized ${auth.role || "Admin"} reviewer.`,
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
