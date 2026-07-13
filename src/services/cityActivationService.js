const crypto = require("crypto");
const CityActivationReview = require("../models/CityActivationReview");
const User = require("../models/User");
const cityRegistry = require("../../shared/cityRegistry.json");
const routingRegistry = require("../../shared/cityRoutingRegistry.json");
const categories = require("../../shared/aiCategories.json");
const { DEFAULT_CITY_ID } = require("./cityRegistryService");
const { routingUnitsForCity } = require("./routingRegistryService");

const CHANNEL_MAX_AGE_DAYS = 180;
const EVIDENCE_MAX_AGE_DAYS = 90;

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function registeredCity(cityId) {
  const slug = String(cityId || "").trim().toLowerCase();
  const city = cityRegistry.cities.find((item) => item.slug === slug);
  if (!city) throw httpError("City is not available in the Urban Pulse registry.", 404);
  return city;
}

function activationConfiguration(cityId) {
  const city = registeredCity(cityId);
  const profile = routingRegistry.profiles.find((item) => item.cityId === city.slug);
  return {
    cityRegistryVersion: cityRegistry.registryVersion,
    routingRegistryVersion: routingRegistry.routingRegistryVersion,
    city: {
      slug: city.slug,
      name: city.name,
      state: city.state,
      countryCode: city.countryCode,
      timezone: city.timezone,
      defaultAuthority: city.defaultAuthority,
      supportedCategoryIds: city.supportedCategoryIds || categories.map((item) => item.id),
      locationEnvelope: city.locationEnvelope,
      officialChannels: city.officialChannels
    },
    routingProfile: profile || null,
    unitTemplates: routingRegistry.unitTemplates
  };
}

function activationConfigurationHash(cityId) {
  return crypto.createHash("sha256").update(JSON.stringify(activationConfiguration(cityId))).digest("hex");
}

function dateIsFresh(value, maxAgeDays, now = new Date()) {
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp > now.getTime()) return false;
  return now.getTime() - timestamp <= maxAgeDays * 24 * 60 * 60 * 1000;
}

function check(id, label, passed, detail) {
  return { id, label, passed: Boolean(passed), detail };
}

function activationActor(actor) {
  return typeof actor === "string"
    ? { role: actor, userId: "" }
    : { role: String(actor?.role || "Admin"), userId: String(actor?.userId || "") };
}

async function buildCityActivationReadiness(cityId, review = null, { userModel = User, now = new Date() } = {}) {
  const city = registeredCity(cityId);
  const profile = routingRegistry.profiles.find((item) => item.cityId === city.slug);
  const units = routingUnitsForCity(city.slug);
  const ownedCategories = new Set(units.flatMap((unit) => unit.handlesCategoryIds || []));
  const expectedCategories = categories.map((item) => item.id);
  const evidence = review?.evidence?.toObject ? review.evidence.toObject() : review?.evidence || {};
  const assignedAdmins = await userModel.countDocuments({ role: "Admin", disabledAt: null, operationalCityIds: city.slug });
  const portalVerifiedAt = profile?.handoff?.verifiedAt || city.officialChannels?.verifiedAt;
  const configurationHash = activationConfigurationHash(city.slug);
  const checks = [
    check("routing_coverage", "All complaint categories have an owner", units.length > 0 && expectedCategories.every((id) => ownedCategories.has(id)), `${ownedCategories.size}/${expectedCategories.length} categories covered across ${units.length} units.`),
    check("authority_match", "Routing authority matches the city registry", profile?.authority === city.defaultAuthority, profile?.authority || "Routing profile missing."),
    check("verified_portal", "Official HTTPS handoff is verified", profile?.handoff?.mode === "manual_portal" && /^https:\/\//.test(String(profile?.handoff?.portalUrl || "")) && profile?.handoff?.supportsDirectApi === false, profile?.handoff?.portalUrl || "Portal missing."),
    check("channel_freshness", "Authority channel verification is current", dateIsFresh(portalVerifiedAt, CHANNEL_MAX_AGE_DAYS, now), `Verification must be no older than ${CHANNEL_MAX_AGE_DAYS} days.`),
    check("admin_ownership", "An active Admin owns this city", assignedAdmins > 0, `${assignedAdmins} active assigned Admin account(s).`),
    check("portal_test", "Manual portal submission was tested", dateIsFresh(evidence.portalSubmissionTestedAt, EVIDENCE_MAX_AGE_DAYS, now), `Test evidence must be no older than ${EVIDENCE_MAX_AGE_DAYS} days.`),
    check("dashboard_test", "Dashboard isolation was tested", dateIsFresh(evidence.dashboardIsolationTestedAt, EVIDENCE_MAX_AGE_DAYS, now), `Test evidence must be no older than ${EVIDENCE_MAX_AGE_DAYS} days.`),
    check("alert_test", "Alert isolation was tested", dateIsFresh(evidence.alertIsolationTestedAt, EVIDENCE_MAX_AGE_DAYS, now), `Test evidence must be no older than ${EVIDENCE_MAX_AGE_DAYS} days.`),
    check("reconciliation_owner", "A reconciliation owner is named", String(evidence.reconciliationOwner || "").trim().length >= 3, evidence.reconciliationOwner || "Owner missing."),
    check("evidence_note", "Operational evidence is documented", String(evidence.note || "").trim().length >= 20, "A note of at least 20 characters is required.")
  ];
  const staleConfiguration = Boolean(review?.configurationHash && review.configurationHash !== configurationHash);
  const allChecksPassed = checks.every((item) => item.passed);
  const readinessStatus = staleConfiguration
    ? "stale"
    : allChecksPassed
      ? review?.status === "approved" ? "approved" : "ready"
      : "blocked";
  return {
    city: { id: city.slug, name: city.name, rolloutStatus: city.rolloutStatus, reportingEnabled: Boolean(city.reportingEnabled) },
    cityRegistryVersion: cityRegistry.registryVersion,
    routingRegistryVersion: routingRegistry.routingRegistryVersion,
    configurationHash,
    staleConfiguration,
    status: readinessStatus,
    checks,
    evidence: {
      portalSubmissionTestedAt: evidence.portalSubmissionTestedAt || null,
      dashboardIsolationTestedAt: evidence.dashboardIsolationTestedAt || null,
      alertIsolationTestedAt: evidence.alertIsolationTestedAt || null,
      reconciliationOwner: evidence.reconciliationOwner || "",
      note: evidence.note || "",
      attestedByRole: evidence.attestedByRole || "",
      attestedByUserId: evidence.attestedByUserId || "",
      attestedAt: evidence.attestedAt || null
    },
    approval: {
      approved: review?.status === "approved" && !staleConfiguration,
      approvedByRole: review?.approvedByRole || "",
      approvedByUserId: review?.approvedByUserId || "",
      approvedAt: review?.approvedAt || null
    }
  };
}

async function recordActivationEvidence(cityId, input, actor, { reviewModel = CityActivationReview, userModel = User } = {}) {
  const city = registeredCity(cityId);
  const now = new Date();
  const authenticatedActor = activationActor(actor);
  const evidence = {
    portalSubmissionTestedAt: input.portalSubmissionTested ? now : null,
    dashboardIsolationTestedAt: input.dashboardIsolationTested ? now : null,
    alertIsolationTestedAt: input.alertIsolationTested ? now : null,
    reconciliationOwner: String(input.reconciliationOwner || "").replace(/\s+/g, " ").trim().slice(0, 120),
    note: String(input.note || "").replace(/\s+/g, " ").trim().slice(0, 1000),
    attestedByRole: authenticatedActor.role.slice(0, 40),
    attestedByUserId: authenticatedActor.userId.slice(0, 80),
    attestedAt: now
  };
  let review = await reviewModel.findOne({ cityId: city.slug });
  if (!review) review = new reviewModel({ cityId: city.slug, cityName: city.name });
  review.cityRegistryVersion = cityRegistry.registryVersion;
  review.routingRegistryVersion = routingRegistry.routingRegistryVersion;
  review.configurationHash = activationConfigurationHash(city.slug);
  review.evidence = evidence;
  review.approvedByRole = "";
  review.approvedByUserId = "";
  review.approvedAt = null;
  const readiness = await buildCityActivationReadiness(city.slug, review, { userModel, now });
  review.status = readiness.status;
  review.checkSnapshot = readiness.checks;
  await review.save();
  return { review, readiness };
}

async function approveCityActivation(cityId, actor, { reviewModel = CityActivationReview, userModel = User } = {}) {
  const city = registeredCity(cityId);
  const review = await reviewModel.findOne({ cityId: city.slug });
  if (!review) throw httpError("Record operational evidence before approving this city.", 409);
  const readiness = await buildCityActivationReadiness(city.slug, review, { userModel });
  if (readiness.status !== "ready") throw httpError("City activation is blocked until every readiness check passes.", 409);
  const authenticatedActor = activationActor(actor);
  review.status = "approved";
  review.configurationHash = readiness.configurationHash;
  review.checkSnapshot = readiness.checks;
  review.approvedByRole = authenticatedActor.role.slice(0, 40);
  review.approvedByUserId = authenticatedActor.userId.slice(0, 80);
  review.approvedAt = new Date();
  await review.save();
  readiness.status = "approved";
  readiness.approval = { approved: true, approvedByRole: review.approvedByRole, approvedByUserId: review.approvedByUserId, approvedAt: review.approvedAt };
  return { review, readiness };
}

async function assertEnabledCitiesReady({ reviewModel = CityActivationReview, userModel = User } = {}) {
  for (const city of cityRegistry.cities.filter((item) => item.reportingEnabled && item.slug !== DEFAULT_CITY_ID)) {
    const review = await reviewModel.findOne({ cityId: city.slug });
    const readiness = review ? await buildCityActivationReadiness(city.slug, review, { userModel }) : null;
    if (!review || review.status !== "approved" || readiness.status !== "approved" || readiness.staleConfiguration) {
      throw new Error(`${city.name} reporting is enabled without a current approved activation review.`);
    }
  }
  return true;
}

module.exports = {
  CHANNEL_MAX_AGE_DAYS,
  EVIDENCE_MAX_AGE_DAYS,
  activationConfigurationHash,
  approveCityActivation,
  assertEnabledCitiesReady,
  buildCityActivationReadiness,
  dateIsFresh,
  recordActivationEvidence,
  registeredCity
};
