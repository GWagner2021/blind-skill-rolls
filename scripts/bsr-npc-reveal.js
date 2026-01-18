// scripts/npc-reveal-live.js

(() => {
  "use strict";

  const MOD = "blind-skill-rolls";
  const FLAG_SCOPE = MOD;
  const FLAG_KEY_REVEALED = "revealed";

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

  // ----------------------------- Utils --------------------------------
  const isGM = () => !!game.user?.isGM;
  const uniq = (arr) => Array.from(new Set(arr));
  const safeParse = (s, fb = []) => { try { return JSON.parse(s); } catch { return fb; } };
  const getActorById = (id) => game.actors?.get?.(id) ?? null;

  function docFromUuidSync(uuid) {
    try { return globalThis.fromUuidSync?.(uuid) ?? null; }
    catch { return null; }
  }

  function resolveActorFromKeys(keys) {
    const aid = (keys.find(k => k.startsWith("aid:")) || "").slice(4) || null;
    if (aid) {
      const a = getActorById(aid);
      if (a) return a;
    }
    const tKey = keys.find(k => k.startsWith("t:")) || keys.find(k => k.startsWith("u:"));
    if (tKey) {
      const uu = tKey.slice(2);
      const doc = docFromUuidSync(uu);
      if (doc?.documentName === "Token") return doc.actor ?? null;
      if (doc?.documentName === "Actor") return doc;
      if (doc?.actor) return doc.actor;
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

  function shouldMaskByDefault(actor) {
    if (!actor) return true;
    if (actor.type === "character") return false;
    return true;
  }

  function isRevealedForKeys(keys) {
    try {
      const tKey = keys.find(k => k.startsWith("t:")) || keys.find(k => k.startsWith("u:"));
      if (tKey) {
        const tuuid = tKey.slice(2);
        const tok = docFromUuidSync(tuuid);
        const tflag = tok?.getFlag?.(FLAG_SCOPE, FLAG_KEY_REVEALED);
        if (typeof tflag === "boolean") return tflag;
      }
    } catch {}

    const actor = resolveActorFromKeys(keys);
    if (actor) {
      try {
        const aflag = actor.getFlag(FLAG_SCOPE, FLAG_KEY_REVEALED);
        if (typeof aflag === "boolean") return aflag;
      } catch {}
      return !shouldMaskByDefault(actor);
    }
    return false;
  }

  const clientShouldSeeRealName = () => isGM();

  // -------------------- Maskierung + Observer -------------------------
  function applyMaskedName(msg, li) {
    const titleEl = findTitleNode(li);
    if (!titleEl) return;

    const keys = safeParse(li.dataset.bsrKeys || "[]", []);
    if (!keys.length) return;

    const actor = resolveActorFromKeys(keys);
    if (!li.dataset.bsrRealName) {
      const real = (msg?.speaker?.alias ?? titleEl.textContent ?? "").trim();
      if (real) li.dataset.bsrRealName = real;
    }

    if (actor?.type === "character") {
      setTitle(li, titleEl, li.dataset.bsrRealName || (keys.find(k => k.startsWith("n:")) || "").slice(2) || titleEl.textContent);
      li.removeAttribute("data-bsr-masked");
      return;
    }

    if (clientShouldSeeRealName()) {
      setTitle(li, titleEl, li.dataset.bsrRealName || (keys.find(k => k.startsWith("n:")) || "").slice(2) || titleEl.textContent);
      li.removeAttribute("data-bsr-masked");
      return;
    }

    const revealed = isRevealedForKeys(keys);
    if (revealed) {
      setTitle(li, titleEl, li.dataset.bsrRealName || (keys.find(k => k.startsWith("n:")) || "").slice(2) || titleEl.textContent);
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

  // -------------------- GM-Button & Refresh ---------------------------
  function ensureToggleButton(li) {
    if (!isGM()) return;
    const headerMeta = li?.querySelector?.(".message-header .message-metadata");
    if (!headerMeta) return;
    if (headerMeta.querySelector?.("a.bsr-toggle-name")) return;

    const a = document.createElement("a");
    a.className = "bsr-toggle-name";
    a.dataset.action = "bsr-toggle-name";
    a.style.marginRight = "0.25rem";
    a.setAttribute("aria-label", "Toggle name visibility");

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
    if (wrap) wrap.setAttribute("aria-label", revealed ? "Hide name (all)" : "Reveal name (all)");
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
    });
  }

  async function toggleRevealFromLi(li) {
    const keys = safeParse(li.dataset.bsrKeys || "[]", []);
    const actor = resolveActorFromKeys(keys);
    if (!actor) return;

    const cur = !!actor.getFlag(FLAG_SCOPE, FLAG_KEY_REVEALED);
    const next = !cur;
    await actor.setFlag(FLAG_SCOPE, FLAG_KEY_REVEALED, next);

    refreshByKeys(keys);
    try {
      game.socket?.emit(`module.${MOD}`, { op: "refreshByKeys", keys });
    } catch {}
  }

  // ------------------------------ Hooks --------------------------------
  Hooks.on("renderChatMessageHTML", (message, li) => {
    try {
      attachKeys(li, message);
      if (isGM()) ensureToggleButton(li);
      applyMaskedName(message, li);
      installObserver(li);
      updateButtonIcon(li);
    } catch (e) {
      console.warn("[BSR] npc-reveal-live renderChatMessageHTML failed", e);
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
      }
    });
    setTimeout(() => refreshByKeys(null), 50);

    console.log(
      `%c${MOD}%c | NPC Name reveal ready`,
      'color:#8B0000;font-weight:700;',
      'color:inherit;'
    );
  });

  Hooks.on("updateActor", (actor, diff) => {
    try {
      const fs = diff?.flags?.[FLAG_SCOPE];
      if (fs && Object.prototype.hasOwnProperty.call(fs, FLAG_KEY_REVEALED)) {
        const keys = [`aid:${actor.id}`, `a:Actor.${actor.id}`, `n:${actor.name}`];
        refreshByKeys(keys);
      }
    } catch {}
  });

  Hooks.on("updateToken", (scene, token, diff) => {
    try {
      const fs = diff?.flags?.[FLAG_SCOPE];
      if (fs && Object.prototype.hasOwnProperty.call(fs, FLAG_KEY_REVEALED)) {
        const tid = token._id || token.id;
        const tUuid = `Scene.${scene.id}.Token.${tid}`;
        const keys = [`tid:${tid}`, `t:${tUuid}`];
        refreshByKeys(keys);
      }
    } catch {}
  });

  globalThis.BSR_refreshByKeys = refreshByKeys;
})();
