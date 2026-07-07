const form = document.getElementById("complaintForm");
const reportLocationInput = document.getElementById("reportLocation");
const complaintInputMode = document.getElementById("complaintInputMode");
const typedComplaintField = document.getElementById("typedComplaintField");
const typedComplaintInput = document.getElementById("typedComplaintInput");
const voiceComplaintField = document.getElementById("voiceComplaintField");
const voiceTranscriptInput = document.getElementById("voiceTranscriptInput");
const startRecordingBtn = document.getElementById("startRecordingBtn");
const stopRecordingBtn = document.getElementById("stopRecordingBtn");
const clearRecordingBtn = document.getElementById("clearRecordingBtn");
const recordingIndicator = document.getElementById("recordingIndicator");
const voiceAudioPreview = document.getElementById("voiceAudioPreview");
const voiceAudioMeta = document.getElementById("voiceAudioMeta");
const voiceTranscriptStatus = document.getElementById("voiceTranscriptStatus");
const imageFileInput = document.getElementById("imageFile");
const aiImageDescription = document.getElementById("aiImageDescription");
const uploadPreview = document.getElementById("uploadPreview");
const imagePreview = document.getElementById("imagePreview");
const imageName = document.getElementById("imageName");
const imageHintText = document.getElementById("imageHintText");
const showAiAccuracyBtn = document.getElementById("showAiAccuracyBtn");
const aiAccuracyStatus = document.getElementById("aiAccuracyStatus");
const previewLocationBtn = document.getElementById("previewLocationBtn");
const useLiveLocationBtn = document.getElementById("useLiveLocationBtn");
const resetDashboardBtn = document.getElementById("resetDashboardBtn");
const generatePdfBtn = document.getElementById("generatePdfBtn");
const emailBbmpBtn = document.getElementById("emailBbmpBtn");
const emailProgress = document.getElementById("emailProgress");
const emailProgressLabel = document.getElementById("emailProgressLabel");
const emailProgressValue = document.getElementById("emailProgressValue");
const emailProgressFill = document.getElementById("emailProgressFill");
const audioToggleBtn = document.getElementById("audioToggleBtn");
const dashboardMessage = document.getElementById("dashboardMessage");
const issueTokenBtn = document.getElementById("issueTokenBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authRole = document.getElementById("authRole");
const authPermissions = document.getElementById("authPermissions");
const authTokenState = document.getElementById("authTokenState");
const activeUsername = document.getElementById("activeUsername");
const draftStatus = document.getElementById("draftStatus");
const clearDraftBtn = document.getElementById("clearDraftBtn");
const complaintSubmitBtn = document.getElementById("complaintSubmitBtn");
const authOverlay = document.getElementById("authOverlay");
const faqOverlay = document.getElementById("faqOverlay");
const closeFaqBtn = document.getElementById("closeFaqBtn");
const authForm = document.getElementById("authForm");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authMessage = document.getElementById("authMessage");
const authRoleSelect = document.getElementById("authRoleSelect");
const authIdentityLabel = document.getElementById("authIdentityLabel");
const authIdentityInput = document.getElementById("authIdentity");
const authPasswordInput = document.getElementById("authPassword");
const loginAttemptCounter = document.getElementById("loginAttemptCounter");
const authOtpField = document.getElementById("authOtpField");
const authOtpInput = document.getElementById("authOtp");
const sendOtpBtn = document.getElementById("sendOtpBtn");
const otpTimerMessage = document.getElementById("otpTimerMessage");
const mobileMenuToggle = document.getElementById("mobileMenuToggle");
const siteNav = document.getElementById("siteNav");
const navTubelight = document.getElementById("navTubelight");
const showLoginBtn = document.getElementById("showLoginBtn");
const showRegisterBtn = document.getElementById("showRegisterBtn");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const openFaqLink = document.getElementById("openFaqLink");
const userManagementList = document.getElementById("userManagementList");
const mainDashboard = document.getElementById("mainDashboard");
const aboutView = document.getElementById("aboutView");
const reportView = document.getElementById("reportView");
const reportWorkspace = document.getElementById("reportWorkspace");
const reportFormWorkspace = document.getElementById("reportFormWorkspace");
const complaintsWorkspace = document.getElementById("complaintsWorkspace");
const adminView = document.getElementById("adminView");
const adminWorkspace = document.getElementById("adminWorkspace");
const adminActionCenter = document.getElementById("adminActionCenter");
const alertsWorkspace = document.getElementById("alertsWorkspace");
const alertsList = document.getElementById("alertsList");
const alertSearchInput = document.getElementById("alertSearchInput");
const alertPriorityFilter = document.getElementById("alertPriorityFilter");
const clearAlertFiltersBtn = document.getElementById("clearAlertFiltersBtn");
const mapView = document.getElementById("mapView");
const mapWorkspace = document.getElementById("mapWorkspace");
const complaintsMapCanvas = document.getElementById("complaintsMapCanvas");
const mapComplaintList = document.getElementById("mapComplaintList");
const mapVisibleCount = document.getElementById("mapVisibleCount");
const mapHotspotLabel = document.getElementById("mapHotspotLabel");
const mapPriorityWatch = document.getElementById("mapPriorityWatch");
const userManagementWorkspace = document.getElementById("userManagementWorkspace");
const userSearchInput = document.getElementById("userSearchInput");
const userStateFilter = document.getElementById("userStateFilter");
const clearUserFiltersBtn = document.getElementById("clearUserFiltersBtn");
const complaintSearchInput = document.getElementById("complaintSearchInput");
const complaintStatusFilter = document.getElementById("complaintStatusFilter");
const complaintSortSelect = document.getElementById("complaintSortSelect");
const clearComplaintFiltersBtn = document.getElementById("clearComplaintFiltersBtn");
const adminInsights = document.getElementById("adminInsights");
const locationMapFrame = document.getElementById("locationMapFrame");
const liveLocationStatus = document.getElementById("liveLocationStatus");
const pageFooter = document.querySelector(".page-footer");
const postSubmitOverlay = document.getElementById("postSubmitOverlay");
const closePostSubmitBtn = document.getElementById("closePostSubmitBtn");
const postSubmitSummary = document.getElementById("postSubmitSummary");
const modalGeneratePdfBtn = document.getElementById("modalGeneratePdfBtn");
const modalEmailBbmpBtn = document.getElementById("modalEmailBbmpBtn");
const informClosedOnesBtn = document.getElementById("informClosedOnesBtn");
const closeContactsForm = document.getElementById("closeContactsForm");
const sendCloseContactsBtn = document.getElementById("sendCloseContactsBtn");
const cancelCloseContactsBtn = document.getElementById("cancelCloseContactsBtn");
const closeContactsMessage = document.getElementById("closeContactsMessage");
const complaintDetailOverlay = document.getElementById("complaintDetailOverlay");
const closeComplaintDetailBtn = document.getElementById("closeComplaintDetailBtn");
const complaintDetailTitle = document.getElementById("complaintDetailTitle");
const complaintDetailBody = document.getElementById("complaintDetailBody");

const storageKey = "smart-community-auth";
const audioStorageKey = "smart-community-audio-enabled";
const draftStorageKey = "smart-community-report-draft-v1";
let authState = null;
let authMode = "login";
let currentImageFeatures = null;
let currentImageInsight = null;
let currentImageDataUrl = null;
let currentImageAiPayload = null;
let lastSubmittedReport = null;
let audioEnabled = true;
let audioContext = null;
let masterGain = null;
let effectsGain = null;
let ambienceGain = null;
let ambienceTimer = null;
let ambienceStarted = false;
let emailProgressTimer = null;
let currentVoiceAudioData = null;
let currentVoiceAudioObjectUrl = null;
let voiceRecorderStream = null;
let voiceMediaRecorder = null;
let voiceRecordingChunks = [];
let voiceRecordingStartedAt = 0;
let isVoiceRecording = false;
let registrationOtpIssued = false;
let passwordResetOtpIssued = false;
let loginAttemptsRemaining = 4;
let loginLockTimer = null;
let otpTimer = null;
let otpSecondsRemaining = 0;
let dashboardDataCache = { complaints: [], users: [], digitalTwin: null, incidentCommands: [] };
let draftSaveTimer = null;
let dashboardReloadTimer = null;

function emitAuthStateChange() {
  window.dispatchEvent(
    new CustomEvent("smart-community:auth-changed", {
      detail: { authState }
    })
  );
}

const permissionMeta = {
  submit_complaint: { label: "Submit Complaint", target: () => reportFormWorkspace, view: "report" },
  view_personal_updates: { label: "View Personal Updates", target: () => complaintsWorkspace, view: "complaints" },
  view_dashboard: { label: "View Dashboard", target: () => adminWorkspace, view: "admin" },
  reset_dashboard: { label: "Reset Dashboard", action: () => resetDashboardBtn.click() },
  manage_alerts: { label: "Manage Alerts", target: () => alertsWorkspace, view: "alerts" },
  update_complaint_status: { label: "Update Complaint Status", target: () => complaintsWorkspace, view: "complaints" },
  delete_users: { label: "Delete Users", target: () => userManagementWorkspace, view: "users" }
};

function setDashboardMessage(message, type = "info") {
  dashboardMessage.textContent = message;
  dashboardMessage.dataset.state = type;
}

function loadAudioPreference() {
  try {
    const saved = localStorage.getItem(audioStorageKey);
    if (saved !== null) {
      audioEnabled = saved === "true";
    }
  } catch (_error) {
    audioEnabled = true;
  }
}

function saveAudioPreference() {
  try {
    localStorage.setItem(audioStorageKey, String(audioEnabled));
  } catch (_error) {
    // ignore localStorage failures
  }
}

function normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function priorityRank(priority) {
  const order = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  return order[priority] || 0;
}

function buildDashboardQueryParams() {
  const params = new URLSearchParams();
  const complaintSearch = complaintSearchInput?.value?.trim();
  const complaintStatus = complaintStatusFilter?.value || "";
  const complaintSort = complaintSortSelect?.value || "newest";
  const alertSearch = alertSearchInput?.value?.trim();
  const alertPriority = alertPriorityFilter?.value || "";
  const userSearch = userSearchInput?.value?.trim();
  const userState = userStateFilter?.value || "";

  if (complaintSearch) params.set("complaintSearch", complaintSearch);
  if (complaintStatus) params.set("complaintStatus", complaintStatus);
  if (complaintSort && complaintSort !== "newest") params.set("complaintSort", complaintSort);
  if (alertSearch) params.set("alertSearch", alertSearch);
  if (alertPriority) params.set("alertPriority", alertPriority);
  if (userSearch) params.set("userSearch", userSearch);
  if (userState) params.set("userState", userState);

  return params.toString();
}

function scheduleDashboardReload() {
  if (!authState?.token) {
    return;
  }

  if (dashboardReloadTimer) {
    window.clearTimeout(dashboardReloadTimer);
  }

  dashboardReloadTimer = window.setTimeout(() => {
    dashboardReloadTimer = null;
    loadDashboard().catch((error) => {
      setDashboardMessage(error.message, "error");
    });
  }, 180);
}

function updateDraftStatus(message, state = "") {
  if (!draftStatus) {
    return;
  }

  draftStatus.textContent = message;
  draftStatus.dataset.state = state;
}

function buildReportDraftPayload() {
  return {
    location: reportLocationInput?.value || "",
    complaintInputMode: complaintInputMode?.value || "text",
    typedComplaint: typedComplaintInput?.value || "",
    voiceTranscript: voiceTranscriptInput?.value || "",
    imageHint: aiImageDescription?.value || ""
  };
}

function saveReportDraft() {
  try {
    localStorage.setItem(draftStorageKey, JSON.stringify(buildReportDraftPayload()));
    updateDraftStatus("Draft saved locally.", "saved");
  } catch (_error) {
    updateDraftStatus("Unable to save draft in this browser.", "error");
  }
}

function scheduleDraftSave() {
  if (draftSaveTimer) {
    window.clearTimeout(draftSaveTimer);
  }

  updateDraftStatus("Saving draft...", "saving");
  draftSaveTimer = window.setTimeout(() => {
    draftSaveTimer = null;
    saveReportDraft();
  }, 250);
}

function clearReportDraft(updateMessage = true) {
  if (draftSaveTimer) {
    window.clearTimeout(draftSaveTimer);
    draftSaveTimer = null;
  }

  try {
    localStorage.removeItem(draftStorageKey);
    if (updateMessage) {
      updateDraftStatus("Draft cleared.", "cleared");
    }
  } catch (_error) {
    if (updateMessage) {
      updateDraftStatus("Unable to clear draft in this browser.", "error");
    }
  }
}

function restoreReportDraft() {
  try {
    const saved = localStorage.getItem(draftStorageKey);
    if (!saved) {
      updateDraftStatus("Draft saving is ready.", "");
      return;
    }

    const draft = JSON.parse(saved);
    if (!draft || typeof draft !== "object") {
      updateDraftStatus("Draft saving is ready.", "");
      return;
    }

    reportLocationInput.value = String(draft.location || "");
    complaintInputMode.value = draft.complaintInputMode === "voice" ? "voice" : "text";
    typedComplaintInput.value = String(draft.typedComplaint || "");
    voiceTranscriptInput.value = String(draft.voiceTranscript || "");
    aiImageDescription.value = String(draft.imageHint || "");
    setComplaintInputMode(complaintInputMode.value);
    updateDraftStatus("Saved draft restored.", "restored");
  } catch (_error) {
    updateDraftStatus("Draft saving is ready.", "");
  }
}

function updateAudioToggleState() {
  audioToggleBtn.textContent = audioEnabled ? "Sound On" : "Sound Off";
  audioToggleBtn.dataset.state = audioEnabled ? "enabled" : "muted";
}

function resetLoginAttemptState() {
  loginAttemptsRemaining = 4;
  authSubmitBtn.disabled = false;
  if (loginLockTimer) {
    window.clearInterval(loginLockTimer);
    loginLockTimer = null;
  }
  if (loginAttemptCounter) {
    loginAttemptCounter.hidden = true;
    loginAttemptCounter.textContent = "";
  }
}

function startLoginRetryCounter() {
  let secondsRemaining = 30;
  authSubmitBtn.disabled = true;
  loginAttemptCounter.hidden = false;

  const updateCounter = () => {
    loginAttemptCounter.textContent = `Too many failed login attempts. Extra attempt available in ${secondsRemaining}s.`;
  };

  updateCounter();
  if (loginLockTimer) {
    window.clearInterval(loginLockTimer);
  }

  loginLockTimer = window.setInterval(() => {
    secondsRemaining -= 1;
    if (secondsRemaining <= 0) {
      window.clearInterval(loginLockTimer);
      loginLockTimer = null;
      loginAttemptsRemaining = 1;
      authSubmitBtn.disabled = false;
      loginAttemptCounter.textContent = "Extra login attempt available now.";
      return;
    }

    updateCounter();
  }, 1000);
}

function recordClientLoginFailure() {
  loginAttemptsRemaining -= 1;

  if (loginAttemptsRemaining > 0) {
    loginAttemptCounter.hidden = false;
    loginAttemptCounter.textContent = `${loginAttemptsRemaining} login attempt${loginAttemptsRemaining === 1 ? "" : "s"} remaining.`;
    return;
  }

  startLoginRetryCounter();
}

function clearOtpTimer() {
  if (otpTimer) {
    window.clearInterval(otpTimer);
    otpTimer = null;
  }
  otpSecondsRemaining = 0;
}

function setOtpTimerMessage(message, state = "") {
  if (!otpTimerMessage) {
    return;
  }

  otpTimerMessage.hidden = !message;
  otpTimerMessage.textContent = message;
  otpTimerMessage.dataset.state = state;
}

function assertOtpRequestInputs(mode) {
  if (!authIdentityInput.value.trim()) {
    authIdentityInput.focus();
    authIdentityInput.reportValidity();
    throw new Error("Enter your email address before requesting an OTP.");
  }

  if (!authIdentityInput.checkValidity()) {
    authIdentityInput.focus();
    authIdentityInput.reportValidity();
    throw new Error("Enter a valid email address before requesting an OTP.");
  }

  if (mode === "register" && !authPasswordInput.value) {
    authPasswordInput.focus();
    authPasswordInput.reportValidity();
    throw new Error("Enter your password before requesting a registration OTP.");
  }
}

function startOtpCountdown(email, purpose = "register", expiresInSeconds = 300) {
  clearOtpTimer();
  otpSecondsRemaining = Number(expiresInSeconds || 300);
  sendOtpBtn.disabled = true;
  sendOtpBtn.textContent = "OTP sent";

  const updateOtpCountdown = () => {
    const message =
      purpose === "reset"
        ? `If ${email} is registered, verify the OTP within ${otpSecondsRemaining}s.`
        : `OTP sent to ${email}. Verify within ${otpSecondsRemaining}s.`;
    setOtpTimerMessage(message, "active");
  };

  updateOtpCountdown();
  otpTimer = window.setInterval(() => {
    otpSecondsRemaining -= 1;
    if (otpSecondsRemaining <= 0) {
      clearOtpTimer();
      if (purpose === "reset") {
        passwordResetOtpIssued = false;
      } else {
        registrationOtpIssued = false;
      }
      sendOtpBtn.disabled = false;
      sendOtpBtn.textContent = "Resend OTP";
      setOtpTimerMessage("OTP expired. Press Resend OTP to request a new code.", "expired");
      return;
    }

    updateOtpCountdown();
  }, 1000);
}

function ensureAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.32;
    masterGain.connect(audioContext.destination);

    effectsGain = audioContext.createGain();
    effectsGain.gain.value = 0.9;
    effectsGain.connect(masterGain);

    ambienceGain = audioContext.createGain();
    ambienceGain.gain.value = 0.12;
    ambienceGain.connect(masterGain);
  }

  return audioContext;
}

async function unlockAudio() {
  const context = ensureAudioContext();
  if (!context || !audioEnabled) {
    return;
  }

  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch (_error) {
      return;
    }
  }

  if (!ambienceStarted) {
    ambienceStarted = true;
    playReadyChime();
    startAmbientLoop();
  }
}

function playReadyChime() {
  if (!audioContext || audioContext.state !== "running" || !effectsGain) {
    return;
  }

  const now = audioContext.currentTime + 0.02;
  [
    { frequency: 523.25, duration: 0.08, volume: 0.12, startOffset: 0 },
    { frequency: 659.25, duration: 0.1, volume: 0.1, startOffset: 0.06 },
    { frequency: 783.99, duration: 0.12, volume: 0.09, startOffset: 0.12 }
  ].forEach((tone) => {
    createTone({
      frequency: tone.frequency,
      type: "triangle",
      start: now + tone.startOffset,
      duration: tone.duration,
      volume: tone.volume,
      destination: effectsGain,
      attack: 0.01,
      release: 0.12
    });
  });
}

function stopAmbientLoop() {
  if (ambienceTimer) {
    window.clearTimeout(ambienceTimer);
    ambienceTimer = null;
  }

  if (ambienceGain && audioContext) {
    const now = audioContext.currentTime;
    ambienceGain.gain.cancelScheduledValues(now);
    ambienceGain.gain.setValueAtTime(ambienceGain.gain.value, now);
    ambienceGain.gain.linearRampToValueAtTime(0.0001, now + 0.6);
  }
}

function createTone({ frequency, type = "sine", start, duration, volume, destination, attack = 0.02, release = 0.2, detune = 0 }) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.detune.setValueAtTime(detune, start);
  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.linearRampToValueAtTime(volume, start + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration + release);

  oscillator.connect(gainNode);
  gainNode.connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + release + 0.02);
}

function scheduleAmbientPhrase(startTime) {
  const padChords = [
    [196, 246.94, 293.66],
    [174.61, 220, 261.63],
    [196, 246.94, 329.63],
    [164.81, 220, 261.63]
  ];
  const leadNotes = [392, 440, 392, 349.23, 329.63, 349.23, 293.66, 329.63];

  padChords.forEach((chord, index) => {
    const chordStart = startTime + index * 4;
    chord.forEach((frequency, voiceIndex) => {
      createTone({
        frequency,
        type: "triangle",
        start: chordStart,
        duration: 3.4,
        volume: 0.045 - voiceIndex * 0.008,
        destination: ambienceGain,
        attack: 0.55,
        release: 0.9,
        detune: voiceIndex === 0 ? -6 : voiceIndex === 2 ? 5 : 0
      });
    });
  });

  leadNotes.forEach((frequency, index) => {
    createTone({
      frequency,
      type: "sine",
      start: startTime + 0.8 + index * 1.9,
      duration: 0.52,
      volume: 0.024,
      destination: ambienceGain,
      attack: 0.04,
      release: 0.22
    });
  });
}

function startAmbientLoop() {
  if (!audioEnabled || !ensureAudioContext()) {
    return;
  }

  const context = audioContext;
  const phraseLengthMs = 16000;
  const phraseLeadSeconds = 0.15;

  ambienceGain.gain.cancelScheduledValues(context.currentTime);
  ambienceGain.gain.setValueAtTime(ambienceGain.gain.value || 0.0001, context.currentTime);
  ambienceGain.gain.linearRampToValueAtTime(0.14, context.currentTime + 0.8);

  const scheduleNext = () => {
    if (!audioEnabled || !audioContext || audioContext.state !== "running") {
      ambienceTimer = null;
      return;
    }

    scheduleAmbientPhrase(audioContext.currentTime + phraseLeadSeconds);
    ambienceTimer = window.setTimeout(scheduleNext, phraseLengthMs - 400);
  };

  if (ambienceTimer) {
    window.clearTimeout(ambienceTimer);
  }

  scheduleNext();
}

function playButtonSound(button) {
  if (!audioEnabled || !ensureAudioContext() || audioContext.state !== "running" || !button) {
    return;
  }

  const now = audioContext.currentTime;
  const soundType = button.classList.contains("danger-button")
    ? "danger"
    : button.id === "complaintSubmitBtn"
      ? "submit"
      : button.id === "generatePdfBtn"
        ? "pdf"
        : button.classList.contains("secondary-button")
          ? "secondary"
          : button.classList.contains("chip-button") || button.classList.contains("login-button")
            ? "navigation"
            : "default";

  const soundProfiles = {
    default: [
      { frequency: 520, duration: 0.05, volume: 0.08, type: "triangle", attack: 0.01, release: 0.08 },
      { frequency: 780, duration: 0.04, volume: 0.045, type: "sine", attack: 0.01, release: 0.08, startOffset: 0.025 }
    ],
    secondary: [
      { frequency: 430, duration: 0.05, volume: 0.07, type: "triangle", attack: 0.01, release: 0.09 },
      { frequency: 645, duration: 0.03, volume: 0.035, type: "sine", attack: 0.01, release: 0.08, startOffset: 0.018 }
    ],
    submit: [
      { frequency: 523.25, duration: 0.07, volume: 0.08, type: "triangle", attack: 0.01, release: 0.1 },
      { frequency: 659.25, duration: 0.07, volume: 0.07, type: "triangle", attack: 0.01, release: 0.1, startOffset: 0.045 },
      { frequency: 783.99, duration: 0.08, volume: 0.06, type: "sine", attack: 0.012, release: 0.12, startOffset: 0.09 }
    ],
    pdf: [
      { frequency: 392, duration: 0.06, volume: 0.075, type: "triangle", attack: 0.01, release: 0.1 },
      { frequency: 587.33, duration: 0.06, volume: 0.055, type: "triangle", attack: 0.01, release: 0.1, startOffset: 0.04 }
    ],
    navigation: [
      { frequency: 610, duration: 0.045, volume: 0.065, type: "sine", attack: 0.01, release: 0.07 },
      { frequency: 915, duration: 0.03, volume: 0.035, type: "sine", attack: 0.01, release: 0.06, startOffset: 0.02 }
    ],
    danger: [
      { frequency: 240, duration: 0.07, volume: 0.085, type: "square", attack: 0.005, release: 0.08 },
      { frequency: 180, duration: 0.08, volume: 0.05, type: "triangle", attack: 0.005, release: 0.1, startOffset: 0.05 }
    ]
  };

  soundProfiles[soundType].forEach((tone) => {
    createTone({
      frequency: tone.frequency,
      type: tone.type,
      start: now + (tone.startOffset || 0),
      duration: tone.duration,
      volume: tone.volume,
      destination: effectsGain,
      attack: tone.attack,
      release: tone.release
    });
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAuthHeaders() {
  if (!authState?.token) {
    return { "Content-Type": "application/json" };
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authState.token}`
  };
}

function saveAuthState() {
  if (authState) {
    localStorage.setItem(storageKey, JSON.stringify(authState));
  } else {
    localStorage.removeItem(storageKey);
  }
  emitAuthStateChange();
}

function clearAuthState(message) {
  authState = null;
  lastSubmittedReport = null;
  saveAuthState();
  applyPermissionState();
  setPdfButtonState(false);
  renderLoggedOutState();
  if (message) {
    setDashboardMessage(message, "info");
  }
}

function logoutCurrentUser(message = "Logged out successfully.") {
  clearAuthState(message);
  openAuthOverlay("login");
}

function loadSavedAuthState() {
  authState = null;
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) {
      return;
    }

    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === "object" && parsed.token) {
      authState = parsed;
    } else {
      localStorage.removeItem(storageKey);
    }
  } catch (_error) {
    authState = null;
  }
}

function openAuthOverlay(mode = "login") {
  authMode = mode;
  authOverlay.hidden = false;
  document.body.classList.add("auth-open");
  if (siteNav?.classList.contains("is-open")) {
    siteNav.classList.remove("is-open");
    mobileMenuToggle?.setAttribute("aria-expanded", "false");
  }
  showLoginBtn.classList.toggle("is-active", mode === "login");
  showRegisterBtn.classList.toggle("is-active", mode === "register");
  const isRegisterMode = mode === "register";
  const isResetMode = mode === "reset-password";
  const usesOtp = isRegisterMode || isResetMode;
  const roleField = authRoleSelect?.closest("label");
  if (roleField) {
    roleField.hidden = isResetMode;
    roleField.style.display = isResetMode ? "none" : "";
  }
  authOtpField.hidden = !usesOtp;
  sendOtpBtn.hidden = !usesOtp;
  authOtpField.style.display = usesOtp ? "" : "none";
  sendOtpBtn.style.display = usesOtp ? "" : "none";
  authOtpInput.disabled = !usesOtp;
  authOtpInput.required = usesOtp;
  authIdentityLabel.textContent = "Email ID";
  authIdentityInput.placeholder = "Enter email address";
  authIdentityInput.autocomplete = "email";
  authPasswordInput.placeholder = isResetMode ? "Enter new password" : "Enter password";
  forgotPasswordBtn.hidden = mode !== "login";
  forgotPasswordBtn.style.display = mode === "login" ? "" : "none";
  registrationOtpIssued = false;
  passwordResetOtpIssued = false;
  clearOtpTimer();
  sendOtpBtn.disabled = false;
  sendOtpBtn.textContent = "Send OTP";
  setOtpTimerMessage("");
  if (mode === "login" && !loginLockTimer) {
    authSubmitBtn.disabled = false;
  }
  authSubmitBtn.textContent = mode === "login" ? "Login" : isResetMode ? "Reset Password" : "Verify OTP & Register";
  authMessage.textContent =
    mode === "login"
      ? "Choose Admin or Citizen, then login with your email and password."
      : isResetMode
        ? "Enter your registered email and new password, then request an OTP to reset securely."
        : "Choose Admin or Citizen, enter your email and password, then request an OTP to complete registration.";
}

function closeAuthOverlay() {
  if (!authState?.token) {
    authMessage.textContent = "Login is required to access the dashboard.";
    return;
  }
  authOverlay.hidden = true;
  if (faqOverlay?.hidden !== false && postSubmitOverlay?.hidden !== false && complaintDetailOverlay?.hidden !== false) {
    document.body.classList.remove("auth-open");
  }
}

function openFaqOverlay() {
  faqOverlay.hidden = false;
  document.body.classList.add("auth-open");
  if (siteNav?.classList.contains("is-open")) {
    siteNav.classList.remove("is-open");
    mobileMenuToggle?.setAttribute("aria-expanded", "false");
  }
}

function closeFaqOverlay() {
  faqOverlay.hidden = true;
  if (authOverlay?.hidden !== false && postSubmitOverlay?.hidden !== false && complaintDetailOverlay?.hidden !== false) {
    document.body.classList.remove("auth-open");
  }
}

function renderPostSubmitSummary(report) {
  if (!postSubmitSummary || !report) {
    return;
  }

  postSubmitSummary.innerHTML = [
    ["Complaint ID", report.complaintId || "Pending"],
    ["Severity", report.priority || "Low"],
    ["Issue", report.issueType || "Complaint"],
    ["Location", report.location || "Unknown"]
  ]
    .map(
      ([label, value]) => `
        <div class="post-submit-summary-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `
    )
    .join("");
}

function openPostSubmitOverlay(report) {
  if (!postSubmitOverlay) {
    return;
  }

  renderPostSubmitSummary(report);
  closeContactsForm.hidden = true;
  closeContactsForm.reset();
  closeContactsMessage.textContent = "";
  postSubmitOverlay.hidden = false;
  document.body.classList.add("auth-open");
}

function closePostSubmitOverlay() {
  if (!postSubmitOverlay) {
    return;
  }

  postSubmitOverlay.hidden = true;
  closeContactsForm.hidden = true;
  closeContactsForm.reset();
  closeContactsMessage.textContent = "";
  if (authOverlay?.hidden !== false && faqOverlay?.hidden !== false && complaintDetailOverlay?.hidden !== false) {
    document.body.classList.remove("auth-open");
  }
}

const viewTargets = {
  home: { hash: "heroStage", section: () => document.getElementById("heroStage") },
  about: { hash: "aboutView", section: () => aboutView },
  report: { hash: "reportFormWorkspace", section: () => reportView },
  complaints: { hash: "complaintsWorkspace", section: () => reportView },
  admin: { hash: "adminWorkspace", section: () => adminView },
  alerts: { hash: "alertsWorkspace", section: () => adminView },
  map: { hash: "mapWorkspace", section: () => mapView },
  users: { hash: "userManagementWorkspace", section: () => mapView }
};

function getViewNameFromElement(element) {
  if (!element) {
    return "home";
  }

  if (element === reportWorkspace || element === reportFormWorkspace) {
    return "report";
  }

  if (element === complaintsWorkspace) {
    return "complaints";
  }

  if (element === adminWorkspace) {
    return "admin";
  }

  if (element === alertsWorkspace) {
    return "alerts";
  }

  if (element === mapWorkspace) {
    return "map";
  }

  if (element === userManagementWorkspace) {
    return "users";
  }

  return "home";
}

function getViewNameFromHash(hashValue) {
  const normalizedHash = String(hashValue || "").replace(/^#/, "");
  const matched = Object.entries(viewTargets).find(([, config]) => config.hash === normalizedHash);
  return matched ? matched[0] : "home";
}

function updateTubelightNav() {
  if (!siteNav || !navTubelight) {
    return;
  }

  if (window.innerWidth <= 920) {
    navTubelight.style.opacity = "0";
    return;
  }

  const activeLink = siteNav.querySelector(".nav-link.is-active:not([hidden])");
  if (!activeLink) {
    navTubelight.style.opacity = "0";
    return;
  }

  const navRect = siteNav.getBoundingClientRect();
  const linkRect = activeLink.getBoundingClientRect();
  const width = Math.max(34, Math.round(linkRect.width + 18));
  const x = Math.round(linkRect.left - navRect.left + linkRect.width / 2 - width / 2);

  navTubelight.style.width = `${width}px`;
  navTubelight.style.transform = `translateX(${x}px)`;
  navTubelight.style.opacity = "1";
}

function activateAppView(viewName = "home", options = {}) {
  const { updateHash = true, message = "", scroll = true } = options;
  const nextView = viewTargets[viewName] ? viewName : "home";
  const aboutVisible = nextView === "about";
  const reportGroupVisible = nextView === "report" || nextView === "complaints";
  const adminGroupVisible = nextView === "admin" || nextView === "alerts";
  const mapGroupVisible = nextView === "map" || nextView === "users";

  document.body.dataset.appView = nextView;

  const heroStage = viewTargets.home.section();
  if (heroStage) {
    heroStage.hidden = nextView !== "home";
  }

  if (aboutView) {
    aboutView.hidden = !aboutVisible;
  }

  if (reportView) {
    reportView.hidden = !reportGroupVisible;
  }

  if (adminView) {
    adminView.hidden = !adminGroupVisible;
  }

  if (mapView) {
    mapView.hidden = !mapGroupVisible;
  }

  if (pageFooter) {
    pageFooter.hidden = nextView !== "home" && nextView !== "about";
  }

  document.querySelectorAll(".nav-link").forEach((link) => {
    const href = link.getAttribute("href");
    const isActive = href === `#${viewTargets[nextView].hash}`;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  updateTubelightNav();

  if (updateHash) {
    const nextHash = `#${viewTargets[nextView].hash}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }

  if (scroll) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (message) {
    setDashboardMessage(message, "success");
  }
}

function goToMainDashboard() {
  activateAppView("home");
}

function scrollToWorkspace(element, message) {
  if (!element) return;
  activateAppView(getViewNameFromElement(element), { message });
}

function toggleMobileMenu(forceState) {
  if (!siteNav || !mobileMenuToggle) {
    return;
  }

  const nextState = typeof forceState === "boolean" ? forceState : !siteNav.classList.contains("is-open");
  siteNav.classList.toggle("is-open", nextState);
  mobileMenuToggle.setAttribute("aria-expanded", String(nextState));
}

function setupMobileMenu() {
  if (!siteNav || !mobileMenuToggle) {
    return;
  }

  mobileMenuToggle.addEventListener("click", () => toggleMobileMenu());

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => toggleMobileMenu(false));
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 720) {
      toggleMobileMenu(false);
    }
    updateTubelightNav();
  });
}

function setupRevealAnimations() {
  const revealElements = document.querySelectorAll("[data-reveal]");
  if (!revealElements.length) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.14,
      rootMargin: "0px 0px -40px 0px"
    }
  );

  revealElements.forEach((element) => observer.observe(element));
}

function setupHeroStorytelling() {
  const storySection = document.querySelector(".hero-story");
  if (!storySection) {
    return;
  }

  const storyBeats = Array.from(storySection.querySelectorAll("[data-story-beat]"));
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frameRequested = false;

  const applyStoryState = (progress) => {
    const clampedProgress = Math.min(Math.max(progress, 0), 1);
    const stepIndex = Math.min(storyBeats.length - 1, Math.floor(clampedProgress * storyBeats.length));

    storySection.style.setProperty("--story-progress", clampedProgress.toFixed(4));
    storySection.dataset.storyStep = String(stepIndex);
    storyBeats.forEach((beat, index) => {
      beat.classList.toggle("is-active", index === stepIndex);
    });
  };

  const updateStoryProgress = () => {
    frameRequested = false;

    if (reducedMotionQuery.matches) {
      applyStoryState(0);
      return;
    }

    const totalScrollableDistance = Math.max(storySection.offsetHeight - window.innerHeight, 1);
    const sectionTop = storySection.getBoundingClientRect().top;
    const scrolledDistance = Math.min(Math.max(-sectionTop, 0), totalScrollableDistance);
    applyStoryState(scrolledDistance / totalScrollableDistance);
  };

  const requestStoryFrame = () => {
    if (frameRequested) {
      return;
    }

    frameRequested = true;
    window.requestAnimationFrame(updateStoryProgress);
  };

  updateStoryProgress();
  window.addEventListener("scroll", requestStoryFrame, { passive: true });
  window.addEventListener("resize", requestStoryFrame);
  if (typeof reducedMotionQuery.addEventListener === "function") {
    reducedMotionQuery.addEventListener("change", requestStoryFrame);
  } else if (typeof reducedMotionQuery.addListener === "function") {
    reducedMotionQuery.addListener(requestStoryFrame);
  }
}

function setupAppNavigation() {
  const navigationLinks = Array.from(
    document.querySelectorAll('.brand-lockup[href^="#"], .site-nav a[href^="#"], .hero-actions a[href^="#"]')
  );

  navigationLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href) {
        return;
      }

      event.preventDefault();
      activateAppView(getViewNameFromHash(href));
      toggleMobileMenu(false);
    });
  });

  window.addEventListener("hashchange", () => {
      activateAppView(getViewNameFromHash(window.location.hash), { updateHash: false });
  });

  activateAppView(getViewNameFromHash(window.location.hash), { updateHash: false, scroll: false });
}

function setupGooeyInteractions() {
  const gooeySurfaces = document.querySelectorAll("[data-gooey]");

  gooeySurfaces.forEach((surface) => {
    if (surface.dataset.gooeyBound === "true") {
      return;
    }

    const interactiveBlob = surface.querySelector(".gooey-interactive");
    const eventSurface = surface.parentElement || surface;
    if (!interactiveBlob) {
      return;
    }

    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    let frameId = null;

    function setTargetToCenter() {
      targetX = eventSurface.clientWidth / 2;
      targetY = eventSurface.clientHeight / 2;
    }

    function updateTargetFromPointer(event) {
      const rect = eventSurface.getBoundingClientRect();
      targetX = event.clientX - rect.left;
      targetY = event.clientY - rect.top;
    }

    function animateBlob() {
      currentX += (targetX - currentX) / 18;
      currentY += (targetY - currentY) / 18;
      interactiveBlob.style.transform = `translate(${Math.round(currentX - eventSurface.clientWidth / 2)}px, ${Math.round(currentY - eventSurface.clientHeight / 2)}px)`;
      frameId = window.requestAnimationFrame(animateBlob);
    }

    setTargetToCenter();
    currentX = targetX;
    currentY = targetY;

    eventSurface.addEventListener("pointermove", updateTargetFromPointer);
    eventSurface.addEventListener("pointerleave", setTargetToCenter);
    window.addEventListener("resize", setTargetToCenter);

    frameId = window.requestAnimationFrame(animateBlob);

    surface.dataset.gooeyBound = "true";
  });
}
function renderPermissions(permissions = []) {
  authPermissions.innerHTML = permissions
    .map((permission) => {
      const meta = permissionMeta[permission];
      return `<button type="button" class="permission-pill permission-action" data-permission="${permission}">${
        meta?.label || permission.replace(/_/g, " ")
      }</button>`;
    })
    .join("");

  authPermissions.querySelectorAll(".permission-action").forEach((button) => {
    button.addEventListener("click", () => {
      const permission = button.dataset.permission;
      const meta = permissionMeta[permission];

      if (!meta) {
        return;
      }

      if (meta.action) {
        meta.action();
        return;
      }

      scrollToWorkspace(meta.target?.(), `${meta.label} opened.`);
    });
  });
}

function applyPermissionState() {
  const permissions = authState?.permissions || [];
  const hasToken = Boolean(authState?.token);

  authRole.textContent = hasToken ? authState.role : "No role authenticated";
  authTokenState.textContent = hasToken ? "JWT session active" : "Press login to continue as Citizen or Admin";
  activeUsername.textContent = hasToken ? authState.username : "No account logged in";
  issueTokenBtn.hidden = hasToken;
  logoutBtn.hidden = !hasToken;
  renderPermissions(permissions);
  complaintSubmitBtn.disabled = !permissions.includes("submit_complaint");
  resetDashboardBtn.disabled = !permissions.includes("reset_dashboard");
  adminActionCenter.innerHTML = permissions
    .filter((permission) => permissionMeta[permission])
    .map(
      (permission) =>
        `<button type="button" class="secondary-button admin-action-btn" data-permission="${permission}">${
          permissionMeta[permission].label
        }</button>`
    )
    .join("");

  adminActionCenter.querySelectorAll(".admin-action-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const permission = button.dataset.permission;
      const meta = permissionMeta[permission];
      if (!meta) return;
      if (meta.action) {
        meta.action();
        return;
      }
      scrollToWorkspace(meta.target?.(), `${meta.label} opened.`);
    });
  });

  if (!permissions.includes("delete_users")) {
    userManagementList.innerHTML = `<div class="table-row"><span>Login as Admin to manage accounts.</span></div>`;
  }

  if (!permissions.includes("manage_alerts")) {
    alertsList.innerHTML = `<div class="table-row"><span>Login as Admin to manage alerts.</span></div>`;
  }

  document.querySelectorAll('.nav-link[href="#adminWorkspace"], .nav-link[href="#alertsWorkspace"]').forEach((link) => {
    link.hidden = !permissions.includes("view_dashboard");
  });
  document.querySelectorAll('.nav-link[href="#mapWorkspace"]').forEach((link) => {
    link.hidden = !hasToken;
  });

  updateTubelightNav();
}

function getAuthSuccessMessage(mode, data) {
  if (mode === "register") {
    return `Registration successful. ${data.username} is now logged in as ${data.role}.`;
  }

  return `Login successful. ${data.username} is now logged in as ${data.role}.`;
}

async function requestRegistrationOtp() {
  try {
    assertOtpRequestInputs("register");
    sendOtpBtn.disabled = true;
    sendOtpBtn.textContent = "Sending...";
    authSubmitBtn.disabled = true;
    const formData = new FormData(authForm);
    const payload = Object.fromEntries(formData.entries());
    delete payload.otp;
    const data = await apiRequest("/api/auth/register/request-otp", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    registrationOtpIssued = true;
    startOtpCountdown(payload.email, "register", data.expiresInSeconds);
    authMessage.textContent = `${data.message} Verify the OTP within ${Math.floor((data.expiresInSeconds || 300) / 60)} minutes.`;
    setDashboardMessage(authMessage.textContent, "success");
    authOtpInput.focus();
  } catch (error) {
    authMessage.textContent = error.message;
    setDashboardMessage(error.message, "error");
    sendOtpBtn.textContent = registrationOtpIssued ? "Resend OTP" : "Send OTP";
  } finally {
    if (!otpTimer) {
      sendOtpBtn.disabled = false;
      sendOtpBtn.textContent = registrationOtpIssued ? "Resend OTP" : "Send OTP";
    }
    authSubmitBtn.disabled = false;
  }
}

async function requestPasswordResetOtp() {
  try {
    assertOtpRequestInputs("reset-password");
    sendOtpBtn.disabled = true;
    sendOtpBtn.textContent = "Sending...";
    authSubmitBtn.disabled = true;
    const formData = new FormData(authForm);
    const payload = {
      email: String(formData.get("email") || "").trim()
    };
    const data = await apiRequest("/api/auth/password-reset/request-otp", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    passwordResetOtpIssued = true;
    startOtpCountdown(payload.email, "reset", data.expiresInSeconds);
    authMessage.textContent = data.message;
    setDashboardMessage(data.message, "success");
    authOtpInput.focus();
  } catch (error) {
    authMessage.textContent = error.message;
    setDashboardMessage(error.message, "error");
    sendOtpBtn.textContent = passwordResetOtpIssued ? "Resend OTP" : "Send OTP";
  } finally {
    if (!otpTimer) {
      sendOtpBtn.disabled = false;
      sendOtpBtn.textContent = passwordResetOtpIssued ? "Resend OTP" : "Send OTP";
    }
    authSubmitBtn.disabled = false;
  }
}

function requestActiveOtp() {
  if (authMode === "reset-password") {
    return requestPasswordResetOtp();
  }

  return requestRegistrationOtp();
}

function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toLocaleString() : date.toLocaleString();
}

function buildGoogleMapsUrl(location, mapLocation) {
  if (mapLocation?.lat && mapLocation?.lng) {
    return `https://www.google.com/maps/search/?api=1&query=${mapLocation.lat},${mapLocation.lng}`;
  }

  if (location && String(location).trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`;
  }

  return "https://www.google.com/maps";
}

function buildGoogleMapsEmbedUrl(location, mapLocation) {
  if (mapLocation?.lat && mapLocation?.lng) {
    return `https://www.google.com/maps?q=${mapLocation.lat},${mapLocation.lng}&output=embed`;
  }

  if (location && String(location).trim()) {
    return `https://www.google.com/maps?q=${encodeURIComponent(location.trim())}&output=embed`;
  }

  return "";
}

function setPdfButtonState(enabled) {
  generatePdfBtn.disabled = !enabled;
  emailBbmpBtn.disabled = !enabled;
}

function setEmailProgress(value, label) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  emailProgress.hidden = false;
  emailProgressFill.style.width = `${safeValue}%`;
  emailProgressValue.textContent = `${safeValue}%`;
  if (label) {
    emailProgressLabel.textContent = label;
  }
}

function clearEmailProgressTimer() {
  if (emailProgressTimer) {
    window.clearInterval(emailProgressTimer);
    emailProgressTimer = null;
  }
}

function beginEmailProgress() {
  clearEmailProgressTimer();
  setEmailProgress(6, "Preparing complaint report...");
  emailProgressTimer = window.setInterval(() => {
    const current = Number.parseInt(emailProgressFill.style.width, 10) || 0;
    if (current >= 90) {
      clearEmailProgressTimer();
      return;
    }

    let nextValue = current + (current < 36 ? 7 : current < 68 ? 4 : 2);
    let nextLabel = "Preparing complaint report...";

    if (nextValue >= 28 && nextValue < 56) {
      nextLabel = "Generating formal PDF attachment...";
    } else if (nextValue >= 56 && nextValue < 82) {
      nextLabel = "Encoding report for authority delivery...";
    } else if (nextValue >= 82) {
      nextLabel = "Contacting authority mail server...";
    }

    setEmailProgress(nextValue, nextLabel);
  }, 280);
}

function finishEmailProgress(success = true) {
  clearEmailProgressTimer();
  setEmailProgress(100, success ? "Complaint email sent successfully." : "Complaint email could not be sent.");
  window.setTimeout(() => {
    emailProgress.hidden = true;
    emailProgressFill.style.width = "0%";
    emailProgressValue.textContent = "0%";
    emailProgressLabel.textContent = "Preparing complaint email...";
  }, success ? 2200 : 2600);
}

function updateLiveLocationMap(location, mapQuery = location) {
  const trimmedLocation = (location || "").trim();
  const trimmedMapQuery = (mapQuery || "").trim();

  if (!trimmedLocation || !trimmedMapQuery) {
    locationMapFrame.hidden = true;
    locationMapFrame.removeAttribute("src");
    liveLocationStatus.textContent = "Type a location in Report an Issue to preview it here.";
    return;
  }

  locationMapFrame.hidden = false;
  locationMapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(trimmedMapQuery)}&output=embed`;
  liveLocationStatus.textContent = `Showing map preview for ${trimmedLocation}.`;
}

function formatReverseGeocodedLocation(data, latitude, longitude) {
  const address = data?.address || {};
  const orderedParts = [
    address.road,
    address.neighbourhood,
    address.suburb,
    address.city_district,
    address.village,
    address.town,
    address.city,
    address.county,
    address.state
  ].filter(Boolean);

  const uniqueParts = [...new Set(orderedParts)];
  if (uniqueParts.length) {
    return uniqueParts.slice(0, 4).join(", ");
  }

  if (typeof data?.display_name === "string" && data.display_name.trim()) {
    return data.display_name
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 4)
      .join(", ");
  }

  return `Current location near ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

async function reverseGeocodeLiveLocation(latitude, longitude) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Unable to translate live location into a readable place.");
  }

  const data = await response.json();
  return formatReverseGeocodedLocation(data, latitude, longitude);
}

function updateLiveLocationMapFromCoordinates(latitude, longitude) {
  const formatted = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  locationMapFrame.hidden = false;
  locationMapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(formatted)}&output=embed`;
  liveLocationStatus.textContent = `Showing live location preview for ${formatted}.`;
}

function showTypedLocationOnMap() {
  const location = reportLocationInput.value.trim();

  updateLiveLocationMap(location);
  if (!location) {
    return;
  }

  activateAppView("map");
}

function useLiveLocation() {
  if (!navigator.geolocation) {
    setDashboardMessage("Live location is not supported in this browser.", "error");
    return;
  }

  useLiveLocationBtn.disabled = true;
  setDashboardMessage("Fetching live location...", "info");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      let readableLocation = "";

      try {
        readableLocation = await reverseGeocodeLiveLocation(latitude, longitude);
      } catch (error) {
        readableLocation = "Current location";
      }

      reportLocationInput.value = readableLocation;
      updateLiveLocationMap(readableLocation, `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      setDashboardMessage("Live location added to the report form.", "success");
      useLiveLocationBtn.disabled = false;
    },
    (error) => {
      const message =
        error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. Allow location access and try again."
          : error.code === error.POSITION_UNAVAILABLE
            ? "Live location is unavailable right now."
            : error.code === error.TIMEOUT
              ? "Live location request timed out. Try again."
              : "Unable to fetch live location.";

      setDashboardMessage(message, "error");
      useLiveLocationBtn.disabled = false;
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000
    }
  );
}

const IMAGE_INCIDENT_PROFILES = [
  {
    id: "safety_fire",
    label: "Potential fire, smoke, or gas hazard",
    issueType: "Gas Leak / Fire Risk",
    score(features) {
      return clampImageScore(features.redHeatRatio * 1.2 + features.smokeLikeRatio * 1.05 + features.hotspotRatio * 0.9 + features.darkRatio * 0.12);
    }
  },
  {
    id: "road_damage",
    label: "Road damage, pothole, or crack-like structure",
    issueType: "Road Damage",
    score(features) {
      return clampImageScore(features.edgeDensity * 0.92 + features.contrast * 0.72 + features.darkRatio * 0.32 + (1 - features.averageBrightness) * 0.22 - features.greenRatio * 0.12);
    }
  },
  {
    id: "tree_obstruction",
    label: "Tree, branch, or vegetation obstruction on the roadway",
    issueType: "Tree / Obstruction on Road",
    score(features) {
      return clampImageScore(features.greenRatio * 1.36 + features.averageSaturation * 0.22 + features.edgeDensity * 0.22 + features.contrast * 0.14 - features.blueRatio * 0.1);
    }
  },
  {
    id: "garbage",
    label: "Garbage, waste, or clutter accumulation",
    issueType: "Garbage Overflow",
    score(features) {
      return clampImageScore(features.edgeDensity * 0.34 + features.averageSaturation * 0.22 + features.contrast * 0.24 + features.darkRatio * 0.14 + features.neutralRatio * 0.12 - features.greenRatio * 0.18);
    }
  },
  {
    id: "sewage_overflow",
    label: "Sewage spill, dirty drain overflow, or open manhole hazard",
    issueType: "Sewage / Manhole Overflow",
    score(features) {
      return clampImageScore(features.neutralRatio * 0.34 + features.darkRatio * 0.3 + features.contrast * 0.18 + (1 - features.blueRatio) * 0.18 + (1 - features.averageBrightness) * 0.12);
    }
  },
  {
    id: "water_drainage",
    label: "Waterlogging, drainage overflow, or wet surface pattern",
    issueType: "Drainage / Waterlogging",
    score(features) {
      return clampImageScore(features.blueRatio * 0.92 + features.neutralRatio * 0.42 + (1 - features.averageSaturation) * 0.22 + features.averageBrightness * 0.1 - features.greenRatio * 0.42);
    }
  },
  {
    id: "wall_damage",
    label: "Cracked wall, ceiling damage, or structural surface defect",
    issueType: "Wall / Building Damage",
    score(features) {
      return clampImageScore(features.edgeDensity * 0.4 + features.contrast * 0.26 + features.neutralRatio * 0.28 + features.darkRatio * 0.14 + (1 - features.averageSaturation) * 0.12);
    }
  },
  {
    id: "utility_fault",
    label: "Utility or public asset fault",
    issueType: "Utility Fault",
    score(features) {
      return clampImageScore(features.edgeDensity * 0.22 + features.hotspotRatio * 0.24 + features.averageBrightness * 0.12 + (1 - features.greenRatio) * 0.08);
    }
  },
  {
    id: "water_leakage",
    label: "Leakage, pipe burst, or continuous water seepage pattern",
    issueType: "Water Leakage / Pipe Burst",
    score(features) {
      return clampImageScore(features.blueRatio * 0.42 + features.neutralRatio * 0.26 + features.averageBrightness * 0.14 + features.edgeDensity * 0.12 + features.contrast * 0.08);
    }
  },
  {
    id: "animal_intrusion",
    label: "Animal intrusion or stray animal obstruction",
    issueType: "Stray Animal / Animal Menace",
    score(features) {
      return clampImageScore(features.contrast * 0.16 + features.edgeDensity * 0.18 + features.darkRatio * 0.08 + features.greenRatio * 0.08);
    }
  },
  {
    id: "vehicle_obstruction",
    label: "Vehicle obstruction, illegal parking, or blocked access",
    issueType: "Vehicle Obstruction / Illegal Parking",
    score(features) {
      return clampImageScore(features.edgeDensity * 0.2 + features.contrast * 0.18 + features.darkRatio * 0.12 + features.neutralRatio * 0.1 + (1 - features.greenRatio) * 0.08);
    }
  }
];

function clampImageScore(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function rankImageIncidentCandidates(features) {
  if (!features) return [];

  const vegetationStrength = clampImageScore(
    features.greenRatio * 1.2 + features.averageSaturation * 0.24 + features.edgeDensity * 0.16 - features.blueRatio * 0.08
  );
  const structuralStrength = clampImageScore(
    features.edgeDensity * 0.42 + features.neutralRatio * 0.34 + features.contrast * 0.26 + (1 - features.averageSaturation) * 0.18
  );
  const dirtyWaterStrength = clampImageScore(
    features.neutralRatio * 0.6 + features.darkRatio * 0.44 + (1 - features.blueRatio) * 0.24 + (1 - features.averageBrightness) * 0.18
  );

  return IMAGE_INCIDENT_PROFILES.map((profile) => {
    let confidence = profile.score(features);

    if (profile.id === "tree_obstruction" && vegetationStrength > 0.2) {
      confidence = clampImageScore(confidence + 0.18 + vegetationStrength * 0.22);
    }
    if (profile.id === "garbage" && vegetationStrength > 0.2) {
      confidence = clampImageScore(confidence - (0.12 + vegetationStrength * 0.18));
    }
    if (profile.id === "water_drainage" && features.greenRatio > 0.22) {
      confidence = clampImageScore(confidence - (0.12 + features.greenRatio * 0.16));
    }
    if (profile.id === "sewage_overflow" && dirtyWaterStrength > 0.22) {
      confidence = clampImageScore(confidence + 0.14 + dirtyWaterStrength * 0.16);
    }
    if (profile.id === "wall_damage" && structuralStrength > 0.24) {
      confidence = clampImageScore(confidence + 0.1 + structuralStrength * 0.14);
    }

    return {
      ...profile,
      confidence: Number(confidence.toFixed(2))
    };
  })
    .filter((candidate) => candidate.confidence > 0)
    .sort((left, right) => right.confidence - left.confidence);
}

function describeImageFromFeatures(features) {
  if (!features) {
    return {
      description: "Upload an image to attach visual evidence.",
      accuracy: 0,
      candidates: []
    };
  }

  const candidates = rankImageIncidentCandidates(features);
  const top = candidates[0];
  const runnerUp = candidates[1];
  const isConfident = top && top.confidence >= 0.32;
  const isCloseCall = top && runnerUp && top.confidence - runnerUp.confidence < 0.08;

  if (!top || !isConfident) {
    return {
      description: "AI image guess: uncertain civic issue. Add a short complaint note if this looks wrong.",
      accuracy: top ? top.confidence : 0,
      candidates
    };
  }

  return {
    description: `AI image guess: ${top.label}${isCloseCall ? ` (also possible: ${runnerUp.label})` : ""}.`,
    accuracy: top.confidence,
    candidates
  };
}

async function apiRequest(path, options = {}) {
  let response;

  try {
    response = await fetch(path, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options.headers || {})
      }
    });
  } catch (_error) {
    throw new Error("Unable to reach the server. Make sure the app is running and refresh the page.");
  }

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data.error || "Request failed";
    const isAuthFailure =
      response.status === 401 ||
      response.status === 403 ||
      /jwt|token|bearer|permission denied/i.test(errorMessage);

    if (isAuthFailure && authState?.token) {
      clearAuthState("Your previous session is no longer valid. Please login again.");
    }

    throw new Error(errorMessage);
  }

  return data;
}

function renderRecentComplaints(complaints) {
  const recentMarkup = complaints
    .slice(0, 3)
    .map(
      (complaint) => `
        <div class="mini-item">
          <div>
            <strong>${escapeHtml(complaint.type)}</strong>
            <span>${escapeHtml(complaint.location)}</span>
          </div>
          <span class="mini-chevron">›</span>
        </div>
      `
    )
    .join("");

  document.getElementById("recentComplaints").innerHTML =
    recentMarkup || `<div class="table-row empty-state"><span>No recent complaints. Report an issue to get started.</span></div>`;
}

function renderMetrics(metrics) {
  const totalComplaints = Number(metrics?.totalComplaints || 0);
  const openComplaints = Number(metrics?.openComplaints || 0);
  document.getElementById("totalComplaints").textContent = totalComplaints;
  document.getElementById("openComplaints").textContent = openComplaints;
  document.getElementById("resolvedCount").textContent = Math.max(0, totalComplaints - openComplaints);
  const broadcastCount = document.getElementById("broadcastCount");
  if (broadcastCount) {
    broadcastCount.textContent = metrics?.emergencyBroadcasts || 0;
  }
  const incidentCount = document.getElementById("incidentCount");
  if (incidentCount) {
    incidentCount.textContent = metrics?.activeIncidents || 0;
  }
}

function getFilteredComplaints(complaints = []) {
  const search = normalizeSearchValue(complaintSearchInput?.value);
  const statusFilter = complaintStatusFilter?.value || "";
  const sortMode = complaintSortSelect?.value || "newest";

  const filtered = complaints.filter((complaint) => {
    const matchesSearch =
      !search ||
      [complaint.type, complaint.location, complaint.status, complaint.assignedAuthority, complaint.description]
        .some((value) => normalizeSearchValue(value).includes(search));
    const matchesStatus = !statusFilter || complaint.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  filtered.sort((left, right) => {
    if (sortMode === "priority") {
      return priorityRank(right.priority) - priorityRank(left.priority);
    }
    if (sortMode === "oldest") {
      return new Date(left.createdAt || 0) - new Date(right.createdAt || 0);
    }
    return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
  });

  return filtered;
}

function getFilteredAlerts(complaints = []) {
  const search = normalizeSearchValue(alertSearchInput?.value);
  const priority = alertPriorityFilter?.value || "";

  return complaints
    .filter((complaint) => (!priority || complaint.priority === priority) && Array.isArray(complaint.alerts) && complaint.alerts.length)
    .flatMap((complaint) =>
      complaint.alerts.slice(-2).map((alertText) => ({
        id: complaint._id,
        type: complaint.type,
        location: complaint.location,
        priority: complaint.priority,
        text: alertText
      }))
    )
    .filter((alert) => {
      if (!search) {
        return true;
      }

      return [alert.type, alert.location, alert.text, alert.priority].some((value) => normalizeSearchValue(value).includes(search));
    });
}

function getFilteredUsers(users = []) {
  const search = normalizeSearchValue(userSearchInput?.value);
  const state = userStateFilter?.value || "";

  return users.filter((user) => {
    const isDisabled = Boolean(user.disabledAt);
    const matchesSearch =
      !search || [user.username, user.email, user.role].some((value) => normalizeSearchValue(value).includes(search));
    const matchesState = !state || (state === "disabled" ? isDisabled : !isDisabled);
    return matchesSearch && matchesState;
  });
}

function renderAdminInsights(complaints = [], analytics = null) {
  if (!adminInsights) {
    return;
  }

  if (!complaints.length) {
    adminInsights.innerHTML = "";
    return;
  }

  const reviewCount = complaints.filter((complaint) => complaint.status === "Needs Review").length;
  const criticalCount = complaints.filter((complaint) => complaint.priority === "Critical" || complaint.priority === "High").length;
  const averageConfidence = complaints.length
    ? Math.round(
        complaints.reduce((sum, complaint) => sum + Number(complaint.confidence || 0), 0) / complaints.length
      )
    : 0;
  const topIssue = analytics?.topIssue?.label || complaints[0]?.type || "No category";
  const topAuthority = analytics?.topAuthority?.label || complaints[0]?.assignedAuthority || "No routing";
  const hotspot = summarizeHotspot(complaints);
  const oldestOpenCase = complaints
    .filter((complaint) => complaint.status !== "Resolved")
    .sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0))[0];
  const resolutionRate = complaints.length
    ? Math.round((complaints.filter((complaint) => complaint.status === "Resolved").length / complaints.length) * 100)
    : 0;

  adminInsights.innerHTML = `
    <article class="insight-card">
      <span>Needs review</span>
      <strong>${reviewCount}</strong>
      <p>Complaints that should be checked by an admin before routing.</p>
    </article>
    <article class="insight-card">
      <span>High priority</span>
      <strong>${criticalCount}</strong>
      <p>Complaints marked as high or critical.</p>
    </article>
    <article class="insight-card">
      <span>Average confidence</span>
      <strong>${averageConfidence}%</strong>
      <p>Current average AI confidence across loaded complaints.</p>
    </article>
    <article class="insight-card">
      <span>Top issue</span>
      <strong>${escapeHtml(topIssue)}</strong>
      <p>Most common issue in the current dashboard result set.</p>
    </article>
    <article class="insight-card">
      <span>Main authority</span>
      <strong>${escapeHtml(topAuthority)}</strong>
      <p>Most common routing target in the current dashboard result set.</p>
    </article>
    <article class="insight-card">
      <span>Main hotspot</span>
      <strong>${escapeHtml(hotspot)}</strong>
      <p>Location with the highest visible complaint concentration.</p>
    </article>
    <article class="insight-card">
      <span>Oldest open case</span>
      <strong>${oldestOpenCase ? pluralize(countDaysOpen(oldestOpenCase.createdAt), "day") : "No open case"}</strong>
      <p>${oldestOpenCase ? escapeHtml(oldestOpenCase.location || oldestOpenCase.type || "Open case") : "All visible complaints are resolved."}</p>
    </article>
    <article class="insight-card">
      <span>Resolution rate</span>
      <strong>${resolutionRate}%</strong>
      <p>Share of visible complaints already marked as resolved.</p>
    </article>
  `;
}

function renderDigitalTwin(digitalTwin = null) {
  const panel = document.getElementById("digitalTwinPanel");
  if (!panel) return;

  if (!digitalTwin) {
    panel.innerHTML = "";
    return;
  }

  const weakestZones = (digitalTwin.zones || []).slice(0, 3);
  panel.innerHTML = `
    <article class="insight-card">
      <span>Civic health</span>
      <strong>${digitalTwin.cityHealthScore ?? 100}</strong>
      <p>${escapeHtml(digitalTwin.cityHealthBand || "Stable")} citywide digital twin score.</p>
    </article>
    <article class="insight-card">
      <span>Stressed zones</span>
      <strong>${digitalTwin.summary?.stressedZones || 0}</strong>
      <p>${digitalTwin.summary?.totalZones || 0} zone${digitalTwin.summary?.totalZones === 1 ? "" : "s"} currently modeled.</p>
    </article>
    <article class="insight-card">
      <span>Active incidents</span>
      <strong>${digitalTwin.summary?.activeIncidents || 0}</strong>
      <p>Command-center cases influencing civic risk.</p>
    </article>
    <article class="insight-card">
      <span>Weakest zone</span>
      <strong>${escapeHtml(weakestZones[0]?.zone || "No zone")}</strong>
      <p>${weakestZones[0] ? `${weakestZones[0].healthBand}: ${escapeHtml(weakestZones[0].recommendation)}` : "No complaint pressure detected."}</p>
    </article>
  `;
}

function renderIncidentCommands(commands = []) {
  const panel = document.getElementById("incidentCommandPanel");
  if (!panel) return;

  if (!commands.length) {
    panel.innerHTML = `<div class="table-row empty-state"><span>No active incident command rooms. High-risk cases will appear here automatically.</span></div>`;
    return;
  }

  panel.innerHTML = commands
    .map((command) => {
      const total = command.checklist?.length || 0;
      const done = (command.checklist || []).filter((item) => item.status === "done").length;
      return `
        <div class="table-row">
          <div>
            <strong>${escapeHtml(command.incidentCode || "Incident")}: ${escapeHtml(command.title || "Civic incident")}</strong>
            <span>${escapeHtml(command.assignedUnit || command.assignedDepartment || "Response unit")} · ${escapeHtml(command.ward || "Citywide")}</span>
          </div>
          <div>
            <strong>${escapeHtml(command.commandStatus || "Active")}</strong>
            <span>SLA ${escapeHtml(formatDateTime(command.slaDueAt))} · checklist ${done}/${total}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function formatTokenLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function countDaysOpen(value) {
  const createdAt = new Date(value || Date.now()).getTime();
  if (Number.isNaN(createdAt)) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - createdAt) / 86400000));
}

function confidenceTone(complaint) {
  const confidenceValue = Number(complaint?.confidence || 0);
  if (confidenceValue >= 80) {
    return "High confidence";
  }
  if (confidenceValue >= 60) {
    return "Moderate confidence";
  }
  return "Needs review";
}

function summarizeHotspot(complaints = []) {
  const counts = complaints.reduce((accumulator, complaint) => {
    const key = String(complaint.location || "Unknown").trim() || "Unknown";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const [label, count] = Object.entries(counts).sort((left, right) => right[1] - left[1])[0] || [];
  return label ? `${label} (${pluralize(count, "case")})` : "No area selected";
}

function severityBadge(priority) {
  const label = priority || "Low";
  return `<span class="info-chip severity-chip severity-${formatTokenLabel(label)}">${escapeHtml(label)}</span>`;
}

function authorityBadge(authority) {
  const label = authority || "Gram Panchayat";
  return `<span class="info-chip authority-chip authority-${formatTokenLabel(label)}">${escapeHtml(label)}</span>`;
}

function confidenceBadge(complaint) {
  const label = complaint?.ai?.confidenceLabel || (complaint?.confidence < 52 ? "Needs review" : "AI reviewed");
  return `<span class="info-chip confidence-chip">${escapeHtml(label)}</span>`;
}

function renderAnalysis(result) {
  const reviewText = result.explainability?.reviewRequired ? " It needs admin review because confidence is low." : "";
  const routeText = result.routing?.unit ? ` ${result.routing.unit} is assigned.` : "";
  const broadcastText = result.broadcast?.triggered ? ` Emergency broadcast ${result.broadcast.status}.` : "";
  setDashboardMessage(
    `Complaint logged with ${result.priority.level} severity and routed to ${result.assignedAuthority}.${routeText} Detected issue: ${result.nlp?.issueType || result.cv.detected}.${reviewText}${broadcastText}`,
    result.explainability?.reviewRequired ? "info" : "success"
  );
}

function buildSubmittedReport(payload, result) {
  const finalAiDescription =
    result.cv?.detected && result.cv.detected !== "No image uploaded"
      ? result.cv.detected
      : result.nlp?.issueType || payload.imageHint || "No AI description generated.";

  return {
    complaintId: result.complaintId || "Pending",
    submittedAt: new Date().toISOString(),
    reporter: authState?.username || "Citizen",
    role: authState?.role || "Citizen",
    location: payload.location || "Unknown",
    textComplaint: payload.textComplaint || "No complaint text provided.",
    aiDescription: finalAiDescription,
    uploadedPhoto: currentImageDataUrl,
    googleMapsUrl: buildGoogleMapsUrl(payload.location, result.mapLocation),
    googleMapsEmbedUrl: buildGoogleMapsEmbedUrl(payload.location, result.mapLocation),
    issueType: result.nlp?.issueType || "Complaint",
    category: result.nlp?.category || "General",
    priority: result.priority?.level || "Low",
    assignedAuthority: result.assignedAuthority || "Gram Panchayat",
    routing: result.routing || result.explainability?.routing || null,
    broadcast: result.broadcast || result.explainability?.broadcast || null,
    incidentCommand: result.incidentCommand || result.explainability?.incidentCommand || null,
    status: result.status || "Queued",
    detection: result.cv?.detected || "No image analysis available",
    cvReason: result.cv?.reason || "Local AI matched the uploaded issue against known civic patterns.",
    notifications: Array.isArray(result.notifications) ? result.notifications : [],
    alerts: Array.isArray(result.alerts) ? result.alerts : [],
    mapLocation: result.mapLocation || null,
    explainability: result.explainability || null
    ,
    aiMeta: result.aiMeta || null
  };
}

function closeComplaintDetailOverlay() {
  if (!complaintDetailOverlay) return;
  complaintDetailOverlay.hidden = true;
  if (authOverlay?.hidden !== false && faqOverlay?.hidden !== false && postSubmitOverlay?.hidden !== false) {
    document.body.classList.remove("auth-open");
  }
}

function renderStatusHistory(history = []) {
  if (!history.length) {
    return `<div class="table-row empty-state"><span>No status history recorded yet.</span></div>`;
  }

  return history
    .map(
      (entry) => `
        <div class="timeline-item status-history-row">
          <strong>${escapeHtml(entry.status)}</strong>
          <span>${escapeHtml(entry.changedBy || "system")} · ${escapeHtml(formatDateTime(entry.changedAt))}</span>
          <p>${escapeHtml(entry.note || "Status updated.")}</p>
        </div>
      `
    )
    .join("");
}

function renderVisionCandidates(candidates = []) {
  if (!candidates.length) {
    return `<div class="table-row empty-state"><span>No vision candidates recorded.</span></div>`;
  }

  return candidates
    .map(
      (candidate) => `
        <div class="table-row">
          <div>
            <strong>${escapeHtml(candidate.label || candidate.categoryLabel || "Candidate")}</strong>
            <span>${escapeHtml(candidate.categoryId || candidate.category_id || "")}</span>
          </div>
          <div>
            <strong>${Math.round(Number(candidate.confidence || 0) * 100)}%</strong>
            <span>${escapeHtml(candidate.source || "vision")}</span>
          </div>
        </div>
      `
    )
    .join("");
}

function renderAlertsHistory(alerts = []) {
  if (!alerts.length) {
    return `<div class="table-row empty-state"><span>No alert notes recorded for this complaint.</span></div>`;
  }

  return alerts
    .map(
      (alertText, index) => `
        <div class="timeline-item">
          <strong>Alert ${alerts.length - index}</strong>
          <p>${escapeHtml(alertText)}</p>
        </div>
      `
    )
    .join("");
}

function renderConfidenceBreakdown(confidenceBreakdown = {}) {
  const entries = Object.entries(confidenceBreakdown || {}).filter(([, value]) => typeof value === "number");
  if (!entries.length) {
    return `
      <article class="detail-diagnostic-card">
        <strong>No numeric breakdown available</strong>
        <p>The current AI run did not store separate decision weights for this complaint.</p>
      </article>
    `;
  }

  return entries
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(
      ([label, value]) => `
        <article class="detail-diagnostic-card">
          <span>${escapeHtml(label.replace(/([A-Z])/g, " $1").trim())}</span>
          <strong>${Math.round(Number(value) * 100)}%</strong>
          <p>Relative weight used in the stored AI decision breakdown.</p>
        </article>
      `
    )
    .join("");
}

function renderRoutingSummary(complaint) {
  const routing = complaint.routing || {};
  if (!routing.unit && !routing.department) {
    return "Current authority assignment for this complaint.";
  }

  const workload = Number.isFinite(Number(routing.workloadScore))
    ? `${Math.round(Number(routing.workloadScore) * 100)}% workload`
    : "workload not recorded";
  return [
    `${routing.department || "Response department"} · ${routing.unit || "Response unit"}`,
    `${routing.ward || "Ward not inferred"} · ${routing.escalationLevel || "Routine"} · ${workload}`,
    routing.routingReason || ""
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br>");
}

function renderBroadcastSummary(complaint) {
  const broadcast = complaint.broadcast || {};
  if (!broadcast.triggered) {
    return "No emergency broadcast was required for this case.";
  }

  return [
    `Status: ${broadcast.status || "created"}`,
    `Recipients: ${broadcast.recipientCount || 0}`,
    broadcast.message || ""
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br>");
}

function renderIncidentSummary(complaint) {
  const incident = complaint.incidentCommand || {};
  if (!incident.triggered) {
    return "No incident command room was needed for this complaint.";
  }

  return [
    incident.incidentCode || "Incident command",
    `Status: ${incident.status || "Active"}`,
    incident.slaDueAt ? `SLA: ${formatDateTime(incident.slaDueAt)}` : "",
    incident.summary || ""
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br>");
}

function renderComplaintDetail(complaint) {
  complaintDetailTitle.textContent = complaint.type || "Complaint";
  const mapsUrl = buildGoogleMapsUrl(complaint.location, complaint.mapLocation);
  const ageInDays = countDaysOpen(complaint.createdAt);
  const alternatives = Array.isArray(complaint.ai?.visionCandidates) ? complaint.ai.visionCandidates.slice(1, 4) : [];
  const timelineHistory = Array.isArray(complaint.statusHistory) ? [...complaint.statusHistory].reverse() : [];
  complaintDetailBody.innerHTML = `
    <div class="detail-case-layout">
      <section class="detail-hero">
        <div class="detail-hero-head">
          <div class="detail-hero-copy">
            <p class="eyebrow">Case summary</p>
            <h3>${escapeHtml(complaint.type || "Complaint")}</h3>
            <p>${escapeHtml(complaint.description || "No complaint description recorded.")}</p>
          </div>
          <div class="issue-meta">
            ${confidenceBadge(complaint)}
            ${severityBadge(complaint.priority)}
            ${authorityBadge(complaint.assignedAuthority)}
          </div>
        </div>

        <div class="detail-facts-grid">
          <article class="detail-summary-card">
            <span>Status</span>
            <strong>${escapeHtml(complaint.status || "Queued")}</strong>
          </article>
          <article class="detail-summary-card">
            <span>Location</span>
            <strong>${escapeHtml(complaint.location || "Unknown")}</strong>
          </article>
          <article class="detail-summary-card">
            <span>Case age</span>
            <strong>${pluralize(ageInDays, "day")}</strong>
          </article>
          <article class="detail-summary-card">
            <span>Decision tone</span>
            <strong>${escapeHtml(confidenceTone(complaint))}</strong>
          </article>
        </div>

        <section class="detail-section">
          <p class="detail-section-label">AI decision</p>
          <p>${escapeHtml(complaint.ai?.explanation || complaint.ai?.cvReason || "No AI explanation recorded.")}</p>
          <p class="helper-text">Recommended team: ${escapeHtml(complaint.ai?.recommendedTeam || "Help Desk")} · AI engine: ${escapeHtml(complaint.ai?.engine || "unknown")} · Fallback: ${complaint.ai?.fallbackUsed ? "yes" : "no"} · Geocoding: ${escapeHtml(complaint.ai?.geocodingSource || "unknown")}</p>
        </section>

        <section class="detail-section">
          <p class="detail-section-label">Decision breakdown</p>
          <div class="detail-diagnostic-grid">
            ${renderConfidenceBreakdown(complaint.ai?.confidenceBreakdown)}
          </div>
        </section>

        <section class="detail-section">
          <p class="detail-section-label">Vision candidates</p>
          <div class="table-list">${renderVisionCandidates(complaint.ai?.visionCandidates || [])}</div>
        </section>
      </section>

      <div class="detail-support-grid">
        <section class="detail-support-card">
          <p class="detail-section-label">Routing</p>
          <strong>${escapeHtml(complaint.routing?.unit || complaint.assignedAuthority || "Gram Panchayat")}</strong>
          <p>${renderRoutingSummary(complaint)}</p>
        </section>
        <section class="detail-support-card">
          <p class="detail-section-label">Created</p>
          <strong>${escapeHtml(formatDateTime(complaint.createdAt))}</strong>
          <p>Stored case creation time in the complaint log.</p>
        </section>
        <section class="detail-support-card">
          <p class="detail-section-label">Alternative reads</p>
          <strong>${alternatives.length ? pluralize(alternatives.length, "candidate") : "No alternates"}</strong>
          <p>${alternatives.length ? escapeHtml(alternatives.map((candidate) => candidate.label || "Candidate").join(" • ")) : "No secondary image candidates were recorded for this complaint."}</p>
        </section>
        <section class="detail-support-card">
          <p class="detail-section-label">Emergency broadcast</p>
          <strong>${complaint.broadcast?.triggered ? "Triggered" : "Not triggered"}</strong>
          <p>${renderBroadcastSummary(complaint)}</p>
        </section>
        <section class="detail-support-card">
          <p class="detail-section-label">Incident command</p>
          <strong>${complaint.incidentCommand?.triggered ? escapeHtml(complaint.incidentCommand.incidentCode || "Command active") : "Not opened"}</strong>
          <p>${renderIncidentSummary(complaint)}</p>
        </section>
        <section class="detail-support-card">
          <p class="detail-section-label">Map</p>
          <strong><a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer noopener">Open in Google Maps</a></strong>
          <p>Open the stored location in a full map window.</p>
        </section>
        <section class="detail-timeline">
          <p class="detail-section-label">Status timeline</p>
          <div class="detail-timeline-list">${renderStatusHistory(timelineHistory)}</div>
        </section>
        <section class="detail-timeline">
          <p class="detail-section-label">Alert notes</p>
          <div class="detail-timeline-list">${renderAlertsHistory(complaint.alerts || [])}</div>
        </section>
      </div>
    </div>
  `;
  complaintDetailOverlay.hidden = false;
  document.body.classList.add("auth-open");
}

async function openComplaintDetail(complaintId) {
  try {
    const data = await apiRequest(`/api/complaints/${complaintId}`, { method: "GET" });
    renderComplaintDetail(data.complaint);
  } catch (error) {
    setDashboardMessage(error.message, "error");
  }
}

function buildPdfFilename(report) {
  const safeId = String(report.complaintId || "report").replace(/[^a-z0-9_-]+/gi, "-");
  return `complaint-report-${safeId}.pdf`;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error("Unable to prepare the generated PDF for email."));
    reader.readAsDataURL(blob);
  });
}

function getJsPdfConstructor() {
  const jsPdfConstructor = window.jspdf?.jsPDF;
  if (!jsPdfConstructor) {
    throw new Error("PDF generator is unavailable. Refresh the page and try again.");
  }
  return jsPdfConstructor;
}

async function generatePdfReport(report, options = {}) {
  if (!report) {
    throw new Error("Submit a complaint first to generate the PDF report.");
  }

  const jsPDF = getJsPdfConstructor();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const lineColor = [120, 136, 153];
  const textColor = [27, 41, 57];
  const headingColor = [25, 55, 96];
  let cursorY = 14;

  const ensureSpace = (requiredHeight) => {
    if (cursorY + requiredHeight > pageHeight - 18) {
      doc.addPage();
      cursorY = 16;
    }
  };

  const drawSectionTitle = (title) => {
    ensureSpace(12);
    doc.setFillColor(237, 243, 249);
    doc.setDrawColor(...lineColor);
    doc.rect(margin, cursorY, contentWidth, 8, "FD");
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...headingColor);
    doc.text(title, margin + 3, cursorY + 5.5);
    cursorY += 11;
  };

  const drawRow = (label, value) => {
    const labelWidth = 42;
    const valueLines = doc.splitTextToSize(String(value || "-"), contentWidth - labelWidth - 6);
    const rowHeight = Math.max(8, valueLines.length * 5 + 3);
    ensureSpace(rowHeight);
    doc.setDrawColor(...lineColor);
    doc.rect(margin, cursorY, labelWidth, rowHeight);
    doc.rect(margin + labelWidth, cursorY, contentWidth - labelWidth, rowHeight);
    doc.setFont("times", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...headingColor);
    doc.text(label, margin + 2, cursorY + 5);
    doc.setFont("times", "normal");
    doc.setTextColor(...textColor);
    doc.text(valueLines, margin + labelWidth + 3, cursorY + 5);
    cursorY += rowHeight;
  };

  const drawParagraphBox = (text, minHeight = 28) => {
    const lines = doc.splitTextToSize(String(text || "-"), contentWidth - 8);
    const boxHeight = Math.max(minHeight, lines.length * 5 + 8);
    ensureSpace(boxHeight);
    doc.setDrawColor(...lineColor);
    doc.rect(margin, cursorY, contentWidth, boxHeight);
    doc.setFont("times", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...textColor);
    doc.text(lines, margin + 4, cursorY + 6);
    cursorY += boxHeight + 3;
  };

  const drawBulletsBox = (items) => {
    const safeItems = items.length ? items : ["No entries recorded."];
    const lines = safeItems.flatMap((item) => [`• ${item}`]);
    const normalizedLines = safeItems.map((item) => `- ${item}`);
    const wrapped = normalizedLines.flatMap((line) => doc.splitTextToSize(line, contentWidth - 10));
    const boxHeight = Math.max(22, wrapped.length * 5 + 8);
    ensureSpace(boxHeight);
    doc.setDrawColor(...lineColor);
    doc.rect(margin, cursorY, contentWidth, boxHeight);
    doc.setFont("times", "normal");
    doc.setFontSize(10.3);
    doc.setTextColor(...textColor);
    doc.text(wrapped, margin + 4, cursorY + 6);
    cursorY += boxHeight + 3;
  };

  doc.setDrawColor(50, 76, 114);
  doc.setLineWidth(0.5);
  doc.rect(margin - 2, cursorY - 2, contentWidth + 4, pageHeight - 28, "S");
  doc.setFont("times", "normal");
  doc.setTextColor(88, 101, 116);
  doc.setFontSize(10);
  doc.text("Citizen Grievance Submission Copy", pageWidth / 2, cursorY + 3, { align: "center" });
  doc.setFont("times", "bold");
  doc.setTextColor(...headingColor);
  doc.setFontSize(16);
  doc.text("FORMAL COMPLAINT REPORT", pageWidth / 2, cursorY + 10, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...textColor);
  doc.text("AI Powered Smart Community Problem Detection System", pageWidth / 2, cursorY + 16, { align: "center" });
  doc.text(`Prepared for submission to ${report.assignedAuthority === "Municipality" ? "Municipal Complaint Cell" : "Gram Panchayat Complaint Cell"} / ${report.assignedAuthority}`, pageWidth / 2, cursorY + 21, { align: "center" });
  doc.line(margin, cursorY + 25, pageWidth - margin, cursorY + 25);
  cursorY += 30;

  drawSectionTitle("1. Reference Details");
  drawRow("Complaint ID", report.complaintId);
  drawRow("Date and Time", formatDateTime(report.submittedAt));
  drawRow("Reported By", report.reporter);
  drawRow("User Role", report.role);
  drawRow("Routed Authority", report.assignedAuthority);
  drawRow("Assigned Unit", report.routing?.unit || report.routing?.department || "Not recorded");
  drawRow("Ward / Coverage", report.routing?.ward || "Not recorded");
  drawRow("Complaint Status", report.status);

  drawSectionTitle("2. Complaint Particulars");
  drawRow("Issue Type", report.issueType);
  drawRow("Issue Category", report.category);
  drawRow("Severity Level", report.priority);
  drawRow("Location", report.location);

  drawSectionTitle("3. Complaint Narrative");
  drawParagraphBox(report.textComplaint, 34);

  drawSectionTitle("4. AI Assessment and Technical Summary");
  drawRow("AI Description", report.aiDescription);
  drawRow("Detected Pattern", report.detection);
  drawRow("AI Reasoning", report.cvReason);
  drawRow("Explainability", report.explainability?.explanation || "No explainability summary recorded.");
  drawRow("Confidence", report.explainability?.confidenceLabel || report.priority);
  drawRow("AI Engine", report.aiMeta?.engine || "Not recorded");
  drawRow("AI Provider", report.aiMeta?.provider || "Not recorded");
  drawRow("Vision Engine", report.aiMeta?.visionEngine || "Not recorded");

  drawSectionTitle("5. Evidence and Location Reference");
  ensureSpace(95);
  const leftX = margin;
  const rightX = margin + contentWidth / 2 + 3;
  const panelWidth = contentWidth / 2 - 3;
  const panelTop = cursorY;
  const panelHeight = 88;

  doc.setDrawColor(...lineColor);
  doc.rect(leftX, panelTop, panelWidth, panelHeight);
  doc.rect(rightX, panelTop, panelWidth, panelHeight);
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...headingColor);
  doc.text("Uploaded Photo", leftX + 3, panelTop + 6);
  doc.text("Google Maps Reference", rightX + 3, panelTop + 6);

  if (report.uploadedPhoto) {
    try {
      const imageFormat = report.uploadedPhoto.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(report.uploadedPhoto, imageFormat, leftX + 3, panelTop + 10, panelWidth - 6, 58, undefined, "FAST");
    } catch (_error) {
      doc.setFont("times", "normal");
      doc.setTextColor(...textColor);
      doc.text("Uploaded image could not be embedded in the PDF.", leftX + 3, panelTop + 20);
    }
  } else {
    doc.setFont("times", "normal");
    doc.setTextColor(...textColor);
    doc.text("No image was uploaded for this complaint.", leftX + 3, panelTop + 20);
  }

  doc.setFont("times", "normal");
  doc.setTextColor(...textColor);
  const mapIntro = doc.splitTextToSize("Click the following link to open the complaint location in Google Maps:", panelWidth - 6);
  doc.text(mapIntro, rightX + 3, panelTop + 14);
  const linkLines = doc.splitTextToSize(report.googleMapsUrl, panelWidth - 8);
  let linkY = panelTop + 14 + mapIntro.length * 4.6 + 5;
  doc.setTextColor(25, 74, 155);
  linkLines.forEach((line, index) => {
    doc.text(line, rightX + 3, linkY + index * 5);
  });
  doc.link(rightX + 2, linkY - 4, panelWidth - 4, linkLines.length * 5 + 4, { url: report.googleMapsUrl });
  doc.setTextColor(...textColor);
  cursorY += panelHeight + 4;

  drawSectionTitle("6. Alerts and Notifications");
  drawRow("System Alerts", "");
  cursorY -= 8;
  drawBulletsBox(report.alerts);
  drawRow("Notifications Issued", "");
  cursorY -= 8;
  drawBulletsBox(report.notifications);
  drawRow("Emergency Broadcast", report.broadcast?.triggered ? `${report.broadcast.status || "created"} · ${report.broadcast.recipientCount || 0} recipient(s)` : "Not triggered");
  drawRow("Incident Command", report.incidentCommand?.triggered ? `${report.incidentCommand.incidentCode || "Opened"} · SLA ${formatDateTime(report.incidentCommand.slaDueAt)}` : "Not opened");

  ensureSpace(18);
  doc.setDrawColor(...lineColor);
  doc.line(margin, cursorY + 2, pageWidth - margin, cursorY + 2);
  doc.setFont("times", "italic");
  doc.setFontSize(9.5);
  doc.setTextColor(88, 101, 116);
  doc.text(
    "This complaint report has been generated automatically from citizen-submitted inputs for formal escalation and record-keeping.",
    margin,
    cursorY + 8
  );

  const filename = buildPdfFilename(report);
  const blob = doc.output("blob");

  if (options.download !== false) {
    doc.save(filename);
  }

  return { blob, filename };
}

function renderComplaints(complaints) {
  const container = document.getElementById("complaintsList");
  const canUpdateStatus = authState?.permissions?.includes("update_complaint_status");
  const visibleComplaints = getFilteredComplaints(complaints);

  if (!visibleComplaints.length) {
    container.innerHTML = `<div class="table-row empty-state"><span>No complaints found. The dashboard is currently clear.</span></div>`;
    return;
  }

  container.innerHTML = visibleComplaints
    .map(
      (complaint) => `
        <article class="issue-card">
          <div class="issue-card-head">
            <strong>${escapeHtml(complaint.type)}</strong>
            <span class="status-pill" data-status="${escapeHtml(complaint.status)}">${escapeHtml(complaint.status)}</span>
          </div>
          <p>${escapeHtml(complaint.location)}</p>
          <p class="helper-text">Unit: ${escapeHtml(complaint.routing?.unit || complaint.routing?.department || complaint.ai?.recommendedTeam || "Response team")} · ${complaint.broadcast?.triggered ? `Broadcast ${escapeHtml(complaint.broadcast.status || "created")}` : "No broadcast"}</p>
          <div class="issue-meta">
            ${severityBadge(complaint.priority)}
            ${authorityBadge(complaint.assignedAuthority)}
            ${confidenceBadge(complaint)}
          </div>
          <button type="button" class="secondary-button view-complaint-btn" data-complaint-id="${complaint._id}">View Details</button>
          ${
            canUpdateStatus
              ? `
            <div class="status-actions">
              <select class="status-select" data-complaint-id="${complaint._id}">
                <option value="Queued" ${complaint.status === "Queued" ? "selected" : ""}>Pending</option>
                <option value="Needs Review" ${complaint.status === "Needs Review" ? "selected" : ""}>Needs Review</option>
                <option value="In Progress" ${complaint.status === "In Progress" ? "selected" : ""}>In Progress</option>
                <option value="Resolved" ${complaint.status === "Resolved" ? "selected" : ""}>Resolved</option>
                <option value="Escalated" ${complaint.status === "Escalated" ? "selected" : ""}>Escalated</option>
              </select>
              <button type="button" class="secondary-button update-status-btn" data-complaint-id="${complaint._id}">Save</button>
            </div>
          `
              : ""
          }
        </article>
      `
    )
    .join("");

  container.querySelectorAll(".view-complaint-btn").forEach((button) => {
    button.addEventListener("click", () => openComplaintDetail(button.dataset.complaintId));
  });

  if (canUpdateStatus) {
    container.querySelectorAll(".update-status-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const complaintId = button.dataset.complaintId;
        const select = container.querySelector(`.status-select[data-complaint-id="${complaintId}"]`);

        try {
          await apiRequest(`/api/complaints/${complaintId}/status`, {
            method: "PATCH",
            body: JSON.stringify({
              status: select.value,
              alertNote: `Status updated to ${select.value} by ${authState.username}`
            })
          });
          setDashboardMessage(`Complaint status updated to ${select.value}.`, "success");
          await loadDashboard();
        } catch (error) {
          setDashboardMessage(error.message, "error");
        }
      });
    });
  }
}

function renderAdminTable(complaints) {
  const adminMarkup = complaints
    .slice(0, 4)
    .map(
      (complaint) => `
        <div class="table-row">
          <div>
            <strong>${escapeHtml(complaint.location)}</strong>
            <span>${escapeHtml(complaint.type)}</span>
          </div>
          <div>
            <strong>${escapeHtml(complaint.assignedAuthority || "Gram Panchayat")}</strong>
            <span>${escapeHtml(complaint.status)}</span>
          </div>
          <button type="button" class="chip-button view-complaint-btn" data-complaint-id="${complaint._id}">Details</button>
        </div>
      `
    )
    .join("");

  document.getElementById("adminTable").innerHTML =
    adminMarkup || `<div class="table-row empty-state"><span>No complaints are currently in the admin queue.</span></div>`;

  document.querySelectorAll("#adminTable .view-complaint-btn").forEach((button) => {
    button.addEventListener("click", () => openComplaintDetail(button.dataset.complaintId));
  });
}

function renderAlerts(complaints = []) {
  const canManageAlerts = authState?.permissions?.includes("manage_alerts");

  if (!canManageAlerts) {
    alertsList.innerHTML = `<div class="table-row"><span>Login as Admin to manage alerts.</span></div>`;
    return;
  }

  const alertEntries = getFilteredAlerts(complaints);

  if (!alertEntries.length) {
    alertsList.innerHTML = `<div class="table-row empty-state"><span>No active alerts need attention.</span></div>`;
    return;
  }

  alertsList.innerHTML = alertEntries
    .map(
      (alert) => `
        <article class="table-row">
          <div>
            <strong>${escapeHtml(alert.type)}</strong>
            <span>${escapeHtml(alert.location)}</span>
            <span>${escapeHtml(alert.text)}</span>
          </div>
          <button type="button" class="secondary-button acknowledge-alert-btn" data-complaint-id="${alert.id}">Acknowledge</button>
        </article>
      `
    )
    .join("");

  alertsList.querySelectorAll(".acknowledge-alert-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        button.disabled = true;
        await apiRequest(`/api/complaints/${button.dataset.complaintId}/alerts/acknowledge`, {
          method: "POST",
          body: JSON.stringify({})
        });
        setDashboardMessage("Alert acknowledged successfully.", "success");
        await loadDashboard();
      } catch (error) {
        setDashboardMessage(error.message, "error");
        button.disabled = false;
      }
    });
  });
}

function renderUserManagement(users = []) {
  const canDeleteUsers = authState?.permissions?.includes("delete_users");
  const visibleUsers = getFilteredUsers(users);

  if (!canDeleteUsers) {
    userManagementList.innerHTML = `<div class="table-row"><span>Login as Admin to manage accounts.</span></div>`;
    return;
  }

  if (!visibleUsers.length) {
    userManagementList.innerHTML = `<div class="table-row"><span>No accounts found.</span></div>`;
    return;
  }

  userManagementList.innerHTML = visibleUsers
    .map(
      (user) => `
        <article class="table-row user-row">
          <div>
            <strong>${escapeHtml(user.username)}</strong>
            <span>${escapeHtml(user.email || "No email recorded")}</span>
            <span>${user.disabledAt ? `Disabled by ${escapeHtml(user.disabledBy || "admin")}` : "Active account"}</span>
          </div>
          <div class="user-admin-actions">
            <select class="user-role-select" data-user-id="${user._id}">
              <option value="Citizen" ${user.role === "Citizen" ? "selected" : ""}>Citizen</option>
              <option value="Admin" ${user.role === "Admin" ? "selected" : ""}>Admin</option>
            </select>
            <button
              type="button"
              class="secondary-button save-user-btn"
              data-user-id="${user._id}"
            >
              Save Role
            </button>
            <button
              type="button"
              class="secondary-button toggle-user-btn"
              data-user-id="${user._id}"
              data-disabled="${user.disabledAt ? "true" : "false"}"
              data-username="${escapeHtml(user.username)}"
            >
              ${user.disabledAt ? "Enable" : "Disable"}
            </button>
            <button
              type="button"
              class="danger-button delete-user-btn"
              data-user-id="${user._id}"
              data-username="${escapeHtml(user.username)}"
              data-role="${escapeHtml(user.role)}"
            >
              Delete
            </button>
          </div>
        </article>
      `
    )
    .join("");

  userManagementList.querySelectorAll(".save-user-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.userId;
      const select = userManagementList.querySelector(`.user-role-select[data-user-id="${userId}"]`);

      try {
        button.disabled = true;
        const result = await apiRequest(`/api/users/${userId}`, {
          method: "PATCH",
          body: JSON.stringify({ role: select.value })
        });
        setDashboardMessage(result.message, "success");
        await loadDashboard();
      } catch (error) {
        setDashboardMessage(error.message, "error");
        button.disabled = false;
      }
    });
  });

  userManagementList.querySelectorAll(".toggle-user-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const disabled = button.dataset.disabled === "true";
      const action = disabled ? "enable" : "disable";
      const confirmed = window.confirm(`${action[0].toUpperCase()}${action.slice(1)} account "${button.dataset.username}"?`);

      if (!confirmed) {
        return;
      }

      try {
        button.disabled = true;
        const result = await apiRequest(`/api/users/${button.dataset.userId}`, {
          method: "PATCH",
          body: JSON.stringify({ disabled: !disabled })
        });
        setDashboardMessage(result.message, "success");
        await loadDashboard();
      } catch (error) {
        setDashboardMessage(error.message, "error");
        button.disabled = false;
      }
    });
  });

  userManagementList.querySelectorAll(".delete-user-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const { userId, username, role } = button.dataset;
      const confirmed = window.confirm(`Delete ${role} account "${username}"?`);

      if (!confirmed) {
        return;
      }

      try {
        button.disabled = true;
        const result = await apiRequest(`/api/users/${userId}`, {
          method: "DELETE"
        });

        if (result.deletedCurrentSession) {
          authState = null;
          lastSubmittedReport = null;
          saveAuthState();
          applyPermissionState();
          resetComposer();
          setPdfButtonState(false);
          setDashboardMessage("Current admin account deleted. Please login again.", "success");
        } else {
          setDashboardMessage(result.message, "success");
        }

        await loadDashboard();
      } catch (error) {
        setDashboardMessage(error.message, "error");
        button.disabled = false;
      }
    });
  });
}

function markerColor(status) {
  if (status === "Resolved") return "#49d98f";
  if (status === "In Progress") return "#ffb84d";
  if (status === "Escalated" || status === "Needs Review") return "#ff6b7a";
  return "#ff6b7a";
}

function renderMap(complaints) {
  if (!complaintsMapCanvas || !mapComplaintList) {
    return;
  }

  const mappedComplaints = (complaints || []).filter(
    (complaint) =>
      Number.isFinite(Number(complaint?.mapLocation?.lat)) &&
      Number.isFinite(Number(complaint?.mapLocation?.lng))
  );
  const sortedComplaints = [...mappedComplaints].sort((left, right) => {
    const priorityDelta = priorityRank(right.priority) - priorityRank(left.priority);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
  });

  mapVisibleCount.textContent = String(sortedComplaints.length);
  mapHotspotLabel.textContent = summarizeHotspot(sortedComplaints);

  const watchList = sortedComplaints.filter((complaint) => complaint.priority === "Critical" || complaint.status === "Escalated");
  mapPriorityWatch.textContent = watchList.length ? pluralize(watchList.length, "critical case") : "No critical cluster";

  if (!sortedComplaints.length) {
    complaintsMapCanvas.innerHTML = `
      <div class="map-empty-state">
        <div>
          <strong>No mapped complaints yet.</strong>
          <p>Complaints with resolved coordinates will appear here as soon as they are available.</p>
        </div>
      </div>
    `;
    mapComplaintList.innerHTML = `<div class="table-row empty-state"><span>No mapped complaints available in the current result set.</span></div>`;
    return;
  }

  const latitudes = sortedComplaints.map((complaint) => Number(complaint.mapLocation.lat));
  const longitudes = sortedComplaints.map((complaint) => Number(complaint.mapLocation.lng));
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latSpan = Math.max(maxLat - minLat, 0.02);
  const lngSpan = Math.max(maxLng - minLng, 0.02);
  const hotspotGroups = {};

  complaintsMapCanvas.innerHTML = sortedComplaints
    .map((complaint, index) => {
      const lat = Number(complaint.mapLocation.lat);
      const lng = Number(complaint.mapLocation.lng);
      const x = 10 + ((lng - minLng) / lngSpan) * 80;
      const y = 12 + (1 - (lat - minLat) / latSpan) * 74;
      const hotspotKey = String(complaint.location || "Unknown").trim() || "Unknown";
      hotspotGroups[hotspotKey] = hotspotGroups[hotspotKey] || { x, y, count: 0 };
      hotspotGroups[hotspotKey].count += 1;

      return `
        <button
          type="button"
          class="map-marker"
          data-map-complaint-id="${complaint._id}"
          data-map-location="${escapeHtml(complaint.location || "Unknown")}"
          style="left:${x}%; top:${y}%; color:${markerColor(complaint.status)}; background:${markerColor(complaint.status)};"
          aria-label="${escapeHtml(complaint.type)} at ${escapeHtml(complaint.location)}"
          title="${escapeHtml(complaint.type)} · ${escapeHtml(complaint.location)}"
        ></button>
      `;
    })
    .join("");

  Object.entries(hotspotGroups)
    .filter(([, group]) => group.count > 1)
    .forEach(([label, group]) => {
      complaintsMapCanvas.insertAdjacentHTML(
        "beforeend",
        `<div class="map-cluster-label" style="left:${group.x}%; top:${Math.max(8, group.y - 8)}%;">${escapeHtml(label)} · ${group.count}</div>`
      );
    });

  mapComplaintList.innerHTML = sortedComplaints
    .slice(0, 6)
    .map(
      (complaint) => `
        <article class="map-complaint-item">
          <div class="issue-card-head">
            <strong>${escapeHtml(complaint.type)}</strong>
            <span class="status-pill" data-status="${escapeHtml(complaint.status)}">${escapeHtml(complaint.status)}</span>
          </div>
          <p>${escapeHtml(complaint.location)}</p>
          <div class="issue-meta">
            ${severityBadge(complaint.priority)}
            ${confidenceBadge(complaint)}
          </div>
          <button type="button" class="secondary-button map-open-btn" data-complaint-id="${complaint._id}">Open case</button>
        </article>
      `
    )
    .join("");

  const focusComplaint = (complaintId) => {
    const selectedComplaint = sortedComplaints.find((complaint) => complaint._id === complaintId);
    if (!selectedComplaint) {
      return;
    }

    complaintsMapCanvas.querySelectorAll(".map-marker").forEach((marker) => {
      marker.classList.toggle("is-active", marker.dataset.mapComplaintId === complaintId);
    });
    updateLiveLocationMap(
      selectedComplaint.location || "Selected complaint location",
      selectedComplaint.mapLocation ? `${selectedComplaint.mapLocation.lat}, ${selectedComplaint.mapLocation.lng}` : selectedComplaint.location
    );
    liveLocationStatus.textContent = `${selectedComplaint.type} · ${selectedComplaint.location} · ${selectedComplaint.status}`;
  };

  complaintsMapCanvas.querySelectorAll(".map-marker").forEach((marker) => {
    marker.addEventListener("mouseenter", () => {
      focusComplaint(marker.dataset.mapComplaintId);
    });
    marker.addEventListener("click", () => {
      focusComplaint(marker.dataset.mapComplaintId);
      openComplaintDetail(marker.dataset.mapComplaintId);
    });
  });

  mapComplaintList.querySelectorAll(".map-open-btn").forEach((button) => {
    button.addEventListener("click", () => {
      focusComplaint(button.dataset.complaintId);
      openComplaintDetail(button.dataset.complaintId);
    });
  });

  focusComplaint(sortedComplaints[0]._id);
}

function updateVoiceTranscriptValue(finalText, interimText = "") {
  const transcript = [finalText.trim(), interimText.trim()].filter(Boolean).join(" ").trim();
  voiceTranscriptInput.value = transcript;
  window.dispatchEvent(
    new CustomEvent("smart-community:voice-transcript", {
      detail: { transcript }
    })
  );
}

function extractBase64Payload(dataUrl) {
  const value = String(dataUrl || "");
  const commaIndex = value.indexOf(",");
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

function toReadableTranscriptionError(error) {
  const message = String(error?.message || "").trim();

  if (!message) {
    return "Audio transcription failed. Type the complaint summary manually.";
  }

  if (/failed to fetch/i.test(message)) {
    return "Transcription could not reach the service. Check internet access and your Deepgram configuration.";
  }

  return message;
}

function combineTranscriptionErrors(primaryError, fallbackError) {
  const primary = toReadableTranscriptionError(primaryError);
  const fallback = toReadableTranscriptionError(fallbackError);

  if (primary && fallback && primary !== fallback) {
    return `${primary} Browser fallback also failed: ${fallback}`;
  }

  return primary || fallback || "Audio transcription failed. Type the complaint summary manually.";
}

function getSupportedRecordingMimeType() {
  if (!window.MediaRecorder) {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4"
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function getRecordingExtension(mimeType) {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}

function stopVoiceRecorderStream() {
  if (voiceRecorderStream) {
    voiceRecorderStream.getTracks().forEach((track) => track.stop());
    voiceRecorderStream = null;
  }
}

function updateVoiceRecordingUi() {
  const hasAudio = Boolean(currentVoiceAudioData?.dataUrl);
  const isVoiceMode = complaintInputMode.value === "voice";

  startRecordingBtn.disabled = !isVoiceMode || isVoiceRecording;
  stopRecordingBtn.disabled = !isVoiceMode || !isVoiceRecording;
  clearRecordingBtn.disabled = !isVoiceMode || isVoiceRecording || !hasAudio;
  recordingIndicator.hidden = !isVoiceRecording;
  recordingIndicator.dataset.state = isVoiceRecording ? "live" : "idle";
}

function clearVoiceAudioSelection() {
  if (voiceMediaRecorder && voiceMediaRecorder.state !== "inactive") {
    try {
      voiceMediaRecorder.stop();
    } catch (_error) {
      // ignore stop failures during cleanup
    }
  }

  voiceMediaRecorder = null;
  voiceRecordingChunks = [];
  voiceRecordingStartedAt = 0;
  isVoiceRecording = false;
  stopVoiceRecorderStream();

  if (currentVoiceAudioObjectUrl) {
    URL.revokeObjectURL(currentVoiceAudioObjectUrl);
    currentVoiceAudioObjectUrl = null;
  }

  currentVoiceAudioData = null;
  voiceAudioPreview.hidden = true;
  voiceAudioPreview.removeAttribute("src");
  voiceAudioMeta.textContent = "No recording captured yet.";
  updateVoiceRecordingUi();
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to prepare the uploaded file."));
    reader.readAsDataURL(file);
  });
}

async function transcribeVoiceAudio(sourceFile) {
  try {
    if (!currentVoiceAudioData?.dataUrl) {
      throw new Error("No voice recording is available for transcription.");
    }

    voiceTranscriptStatus.textContent = "Sending audio to Deepgram for transcription...";
    const result = await apiRequest("/api/transcribe-audio", {
      method: "POST",
      body: JSON.stringify({
        audioBase64: extractBase64Payload(currentVoiceAudioData.dataUrl),
        filename: currentVoiceAudioData.filename,
        mimeType: currentVoiceAudioData.mimeType
      })
    });

    if (!result.transcript) {
      throw new Error("Deepgram did not return transcript text.");
    }

    updateVoiceTranscriptValue(result.transcript);
    voiceTranscriptStatus.textContent = "Recording transcribed by Deepgram. Review the text before submitting.";
  } catch (serviceError) {
    if (!window.browserAudioTranscriber?.transcribeAudioFile) {
      voiceTranscriptStatus.textContent =
        toReadableTranscriptionError(serviceError);
      return;
    }

    try {
      voiceTranscriptStatus.textContent = "Deepgram is unavailable. Falling back to browser transcription...";
      const browserResult = await window.browserAudioTranscriber.transcribeAudioFile(sourceFile, (statusText) => {
        voiceTranscriptStatus.textContent = statusText;
      });

      if (!browserResult.text) {
        throw new Error("No transcript text was produced. Type the complaint summary manually.");
      }

      updateVoiceTranscriptValue(browserResult.text);
      voiceTranscriptStatus.textContent =
        "Recording transcribed in the browser fallback. Review the text before submitting.";
    } catch (browserError) {
      const finalError = combineTranscriptionErrors(serviceError, browserError);
      voiceTranscriptStatus.textContent = finalError;
      setDashboardMessage(finalError, "error");
    }
  }
}

async function requestRecorderPermission() {
  if (!window.isSecureContext) {
    throw new Error("Microphone recording requires HTTPS or localhost.");
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support microphone recording.");
  }

  return navigator.mediaDevices.getUserMedia({ audio: true });
}

async function startVoiceRecording() {
  if (isVoiceRecording) {
    return;
  }

  if (!window.MediaRecorder) {
    voiceTranscriptStatus.textContent =
      "Live recording is not supported in this browser. Use a supported browser or type the complaint summary manually.";
    return;
  }

  try {
    const mimeType = getSupportedRecordingMimeType();
    voiceTranscriptStatus.textContent = "Requesting microphone permission...";
    voiceRecorderStream = await requestRecorderPermission();
    voiceRecordingChunks = [];
    voiceMediaRecorder = mimeType
      ? new MediaRecorder(voiceRecorderStream, { mimeType })
      : new MediaRecorder(voiceRecorderStream);

    voiceMediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) {
        voiceRecordingChunks.push(event.data);
      }
    });

      voiceMediaRecorder.addEventListener("stop", async () => {
        const finalMimeType = voiceMediaRecorder?.mimeType || mimeType || "audio/webm";
        const blob = new Blob(voiceRecordingChunks, { type: finalMimeType });
        const durationSeconds = voiceRecordingStartedAt
          ? Math.max(1, Math.round((Date.now() - voiceRecordingStartedAt) / 1000))
        : null;

      isVoiceRecording = false;
      stopVoiceRecorderStream();
      updateVoiceRecordingUi();

      if (!blob.size) {
        voiceTranscriptStatus.textContent = "No audio was captured. Record again and speak clearly.";
        voiceAudioMeta.textContent = "No recording captured yet.";
        return;
      }

      clearVoiceAudioSelection();
      const filename = `voice-complaint-${Date.now()}.${getRecordingExtension(finalMimeType)}`;
      const recordingFile = new File([blob], filename, { type: finalMimeType });

      currentVoiceAudioObjectUrl = URL.createObjectURL(blob);
      voiceAudioPreview.src = currentVoiceAudioObjectUrl;
      voiceAudioPreview.hidden = false;
      currentVoiceAudioData = {
        filename,
        mimeType: finalMimeType,
        dataUrl: await readFileAsDataUrl(recordingFile)
        };
        voiceAudioMeta.textContent = `${filename} - ${durationSeconds || 1}s - ${Math.max(1, Math.round(blob.size / 1024))} KB`;
        voiceTranscriptStatus.textContent = "Recording captured. Transcribing now...";
        updateVoiceRecordingUi();
        window.dispatchEvent(
          new CustomEvent("smart-community:voice-state", {
            detail: { state: "processing" }
          })
        );
        await transcribeVoiceAudio(recordingFile);
      });

      voiceRecordingStartedAt = Date.now();
      isVoiceRecording = true;
      updateVoiceRecordingUi();
      window.dispatchEvent(
        new CustomEvent("smart-community:voice-state", {
          detail: { state: "listening" }
        })
      );
      voiceMediaRecorder.start();
      voiceTranscriptStatus.textContent = "Recording in progress. Speak your complaint, then press Stop Recording.";
    } catch (error) {
      isVoiceRecording = false;
      stopVoiceRecorderStream();
      updateVoiceRecordingUi();
      window.dispatchEvent(
        new CustomEvent("smart-community:voice-state", {
          detail: { state: "error", message: error?.message || "Unable to start live recording." }
        })
      );
      voiceTranscriptStatus.textContent =
        error?.name === "NotAllowedError"
          ? "Microphone access is blocked. Allow microphone access and try recording again."
          : error?.message || "Unable to start live recording. Check microphone access and try again.";
  }
}

  function stopVoiceRecording() {
    if (!voiceMediaRecorder || voiceMediaRecorder.state === "inactive") {
      return;
    }

    voiceTranscriptStatus.textContent = "Stopping recording and preparing transcription...";
    window.dispatchEvent(
      new CustomEvent("smart-community:voice-state", {
        detail: { state: "processing" }
      })
    );
    voiceMediaRecorder.stop();
  }

function setComplaintInputMode(mode) {
  const isVoiceMode = mode === "voice";

  typedComplaintField.hidden = isVoiceMode;
  typedComplaintField.style.display = isVoiceMode ? "none" : "";
  typedComplaintInput.disabled = isVoiceMode;
  voiceComplaintField.hidden = !isVoiceMode;
  voiceComplaintField.style.display = isVoiceMode ? "" : "none";
  voiceTranscriptInput.disabled = !isVoiceMode;
  updateVoiceRecordingUi();

  if (isVoiceMode) {
    if (!voiceTranscriptInput.value.trim()) {
      voiceTranscriptStatus.textContent = currentVoiceAudioData?.dataUrl
        ? "Recording captured. Review the transcript or record again."
        : "Record your complaint and the transcript will appear here automatically.";
    } else {
      voiceTranscriptStatus.textContent = currentVoiceAudioData?.dataUrl
        ? "Recording captured. Review the transcript and submit when ready."
        : "Voice complaint summary ready. You can submit now or record again.";
    }
    return;
  }

  voiceTranscriptStatus.textContent = "Select Voice transcript to record your complaint live.";
}

function getComplaintTextPayload() {
  const mode = complaintInputMode.value;
  const complaintText = mode === "voice" ? voiceTranscriptInput.value.trim() : typedComplaintInput.value.trim();

  if (!complaintText) {
    throw new Error(
      mode === "voice"
        ? "Type the voice complaint summary before submitting."
        : "Enter the complaint text before submitting."
    );
  }

  return {
    complaintInputMode: mode,
    complaintText
  };
}

function setupComplaintInputMode() {
  complaintInputMode.addEventListener("change", (event) => {
    setComplaintInputMode(event.target.value);
  });

  startRecordingBtn?.addEventListener("click", startVoiceRecording);
  stopRecordingBtn?.addEventListener("click", stopVoiceRecording);
  clearRecordingBtn?.addEventListener("click", () => {
    clearVoiceAudioSelection();
    updateVoiceTranscriptValue("");
    voiceTranscriptStatus.textContent = "Recording cleared. Record your complaint again to generate a new transcript.";
  });
  voiceTranscriptInput.addEventListener("input", () => {
    if (complaintInputMode.value !== "voice") {
      return;
    }

    const hasTranscript = Boolean(voiceTranscriptInput.value.trim());
    voiceTranscriptStatus.textContent = hasTranscript
      ? currentVoiceAudioData?.dataUrl
        ? "Recording captured. Review the transcript and submit when ready."
        : "Voice complaint summary ready. You can submit now or record again."
      : currentVoiceAudioData?.dataUrl
        ? "Recording captured. Speak again or edit the summary manually before submitting."
        : "Record your complaint and the transcript will appear here automatically.";
  });
}

function renderLoggedOutState() {
  renderMetrics({ totalComplaints: 0, openComplaints: 0 });
  renderAdminInsights([]);
  renderDigitalTwin(null);
  renderIncidentCommands([]);
  document.getElementById("recentComplaints").innerHTML = `<div class="table-row empty-state"><span>Login to view recent complaints.</span></div>`;
  document.getElementById("complaintsList").innerHTML = `<div class="table-row empty-state"><span>Login to view your complaint history.</span></div>`;
  document.getElementById("adminTable").innerHTML = `<div class="table-row empty-state"><span>Login as Admin to access the command center.</span></div>`;
  alertsList.innerHTML = `<div class="table-row"><span>Login as Admin to manage alerts.</span></div>`;
  userManagementList.innerHTML = `<div class="table-row"><span>Login as Admin to manage accounts.</span></div>`;
  if (mapComplaintList) {
    mapComplaintList.innerHTML = `<div class="table-row empty-state"><span>Login to inspect the operations map.</span></div>`;
  }
  if (complaintsMapCanvas) {
    complaintsMapCanvas.innerHTML = `<div class="map-empty-state"><div><strong>Operations map locked.</strong><p>Login to render complaint markers and hotspot clusters.</p></div></div>`;
  }
  if (mapVisibleCount) {
    mapVisibleCount.textContent = "0";
  }
  if (mapHotspotLabel) {
    mapHotspotLabel.textContent = "No area selected";
  }
  if (mapPriorityWatch) {
    mapPriorityWatch.textContent = "No critical cluster";
  }
}

function renderDashboardLoadingState() {
  const skeleton = `<div class="skeleton-card"></div>`;
  document.getElementById("recentComplaints").innerHTML = `${skeleton}${skeleton}`;
  document.getElementById("complaintsList").innerHTML = `${skeleton}${skeleton}${skeleton}`;
  document.getElementById("adminTable").innerHTML = `${skeleton}${skeleton}`;
  const digitalTwinPanel = document.getElementById("digitalTwinPanel");
  const incidentCommandPanel = document.getElementById("incidentCommandPanel");
  if (digitalTwinPanel) {
    digitalTwinPanel.innerHTML = `${skeleton}${skeleton}`;
  }
  if (incidentCommandPanel) {
    incidentCommandPanel.innerHTML = `${skeleton}${skeleton}`;
  }
  alertsList.innerHTML = `${skeleton}${skeleton}`;
  userManagementList.innerHTML = `${skeleton}${skeleton}`;
  if (mapComplaintList) {
    mapComplaintList.innerHTML = `${skeleton}${skeleton}`;
  }
  if (complaintsMapCanvas) {
    complaintsMapCanvas.innerHTML = `<div class="map-empty-state"><div><strong>Loading markers...</strong><p>Preparing the visible complaint map for the current dashboard filters.</p></div></div>`;
  }
}

function rerenderDashboardViews() {
  renderComplaints(dashboardDataCache.complaints || []);
  renderAlerts(dashboardDataCache.complaints || []);
  renderUserManagement(dashboardDataCache.users || []);
  renderDigitalTwin(dashboardDataCache.digitalTwin || null);
  renderIncidentCommands(dashboardDataCache.incidentCommands || []);
}

function setupDashboardFilters() {
  const rerender = () => rerenderDashboardViews();
  const reload = () => scheduleDashboardReload();

  complaintSearchInput?.addEventListener("input", reload);
  complaintStatusFilter?.addEventListener("change", reload);
  complaintSortSelect?.addEventListener("change", reload);
  clearComplaintFiltersBtn?.addEventListener("click", () => {
    complaintSearchInput.value = "";
    complaintStatusFilter.value = "";
    complaintSortSelect.value = "newest";
    reload();
  });

  alertSearchInput?.addEventListener("input", reload);
  alertPriorityFilter?.addEventListener("change", reload);
  clearAlertFiltersBtn?.addEventListener("click", () => {
    alertSearchInput.value = "";
    alertPriorityFilter.value = "";
    reload();
  });

  userSearchInput?.addEventListener("input", reload);
  userStateFilter?.addEventListener("change", reload);
  clearUserFiltersBtn?.addEventListener("click", () => {
    userSearchInput.value = "";
    userStateFilter.value = "";
    reload();
  });

  window.addEventListener("smart-community:auth-changed", rerender);
}

function setupDraftAutosave() {
  [reportLocationInput, complaintInputMode, typedComplaintInput, voiceTranscriptInput].forEach((element) => {
    element?.addEventListener("input", scheduleDraftSave);
    element?.addEventListener("change", scheduleDraftSave);
  });

  clearDraftBtn?.addEventListener("click", () => {
    resetComposer();
    clearReportDraft();
  });
}

async function loadDashboard() {
  if (!authState?.token) {
    setDashboardMessage("Login or register to continue as Citizen or Admin.");
    renderPermissions([]);
    renderLoggedOutState();
    return;
  }

  renderDashboardLoadingState();
  const query = buildDashboardQueryParams();
  const path = query ? `/api/dashboard?${query}` : "/api/dashboard";
  const data = await apiRequest(path, { method: "GET" });
  dashboardDataCache = {
    complaints: data.complaints || [],
    users: data.manageableUsers || [],
    digitalTwin: data.digitalTwin || null,
    incidentCommands: data.incidentCommands || []
  };
  renderMetrics(data.metrics);
  renderRecentComplaints(data.complaints);
  renderComplaints(data.complaints);
  renderAdminInsights(data.complaints, data.analytics || null);
  renderDigitalTwin(data.digitalTwin || null);
  renderIncidentCommands(data.incidentCommands || []);
  renderAdminTable(data.complaints);
  renderAlerts(data.complaints);
  renderMap(data.complaints);
  renderUserManagement(data.manageableUsers || []);

  if (data.auth) {
    authState = { ...authState, role: data.auth.role, username: data.auth.username, permissions: data.auth.permissions };
    saveAuthState();
    applyPermissionState();
  }
}

function resetComposer() {
  form.reset();
  uploadPreview.hidden = true;
  imagePreview.removeAttribute("src");
  imageName.textContent = "No image selected";
  imageHintText.textContent = "AI visual inspection will appear here after upload.";
  aiImageDescription.value = "";
  aiAccuracyStatus.textContent = "Upload an image to attach visual evidence.";
    currentImageFeatures = null;
    currentImageInsight = null;
  currentImageDataUrl = null;
  currentImageAiPayload = null;
  clearEmailProgressTimer();
  emailProgress.hidden = true;
  emailProgressFill.style.width = "0%";
  emailProgressValue.textContent = "0%";
  emailProgressLabel.textContent = "Preparing complaint email...";
  updateLiveLocationMap("");
  clearVoiceAudioSelection();
  updateVoiceTranscriptValue("");
  setComplaintInputMode(complaintInputMode.value || "text");
  clearReportDraft(false);
  updateDraftStatus("Draft cleared after reset.", "cleared");
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unable to read the uploaded image."));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Unable to load the uploaded file."));
    reader.readAsDataURL(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to prepare the uploaded image for PDF export."));
    reader.readAsDataURL(file);
  });
}

async function prepareImageForAi(file) {
  if (!file) return null;

  const image = await loadImageElement(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const maxSide = 768;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));

  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const mimeType = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
  const quality = mimeType === "image/jpeg" ? 0.78 : undefined;
  const dataUrl = canvas.toDataURL(mimeType, quality);
  const base64 = extractBase64Payload(dataUrl);

  return {
    base64,
    mimeType,
    width: canvas.width,
    height: canvas.height,
    bytes: Math.floor((base64.length * 3) / 4)
  };
}

async function extractImageFeatures(file) {
  if (!file) return null;

  const image = await loadImageElement(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const targetWidth = 96;
  const scale = targetWidth / image.width;

  canvas.width = targetWidth;
  canvas.height = Math.max(1, Math.round(image.height * scale));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  let brightnessSum = 0;
  let saturationSum = 0;
  let redDominantPixels = 0;
  let smokyPixels = 0;
  let darkPixels = 0;
  let greenPixels = 0;
  let bluePixels = 0;
  let hotspotPixels = 0;
  let neutralPixels = 0;
  let edgeScore = 0;
  let brightnessSquaredSum = 0;
  const grayscale = new Float32Array(width * height);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const brightness = (r + g + b) / 3 / 255;
    const saturation = max === 0 ? 0 : (max - min) / max;
    const pixelIndex = i / 4;

    brightnessSum += brightness;
    brightnessSquaredSum += brightness * brightness;
    saturationSum += saturation;
    grayscale[pixelIndex] = brightness;
    if (r > 160 && r > g * 1.15 && g > b) redDominantPixels += 1;
    if (brightness < 0.25) darkPixels += 1;
    if (saturation < 0.18 && brightness > 0.35 && brightness < 0.82) smokyPixels += 1;
    if (g > r * 0.95 && g > b * 1.08 && brightness > 0.25) greenPixels += 1;
    if (b > r * 1.08 && b > g * 0.95 && brightness > 0.25) bluePixels += 1;
    if (brightness > 0.72 && saturation > 0.42 && r > g) hotspotPixels += 1;
    if (saturation < 0.12 && brightness > 0.2 && brightness < 0.85) neutralPixels += 1;
  }

  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const index = y * width + x;
      const dx = Math.abs(grayscale[index] - grayscale[index + 1]);
      const dy = Math.abs(grayscale[index] - grayscale[index + width]);
      edgeScore += dx + dy;
    }
  }

  const pixelCount = width * height;
  const maxEdgeScore = Math.max(1, (width - 1) * (height - 1) * 2);
  const averageBrightness = brightnessSum / pixelCount;
  const brightnessVariance = Math.max(0, brightnessSquaredSum / pixelCount - averageBrightness * averageBrightness);

  return {
    width: image.width,
    height: image.height,
    averageBrightness: Number(averageBrightness.toFixed(3)),
    averageSaturation: Number((saturationSum / pixelCount).toFixed(3)),
    edgeDensity: Number((edgeScore / maxEdgeScore).toFixed(3)),
    redHeatRatio: Number((redDominantPixels / pixelCount).toFixed(3)),
    smokeLikeRatio: Number((smokyPixels / pixelCount).toFixed(3)),
    darkRatio: Number((darkPixels / pixelCount).toFixed(3)),
    greenRatio: Number((greenPixels / pixelCount).toFixed(3)),
    blueRatio: Number((bluePixels / pixelCount).toFixed(3)),
    hotspotRatio: Number((hotspotPixels / pixelCount).toFixed(3)),
    neutralRatio: Number((neutralPixels / pixelCount).toFixed(3)),
    contrast: Number(Math.sqrt(brightnessVariance).toFixed(3))
  };
}

function setupImageUpload() {
  imageFileInput.addEventListener("change", async () => {
    const file = imageFileInput.files[0];
    if (!file) {
      uploadPreview.hidden = true;
      imagePreview.removeAttribute("src");
      aiImageDescription.value = "";
      aiAccuracyStatus.textContent = "Upload an image to attach visual evidence.";
      currentImageFeatures = null;
      currentImageInsight = null;
      currentImageDataUrl = null;
      currentImageAiPayload = null;
      scheduleDraftSave();
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    imagePreview.src = previewUrl;
    imageName.textContent = file.name;
    imageHintText.textContent = `Selected ${file.type || "image"} - ${Math.round(file.size / 1024)} KB`;
    uploadPreview.hidden = false;

    try {
      currentImageDataUrl = await readFileAsDataUrl(file);
      currentImageAiPayload = await prepareImageForAi(file);
      currentImageFeatures = await extractImageFeatures(file);
      currentImageInsight = describeImageFromFeatures(currentImageFeatures);
      aiImageDescription.value = currentImageInsight.description;
      aiAccuracyStatus.textContent = currentImageInsight.accuracy
        ? `Image-only confidence: ${Math.round(currentImageInsight.accuracy * 100)}%. Submit to create the complaint with this visual evidence.`
        : "Image uploaded, but the incident is unclear. Add a short note if possible.";
      scheduleDraftSave();
    } catch (error) {
      currentImageFeatures = null;
      currentImageInsight = null;
      currentImageDataUrl = null;
      currentImageAiPayload = null;
      aiImageDescription.value = "AI could not inspect this image.";
      aiAccuracyStatus.textContent = error.message;
      scheduleDraftSave();
    }
  });
}

showAiAccuracyBtn.addEventListener("click", () => {
  if (!currentImageInsight) {
    aiAccuracyStatus.textContent = "Upload an image first to run image-only detection.";
    return;
  }

  const candidates = currentImageInsight.candidates || [];
  const candidateText = candidates
    .slice(0, 3)
    .map((candidate) => `${candidate.label} (${Math.round(candidate.confidence * 100)}%)`)
    .join(" | ");
  aiAccuracyStatus.textContent = candidateText || "No reliable image-only candidates found.";
});

showLoginBtn.addEventListener("click", () => openAuthOverlay("login"));
showRegisterBtn.addEventListener("click", () => openAuthOverlay("register"));
forgotPasswordBtn?.addEventListener("click", () => openAuthOverlay("reset-password"));
sendOtpBtn?.addEventListener("click", requestActiveOtp);
issueTokenBtn.addEventListener("click", () => openAuthOverlay("login"));
logoutBtn?.addEventListener("click", () => logoutCurrentUser());
openFaqLink?.addEventListener("click", (event) => {
  event.preventDefault();
  openFaqOverlay();
});
closeFaqBtn?.addEventListener("click", closeFaqOverlay);
closePostSubmitBtn?.addEventListener("click", closePostSubmitOverlay);
closeComplaintDetailBtn?.addEventListener("click", closeComplaintDetailOverlay);
modalGeneratePdfBtn?.addEventListener("click", () => generatePdfBtn.click());
modalEmailBbmpBtn?.addEventListener("click", () => emailBbmpBtn.click());
informClosedOnesBtn?.addEventListener("click", () => {
  closeContactsForm.hidden = false;
  closeContactsMessage.textContent = "Add at least one email ID, up to 5.";
  closeContactsForm.querySelector("input")?.focus();
});
cancelCloseContactsBtn?.addEventListener("click", () => {
  closeContactsForm.hidden = true;
  closeContactsForm.reset();
  closeContactsMessage.textContent = "";
});
closeContactsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    if (!lastSubmittedReport) {
      throw new Error("Submit a complaint before informing close contacts.");
    }

    const emails = Array.from(closeContactsForm.querySelectorAll('input[name="contactEmail"]'))
      .map((input) => input.value.trim())
      .filter(Boolean);

    if (!emails.length) {
      throw new Error("Enter at least one email ID.");
    }

    sendCloseContactsBtn.disabled = true;
    closeContactsMessage.textContent = "Sending warning email...";
    const response = await apiRequest("/api/inform-close-contacts", {
      method: "POST",
      body: JSON.stringify({
        emails,
        report: lastSubmittedReport
      })
    });

    closeContactsMessage.textContent = response.message || "Close contacts were informed successfully.";
    setDashboardMessage(closeContactsMessage.textContent, "success");
    closeContactsForm.reset();
  } catch (error) {
    closeContactsMessage.textContent = error.message;
    setDashboardMessage(error.message, "error");
  } finally {
    sendCloseContactsBtn.disabled = false;
  }
});
generatePdfBtn.addEventListener("click", async () => {
  try {
    const result = await generatePdfReport(lastSubmittedReport, { download: true });
    setDashboardMessage(`Complaint report PDF downloaded as ${result.filename}.`, "success");
  } catch (error) {
    setDashboardMessage(error.message, "error");
  }
});
emailBbmpBtn.addEventListener("click", async () => {
  try {
    if (!lastSubmittedReport) {
      throw new Error("Submit a complaint first before preparing the authority email.");
    }

    emailBbmpBtn.disabled = true;
    beginEmailProgress();
    const { blob, filename } = await generatePdfReport(lastSubmittedReport, { download: false });
    setEmailProgress(42, "Generating formal PDF attachment...");
    const pdfBase64 = await blobToBase64(blob);
    setEmailProgress(68, "Encoding report for authority delivery...");

    const response = await apiRequest("/api/email-bbmp", {
      method: "POST",
      body: JSON.stringify({
        subject: (lastSubmittedReport.textComplaint || lastSubmittedReport.issueType || "Complaint report").trim(),
        report: lastSubmittedReport,
        pdfBase64,
        filename
      })
    });

    finishEmailProgress(true);
    setDashboardMessage(response.message || "Complaint email sent to the configured authority successfully.", "success");
  } catch (error) {
    finishEmailProgress(false);
    setDashboardMessage(error.message, "error");
  } finally {
    emailBbmpBtn.disabled = !lastSubmittedReport;
  }
});
audioToggleBtn.addEventListener("click", async () => {
  audioEnabled = !audioEnabled;
  saveAudioPreference();
  updateAudioToggleState();

  if (audioEnabled) {
    await unlockAudio();
    setDashboardMessage("Interface sound enabled.", "success");
  } else {
    stopAmbientLoop();
    setDashboardMessage("Interface sound muted.", "info");
  }
});
reportLocationInput.addEventListener("input", (event) => {
  updateLiveLocationMap(event.target.value);
});
previewLocationBtn.addEventListener("click", showTypedLocationOnMap);
useLiveLocationBtn?.addEventListener("click", useLiveLocation);

document.addEventListener(
  "pointerdown",
  async (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }

    await unlockAudio();
    playButtonSound(button);
  },
  true
);

document.addEventListener(
  "keydown",
  async (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const button = event.target.closest("button");
    if (!button) {
      return;
    }

    await unlockAudio();
    playButtonSound(button);
  },
  true
);

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    authSubmitBtn.disabled = true;
    const formData = new FormData(authForm);
    const payload = Object.fromEntries(formData.entries());

    if (authMode === "register" && !registrationOtpIssued) {
      throw new Error("Send the OTP to your email before completing registration.");
    }

    if (authMode === "reset-password" && !passwordResetOtpIssued) {
      throw new Error("Send the OTP to your email before resetting the password.");
    }

    const endpoint =
      authMode === "login"
        ? "/api/auth/login"
        : authMode === "reset-password"
          ? "/api/auth/password-reset"
          : "/api/auth/register";
    const data = await apiRequest(endpoint, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (authMode === "reset-password") {
      const successMessage = data.message || "Password reset successful. Login with your new password.";
      authMessage.textContent = successMessage;
      setDashboardMessage(successMessage, "success");
      passwordResetOtpIssued = false;
      clearOtpTimer();
      setOtpTimerMessage("");
      sendOtpBtn.textContent = "Send OTP";
      authForm.reset();
      openAuthOverlay("login");
      authMessage.textContent = successMessage;
      return;
    }

    authState = data;
    saveAuthState();
    applyPermissionState();
    resetLoginAttemptState();
    const successMessage = getAuthSuccessMessage(authMode, data);
    authMessage.textContent = successMessage;
    setDashboardMessage(successMessage, "success");
    registrationOtpIssued = false;
    passwordResetOtpIssued = false;
    clearOtpTimer();
    setOtpTimerMessage("");
    sendOtpBtn.textContent = "Send OTP";
    authForm.reset();
    closeAuthOverlay();
    goToMainDashboard();
    await loadDashboard();
  } catch (error) {
    if (authMode === "login") {
      recordClientLoginFailure();
    }
    authMessage.textContent = error.message;
    setDashboardMessage(error.message, "error");
  } finally {
    if (!loginLockTimer) {
      authSubmitBtn.disabled = false;
    }
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    complaintSubmitBtn.disabled = true;
    if (!authState?.token) {
      throw new Error("Login or register before submitting a complaint.");
    }

    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    const imageFile = imageFileInput.files[0];
    const complaintPayload = getComplaintTextPayload();

    payload.textComplaint = complaintPayload.complaintText;
    payload.complaintInputMode = complaintPayload.complaintInputMode;
    payload.iotTriggered = false;
    payload.imageFeatures = currentImageFeatures || (await extractImageFeatures(imageFile));
    const imageAiPayload = currentImageAiPayload || (imageFile ? await prepareImageForAi(imageFile) : null);
    if (imageAiPayload) {
      payload.imageBase64 = imageAiPayload.base64;
      payload.imageMimeType = imageAiPayload.mimeType;
    }
    payload.imageHint = aiImageDescription.value.trim();
    showTypedLocationOnMap();

    const result = await apiRequest("/api/analyze-complaint", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    lastSubmittedReport = buildSubmittedReport(payload, result);
    setPdfButtonState(true);
    resetComposer();
    renderAnalysis(result);
    openPostSubmitOverlay(lastSubmittedReport);
    await loadDashboard();
  } catch (error) {
    setDashboardMessage(error.message, "error");
  } finally {
    complaintSubmitBtn.disabled = !(authState?.permissions || []).includes("submit_complaint");
  }
});

resetDashboardBtn.addEventListener("click", async () => {
  try {
    const confirmed = window.confirm("Are you sure to reset the dashboard?");
    if (!confirmed) {
      return;
    }

    const data = await apiRequest("/api/reset-dashboard", {
      method: "POST",
      body: JSON.stringify({})
    });
    lastSubmittedReport = null;
    setPdfButtonState(false);
    setDashboardMessage(data.message || "Dashboard reset.", "success");
    await loadDashboard();
  } catch (error) {
    setDashboardMessage(error.message, "error");
  }
});

window.smartCommunityApp = {
  apiRequest,
  getAuthState: () => authState,
  getCurrentVoiceTranscript: () => String(voiceTranscriptInput?.value || "").trim(),
  setDashboardMessage
};

loadSavedAuthState();
loadAudioPreference();
setupImageUpload();
setupComplaintInputMode();
setupMobileMenu();
setupRevealAnimations();
setupHeroStorytelling();
setupAppNavigation();
setupGooeyInteractions();
applyPermissionState();
updateAudioToggleState();
setPdfButtonState(false);
resetComposer();
restoreReportDraft();
setupDraftAutosave();
setupDashboardFilters();
if (!authState?.token) {
  openAuthOverlay("login");
}
loadDashboard().catch((error) => {
  setDashboardMessage(error.message, "error");
});
