const assert = require("assert");
const app = require("../src/app");

function percentile(values, percentage) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percentage))] || 0;
}

async function timedFetch(url, options) {
  const started = performance.now();
  const response = await fetch(url, options);
  await response.arrayBuffer();
  return { status: response.status, latency: performance.now() - started };
}

async function main() {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;
    const requests = [
      ...Array.from({ length: 120 }, () => timedFetch(`${base}/health/live`)),
      ...Array.from({ length: 30 }, () => timedFetch(`${base}/api/dashboard`))
    ];
    const results = await Promise.all(requests);
    assert.equal(results.filter((item) => item.status === 200).length, 120);
    assert.equal(results.filter((item) => item.status === 401).length, 30);
    const p95 = percentile(results.map((item) => item.latency), 0.95);
    assert.ok(p95 < 1500, `Local p95 latency ${p95.toFixed(1)}ms exceeded 1500ms.`);

    const oversized = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ padding: "x".repeat(13 * 1024 * 1024) })
    });
    assert.equal(oversized.status, 413);

    console.log(JSON.stringify({
      passed: true,
      concurrentRequests: results.length,
      successfulLiveness: 120,
      protectedRequestsRejected: 30,
      p95LatencyMs: Number(p95.toFixed(2)),
      oversizedPayloadRejected: true
    }, null, 2));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
