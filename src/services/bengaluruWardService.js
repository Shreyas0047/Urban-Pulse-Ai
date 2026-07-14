const wardDirectory = require("../../shared/bengaluruWards.json");

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pointInPolygon(point, polygon) {
  if (!point || !Array.isArray(polygon) || polygon.length < 3) return false;
  const x = Number(point.lng);
  const y = Number(point.lat);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  let inside = false;
  const coordinate = (entry) => Array.isArray(entry)
    ? { lng: Number(entry[0]), lat: Number(entry[1]) }
    : { lng: Number(entry?.lng), lat: Number(entry?.lat) };
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const currentCoordinate = coordinate(polygon[current]);
    const previousCoordinate = coordinate(polygon[previous]);
    const xi = currentCoordinate.lng;
    const yi = currentCoordinate.lat;
    const xj = previousCoordinate.lng;
    const yj = previousCoordinate.lat;
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function wardResult(entry, matchQuality, matchedBy, requiresConfirmation = true) {
  return {
    wardCode: entry.wardCode,
    wardName: entry.wardName,
    zone: entry.zone || "",
    matchQuality,
    matchedBy,
    requiresConfirmation,
    directoryVersion: wardDirectory.version
  };
}

function resolveBengaluruWard({ location, mapLocation } = {}) {
  const text = normalize(location);
  const explicit = text.match(/\bward\s*(\d{1,3})\b/i);
  if (explicit) {
    return wardResult(
      { wardCode: `BBMP-WARD-${explicit[1]}`, wardName: `Ward ${explicit[1]}`, zone: "Bengaluru" },
      "explicit",
      `location text: Ward ${explicit[1]}`,
      false
    );
  }

  const polygonMatch = wardDirectory.wards.find((entry) => pointInPolygon(mapLocation, entry.polygon));
  if (polygonMatch) return wardResult(polygonMatch, "boundary", "configured geographic boundary", false);

  const aliasMatches = wardDirectory.wards
    .flatMap((entry) => (entry.aliases || []).map((alias) => ({ entry, alias: normalize(alias) })))
    .filter(({ alias }) => alias && text.includes(alias))
    .sort((left, right) => right.alias.length - left.alias.length);
  if (aliasMatches[0]) {
    return wardResult(aliasMatches[0].entry, "area_alias", `area match: ${aliasMatches[0].alias}`, true);
  }

  return wardResult(wardDirectory.fallback, "fallback", "no reliable ward boundary or area match", true);
}

function validateWardDirectory(directory = wardDirectory) {
  if (!directory.version || !directory.fallback || !Array.isArray(directory.wards)) return false;
  const codes = directory.wards.map((entry) => entry.wardCode);
  return codes.every(Boolean) && new Set(codes).size === codes.length && directory.wards.every((entry) => entry.wardName && Array.isArray(entry.aliases));
}

module.exports = { resolveBengaluruWard, validateWardDirectory, pointInPolygon, WARD_DIRECTORY_VERSION: wardDirectory.version };
