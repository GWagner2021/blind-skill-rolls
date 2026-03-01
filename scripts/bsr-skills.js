// scripts/bsr-skills.js

(() => {
  const MODULE_ID = "blind-skill-rolls";

  // -----------------------------
  // Dice So Nice
  // -----------------------------
  Hooks.on("diceSoNiceReady", () => {
    const dice3d = game.dice3d;
    if (!dice3d) return;

    if (dice3d._bsrShowWrapped) return;
    dice3d._bsrShowWrapped = true;

    const originalShow = dice3d.show;
    dice3d.show = function (data, user, synchronize, users, blind) {
      const isHiddenRoll =
        blind === true ||
        (Array.isArray(users) && !users.includes("all"));

      if (isHiddenRoll && data && typeof data === "object") {
        data._blindSkillRolls = {
          rollerId: user?.id,
          allowedUsers: users ?? null
        };
      }
      return originalShow.call(this, data, user, synchronize, users, blind);
    };
  });

  Hooks.on("diceSoNiceReady", () => {
    const dice3d = game.dice3d;
    if (!dice3d) return;

    if (dice3d._bsrAnimWrapped) return;
    dice3d._bsrAnimWrapped = true;

    const originalShowAnimation = dice3d._showAnimation;
    dice3d._showAnimation = function (notation, config) {
      const meta = notation && notation._blindSkillRolls;
      if (!meta) return originalShowAnimation.call(this, notation, config);

      const userId = game.user?.id;
      const isGM = game.user?.isGM === true;

      if (userId === meta.rollerId) return originalShowAnimation.call(this, notation, config);
      if (isGM) return originalShowAnimation.call(this, notation, config);

      return Promise.resolve(false);
    };
  });
})();
  // -----------------------------
  // Blind Skills
  // -----------------------------
(() => {
  "use strict";

  const MOD   = "blind-skill-rolls";
  const BLIND = CONST.DICE_ROLL_MODES.BLIND;

  Hooks.on("ready", () => {
    window.BSR_102.load_count += 1;

    const sget = (k, fb = false) => { try { return game.settings.get(MOD, k); } catch { return fb; } };
    const isEnabled = () => !!sget("enabled", false);
    const blindAll  = () => !!sget("blindAll", false);

    const isSkillBlind = (skillId) => {
      if (!isEnabled()) return false;
      if (blindAll()) return true;
      if (typeof skillId !== "string" || !skillId) return false;
      try { return !!game.settings.get(MOD, skillId); } catch { return false; }
    };

    const SELECT_VALUE = {
      [CONST.DICE_ROLL_MODES.PUBLIC]: "publicroll",
      [CONST.DICE_ROLL_MODES.GMROLL]: "gmroll",
      [CONST.DICE_ROLL_MODES.BLIND]:  "blindroll",
      [CONST.DICE_ROLL_MODES.SELF]:   "selfroll"
    };

    const setRollConfigSelectBlind = (root) => {
      const el = root instanceof HTMLElement ? root : root?.[0];
      if (!(el instanceof HTMLElement)) return;

      const sel = el.querySelector('select[name="rollMode"]');
      if (!sel) return;

      const desired = SELECT_VALUE[BLIND] || "blindroll";
      if (sel.value !== desired) {
        sel.value = desired;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }

      sel.disabled = true;
      sel.style.opacity = "0.6";
      sel.style.cursor = "not-allowed";

      const parent = sel.parentNode;
      if (!parent) return;

      let existing = parent.querySelector('p[data-blind-note="true"]');

      const NOTE_KEY = "BSR.UI.SkillBlindGMNote";
      const NOTE_FALLBACK = "This skill is configured for Blind GM Roll";
      const NOTE_TEXT = (game.i18n?.has?.(NOTE_KEY) ? game.i18n.localize(NOTE_KEY) : NOTE_FALLBACK);

      if (!existing) {
        existing = Array.from(parent.querySelectorAll("p"))
          .find(p => {
            const t = p.textContent?.trim();
            return t === NOTE_TEXT || t === NOTE_FALLBACK;
          });
      }

      if (existing) {
        existing.style.cssText = "color:#ff6b6b;font-size:0.85em;margin:0.25rem 0 0 0;font-style:italic;";
        return;
      }

      const note = document.createElement("p");
      note.setAttribute("data-blind-note", "true");
      note.style.cssText = "color:#ff6b6b;font-size:0.85em;margin:0.25rem 0 0 0;font-style:italic;";
      note.textContent = NOTE_TEXT;

      sel.insertAdjacentElement("afterend", note);
    };

    const forceBlind = (config, skillId) => {
      if (!isSkillBlind(skillId)) return;
      if (!config || typeof config !== "object") return;

     
      config.rollMode = BLIND;

      if (config.dialog && typeof config.dialog === "object") {
        config.dialog.rollMode = BLIND;
      }

      Hooks.once("renderRollConfig", (_a, html) => setRollConfigSelectBlind(html));
      Hooks.once("renderDialog", (_a, html) => setRollConfigSelectBlind(html));
      Hooks.once("renderApplicationV2", (app, el) => setRollConfigSelectBlind(el ?? app?.element));
    };

    Hooks.on("dnd5e.preRollSkillV2", (cfg) => {
      try {
        const key = cfg?.skill ?? cfg?.skillId ?? cfg?.abilitySkill ?? null;
        if (!key) return;
        forceBlind(cfg, key);
      } catch (e) {
        globalThis.dbgWarn?.("BSR | preRollSkillV2", e);
      }
    });

    Hooks.on("dnd5e.preRollSkill", (...args) => {
      try {
        let skillId = null;
        let config = null;

        for (const a of args) {
          if (!a) continue;

          if (typeof a === "string" && !skillId) {
            skillId = a;
            continue;
          }

          if (typeof a === "object") {
            if (!skillId) {
              if (typeof a.skill === "string") skillId = a.skill;
              else if (typeof a.skillId === "string") skillId = a.skillId;
              else if (typeof a.abilitySkill === "string") skillId = a.abilitySkill;
            }
            if (!config && ("rollMode" in a || "fastForward" in a || "configure" in a || a?.dialog)) {
              config = a;
            }
          }
        }

        if (!skillId) return;
        if (!config) return;

        if (config.rollMode === BLIND) return;

        forceBlind(config, skillId);
      } catch (e) {
        globalThis.dbgWarn?.("BSR | preRollSkill (fallback)", e);
      }
    });

    Hooks.on("preCreateChatMessage", (_doc, data) => {
      try {
        if (!isEnabled()) return;

        const d5 = data?.flags?.dnd5e ?? {};
        const isDeath =
          d5?.roll?.type === "death" || d5?.type === "death" || d5?.rollType === "death";
        if (isDeath) return;

        const key =
          d5?.roll?.skillId ?? d5?.roll?.skill ?? d5?.roll?.context?.skill ??
          d5?.skillId ?? d5?.skill ?? d5?.context?.skill ?? null;

        if (!key || !isSkillBlind(key)) return;

        data.rollMode = BLIND;
        data.blind = true;
        data.whisper = ChatMessage.getWhisperRecipients("GM").map(u => u.id);

        if (ChatMessage.applyRollMode) ChatMessage.applyRollMode(data, BLIND);
      } catch (e) {
        globalThis.dbgWarn?.("BSR | preCreateChatMessage (skills)", e);
      }
    });
  });
})();

window.BSR_102.load_count += 1;
BSR_102.load_complete();