const Complaint = require("../models/Complaint");
const User = require("../models/User");

const iotReadings = [
  { sensor: "Gas Sensor", zone: "Community Kitchen", value: 74, unit: "ppm", status: "Warning" },
  { sensor: "Smoke Sensor", zone: "Parking Basement", value: 11, unit: "AQI", status: "Normal" },
  { sensor: "Fire Sensor", zone: "Library Hall", value: 0, unit: "trigger", status: "Normal" }
];

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

async function getDashboard(req, res, next) {
  try {
    const canViewDashboard = req.auth.permissions.includes("view_dashboard");
    const canViewSensors = req.auth.permissions.includes("view_sensors");
    const canDeleteUsers = req.auth.permissions.includes("delete_users");
    const complaintFilter = canViewDashboard ? {} : { reporterUsername: req.auth.username };
    const filters = {
      complaintSearchRegex: buildRegex(req.query.complaintSearch),
      complaintStatus: String(req.query.complaintStatus || "").trim(),
      complaintSort: String(req.query.complaintSort || "newest").trim(),
      alertSearchRegex: buildRegex(req.query.alertSearch),
      alertPriority: String(req.query.alertPriority || "").trim(),
      userSearchRegex: buildRegex(req.query.userSearch),
      userState: String(req.query.userState || "").trim()
    };

    const [allComplaints, users] = await Promise.all([
      Complaint.find(complaintFilter).sort({ createdAt: -1 }).lean(),
      canDeleteUsers
        ? User.find({}, { username: 1, email: 1, role: 1, disabledAt: 1, disabledBy: 1, lastLoginAt: 1, createdAt: 1 }).sort({ role: 1, username: 1 }).lean()
        : Promise.resolve([])
    ]);

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
    const statusCounts = countBy(complaints, (item) => item.status);

    res.json({
      metrics: {
        totalComplaints: complaints.length,
        openComplaints: complaints.filter((item) => item.status !== "Resolved").length,
        criticalAlerts: complaints.filter((item) => item.priority === "Critical").length,
        avgConfidence: complaints.length
          ? Math.round(complaints.reduce((sum, item) => sum + item.confidence, 0) / complaints.length)
          : 0,
        priorityCounts: summarizePriorityCounts(complaints)
      },
      complaints,
      analytics: {
        topIssue: issueCounts[0] || null,
        topAuthority: authorityCounts[0] || null,
        statusCounts,
        totalLoadedComplaints: complaints.length,
        totalLoadedAlerts: alertComplaints.reduce((sum, complaint) => sum + (Array.isArray(complaint.alerts) ? complaint.alerts.length : 0), 0)
      },
      iotReadings: canViewSensors ? iotReadings : [],
      manageableUsers,
      auth: {
        role: req.auth.role,
        username: req.auth.username,
        permissions: req.auth.permissions
      }
    });
  } catch (error) {
    next(error);
  }
}

async function resetDashboard(req, res, next) {
  try {
    await Complaint.deleteMany({});
    await getDashboard(req, res, next);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboard,
  resetDashboard
};
