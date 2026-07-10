const IncidentCluster = require("../models/IncidentCluster");
const { normalizeArea, tokenizeArea } = require("../utils/localAlerts");

const OPEN_STATUSES = new Set(["Queued", "Needs Review", "In Progress", "Escalated"]);
const CLUSTER_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const EARTH_RADIUS_KM = 6371;

function priorityRank(priority) {
  return { Low: 1, Medium: 2, High: 3, Critical: 4 }[priority] || 0;
}

function highestPriority(left, right) {
  return priorityRank(left) >= priorityRank(right) ? left : right;
}

function radians(value) {
  return (Number(value) * Math.PI) / 180;
}

function distanceKm(left, right) {
  const lat1 = Number(left?.lat);
  const lng1 = Number(left?.lng);
  const lat2 = Number(right?.lat);
  const lng2 = Number(right?.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) {
    return null;
  }

  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function textTokens(value) {
  return new Set(
    tokenizeArea(value)
      .filter((token) => token.length >= 4)
      .filter((token) => !["road", "near", "main", "layout", "ward", "issue", "problem"].includes(token))
  );
}

function tokenOverlapScore(left, right) {
  const leftTokens = textTokens(left);
  const rightTokens = textTokens(right);
  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function getAreaTerms(complaint) {
  return [
    complaint.areaIntelligence?.likelyArea,
    ...(complaint.areaIntelligence?.matchedAreas || []),
    ...(complaint.areaIntelligence?.wardHints || []),
    complaint.location
  ]
    .map(normalizeArea)
    .filter(Boolean);
}

function scoreComplaintMatch(newComplaint, existingComplaint) {
  let score = 0;
  const reasons = [];
  const categoryMatch = newComplaint.ai?.categoryId && newComplaint.ai.categoryId === existingComplaint.ai?.categoryId;
  if (categoryMatch) {
    score += 0.34;
    reasons.push("same issue category");
  }

  const newTerms = new Set(getAreaTerms(newComplaint));
  const existingTerms = getAreaTerms(existingComplaint);
  const areaMatch = existingTerms.some((term) => newTerms.has(term) || [...newTerms].some((newTerm) => term.includes(newTerm) || newTerm.includes(term)));
  if (areaMatch) {
    score += 0.26;
    reasons.push("same inferred area");
  }

  const distance = distanceKm(newComplaint.mapLocation, existingComplaint.mapLocation);
  if (distance !== null && distance <= 1.2) {
    score += 0.2;
    reasons.push(`nearby location (${distance.toFixed(1)} km)`);
  } else if (distance !== null && distance <= 3) {
    score += 0.11;
    reasons.push(`same zone (${distance.toFixed(1)} km)`);
  }

  const textScore = tokenOverlapScore(
    `${newComplaint.description} ${newComplaint.location}`,
    `${existingComplaint.description} ${existingComplaint.location}`
  );
  if (textScore >= 0.2) {
    score += Math.min(0.16, textScore * 0.28);
    reasons.push("similar location/description terms");
  }

  const fingerprint = newComplaint.ai?.imageFingerprint;
  if (fingerprint && fingerprint === existingComplaint.ai?.imageFingerprint) {
    score += 0.32;
    reasons.push("same image fingerprint");
  }

  return {
    score: Math.min(1, score),
    reasons
  };
}

function buildClusterCode(date = new Date()) {
  const stamp = date.toISOString().slice(2, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `INC-${stamp}-${suffix}`;
}

function summarizeBestMatch(matches) {
  const best = matches[0];
  if (!best) {
    return {
      confidence: 0,
      reason: "No similar recent complaints found."
    };
  }

  return {
    confidence: Number(best.score.toFixed(2)),
    reason: best.reasons.join(", ") || "Similar recent complaint signal."
  };
}

async function findCandidateComplaints(complaint) {
  const since = new Date(Date.now() - CLUSTER_LOOKBACK_MS);
  const categoryId = complaint.ai?.categoryId || "";
  const areaTerms = getAreaTerms(complaint).slice(0, 8);
  const areaRegexes = areaTerms.map((term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

  const filters = [
    { _id: { $ne: complaint._id }, createdAt: { $gte: since }, status: { $in: [...OPEN_STATUSES] } }
  ];
  if (categoryId) {
    filters.push({ "ai.categoryId": categoryId });
  }
  if (areaRegexes.length) {
    filters.push({
      $or: [
        { location: { $in: areaRegexes } },
        { "areaIntelligence.matchingTerms": { $in: areaRegexes } },
        { "areaIntelligence.normalizedLocation": { $in: areaRegexes } }
      ]
    });
  }

  return complaint.constructor.find({ $and: filters }).sort({ createdAt: -1 }).limit(25).lean();
}

async function attachComplaintToCluster(complaint) {
  const candidates = await findCandidateComplaints(complaint);
  const matches = candidates
    .map((candidate) => ({
      complaint: candidate,
      ...scoreComplaintMatch(complaint.toObject ? complaint.toObject() : complaint, candidate)
    }))
    .filter((match) => match.score >= 0.58)
    .sort((left, right) => right.score - left.score);
  const summary = summarizeBestMatch(matches);
  const best = matches[0];

  if (!best) {
    complaint.incidentCluster = {
      clustered: false,
      clusterId: null,
      clusterCode: "",
      title: "",
      confidence: 0,
      matchReason: "No similar recent complaints found.",
      mergedCount: 1,
      matchedComplaintIds: []
    };
    await complaint.save();
    return complaint.incidentCluster;
  }

  let cluster = null;
  if (best.complaint.incidentCluster?.clusterId) {
    cluster = await IncidentCluster.findById(best.complaint.incidentCluster.clusterId);
  }

  if (!cluster) {
    cluster = await IncidentCluster.create({
      clusterCode: buildClusterCode(),
      title: `${best.complaint.type} near ${best.complaint.areaIntelligence?.likelyArea || best.complaint.location}`,
      categoryId: best.complaint.ai?.categoryId || "general",
      issueType: best.complaint.type,
      priority: highestPriority(best.complaint.priority, complaint.priority),
      location: best.complaint.location,
      area: best.complaint.areaIntelligence?.likelyArea || "",
      normalizedArea: normalizeArea(best.complaint.areaIntelligence?.likelyArea || best.complaint.location),
      mapLocation: best.complaint.mapLocation,
      complaintIds: [best.complaint._id],
      reporterUsernames: [best.complaint.reporterUsername].filter(Boolean),
      imageFingerprints: [best.complaint.ai?.imageFingerprint].filter(Boolean),
      confidence: summary.confidence,
      matchReason: summary.reason,
      firstReportedAt: best.complaint.createdAt || new Date(),
      lastReportedAt: new Date(),
      mergedCount: 1
    });
  }

  const complaintIds = new Set((cluster.complaintIds || []).map(String));
  complaintIds.add(String(complaint._id));
  matches.slice(0, 4).forEach((match) => complaintIds.add(String(match.complaint._id)));
  cluster.complaintIds = [...complaintIds];
  cluster.reporterUsernames = [...new Set([...(cluster.reporterUsernames || []), complaint.reporterUsername].filter(Boolean))];
  cluster.imageFingerprints = [...new Set([...(cluster.imageFingerprints || []), complaint.ai?.imageFingerprint].filter(Boolean))];
  cluster.priority = highestPriority(cluster.priority, complaint.priority);
  cluster.lastReportedAt = new Date();
  cluster.mergedCount = cluster.complaintIds.length;
  cluster.confidence = Math.max(Number(cluster.confidence || 0), summary.confidence);
  cluster.matchReason = summary.reason;
  if (complaint.status === "Resolved") {
    cluster.status = "monitoring";
  }
  await cluster.save();

  const matchedComplaintIds = matches.slice(0, 4).map((match) => match.complaint._id);
  if (matchedComplaintIds.length) {
    await complaint.constructor.updateMany(
      { _id: { $in: matchedComplaintIds } },
      {
        $set: {
          "incidentCluster.clustered": true,
          "incidentCluster.clusterId": cluster._id,
          "incidentCluster.clusterCode": cluster.clusterCode,
          "incidentCluster.title": cluster.title,
          "incidentCluster.confidence": summary.confidence,
          "incidentCluster.matchReason": summary.reason,
          "incidentCluster.mergedCount": cluster.mergedCount,
          "incidentCluster.matchedComplaintIds": [
            complaint._id,
            ...matchedComplaintIds
          ]
        }
      }
    );
  }

  complaint.incidentCluster = {
    clustered: true,
    clusterId: cluster._id,
    clusterCode: cluster.clusterCode,
    title: cluster.title,
    confidence: summary.confidence,
    matchReason: summary.reason,
    mergedCount: cluster.mergedCount,
    matchedComplaintIds
  };
  complaint.alerts = [
    ...(complaint.alerts || []),
    `Linked to incident cluster ${cluster.clusterCode}: ${summary.reason}`
  ];
  await complaint.save();
  return complaint.incidentCluster;
}

module.exports = {
  attachComplaintToCluster,
  scoreComplaintMatch
};
