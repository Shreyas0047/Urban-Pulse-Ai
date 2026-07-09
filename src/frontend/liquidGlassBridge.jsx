import React, { useRef } from "react";
import { createRoot } from "react-dom/client";
import LiquidGlass from "liquid-glass-react";

const roots = new Map();

const presets = {
  authentication: {
    displacementScale: 54,
    blurAmount: 0.12,
    saturation: 125,
    aberrationIntensity: 1.6,
    elasticity: 0.12,
    cornerRadius: 32,
    mode: "standard"
  }
};

function NavigationGlass() {
  return (
    <>
      <span className="navigation-glass-shadow" aria-hidden="true" />
      <span className="navigation-glass-refraction" aria-hidden="true" />
      <svg className="navigation-glass-filter" aria-hidden="true">
        <defs>
          <filter
            id="navigation-container-glass"
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.05 0.05"
              numOctaves="1"
              seed="1"
              result="turbulence"
            />
            <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="blurredNoise"
              scale="70"
              xChannelSelector="R"
              yChannelSelector="B"
              result="displaced"
            />
            <feGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
            <feComposite in="finalBlur" in2="finalBlur" operator="over" />
          </filter>
        </defs>
      </svg>
    </>
  );
}

function GlassSurface({ target, preset }) {
  const mouseContainer = useRef(target);
  const config = presets[preset] || presets.navigation;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <LiquidGlass
      {...config}
      elasticity={reduceMotion ? 0 : config.elasticity}
      mouseContainer={mouseContainer}
      padding="0"
      className="react-liquid-glass-layer"
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: "100%",
        height: "100%",
        pointerEvents: "none"
      }}
    >
      <span className="react-liquid-glass-fill" aria-hidden="true" />
    </LiquidGlass>
  );
}

function mountSurface(target) {
  if (
    roots.has(target) ||
    target.closest("[hidden]") ||
    target.offsetWidth === 0 ||
    target.offsetHeight === 0
  ) {
    return;
  }

  const mount = document.createElement("div");
  mount.className = "react-liquid-glass-mount";
  mount.setAttribute("aria-hidden", "true");
  target.prepend(mount);

  const root = createRoot(mount);
  root.render(
    target.dataset.reactLiquidGlass === "navigation"
      ? <NavigationGlass />
      : <GlassSurface target={target} preset={target.dataset.reactLiquidGlass} />
  );
  roots.set(target, root);
  target.dataset.reactLiquidGlassMounted = "true";
}

function scan() {
  document.querySelectorAll("[data-react-liquid-glass]").forEach(mountSurface);
}

const observer = new MutationObserver(() => {
  window.requestAnimationFrame(scan);
});

observer.observe(document.documentElement, {
  attributes: true,
  childList: true,
  subtree: true,
  attributeFilter: ["hidden"]
});

window.addEventListener("resize", scan);
window.addEventListener("DOMContentLoaded", scan, { once: true });
window.requestAnimationFrame(scan);

window.UrbanPulseLiquidGlass = {
  refresh: scan,
  mountedCount: () => roots.size
};
