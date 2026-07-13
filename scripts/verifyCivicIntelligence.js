const assert = require("assert");
const { buildCivicIntelligence, buildComplaintIntelligence } = require("../src/services/civicIntelligenceService");
const { buildCommunityCases } = require("../src/services/communityProofService");

const complaint = {
  _id: "civic-intelligence-smoke",
  type: "Tree / Obstruction on Road",
  description: "A fallen tree is blocking the road.",
  priority: "High",
  status: "In Progress",
  location: "Indiranagar",
  createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
  mapLocation: { lat: 12.9716, lng: 77.5946 },
  areaIntelligence: { likelyArea: "Indiranagar", confidence: 0.86 },
  routing: { ward: "East Ward" },
  ai: { categoryId: "tree_obstruction", imageFingerprint: "abc", threatAssessment: { threatLevel: "High", riskScore: 0.76, integrity: { status: "checked" } } },
  statusHistory: [{ status: "In Progress", changedAt: new Date(), note: "Unit assigned" }],
  communityProof: { summary: { total: 2, corroborates: 2 }, signals: [{ signal: "corroborates", createdAt: new Date(), note: "Road remains blocked" }] }
};

const intelligence = buildCivicIntelligence([complaint]);
const detail = buildComplaintIntelligence(complaint);
assert.equal(intelligence.radar.length, 1);
assert.equal(intelligence.radar[0].zone, "Indiranagar");
assert.ok(intelligence.scenarios[0].impactScore > 0);
assert.ok(detail.dna.strands.length >= 6);
assert.ok(detail.timeMachine.length >= 2);
const communityCases = buildCommunityCases(
  [complaint, { ...complaint, _id: "own-case", reporterUserId: "citizen-1" }],
  { enabled: true, severityThreshold: "High", areas: [{ label: "Indiranagar", normalized: "indiranagar" }] },
  "citizen-1",
  "citizen"
);
assert.equal(communityCases.length, 1);
assert.equal(communityCases[0].area, "Indiranagar");
assert.equal(communityCases[0].description, undefined);
assert.equal(communityCases[0].reporterUsername, undefined);
console.log(JSON.stringify({ passed: true, radarZone: intelligence.radar[0].zone, impact: intelligence.scenarios[0].impactScore, dnaStrands: detail.dna.strands.length, communityCases: communityCases.length }, null, 2));
