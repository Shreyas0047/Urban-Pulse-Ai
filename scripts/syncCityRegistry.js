const mongoose = require("mongoose");
const { connectDatabase } = require("../src/config/db");
const { syncCityRegistry } = require("../src/services/cityRegistryService");

async function main() {
  await connectDatabase();
  try {
    const result = await syncCityRegistry();
    console.log(JSON.stringify({ passed: true, ...result }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
