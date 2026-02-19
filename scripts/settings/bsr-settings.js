// scripts/settings/bsr-settings.js

(() => {
     const MOD = "blind-skill-rolls";

      globalThis.BSR_DEBUG ??= false;
      globalThis.dbgWarn ??= (...args) => {
        if (globalThis.BSR_DEBUG === true) console.warn(...args);
      };

     const bsr_modules =  [
      "scripts/settings/bsr-settings.js",
      "scripts/settings/bsr-chat-settings.js",
      "scripts/settings/bsr-skills-settings.js",
      "scripts/settings/bsr-death-settings.js",
      "scripts/settings/settings-dsn.js",
      "scripts/bsr-chat-hide.js",
      "scripts/bsr-skills.js",
      "scripts/bsr-death-saves.js",
      "scripts/bsr-gm-privacy.js",
      "scripts/bsr-npc-reveal.js"
    ];

    window.BSR_102 = {
      load_count: 0,
      load_complete: function(){
        if(window.BSR_102.load_count >= 20){
            const mod = game.modules.get(MOD);

            const title = (mod?.title ?? "Blind Skill Rolls").toUpperCase();
            const version = mod?.version ?? "unknown";

            const titleStyle = [
              "color:#e53935",
              "font-size:64px",
              "font-weight:900",
              "letter-spacing:2px",
              "text-shadow:6px 6px 0 rgba(0,0,0,0.55)"
            ].join(";");

            const subStyle = [
              "color:#e53935",
              "font-size:14px",
              "font-weight:700",
              "text-shadow:2px 2px 0 rgba(0,0,0,0.55)"
            ].join(";");

            console.log(`%c${title}`, titleStyle);
            console.log(`%cv${version} | Loaded`, subStyle);

        }
      }
    }
    window.addEventListener('error', (event) => {
      for(let i=0;i<bsr_modules.length;i++){
        if (event.filename?.includes(bsr_modules[i])) {
          const L = (k, fb) => {
            try { const t = game?.i18n?.localize?.(k); return (t && t !== k) ? t : (fb ?? k); }
            catch { return fb ?? k; }
          };
          console.error("[BSR]", `${L("BLINDSKILLROLLS.Log.FLVFileFailedLoad", "File failed to load:")} ${event.filename ?? ""}`);
          console.error("[BSR]", `${L("BLINDSKILLROLLS.Log.FLVReason", "Reason:")} ${event.message ?? ""}`);
        }
      }
    });

    Hooks.on("ready", () => {
      window.BSR_102.load_count += 1;

    });

})();
(() => {
  "use strict";
  const MOD = "blind-skill-rolls";

  const STY = "color:#8B0000;font-weight:700;";
  const tag = () => [`%c${MOD}%c`, STY, "color:inherit;"];
  const log  = (...a) => { try { console.log(...tag(), ...a); } catch {} };

  const L = (k, fb) => {
    try { const t = game?.i18n?.localize?.(k); return (t && t !== k) ? t : (fb ?? k); }
    catch { return fb ?? k; }
  };

  Hooks.once("i18nInit", () => {
    // Register the theme setting
    game.settings.register(MOD, "bsrTheme", {
      name: L("BSR.Settings.Theme.Name", "Dialog Theme"),
      hint: L("BSR.Settings.Theme.Hint", "Choose between light or dark theme for module dialogs."),
      scope: "world",
      config: true,
      restricted: false,
      type: String,
      choices: {
        light: L("BSR.Settings.Theme.Light", "Light Theme"),
        dark: L("BSR.Settings.Theme.Dark", "Dark Theme")
      },
      default: "light",
      onChange: (value) => {
        globalThis.dbgWarn?.(`| theme changed to: ${value}`);

      }
    });

    globalThis.dbgWarn?.("| theme setting registered");
  });

  // Global helper function to get current theme
  window.BSR = window.BSR || {};
  window.BSR.getTheme = () => {
    try {
      return game.settings.get(MOD, "bsrTheme") || "light";
    } catch {
      return "light";
    }
  };

  window.BSR.getThemeStyles = (theme) => {
    const isLight = theme === "light";

    if (isLight) {
      // Light theme styles
      return `
        .bsr-theme {
          background: var(--color-bg-option, #f0f0e0) !important;
        }
        .bsr-theme .window-content {
          background: var(--color-bg-option, #f0f0e0) !important;
          color: var(--color-text-dark-primary, #000) !important;
          overflow: auto;
          max-width: 92vw;
        }
        .bsr-theme .window-header {
          background: var(--color-bg-header, #d5d5c5) !important;
          color: var(--color-text-dark-primary, #000) !important;
        }
        .bsr-theme .window-header .window-title {
          color: var(--color-text-dark-primary, #000) !important;
        }
        .bsr-theme .form-group {
          background: transparent !important;
        }
        .bsr-theme legend {
          color: var(--color-text-dark-primary, #000) !important;
        }
        .bsr-theme .hint {
          color: var(--color-text-dark-secondary, #4b4a44) !important;
        }
        .bsr-theme label {
          color: var(--color-text-dark-primary, #000) !important;
        }
        .bsr-theme input[type="text"],
        .bsr-theme input[type="checkbox"],
        .bsr-theme select {
          background: #fff !important;
          color: #000 !important;
          border: 1px solid #999 !important;
        }
        .bsr-theme fieldset {
          border: 1px solid #999;
        }
        .bsr-theme button {
          background: #e0e0d0;
          color: #000;
          border: 1px solid #999;
        }
        .bsr-theme button:hover {
          background: #d0d0c0;
        }
      `;
    } else {
      // Dark theme styles - Exact Foundry v13 blue-tinted dark theme
      return `
        .bsr-theme {
          background: rgba(11,10,19,0.9) !important;
        }
        .bsr-theme .window-content {
          background: rgba(11,10,19,0.9) !important;
          color: #f0f0f0 !important;
          overflow: auto;
          max-width: 92vw;
        }
        .bsr-theme .window-header {
          background: #06080a !important;
          color: #f0f0f0 !important;
        }
        .bsr-theme .window-header .window-title {
          color: #f0f0f0 !important;
        }
        .bsr-theme .form-group {
          background: transparent !important;
        }
        .bsr-theme legend {
          color: #f0f0f0 !important;
          font-weight: 600;
        }
        .bsr-theme .hint {
          color: #999999 !important;
        }
        .bsr-theme label {
          color: #f0f0f0 !important;
        }
        .bsr-theme input[type="text"],
        .bsr-theme input[type="checkbox"],
        .bsr-theme select {
          background: #2a3139 !important;
          color: #f0f0f0 !important;
          border: 1px solid #3d4654 !important;
        }
        .bsr-theme select option {
          background: #2a3139;
          color: #f0f0f0;
        }
        .bsr-theme fieldset {
          border: 1px solid #3d4654;
        }
        .bsr-theme button {
          background: #2a3139;
          color: #f0f0f0;
          border: 1px solid #3d4654;
        }
        .bsr-theme button:hover {
          background: #3a424d;
          border-color: #4d5764;
        }
        .bsr-theme strong {
          color: #f0f0f0;
        }
      `;
    }
  };
})();
window.BSR_102.load_count += 1;
BSR_102.load_complete();
