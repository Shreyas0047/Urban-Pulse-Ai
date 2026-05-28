try {
  const hasSessionIntro =
    window.sessionStorage?.getItem("smart-community-intro-seen") === "true" ||
    String(window.name || "").includes("smart-community-intro-seen=true");

  if (!hasSessionIntro) {
    document.documentElement.classList.add("intro-session-pending");
  }
} catch (_error) {
  document.documentElement.classList.add("intro-session-pending");
}
