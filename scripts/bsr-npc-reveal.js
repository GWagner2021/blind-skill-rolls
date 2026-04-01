// scripts/bsr-npc-reveal.js

(() => {
  "use strict";

  const MOD = "blind-skill-rolls";
  const FLAG_SCOPE = MOD;
  const FLAG_KEY_REVEALED = "revealed";
  const FLAG_KEY_PERM_REVEALED = "permRevealed";

  // ----------------------- i18n / Masken-Label -----------------------
  function maskLabel() {
    try {
      const fromSetting = String(game.settings.get(MOD, "bsrNpcNameReplacement") ?? "").trim();
      if (fromSetting) return fromSetting;
    } catch {}
    const key = "BLINDSKILLROLLS.NPC.Unknown";
    if (game.i18n?.has?.(key)) return game.i18n.localize(key);
    return "Unknown";
  }

  function L(key, fallback) {
    try {
      if (game.i18n?.has?.(key)) return game.i18n.localize(key);
    } catch {}
    return fallback ?? key;
  }

  // ----------------------------- Utils --------------------------------
  const isGM = () => !!game.user?.isGM;
  const uniq = (arr) => Array.from(new Set(arr));
  const safeParse = (s, fb = []) => { try { return JSON.parse(s); } catch { return fb; } };
  const getActorById = (id) => game.actors?.get?.(id) ?? null;

  function resolveBaseActor(actor) {
    if (!actor) return null;
    try {
      if (actor.isToken) {
        return actor.baseActor ?? game.actors?.get?.(actor.id) ?? actor;
      }
    } catch {}
    return actor;
  }

  function docFromUuidSync(uuid) {
    try { return globalThis.fromUuidSync?.(uuid) ?? null; }
    catch { return null; }
  }

  function resolveTokenFromKeys(keys) {
    const uuidKey = keys.find(k => k.startsWith("t:")) || keys.find(k => k.startsWith("u:"));
    if (uuidKey) {
      const doc = docFromUuidSync(uuidKey.slice(2));
      if (doc?.documentName === "Token") return doc;
      if (doc?.parent?.documentName === "Token") return doc.parent;
    }

    const tidKey = keys.find(k => k.startsWith("tid:"));
    if (tidKey && canvas?.scene) {
      const tid = tidKey.slice(4);
      const uuid = `Scene.${canvas.scene.id}.Token.${tid}`;
      const doc = docFromUuidSync(uuid);
      if (doc?.documentName === "Token") return doc;
    }

    return null;
  }

  function resolveActorFromKeys(keys) {
    const aid = (keys.find(k => k.startsWith("aid:")) || "").slice(4) || null;
    if (aid) {
      const a = getActorById(aid);
      if (a) return a;
    }

    const uuidKey = keys.find(k => k.startsWith("t:")) || keys.find(k => k.startsWith("u:"));
    if (uuidKey) {
      const doc = docFromUuidSync(uuidKey.slice(2));
      if (doc?.actor) return doc.actor;
      if (doc?.documentName === "Actor") return doc;
    }
    return null;
  }

  function findTitleNode(li) {
    return li?.querySelector?.(".message-header .name-stacked .title") ?? null;
  }

  function attachKeys(li, message) {
    if (!li || !message) return;
    const keys = [];

    const speaker = message?.speaker ?? {};
    const actorDoc = message?.actor ?? null;
    const actorId = actorDoc?.id || speaker.actor || null;
    const actorName = actorDoc?.name || speaker.alias || "";
    const tokenId = speaker.token || null;

    const uuidFromHeader = li.querySelector?.(".message-header a.avatar[data-uuid]")?.dataset?.uuid || "";

    const tokenUuid = (tokenId && canvas?.scene)
      ? `Scene.${canvas.scene.id}.Token.${tokenId}`
      : "";

    if (actorName) keys.push(`n:${actorName}`);
    if (actorId)   keys.push(`aid:${actorId}`, `a:Actor.${actorId}`);
    if (tokenId)   keys.push(`tid:${tokenId}`);
    if (tokenUuid) keys.push(`t:${tokenUuid}`);
    if (uuidFromHeader) keys.push(`u:${uuidFromHeader}`);

    if (keys.length) li.dataset.bsrKeys = JSON.stringify(uniq(keys));
  }

  function isPureGMRoll(keys, message) {
    const hasActorKeys = keys.some(k =>
      k.startsWith("aid:") ||
      k.startsWith("a:") ||
      k.startsWith("tid:") ||
      k.startsWith("t:") ||
      k.startsWith("u:")
    );

    if (hasActorKeys) return false;

    const hasActorDoc = !!message?.actor;
    const hasActorInSpeaker = !!(message?.speaker?.actor || message?.speaker?.token);

    if (hasActorDoc || hasActorInSpeaker) return false;
    return true;
  }

  function shouldMaskByDefault(actor) {
    if (!actor) {
      try {
        return !!game.settings.get(MOD, "bsrNpcMaskDefault");
      } catch {
        return true;
      }
    }

    if (actor.type === "character") return false;

    try {
      return !!game.settings.get(MOD, "bsrNpcMaskDefault");
    } catch {
      return true;
    }
  }

  // ---- Persistent (actor-level) reveal check ----
  function isNpcPermanentlyRevealed(actor) {
    if (!actor) return false;
    const base = resolveBaseActor(actor);
    if (!base) return false;
    try {
      const flag = base.getFlag?.(FLAG_SCOPE, FLAG_KEY_PERM_REVEALED);
      return flag === true;
    } catch {
      return false;
    }
  }

  /**
   * Centralized reveal check.
   * Priority: actor permanent flag → token flag → default masking.
   */
  function isNpcRevealed(actor, tokenDoc) {
    if (!actor && !tokenDoc) return false;
    const a = actor ?? tokenDoc?.actor ?? null;

    // PCs are always revealed
    if (a?.type === "character") return true;

    // Check global masking first
    try {
      if (!game.settings.get(MOD, "bsrNpcMaskDefault")) return true;
    } catch {}

    // 1. Actor-level permanent reveal (persists across scenes)
    if (isNpcPermanentlyRevealed(a)) return true;

    // 2. Token-level reveal (per-scene override)
    if (tokenDoc) {
      try {
        const tflag = tokenDoc.getFlag?.(FLAG_SCOPE, FLAG_KEY_REVEALED);
        if (typeof tflag === "boolean") return tflag;
      } catch {}
    }

    // 3. Default masking
    return !shouldMaskByDefault(a);
  }

  function isRevealedForKeys(keys) {
    try {
      const globalMaskingEnabled = !!game.settings.get(MOD, "bsrNpcMaskDefault");
      if (!globalMaskingEnabled) return true;
    } catch {}

    const token = resolveTokenFromKeys(keys);
    const actor = token?.actor ?? resolveActorFromKeys(keys);

    // Use centralized check
    return isNpcRevealed(actor, token);
  }

  const clientShouldSeeRealName = () => isGM();

  // -------------------- Maskierung + Observer -------------------------
  function applyMaskedName(msg, li) {
    const titleEl = findTitleNode(li);
    if (!titleEl) return;

    const keys = safeParse(li.dataset.bsrKeys || "[]", []);

    if (isPureGMRoll(keys, msg)) {
      if (!li.dataset.bsrRealName) {
        const real = (msg?.speaker?.alias ?? titleEl.textContent ?? "").trim();
        if (real) li.dataset.bsrRealName = real;
      }
      setTitle(li, titleEl, li.dataset.bsrRealName || titleEl.textContent);
      li.removeAttribute("data-bsr-masked");
      return;
    }

    if (!keys.length) return;

    const actor = resolveActorFromKeys(keys);
    if (!li.dataset.bsrRealName) {
      const real = (msg?.speaker?.alias ?? titleEl.textContent ?? "").trim();
      if (real) li.dataset.bsrRealName = real;
    }

    if (actor?.type === "character") {
      setTitle(
        li,
        titleEl,
        li.dataset.bsrRealName || (keys.find(k => k.startsWith("n:")) || "").slice(2) || titleEl.textContent
      );
      li.removeAttribute("data-bsr-masked");
      return;
    }

    if (clientShouldSeeRealName()) {
      setTitle(
        li,
        titleEl,
        li.dataset.bsrRealName || (keys.find(k => k.startsWith("n:")) || "").slice(2) || titleEl.textContent
      );
      li.removeAttribute("data-bsr-masked");
      return;
    }

    const revealed = isRevealedForKeys(keys);
    if (revealed) {
      setTitle(
        li,
        titleEl,
        li.dataset.bsrRealName || (keys.find(k => k.startsWith("n:")) || "").slice(2) || titleEl.textContent
      );
      li.removeAttribute("data-bsr-masked");
    } else {
      setTitle(li, titleEl, maskLabel());
      li.setAttribute("data-bsr-masked", "1");
    }
  }

  function setTitle(li, el, value) {
    try {
      if (!el || typeof value !== "string") return;
      li.dataset.bsrGuard = "1";
      el.textContent = value;
      requestAnimationFrame(() => { delete li.dataset.bsrGuard; });
    } catch {}
  }

  function installObserver(li) {
    if (!li || li._bsrNameObs) return;

    const header = li.querySelector?.(".message-header");
    if (!header) return;

    const obs = new MutationObserver(() => {
      if (li.dataset.bsrGuard) return;
      const mid = li.dataset.messageId;
      const msg = game.messages?.get?.(mid);
      applyMaskedName(msg, li);
      updateButtonIcon(li);
    });

    obs.observe(header, {
      subtree: true,
      childList: true,
      characterData: true
    });

    li._bsrNameObs = obs;

    const ro = new ResizeObserver(() => {
      if (!document.body.contains(li)) {
        try { obs.disconnect(); } catch {}
        try { ro.disconnect(); } catch {}
        delete li._bsrNameObs;
      }
    });
    ro.observe(header);
  }

  function ensureToggleButton(li) {
    if (!isGM()) return;

    const keys = safeParse(li.dataset.bsrKeys || "[]", []);
    const mid = li.dataset.messageId;
    const msg = game.messages?.get?.(mid);
    if (isPureGMRoll(keys, msg)) return;

    // Skip player character chat cards – toggle is only relevant for NPCs
    const actor = resolveActorFromKeys(keys);
    if (actor?.type === "character") return;

    const headerMeta = li?.querySelector?.(".message-header .message-metadata");
    if (!headerMeta) return;
    if (headerMeta.querySelector?.("a.bsr-toggle-name")) return;

    const a = document.createElement("a");
    a.className = "bsr-toggle-name";
    a.dataset.action = "bsr-toggle-name";
    a.style.marginRight = "0.25rem";

    const toggleLabel = L("BLINDSKILLROLLS.NPC.ToggleNameVisibility", "Toggle name visibility");
    a.setAttribute("aria-label", toggleLabel);
    a.setAttribute("title", toggleLabel);

    const i = document.createElement("i");
    i.className = "fa-solid fa-id-badge fa-fw";
    a.appendChild(i);

    headerMeta.insertBefore(a, headerMeta.firstChild);
  }

  function updateButtonIcon(li) {
    const btn = li?.querySelector?.("a.bsr-toggle-name i");
    if (!btn) return;

    const keys = safeParse(li.dataset.bsrKeys || "[]", []);
    const revealed = isRevealedForKeys(keys);
    btn.className = revealed ? "fa-solid fa-user-secret fa-fw" : "fa-solid fa-id-badge fa-fw";

    const wrap = btn.closest("a.bsr-toggle-name");
    if (wrap) {
      const label = revealed
        ? L("BLINDSKILLROLLS.NPC.HideName", "Hide name")
        : L("BLINDSKILLROLLS.NPC.RevealName", "Reveal name");
      wrap.setAttribute("aria-label", label);
      wrap.setAttribute("title", label);
    }
  }

  /**
   * GM-only: add/update a small permanent-reveal badge in chat cards
   * whose source NPC is currently permanently revealed.
   */
  function updatePermRevealBadge(li) {
    if (!isGM()) return;

    try {
      if (!game.settings.get(MOD, "bsrNpcMaskDefault")) {
        li?.querySelectorAll?.(".bsr-perm-badge")?.forEach(b => b.remove());
        return;
      }
    } catch { return; }

    const keys = safeParse(li?.dataset?.bsrKeys || "[]", []);
    const actor = resolveActorFromKeys(keys);
    const existing = li?.querySelector?.(".message-header .bsr-perm-badge");

    if (actor && actor.type !== "character" && isNpcPermanentlyRevealed(actor)) {
      if (!existing) {
        const headerMeta = li?.querySelector?.(".message-header .message-metadata");
        if (headerMeta) {
          const badge = document.createElement("i");
          badge.className = "fa-solid fa-eye bsr-perm-badge";
          badge.title = L("BLINDSKILLROLLS.NPC.PermRevealedIndicator", "Permanently revealed to players");
          badge.setAttribute("aria-label", badge.title);
          badge.style.marginRight = "0.25rem";
          headerMeta.insertBefore(badge, headerMeta.firstChild);
        }
      }
    } else {
      if (existing) existing.remove();
    }
  }

  function refreshByKeys(filterKeys = null) {
    const list =
      ui?.chat?.element?.querySelector?.("ol.chat-log") ||
      document.querySelector("ol.chat-log");
    if (!list) return;

    list.querySelectorAll(".chat-message[data-message-id]").forEach(li => {
      const keys = safeParse(li.dataset.bsrKeys || "[]", []);
      if (!keys.length) return;
      if (filterKeys && !keys.some(k => filterKeys.includes(k))) return;

      const mid = li.dataset.messageId;
      const msg = game.messages?.get?.(mid);
      applyMaskedName(msg, li);
      updateButtonIcon(li);
      updatePermRevealBadge(li);
    });
  }

  async function toggleRevealFromLi(li) {
    const keys = safeParse(li.dataset.bsrKeys || "[]", []);
    const token = resolveTokenFromKeys(keys);
    if (!token) return;

    const cur = !!token.getFlag(FLAG_SCOPE, FLAG_KEY_REVEALED);
    const next = !cur;
    await token.setFlag(FLAG_SCOPE, FLAG_KEY_REVEALED, next);

    const tokenKeys = keys.filter(k => k.startsWith("tid:") || k.startsWith("t:"));

    const uKey = keys.find(k => k.startsWith("u:"));
    if (uKey) {
      const doc = docFromUuidSync(uKey.slice(2));
      if (doc?.documentName === "Token" || doc?.parent?.documentName === "Token") {
        tokenKeys.push(uKey);
      }
    }

    const refreshKeys = tokenKeys.length ? tokenKeys : keys;

    refreshByKeys(refreshKeys);
    globalThis.BSR_forceRefreshCombatDock?.();
    refreshNativeCombatTracker();

    try {
      game.socket?.emit(`module.${MOD}`, { op: "refreshByKeys", keys: refreshKeys });
      game.socket?.emit(`module.${MOD}`, { op: "refreshCombatDock", full: false });
      game.socket?.emit(`module.${MOD}`, { op: "refreshNativeTracker" });
    } catch {}
  }

  // ---- Persistent (actor-level) reveal toggle ----
  async function togglePermanentReveal(actor) {
    if (!actor) return;
    const base = resolveBaseActor(actor);
    if (!base) return;
    const cur = isNpcPermanentlyRevealed(base);
    const next = !cur;
    await base.setFlag(FLAG_SCOPE, FLAG_KEY_PERM_REVEALED, next);

    // Refresh all UI
    refreshByKeys(null);
    globalThis.BSR_forceRefreshCombatDock?.();
    refreshNativeCombatTracker();

    try {
      game.socket?.emit(`module.${MOD}`, { op: "refreshByKeys", keys: null });
      game.socket?.emit(`module.${MOD}`, { op: "refreshCombatDock", full: false });
      game.socket?.emit(`module.${MOD}`, { op: "refreshNativeTracker" });
    } catch {}
  }

  // ---- Toggle reveal from combat tracker entry ----
  async function toggleRevealFromCombatant(entry) {
    const combatantId = entry?.dataset?.combatantId;
    const combatant = combatantId ? game.combat?.combatants?.get?.(combatantId) : null;
    if (!combatant) return;

    const tokenDoc = combatant.token ?? null;
    if (!tokenDoc) return;

    const cur = !!tokenDoc.getFlag(FLAG_SCOPE, FLAG_KEY_REVEALED);
    const next = !cur;
    await tokenDoc.setFlag(FLAG_SCOPE, FLAG_KEY_REVEALED, next);

    // Build refresh keys for this specific token
    const tid = tokenDoc.id;
    const sceneId = combatant.combat?.scene?.id ?? canvas?.scene?.id;
    const keys = [];
    if (tid) keys.push(`tid:${tid}`);
    if (sceneId && tid) keys.push(`t:Scene.${sceneId}.Token.${tid}`);
    const refreshKeys = keys.length ? keys : null;

    refreshByKeys(refreshKeys);
    globalThis.BSR_forceRefreshCombatDock?.();
    refreshNativeCombatTracker();

    try {
      game.socket?.emit(`module.${MOD}`, { op: "refreshByKeys", keys: refreshKeys });
      game.socket?.emit(`module.${MOD}`, { op: "refreshCombatDock", full: false });
      game.socket?.emit(`module.${MOD}`, { op: "refreshNativeTracker" });
    } catch {}
  }

  // ---- Refresh native combat tracker ----
  function refreshNativeCombatTracker() {
    try { ui.combat?.render(); } catch {}
  }

  // ---- GM-only: add hide/reveal toggle buttons in combat tracker ----
  function addCombatTrackerToggleButtons(html) {
    if (!(html instanceof HTMLElement)) return;
    if (!isGM()) return;

    try {
      if (!game.settings.get(MOD, "bsrNpcMaskDefault")) return;
    } catch { return; }

    const entries = html.querySelectorAll(".combatant");
    for (const entry of entries) {
      // Remove stale buttons from previous renders
      entry.querySelectorAll(".bsr-ct-toggle").forEach(b => b.remove());

      const combatantId = entry.dataset?.combatantId;
      if (!combatantId) continue;

      const combatant = game.combat?.combatants?.get?.(combatantId);
      if (!combatant) continue;

      const actor = combatant.actor ?? null;
      if (!actor || actor.type === "character") continue;

      const tokenDoc = combatant.token ?? null;
      const revealed = isNpcRevealed(actor, tokenDoc);

      const btn = document.createElement("a");
      btn.className = "bsr-ct-toggle";
      btn.dataset.combatantId = combatantId;

      const icon = document.createElement("i");
      icon.className = revealed
        ? "fa-solid fa-id-badge fa-fw"
        : "fa-solid fa-mask fa-fw";
      btn.appendChild(icon);

      const tooltip = revealed
        ? L("BLINDSKILLROLLS.NPC.HideName", "Hide name")
        : L("BLINDSKILLROLLS.NPC.RevealName", "Reveal name");
      btn.title = tooltip;
      btn.setAttribute("aria-label", tooltip);

      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        toggleRevealFromCombatant(entry);
      });

      const controlsEl = entry.querySelector(".combatant-controls");
      if (controlsEl) controlsEl.prepend(btn);
    }
  }

  // -------------------- Combat Tracker Dock integration --------------------
  (() => {
    const DOCK_MOD = "combat-tracker-dock";

    function trackerMaskLabel() {
      return maskLabel();
    }

    function getCombatantTokenDoc(combatant) {
      try {
        if (combatant?.token?.documentName === "Token") return combatant.token;
      } catch {}

      try {
        const sceneId = combatant?.sceneId || combatant?.combat?.scene?.id || canvas?.scene?.id;
        const tokenId = combatant?.tokenId || combatant?.token?.id;
        if (sceneId && tokenId) {
          return docFromUuidSync(`Scene.${sceneId}.Token.${tokenId}`) ?? null;
        }
      } catch {}

      return null;
    }

    function isCombatantRevealed(combatant) {
      const tokenDoc = getCombatantTokenDoc(combatant);
      const actor = combatant?.actor ?? tokenDoc?.actor ?? null;
      return isNpcRevealed(actor, tokenDoc);
    }

    function getCombatantRealName(combatant) {
      const tokenDoc = getCombatantTokenDoc(combatant);
      return (
        tokenDoc?.name ||
        combatant?.token?.name ||
        combatant?.actor?.name ||
        combatant?.name ||
        trackerMaskLabel()
      );
    }

    function getTrackerDisplayName(combatant) {
      if (!combatant) return trackerMaskLabel();
      if (game.user?.isGM) return getCombatantRealName(combatant);

      const tokenDoc = getCombatantTokenDoc(combatant);
      const actor = combatant?.actor ?? tokenDoc?.actor ?? null;

      if (actor?.type === "character") return getCombatantRealName(combatant);

      return isCombatantRevealed(combatant)
        ? getCombatantRealName(combatant)
        : trackerMaskLabel();
    }

    function forceRefreshCombatDock({ full = false } = {}) {
      try {
        const dock = ui?.combatDock;
        if (!dock) return;

        const hasElement =
          !!dock.element ||
          !!dock.rendered ||
          !!document.querySelector("#combat-dock");

        if (full && hasElement && typeof dock.setupCombatants === "function") {
          try {
            dock.setupCombatants();
          } catch (e) {
            globalThis.dbgWarn?.("BSR | dock.setupCombatants failed", e);
          }
        }

        if (typeof dock.updateCombatants === "function") {
          try {
            dock.updateCombatants();
          } catch (e) {
            globalThis.dbgWarn?.("BSR | dock.updateCombatants failed", e);
          }
        }

        if (typeof dock.autosize === "function") {
          try {
            dock.autosize();
          } catch {}
        }

        if (!hasElement && typeof dock.render === "function") {
          try {
            dock.render(true);
          } catch (e) {
            globalThis.dbgWarn?.("BSR | dock.render failed", e);
          }
        }
      } catch (e) {
        globalThis.dbgWarn?.("BSR | forceRefreshCombatDock failed", e);
      }
    }

    function emitCombatDockRefresh(full = false) {
      forceRefreshCombatDock({ full });

      try {
        game.socket?.emit(`module.${MOD}`, {
          op: "refreshCombatDock",
          full: !!full
        });
      } catch {}
    }

    Hooks.once(`${DOCK_MOD}-init`, (api) => {
      try {
        const PortraitClass =
          api?.CombatantPortrait ??
          CONFIG?.combatTrackerDock?.CombatantPortrait;

        if (!PortraitClass?.prototype) return;

        const descriptor = Object.getOwnPropertyDescriptor(PortraitClass.prototype, "name");
        if (!descriptor?.get) return;
        if (descriptor.get?._bsrPatched) return;

        const originalGetter = descriptor.get;

        const wrappedGetter = function () {
          try {
            originalGetter.call(this);
          } catch {}
          return getTrackerDisplayName(this.combatant);
        };

        wrappedGetter._bsrPatched = true;

        Object.defineProperty(PortraitClass.prototype, "name", {
          get: wrappedGetter,
          configurable: true
        });

        forceRefreshCombatDock();
      } catch (e) {
        globalThis.dbgWarn?.("BSR | failed to patch Combat Tracker Dock", e);
      }
    });

    Hooks.on("updateToken", (_scene, _token, diff) => {
      try {
        const fs = diff?.flags?.[FLAG_SCOPE];
        if (fs && Object.prototype.hasOwnProperty.call(fs, FLAG_KEY_REVEALED)) {
          forceRefreshCombatDock();
        }
      } catch {}
    });

    Hooks.on("updateCombatant", () => forceRefreshCombatDock());
    Hooks.on("createCombatant", () => forceRefreshCombatDock());
    Hooks.on("deleteCombatant", () => forceRefreshCombatDock());
    Hooks.on("renderCombatTracker", () => {
      setTimeout(() => forceRefreshCombatDock(), 0);
    });

    globalThis.BSR_forceRefreshCombatDock = forceRefreshCombatDock;
    globalThis.BSR_emitCombatDockRefresh = emitCombatDockRefresh;
  })();

  // -------------------- Native Combat Tracker masking --------------------
  function maskNativeCombatTracker(html) {
    if (!(html instanceof HTMLElement)) return;
    if (isGM()) return; // GM always sees real names

    try {
      if (!game.settings.get(MOD, "bsrNpcMaskDefault")) return;
    } catch { return; }

    const entries = html.querySelectorAll(".combatant");
    for (const entry of entries) {
      const combatantId = entry.dataset?.combatantId;
      if (!combatantId) continue;

      const combatant = game.combat?.combatants?.get?.(combatantId);
      if (!combatant) continue;

      const actor = combatant.actor ?? null;
      if (actor?.type === "character") continue;

      const tokenDoc = combatant.token ?? null;
      if (!isNpcRevealed(actor, tokenDoc)) {
        const nameEl = entry.querySelector(".token-name h4")
          ?? entry.querySelector(".combatant-name")
          ?? entry.querySelector(".token-name");
        if (nameEl) nameEl.textContent = maskLabel();
      }
    }
  }

  function markRevealedInCombatTracker(html) {
    if (!(html instanceof HTMLElement)) return;
    if (!isGM()) return; // only for GM

    try {
      if (!game.settings.get(MOD, "bsrNpcMaskDefault")) return;
    } catch { return; }

    const entries = html.querySelectorAll(".combatant");
    for (const entry of entries) {
      // Remove any stale badge
      entry.querySelectorAll(".bsr-perm-badge").forEach(b => b.remove());

      const combatantId = entry.dataset?.combatantId;
      if (!combatantId) continue;

      const combatant = game.combat?.combatants?.get?.(combatantId);
      if (!combatant) continue;

      const actor = combatant.actor ?? null;
      if (!actor || actor.type === "character") continue;

      if (isNpcPermanentlyRevealed(actor)) {
        const nameEl = entry.querySelector(".token-name h4")
          ?? entry.querySelector(".combatant-name")
          ?? entry.querySelector(".token-name");
        if (nameEl && !nameEl.querySelector(".bsr-perm-badge")) {
          const badge = document.createElement("i");
          badge.className = "fa-solid fa-eye bsr-perm-badge";
          badge.title = L("BLINDSKILLROLLS.NPC.PermRevealedIndicator", "Permanently revealed to players");
          badge.setAttribute("aria-label", badge.title);
          nameEl.appendChild(badge);
        }
      }
    }
  }

  // ---- Context menu helpers ----
  function getActorFromDirEntry(el) {
    const actorId = el?.dataset?.documentId ?? el?.dataset?.entryId ?? el?.dataset?.actorId;
    return actorId ? game.actors?.get?.(actorId) ?? null : null;
  }

  function getActorFromCombatantEntry(el) {
    const combatantId = el?.dataset?.combatantId;
    const combatant = combatantId ? game.combat?.combatants?.get?.(combatantId) : null;
    return resolveBaseActor(combatant?.actor) ?? null;
  }

  function getActorFromChatEntry(el) {
    const keys = safeParse(el?.dataset?.bsrKeys || "[]", []);
    if (keys.length) {
      const actor = resolveActorFromKeys(keys);
      if (actor) return resolveBaseActor(actor);
    }
    // Fallback: resolve actor from the message document
    const messageId = el?.dataset?.messageId;
    if (messageId) {
      const msg = game.messages?.get?.(messageId);
      if (msg?.actor) return resolveBaseActor(msg.actor);
      if (msg?.speaker?.actor) return resolveBaseActor(game.actors?.get?.(msg.speaker.actor)) ?? null;
    }
    return null;
  }

  // ---- Context menu: Actor Directory (v13 hook: getActorContextOptions) ----
  Hooks.on("getActorContextOptions", (app, menuItems) => {
    menuItems.push({
      name: L("BLINDSKILLROLLS.NPC.TogglePermanentReveal", "Toggle Permanent NPC Reveal"),
      icon: '<i class="fa-solid fa-id-badge"></i>',
      condition: (el) => {
        if (!game.user?.isGM) return false;
        const actor = getActorFromDirEntry(el);
        return actor && actor.type !== "character";
      },
      callback: (el) => {
        const actor = getActorFromDirEntry(el);
        if (actor) togglePermanentReveal(actor);
      }
    });
  });

  // ---- Context menu: Combat Tracker ----
  function bsrCombatTrackerContextHandler(_app, menuItems) {
    if (menuItems.some(e => e._bsrPermReveal)) return;
    menuItems.push({
      _bsrPermReveal: true,
      name: L("BLINDSKILLROLLS.NPC.TogglePermanentReveal", "Toggle Permanent NPC Reveal"),
      icon: '<i class="fa-solid fa-id-badge"></i>',
      condition: (el) => {
        if (!game.user?.isGM) return false;
        const actor = getActorFromCombatantEntry(el);
        return actor && actor.type !== "character";
      },
      callback: (el) => {
        const actor = getActorFromCombatantEntry(el);
        if (actor) togglePermanentReveal(actor);
      }
    });
  }
  Hooks.on("getCombatTrackerContextOptions", bsrCombatTrackerContextHandler);
  Hooks.on("getCombatantContextOptions", bsrCombatTrackerContextHandler);

  // ---- Context menu: Chat Card (v13 hook: getChatMessageContextOptions) ----
  Hooks.on("getChatMessageContextOptions", (app, menuItems) => {
    menuItems.push({
      name: L("BLINDSKILLROLLS.NPC.TogglePermanentReveal", "Toggle Permanent NPC Reveal"),
      icon: '<i class="fa-solid fa-id-badge"></i>',
      condition: (el) => {
        if (!game.user?.isGM) return false;
        const actor = getActorFromChatEntry(el);
        return actor && actor.type !== "character";
      },
      callback: (el) => {
        const actor = getActorFromChatEntry(el);
        if (actor) togglePermanentReveal(actor);
      }
    });
  });

  // ------------------------------ Hooks --------------------------------
  Hooks.on("renderChatMessageHTML", (message, li) => {
    try {
      attachKeys(li, message);
      if (isGM()) ensureToggleButton(li);
      applyMaskedName(message, li);
      installObserver(li);
      updateButtonIcon(li);
      updatePermRevealBadge(li);
    } catch (e) {
      globalThis.dbgWarn?.(game.i18n.localize("BLINDSKILLROLLS.Log.NPCRLRCMHFailed"), e);
    }
  });

  Hooks.once("ready", () => {
    const chatRoot = ui?.chat?.element || document;
    chatRoot.addEventListener?.("click", (ev) => {
      const a = ev.target?.closest?.("a.bsr-toggle-name");
      if (!a) return;
      if (!isGM()) return;
      const li = a.closest?.(".chat-message");
      if (!li) return;

      ev.preventDefault();
      ev.stopPropagation();
      toggleRevealFromLi(li);
    }, true);

    game.socket?.on?.(`module.${MOD}`, (payload) => {
      if (!payload || typeof payload !== "object") return;

      if (payload.op === "refreshByKeys") {
        refreshByKeys(payload.keys || null);
        return;
      }

      if (payload.op === "refreshCombatDock") {
        globalThis.BSR_forceRefreshCombatDock?.({ full: !!payload.full });
      }

      if (payload.op === "refreshNativeTracker") {
        refreshNativeCombatTracker();
      }
    });

    Hooks.on("updateSetting", (setting) => {
      if (
        setting.key === `${MOD}.bsrNpcMaskDefault` ||
        setting.key === `${MOD}.bsrNpcNameReplacement`
      ) {
        setTimeout(() => {
          refreshByKeys(null);
          globalThis.BSR_forceRefreshCombatDock?.();
          refreshNativeCombatTracker();
        }, 50);
      }
    });

    setTimeout(() => {
      refreshByKeys(null);
      globalThis.BSR_forceRefreshCombatDock?.();
      refreshNativeCombatTracker();
    }, 50);

    window.BSR_102.load_count += 1;
    BSR_102.load_complete();
  });

  Hooks.on("updateToken", (scene, token, diff) => {
    try {
      const fs = diff?.flags?.[FLAG_SCOPE];
      if (fs && Object.prototype.hasOwnProperty.call(fs, FLAG_KEY_REVEALED)) {
        const tid = token._id || token.id;
        const tUuid = `Scene.${scene.id}.Token.${tid}`;
        const keys = [`tid:${tid}`, `t:${tUuid}`];
        refreshByKeys(keys);
        globalThis.BSR_forceRefreshCombatDock?.();
        refreshNativeCombatTracker();
      }
    } catch {}
  });

  // Refresh all UI when an actor's permanent reveal flag changes
  Hooks.on("updateActor", (actor, diff) => {
    try {
      const fs = diff?.flags?.[FLAG_SCOPE];
      if (fs && Object.prototype.hasOwnProperty.call(fs, FLAG_KEY_PERM_REVEALED)) {
        refreshByKeys(null);
        globalThis.BSR_forceRefreshCombatDock?.();
        refreshNativeCombatTracker();
      }
    } catch {}
  });

  // Native combat tracker: mask NPC names for players + mark revealed for GM + toggle buttons
  Hooks.on("renderCombatTracker", (_app, html) => {
    try {
      maskNativeCombatTracker(html);
    } catch (e) {
      globalThis.dbgWarn?.("BSR | maskNativeCombatTracker failed", e);
    }
    try {
      markRevealedInCombatTracker(html);
    } catch (e) {
      globalThis.dbgWarn?.("BSR | markRevealedInCombatTracker failed", e);
    }
    try {
      addCombatTrackerToggleButtons(html);
    } catch (e) {
      globalThis.dbgWarn?.("BSR | addCombatTrackerToggleButtons failed", e);
    }
  });

  globalThis.BSR_refreshByKeys = refreshByKeys;
  globalThis.BSR_refreshNativeCombatTracker = refreshNativeCombatTracker;

})();
window.BSR_102.load_count += 1;
