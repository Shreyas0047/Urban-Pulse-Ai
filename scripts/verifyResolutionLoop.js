const assert = require("assert");

// Keep this controller test deterministic and exercise the local comparison fallback.
global.fetch = async () => {
  throw new Error("AI service intentionally unavailable in smoke test");
};

const Complaint = require("../src/models/Complaint");
const User = require("../src/models/User");
const { submitCommunityProof, submitResolutionEvidence, updateComplaintStatus } = require("../src/controllers/complaintController");

function responseCapture() {
  return {
    body: null,
    json(payload) {
      this.body = payload;
    }
  };
}

async function invoke(handler, req) {
  const res = responseCapture();
  let nextError = null;
  await handler(req, res, (error) => {
    nextError = error;
  });
  if (nextError) throw nextError;
  return res.body;
}

async function main() {
  const complaint = {
    _id: "resolution-smoke-test",
    reporterUserId: "citizen-1",
    reporterUsername: "citizen@example.com",
    type: "Garbage Overflow",
    priority: "Low",
    status: "In Progress",
    location: "Indiranagar",
    ai: { categoryId: "garbage" },
    statusHistory: [],
    alerts: [],
    followUp: {},
    resolution: null,
    async save() {
      return this;
    }
  };
  Complaint.findById = async () => complaint;

  await invoke(updateComplaintStatus, {
    params: { id: complaint._id },
    body: { status: "Resolved", note: "Cleanup completed." },
    auth: { username: "admin@example.com", userId: "admin-1", permissions: ["update_complaint_status", "view_dashboard"] }
  });
  assert.equal(complaint.status, "Resolved");
  assert.equal(complaint.resolution.phase, "awaiting_citizen_verification");

  const result = await invoke(submitResolutionEvidence, {
    params: { id: complaint._id },
    body: { vote: "still_there", note: "The waste pile is still present." },
    auth: { username: "citizen@example.com", userId: "citizen-1", permissions: ["submit_complaint"] }
  });
  assert.equal(result.resolution.phase, "needs_rework");
  assert.equal(complaint.status, "In Progress");
  assert.equal(complaint.statusHistory.at(-1).status, "In Progress");
  assert.equal(complaint.resolution.citizenEvidence.length, 1);

  User.findById = () => ({
    lean: async () => ({
      localAlertPreferences: {
        enabled: true,
        areas: [{ label: "Indiranagar", normalized: "indiranagar" }]
      }
    })
  });
  const community = await invoke(submitCommunityProof, {
    params: { id: complaint._id },
    body: { signal: "corroborates", note: "I can confirm this from the same road." },
    auth: { username: "nearby@example.com", userId: "nearby-1", permissions: ["submit_complaint"] }
  });
  assert.equal(community.communityProof.summary.corroborates, 1);

  console.log(JSON.stringify({
    passed: true,
    authorityPhase: "awaiting_citizen_verification",
    citizenOutcome: result.resolution.phase,
    reopenedStatus: complaint.status,
    communitySignals: community.communityProof.summary.total
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
