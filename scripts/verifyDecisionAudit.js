const assert = require("assert");
const DecisionAuditEvent = require("../src/models/DecisionAuditEvent");
const Complaint = require("../src/models/Complaint");
const { resetDashboard } = require("../src/controllers/dashboardController");
const {
  aggregateCorrectionFeedback,
  appendDecisionEvent,
  decisionSnapshot,
  eventsToCsv,
  recordAiBaseline,
  verifyDecisionAudit
} = require("../src/services/decisionAuditService");

function complaintFixture() {
  return {
    _id: "507f1f77bcf86cd799439011",
    type: "Road Damage",
    priority: "Medium",
    confidence: 74,
    assignedAuthority: "Municipality",
    routing: { authority: "Municipality", department: "Road Maintenance Department" },
    ai: {
      categoryId: "road_damage",
      recommendedTeam: "Road Maintenance Department",
      reviewRequired: true,
      provider: "local",
      engine: "decision-engine-v4",
      evaluationVersion: "4.0",
      imageFingerprint: "abc123"
    }
  };
}

async function main() {
  const events = [];
  const originals = {
    findOne: DecisionAuditEvent.findOne,
    find: DecisionAuditEvent.find,
    create: DecisionAuditEvent.create
  };
  const query = (rows) => ({
    sort() { return this; },
    limit() { return this; },
    session() { return this; },
    async lean() { return rows; }
  });

  try {
    DecisionAuditEvent.findOne = () => query(events.at(-1) || null);
    DecisionAuditEvent.find = (filter = {}) => {
      const rows = filter.eventType ? events.filter((event) => event.eventType === filter.eventType) : [...events];
      return query(rows);
    };
    DecisionAuditEvent.create = async ([event]) => {
      const stored = JSON.parse(JSON.stringify(event));
      events.push(stored);
      return [stored];
    };

    const complaint = complaintFixture();
    const baseline = await recordAiBaseline(complaint);
    assert.equal(baseline.sequence, 1);
    assert.equal(baseline.previousHash, "0".repeat(64));
    assert.equal(complaint.decisionAudit.eventCount, 1);

    const before = decisionSnapshot(complaint);
    complaint.type = "Tree / Obstruction on Road";
    complaint.priority = "Critical";
    complaint.routing.department = "Horticulture Emergency Response";
    complaint.ai.categoryId = "tree_obstruction";
    complaint.ai.reviewRequired = false;
    const correction = await appendDecisionEvent({
      complaint,
      eventType: "human_review",
      outcome: "corrected",
      actorType: "human",
      actorRole: "Admin",
      before,
      after: decisionSnapshot(complaint),
      changedFields: ["priority", "categoryId", "type", "department"],
      reason: "Visible evidence confirms a fallen tree blocking the roadway.",
      occurredAt: new Date("2026-07-13T12:00:00.000Z")
    });
    assert.equal(correction.sequence, 2);
    assert.equal(correction.previousHash, baseline.eventHash);
    assert.equal(correction.actorRole, "Admin");
    assert.ok(!JSON.stringify(correction).includes("reviewer@example.com"));

    const verified = await verifyDecisionAudit(complaint._id, { complaint });
    assert.equal(verified.status, "verified");
    assert.equal(verified.checkedEvents, 2);
    assert.deepEqual(verified.issues, []);

    const feedback = await aggregateCorrectionFeedback();
    assert.equal(feedback.summary.totalReviews, 1);
    assert.equal(feedback.summary.corrected, 1);
    assert.equal(feedback.summary.changedFields.priority, 1);
    assert.equal(feedback.summary.categoryCorrections["road_damage -> tree_obstruction"], 1);

    const csv = eventsToCsv(events);
    assert.match(csv, /eventId,complaintId,sequence/);
    assert.match(csv, /fallen tree/);

    events[1].reason = "tampered reason";
    const tampered = await verifyDecisionAudit(complaint._id, { complaint });
    assert.equal(tampered.status, "failed");
    assert.ok(tampered.issues.some((issue) => issue.includes("Event hash failed")));

    const model = new DecisionAuditEvent({ ...events[0], complaintId: complaint._id, occurredAt: new Date(events[0].occurredAt) });
    assert.ifError(model.validateSync());
    assert.ok(DecisionAuditEvent.schema.indexes().some(([fields, options]) => fields.complaintId === 1 && fields.sequence === 1 && options.unique));

    const complaintModel = new Complaint({
      reporter: "Citizen",
      reporterUsername: "citizen@example.com",
      type: "Road Damage",
      priority: "Medium",
      status: "Needs Review",
      source: "Test",
      confidence: 74,
      location: "Bengaluru",
      description: "Road damage",
      decisionAudit: complaint.decisionAudit
    });
    assert.ifError(complaintModel.validateSync());

    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    let resetError;
    await resetDashboard({}, {}, (error) => { resetError = error; });
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    assert.equal(resetError?.statusCode, 403);
    assert.match(resetError?.message || "", /audit records/);

    console.log(JSON.stringify({
      passed: true,
      appendOnlyModel: true,
      sequenceLinked: true,
      tamperingDetected: true,
      reviewerIdentityRedacted: true,
      correctionFeedbackAggregated: true,
      csvExportValidated: true,
      productionResetBlocked: true
    }, null, 2));
  } finally {
    DecisionAuditEvent.findOne = originals.findOne;
    DecisionAuditEvent.find = originals.find;
    DecisionAuditEvent.create = originals.create;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
