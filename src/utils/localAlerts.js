const PRIORITY_ORDER = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4
};

const AREA_ALIASES = [
  { area: "Whitefield", aliases: ["whitefield", "hope farm", "itpl", "kadugodi", "brookefield"] },
  { area: "KR Puram", aliases: ["kr puram", "k r puram", "krp", "kr puram bridge", "mahadevapura"] },
  { area: "Indiranagar", aliases: ["indiranagar", "indira nagar", "100 feet road"] },
  { area: "Marathahalli", aliases: ["marathahalli", "marathalli", "munnekollal"] },
  { area: "Koramangala", aliases: ["koramangala", "sony world", "forum mall"] },
  { area: "Jayanagar", aliases: ["jayanagar", "jaya nagar", "south end circle"] },
  { area: "Yelahanka", aliases: ["yelahanka", "new town yelahanka"] },
  { area: "Hebbal", aliases: ["hebbal", "hebbal flyover", "manyata"] },
  { area: "Electronic City", aliases: ["electronic city", "ecity", "e city", "neeladri"] },
  { area: "HSR Layout", aliases: ["hsr", "hsr layout", "agaram"] },
  { area: "BTM Layout", aliases: ["btm", "btm layout", "udupi garden"] },
  { area: "Rajajinagar", aliases: ["rajajinagar", "rajaji nagar"] },
  { area: "Malleshwaram", aliases: ["malleshwaram", "malleswaram", "malleswaram"] },
  { area: "Banashankari", aliases: ["banashankari", "bsk", "kadirenahalli"] },
  { area: "Basavanagudi", aliases: ["basavanagudi", "gandhi bazaar"] },
  { area: "JP Nagar", aliases: ["jp nagar", "j p nagar", "jaraganahalli"] },
  { area: "Bellandur", aliases: ["bellandur", "ecospace", "sarjapur road"] },
  { area: "Sarjapur", aliases: ["sarjapur", "sarjapura"] },
  { area: "MG Road", aliases: ["mg road", "m g road", "trinity", "brigade road"] },
  { area: "Majestic", aliases: ["majestic", "kempegowda bus station", "kg bus stand"] }
];

const LANDMARK_KEYWORDS = [
  "signal",
  "bridge",
  "flyover",
  "metro",
  "bus stop",
  "school",
  "college",
  "hospital",
  "temple",
  "market",
  "mall",
  "junction",
  "circle",
  "main road",
  "layout",
  "gate",
  "park"
];

function normalizeArea(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(bengaluru|bangalore|karnataka|india)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeArea(value) {
  return normalizeArea(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function titleCase(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractLandmarkHints(location) {
  const normalized = normalizeArea(location);
  const words = normalized.split(" ").filter(Boolean);
  const hints = [];

  LANDMARK_KEYWORDS.forEach((keyword) => {
    const normalizedKeyword = normalizeArea(keyword);
    const index = normalized.indexOf(normalizedKeyword);
    if (index >= 0) {
      const keywordTokens = normalizedKeyword.split(" ");
      const firstTokenIndex = words.findIndex((word, wordIndex) =>
        keywordTokens.every((token, offset) => words[wordIndex + offset] === token)
      );
      if (firstTokenIndex >= 0) {
        const start = Math.max(0, firstTokenIndex - 2);
        const end = Math.min(words.length, firstTokenIndex + keywordTokens.length + 3);
        hints.push(titleCase(words.slice(start, end).join(" ")));
      } else {
        hints.push(titleCase(keyword));
      }
    }
  });

  return unique(hints).slice(0, 5);
}

function inferWardHints({ location, routing }) {
  return unique([
    routing?.ward,
    routing?.unit,
    routing?.department,
    ...String(location || "")
      .split(",")
      .map((part) => part.trim())
      .filter((part) => /\b(ward|zone|layout|nagar|puram|road|circle)\b/i.test(part))
  ]).slice(0, 6);
}

function extractAreaIntelligence({ location, routing = {}, mapLocation = null }) {
  const normalizedLocation = normalizeArea(location);
  const matchedAreas = [];
  const aliases = [];

  AREA_ALIASES.forEach((entry) => {
    const matchedAlias = entry.aliases.find((alias) => {
      const normalizedAlias = normalizeArea(alias);
      return normalizedLocation.includes(normalizedAlias) || normalizedAlias.includes(normalizedLocation);
    });

    if (matchedAlias) {
      matchedAreas.push(entry.area);
      aliases.push(matchedAlias);
    }
  });

  const commaParts = String(location || "")
    .split(",")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const fallbackArea = commaParts.find((part) => !/\d{5,6}/.test(part) && part.length >= 3);
  const likelyArea = matchedAreas[0] || routing.ward || fallbackArea || "";
  const landmarkHints = extractLandmarkHints(location);
  const wardHints = inferWardHints({ location, routing });
  const matchingTerms = unique([
    likelyArea,
    ...matchedAreas,
    ...aliases,
    ...landmarkHints,
    ...wardHints,
    ...commaParts,
    normalizedLocation
  ]);

  return {
    provider: "local-area-intelligence-v1",
    likelyArea,
    matchedAreas: unique(matchedAreas),
    landmarkHints,
    wardHints,
    normalizedLocation,
    matchingTerms,
    confidence: matchedAreas.length ? 0.86 : likelyArea ? 0.58 : 0.32,
    mapLocation: mapLocation
      ? {
          lat: Number.isFinite(Number(mapLocation.lat)) ? Number(mapLocation.lat) : null,
          lng: Number.isFinite(Number(mapLocation.lng)) ? Number(mapLocation.lng) : null
        }
      : null
  };
}

function areaMatchesLocation(area, locationParts) {
  const normalizedArea = normalizeArea(area);
  if (!normalizedArea) {
    return false;
  }

  return locationParts.some((part) => {
    const normalizedPart = normalizeArea(part);
    if (!normalizedPart) {
      return false;
    }
    if (normalizedPart.includes(normalizedArea) || normalizedArea.includes(normalizedPart)) {
      return true;
    }

    const areaTokens = new Set(tokenizeArea(normalizedArea));
    const partTokens = tokenizeArea(normalizedPart);
    return partTokens.some((token) => areaTokens.has(token));
  });
}

function meetsSeverityThreshold(priority, threshold) {
  const complaintPriority = PRIORITY_ORDER[priority] || 0;
  const requiredPriority = PRIORITY_ORDER[threshold] || PRIORITY_ORDER.High;
  return complaintPriority >= requiredPriority;
}

module.exports = {
  areaMatchesLocation,
  extractAreaIntelligence,
  meetsSeverityThreshold,
  normalizeArea,
  tokenizeArea,
  PRIORITY_ORDER
};
