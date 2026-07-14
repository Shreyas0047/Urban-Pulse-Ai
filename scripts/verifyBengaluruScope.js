const assert = require("assert");
const fs = require("fs");
const path = require("path");
const BENGALURU = require("../src/config/bengaluru");
const { DEFAULT_DEPARTMENT_UNITS, routeComplaint } = require("../src/services/routingService");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

async function main() {
  assert.equal(BENGALURU.id, "bengaluru");
  assert.equal(BENGALURU.authority, "Bruhat Bengaluru Mahanagara Palike");
  assert.equal(DEFAULT_DEPARTMENT_UNITS.length, 9);
  assert(DEFAULT_DEPARTMENT_UNITS.every((unit) => unit.cityId === BENGALURU.id));
  assert(DEFAULT_DEPARTMENT_UNITS.every((unit) => unit.authority === BENGALURU.authority));

  const routed = await routeComplaint({
    analysis: {
      aiMeta: { categoryId: "tree_obstruction" },
      priority: { level: "High" },
      nlp: { issueType: "Tree / Obstruction on Road", team: "Road response" }
    },
    location: "Indiranagar, Bengaluru",
    mapLocation: { lat: 12.9784, lng: 77.6408 },
    activeComplaints: [],
    unitModel: { find: () => ({ lean: async () => [] }) }
  });
  assert.equal(routed.authority, BENGALURU.authority);
  assert.equal(routed.department, "Parks and Urban Forestry");
  assert.equal(routed.ward, "Indiranagar ward office");
  assert.equal(routed.wardCode, "BBMP-INDIRANAGAR");

  const complaintService = read("src/services/complaintService.js");
  const api = read("src/routes/api.js");
  const html = read("public/index.html");
  const frontend = read("public/app.js");
  assert(complaintService.includes('const city = { ...BENGALURU, slug: BENGALURU.id };'));
  assert(!complaintService.includes("payload.cityId"));
  assert(!api.includes('router.get("/cities'));
  assert(!html.includes('id="reportCity"'));
  assert(!frontend.includes('apiRequest("/api/cities"'));
  assert(api.includes('router.get("/authority-governance"'));

  const removed = [
    "shared/cityRegistry.json",
    "shared/cityRoutingRegistry.json",
    "src/services/cityRolloutService.js",
    "src/services/cityActivationService.js"
  ];
  assert(removed.every((file) => !fs.existsSync(path.join(root, file))));

  console.log(JSON.stringify({ passed: true, scope: "bengaluru", routingUnits: DEFAULT_DEPARTMENT_UNITS.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
