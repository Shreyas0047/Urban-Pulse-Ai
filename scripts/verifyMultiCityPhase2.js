const assert = require("assert");
const fs = require("fs");
const path = require("path");
const IncidentCluster = require("../src/models/IncidentCluster");
const { REGISTRY_VERSION, matchCityInput, registryDocuments, resolveReportingCity } = require("../src/services/cityRegistryService");
const { isWithinCityEnvelope } = require("../src/services/complaintService");
const { handleRaiseComplaint } = require("../src/controllers/chatbotController");

async function expectCityError(input, model, code) {
  await assert.rejects(
    () => resolveReportingCity(input, { model }),
    (error) => error.code === code && Number(error.statusCode) >= 400
  );
}

async function main() {
  const cities = registryDocuments();
  const bySlug = new Map(cities.map((city) => [city.slug, city]));
  let lookupCount = 0;
  const model = {
    findOne({ slug }) {
      lookupCount += 1;
      return { async lean() { return bySlug.get(slug) || null; } };
    }
  };

  const bengaluru = await resolveReportingCity({ cityId: " BENGALURU ", registryVersion: REGISTRY_VERSION }, { model });
  assert.equal(bengaluru.name, "Bengaluru");
  assert.equal(lookupCount, 1);
  await expectCityError({}, model, "CITY_REQUIRED");
  await expectCityError({ cityId: "pune" }, model, "CITY_UNKNOWN");
  await expectCityError({ cityId: "bengaluru" }, model, "CITY_REGISTRY_VERSION_REQUIRED");
  await expectCityError({ cityId: "bengaluru", registryVersion: "0.0.1" }, model, "CITY_REGISTRY_STALE");
  await expectCityError({ cityId: "mumbai", registryVersion: REGISTRY_VERSION }, model, "CITY_REPORTING_UNAVAILABLE");
  await expectCityError(
    { cityId: "bengaluru", registryVersion: REGISTRY_VERSION },
    { findOne() { return { async lean() { return { ...bengaluru, registryVersion: "0.0.1" }; } }; } },
    "CITY_REGISTRY_UNAVAILABLE"
  );
  assert.equal(matchCityInput("Bangalore")?.slug, "bengaluru");
  assert.equal(matchCityInput("I am reporting from New Delhi")?.slug, "delhi");
  assert.equal(matchCityInput("unknown city"), null);

  assert.equal(isWithinCityEnvelope(bengaluru, bengaluru.center), true);
  assert.equal(isWithinCityEnvelope(bengaluru, { lat: 19.076, lng: 72.8777 }), false);

  const session = { pendingAction: { stage: "", draftComplaint: {} }, lastTranscript: "" };
  const auth = { username: "citizen@example.com", role: "Citizen", permissions: ["submit_complaint"] };
  let reply = await handleRaiseComplaint(auth, session, "I want to report an issue", "");
  assert.equal(reply.meta.stage, "awaiting_city");
  reply = await handleRaiseComplaint(auth, session, "Mumbai", "");
  assert.equal(reply.meta.reportingEnabled, false);
  assert.equal(session.pendingAction.stage, "awaiting_city");
  reply = await handleRaiseComplaint(auth, session, "Bangalore", "");
  assert.equal(reply.meta.cityId, "bengaluru");
  assert.equal(session.pendingAction.stage, "awaiting_description");
  reply = await handleRaiseComplaint(auth, session, "A tree has fallen across the road", "");
  assert.equal(reply.meta.stage, "awaiting_location");
  assert.equal(session.pendingAction.draftComplaint.cityId, "bengaluru");

  const cluster = new IncidentCluster({
    clusterCode: "INC-TEST-PHASE2",
    title: "Tree obstruction",
    categoryId: "tree_obstruction",
    issueType: "Fallen tree",
    location: "Whitefield"
  });
  assert.ifError(cluster.validateSync());
  assert.equal(cluster.cityId, "bengaluru");

  const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
  const browser = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
  const authSubmitBlock = browser.slice(browser.indexOf('authForm.addEventListener("submit"'), browser.indexOf('form.addEventListener("submit"'));
  const complaintSubmitBlock = browser.slice(browser.indexOf('form.addEventListener("submit"'), browser.indexOf('resetDashboardBtn.addEventListener'));
  assert.ok(html.indexOf('id="reportCity"') < html.indexOf('id="reportLocation"'));
  assert.match(html, /aria-describedby="citySelectionStatus"/);
  assert.match(browser, /apiRequest\("\/api\/cities"/);
  assert.doesNotMatch(authSubmitBlock, /cityRegistryState|selectedCity/);
  assert.match(complaintSubmitBlock, /payload\.cityId = city\.id/);
  assert.match(complaintSubmitBlock, /payload\.cityRegistryVersion = cityRegistryState\.registryVersion/);
  assert.ok(complaintSubmitBlock.indexOf("payload.cityRegistryVersion") < complaintSubmitBlock.indexOf('apiRequest("/api/analyze-complaint"'));
  assert.match(browser, /cityId: reportCitySelect\?\.value/);
  assert.match(browser, /city\.reportingEnabled \? "" : "disabled"/);

  console.log(JSON.stringify({
    passed: true,
    cityFirstUiValidated: true,
    registryVersionGuardValidated: true,
    plannedCityRejectionValidated: true,
    locationEnvelopeValidated: true,
    chatbotCityStageValidated: true,
    cityScopedClusterModelValidated: true
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
