const { evaluateAuthoritySlas } = require("./authoritySlaService");

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
let timer = null;
let running = false;

async function runAuthoritySlaEvaluation() {
  if (running) return null;
  running = true;
  try {
    const result = await evaluateAuthoritySlas();
    if (result.escalated) {
      console.info(`[authority-sla] ${result.escalated} new escalation level(s) recorded across ${result.evaluated} ticket(s).`);
    }
    return result;
  } catch (error) {
    console.warn(`[authority-sla] scheduled evaluation failed: ${error.message}`);
    return null;
  } finally {
    running = false;
  }
}

function startAuthoritySlaScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
  if (timer) return timer;
  void runAuthoritySlaEvaluation();
  timer = setInterval(runAuthoritySlaEvaluation, intervalMs);
  timer.unref();
  return timer;
}

function stopAuthoritySlaScheduler() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

module.exports = {
  DEFAULT_INTERVAL_MS,
  runAuthoritySlaEvaluation,
  startAuthoritySlaScheduler,
  stopAuthoritySlaScheduler
};
