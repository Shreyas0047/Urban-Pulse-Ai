const env = require("../config/env");
const { reserveMonthlyQuota } = require("./monthlyQuotaService");
const { canonicalPriority } = require("./routingService");

const ZENSERP_TIMEOUT_MS = 4500;
const OFFICIAL_DOMAIN_HINTS = [
  "bbmp.gov",
  "bbmp",
  "bwssb",
  "bescom",
  "btp.gov",
  "karnataka.gov",
  "karnataka",
  "bengaluru",
  "bangalore",
  "nammabengaluru",
  ".gov.in",
  ".nic.in"
];
const PUBLIC_CONTEXT_CATEGORY_IDS = new Set([
  "water_drainage",
  "sewage_overflow",
  "tree_obstruction",
  "road_damage",
  "utility_fault",
  "safety_fire",
  "security",
  "vehicle_obstruction"
]);

function unavailableEvidence(status, reason, quota = null) {
  return {
    status,
    provider: "zenserp",
    reason,
    officialSources: [],
    publicContext: [],
    quota
  };
}

function normalizeSearchValue(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildOfficialQuery({ analysis, routing, location }) {
  const issueType = normalizeSearchValue(analysis?.nlp?.issueType || analysis?.cv?.detected || "civic complaint");
  const department = normalizeSearchValue(routing?.department || routing?.unit || analysis?.nlp?.team || "");
  const authority = normalizeSearchValue(routing?.authority || analysis?.assignedAuthority || "");
  const area = normalizeSearchValue(location || "India");
  return [issueType, department, authority, area, "official complaint portal contact"].filter(Boolean).join(" ");
}

function buildPublicContextQuery({ analysis, location }) {
  const issueType = normalizeSearchValue(analysis?.nlp?.issueType || analysis?.cv?.detected || "civic issue");
  const area = normalizeSearchValue(location || "India");
  return [area, issueType, "today public report municipal update"].filter(Boolean).join(" ");
}

function extractHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch (_error) {
    return "";
  }
}

function isOfficialLooking(result) {
  const haystack = [result.url, result.title, result.snippet, extractHost(result.url)].join(" ").toLowerCase();
  return OFFICIAL_DOMAIN_HINTS.some((hint) => haystack.includes(hint));
}

function normalizeResult(item, query, sourceType) {
  const title = normalizeSearchValue(item.title || item.name || "");
  const url = normalizeSearchValue(item.url || item.link || item.href || "");
  const snippet = normalizeSearchValue(item.description || item.snippet || item.content || "");

  if (!title || !url) {
    return null;
  }

  return {
    title: title.slice(0, 180),
    url,
    snippet: snippet.slice(0, 320),
    sourceType,
    query,
    domain: extractHost(url),
    official: sourceType === "official" ? false : undefined
  };
}

function extractOrganicResults(data) {
  const candidates = [
    data?.organic,
    data?.organic_results,
    data?.results,
    data?.web_results
  ];
  return candidates.find(Array.isArray) || [];
}

function summarizeQuota(currentQuota, nextQuota) {
  if (!nextQuota) return currentQuota || null;
  if (!currentQuota) return nextQuota;
  return {
    provider: nextQuota.provider,
    month: nextQuota.month,
    limit: nextQuota.limit,
    used: Math.max(Number(currentQuota.used || 0), Number(nextQuota.used || 0)),
    remaining: Math.min(Number(currentQuota.remaining || 0), Number(nextQuota.remaining || 0))
  };
}

async function callZenserp(query, sourceType) {
  const quotaReservation = await reserveMonthlyQuota({
    provider: "zenserp",
    limit: env.zenserpMonthlyLimit
  });

  if (!quotaReservation.allowed) {
    const quotaReached = quotaReservation.reason === "Monthly quota reached.";
    return {
      status: quotaReached ? "quota_exceeded" : "unavailable",
      reason: quotaReached ? "Monthly Zenserp quota reached." : quotaReservation.reason,
      results: [],
      quota: quotaReservation.quota
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ZENSERP_TIMEOUT_MS);

  try {
    const url = new URL(env.zenserpBaseUrl);
    url.searchParams.set("q", query);
    url.searchParams.set("num", "5");
    url.searchParams.set("gl", "in");
    url.searchParams.set("hl", "en");

    const response = await fetch(url, {
      headers: {
        apikey: env.zenserpApiKey,
        "x-api-key": env.zenserpApiKey
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Zenserp returned HTTP ${response.status}.`);
    }

    const data = await response.json();
    if (data?.error) {
      throw new Error(typeof data.error === "string" ? data.error : data.error.message || "Zenserp returned an error.");
    }

    const results = extractOrganicResults(data)
      .map((item) => normalizeResult(item, query, sourceType))
      .filter(Boolean);

    console.info(JSON.stringify({ event: "zenserp_search_success", sourceType, resultCount: results.length }));
    return {
      status: "available",
      reason: "",
      results,
      quota: quotaReservation.quota
    };
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "zenserp_search_unavailable",
        sourceType,
        reason: error.name === "AbortError" ? "timeout" : error.message || "unknown zenserp error"
      })
    );
    return {
      status: "unavailable",
      reason: "Zenserp civic search could not be fetched.",
      results: [],
      quota: quotaReservation.quota
    };
  } finally {
    clearTimeout(timeout);
  }
}

function shouldFetchPublicContext(analysis) {
  const priority = canonicalPriority(analysis?.priority?.level);
  const categoryId = analysis?.aiMeta?.categoryId || "general";
  return priority === "Critical" || priority === "High" || PUBLIC_CONTEXT_CATEGORY_IDS.has(categoryId);
}

async function fetchCivicEvidence({ analysis, routing, location }) {
  if (!env.zenserpEnabled) {
    return unavailableEvidence("unavailable", "Zenserp civic search is disabled.");
  }

  if (!env.zenserpApiKey) {
    return unavailableEvidence("unavailable", "Zenserp API key is not configured.");
  }

  const officialQuery = buildOfficialQuery({ analysis, routing, location });
  const officialResult = await callZenserp(officialQuery, "official");
  let quota = summarizeQuota(null, officialResult.quota);
  const officialSources = officialResult.results
    .map((result) => ({ ...result, official: isOfficialLooking(result) }))
    .sort((left, right) => Number(right.official) - Number(left.official))
    .slice(0, 3);

  let publicResult = {
    status: "unavailable",
    reason: "Public context search was not required for this complaint.",
    results: [],
    quota: null
  };
  if (shouldFetchPublicContext(analysis)) {
    publicResult = await callZenserp(buildPublicContextQuery({ analysis, location }), "public_context");
    quota = summarizeQuota(quota, publicResult.quota);
  }

  const publicContext = publicResult.results.slice(0, 3);
  const statuses = [officialResult.status, publicResult.status];
  const status =
    statuses.every((item) => item === "quota_exceeded")
      ? "quota_exceeded"
      : officialSources.length || publicContext.length
        ? "available"
        : statuses.includes("quota_exceeded")
          ? "quota_exceeded"
          : "unavailable";
  const reason =
    status === "available"
      ? ""
      : statuses.includes("quota_exceeded")
        ? "Monthly Zenserp quota reached."
        : officialResult.reason || publicResult.reason || "No civic evidence found.";

  return {
    status,
    provider: "zenserp",
    reason,
    officialSources,
    publicContext,
    quota
  };
}

module.exports = {
  buildOfficialQuery,
  buildPublicContextQuery,
  isOfficialLooking,
  fetchCivicEvidence
};
