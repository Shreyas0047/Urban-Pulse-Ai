const rateLimitBuckets = new Map();
const crypto = require("crypto");
const MAX_RATE_LIMIT_BUCKETS = 10000;

function pruneRateLimitBuckets(now) {
  for (const [key, bucket] of rateLimitBuckets) {
    if (now > bucket.resetAt) rateLimitBuckets.delete(key);
  }
  while (rateLimitBuckets.size >= MAX_RATE_LIMIT_BUCKETS) {
    rateLimitBuckets.delete(rateLimitBuckets.keys().next().value);
  }
}

function setSecurityHeaders(_req, res, next) {
  const incomingRequestId = String(_req.headers?.["x-request-id"] || "").trim();
  const requestId = /^[A-Za-z0-9._-]{8,80}$/.test(incomingRequestId) ? incomingRequestId : crypto.randomUUID();
  _req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Origin-Agent-Cluster", "?1");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(self)"
  );
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://esm.sh",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: data:",
      "connect-src 'self' https://nominatim.openstreetmap.org https://api.deepgram.com",
      "frame-src 'self' https://www.google.com https://maps.google.com"
    ].join("; ")
  );
  if (_req.secure || String(_req.headers["x-forwarded-proto"] || "").includes("https")) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
}

function setNoStoreHeaders(_req, res, next) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  next();
}

function getClientKey(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || "unknown";
}

function createRateLimiter({ windowMs, max, keyPrefix, message }) {
  return (req, _res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${getClientKey(req)}`;
    const bucket = rateLimitBuckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      if (!bucket && rateLimitBuckets.size >= MAX_RATE_LIMIT_BUCKETS) pruneRateLimitBuckets(now);
      rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= max) {
      const error = new Error(message || "Too many requests. Please try again later.");
      error.statusCode = 429;
      return next(error);
    }

    bucket.count += 1;
    return next();
  };
}

module.exports = {
  setSecurityHeaders,
  setNoStoreHeaders,
  createRateLimiter,
  rateLimitBuckets
};
