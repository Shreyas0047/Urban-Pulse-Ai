(function () {
  const launcher = document.getElementById("chatbotLauncher");
  const panel = document.getElementById("chatbotPanel");
  const header = document.getElementById("chatbotHeader");
  const closeBtn = document.getElementById("chatbotCloseBtn");
  const clearBtn = document.getElementById("chatbotClearBtn");
  const messagesRoot = document.getElementById("chatbotMessages");
  const typingRoot = document.getElementById("chatbotTyping");
  const form = document.getElementById("chatbotForm");
  const input = document.getElementById("chatbotInput");
  const sendBtn = document.getElementById("chatbotSendBtn");
  const useTranscriptBtn = document.getElementById("chatbotUseTranscriptBtn");
  const statusText = document.getElementById("chatbotStatusText");
  const charCountRoot = document.getElementById("chatbotCharCount");

  if (!launcher || !panel || !form || !input) {
    return;
  }

  const position = {
    x: window.innerWidth - 88,
    y: window.innerHeight - 88
  };
  const animationDurationMs = 300;
  const maxMessageLength = Number(input.maxLength || 1000);

  let isOpen = false;
  let isAnimating = false;
  let dragState = null;
  let suppressNextClick = false;
  let isLoading = false;
  let historyLoadedForUser = "";

  function getApp() {
    return window.smartCommunityApp || null;
  }

  function getAuthState() {
    return getApp()?.getAuthState?.() || null;
  }

  function getTranscript() {
    return getApp()?.getCurrentVoiceTranscript?.() || "";
  }

  function setDashboardMessage(message, type) {
    getApp()?.setDashboardMessage?.(message, type);
  }

  function clampPosition() {
    const launcherWidth = launcher.offsetWidth || 64;
    const launcherHeight = launcher.offsetHeight || 64;
    position.x = Math.max(16, Math.min(position.x, window.innerWidth - launcherWidth - 16));
    position.y = Math.max(16, Math.min(position.y, window.innerHeight - launcherHeight - 16));
  }

  function updateLauncherPosition() {
    clampPosition();
    launcher.style.left = `${position.x}px`;
    launcher.style.top = `${position.y}px`;
    updatePanelPosition();
  }

  function updatePanelPosition() {
    const panelWidth = panel.offsetWidth || Math.min(500, window.innerWidth - 32);
    const panelHeight = panel.offsetHeight || Math.min(640, window.innerHeight - 32);
    const launcherWidth = launcher.offsetWidth || 64;
    const left = Math.max(16, Math.min(position.x - panelWidth + launcherWidth, window.innerWidth - panelWidth - 16));
    const top = Math.max(16, Math.min(position.y - panelHeight - 18, window.innerHeight - panelHeight - 16));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function renderMessage(message) {
    const bubble = document.createElement("article");
    bubble.className = `chatbot-bubble ${message.sender === "user" ? "is-user" : "is-bot"}`;
    bubble.textContent = message.content;
    messagesRoot.appendChild(bubble);
    messagesRoot.scrollTop = messagesRoot.scrollHeight;
  }

  function renderMessages(messages) {
    messagesRoot.innerHTML = "";
    if (!messages.length) {
      renderMessage({
        sender: "bot",
        content: "Ask about complaint status, raise a complaint, get FAQs, or ask where something is in the dashboard."
      });
      return;
    }

    messages.forEach(renderMessage);
  }

  function setTyping(isTyping) {
    typingRoot.hidden = !isTyping;
  }

  function setLoading(isLoading) {
    window.requestAnimationFrame(() => {
      sendBtn.disabled = isLoading || !input.value.trim();
    });
    input.disabled = isLoading;
    clearBtn.disabled = isLoading;
    useTranscriptBtn.disabled = isLoading || !getTranscript();
    setTyping(isLoading);
  }

  function updateComposerState() {
    const length = input.value.length;
    charCountRoot.textContent = `${length}/${maxMessageLength}`;
    charCountRoot.dataset.nearLimit = length >= maxMessageLength * 0.9 ? "true" : "false";
    sendBtn.disabled = isLoading || !input.value.trim();
  }

  function updateTranscriptButton() {
    useTranscriptBtn.disabled = !getTranscript();
  }

  async function loadHistory() {
    const auth = getAuthState();

    if (!auth?.token || !auth?.userId) {
      launcher.hidden = true;
      panel.classList.remove("is-open");
      panel.hidden = true;
      isOpen = false;
      historyLoadedForUser = "";
      return;
    }

    launcher.hidden = false;
    updateTranscriptButton();

    if (historyLoadedForUser === auth.userId) {
      return;
    }

    try {
      const data = await getApp().apiRequest(`/api/chatbot/history?userId=${encodeURIComponent(auth.userId)}`, {
        method: "GET"
      });
      renderMessages(data.messages || []);
      historyLoadedForUser = auth.userId;
    } catch (error) {
      renderMessages([]);
      statusText.textContent = error.message;
    }
  }

  async function postMessage(message) {
    const auth = getAuthState();
    if (!auth?.token || !auth?.userId) {
      throw new Error("Login is required before using the assistant.");
    }

    return getApp().apiRequest("/api/chatbot/message", {
      method: "POST",
      body: JSON.stringify({
        userId: auth.userId,
        message,
        voiceTranscript: getTranscript()
      })
    });
  }

  async function clearHistory() {
    const auth = getAuthState();
    if (!auth?.token || !auth?.userId) {
      throw new Error("Login is required before clearing chat history.");
    }

    return getApp().apiRequest("/api/chatbot/history", {
      method: "DELETE",
      body: JSON.stringify({
        userId: auth.userId
      })
    });
  }

  function openPanel() {
    if (isAnimating || isOpen) {
      return;
    }

    isAnimating = true;
    isOpen = true;
    launcher.setAttribute("aria-expanded", "true");
    launcher.setAttribute("aria-label", "Close Urban Pulse Assistant");
    panel.hidden = false;
    updatePanelPosition();
    updateTranscriptButton();

    requestAnimationFrame(() => {
      panel.classList.add("is-open");
      window.setTimeout(() => {
        isAnimating = false;
        input.focus();
      }, animationDurationMs);
    });
  }

  function closePanel() {
    if (isAnimating || !isOpen) {
      return;
    }

    isAnimating = true;
    isOpen = false;
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Open Urban Pulse Assistant");
    panel.classList.remove("is-open");
    window.setTimeout(() => {
      panel.hidden = true;
      isAnimating = false;
    }, animationDurationMs);
  }

  launcher.addEventListener("click", async (event) => {
    if (suppressNextClick) {
      suppressNextClick = false;
      event.preventDefault();
      return;
    }

    if (isOpen) {
      closePanel();
      return;
    }

    await loadHistory();
    openPanel();
  });

  closeBtn.addEventListener("click", closePanel);

  clearBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      clearBtn.disabled = true;
      const result = await clearHistory();
      renderMessages(result.messages || []);
      statusText.textContent = "Chat history cleared.";
      setDashboardMessage("Chat history cleared.", "success");
    } catch (error) {
      statusText.textContent = error.message || "Could not clear chat history.";
    } finally {
      clearBtn.disabled = false;
    }
  });

  launcher.addEventListener("pointerdown", (event) => {
    dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - position.x,
      offsetY: event.clientY - position.y,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
    launcher.setPointerCapture(event.pointerId);
  });

  launcher.addEventListener("pointermove", (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    position.x = event.clientX - dragState.offsetX;
    position.y = event.clientY - dragState.offsetY;
    if (Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) > 5) {
      dragState.moved = true;
    }
    updateLauncherPosition();
  });

  function clearDrag(event) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    launcher.releasePointerCapture(event.pointerId);
    suppressNextClick = dragState.moved;
    dragState = null;
  }

  launcher.addEventListener("pointerup", clearDrag);
  launcher.addEventListener("pointercancel", clearDrag);
  window.addEventListener("resize", updateLauncherPosition);
  header.addEventListener("pointerdown", (event) => event.stopPropagation());

  useTranscriptBtn.addEventListener("click", () => {
    const transcript = getTranscript();
    if (!transcript) {
      return;
    }
    input.value = transcript;
    updateComposerState();
    input.focus();
  });

  input.addEventListener("input", updateComposerState);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!sendBtn.disabled) {
        form.requestSubmit();
      }
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!isOpen || panel.contains(event.target) || launcher.contains(event.target)) {
      return;
    }
    closePanel();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen) {
      closePanel();
      launcher.focus();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = String(input.value || "").trim();

    if (!message) {
      return;
    }

    renderMessage({ sender: "user", content: message });
    input.value = "";
    updateComposerState();
    isLoading = true;
    setLoading(true);

    try {
      const result = await postMessage(message);
      renderMessages(result.messages || []);
      statusText.textContent = result.intent === "raise_complaint"
        ? "Complaint assistant active."
        : "Ask about status, complaints, FAQs, or navigation.";

      if (result.meta?.complaintCreated) {
        setDashboardMessage("Complaint created from chatbot.", "success");
      }
    } catch (error) {
      renderMessage({ sender: "bot", content: error.message || "The assistant could not respond right now." });
      statusText.textContent = error.message || "The assistant could not respond right now.";
    } finally {
      isLoading = false;
      setLoading(false);
      updateComposerState();
    }
  });

  window.addEventListener("smart-community:auth-changed", () => {
    loadHistory().catch(() => {});
  });

  window.addEventListener("smart-community:voice-transcript", () => {
    updateTranscriptButton();
  });

  updateLauncherPosition();
  updateTranscriptButton();
  updateComposerState();
  loadHistory().catch(() => {});
})();
