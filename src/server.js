const app = require("./app");
const env = require("./config/env");
const { connectDatabase } = require("./config/db");
const mongoose = require("mongoose");
const { startAuthoritySlaScheduler, stopAuthoritySlaScheduler } = require("./services/authoritySlaScheduler");

let server;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Stopping new requests.`);
  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();
  if (server) await new Promise((resolve) => server.close(resolve));
  stopAuthoritySlaScheduler();
  await mongoose.disconnect();
  clearTimeout(forceExit);
  process.exit(0);
}

async function startServer() {
  await connectDatabase();

  server = app.listen(env.port, () => {
    console.log(`Express API running at http://localhost:${env.port}`);
  });
  startAuthoritySlaScheduler();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

startServer().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
