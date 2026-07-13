const assert = require("assert");
const Complaint = require("../src/models/Complaint");
const {
  applyHumanReview,
  getReviewOptions,
  normalizeReviewPayload
} = require("../src/services/humanReviewService");
const { submitHumanReview, updateComplaintStatus } = require("../src/controllers/complaintController");

function complaintFixture() {
  return {
    _id: "507f1f77bcf86cd799439011",
    __v: 3,
    type: "Road Damage",
    priority: "Medium",
    status: "In Progress",
    assignedAuthority: "Municipality",
    ai: {
      categoryId: "road_damage",
      nlpCategory: "Infrastructure",
      recommendedTeam: "Road Maintenance Department",
      reviewRequired: true
    },
    routing: {
      authority: "Municipality",
      department: "Road Maintenance Department",
      unit: "Roads and Obstruction Response",
      alternatives: [{ department: "Help Desk" }]
    },
    alerts: [],
    statusHistory: [],
    followUp: { count: 1 },
    incidentCommand: { triggered: false },
    save: async function save() {
      this.__v += 1;
      return this;
    }
  };
}

async function callController(req) {
  let payload;
  let nextError;
  await submitHumanReview(
    req,
    { json(value) { payload = value; } },
    (error) => { nextError = error; }
  );
  return { payload, nextError };
}

async function main() {
  const auth = { role: "Admin", username: "reviewer@example.com", permissions: ["update_complaint_status"] };
  const options = getReviewOptions();
  assert.equal(options.categories.length, 12);
  assert.deepEqual(options.priorities, ["Low", "Medium", "High", "Critical"]);

  const confirmedComplaint = complaintFixture();
  const confirmed = normalizeReviewPayload(
    {
      outcome: "confirmed",
      categoryId: "road_damage",
      priority: "Medium",
      department: "Road Maintenance Department",
      reason: "The visible road damage agrees with the AI decision.",
      expectedVersion: 3
    },
    confirmedComplaint
  );
  applyHumanReview(confirmedComplaint, confirmed, auth, new Date("2026-07-13T10:00:00Z"));
  assert.equal(confirmedComplaint.humanReview.status, "confirmed");
  assert.equal(confirmedComplaint.ai.reviewRequired, false);
  assert.equal(confirmedComplaint.type, "Road Damage");
  assert.equal(confirmedComplaint.followUp.count, 1);

  const correctedComplaint = complaintFixture();
  const correction = normalizeReviewPayload(
    {
      outcome: "corrected",
      categoryId: "tree_obstruction",
      priority: "Critical",
      department: "Horticulture Emergency Response",
      reason: "The image shows a fallen tree blocking the complete roadway.",
      expectedVersion: 3
    },
    correctedComplaint
  );
  applyHumanReview(correctedComplaint, correction, auth, new Date("2026-07-13T11:00:00Z"));
  assert.equal(correctedComplaint.type, "Tree / Obstruction on Road");
  assert.equal(correctedComplaint.ai.categoryId, "tree_obstruction");
  assert.equal(correctedComplaint.priority, "Critical");
  assert.equal(correctedComplaint.status, "Escalated");
  assert.equal(correctedComplaint.routing.unitId, "human-review");
  assert.equal(correctedComplaint.routing.alternatives.length, 0);
  assert.equal(correctedComplaint.humanReview.original.categoryId, "road_damage");
  assert.ok(correctedComplaint.humanReview.changedFields.includes("categoryId"));
  assert.equal(correctedComplaint.followUp.status, "scheduled");

  const secondCorrection = normalizeReviewPayload(
    {
      outcome: "corrected",
      categoryId: "tree_obstruction",
      priority: "High",
      department: "Horticulture Emergency Response",
      reason: "Field review confirms obstruction but no immediate life threat.",
      expectedVersion: 3
    },
    correctedComplaint
  );
  applyHumanReview(correctedComplaint, secondCorrection, auth, new Date("2026-07-13T12:00:00Z"));
  assert.equal(correctedComplaint.humanReview.original.categoryId, "road_damage");

  const insufficientComplaint = complaintFixture();
  const insufficient = normalizeReviewPayload(
    {
      outcome: "insufficient_evidence",
      reason: "The image is too dark to establish the incident category safely.",
      expectedVersion: 3
    },
    insufficientComplaint
  );
  applyHumanReview(insufficientComplaint, insufficient, auth);
  assert.equal(insufficientComplaint.status, "Needs Review");
  assert.equal(insufficientComplaint.ai.reviewRequired, true);
  assert.equal(insufficientComplaint.ai.categoryId, "road_damage");
  assert.equal(insufficientComplaint.followUp.status, "due");

  const routingOnlyComplaint = complaintFixture();
  routingOnlyComplaint.status = "Escalated";
  const routingOnly = normalizeReviewPayload(
    {
      outcome: "corrected",
      categoryId: "road_damage",
      priority: "Medium",
      department: "Ward Road Inspection Team",
      reason: "The category is correct but this ward team owns the response.",
      expectedVersion: 3
    },
    routingOnlyComplaint
  );
  applyHumanReview(routingOnlyComplaint, routingOnly, auth);
  assert.equal(routingOnlyComplaint.status, "Escalated");
  assert.equal(routingOnlyComplaint.followUp.count, 1);

  assert.throws(
    () => normalizeReviewPayload({ outcome: "corrected", categoryId: "road_damage", priority: "Medium", department: "Road Maintenance Department", reason: "No actual fields have changed here.", expectedVersion: 3 }, complaintFixture()),
    /Change at least one/
  );
  assert.throws(
    () => normalizeReviewPayload({ outcome: "confirmed", categoryId: "tree_obstruction", priority: "Medium", department: "Road Maintenance Department", reason: "This attempts to alter a confirmed decision.", expectedVersion: 3 }, complaintFixture()),
    /must keep the current/
  );
  assert.throws(
    () => normalizeReviewPayload({ outcome: "confirmed", reason: "Too short", expectedVersion: 3 }, complaintFixture()),
    /reasoning must be between/
  );

  const originalFindById = Complaint.findById;
  try {
    const staleComplaint = complaintFixture();
    Complaint.findById = async () => staleComplaint;
    const stale = await callController({
      params: { id: staleComplaint._id },
      body: {
        outcome: "confirmed",
        reason: "The AI decision is supported by the submitted evidence.",
        expectedVersion: 2
      },
      auth
    });
    assert.equal(stale.nextError?.statusCode, 409);

    const currentComplaint = complaintFixture();
    Complaint.findById = async () => currentComplaint;
    const current = await callController({
      params: { id: currentComplaint._id },
      body: {
        outcome: "confirmed",
        categoryId: "road_damage",
        priority: "Medium",
        department: "Road Maintenance Department",
        reason: "The submitted evidence supports the current AI classification.",
        expectedVersion: 3
      },
      auth
    });
    assert.ifError(current.nextError);
    assert.equal(current.payload.humanReview.status, "confirmed");
    assert.equal(currentComplaint.__v, 4);

    const bypassComplaint = complaintFixture();
    Complaint.findById = async () => bypassComplaint;
    let bypassError;
    await updateComplaintStatus(
      {
        params: { id: bypassComplaint._id },
        body: { priority: "Critical" },
        auth
      },
      { json() {} },
      (error) => { bypassError = error; }
    );
    assert.equal(bypassError?.statusCode, 400);
    assert.match(bypassError?.message || "", /human-review workflow/);
    assert.equal(bypassComplaint.priority, "Medium");
  } finally {
    Complaint.findById = originalFindById;
  }

  const model = new Complaint({
    reporter: "Citizen",
    reporterUsername: "citizen@example.com",
    type: "Road Damage",
    priority: "Medium",
    status: "Needs Review",
    source: "Test",
    confidence: 60,
    location: "Bengaluru",
    description: "Road damage",
    humanReview: correctedComplaint.humanReview
  });
  assert.ifError(model.validateSync());

  console.log(JSON.stringify({
    passed: true,
    outcomes: ["confirmed", "corrected", "insufficient_evidence"],
    staleWriteRejected: true,
    directSeverityBypassRejected: true,
    originalDecisionPreserved: true,
    operationalFieldsSynchronized: true,
    schemaValidated: true
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
