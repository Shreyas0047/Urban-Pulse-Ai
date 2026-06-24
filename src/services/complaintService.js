const Complaint = require("../models/Complaint");
const { analyzeComplaint } = require("./aiClient");

const LOW_CONFIDENCE_THRESHOLD = 0.52;
const GEOCODE_TIMEOUT_MS = 3500;
const MAX_AI_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_AI_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function buildFallbackMapLocation(location) {
  const baseLat = 12.9716;
  const baseLng = 77.5946;
  const seed = Array.from(String(location || "unknown")).reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return {
    lat: Number((baseLat + ((seed % 35) - 17) / 1000).toFixed(6)),
    lng: Number((baseLng + ((Math.floor(seed / 7) % 35) - 17) / 1000).toFixed(6)),
    source: "fallback"
  };
}

function normalizeImagePayload(payload) {
  const imageBase64 = String(payload.imageBase64 || "").trim();
  const imageMimeType = String(payload.imageMimeType || "").trim().toLowerCase();

  if (!imageBase64) {
    return {
      imageBase64: "",
      imageMimeType: ""
    };
  }

  if (!ALLOWED_AI_IMAGE_MIME_TYPES.has(imageMimeType)) {
    throw createHttpError("Unsupported image type. Upload a JPEG, PNG, or WebP image.", 400);
  }

  if (!/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
    throw createHttpError("Image payload is invalid.", 400);
  }

  const estimatedBytes = Math.floor((imageBase64.length * 3) / 4);
  if (estimatedBytes > MAX_AI_IMAGE_BYTES) {
    throw createHttpError("Image is too large for AI analysis. Upload a smaller image.", 413);
  }

  return {
    imageBase64,
    imageMimeType
  };
}

async function geocodeLocation(location) {
  const query = String(location || "").trim();
  if (!query) {
    return buildFallbackMapLocation(query);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("q", query);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Urban-Pulse-Ai/1.0 civic-complaint-geocoder"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error("Geocoding service unavailable.");
    }

    const results = await response.json();
    const first = Array.isArray(results) ? results[0] : null;
    const lat = Number(first?.lat);
    const lng = Number(first?.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error("No geocoding result found.");
    }

    return {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      source: "nominatim"
    };
  } catch (_error) {
    return buildFallbackMapLocation(query);
  } finally {
    clearTimeout(timeout);
  }
}

function getConfidenceLabel(confidence) {
  if (confidence >= 0.78) return "High confidence";
  if (confidence >= LOW_CONFIDENCE_THRESHOLD) return "Medium confidence";
  return "Needs review";
}

function calibrateConfidence(rawConfidence, analysis, payload) {
  const evidenceCount = [
    payload.textComplaint,
    payload.voiceTranscript,
    payload.imageHint,
    payload.imageFeatures
  ].filter(Boolean).length;
  let confidence = Number.isFinite(rawConfidence) ? rawConfidence : 0;

  if (evidenceCount <= 1) {
    confidence -= 0.04;
  }

  if ((analysis.aiMeta?.categoryId || "general") === "general") {
    confidence = Math.min(confidence, 0.5);
  }

  if (!analysis.nlp?.confidence || analysis.nlp.confidence < 0.22) {
    confidence -= 0.03;
  }

  if (analysis.cv?.detected === "No image uploaded" && !payload.textComplaint && !payload.voiceTranscript) {
    confidence = Math.min(confidence, 0.45);
  }

  return Math.max(0, Math.min(1, Number(confidence.toFixed(3))));
}

function buildAiExplanation(analysis, payload, reviewRequired, confidenceScore) {
  const issueType = analysis.nlp?.issueType || "civic issue";
  const category = analysis.nlp?.category || "General";
  const textSources = [
    payload.textComplaint ? "text complaint" : "",
    payload.voiceTranscript ? "voice transcript" : "",
    payload.imageHint || payload.imageFeatures ? "image evidence" : "",
    payload.location ? "location context" : ""
  ].filter(Boolean);
  const priority = analysis.priority?.level || "Low";
  const confidencePercent = Math.round(confidenceScore * 100);

  return [
    `Classified as ${issueType} in ${category} using ${textSources.join(", ") || "submitted evidence"}.`,
    `Priority is ${priority} with ${confidencePercent}% confidence.`,
    reviewRequired ? "AI confidence is low enough that an admin should review the classification before final routing." : "Classification confidence is sufficient for automatic routing."
  ].join(" ");
}

function logAiDecision({ auth, location, analysis, confidenceScore, reviewRequired }) {
  const record = {
    event: "ai_complaint_decision",
    provider: analysis.aiMeta?.provider || "unknown",
    engine: analysis.aiMeta?.engine || "unknown",
    fallbackUsed: Boolean(analysis.aiMeta?.fallbackUsed),
    categoryId: analysis.aiMeta?.categoryId || "general",
    issueType: analysis.nlp?.issueType || "Civic Complaint",
    priority: analysis.priority?.level || "Low",
    confidence: Number(confidenceScore.toFixed(3)),
    reviewRequired,
    authority: analysis.assignedAuthority,
    location,
    userRole: auth.role,
    username: auth.username
  };

  console.info(JSON.stringify(record));
}

async function createComplaintFromPayload(auth, payload) {
  const location = String(payload.location || "").trim();
  const textComplaint = String(payload.textComplaint || "").trim();
  const imageHint = String(payload.imageHint || "").trim();
  const voiceTranscript = String(payload.voiceTranscript || "").trim();
  const imagePayload = normalizeImagePayload(payload);

  if (!location) {
    throw createHttpError("Location is required before submitting a complaint.", 400);
  }

  if (!textComplaint && !voiceTranscript && !imageHint && !payload.imageFeatures) {
    throw createHttpError("Add a complaint description, voice transcript, or upload an image before submitting.", 400);
  }

  const previousComplaintFilter = auth.userId
    ? { reporterUserId: String(auth.userId || "") }
    : { reporterUsername: auth.username };
  const recentAreaFilter = location ? { location: new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } : {};
  const [previousComplaints, recentAreaComplaints] = await Promise.all([
    Complaint.find(previousComplaintFilter).sort({ createdAt: -1 }).limit(5).lean(),
    location
      ? Complaint.find(recentAreaFilter).sort({ createdAt: -1 }).limit(8).lean()
      : Promise.resolve([])
  ]);

  const analysis = await analyzeComplaint({
    textComplaint,
    voiceTranscript,
    imageHint,
    imageFeatures: payload.imageFeatures || null,
    imageBase64: imagePayload.imageBase64,
    imageMimeType: imagePayload.imageMimeType,
    location,
    iotTriggered: Boolean(payload.iotTriggered),
    previousComplaints: previousComplaints.map((complaint) => ({
      type: complaint.type,
      description: complaint.description,
      location: complaint.location,
      priority: complaint.priority,
      status: complaint.status,
      createdAt: complaint.createdAt
    })),
    recentAreaComplaints: recentAreaComplaints.map((complaint) => ({
      type: complaint.type,
      description: complaint.description,
      location: complaint.location,
      priority: complaint.priority,
      status: complaint.status,
      createdAt: complaint.createdAt
    }))
  });
  const geocoded = await geocodeLocation(location);
  const mapLocation = {
    lat: geocoded.lat,
    lng: geocoded.lng
  };
  const rawConfidenceScore = Number(analysis.confidence || Math.max(analysis.priority.score, analysis.cv.score) || 0);
  const confidenceScore = calibrateConfidence(rawConfidenceScore, analysis, {
    textComplaint,
    voiceTranscript,
    imageHint,
    imageFeatures: payload.imageFeatures || null
  });
  const reviewRequired = confidenceScore < LOW_CONFIDENCE_THRESHOLD;
  const finalStatus = reviewRequired ? "Needs Review" : analysis.status;
  const explanation = buildAiExplanation(analysis, payload, reviewRequired, confidenceScore);
  logAiDecision({ auth, location, analysis, confidenceScore, reviewRequired });

  const complaint = await Complaint.create({
    reporter: auth.role,
    reporterUserId: String(auth.userId || ""),
    reporterUsername: auth.username,
    type: analysis.nlp.issueType,
    priority: analysis.priority.level,
    status: finalStatus,
    source: payload.inputSource || "Manual Submission",
    confidence: Math.round(confidenceScore * 100),
    location,
    assignedAuthority: analysis.assignedAuthority,
    mapLocation,
    description: analysis.unifiedText || "No complaint text provided.",
    alerts: analysis.alerts,
    statusHistory: [
      {
        status: finalStatus,
        changedBy: auth.username || "system",
        changedAt: new Date(),
        note: reviewRequired
          ? "Created with low AI confidence and marked for admin review."
          : "Complaint created after AI analysis."
      }
    ],
    ai: {
      nlpCategory: analysis.nlp.category,
      cvDetection: analysis.cv.detected,
      cvReason: analysis.cv.reason,
      mlPriorityScore: Number(analysis.priority.score.toFixed(2)),
      recommendedTeam: analysis.nlp.team,
      explanation,
      confidenceLabel: getConfidenceLabel(confidenceScore),
      reviewRequired,
      geocodingSource: geocoded.source,
      provider: analysis.aiMeta?.provider || "unknown",
      engine: analysis.aiMeta?.engine || "unknown",
      model: analysis.aiMeta?.model || "unknown",
      fallbackUsed: Boolean(analysis.aiMeta?.fallbackUsed),
      categoryId: analysis.aiMeta?.categoryId || "general",
      visionEngine: analysis.aiMeta?.visionEngine || "unknown",
      visionProvider: analysis.aiMeta?.visionProvider || analysis.cv?.provider || "unknown",
      visionFallbackUsed: Boolean(analysis.aiMeta?.visionFallbackUsed || analysis.cv?.fallbackUsed),
      visionCandidates: (analysis.cv?.candidates || []).slice(0, 5).map((candidate) => ({
        label: candidate.label || candidate.category_label || "",
        categoryId: candidate.category_id || candidate.categoryId || "",
        confidence: Number(candidate.confidence || 0),
        source: candidate.source || ""
      })),
      confidenceBreakdown: analysis.cv?.confidenceBreakdown || {},
      evaluationVersion: analysis.aiMeta?.evaluationVersion || "unknown"
    }
  });

  analysis.status = finalStatus;
  analysis.mapLocation = mapLocation;
  analysis.explainability = {
    explanation,
    confidenceLabel: getConfidenceLabel(confidenceScore),
    reviewRequired,
    geocodingSource: geocoded.source,
    recommendedTeam: analysis.nlp.team,
    provider: analysis.aiMeta?.provider || "unknown",
    engine: analysis.aiMeta?.engine || "unknown",
    fallbackUsed: Boolean(analysis.aiMeta?.fallbackUsed),
    categoryId: analysis.aiMeta?.categoryId || "general",
    visionEngine: analysis.aiMeta?.visionEngine || "unknown",
    visionProvider: analysis.aiMeta?.visionProvider || analysis.cv?.provider || "unknown",
    visionFallbackUsed: Boolean(analysis.aiMeta?.visionFallbackUsed || analysis.cv?.fallbackUsed),
    visionCandidates: (analysis.cv?.candidates || []).slice(0, 5),
    confidenceBreakdown: analysis.cv?.confidenceBreakdown || {}
  };

  return { analysis, complaint };
}

module.exports = {
  createComplaintFromPayload,
  createHttpError
};
