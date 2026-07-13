const WINDOW_DAYS = 30;
const MIN_WINDOW_SAMPLES = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

function round(value, digits = 3) {
  return Number(Number(value || 0).toFixed(digits));
}

function rate(count, total) {
  return total ? round(count / total) : 0;
}

function average(values) {
  return values.length ? round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length) : 0;
}

function distribution(items, selector) {
  const counts = {};
  items.forEach((item) => {
    const key = String(selector(item) || "unknown");
    counts[key] = (counts[key] || 0) + 1;
  });
  const total = items.length || 1;
  return Object.fromEntries(Object.entries(counts).map(([key, count]) => [key, round(count / total)]));
}

function jensenShannon(left, right) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const epsilon = 1e-12;
  const kl = (source, midpoint) => [...keys].reduce((sum, key) => {
    const value = Number(source[key] || 0);
    if (!value) return sum;
    return sum + value * Math.log2(value / Math.max(Number(midpoint[key] || 0), epsilon));
  }, 0);
  const midpoint = Object.fromEntries([...keys].map((key) => [key, (Number(left[key] || 0) + Number(right[key] || 0)) / 2]));
  return round((kl(left, midpoint) + kl(right, midpoint)) / 2);
}

function summarizeWindow(complaints, reviewEvents) {
  const fallbackCount = complaints.filter((item) => item.ai?.fallbackUsed || item.ai?.visionFallbackUsed).length;
  const reviewRequiredCount = complaints.filter((item) => item.ai?.reviewRequired || item.status === "Needs Review").length;
  const abstainedCount = complaints.filter((item) => item.ai?.categoryId === "general" && item.ai?.reviewRequired).length;
  const corrected = reviewEvents.filter((event) => event.outcome === "corrected").length;
  const insufficient = reviewEvents.filter((event) => event.outcome === "insufficient_evidence").length;
  return {
    samples: complaints.length,
    reviewedEvents: reviewEvents.length,
    averageConfidence: average(complaints.map((item) => item.confidence)),
    reviewRequiredRate: rate(reviewRequiredCount, complaints.length),
    fallbackRate: rate(fallbackCount, complaints.length),
    abstentionRate: rate(abstainedCount, complaints.length),
    correctionRate: rate(corrected, reviewEvents.length),
    insufficientEvidenceRate: rate(insufficient, reviewEvents.length),
    categoryDistribution: distribution(complaints, (item) => item.ai?.categoryId || "general"),
    severityDistribution: distribution(complaints, (item) => item.priority),
    providerDistribution: distribution(complaints, (item) => item.ai?.provider || "unknown")
  };
}

function buildAiObservability(complaints = [], auditEvents = [], options = {}) {
  const now = new Date(options.now || Date.now());
  const windowDays = Number(options.windowDays || WINDOW_DAYS);
  const minimumSamples = Number(options.minimumSamples || MIN_WINDOW_SAMPLES);
  const currentStart = new Date(now.getTime() - windowDays * DAY_MS);
  const previousStart = new Date(currentStart.getTime() - windowDays * DAY_MS);
  const inRange = (value, start, end) => {
    const time = new Date(value || 0).getTime();
    return time >= start.getTime() && time < end.getTime();
  };
  const currentComplaints = complaints.filter((item) => inRange(item.createdAt, currentStart, now));
  const previousComplaints = complaints.filter((item) => inRange(item.createdAt, previousStart, currentStart));
  const humanEvents = auditEvents.filter((event) => event.eventType === "human_review");
  const currentEvents = humanEvents.filter((item) => inRange(item.occurredAt, currentStart, now));
  const previousEvents = humanEvents.filter((item) => inRange(item.occurredAt, previousStart, currentStart));
  const current = summarizeWindow(currentComplaints, currentEvents);
  const previous = summarizeWindow(previousComplaints, previousEvents);
  const sufficient = current.samples >= minimumSamples && previous.samples >= minimumSamples;
  const shifts = {
    confidencePoints: round(current.averageConfidence - previous.averageConfidence, 1),
    reviewRequiredRate: round(current.reviewRequiredRate - previous.reviewRequiredRate),
    fallbackRate: round(current.fallbackRate - previous.fallbackRate),
    correctionRate: round(current.correctionRate - previous.correctionRate),
    categoryDivergence: jensenShannon(current.categoryDistribution, previous.categoryDistribution),
    severityDivergence: jensenShannon(current.severityDistribution, previous.severityDistribution)
  };
  const alerts = [];
  if (sufficient) {
    if (shifts.categoryDivergence >= 0.18) alerts.push({ level: "warning", code: "category_drift", message: "Category distribution changed materially." });
    if (shifts.severityDivergence >= 0.18) alerts.push({ level: "warning", code: "severity_drift", message: "Severity distribution changed materially." });
    if (shifts.confidencePoints <= -10) alerts.push({ level: "warning", code: "confidence_drop", message: "Average confidence dropped by at least 10 points." });
    if (shifts.reviewRequiredRate >= 0.15) alerts.push({ level: "critical", code: "review_rate_spike", message: "Human-review demand increased by at least 15 percentage points." });
    if (shifts.fallbackRate >= 0.15 || current.fallbackRate >= 0.35) alerts.push({ level: "critical", code: "fallback_spike", message: "AI fallback usage is above the operational threshold." });
    if (currentEvents.length >= minimumSamples && current.correctionRate >= 0.35) alerts.push({ level: "critical", code: "correction_rate_high", message: "At least 35% of reviewed decisions required correction." });
  }
  return {
    generatedAt: now.toISOString(),
    status: !sufficient ? "insufficient_data" : alerts.some((item) => item.level === "critical") ? "critical" : alerts.length ? "warning" : "stable",
    windowDays,
    minimumSamples,
    windows: {
      current: { start: currentStart.toISOString(), end: now.toISOString(), ...current },
      previous: { start: previousStart.toISOString(), end: currentStart.toISOString(), ...previous }
    },
    shifts,
    alerts,
    note: sufficient
      ? "Drift signals compare production traffic windows and are not ground-truth accuracy measurements."
      : `At least ${minimumSamples} complaints are required in both windows before drift alerts are evaluated.`
  };
}

module.exports = { buildAiObservability, jensenShannon, summarizeWindow };
