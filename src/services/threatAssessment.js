const crypto = require("crypto");
const aiCategories = require("../../shared/aiCategories.json");

const CATEGORY_BY_ID = new Map(aiCategories.map((category) => [category.id, category]));

const SEVERITY_SCORES = {
  Critical: 0.32,
  High: 0.22,
  Medium: 0.12,
  Low: 0.04
};

const CATEGORY_HAZARDS = {
  safety_fire: ["Fire, smoke, gas, or electrical ignition risk", "Critical"],
  road_damage: ["Vehicle impact, fall, or traffic disruption risk", "Medium"],
  tree_obstruction: ["Blocked road or falling branch risk", "High"],
  garbage: ["Public health and sanitation risk", "Low"],
  sewage_overflow: ["Contamination, fall, or open-drain risk", "High"],
  water_drainage: ["Flooding, slip, or traffic slowdown risk", "Medium"],
  wall_damage: ["Structural instability risk", "High"],
  security: ["Personal safety or unauthorized access risk", "High"],
  utility_fault: ["Electrical shock, outage, or fire escalation risk", "High"],
  water_leakage: ["Water loss, slip, or asset damage risk", "Medium"],
  animal_intrusion: ["Bite, obstruction, or public safety risk", "Medium"],
  vehicle_obstruction: ["Access blockage or traffic safety risk", "Medium"]
};

const CATEGORY_ASSETS = {
  safety_fire: ["fire/smoke", "electrical or gas asset", "nearby people or property"],
  road_damage: ["road surface", "vehicle path", "pedestrian path"],
  tree_obstruction: ["tree/branch", "road or public access path", "nearby traffic"],
  garbage: ["waste pile", "public space", "sanitation zone"],
  sewage_overflow: ["drain/manhole", "contaminated water", "pedestrian path"],
  water_drainage: ["standing water", "drainage path", "road surface"],
  wall_damage: ["wall/ceiling", "building structure", "occupied area"],
  security: ["entry point", "public safety area", "nearby residents"],
  utility_fault: ["wire/pole/streetlight", "electrical asset", "public path"],
  water_leakage: ["pipe/tank", "wet surface", "nearby electrical or structural assets"],
  animal_intrusion: ["animal", "public path", "nearby residents"],
  vehicle_obstruction: ["vehicle", "road/access path", "traffic flow"]
};

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function safeRound(value, digits = 3) {
  return Number(clamp01(value).toFixed(digits));
}

function candidateCategoryId(candidate) {
  return candidate?.category_id || candidate?.categoryId || candidate?.id || "";
}

function candidateLabel(candidate) {
  return candidate?.category_label || candidate?.categoryLabel || candidate?.label || "";
}

function candidateConfidence(candidates, categoryId, defaultValue = 0) {
  const candidate = (candidates || []).find((item) => candidateCategoryId(item) === categoryId);
  return clamp01(candidate?.confidence ?? defaultValue);
}

function topMargin(candidates = []) {
  if (candidates.length < 2) return 0;
  return clamp01(Number(candidates[0]?.confidence || 0) - Number(candidates[1]?.confidence || 0));
}

function imageBufferFromBase64(imageBase64) {
  const payload = String(imageBase64 || "").trim();
  if (!payload) return Buffer.alloc(0);
  const normalized = payload.includes(",") ? payload.split(",").pop() : payload;
  if (!/^[A-Za-z0-9+/=]+$/.test(normalized)) return Buffer.alloc(0);
  return Buffer.from(normalized, "base64");
}

function buildImageIntegrity(payload = {}) {
  const imageBuffer = imageBufferFromBase64(payload.imageBase64);
  const imageFeatures = payload.imageFeatures || null;
  const notes = [];

  if (imageBuffer.length && !payload.imageMimeType) {
    notes.push("Image bytes were provided without MIME type metadata.");
  }
  if (imageFeatures?.averageBrightness < 0.12) {
    notes.push("Image appears very dark based on browser-side features.");
  }
  if (imageFeatures?.contrast < 0.08) {
    notes.push("Image has low contrast, so small hazards may be harder to verify.");
  }
  if (imageBuffer.length) {
    notes.push("EXIF/GPS metadata is not inspected in the Express fallback path.");
  }

  return {
    status: imageBuffer.length || imageFeatures ? "checked" : "no_image",
    sha256: imageBuffer.length ? crypto.createHash("sha256").update(imageBuffer).digest("hex") : "",
    dHash: "",
    width: 0,
    height: 0,
    format: "",
    mimeType: String(payload.imageMimeType || ""),
    bytes: imageBuffer.length,
    metadataPresent: false,
    hasExif: false,
    gpsPresent: false,
    possibleScreenshot: Boolean(imageBuffer.length),
    possibleManipulation: "inconclusive",
    notes: notes.slice(0, 4)
  };
}

function buildCandidatesFromAnalysis(payload = {}, context = {}) {
  const remoteCandidates = context.remoteAnalysis?.cv?.candidates || context.remoteAnalysis?.vision?.candidates || [];
  if (remoteCandidates.length) {
    return remoteCandidates
      .map((candidate) => ({
        label: candidate.label || candidate.category_label || candidate.categoryLabel || "",
        category_id: candidateCategoryId(candidate),
        category_label: candidate.category_label || candidate.categoryLabel || candidate.label || "",
        confidence: clamp01(candidate.confidence),
        source: candidate.source || "vision"
      }))
      .filter((candidate) => candidate.category_id)
      .sort((left, right) => right.confidence - left.confidence);
  }

  const cvProfiles = context.cvBundle?.profiles || [];
  const candidates = cvProfiles
    .filter((profile) => Number(profile.visualScore || 0) > 0)
    .map((profile) => ({
      label: profile.cvLabel || profile.issueType,
      category_id: profile.id,
      category_label: profile.issueType,
      confidence: clamp01(profile.visualScore || profile.fusedScore || 0),
      source: "feature"
    }))
    .sort((left, right) => right.confidence - left.confidence);

  if (context.fusedIssue?.id && !candidates.some((candidate) => candidate.category_id === context.fusedIssue.id)) {
    candidates.push({
      label: context.fusedIssue.cvLabel || context.fusedIssue.issueType,
      category_id: context.fusedIssue.id,
      category_label: context.fusedIssue.issueType,
      confidence: clamp01(context.fusedIssue.fusedScore || 0.42),
      source: "fusion"
    });
  }

  if (!candidates.length && payload.imageFeatures) {
    candidates.push({
      label: "Image uploaded; incident unclear",
      category_id: "general",
      category_label: "General",
      confidence: 0.24,
      source: "feature"
    });
  }

  return candidates.sort((left, right) => right.confidence - left.confidence).slice(0, 6);
}

function relationship(rule, label, severity, confidence, evidence) {
  return {
    rule,
    label,
    severity,
    confidence: safeRound(confidence),
    evidence: evidence.slice(0, 4)
  };
}

function inferRelationships(categoryIds, normalizedText, candidates) {
  const relationships = [];
  const hasCategory = (categoryId) => categoryIds.has(categoryId);
  const strongCategory = (categoryId, minimum = 0.46) => hasCategory(categoryId) && candidateConfidence(candidates, categoryId) >= minimum;
  const roadContext = hasAny(normalizedText, ["road", "street", "main road", "junction", "lane", "traffic", "blocked"]);
  const electricalContext = hasAny(normalizedText, ["wire", "live wire", "electric", "electrical", "pole", "transformer", "spark", "streetlight", "power"]);
  const waterContext = hasAny(normalizedText, ["water", "flood", "wet", "drain", "sewage", "leak", "overflow"]);
  const sewageContext = hasAny(normalizedText, ["open manhole", "manhole", "sewage", "drain overflow", "dirty water", "gutter", "sludge"]);

  if (strongCategory("tree_obstruction", 0.36) && roadContext) {
    relationships.push(relationship("tree_blocks_route", "Tree or branch appears related to a road/access obstruction.", "High", 0.78 + candidateConfidence(candidates, "tree_obstruction") * 0.12, ["tree obstruction candidate", "road/access wording"]));
  }
  if (strongCategory("tree_obstruction", 0.36) && electricalContext) {
    relationships.push(relationship("tree_near_electrical_asset", "Tree obstruction may involve live wires or electrical assets.", "Critical", 0.82, ["tree obstruction candidate", "electrical-risk wording"]));
  }
  if ((strongCategory("water_drainage") || strongCategory("water_leakage") || waterContext) && (strongCategory("utility_fault") || electricalContext)) {
    relationships.push(relationship("water_electrical_contact", "Water near electrical infrastructure can create shock or fire risk.", "Critical", 0.84, ["water/drainage signal", "electrical-risk signal"]));
  }
  if (strongCategory("safety_fire") || hasAny(normalizedText, ["fire", "smoke", "gas leak", "burning", "explosion"])) {
    relationships.push(relationship("fire_smoke_immediate_risk", "Fire, smoke, gas, or ignition wording indicates immediate safety risk.", "Critical", 0.88, ["fire/smoke/gas category or wording"]));
  }
  if (strongCategory("sewage_overflow", 0.5) && sewageContext && hasAny(normalizedText, ["open manhole", "manhole", "children", "school", "hospital", "road"])) {
    relationships.push(relationship("sewage_open_manhole_exposure", "Sewage or manhole issue may expose people to fall or contamination risk.", "High", 0.76, ["sewage/manhole candidate", "public-exposure wording"]));
  }
  if (strongCategory("road_damage", 0.52) && hasAny(normalizedText, ["sinkhole", "collapse", "junction", "ambulance", "school bus"])) {
    relationships.push(relationship("road_damage_traffic_hazard", "Road damage may create a serious vehicle or emergency-route hazard.", "High", 0.74, ["road damage candidate", "traffic-sensitive context"]));
  }
  if (strongCategory("wall_damage", 0.5) && hasAny(normalizedText, ["collapse", "ceiling falling", "people inside", "school building", "structural"])) {
    relationships.push(relationship("structural_failure_exposure", "Structural damage may expose people to collapse or falling-debris risk.", "Critical", 0.82, ["wall/building damage candidate", "collapse/exposure wording"]));
  }
  if (strongCategory("vehicle_obstruction", 0.5) && hasAny(normalizedText, ["ambulance", "hospital", "fire lane", "blocked entrance", "driveway", "gate"])) {
    relationships.push(relationship("emergency_access_blocked", "Vehicle obstruction may block emergency or essential access.", "High", 0.76, ["vehicle obstruction candidate", "access-sensitive context"]));
  }
  if (strongCategory("animal_intrusion", 0.5) && hasAny(normalizedText, ["bite", "attack", "children", "school", "pack", "aggressive"])) {
    relationships.push(relationship("animal_public_safety", "Animal intrusion may create bite, attack, or child-safety risk.", "High", 0.74, ["animal candidate", "public-safety wording"]));
  }

  return relationships.slice(0, 6);
}

function buildHazards(categoryIds, candidates, relationships, primaryCategoryId, normalizedText) {
  const hazards = [];
  const topConfidence = candidateConfidence(candidates, primaryCategoryId, 0);
  const secondaryThreshold = Math.max(0.5, topConfidence - 0.22);

  categoryIds.forEach((categoryId) => {
    const [label, severity] = CATEGORY_HAZARDS[categoryId] || [];
    if (!label) return;
    const rawConfidence = candidateConfidence(candidates, categoryId, 0);
    const requiredConfidence = categoryId === primaryCategoryId ? 0.36 : secondaryThreshold;
    if (categoryId !== primaryCategoryId) {
      if (categoryId === "road_damage" && !hasAny(normalizedText, ["pothole", "road crack", "broken road", "damaged road", "sinkhole", "road collapse", "cave in"])) {
        return;
      }
      if (categoryId === "sewage_overflow" && !hasAny(normalizedText, ["open manhole", "manhole", "sewage", "drain overflow", "dirty water", "gutter", "sludge"])) {
        return;
      }
      if (categoryId === "wall_damage" && !hasAny(normalizedText, ["wall", "ceiling", "crack", "structural", "collapse", "plaster"])) {
        return;
      }
    }
    if (rawConfidence < requiredConfidence) return;
    hazards.push({
      id: categoryId,
      label,
      severity,
      confidence: safeRound(Math.max(0.42, rawConfidence)),
      evidence: [`${CATEGORY_BY_ID.get(categoryId)?.label || categoryId} visual/text signal`]
    });
  });

  relationships.forEach((item) => {
    if (["Critical", "High"].includes(item.severity)) {
      hazards.push({
        id: item.rule,
        label: item.label,
        severity: item.severity,
        confidence: item.confidence,
        evidence: item.evidence
      });
    }
  });

  return hazards
    .sort((left, right) => (SEVERITY_SCORES[right.severity] || 0) - (SEVERITY_SCORES[left.severity] || 0) || right.confidence - left.confidence)
    .slice(0, 6);
}

function buildAffectedObjects(categoryId, candidates) {
  const assets = CATEGORY_ASSETS[categoryId] || ["public asset", "affected area"];
  const baseConfidence = candidateConfidence(candidates, categoryId, 0.42);

  return assets.slice(0, 4).map((asset, index) => ({
    label: asset,
    confidence: safeRound(Math.max(0.36, baseConfidence - index * 0.06)),
    evidence: "category-specific threat model"
  }));
}

function monthBucket(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 7);
}

function buildDuplicateCorrelation(integrity, categoryId, normalizedText, payload = {}) {
  const complaints = [...(payload.previousComplaints || []), ...(payload.recentAreaComplaints || [])];
  const currentHash = integrity.sha256 || "";
  const currentMonth = new Date().toISOString().slice(0, 7);
  const exactIds = [];
  const relatedIds = new Set();

  complaints.forEach((complaint) => {
    const complaintId = String(complaint._id || complaint.id || "");
    const storedHash =
      complaint.threatFingerprint ||
      complaint.imageFingerprint ||
      complaint.ai?.imageFingerprint ||
      complaint.ai?.threatAssessment?.integrity?.sha256 ||
      "";
    const storedCategory =
      complaint.threatCategoryId ||
      complaint.categoryId ||
      complaint.ai?.categoryId ||
      complaint.ai?.threatAssessment?.incidentCategoryId ||
      "";
    const storedType = normalizeText(complaint.type || complaint.description || "");

    if (currentHash && storedHash && currentHash === storedHash) {
      exactIds.push(complaintId || "stored complaint");
    }
    if (monthBucket(complaint.createdAt) === currentMonth && (storedCategory === categoryId || (storedType && normalizedText.includes(storedType.slice(0, 28))))) {
      if (complaintId) relatedIds.add(complaintId);
    }
  });

  const relatedRecentCount = relatedIds.size;
  const elevated = exactIds.length > 0 || relatedRecentCount >= 3;
  return {
    status: elevated ? "matched" : "clear",
    exactMatches: exactIds.length,
    nearMatches: 0,
    relatedRecentCount,
    clusterRisk: elevated ? "elevated" : "normal",
    matchedComplaintIds: [...new Set([...exactIds, ...relatedIds])].slice(0, 8),
    reason: exactIds.length
      ? "Exact image fingerprint matched an earlier complaint."
      : relatedRecentCount
        ? `${relatedRecentCount} related recent complaint(s) found in the area.`
        : "No matching recent threat cluster found."
  };
}

function buildConsensus(candidates, fallbackUsed) {
  return {
    passCount: 0,
    agreement: candidates.length ? 1 : 0,
    topMargin: Number(topMargin(candidates).toFixed(3)),
    cropAgreement: 0,
    sources: fallbackUsed ? ["feature-fallback"] : ["remote-vision", "feature-signals"]
  };
}

function statusFromEvidence(confidence, consensus, relationships, imagePresent, hasText) {
  if (!imagePresent) return "no_image";
  if (confidence >= 0.78 && consensus.agreement >= 0.5 && relationships.length) return "confirmed";
  if (confidence >= 0.52 && consensus.topMargin >= 0.06) return "probable";
  if (confidence >= 0.44 && hasText) return "probable";
  return "uncertain";
}

function buildThreatAssessment(payload = {}, context = {}) {
  const remoteThreat = context.remoteAnalysis?.threatAssessment || context.remoteAnalysis?.cv?.threatAssessment;
  if (remoteThreat?.incidentCategoryId) {
    return remoteThreat;
  }

  const candidates = buildCandidatesFromAnalysis(payload, context);
  const top = candidates[0] || null;
  const categoryId = candidateCategoryId(top) || context.fusedIssue?.id || "general";
  const category = CATEGORY_BY_ID.get(categoryId) || {};
  const categoryIds = new Set(candidates.map(candidateCategoryId).filter(Boolean));
  if (categoryId !== "general") categoryIds.add(categoryId);

  const normalizedText = normalizeText([payload.textComplaint, payload.voiceTranscript, payload.machineImageHint, payload.location].filter(Boolean).join(" "));
  const integrity = buildImageIntegrity(payload);
  const relationships = inferRelationships(categoryIds, normalizedText, candidates);
  const hazards = buildHazards(categoryIds, candidates, relationships, categoryId, normalizedText);
  const consensus = buildConsensus(candidates, true);
  const cluster = buildDuplicateCorrelation(integrity, categoryId, normalizedText, payload);
  const topConfidence = clamp01(top?.confidence || context.fusedIssue?.fusedScore || 0);
  const maxRelationshipScore = Math.max(0, ...relationships.map((item) => SEVERITY_SCORES[item.severity] || 0));
  const riskTextBoost = hasAny(normalizedText, ["urgent", "danger", "emergency", "injury", "children", "school", "hospital", "main road", "ambulance", "live wire", "fire", "collapse"]) ? 0.12 : 0;
  const clusterBoost = cluster.clusterRisk === "elevated" ? 0.08 : 0;
  const riskScore = clamp01((category.base_priority || 0.42) * 0.66 + topConfidence * 0.18 + maxRelationshipScore + riskTextBoost + clusterBoost);
  let confidence = clamp01(topConfidence * 0.72 + consensus.agreement * 0.16 + consensus.topMargin * 0.3 - 0.05 + (cluster.clusterRisk === "elevated" ? 0.04 : 0));
  const imagePresent = integrity.status === "checked";
  const status = statusFromEvidence(confidence, consensus, relationships, imagePresent, Boolean(normalizedText));
  const threatLevel = hazards.some((item) => item.severity === "Critical") || riskScore >= 0.86
    ? "Critical"
    : hazards.some((item) => item.severity === "High") || riskScore >= 0.72
      ? "High"
      : riskScore >= 0.52
        ? "Medium"
        : imagePresent
          ? "Low"
          : "Needs Review";
  const abstained = status === "uncertain" && confidence < 0.46;
  const safetyAction = abstained
    ? "request_more_evidence"
    : imagePresent && (status === "uncertain" || (["Critical", "High"].includes(threatLevel) && confidence < 0.52))
      ? "needs_review"
      : "auto_route";

  return {
    status,
    provider: "express-threat-fallback",
    engine: "visual-consensus-threat-v1",
    incident: category.label || candidateLabel(top) || "Civic incident",
    incidentCategoryId: categoryId,
    threatLevel,
    riskScore: Number(riskScore.toFixed(3)),
    confidence: Number(confidence.toFixed(3)),
    peopleAtRisk: imagePresent
      ? hasAny(normalizedText, ["people", "children", "school", "hospital", "main road", "junction", "traffic", "ambulance"]) || relationships.some((item) => item.severity === "Critical")
      : null,
    hazards,
    affectedObjects: buildAffectedObjects(categoryId, candidates),
    relationships,
    visualEvidence: [
      top ? `Top visual candidate: ${candidateLabel(top) || top.label || "incident"} (${topConfidence.toFixed(2)}).` : "",
      ...hazards.slice(0, 3).map((hazard) => `${hazard.severity} hazard: ${String(hazard.label || "").replace(/\.+$/, "")}.`),
      ...integrity.notes.slice(0, 2)
    ].filter(Boolean).slice(0, 6),
    counterEvidence: [
      topMargin(candidates) < 0.08 && candidates.length > 1 ? "Top visual alternatives are close together, so the exact incident type should be reviewed." : "",
      "Vision used deterministic fallback signals in the Express path."
    ].filter(Boolean),
    missingEvidence: [
      !normalizedText ? "No written or voice description was available to confirm the image interpretation." : "",
      !payload.location ? "No location context was available for exposure assessment." : ""
    ].filter(Boolean),
    followUpQuestions: [
      ["Critical", "High"].includes(threatLevel) ? "Are people, vehicles, or emergency access currently affected?" : "",
      relationships.some((item) => item.rule === "water_electrical_contact") ? "Is the electrical supply isolated from the wet area?" : "",
      status === "uncertain" ? "Can the reporter provide one clearer photo or a short description?" : ""
    ].filter(Boolean),
    alternatives: candidates.slice(1, 4).map((candidate) => ({
      categoryId: candidateCategoryId(candidate),
      label: candidateLabel(candidate),
      confidence: safeRound(candidate.confidence)
    })),
    consensus,
    integrity,
    duplicateCorrelation: cluster,
    safetyGate: {
      action: safetyAction,
      reason: safetyAction === "auto_route" ? "Threat signal is clear enough for routing." : "Threat signal needs confirmation before relying on it fully.",
      abstained
    }
  };
}

module.exports = {
  buildThreatAssessment
};
