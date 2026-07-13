const CityOperationalEvent = require("../models/CityOperationalEvent");
const CityOperationalIncident = require("../models/CityOperationalIncident");
const CityRolloutState = require("../models/CityRolloutState");
const { activationConfigurationHash, registeredCity } = require("./cityActivationService");
const { virtualRollout } = require("./cityRolloutService");

const WINDOW_MINUTES = 15;
const EVENT_RETENTION_DAYS = 30;
const SLO_RULES = Object.freeze([
  { trigger: "complaint_failure_rate", domain: "complaint_processing", outcome: "failure", minimumSamples: 10, threshold: 0.35 },
  { trigger: "ai_degradation_rate", domain: "complaint_processing", outcome: "degraded", minimumSamples: 15, threshold: 0.6 },
  { trigger: "authority_failure_rate", domain: "authority_delivery", outcome: "failure", minimumSamples: 5, threshold: 0.6 },
  { trigger: "broadcast_failure_rate", domain: "broadcast_delivery", outcome: "failure", minimumSamples: 5, threshold: 0.6 }
]);

function healthError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.userMessage = message;
  return error;
}

function calculateOperationalHealth(events = [], rules = SLO_RULES) {
  const domains = {};
  for (const event of events) {
    if (!domains[event.domain]) domains[event.domain] = { total: 0, success: 0, degraded: 0, failure: 0 };
    const summary = domains[event.domain];
    summary.total += 1;
    if (Object.prototype.hasOwnProperty.call(summary, event.outcome)) summary[event.outcome] += 1;
  }

  const evaluations = rules.map((rule) => {
    const summary = domains[rule.domain] || { total: 0, success: 0, degraded: 0, failure: 0 };
    const affectedCount = Number(summary[rule.outcome] || 0);
    const observedRate = summary.total ? affectedCount / summary.total : 0;
    return {
      ...rule,
      sampleSize: summary.total,
      affectedCount,
      observedRate,
      breached: summary.total >= rule.minimumSamples && observedRate >= rule.threshold
    };
  });

  return {
    windowMinutes: WINDOW_MINUTES,
    domains,
    evaluations,
    breachedRules: evaluations.filter((item) => item.breached)
  };
}

function safeMetadata(metadata = {}) {
  const recipientCount = Number(metadata.recipientCount || 0);
  return {
    aiFallbackUsed: Boolean(metadata.aiFallbackUsed),
    visionFallbackUsed: Boolean(metadata.visionFallbackUsed),
    adapter: String(metadata.adapter || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40),
    providerStatus: String(metadata.providerStatus || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 60),
    recipientCount: Number.isFinite(recipientCount) ? Math.max(0, Math.min(1000000, recipientCount)) : 0
  };
}

function incidentReason(city, evaluation) {
  const percent = Math.round(evaluation.observedRate * 100);
  const threshold = Math.round(evaluation.threshold * 100);
  const labels = {
    complaint_failure_rate: "complaint processing failures",
    ai_degradation_rate: "AI fallback or degraded analysis",
    authority_failure_rate: "authority delivery failures",
    broadcast_failure_rate: "emergency broadcast failures"
  };
  return `${city.name} intake paused automatically: ${labels[evaluation.trigger]} reached ${percent}% across ${evaluation.sampleSize} samples (limit ${threshold}%).`;
}

async function ensureRolloutPaused(city, incident, dependencies = {}) {
  const rolloutModel = dependencies.rolloutModel || CityRolloutState;
  const now = dependencies.now || new Date();
  let state = await rolloutModel.findOne({ cityId: city.slug });
  if (!state) {
    const initial = virtualRollout(city.slug);
    state = new rolloutModel({
      cityId: city.slug,
      cityName: city.name,
      mode: initial.mode,
      previousActiveMode: initial.previousActiveMode,
      pilotPercentage: initial.pilotPercentage,
      dailyComplaintLimit: initial.dailyComplaintLimit,
      configurationHash: activationConfigurationHash(city.slug)
    });
  }
  if (state.mode !== "paused") {
    const previousMode = state.mode;
    state.previousActiveMode = previousMode === "paused" ? state.previousActiveMode : previousMode;
    state.mode = "paused";
    state.pauseReason = incident.reason;
    state.pausedAt = now;
    state.changedByRole = "system";
    state.changedByUserId = "city-slo-circuit-breaker";
    state.history.push({
      fromMode: previousMode,
      toMode: "paused",
      reason: incident.reason,
      changedByRole: "system",
      changedByUserId: "city-slo-circuit-breaker",
      changedAt: now
    });
    await state.save();
  }
  if (!incident.rolloutStateId && state._id) {
    incident.rolloutStateId = state._id;
    await incident.save();
  }
  return state;
}

async function evaluateCityCircuitBreaker(cityId, dependencies = {}) {
  const eventModel = dependencies.eventModel || CityOperationalEvent;
  const incidentModel = dependencies.incidentModel || CityOperationalIncident;
  const now = dependencies.now || new Date();
  const city = registeredCity(cityId);
  const since = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);
  const events = await eventModel.find({ cityId: city.slug, occurredAt: { $gte: since } }).lean();
  const health = calculateOperationalHealth(events);

  for (const evaluation of health.breachedRules) {
    let incident = await incidentModel.findOne({
      cityId: city.slug,
      trigger: evaluation.trigger,
      status: { $in: ["open", "acknowledged"] }
    });
    if (!incident) {
      const reason = incidentReason(city, evaluation);
      const activeKey = `${city.slug}:${evaluation.trigger}`;
      incident = new incidentModel({
        activeKey,
        cityId: city.slug,
        cityName: city.name,
        trigger: evaluation.trigger,
        domain: evaluation.domain,
        status: "open",
        reason,
        windowMinutes: WINDOW_MINUTES,
        sampleSize: evaluation.sampleSize,
        affectedCount: evaluation.affectedCount,
        observedRate: evaluation.observedRate,
        threshold: evaluation.threshold,
        openedAt: now,
        timeline: [{ event: "Operational circuit breaker opened", note: reason, byRole: "system", at: now }]
      });
      try {
        await incident.save();
      } catch (error) {
        if (error?.code !== 11000) throw error;
        incident = await incidentModel.findOne({ activeKey });
        if (!incident) throw error;
      }
    }
    await ensureRolloutPaused(city, incident, { ...dependencies, now });
  }
  return health;
}

async function recordOperationalEvent(payload, dependencies = {}) {
  const eventModel = dependencies.eventModel || CityOperationalEvent;
  const now = dependencies.now || new Date();
  const city = registeredCity(payload.cityId);
  const event = new eventModel({
    cityId: city.slug,
    cityName: city.name,
    domain: payload.domain,
    outcome: payload.outcome,
    eventType: String(payload.eventType || "operational_event").slice(0, 80),
    complaintId: payload.complaintId || null,
    latencyMs: Number.isFinite(Number(payload.latencyMs)) ? Math.max(0, Number(payload.latencyMs)) : null,
    metadata: safeMetadata(payload.metadata),
    occurredAt: now,
    expiresAt: new Date(now.getTime() + EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  });
  await event.save();
  const health = await evaluateCityCircuitBreaker(city.slug, { ...dependencies, now });
  return { event, health };
}

async function recordOperationalEventSafely(payload, dependencies = {}) {
  try {
    return await recordOperationalEvent(payload, dependencies);
  } catch (error) {
    const safeCityId = String(payload?.cityId || "unknown").replace(/[^a-z0-9-]/gi, "").slice(0, 80) || "unknown";
    console.warn(`[city-operations] telemetry skipped for ${safeCityId}: ${error.message}`);
    return null;
  }
}

async function buildCityOperationalHealth(cityId, dependencies = {}) {
  const eventModel = dependencies.eventModel || CityOperationalEvent;
  const incidentModel = dependencies.incidentModel || CityOperationalIncident;
  const now = dependencies.now || new Date();
  const city = registeredCity(cityId);
  const since = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);
  const [events, incidents] = await Promise.all([
    eventModel.find({ cityId: city.slug, occurredAt: { $gte: since } }).lean(),
    incidentModel.find({ cityId: city.slug }).sort({ openedAt: -1 }).limit(20).lean()
  ]);
  const health = calculateOperationalHealth(events);
  return {
    city: { id: city.slug, name: city.name },
    observedAt: now,
    ...health,
    incidents,
    status: incidents.some((item) => item.status === "open")
      ? "action_required"
      : incidents.some((item) => item.status === "acknowledged") || health.breachedRules.length
        ? "paused"
        : "healthy"
  };
}

async function acknowledgeOperationalIncident(cityId, incidentId, note, auth, dependencies = {}) {
  const incidentModel = dependencies.incidentModel || CityOperationalIncident;
  const now = dependencies.now || new Date();
  const city = registeredCity(cityId);
  const cleanNote = String(note || "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (cleanNote.length < 10) throw healthError("Add an acknowledgement note of at least 10 characters.", 400, "INCIDENT_NOTE_REQUIRED");
  const incident = await incidentModel.findOne({ _id: incidentId, cityId: city.slug });
  if (!incident) throw healthError("Operational incident not found.", 404, "OPERATIONAL_INCIDENT_NOT_FOUND");
  if (incident.status === "resolved") throw healthError("This operational incident is already resolved.", 409, "OPERATIONAL_INCIDENT_RESOLVED");
  if (incident.status === "open") {
    incident.status = "acknowledged";
    incident.acknowledgedAt = now;
    incident.acknowledgedByRole = String(auth.role || "Admin").slice(0, 40);
    incident.acknowledgedByUserId = String(auth.userId || "").slice(0, 80);
    incident.acknowledgementNote = cleanNote;
    incident.timeline.push({ event: "Incident acknowledged", note: cleanNote, byRole: incident.acknowledgedByRole, at: now });
    await incident.save();
  }
  return incident;
}

module.exports = {
  EVENT_RETENTION_DAYS,
  SLO_RULES,
  WINDOW_MINUTES,
  acknowledgeOperationalIncident,
  buildCityOperationalHealth,
  calculateOperationalHealth,
  evaluateCityCircuitBreaker,
  recordOperationalEvent,
  recordOperationalEventSafely,
  safeMetadata
};
