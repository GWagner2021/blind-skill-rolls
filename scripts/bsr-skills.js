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
      try {
        if (!blind && (globalThis._bsrIsPendingSkillPrivate?.() || globalThis._bsrIsPendingSavePrivate?.())) {
          const rollerId = user?.id ?? game.user?.id;
          const gmIds = (game.users?.filter(u => u.isGM) ?? []).map(u => u.id);
          users = Array.from(new Set([...gmIds, rollerId].filter(Boolean)));
        }
      } catch {  }

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
  const BLIND  = "blindroll";
  const GMROLL = "gmroll";

  // ---- Context menu helper (available before ready) ----
  const getMsgFromLi = (li) => {
    let el = null;
    if (li instanceof HTMLElement) el = li;
    else if (li?.dataset) el = li;
    if (!el) return null;
    const msgId =
      el.dataset?.messageId ?? el.dataset?.entryId ?? el.dataset?.documentId ??
      el.closest?.("[data-message-id]")?.dataset?.messageId ??
      el.closest?.("[data-entry-id]")?.dataset?.entryId ??
      null;
    return msgId ? game.messages?.get?.(msgId) : null;
  };

  // ---- Reveal to Roller: shared action ----
  const revealToRoller = async (message) => {
    if (!message) return;
    const authorId = message.author?.id ?? null;
    if (!authorId) return;
    const gmIds = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
    const newWhisper = Array.from(new Set([...gmIds, authorId]));
    await message.update({ blind: false, whisper: newWhisper });
    await message.setFlag(MOD, "revealedToRoller", true);
  };

  // ---- Reveal condition check ----
  const canRevealToRoller = (message) => {
    if (!message) return false;
    if (!message.blind) return false;
    try { if (message.getFlag?.(MOD, "revealedToRoller")) return false; } catch { /* ok */ }
    const authorId = message.author?.id ?? null;
    if (!authorId) return false;
    const authorUser = game.users?.get?.(authorId);
    if (!authorUser || authorUser.isGM) return false;
    return true;
  };

  // ---- Context menu entry: "Reveal to Roller" ----
  Hooks.on("getChatMessageContextOptions", (app, menuItems) => {
    const entry = {
      name: game.i18n?.has?.("BSR.UI.RevealToRoller")
        ? game.i18n.localize("BSR.UI.RevealToRoller")
        : "Reveal to roller",
      icon: '<i class="fa-solid fa-eye"></i>',
      condition: (target) => {
        if (!game.user?.isGM) return false;
        return canRevealToRoller(getMsgFromLi(target));
      },
      callback: async (target) => revealToRoller(getMsgFromLi(target))
    };

    // Insert after the first "eye" icon entry (e.g. "Reveal To Everyone"),
    // otherwise append at the end.
    const revealEveryoneIdx = menuItems.findIndex(i => i.icon?.includes("fa-eye"));
    const insertAt = revealEveryoneIdx >= 0 ? revealEveryoneIdx + 1 : menuItems.length;
    menuItems.splice(insertAt, 0, entry);
  });

  const PENDING_SKILL_TIMEOUT_MS = 5000;
  let _pendingSkill = null;

  Hooks.on("ready", () => {
    window.BSR_102.load_count += 1;

    const sget = (k, fb = false) => { try { return game.settings.get(MOD, k); } catch { return fb; } };
    const isEnabled = () => !!sget("enabled", false);

    const isSkillBlind = (skillId) => {
      if (!isEnabled()) return false;
      if (typeof skillId !== "string" || !skillId) return false;
      try { return !!game.settings.get(MOD, skillId); } catch { return false; }
    };

    const isSkillPrivate = (skillId) => {
      if (!isEnabled()) return false;
      if (typeof skillId !== "string" || !skillId) return false;
      // Blind takes precedence - if blind is active, private cannot be active
      if (isSkillBlind(skillId)) return false;
      try { return !!game.settings.get(MOD, skillId + "_private"); } catch { return false; }
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

      const NOTE_KEY = "BSR.UI.SkillPrivateGMNote";
      const NOTE_FALLBACK = "This skill is configured for Private GM Roll";
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

    // --- Record pending skill for MidiQOL fast-forward fallback ---
    const setPendingSkill = (skillId) => {
      if (!skillId) return;
      _pendingSkill = { key: skillId, ts: Date.now() };
      // Auto-expire to prevent stale state
      setTimeout(() => { if (_pendingSkill?.key === skillId) _pendingSkill = null; }, PENDING_SKILL_TIMEOUT_MS);
    };

    // Peek at pending skill without consuming it (allows multiple preCreateChatMessage calls)
    const peekPendingSkill = () => {
      if (!_pendingSkill) return null;
      if (Date.now() - _pendingSkill.ts > PENDING_SKILL_TIMEOUT_MS) { _pendingSkill = null; return null; }
      return _pendingSkill.key;
    };

    // Clear the pending skill (called after successful use)
    const clearPendingSkill = () => { _pendingSkill = null; };

    // Expose private-roll detection for the DiceSoNice integration (separate IIFE).
    // Called at dice-show time to determine if the pending skill is a private roll.
    globalThis._bsrIsPendingSkillPrivate = () => {
      const key = peekPendingSkill();
      return key ? isSkillPrivate(key) : false;
    };

    const forceBlind = (config, skillId) => {
      if (!isSkillBlind(skillId)) return;
      if (!config || typeof config !== "object") return;

      config.rollMode = BLIND;
      if (config.dialog && typeof config.dialog === "object") {
        config.dialog.rollMode = BLIND;
      }

      setPendingSkill(skillId);

      Hooks.once("renderRollConfigurationDialog", (app, el) => setRollConfigSelectBlind(el ?? app?.element));
      Hooks.once("renderApplicationV2", (app, el) => setRollConfigSelectBlind(el ?? app?.element));
    };

    const forcePrivate = (config, skillId) => {
      if (!isSkillPrivate(skillId)) return;
      if (!config || typeof config !== "object") return;

      config.rollMode = GMROLL;

      if (config.dialog && typeof config.dialog === "object") {
        config.dialog.rollMode = GMROLL;
      }

      setPendingSkill(skillId);

      Hooks.once("renderRollConfigurationDialog", (app, el) => setRollConfigSelectPrivate(el ?? app?.element));
      Hooks.once("renderApplicationV2", (app, el) => setRollConfigSelectPrivate(el ?? app?.element));
    };

    Hooks.on("dnd5e.preRollSkillV2", (cfg, dialog, message) => {
      try {
        const key = cfg?.skill ?? cfg?.skillId ?? cfg?.abilitySkill ?? null;
        if (!key) return;
        if (isSkillBlind(key)) {
          forceBlind(cfg, key);
          if (message && typeof message === "object") message.rollMode = BLIND;
          if (dialog && typeof dialog === "object") {
            if (!dialog.options) dialog.options = {};
            if (!dialog.options.default) dialog.options.default = {};
            dialog.options.default.rollMode = BLIND;
          }
        } else if (isSkillPrivate(key)) {
          forcePrivate(cfg, key);
          if (message && typeof message === "object") message.rollMode = GMROLL;
          if (dialog && typeof dialog === "object") {
            if (!dialog.options) dialog.options = {};
            if (!dialog.options.default) dialog.options.default = {};
            dialog.options.default.rollMode = GMROLL;
          }
        }
      } catch (e) {
        globalThis.dbgWarn?.("BSR | preRollSkillV2", e);
      }
    });


    Hooks.on("dnd5e.postSkillRollConfiguration", (rolls, config, dialog, message) => {
      try {
        if (!isEnabled()) return;

        const key = config?.skill ?? config?.skillId
          ?? rolls?.[0]?.data?.skill ?? rolls?.[0]?.options?.skill
          ?? rolls?.[0]?.options?.skillId
          ?? peekPendingSkill();
        if (!key) return;

        if (isSkillBlind(key)) {
          if (message && typeof message === "object") message.rollMode = BLIND;
          if (Array.isArray(rolls)) {
            for (const roll of rolls) {
              if (roll?.options) roll.options.rollMode = BLIND;
            }
          }
          setPendingSkill(key);
        } else if (isSkillPrivate(key)) {
          if (message && typeof message === "object") message.rollMode = GMROLL;
          if (Array.isArray(rolls)) {
            for (const roll of rolls) {
              if (roll?.options) roll.options.rollMode = GMROLL;
            }
          }
          setPendingSkill(key);
        }
      } catch (e) {
        globalThis.dbgWarn?.("BSR | postSkillRollConfiguration", e);
      }
    });

    Hooks.on("preCreateChatMessage", (msg, data, options, userId) => {
      try {
        if (!isEnabled()) return;

        // --- Detect skill key from multiple sources ---
        // 1. Check data.flags.dnd5e (normal flow)
        const d5data = data?.flags?.dnd5e ?? {};
        // 2. Check msg.flags.dnd5e (FoundryVTT v13 document, MidiQOL fast-forward)
        const d5doc  = msg?.flags?.dnd5e ?? {};

        const hasSkillInfo = (o) => !!(o?.roll?.skillId || o?.roll?.skill || o?.roll?.context?.skill
          || o?.skillId || o?.skill || o?.context?.skill);
        const d5 = hasSkillInfo(d5data) ? d5data : (hasSkillInfo(d5doc) ? d5doc : d5data);

        const isDeath =
          d5?.roll?.type === "death" || d5?.type === "death" || d5?.rollType === "death";
        if (isDeath) return;

        let key =
          d5?.roll?.skillId ?? d5?.roll?.skill ?? d5?.roll?.context?.skill ??
          d5?.skillId ?? d5?.skill ?? d5?.context?.skill ?? null;

        // 3. Fallback: try to extract skill from Roll objects in the message
        if (!key) {
          try {
            const rolls = msg?.rolls ?? [];
            for (const roll of rolls) {
              const sk = roll?.options?.skillId ?? roll?.options?.skill
                ?? roll?.data?.skillId ?? roll?.data?.skill ?? null;
              if (sk) { key = sk; break; }
            }
          } catch { }
        }

        if (!key) key = peekPendingSkill();

        if (!key) return;

        if (isSkillBlind(key)) {
          const gmIds = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
          msg.updateSource({
            blind: true,
            whisper: gmIds
          });
          clearPendingSkill();
        } else if (isSkillPrivate(key)) {
          const gmIds = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
          const author = userId ?? data?.author ?? msg?.author?.id ?? game.user?.id;
          const authorId = typeof author === "object" ? author.id : author;
          const whisperSet = new Set([...gmIds]);
          if (authorId) whisperSet.add(authorId);
          msg.updateSource({
            blind: false,
            whisper: Array.from(whisperSet)
          });
          clearPendingSkill();
        }
      } catch (e) {
        globalThis.dbgWarn?.("BSR | preCreateChatMessage (skills)", e);
      }
    });


    try {
      const hasLW = !!globalThis.libWrapper && game.modules.get("lib-wrapper")?.active;
      if (hasLW) {
        libWrapper.register(MOD, "CONFIG.Actor.documentClass.prototype.rollSkill", function (wrapped, skillId, ...args) {
          try {
            if (typeof skillId === "string" && skillId) {
              setPendingSkill(skillId);
              const opts = args[0];
              if (opts && typeof opts === "object") {
                if (isSkillBlind(skillId) && opts.rollMode !== BLIND) {
                  opts.rollMode = BLIND;
                } else if (isSkillPrivate(skillId) && opts.rollMode !== GMROLL) {
                  opts.rollMode = GMROLL;
                }
              }
            }
          } catch (e) {
            globalThis.dbgWarn?.("BSR | rollSkill wrapper", e);
          }
          return wrapped(skillId, ...args);
        }, "WRAPPER");
      }
    } catch (e) {
      globalThis.dbgWarn?.("BSR | Failed to register rollSkill wrapper", e);
    }

    // ---- Reveal blind roll to roller (badge only) ----
    // The reveal action is handled via the context menu (getChatMessageContextOptions).
    // This hook only shows a status badge on already-revealed messages.
    Hooks.on("renderChatMessageHTML", (message, html) => {
      try {
        if (!game.user?.isGM) return;

        const revealedFlag = message.getFlag?.(MOD, "revealedToRoller");
        if (!revealedFlag) return;

        const meta = html.querySelector?.(".message-metadata");
        if (!meta) return;
        if (meta.querySelector?.(".bsr-revealed-badge")) return;

        const LABEL = game.i18n?.has?.("BSR.UI.RevealedToRoller")
          ? game.i18n.localize("BSR.UI.RevealedToRoller")
          : "Revealed to roller";

        const badge = document.createElement("span");
        badge.className = "bsr-revealed-badge";
        badge.setAttribute("title", LABEL);
        badge.style.cssText = "margin-right:0.25rem;font-size:0.8em;color:#4caf50;font-style:italic;";
        badge.innerHTML = '<i class="fa-solid fa-eye fa-fw"></i>';

        meta.insertBefore(badge, meta.firstChild);
      } catch (e) {
        globalThis.dbgWarn?.("BSR | renderChatMessageHTML (revealed badge)", e);
      }
    });

  });
})();

window.BSR_102.load_count += 1;
BSR_102.load_complete();
