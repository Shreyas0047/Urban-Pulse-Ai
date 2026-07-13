const { areaMatchesLocation, meetsSeverityThreshold } = require("../utils/localAlerts");

function complaintLocationParts(complaint) {
  return [
    complaint.location,
    complaint.areaIntelligence?.likelyArea,
    complaint.routing?.ward,
    ...(complaint.areaIntelligence?.matchedAreas || [])
  ].filter(Boolean);
}

function publicAreaLabel(complaint) {
  return String(
    complaint.areaIntelligence?.likelyArea ||
      complaint.routing?.ward ||
      "Saved local-alert area"
  ).trim();
}

function buildCommunityCases(complaints, preferences, currentUserId, currentUsername) {
  if (!preferences?.enabled || !Array.isArray(preferences.areas) || !preferences.areas.length) {
    return [];
  }

  const userId = String(currentUserId || "");
  const username = String(currentUsername || "");
  const threshold = preferences.severityThreshold || "High";

  return (complaints || [])
    .filter((complaint) => {
      const isOwner =
        (userId && String(complaint.reporterUserId || "") === userId) ||
        (username && String(complaint.reporterUsername || "") === username);
      if (isOwner || complaint.status === "Resolved" || !meetsSeverityThreshold(complaint.priority, threshold)) {
        return false;
      }

      const locationParts = complaintLocationParts(complaint);
      return preferences.areas.some((area) =>
        areaMatchesLocation(area.normalized || area.label, locationParts)
      );
    })
    .slice(0, 12)
    .map((complaint) => {
      const signals = complaint.communityProof?.signals || [];
      const ownSignal = signals.find((entry) => userId && String(entry.userId || "") === userId);
      return {
        id: String(complaint._id || ""),
        type: String(complaint.type || "Civic issue"),
        priority: String(complaint.priority || "Medium"),
        status: String(complaint.status || "Queued"),
        area: publicAreaLabel(complaint),
        createdAt: complaint.createdAt || null,
        communityProof: {
          summary: complaint.communityProof?.summary || {
            total: 0,
            corroborates: 0,
            cleared: 0,
            worsening: 0,
            lastSignalAt: null
          },
          userSignal: ownSignal?.signal || ""
        }
      };
    });
}

module.exports = {
  buildCommunityCases,
  complaintLocationParts
};
