import { MOD } from "../core/constants.js";

export type ThemeName = "light" | "dark";

export const getTheme = (): ThemeName => {
  try { return (game.settings.get(MOD, "bsrTheme") as ThemeName) || "light"; }
  catch { return "light"; }
};

export const getThemeStyles = (theme: ThemeName): string => {
  if (theme === "light") {
    return `
      .bsr-theme {
        --bsr-bg: var(--color-bg-option, #f0f0e0);
        --bsr-text: var(--color-text-dark-primary, #191813);
        --bsr-text-muted: var(--color-text-dark-secondary, #4b4a44);
        --bsr-border: #b5b5a6;
        --bsr-card-header-bg: rgba(0,0,0,0.035);
        --bsr-input-bg: #fff;
        --bsr-input-border: #999;
        --bsr-btn-bg: #e4e4d6;
        --bsr-btn-hover-bg: #d5d5c5;
        --bsr-btn-primary-bg: #5e81ac;
        --bsr-btn-primary-color: #fff;
        --bsr-btn-primary-border: #4c6c91;
        --bsr-btn-primary-hover-bg: #4c6c91;
        background: var(--bsr-bg) !important;
      }
      .bsr-theme .window-content {
        background: var(--bsr-bg) !important;
        color: var(--bsr-text) !important;
        overflow: auto;
        max-width: 92vw;
      }
      .bsr-theme .window-header {
        background: var(--color-bg-header, #d5d5c5) !important;
        color: var(--bsr-text) !important;
      }
      .bsr-theme .window-header .window-title { color: var(--bsr-text) !important; }
      .bsr-theme .form-group { background: transparent !important; }
      .bsr-theme legend { color: var(--bsr-text) !important; }
      .bsr-theme .hint, .bsr-theme .bsr-hint { color: var(--bsr-text-muted) !important; }
      .bsr-theme label { color: var(--bsr-text) !important; }
      .bsr-theme input[type="text"], .bsr-theme select {
        background: var(--bsr-input-bg) !important;
        color: var(--bsr-text) !important;
        border: 1px solid var(--bsr-input-border) !important;
        border-radius: 0.3rem;
        padding: 0.35rem 0.5rem;
      }
      .bsr-theme input[type="checkbox"] {
        accent-color: var(--bsr-btn-primary-bg);
      }
      .bsr-theme color-picker { display: flex; gap: 0.5rem; align-items: center; }
      .bsr-theme color-picker input[type="text"] { flex: 1; }
      .bsr-theme fieldset { border: 1px solid var(--bsr-border); }
      .bsr-theme .bsr-card { border-color: var(--bsr-border); }
      .bsr-theme .bsr-card__header { background: var(--bsr-card-header-bg); border-color: var(--bsr-border); }
      .bsr-theme button, .bsr-theme .bsr-btn {
        background: var(--bsr-btn-bg);
        color: var(--bsr-text);
        border: 1px solid var(--bsr-border);
      }
      .bsr-theme button:hover, .bsr-theme .bsr-btn:hover {
        background: var(--bsr-btn-hover-bg);
      }
      .bsr-theme .bsr-footer .bsr-btn-primary {
        background: var(--bsr-btn-primary-bg);
        color: var(--bsr-btn-primary-color);
        border-color: var(--bsr-btn-primary-border);
      }
      .bsr-theme .bsr-footer .bsr-btn-primary:hover {
        background: var(--bsr-btn-primary-hover-bg);
      }
      .bsr-theme .bsr-section-label {
        border-top-color: var(--bsr-border);
        opacity: 0.7;
      }
    `;
  }

  return `
    .bsr-theme {
      --bsr-bg: rgba(11,10,19,0.9);
      --bsr-text: #e8e8e8;
      --bsr-text-muted: #888;
      --bsr-border: #3d4654;
      --bsr-card-header-bg: rgba(255,255,255,0.04);
      --bsr-input-bg: #2a3139;
      --bsr-input-border: #3d4654;
      --bsr-btn-bg: #2a3139;
      --bsr-btn-hover-bg: #3a424d;
      --bsr-btn-primary-bg: #5e81ac;
      --bsr-btn-primary-color: #fff;
      --bsr-btn-primary-border: #4c6c91;
      --bsr-btn-primary-hover-bg: #4c6c91;
      background: var(--bsr-bg) !important;
    }
    .bsr-theme .window-content {
      background: var(--bsr-bg) !important;
      color: var(--bsr-text) !important;
      overflow: auto;
      max-width: 92vw;
    }
    .bsr-theme .window-header {
      background: #06080a !important;
      color: var(--bsr-text) !important;
    }
    .bsr-theme .window-header .window-title { color: var(--bsr-text) !important; }
    .bsr-theme .form-group { background: transparent !important; }
    .bsr-theme legend { color: var(--bsr-text) !important; font-weight: 600; }
    .bsr-theme .hint, .bsr-theme .bsr-hint { color: var(--bsr-text-muted) !important; }
    .bsr-theme label { color: var(--bsr-text) !important; }
    .bsr-theme input[type="text"], .bsr-theme select {
      background: var(--bsr-input-bg) !important;
      color: var(--bsr-text) !important;
      border: 1px solid var(--bsr-input-border) !important;
      border-radius: 0.3rem;
      padding: 0.35rem 0.5rem;
    }
    .bsr-theme input[type="checkbox"] {
      accent-color: var(--bsr-btn-primary-bg);
    }
    .bsr-theme color-picker { display: flex; gap: 0.5rem; align-items: center; }
    .bsr-theme color-picker input[type="text"] { flex: 1; }
    .bsr-theme select option { background: var(--bsr-input-bg); color: var(--bsr-text); }
    .bsr-theme fieldset { border: 1px solid var(--bsr-border); }
    .bsr-theme .bsr-card { border-color: var(--bsr-border); }
    .bsr-theme .bsr-card__header { background: var(--bsr-card-header-bg); border-color: var(--bsr-border); }
    .bsr-theme button, .bsr-theme .bsr-btn {
      background: var(--bsr-btn-bg);
      color: var(--bsr-text);
      border: 1px solid var(--bsr-border);
    }
    .bsr-theme button:hover, .bsr-theme .bsr-btn:hover {
      background: var(--bsr-btn-hover-bg);
      border-color: #4d5764;
    }
    .bsr-theme .bsr-footer .bsr-btn-primary {
      background: var(--bsr-btn-primary-bg);
      color: var(--bsr-btn-primary-color);
      border-color: var(--bsr-btn-primary-border);
    }
    .bsr-theme .bsr-footer .bsr-btn-primary:hover {
      background: var(--bsr-btn-primary-hover-bg);
    }
    .bsr-theme .bsr-section-label {
      border-top-color: var(--bsr-border);
      opacity: 0.7;
    }
    .bsr-theme strong { color: var(--bsr-text); }
  `;
};

/** Inject theme stylesheet into an ApplicationV2 element. */
export const applyThemeToElement = (element: HTMLElement | null | undefined): void => {
  if (!element) return;
  if (element.querySelector("style.bsr-theme-style")) return;
  const theme = getTheme();
  const style = document.createElement("style");
  style.classList.add("bsr-theme-style");
  style.textContent = getThemeStyles(theme);
  element.appendChild(style);
};
