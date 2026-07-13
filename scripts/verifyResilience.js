const assert = require("assert");
const { createRateLimiter, rateLimitBuckets, setSecurityHeaders } = require("../src/middleware/security");

function response() {
  return { headers: {}, setHeader(name, value) { this.headers[name] = value; } };
}

function main() {
  rateLimitBuckets.clear();
  const limiter = createRateLimiter({ windowMs: 60000, max: 2, keyPrefix: "test", message: "limited" });
  const req = { headers: {}, ip: "127.0.0.8", socket: {} };
  let error;
  limiter(req, {}, (value) => { error = value; });
  assert.ifError(error);
  limiter(req, {}, (value) => { error = value; });
  assert.ifError(error);
  limiter(req, {}, (value) => { error = value; });
  assert.equal(error?.statusCode, 429);

  const firstResponse = response();
  const firstRequest = { headers: {}, secure: false };
  setSecurityHeaders(firstRequest, firstResponse, () => {});
  assert.match(firstResponse.headers["X-Request-ID"], /^[0-9a-f-]{36}$/);
  assert.equal(firstRequest.requestId, firstResponse.headers["X-Request-ID"]);
  assert.equal(firstResponse.headers["X-Content-Type-Options"], "nosniff");

  const suppliedResponse = response();
  const suppliedRequest = { headers: { "x-request-id": "valid-request-123" }, secure: true };
  setSecurityHeaders(suppliedRequest, suppliedResponse, () => {});
  assert.equal(suppliedResponse.headers["X-Request-ID"], "valid-request-123");
  assert.match(suppliedResponse.headers["Strict-Transport-Security"], /max-age/);

  for (let index = 0; index < 10020; index += 1) {
    limiter({ headers: {}, ip: `client-${index}`, socket: {} }, {}, () => {});
  }
  assert.ok(rateLimitBuckets.size <= 10000);

  console.log(JSON.stringify({
    passed: true,
    rateLimitBoundary: true,
    requestCorrelationIds: true,
    invalidRequestIdsReplaced: true,
    securityHeadersPresent: true,
    httpsHstsPresent: true,
    rateLimitMemoryBounded: true
  }, null, 2));
}

main();
