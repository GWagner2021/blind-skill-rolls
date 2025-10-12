// scripts/blind-skill-rolls.js
(() => {
  "use strict";

  const MOD   = "blind-skill-rolls";
  const BLIND = CONST.DICE_ROLL_MODES.BLIND;

  Hooks.on("ready", () => {
    console.log(
      `------------------- %c${MOD}%c -------------------`,
      'color:#8B0000;font-weight:700;',
      'color:inherit;'
    );
    console.log(
      `%c${MOD}%c | Bilnd Skills ready`,
      'color:#8B0000;font-weight:700;',
      'color:inherit;'
    );

    const sget = (k, fb=false) => { try { return game.settings.get(MOD, k); } catch { return fb; } };
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
      [CONST.DICE_ROLL_MODES.GMROLL]:  "gmroll",
      [CONST.DICE_ROLL_MODES.BLIND]:   "blindroll",
      [CONST.DICE_ROLL_MODES.SELF]:    "selfroll"
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
    };

    const forceBlind = (config, skillId) => {
      if (!isSkillBlind(skillId)) return;
      config.rollMode = BLIND;
      if (config.dialog && typeof config.dialog === "object") config.dialog.rollMode = BLIND;

      Hooks.once("renderRollConfig", (_a, html) => setRollConfigSelectBlind(html));
      Hooks.once("renderDialog",     (_a, html) => setRollConfigSelectBlind(html));
      Hooks.once("renderApplicationV2", (app, el) => setRollConfigSelectBlind(el ?? app?.element));
    };

    Hooks.on("dnd5e.preRollSkillV2", (cfg) => {
      try {
        const key = cfg?.skill ?? cfg?.skillId ?? cfg?.abilitySkill ?? null;
        if (!key) return;
        forceBlind(cfg ?? {}, key);
      } catch (e) { console.warn("[BSR] preRollSkillV2", e); }
    });

    Hooks.on("dnd5e.preRollSkill", (...args) => {
      try {
        let skillId = null, config = null;
        for (const a of args) {
          if (!a) continue;
          if (typeof a === "string" && !skillId) { skillId = a; continue; }
          if (typeof a === "object") {
            if (!skillId) {
              if (typeof a.skill === "string") skillId = a.skill;
              else if (typeof a.skillId === "string") skillId = a.skillId;
              else if (typeof a.abilitySkill === "string") skillId = a.abilitySkill;
            }
            if (!config && ("rollMode" in a || "fastForward" in a || "configure" in a || a?.dialog)) config = a;
          }
        }
        if (!skillId) return;
        forceBlind(config ?? {}, skillId);
      } catch (e) { console.warn("[BSR] preRollSkill", e); }
    });

    Hooks.on("preCreateChatMessage", (_doc, data) => {
      try {
        if (!isEnabled()) return;
        const d5 = data?.flags?.dnd5e ?? {};
        const isDeath = d5?.roll?.type === "death" || d5?.type === "death" || d5?.rollType === "death";
        if (isDeath) return;

        const key =
          d5?.roll?.skillId ?? d5?.roll?.skill ?? d5?.roll?.context?.skill ??
          d5?.skillId ?? d5?.skill ?? d5?.context?.skill ?? null;

        if (!key || !isSkillBlind(key)) return;
        data.rollMode = BLIND; data.blind = true;
        data.whisper = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
        if (ChatMessage.applyRollMode) ChatMessage.applyRollMode(data, BLIND);
      } catch (e) { console.warn("[BSR] preCreateChatMessage (skills)", e); }
    });
  });
})();
