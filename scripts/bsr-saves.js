// scripts/bsr-saves.js

(() => {
  "use strict";

  const MOD   = "blind-skill-rolls";
  const BLIND  = "blindroll";
  const GMROLL = "gmroll";

  // ---- Pending save roll tracker ----
  const PENDING_SAVE_TIMEOUT_MS = 5000;
  let _pendingSave = null;

  Hooks.on("ready", () => {
    window.BSR_102.load_count += 1;

    const sget = (k, fb = false) => { try { return game.settings.get(MOD, k); } catch { return fb; } };
    const isEnabled = () => !!sget("savesEnabled", false);

    const isSaveBlind = (abilityId) => {
      if (!isEnabled()) return false;
      if (typeof abilityId !== "string" || !abilityId) return false;
      try { return !!game.settings.get(MOD, "save_" + abilityId); } catch { return false; }
    };

    const isSavePrivate = (abilityId) => {
      if (!isEnabled()) return false;
      if (typeof abilityId !== "string" || !abilityId) return false;
      if (isSaveBlind(abilityId)) return false;
      try { return !!game.settings.get(MOD, "save_" + abilityId + "_private"); } catch { return false; }
    };

    const setRollConfigSelectBlind = (root) => {
      if (!(root instanceof HTMLElement)) return;

      const sel = root.querySelector('select[name="rollMode"]');
      if (!sel) return;

      if (sel.value !== BLIND) {
        sel.value = BLIND;
      }

      sel.disabled = true;
      sel.style.opacity = "0.6";
      sel.style.cursor = "not-allowed";

      const parent = sel.parentNode;
      if (!parent) return;

      let existing = parent.querySelector('p[data-blind-note="true"]');

      const NOTE_KEY = "BSR.UI.SaveBlindGMNote";
      const NOTE_FALLBACK = "This saving throw is configured for Blind GM Roll";
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

    const setRollConfigSelectPrivate = (root) => {
      if (!(root instanceof HTMLElement)) return;

      const sel = root.querySelector('select[name="rollMode"]');
      if (!sel) return;

      if (sel.value !== GMROLL) {
        sel.value = GMROLL;
      }

      sel.disabled = true;
      sel.style.opacity = "0.6";
      sel.style.cursor = "not-allowed";

      const parent = sel.parentNode;
      if (!parent) return;

      let existing = parent.querySelector('p[data-private-note="true"]');

      const NOTE_KEY = "BSR.UI.SavePrivateGMNote";
      const NOTE_FALLBACK = "This saving throw is configured for Private GM Roll";
      const NOTE_TEXT = (game.i18n?.has?.(NOTE_KEY) ? game.i18n.localize(NOTE_KEY) : NOTE_FALLBACK);

      if (!existing) {
        existing = Array.from(parent.querySelectorAll("p"))
          .find(p => {
            const t = p.textContent?.trim();
            return t === NOTE_TEXT || t === NOTE_FALLBACK;
          });
      }

      if (existing) {
        existing.style.cssText = "color:#f0a030;font-size:0.85em;margin:0.25rem 0 0 0;font-style:italic;";
        return;
      }

      const note = document.createElement("p");
      note.setAttribute("data-private-note", "true");
      note.style.cssText = "color:#f0a030;font-size:0.85em;margin:0.25rem 0 0 0;font-style:italic;";
      note.textContent = NOTE_TEXT;

      sel.insertAdjacentElement("afterend", note);
    };

    // --- Record pending save for fallback ---
    const setPendingSave = (abilityId) => {
      if (!abilityId) return;
      _pendingSave = { key: abilityId, ts: Date.now() };
      setTimeout(() => { if (_pendingSave?.key === abilityId) _pendingSave = null; }, PENDING_SAVE_TIMEOUT_MS);
    };

    const peekPendingSave = () => {
      if (!_pendingSave) return null;
      if (Date.now() - _pendingSave.ts > PENDING_SAVE_TIMEOUT_MS) { _pendingSave = null; return null; }
      return _pendingSave.key;
    };

    const clearPendingSave = () => { _pendingSave = null; };

    // Expose private-roll detection for DiceSoNice integration
    globalThis._bsrIsPendingSavePrivate = () => {
      const key = peekPendingSave();
      return key ? isSavePrivate(key) : false;
    };

    const forceBlind = (config, abilityId) => {
      if (!isSaveBlind(abilityId)) return;
      if (!config || typeof config !== "object") return;

      config.rollMode = BLIND;
      if (config.dialog && typeof config.dialog === "object") {
        config.dialog.rollMode = BLIND;
      }

      setPendingSave(abilityId);

      Hooks.once("renderRollConfigurationDialog", (app, el) => setRollConfigSelectBlind(el ?? app?.element));
      Hooks.once("renderApplicationV2", (app, el) => setRollConfigSelectBlind(el ?? app?.element));
    };

    const forcePrivate = (config, abilityId) => {
      if (!isSavePrivate(abilityId)) return;
      if (!config || typeof config !== "object") return;

      config.rollMode = GMROLL;

      if (config.dialog && typeof config.dialog === "object") {
        config.dialog.rollMode = GMROLL;
      }

      setPendingSave(abilityId);

      Hooks.once("renderRollConfigurationDialog", (app, el) => setRollConfigSelectPrivate(el ?? app?.element));
      Hooks.once("renderApplicationV2", (app, el) => setRollConfigSelectPrivate(el ?? app?.element));
    };

    // ---- dnd5e preRollSavingThrowV2 hook ----

    const handleSavePreRoll = (hookLabel, cfg, dialog, message) => {
      try {
        if (!isEnabled()) return;
        const key = cfg?.ability ?? cfg?.abilityId ?? null;
        if (!key) return;
        if (isSaveBlind(key)) {
          forceBlind(cfg, key);
          if (message && typeof message === "object") message.rollMode = BLIND;
          // Also set on dialog defaults so the dropdown initialises correctly
          if (dialog && typeof dialog === "object") {
            if (!dialog.options) dialog.options = {};
            if (!dialog.options.default) dialog.options.default = {};
            dialog.options.default.rollMode = BLIND;
          }
        } else if (isSavePrivate(key)) {
          forcePrivate(cfg, key);
          if (message && typeof message === "object") message.rollMode = GMROLL;
          if (dialog && typeof dialog === "object") {
            if (!dialog.options) dialog.options = {};
            if (!dialog.options.default) dialog.options.default = {};
            dialog.options.default.rollMode = GMROLL;
          }
        }
      } catch (e) {
        globalThis.dbgWarn?.("BSR | " + hookLabel, e);
      }
    };

    Hooks.on("dnd5e.preRollSavingThrowV2", (cfg, dialog, message) => {
      handleSavePreRoll("preRollSavingThrowV2", cfg, dialog, message);
    });


    Hooks.on("dnd5e.preRollAbilityCheckV2", () => { clearPendingSave(); });
    Hooks.on("dnd5e.preRollSkillV2", () => { clearPendingSave(); });
    Hooks.on("dnd5e.postSavingThrowRollConfiguration", (rolls, config, dialog, message) => {
      try {
        if (!isEnabled()) return;

        const key = config?.ability ?? config?.abilityId
          ?? rolls?.[0]?.data?.ability ?? rolls?.[0]?.options?.ability
          ?? rolls?.[0]?.options?.abilityId
          ?? peekPendingSave();
        if (!key) return;

        if (isSaveBlind(key)) {
          if (message && typeof message === "object") message.rollMode = BLIND;
          if (Array.isArray(rolls)) {
            for (const roll of rolls) {
              if (roll?.options) roll.options.rollMode = BLIND;
            }
          }
          setPendingSave(key);
        } else if (isSavePrivate(key)) {
          if (message && typeof message === "object") message.rollMode = GMROLL;
          if (Array.isArray(rolls)) {
            for (const roll of rolls) {
              if (roll?.options) roll.options.rollMode = GMROLL;
            }
          }
          setPendingSave(key);
        }
      } catch (e) {
        globalThis.dbgWarn?.("BSR | postSavingThrowRollConfiguration", e);
      }
    });

    // ---- preCreateChatMessage: enforce save roll modes ----
    Hooks.on("preCreateChatMessage", (msg, data, options, userId) => {
      try {
        if (!isEnabled()) return;

        // --- Detect save key from multiple sources ---
        // 1. Check data.flags.dnd5e (normal flow)
        const d5data = data?.flags?.dnd5e ?? {};
        // 2. Check msg.flags.dnd5e (FoundryVTT v13 document, MidiQOL fast-forward)
        const d5doc  = msg?.flags?.dnd5e ?? {};

        const hasSaveInfo = (o) => !!(o?.roll?.abilityId || o?.roll?.ability
          || o?.abilityId || o?.ability);
        const d5 = hasSaveInfo(d5data) ? d5data : (hasSaveInfo(d5doc) ? d5doc : d5data);

        const isDeath =
          d5?.roll?.type === "death" || d5?.type === "death" || d5?.rollType === "death";
        if (isDeath) return;

        // Skip skill rolls (handled by bsr-skills.js)
        const isSkillRoll =
          d5data?.roll?.skillId || d5data?.roll?.skill || d5data?.skillId || d5data?.skill ||
          d5doc?.roll?.skillId || d5doc?.roll?.skill || d5doc?.skillId || d5doc?.skill;
        if (isSkillRoll) return;

        // Only process confirmed saving throws – save settings must not affect ability checks
        // Both saves and checks carry abilityId, so rollType is the only reliable discriminator
        const effectiveRollType = (d5data?.roll?.type ?? d5data?.type ?? d5data?.rollType)
          ?? (d5doc?.roll?.type ?? d5doc?.type ?? d5doc?.rollType) ?? null;
        // When rollType is available, require it to be "save"
        if (effectiveRollType && effectiveRollType !== "save") return;
        // When rollType is unavailable (fast-forward), require a pending save from preRollSavingThrowV2
        if (!effectiveRollType && !peekPendingSave()) return;

        let key =
          d5?.roll?.abilityId ?? d5?.roll?.ability ??
          d5?.abilityId ?? d5?.ability ?? null;

        // 3. Fallback: try to extract ability from Roll objects in the message
        if (!key) {
          try {
            const rolls = msg?.rolls ?? [];
            for (const roll of rolls) {
              const ab = roll?.options?.abilityId ?? roll?.options?.ability
                ?? roll?.data?.abilityId ?? roll?.data?.ability ?? null;
              if (ab) { key = ab; break; }
            }
          } catch { /* ok */ }
        }

        // 4. Fallback: use pending save from preRoll hooks or libWrapper
        if (!key) key = peekPendingSave();

        if (!key) return;

        if (isSaveBlind(key)) {
          const gmIds = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
          msg.updateSource({
            blind: true,
            whisper: gmIds
          });
          clearPendingSave();
        } else if (isSavePrivate(key)) {
          const gmIds = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
          const author = userId ?? data?.author ?? msg?.author?.id ?? game.user?.id;
          const authorId = typeof author === "object" ? author.id : author;
          const whisperSet = new Set([...gmIds]);
          if (authorId) whisperSet.add(authorId);
          msg.updateSource({
            blind: false,
            whisper: Array.from(whisperSet)
          });
          clearPendingSave();
        }
      } catch (e) {
        globalThis.dbgWarn?.("BSR | preCreateChatMessage (saves)", e);
      }
    });

    // ---- libWrapper: wrap rollSavingThrow for reliable ability capture ----
    try {
      const hasLW = !!globalThis.libWrapper && game.modules.get("lib-wrapper")?.active;
      if (hasLW) {
        const saveWrapper = function (wrapped, abilityId, ...args) {
          try {
            if (!isEnabled()) return wrapped(abilityId, ...args);
            if (typeof abilityId === "string" && abilityId) {
              setPendingSave(abilityId);
              const opts = args[0];
              if (opts && typeof opts === "object") {
                if (isSaveBlind(abilityId) && opts.rollMode !== BLIND) {
                  opts.rollMode = BLIND;
                } else if (isSavePrivate(abilityId) && opts.rollMode !== GMROLL) {
                  opts.rollMode = GMROLL;
                }
              }
            }
          } catch (e) {
            globalThis.dbgWarn?.("BSR | save wrapper", e);
          }
          return wrapped(abilityId, ...args);
        };

        const proto = CONFIG.Actor.documentClass.prototype;
        if (typeof proto.rollSavingThrow === "function") {
          libWrapper.register(MOD, "CONFIG.Actor.documentClass.prototype.rollSavingThrow", saveWrapper, "WRAPPER");
        }
      }
    } catch (e) {
      globalThis.dbgWarn?.("BSR | Failed to register save wrapper(s)", e);
    }

  });
})();

window.BSR_102.load_count += 1;
BSR_102.load_complete();
