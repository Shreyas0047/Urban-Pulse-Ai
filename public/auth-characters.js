(() => {
  const overlay = document.getElementById("authOverlay");
  const stage = document.getElementById("authCharacterStage");
  const identityInput = document.getElementById("authIdentity");
  const passwordInput = document.getElementById("authPassword");
  const passwordToggle = document.getElementById("authPasswordToggle");

  if (!overlay || !stage || !identityInput || !passwordInput) {
    return;
  }

  const characters = [...stage.querySelectorAll("[data-auth-character]")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  let frameId = 0;
  let typingTimer = 0;
  let blinkTimer = 0;
  let expressionTimer = 0;
  let expressionResolve = null;

  function setTyping(active) {
    stage.classList.toggle("is-typing", active);
    window.clearTimeout(typingTimer);
    if (active) {
      typingTimer = window.setTimeout(() => setTyping(false), 850);
    }
  }

  function updatePasswordState() {
    const hasPassword = passwordInput.value.length > 0;
    const passwordVisible = passwordInput.type === "text";
    stage.classList.toggle("has-password", hasPassword);
    stage.classList.toggle("is-password-visible", hasPassword && passwordVisible);
  }

  function updateCharacters() {
    frameId = 0;
    if (overlay.hidden || reducedMotion.matches) {
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const normalizedX = Math.max(-1, Math.min(1, (pointerX - (stageRect.left + stageRect.width / 2)) / (stageRect.width / 2)));
    const normalizedY = Math.max(-1, Math.min(1, (pointerY - (stageRect.top + stageRect.height / 2)) / (stageRect.height / 2)));

    characters.forEach((character, index) => {
      const lookX = Number(character.dataset.lookX || 10);
      const lookY = Number(character.dataset.lookY || 7);
      character.style.setProperty("--face-x", `${normalizedX * lookX}px`);
      character.style.setProperty("--face-y", `${normalizedY * lookY}px`);
      character.style.setProperty("--lean", `${normalizedX * (index % 2 ? -2.5 : 2.5)}deg`);
      character.querySelectorAll(".character-pupil").forEach((pupil) => {
        pupil.style.setProperty("--pupil-x", `${normalizedX * 3.5}px`);
        pupil.style.setProperty("--pupil-y", `${normalizedY * 3}px`);
      });
    });
  }

  function requestCharacterUpdate(event) {
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!frameId) {
      frameId = window.requestAnimationFrame(updateCharacters);
    }
  }

  function scheduleBlink() {
    window.clearTimeout(blinkTimer);
    blinkTimer = window.setTimeout(() => {
      if (!overlay.hidden && !reducedMotion.matches && characters.length) {
        const character = characters[Math.floor(Math.random() * characters.length)];
        character.classList.add("is-blinking");
        window.setTimeout(() => character.classList.remove("is-blinking"), 150);
      }
      scheduleBlink();
    }, 2200 + Math.random() * 3200);
  }

  function togglePasswordVisibility() {
    const showPassword = passwordInput.type === "password";
    passwordInput.type = showPassword ? "text" : "password";
    passwordToggle.setAttribute("aria-pressed", String(showPassword));
    passwordToggle.setAttribute("aria-label", showPassword ? "Hide password" : "Show password");
    passwordToggle.classList.toggle("is-visible", showPassword);
    updatePasswordState();
    passwordInput.focus();
  }

  function resetPasswordVisibility() {
    passwordInput.type = "password";
    passwordToggle?.setAttribute("aria-pressed", "false");
    passwordToggle?.setAttribute("aria-label", "Show password");
    passwordToggle?.classList.remove("is-visible");
    updatePasswordState();
  }

  function resetExpression() {
    window.clearTimeout(expressionTimer);
    expressionTimer = 0;
    stage.classList.remove("is-celebrating", "is-angry");
    if (expressionResolve) {
      expressionResolve();
      expressionResolve = null;
    }
  }

  function celebrate(duration = 2000) {
    resetExpression();
    if (reducedMotion.matches) {
      return Promise.resolve();
    }

    stage.classList.add("is-celebrating");
    return new Promise((resolve) => {
      expressionResolve = resolve;
      expressionTimer = window.setTimeout(() => {
        stage.classList.remove("is-celebrating");
        expressionTimer = 0;
        expressionResolve = null;
        resolve();
      }, duration);
    });
  }

  function getAngry(duration = 1300) {
    resetExpression();
    if (reducedMotion.matches) {
      return;
    }

    stage.classList.add("is-angry");
    expressionTimer = window.setTimeout(() => {
      stage.classList.remove("is-angry");
    }, duration);
  }

  [identityInput, passwordInput].forEach((input) => {
    input.addEventListener("focus", () => setTyping(true));
    input.addEventListener("input", () => {
      setTyping(true);
      updatePasswordState();
    });
  });

  passwordToggle?.addEventListener("click", togglePasswordVisibility);
  window.addEventListener("pointermove", requestCharacterUpdate, { passive: true });
  reducedMotion.addEventListener?.("change", updateCharacters);

  const observer = new MutationObserver(() => {
    if (!overlay.hidden) {
      window.requestAnimationFrame(updateCharacters);
    }
  });
  observer.observe(overlay, { attributes: true, attributeFilter: ["hidden"] });

  updatePasswordState();
  scheduleBlink();

  window.UrbanPulseAuthCharacters = {
    reset() {
      resetExpression();
      resetPasswordVisibility();
    },
    celebrate,
    angry: getAngry
  };
})();
