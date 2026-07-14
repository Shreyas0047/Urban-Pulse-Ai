const User = require("../models/User");
const { normalizeArea } = require("../utils/localAlerts");

const MAX_AREAS = 6;
const MAX_AREA_LENGTH = 80;
const ALLOWED_THRESHOLDS = new Set(["Medium", "High", "Critical"]);

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function serializePreferences(user) {
  const preferences = user?.localAlertPreferences || {};

  return {
    enabled: Boolean(preferences.enabled),
    severityThreshold: preferences.severityThreshold || "High",
    areas: (preferences.areas || []).map((area) => ({
      label: area.label || "",
      normalized: area.normalized || ""
    })),
    updatedAt: preferences.updatedAt || null
  };
}

function normalizeAreas(rawAreas) {
  if (!Array.isArray(rawAreas)) {
    throw createHttpError("Alert areas must be provided as a list.", 400);
  }

  const seen = new Set();
  const areas = [];

  rawAreas.forEach((area) => {
    const label = String(area?.label || area || "").replace(/\s+/g, " ").trim();
    if (!label) {
      return;
    }
    if (label.length > MAX_AREA_LENGTH) {
      throw createHttpError(`Alert area must be ${MAX_AREA_LENGTH} characters or fewer.`, 400);
    }

    const normalized = normalizeArea(label);
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    areas.push({ label, normalized, addedAt: new Date() });
  });

  if (areas.length > MAX_AREAS) {
    throw createHttpError(`You can save up to ${MAX_AREAS} local alert areas.`, 400);
  }

  return areas;
}

async function getLocalAlertPreferences(req, res, next) {
  try {
    if (!req.auth.userId) {
      throw createHttpError("Login with a registered account to manage local alerts.", 400);
    }

    const user = await User.findById(req.auth.userId).lean();
    if (!user) {
      throw createHttpError("User not found.", 404);
    }

    res.json({
      preferences: serializePreferences(user)
    });
  } catch (error) {
    next(error);
  }
}

async function updateLocalAlertPreferences(req, res, next) {
  try {
    if (!req.auth.userId) {
      throw createHttpError("Login with a registered account to manage local alerts.", 400);
    }

    const user = await User.findById(req.auth.userId);
    if (!user) {
      throw createHttpError("User not found.", 404);
    }

    const severityThreshold = String(req.body.severityThreshold || "High").trim();
    if (!ALLOWED_THRESHOLDS.has(severityThreshold)) {
      throw createHttpError("Invalid local alert severity threshold.", 400);
    }

    const areas = normalizeAreas(req.body.areas || []);
    user.localAlertPreferences = {
      enabled: Boolean(req.body.enabled) && areas.length > 0,
      severityThreshold,
      areas,
      updatedAt: new Date()
    };

    await user.save();

    res.json({
      message: user.localAlertPreferences.enabled
        ? "Local alert areas saved for Bengaluru."
        : "Local area alerts are disabled.",
      preferences: serializePreferences(user)
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getLocalAlertPreferences,
  updateLocalAlertPreferences
};
