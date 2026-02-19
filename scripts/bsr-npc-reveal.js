// scripts/bsr-npc-reveal.js

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

    if (hasActorKeys) {
      return false;
    }

    const hasActorDoc = !!message?.actor;
    const hasActorInSpeaker = !!(message?.speaker?.actor || message?.speaker?.token);

    if (hasActorDoc || hasActorInSpeaker) {
      return false;
    }

    return true;
  }

  function shouldMaskByDefault(actor) {
    if (!actor) {

      try {
        const setting = !!game.settings.get(MOD, "bsrNpcMaskDefault");
        return setting;
      } catch (e) {
        return true;
      }
    }

    if (actor.type === "character") {
      return false;
    }

    try {
      const maskingEnabled = !!game.settings.get(MOD, "bsrNpcMaskDefault");
      return maskingEnabled;
    } catch (e) {


      return true;
    }
  }

  function isRevealedForKeys(keys) {
    try {
      const globalMaskingEnabled = !!game.settings.get(MOD, "bsrNpcMaskDefault");
      if (!globalMaskingEnabled) {
        return true;
      }
    } catch (e) {

    }

    const token = resolveTokenFromKeys(keys);
    if (token) {
      try {
        const tflag = token.getFlag?.(FLAG_SCOPE, FLAG_KEY_REVEALED);
        if (typeof tflag === "boolean") {
          return tflag;
        }
      } catch {}
      const actor = token.actor ?? resolveActorFromKeys(keys);
      const shouldMask = shouldMaskByDefault(actor);
      const result = !shouldMask;
      return result;
    }

    const actor = resolveActorFromKeys(keys);
    const shouldMask = shouldMaskByDefault(actor);
    const result = !shouldMask;
    return result;
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

    const actorName = li.dataset.bsrRealName || (keys.find(k => k.startsWith("n:")) || "").slice(2) || "Unknown";

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

  function ensureToggleButton(li) {
    if (!isGM()) return;


    const keys = safeParse(li.dataset.bsrKeys || "[]", []);
    const mid = li.dataset.messageId;
    const msg = game.messages?.get?.(mid);
    if (isPureGMRoll(keys, msg)) {
      return;
    }

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

  function refreshByKeys(filterKeys = null) {

    const list =
      ui?.chat?.element?.querySelector?.("ol.chat-log") ||
      document.querySelector("ol.chat-log");
    if (!list) return;

    let refreshCount = 0;
    list.querySelectorAll(".chat-message[data-message-id]").forEach(li => {
      const keys = safeParse(li.dataset.bsrKeys || "[]", []);
      if (!keys.length) return;
      if (filterKeys && !keys.some(k => filterKeys.includes(k))) return;
      const mid = li.dataset.messageId;
      const msg = game.messages?.get?.(mid);
      applyMaskedName(msg, li);
      updateButtonIcon(li);
      refreshCount++;
    });

  }

  async function toggleRevealFromLi(li) {
    const keys = safeParse(li.dataset.bsrKeys || "[]", []);
    const token = resolveTokenFromKeys(keys);

    if (!token) {
      return;
    }

    const cur = !!token.getFlag(FLAG_SCOPE, FLAG_KEY_REVEALED);
    const next = !cur;
    await token.setFlag(FLAG_SCOPE, FLAG_KEY_REVEALED, next);

    const tokenKeys = keys.filter(k =>
      k.startsWith("tid:") || k.startsWith("t:")
    );

    const uKey = keys.find(k => k.startsWith("u:"));
    if (uKey) {
      const doc = docFromUuidSync(uKey.slice(2));
      if (doc?.documentName === "Token" || doc?.parent?.documentName === "Token") {
        tokenKeys.push(uKey);
      }
    }

    refreshByKeys(tokenKeys.length ? tokenKeys : keys);

    try {
      game.socket?.emit(`module.${MOD}`, { op: "refreshByKeys", keys: tokenKeys.length ? tokenKeys : keys });
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
      console.warn(game.i18n.localize("BLINDSKILLROLLS.Log.NPCRLRCMHFailed"), e);
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

    Hooks.on("updateSetting", (setting) => {
      if (setting.key === `${MOD}.bsrNpcMaskDefault`) {
        setTimeout(() => refreshByKeys(null), 50);
      }
    });

    setTimeout(() => refreshByKeys(null), 50);

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
      }
    } catch {}
  });

  globalThis.BSR_refreshByKeys = refreshByKeys;

})();
window.BSR_102.load_count += 1;