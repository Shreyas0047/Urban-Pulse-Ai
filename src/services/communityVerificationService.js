const crypto = require("crypto");
const env = require("../config/env");
const { areaMatchesLocation, normalizeArea } = require("../utils/localAlerts");

const SIGNAL_ALIASES = Object.freeze({
  still_present: "still_present",
  corroborates: "still_present",
  worsening: "worsening",
  resolved: "resolved",
  cleared: "resolved",
  duplicate: "duplicate"
});
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const COOLDOWN_MS = 5 * 60 * 1000;
const REVISION_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_REVISIONS_PER_WINDOW = 4;

function normalizeSignal(value) {
  return SIGNAL_ALIASES[String(value || "").trim().toLowerCase()] || "";
}

function hmac(value) {
  return crypto.createHmac("sha256", env.jwtSecret).update(String(value || "")).digest("hex");
}

function actorHash(auth, complaintId) {
  return hmac(`community-actor:${auth?.userId || "anonymous"}:${complaintId}`);
}

function areaKeyHash(area) {
  return hmac(`community-area:${normalizeArea(area)}`);
}

function complaintLocationParts(complaint) {
  return [
    complaint.location,
    complaint.areaIntelligence?.likelyArea,
    complaint.routing?.ward,
    complaint.routing?.wardCode,
    ...(complaint.areaIntelligence?.matchedAreas || [])
  ].filter(Boolean);
}

function eligibleSavedArea(preferences, complaint) {
  if (!preferences?.enabled || !Array.isArray(preferences.areas)) return null;
  const parts = complaintLocationParts(complaint);
  return preferences.areas.find((area) => areaMatchesLocation(area.normalized || area.label, parts)) || null;
}

function shiftPriority(priority, adjustment) {
  const index = Math.max(0, PRIORITIES.indexOf(priority));
  return PRIORITIES[Math.max(0, Math.min(PRIORITIES.length - 1, index + adjustment))];
}

function summarizeCommunityVerification(signals = [], complaint = {}) {
  const summary = {
    total: signals.length,
    trustedTotal: 0,
    suspiciousCount: 0,
    stillPresent: 0,
    worsening: 0,
    resolved: 0,
    duplicate: 0,
    corroborates: 0,
    cleared: 0,
    latestStatus: "unverified",
    conflictScore: 0,
    confidenceAdjustment: 0,
    effectiveConfidence: Number(complaint.confidence || 0),
    urgencyAdjustment: 0,
    effectivePriority: String(complaint.priority || "Medium"),
    communityWide: false,
    lastSignalAt: null,
    lastVerifiedAt: null
  };

  for (const entry of signals) {
    const signal = normalizeSignal(entry.signal);
    if (entry.suspicious || !signal) {
      summary.suspiciousCount += 1;
      continue;
    }
    summary.trustedTotal += 1;
    summary[signal === "still_present" ? "stillPresent" : signal] += 1;
    const at = entry.updatedAt || entry.createdAt;
    if (at && (!summary.lastVerifiedAt || new Date(at) > new Date(summary.lastVerifiedAt))) summary.lastVerifiedAt = at;
  }
  summary.corroborates = summary.stillPresent;
  summary.cleared = summary.resolved;
  summary.lastSignalAt = summary.lastVerifiedAt;

  const confirms = summary.stillPresent + summary.worsening;
  const opposing = summary.resolved + summary.duplicate;
  const contested = Math.min(confirms, opposing);
  summary.conflictScore = summary.trustedTotal ? Number((contested / summary.trustedTotal).toFixed(2)) : 0;
  summary.communityWide = confirms >= 3 && confirms >= opposing * 2;

  if (summary.conflictScore >= 0.34 && summary.trustedTotal >= 3) summary.latestStatus = "conflicting_reports";
  else if (summary.worsening >= Math.max(1, summary.resolved)) summary.latestStatus = "worsening";
  else if (summary.resolved >= 2 && summary.resolved > confirms) summary.latestStatus = "likely_resolved";
  else if (summary.duplicate >= 2 && summary.duplicate >= confirms) summary.latestStatus = "possible_duplicate";
  else if (confirms > 0) summary.latestStatus = summary.communityWide ? "community_wide" : "still_present";

  const baseConfidence = Number(complaint.confidence || 0);
  const fractionalDelta = Math.max(-0.12, Math.min(0.18, confirms * 0.035 - summary.resolved * 0.025 - summary.duplicate * 0.02));
  const confidenceScale = baseConfidence > 1 ? 100 : 1;
  summary.confidenceAdjustment = Number((fractionalDelta * confidenceScale).toFixed(confidenceScale === 100 ? 1 : 3));
  summary.effectiveConfidence = Number(Math.max(0, Math.min(confidenceScale, baseConfidence + summary.confidenceAdjustment)).toFixed(confidenceScale === 100 ? 1 : 3));
  summary.urgencyAdjustment = summary.worsening >= 2 || summary.communityWide ? 1 : summary.latestStatus === "likely_resolved" ? -1 : 0;
  summary.effectivePriority = shiftPriority(String(complaint.priority || "Medium"), summary.urgencyAdjustment);
  return summary;
}

function applyCommunityVerification({ signals = [], auth, complaint, signal, note = "", duplicateComplaintId = null, now = new Date() }) {
  const normalizedSignal = normalizeSignal(signal);
  if (!normalizedSignal) {
    const error = new Error("Choose a valid community verification status.");
    error.statusCode = 400;
    throw error;
  }
  const hash = actorHash(auth, complaint._id);
  const existingIndex = signals.findIndex((entry) => entry.actorHash && entry.actorHash === hash);
  const existing = existingIndex >= 0 ? signals[existingIndex] : null;
  if (existing && normalizeSignal(existing.signal) === normalizedSignal && String(existing.duplicateComplaintId || "") === String(duplicateComplaintId || "")) {
    return { signals, summary: summarizeCommunityVerification(signals, complaint), outcome: "idempotent", priorSignal: normalizedSignal, actorHash: hash, areaKeyHash: existing.areaKeyHash };
  }
  const existingUpdatedAt = existing ? new Date(existing.updatedAt || existing.createdAt || 0) : null;
  const revisionWindowActive = Boolean(existingUpdatedAt && existingUpdatedAt >= new Date(now.getTime() - REVISION_WINDOW_MS));
  if (existing) {
    const updatedAt = existingUpdatedAt;
    if (now - updatedAt < COOLDOWN_MS) {
      const error = new Error("Please wait five minutes before changing this verification.");
      error.statusCode = 429;
      throw error;
    }
    if (revisionWindowActive && Number(existing.revisionCount || 0) >= MAX_REVISIONS_PER_WINDOW) {
      const error = new Error("Verification revision limit reached for this incident today.");
      error.statusCode = 429;
      throw error;
    }
  }

  const matchedArea = eligibleSavedArea(auth.preferences, complaint);
  const nextEntry = {
    actorHash: hash,
    signal: normalizedSignal,
    note,
    duplicateComplaintId: duplicateComplaintId || null,
    areaKeyHash: areaKeyHash(matchedArea?.normalized || matchedArea?.label || complaint.routing?.wardCode || complaint.location),
    eligibility: "saved_area",
    suspicious: false,
    revisionCount: existing ? (revisionWindowActive ? Number(existing.revisionCount || 0) + 1 : 1) : 0,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  const nextSignals = [...signals];
  if (existingIndex >= 0) nextSignals[existingIndex] = nextEntry;
  else nextSignals.push(nextEntry);
  const boundedSignals = nextSignals.slice(-64);
  return {
    signals: boundedSignals,
    summary: summarizeCommunityVerification(boundedSignals, complaint),
    outcome: existing ? "revised" : "created",
    priorSignal: existing ? normalizeSignal(existing.signal) : "",
    actorHash: hash,
    areaKeyHash: nextEntry.areaKeyHash
  };
}

function publicCommunityVerification(communityProof, auth, complaintId) {
  const signals = communityProof?.signals || [];
  const hash = auth?.userId ? actorHash(auth, complaintId) : "";
  const own = signals.find((entry) => hash && entry.actorHash === hash);
  return { summary: communityProof?.summary || summarizeCommunityVerification([], {}), userSignal: normalizeSignal(own?.signal) };
}

module.exports = {
  COOLDOWN_MS,
  MAX_REVISIONS_PER_WINDOW,
  normalizeSignal,
  actorHash,
  eligibleSavedArea,
  complaintLocationParts,
  summarizeCommunityVerification,
  applyCommunityVerification,
  publicCommunityVerification
};
