const assert = require("assert");
const { buildAiObservability, jensenShannon } = require("../src/services/aiObservabilityService");

const now = new Date("2026-07-13T12:00:00.000Z");
const daysAgo = (days) => new Date(now.getTime() - days * 86400000);

function complaint(days, overrides = {}) {
  return {
    createdAt: daysAgo(days),
    confidence: 82,
    priority: "Medium",
    status: "In Progress",
    ai: { categoryId: "road_damage", provider: "local", reviewRequired: false, fallbackUsed: false },
    ...overrides,
    ai: { categoryId: "road_damage", provider: "local", reviewRequired: false, fallbackUsed: false, ...(overrides.ai || {}) }
  };
}

function main() {
  assert.equal(jensenShannon({ road: 1 }, { road: 1 }), 0);
  assert.ok(jensenShannon({ road: 1 }, { garbage: 1 }) > 0.9);

  const insufficient = buildAiObservability([complaint(2)], [], { now });
  assert.equal(insufficient.status, "insufficient_data");
  assert.equal(insufficient.alerts.length, 0);

  const stableComplaints = [
    ...Array.from({ length: 12 }, (_, index) => complaint(index + 1)),
    ...Array.from({ length: 12 }, (_, index) => complaint(index + 31))
  ];
  const stable = buildAiObservability(stableComplaints, [], { now });
  assert.equal(stable.status, "stable");
  assert.equal(stable.shifts.categoryDivergence, 0);

  const driftingComplaints = [
    ...Array.from({ length: 12 }, (_, index) => complaint(index + 1, {
      confidence: 55,
      status: "Needs Review",
      priority: "Critical",
      ai: { categoryId: "safety_fire", provider: "fallback", reviewRequired: true, fallbackUsed: true }
    })),
    ...Array.from({ length: 12 }, (_, index) => complaint(index + 31))
  ];
  const auditEvents = Array.from({ length: 10 }, (_, index) => ({
    eventType: "human_review",
    outcome: index < 6 ? "corrected" : "confirmed",
    occurredAt: daysAgo(index + 1)
  }));
  const drifting = buildAiObservability(driftingComplaints, auditEvents, { now });
  assert.equal(drifting.status, "critical");
  assert.ok(drifting.alerts.some((item) => item.code === "category_drift"));
  assert.ok(drifting.alerts.some((item) => item.code === "fallback_spike"));
  assert.ok(drifting.alerts.some((item) => item.code === "correction_rate_high"));
  assert.ok(drifting.shifts.confidencePoints <= -20);

  console.log(JSON.stringify({
    passed: true,
    insufficientDataDoesNotAlert: true,
    stableWindowRecognized: true,
    categoryAndSeverityDriftDetected: true,
    fallbackAndCorrectionAlertsDetected: true
  }, null, 2));
}

main();
