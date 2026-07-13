const { registeredCity } = require("../services/cityActivationService");
const {
  SLO_RULES,
  acknowledgeOperationalIncident,
  buildCityOperationalHealth
} = require("../services/cityOperationalHealthService");

function requireAssignedCity(req) {
  const city = registeredCity(req.params.slug);
  const allowedCityIds = req.auth.operationalCityIds?.length ? req.auth.operationalCityIds : ["bengaluru"];
  if (!allowedCityIds.includes(city.slug)) {
    const error = new Error("This Admin account is not assigned to the selected operations city.");
    error.statusCode = 403;
    throw error;
  }
  return city;
}

function publicIncident(incident) {
  return {
    id: String(incident._id),
    trigger: incident.trigger,
    domain: incident.domain,
    status: incident.status,
    reason: incident.reason,
    windowMinutes: incident.windowMinutes,
    sampleSize: incident.sampleSize,
    affectedCount: incident.affectedCount,
    observedRate: incident.observedRate,
    threshold: incident.threshold,
    openedAt: incident.openedAt,
    acknowledgedAt: incident.acknowledgedAt,
    acknowledgedByRole: incident.acknowledgedByRole,
    acknowledgementNote: incident.acknowledgementNote,
    resolvedAt: incident.resolvedAt,
    resolvedByRole: incident.resolvedByRole,
    timeline: (incident.timeline || []).map((entry) => ({ event: entry.event, note: entry.note, byRole: entry.byRole, at: entry.at }))
  };
}

async function getOperationalHealth(req, res, next) {
  try {
    const city = requireAssignedCity(req);
    const health = await buildCityOperationalHealth(city.slug);
    res.json({
      operationalHealth: {
        ...health,
        rules: SLO_RULES,
        incidents: health.incidents.map(publicIncident)
      }
    });
  } catch (error) {
    next(error);
  }
}

async function acknowledgeIncident(req, res, next) {
  try {
    const city = requireAssignedCity(req);
    const incident = await acknowledgeOperationalIncident(city.slug, req.params.incidentId, req.body?.note, req.auth);
    res.json({
      message: "Operational incident acknowledged. Review the metrics before resuming intake.",
      incident: publicIncident(incident)
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { acknowledgeIncident, getOperationalHealth };
