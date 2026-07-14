const assert = require("assert");
const {
  COOLDOWN_MS,
  actorHash,
  eligibleSavedArea,
  applyCommunityVerification,
  publicCommunityVerification,
  summarizeCommunityVerification
} = require("../src/services/communityVerificationService");

const complaint = {
  _id: "507f1f77bcf86cd799439011",
  reporterUserId: "reporter-private-id",
  reporterUsername: "reporter@example.com",
  location: "Indiranagar, Bengaluru",
  priority: "Medium",
  confidence: 70,
  routing: { ward: "Indiranagar ward office", wardCode: "BBMP-INDIRANAGAR" },
  areaIntelligence: { likelyArea: "Indiranagar", matchedAreas: ["Indiranagar"] }
};
const preferences = { enabled: true, areas: [{ label: "Indiranagar", normalized: "indiranagar" }] };

function add(signals, userId, signal, now, duplicateComplaintId = null) {
  return applyCommunityVerification({ signals, auth: { userId, preferences }, complaint, signal, duplicateComplaintId, now });
}

function main() {
  assert(eligibleSavedArea(preferences, complaint));
  assert.equal(eligibleSavedArea({ enabled: true, areas: [{ label: "Yelahanka" }] }, complaint), null);
  assert.notEqual(actorHash({ userId: "nearby-1" }, complaint._id), actorHash({ userId: "nearby-2" }, complaint._id));

  let signals = [];
  const start = new Date("2026-07-14T10:00:00.000Z");
  const first = add(signals, "nearby-1", "still_present", start);
  signals = first.signals;
  assert.equal(first.summary.stillPresent, 1);
  assert.equal(first.summary.effectiveConfidence, 73.5);
  assert(signals.every((entry) => !entry.userId && !entry.username && !entry.email));

  const idempotent = add(signals, "nearby-1", "still_present", new Date(start.getTime() + 1000));
  assert.equal(idempotent.outcome, "idempotent");
  assert.throws(() => add(signals, "nearby-1", "resolved", new Date(start.getTime() + COOLDOWN_MS - 1)), /wait five minutes/);
  signals = add(signals, "nearby-2", "worsening", new Date(start.getTime() + 1000)).signals;
  signals = add(signals, "nearby-3", "still_present", new Date(start.getTime() + 2000)).signals;
  const communityWide = summarizeCommunityVerification(signals, complaint);
  assert.equal(communityWide.communityWide, true);
  assert.equal(communityWide.effectivePriority, "High");

  signals = add(signals, "nearby-4", "resolved", new Date(start.getTime() + 3000)).signals;
  signals = add(signals, "nearby-5", "resolved", new Date(start.getTime() + 4000)).signals;
  const conflict = summarizeCommunityVerification(signals, complaint);
  assert.equal(conflict.latestStatus, "conflicting_reports");

  const duplicate = add(signals, "nearby-6", "duplicate", new Date(start.getTime() + 5000), "507f1f77bcf86cd799439012");
  assert.equal(duplicate.summary.duplicate, 1);
  const publicView = publicCommunityVerification({ summary: duplicate.summary, signals: duplicate.signals }, { userId: "nearby-6" }, complaint._id);
  assert.equal(publicView.userSignal, "duplicate");
  assert(!Object.prototype.hasOwnProperty.call(publicView, "signals"));
  assert(!JSON.stringify(publicView).includes("reporter@example.com"));

  console.log(JSON.stringify({ passed: true, privacySafe: true, idempotent: true, cooldownEnforced: true, conflictHandled: true, communityWideDetected: true }, null, 2));
}

main();
