const BENGALURU = require("../config/bengaluru");

function resourceCityId(resourceOrCityId) {
  const value = typeof resourceOrCityId === "object" && resourceOrCityId !== null
    ? resourceOrCityId.cityId
    : resourceOrCityId;
  return String(value || BENGALURU.id).trim().toLowerCase();
}

function assignedOperationalCityIds(auth = {}) {
  return auth.role === "Admin" ? [BENGALURU.id] : [];
}

function hasOperationalCityAccess(auth, resourceOrCityId) {
  return assignedOperationalCityIds(auth).includes(resourceCityId(resourceOrCityId));
}

function assertOperationalCityAccess(auth, resourceOrCityId) {
  if (!hasOperationalCityAccess(auth, resourceOrCityId)) {
    const error = new Error("Administrative access is required for this Bengaluru complaint.");
    error.statusCode = 403;
    error.code = "OPERATIONAL_CITY_ACCESS_DENIED";
    throw error;
  }
  return resourceCityId(resourceOrCityId);
}

function ownsComplaint(auth, complaint) {
  return Boolean(
    (auth.userId && String(complaint.reporterUserId || "") === String(auth.userId)) ||
    complaint.reporterUsername === auth.username
  );
}

function canAccessComplaint(auth, complaint) {
  if (ownsComplaint(auth, complaint)) return true;
  return Boolean(auth.permissions?.includes("view_dashboard") && hasOperationalCityAccess(auth, complaint));
}

function operationalCityDataFilter(cityId) {
  return { $or: [{ cityId: BENGALURU.id }, { cityId: { $exists: false } }] };
}

module.exports = {
  assertOperationalCityAccess,
  assignedOperationalCityIds,
  canAccessComplaint,
  hasOperationalCityAccess,
  operationalCityDataFilter,
  ownsComplaint,
  resourceCityId
};
