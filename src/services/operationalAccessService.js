const { DEFAULT_CITY_ID } = require("./cityRegistryService");

function resourceCityId(resourceOrCityId) {
  const value = typeof resourceOrCityId === "object" && resourceOrCityId !== null
    ? resourceOrCityId.cityId
    : resourceOrCityId;
  return String(value || DEFAULT_CITY_ID).trim().toLowerCase();
}

function assignedOperationalCityIds(auth = {}) {
  if (auth.role !== "Admin") return [];
  const values = Array.isArray(auth.operationalCityIds) && auth.operationalCityIds.length
    ? auth.operationalCityIds
    : [DEFAULT_CITY_ID];
  return [...new Set(values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean))];
}

function hasOperationalCityAccess(auth, resourceOrCityId) {
  return assignedOperationalCityIds(auth).includes(resourceCityId(resourceOrCityId));
}

function assertOperationalCityAccess(auth, resourceOrCityId) {
  if (!hasOperationalCityAccess(auth, resourceOrCityId)) {
    const error = new Error("This Admin account is not assigned to the complaint's operations city.");
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
  const normalized = resourceCityId(cityId);
  return normalized === DEFAULT_CITY_ID
    ? { $or: [{ cityId: normalized }, { cityId: { $exists: false } }] }
    : { cityId: normalized };
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
