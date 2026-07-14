const assert = require("assert");
const categories = require("../shared/aiCategories.json");
const profile = require("../shared/bengaluruRouting.json");
const { resolveBengaluruWard, validateWardDirectory } = require("../src/services/bengaluruWardService");
const { DEFAULT_DEPARTMENT_UNITS, routeComplaint } = require("../src/services/routingService");

async function main() {
  assert(validateWardDirectory());
  assert.equal(profile.departments.length, 9);
  const owners = new Map();
  profile.departments.forEach((department) => department.handlesCategoryIds.forEach((categoryId) => {
    owners.set(categoryId, [...(owners.get(categoryId) || []), department.department]);
  }));
  categories.forEach((category) => assert.equal(owners.get(category.id)?.length, 1, `${category.id} must have exactly one department owner`));

  const explicit = resolveBengaluruWard({ location: "Near Ward 80, Bengaluru" });
  assert.equal(explicit.wardCode, "BBMP-WARD-80");
  assert.equal(explicit.matchQuality, "explicit");
  const alias = resolveBengaluruWard({ location: "100 Feet Road, Indiranagar, Bengaluru" });
  assert.equal(alias.wardCode, "BBMP-INDIRANAGAR");
  const fallback = resolveBengaluruWard({ location: "Bengaluru" });
  assert.equal(fallback.wardCode, "BBMP-CENTRAL-INTAKE");
  assert.equal(fallback.requiresConfirmation, true);

  for (const category of categories) {
    const route = await routeComplaint({
      analysis: { aiMeta: { categoryId: category.id }, priority: { level: "High" }, nlp: { issueType: category.label } },
      location: "Whitefield, Bengaluru",
      activeComplaints: [],
      unitModel: { find: () => ({ lean: async () => [] }) }
    });
    assert.equal(route.department, owners.get(category.id)[0]);
    assert.equal(route.wardCode, "BBMP-WHITEFIELD");
    assert(route.routingReason.includes("ward result"));
    assert(route.escalationDestination);
    assert.equal(route.deliveryStatus, "pending_handoff");
  }

  assert(DEFAULT_DEPARTMENT_UNITS.every((unit) => unit.escalationDestination && unit.handoffSourceUrl));
  console.log(JSON.stringify({ passed: true, departments: profile.departments.length, categories: categories.length, wardStrategies: ["explicit", "area_alias", "fallback"] }, null, 2));
}

main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
