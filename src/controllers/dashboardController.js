const Complaint = require("../models/Complaint");
const IncidentCommand = require("../models/IncidentCommand");
const IncidentCluster = require("../models/IncidentCluster");
const EmergencyBroadcast = require("../models/EmergencyBroadcast");
const DecisionAuditEvent = require("../models/DecisionAuditEvent");
const AuthorityTicket = require("../models/AuthorityTicket");
const CityActivationReview = require("../models/CityActivationReview");
const CityRolloutState = require("../models/CityRolloutState");
const CityDailyIntake = require("../models/CityDailyIntake");
const CityOperationalEvent = require("../models/CityOperationalEvent");
const CityOperationalIncident = require("../models/CityOperationalIncident");
const { buildAiObservability } = require("../services/aiObservabilityService");
const User = require("../models/User");
const { buildCivicDigitalTwin } = require("../services/civicDigitalTwinService");
const { refreshFollowUpsForComplaints } = require("../services/followUpService");
const { buildCivicRiskPredictions } = require("../services/riskPredictionService");
const { buildCivicIntelligence } = require("../services/civicIntelligenceService");
const { buildCommunityCases } = require("../services/communityProofService");
const { CITY_IDS, DEFAULT_CITY_ID, DEFAULT_CITY_NAME } = require("../services/cityRegistryService");
const cityRegistry = require("../../shared/cityRegistry.json");

const iotReadings = [
  { sensor: "Gas Sensor", zone: "Community Kitchen", value: 74, unit: "ppm", status: "Warning" },
  { sensor: "Smoke Sensor", zone: "Parking Basement", value: 11, unit: "AQI", status: "Normal" },
  { sensor: "Fire Sensor", zone: "Library Hall", value: 0, unit: "trigger", status: "Normal" }
];

function hasActiveIncident(complaint) {
  return Boolean(
    complaint.incidentCommand?.triggered &&
      !["Closed", "Resolved"].includes(String(complaint.incidentCommand?.status || "Active"))
  );
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegex(value) {
  const normalized = String(value || "").trim();
  return normalized ? new RegExp(escapeRegex(normalized), "i") : null;
}

function priorityWeight(priority) {
  const order = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  return order[priority] || 0;
}

function countBy(items, selector) {
  const counts = new Map();

  items.forEach((item) => {
    const key = selector(item);
    if (!key) {
      return;
    }
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);
}

function summarizePriorityCounts(items) {
  return items.reduce(
    (acc, item) => {
      acc[item.priority] = (acc[item.priority] || 0) + 1;
      return acc;
    },
    { Critical: 0, High: 0, Medium: 0, Low: 0 }
  );
}

function matchesComplaintFilters(complaint, filters) {
  const complaintSearch = filters.complaintSearchRegex;
  const alertSearch = filters.alertSearchRegex;

  const complaintSearchMatch =
    !complaintSearch ||
    [complaint.type, complaint.location, complaint.status, complaint.assignedAuthority, complaint.description]
      .some((value) => complaintSearch.test(String(value || "")));

  const statusMatch = !filters.complaintStatus || complaint.status === filters.complaintStatus;
  const alertPriorityMatch = !filters.alertPriority || complaint.priority === filters.alertPriority;
  const alerts = Array.isArray(complaint.alerts) ? complaint.alerts : [];
  const hasAlerts = alerts.length > 0;
  const alertSearchMatch =
    !alertSearch ||
    [complaint.type, complaint.location, complaint.priority, ...alerts]
      .some((value) => alertSearch.test(String(value || "")));

  return {
    complaintMatch: complaintSearchMatch && statusMatch,
    alertMatch: hasAlerts && alertPriorityMatch && alertSearchMatch
  };
}

function sortComplaints(items, sortMode) {
  const complaints = [...items];

  complaints.sort((left, right) => {
    if (sortMode === "priority") {
      const priorityDelta = priorityWeight(right.priority) - priorityWeight(left.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
    }

    if (sortMode === "oldest") {
      return new Date(left.createdAt || 0) - new Date(right.createdAt || 0);
    }

    return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
  });

  return complaints;
}

function filterUsers(users, filters) {
  const userSearch = filters.userSearchRegex;
  const userState = String(filters.userState || "");

  return users.filter((user) => {
    const matchesSearch =
      !userSearch ||
      [user.username, user.email, user.role].some((value) => userSearch.test(String(value || "")));
    const isDisabled = Boolean(user.disabledAt);
    const matchesState = !userState || (userState === "disabled" ? isDisabled : !isDisabled);
    return matchesSearch && matchesState;
  });
}

function cityDataFilter(cityId) {
  const normalized = String(cityId || DEFAULT_CITY_ID).trim().toLowerCase();
  return normalized === DEFAULT_CITY_ID
    ? { $or: [{ cityId: normalized }, { cityId: { $exists: false } }] }
    : { cityId: normalized };
}

function resolveOperationsCity(value, allowedCityIds = [DEFAULT_CITY_ID]) {
  const cityId = String(value || allowedCityIds[0] || DEFAULT_CITY_ID).trim().toLowerCase();
  if (!CITY_IDS.includes(cityId)) {
    const error = new Error("Choose a registered operations city.");
    error.statusCode = 400;
    throw error;
  }
  if (!allowedCityIds.includes(cityId)) {
    const error = new Error("This Admin account is not assigned to the selected operations city.");
    error.statusCode = 403;
    throw error;
  }
  const city = cityRegistry.cities.find((item) => item.slug === cityId);
  return { id: cityId, name: city?.name || DEFAULT_CITY_NAME };
}

async function getDashboard(req, res, next) {
  try {
    const canViewDashboard = req.auth.permissions.includes("view_dashboard");
    const canViewSensors = req.auth.permissions.includes("view_sensors");
    const canDeleteUsers = req.auth.permissions.includes("delete_users");
    const allowedCityIds = req.auth.operationalCityIds?.length ? req.auth.operationalCityIds : [DEFAULT_CITY_ID];
    const operationsCity = canViewDashboard ? resolveOperationsCity(req.query.cityId, allowedCityIds) : null;
    const complaintFilter = canViewDashboard ? cityDataFilter(operationsCity.id) : { reporterUsername: req.auth.username };
    const filters = {
      complaintSearchRegex: buildRegex(req.query.complaintSearch),
      complaintStatus: String(req.query.complaintStatus || "").trim(),
      complaintSort: String(req.query.complaintSort || "newest").trim(),
      alertSearchRegex: buildRegex(req.query.alertSearch),
      alertPriority: String(req.query.alertPriority || "").trim(),
      userSearchRegex: buildRegex(req.query.userSearch),
      userState: String(req.query.userState || "").trim()
    };

    const observabilityStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const [complaintDocs, users, incidentCommands, incidentClusters] = await Promise.all([
      Complaint.find(complaintFilter).sort({ createdAt: -1 }),
      canDeleteUsers
        ? User.find({}, { username: 1, email: 1, role: 1, operationalCityIds: 1, disabledAt: 1, disabledBy: 1, lastLoginAt: 1, createdAt: 1 }).sort({ role: 1, username: 1 }).lean()
        : Promise.resolve([]),
      canViewDashboard
        ? IncidentCommand.find({ ...cityDataFilter(operationsCity.id), commandStatus: { $in: ["Active", "Monitoring"] } }).sort({ riskScore: -1, slaDueAt: 1 }).limit(12).lean()
        : Promise.resolve([]),
      canViewDashboard
        ? IncidentCluster.find({ ...cityDataFilter(operationsCity.id), status: { $in: ["active", "monitoring"] } }).sort({ mergedCount: -1, lastReportedAt: -1 }).limit(12).lean()
        : Promise.resolve([])
    ]);
    const decisionEvents = canViewDashboard && complaintDocs.length
      ? await DecisionAuditEvent.find({ complaintId: { $in: complaintDocs.map((item) => item._id) }, occurredAt: { $gte: observabilityStart } }).sort({ occurredAt: -1 }).limit(5000).lean()
      : [];
    let communityCases = [];
    if (!canViewDashboard && req.auth.userId) {
      const currentUser = await User.findById(req.auth.userId, { localAlertPreferences: 1 }).lean();
      const preferenceCityId = currentUser?.localAlertPreferences?.cityId || DEFAULT_CITY_ID;
      const nearbyComplaintDocs = await Complaint.find({ ...cityDataFilter(preferenceCityId), status: { $ne: "Resolved" } }).sort({ createdAt: -1 }).limit(100).lean();
      communityCases = buildCommunityCases(
        nearbyComplaintDocs,
        currentUser?.localAlertPreferences,
        req.auth.userId,
        req.auth.username
      );
    }
    await refreshFollowUpsForComplaints(complaintDocs);
    const allComplaints = complaintDocs.map((complaint) => complaint.toObject());

    const complaintMatches = allComplaints
      .map((complaint) => ({
        complaint,
        matches: matchesComplaintFilters(complaint, filters)
      }));
    const complaints = sortComplaints(
      complaintMatches.filter((entry) => entry.matches.complaintMatch).map((entry) => entry.complaint),
      filters.complaintSort
    );
    const alertComplaints = complaintMatches.filter((entry) => entry.matches.alertMatch).map((entry) => entry.complaint);
    const manageableUsers = filterUsers(users, filters);
    const issueCounts = countBy(complaints, (item) => item.type);
    const authorityCounts = countBy(complaints, (item) => item.assignedAuthority);
    const departmentCounts = countBy(complaints, (item) => item.routing?.department || item.ai?.recommendedTeam);
    const statusCounts = countBy(complaints, (item) => item.status);
    const broadcastCount = complaints.filter((item) => item.broadcast?.triggered).length;
    const clusteredComplaintCount = complaints.filter((item) => item.incidentCluster?.clustered).length;
    const digitalTwin = canViewDashboard ? buildCivicDigitalTwin(allComplaints) : buildCivicDigitalTwin(complaints);
    const riskPredictions = canViewDashboard ? buildCivicRiskPredictions(allComplaints) : buildCivicRiskPredictions(complaints);
    const civicIntelligence = buildCivicIntelligence(canViewDashboard ? allComplaints : complaints);
    const activeIncidentCount = complaints.filter(hasActiveIncident).length;
    const aiObservability = canViewDashboard ? buildAiObservability(allComplaints, decisionEvents) : null;

    res.json({
      metrics: {
        totalComplaints: complaints.length,
        openComplaints: complaints.filter((item) => item.status !== "Resolved").length,
        criticalAlerts: complaints.filter((item) => item.priority === "Critical").length,
        emergencyBroadcasts: broadcastCount,
        activeIncidents: activeIncidentCount,
        activeClusters: incidentClusters.length,
        clusteredComplaints: clusteredComplaintCount,
        civicHealthScore: digitalTwin.cityHealthScore,
        highestPredictedRisk: riskPredictions.summary.highestRiskScore,
        avgConfidence: complaints.length
          ? Math.round(complaints.reduce((sum, item) => sum + item.confidence, 0) / complaints.length)
          : 0,
        priorityCounts: summarizePriorityCounts(complaints)
      },
      complaints,
      analytics: {
        topIssue: issueCounts[0] || null,
        topAuthority: authorityCounts[0] || null,
        topDepartment: departmentCounts[0] || null,
        statusCounts,
        totalLoadedComplaints: complaints.length,
        totalLoadedAlerts: alertComplaints.reduce((sum, complaint) => sum + (Array.isArray(complaint.alerts) ? complaint.alerts.length : 0), 0),
        emergencyBroadcasts: broadcastCount,
        activeIncidents: activeIncidentCount,
        activeClusters: incidentClusters.length,
        clusteredComplaints: clusteredComplaintCount,
        civicHealthScore: digitalTwin.cityHealthScore,
        civicHealthBand: digitalTwin.cityHealthBand,
        highestPredictedRisk: riskPredictions.summary.highestRiskScore,
        highestPredictedZone: riskPredictions.summary.highestRiskZone
      },
      digitalTwin,
      riskPredictions,
      civicIntelligence,
      aiObservability,
      communityCases,
      incidentCommands,
      incidentClusters,
      iotReadings: canViewSensors ? iotReadings : [],
      manageableUsers,
      operationsScope: operationsCity,
      auth: {
        role: req.auth.role,
        username: req.auth.username,
        permissions: req.auth.permissions,
        operationalCityIds: canViewDashboard ? allowedCityIds : []
      }
    });
  } catch (error) {
    next(error);
  }
}

async function resetDashboard(req, res, next) {
  try {
    if (process.env.NODE_ENV === "production") {
      const error = new Error("Dashboard reset is disabled in production to preserve complaint and decision audit records.");
      error.statusCode = 403;
      throw error;
    }
    if (cityRegistry.cities.some((city) => city.slug !== DEFAULT_CITY_ID && city.reportingEnabled)) {
      const error = new Error("Dashboard reset is disabled while an additional city is active.");
      error.statusCode = 409;
      throw error;
    }
    await Promise.all([
      Complaint.deleteMany({}),
      IncidentCommand.deleteMany({}),
      IncidentCluster.deleteMany({}),
      EmergencyBroadcast.deleteMany({}),
      DecisionAuditEvent.collection.deleteMany({}),
      AuthorityTicket.deleteMany({}),
      CityActivationReview.deleteMany({}),
      CityRolloutState.deleteMany({}),
      CityDailyIntake.deleteMany({}),
      CityOperationalEvent.deleteMany({}),
      CityOperationalIncident.deleteMany({})
    ]);
    await getDashboard(req, res, next);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  cityDataFilter,
  getDashboard,
  resolveOperationsCity,
  resetDashboard
};
