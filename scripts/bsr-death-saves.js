// scripts/blind-death-saves.js

(() => {
  "use strict";

  const MOD = "blind-skill-rolls";
  const KEY = "bsrDeathSavesMode";

  const modeTag = () => String(game.settings.get(MOD, KEY) || "blindroll").toLowerCase();
  const isDeathSave = (msg) => {
    const d5 = msg?.flags?.dnd5e ?? {};
    const t  = d5?.roll?.type ?? d5?.type ?? d5?.rollType ?? "";
    return t === "death";
  };
  Hooks.on("dnd5e.rollDeathSaveV2", (_rolls, details) => {
    if (details && typeof details === "object") details.chatString = undefined;
  });
  Hooks.on("preCreateChatMessage", (msg, data, options, userId) => {
    if (!isDeathSave(msg)) return;

    const mode = modeTag();
    if (mode === "public") {
      msg.updateSource({ blind: false, whisper: [] });
      return;
    }

    const gmId    = game.users.activeGM?.id;
    const author  = userId || msg.user || game.user?.id;

    if (mode === "privatroll") {
      const whisper = [gmId, author].filter(Boolean);
      msg.updateSource({ blind: false, whisper });
    } else {
      const whisper = gmId ? [gmId] : [];
      msg.updateSource({ blind: true, whisper });
    }
  });

  Hooks.on("renderActorSheetV2", (app, html, data) => {
    if (modeTag() !== "blindroll" || game.user.isGM) return;

    if (app.options.classes?.includes?.("tidy5e-sheet")) {
      html.querySelectorAll('[data-tidy-sheet-part="death-save-failures"], [data-tidy-sheet-part="death-save-successes"]')
          .forEach(n => n.remove());
      html.querySelectorAll('.death-saves .fa-check, .death-saves .death-save-result, .death-saves .fa-times')
          .forEach(n => n.remove());
    } else {
      html.querySelectorAll('.death-tray .death-saves .pips')
          .forEach(n => n.remove());
    }
  });

  Hooks.on("renderPortraitPanelArgonComponent", (_pp, el ) => {
    if (modeTag() === "blindroll" && !game.user.isGM) {
      el.querySelectorAll('.death-save-result-container')
        .forEach(n => n.remove());
    }
  });
})();
