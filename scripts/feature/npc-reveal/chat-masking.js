import { MOD } from "../../core/constants.js";
import { FLAG_SCOPE, FLAG_KEY_REVEALED, maskLabel, L, isGM, uniq, safeParse, resolveActorFromKeys, resolveTokenFromKeys, isPureGMRoll, isRevealedForKeys, isNpcPermanentlyRevealed, clientShouldSeeRealName, docFromUuidSync } from "./reveal-state.js";
// ---- Key-Attachment ----
export function attachKeys(li, message) {
    if (!li || !message)
        return;
    const keys = [];
    const speaker = message?.speaker ?? {};
    const actorDoc = message?.actor ?? null;
    const actorId = actorDoc?.id || speaker.actor || null;
    const actorName = actorDoc?.name || speaker.alias || "";
    const tokenId = speaker.token || null;
    const uuidFromHeader = li.querySelector?.(".message-header a.avatar[data-uuid]")?.dataset?.uuid || "";
    const tokenUuid = (tokenId && canvas?.scene) ? `Scene.${canvas.scene.id}.Token.${tokenId}` : "";
    if (actorName)
        keys.push(`n:${actorName}`);
    if (actorId)
        keys.push(`aid:${actorId}`, `a:Actor.${actorId}`);
    if (tokenId)
        keys.push(`tid:${tokenId}`);
    if (tokenUuid)
        keys.push(`t:${tokenUuid}`);
    if (uuidFromHeader)
        keys.push(`u:${uuidFromHeader}`);
    if (keys.length)
        li.dataset.bsrKeys = JSON.stringify(uniq(keys));
}
// ---- DOM-Helpers ----
function findTitleNode(li) {
    return li?.querySelector?.(".message-header .name-stacked .title") ?? null;
}
function setTitle(li, el, value) {
    try {
        if (!el || typeof value !== "string")
            return;
        li.dataset.bsrGuard = "1";
        el.textContent = value;
        requestAnimationFrame(() => { delete li.dataset.bsrGuard; });
    }
    catch { /* ignore */ }
}
// ---- Masking ----
export function applyMaskedName(msg, li) {
    const titleEl = findTitleNode(li);
    if (!titleEl)
        return;
    const keys = safeParse(li.dataset.bsrKeys || "[]", []);
    if (isPureGMRoll(keys, msg)) {
        if (!li.dataset.bsrRealName) {
            const real = (msg?.speaker?.alias ?? titleEl.textContent ?? "").trim();
            if (real)
                li.dataset.bsrRealName = real;
        }
        setTitle(li, titleEl, li.dataset.bsrRealName || titleEl.textContent || "");
        li.removeAttribute("data-bsr-masked");
        return;
    }
    if (!keys.length)
        return;
    const actor = resolveActorFromKeys(keys);
    if (!li.dataset.bsrRealName) {
        const real = (msg?.speaker?.alias ?? titleEl.textContent ?? "").trim();
        if (real)
            li.dataset.bsrRealName = real;
    }
    if (actor?.type === "character") {
        setTitle(li, titleEl, li.dataset.bsrRealName || (keys.find(k => k.startsWith("n:")) || "").slice(2) || titleEl.textContent || "");
        li.removeAttribute("data-bsr-masked");
        return;
    }
    if (clientShouldSeeRealName()) {
        setTitle(li, titleEl, li.dataset.bsrRealName || (keys.find(k => k.startsWith("n:")) || "").slice(2) || titleEl.textContent || "");
        li.removeAttribute("data-bsr-masked");
        return;
    }
    const revealed = isRevealedForKeys(keys);
    if (revealed) {
        setTitle(li, titleEl, li.dataset.bsrRealName || (keys.find(k => k.startsWith("n:")) || "").slice(2) || titleEl.textContent || "");
        li.removeAttribute("data-bsr-masked");
    }
    else {
        setTitle(li, titleEl, maskLabel());
        li.setAttribute("data-bsr-masked", "1");
    }
}
// ---- Observer ----
export function installObserver(li) {
    if (!li || li._bsrNameObs)
        return;
    const header = li.querySelector?.(".message-header");
    if (!header)
        return;
    const obs = new MutationObserver(() => {
        if (li.dataset.bsrGuard)
            return;
        applyMaskedName(game.messages?.get?.(li.dataset.messageId), li);
        updateButtonIcon(li);
    });
    obs.observe(header, { subtree: true, childList: true, characterData: true });
    li._bsrNameObs = obs;
    const ro = new ResizeObserver(() => {
        if (!document.body.contains(li)) {
            try {
                obs.disconnect();
            }
            catch { /* ignore */ }
            try {
                ro.disconnect();
            }
            catch { /* ignore */ }
            delete li._bsrNameObs;
        }
    });
    ro.observe(header);
}
// ---- Toggle-Button ----
export function ensureToggleButton(li) {
    if (!isGM())
        return;
    const keys = safeParse(li.dataset.bsrKeys || "[]", []);
    const msg = game.messages?.get?.(li.dataset.messageId);
    if (isPureGMRoll(keys, msg))
        return;
    const actor = resolveActorFromKeys(keys);
    if (actor?.type === "character")
        return;
    const headerMeta = li?.querySelector?.(".message-header .message-metadata");
    if (!headerMeta)
        return;
    if (headerMeta.querySelector?.("a.bsr-toggle-name"))
        return;
    const a = document.createElement("a");
    a.className = "bsr-toggle-name bsr-meta-icon";
    a.dataset.action = "bsr-toggle-name";
    const toggleLabel = L("BSR.NPC.Action.ToggleNameVisibility", "Toggle name visibility");
    a.setAttribute("aria-label", toggleLabel);
    a.setAttribute("title", toggleLabel);
    const i = document.createElement("i");
    i.className = "fa-solid fa-id-badge fa-fw";
    a.appendChild(i);
    headerMeta.insertBefore(a, headerMeta.firstChild);
}
// ---- Button-Icon ----
export function updateButtonIcon(li) {
    const btn = li?.querySelector?.("a.bsr-toggle-name i");
    if (!btn)
        return;
    const keys = safeParse(li.dataset.bsrKeys || "[]", []);
    const revealed = isRevealedForKeys(keys);
    btn.className = revealed ? "fa-solid fa-user-secret fa-fw" : "fa-solid fa-id-badge fa-fw";
    const wrap = btn.closest("a.bsr-toggle-name");
    if (wrap) {
        const label = revealed ? L("BSR.NPC.Action.HideName", "Hide name") : L("BSR.NPC.Action.RevealName", "Reveal name");
        wrap.setAttribute("aria-label", label);
        wrap.setAttribute("title", label);
    }
}
// ---- Perm-Reveal-Badge ----
export function updatePermRevealBadge(li) {
    if (!isGM())
        return;
    try {
        if (!game.settings.get(MOD, "bsrNpcMaskDefault")) {
            li?.querySelectorAll?.(".bsr-perm-badge")?.forEach(b => b.remove());
            return;
        }
    }
    catch {
        return;
    }
    const keys = safeParse(li?.dataset?.bsrKeys || "[]", []);
    const actor = resolveActorFromKeys(keys);
    const existing = li?.querySelector?.(".message-header .bsr-perm-badge");
    if (actor && actor.type !== "character" && isNpcPermanentlyRevealed(actor)) {
        if (!existing) {
            const headerMeta = li?.querySelector?.(".message-header .message-metadata");
            if (headerMeta) {
                const badge = document.createElement("i");
                badge.className = "fa-solid fa-eye bsr-perm-badge bsr-meta-icon";
                badge.title = L("BSR.NPC.Label.PermRevealedIndicator", "Permanently revealed to players");
                badge.setAttribute("aria-label", badge.title);
                headerMeta.insertBefore(badge, headerMeta.firstChild);
            }
        }
    }
    else {
        if (existing)
            existing.remove();
    }
}
// ---- Refresh ----
export function refreshByKeys(filterKeys = null) {
    const list = ui?.chat?.element?.querySelector?.("ol.chat-log") || document.querySelector("ol.chat-log");
    if (!list)
        return;
    list.querySelectorAll(".chat-message[data-message-id]").forEach(li => {
        const keys = safeParse(li.dataset.bsrKeys || "[]", []);
        if (!keys.length)
            return;
        if (filterKeys && !keys.some(k => filterKeys.includes(k)))
            return;
        applyMaskedName(game.messages?.get?.(li.dataset.messageId), li);
        updateButtonIcon(li);
        updatePermRevealBadge(li);
    });
}
export async function toggleRevealFromLi(li, { refreshCombatDock, refreshNativeCombatTracker }) {
    const keys = safeParse(li.dataset.bsrKeys || "[]", []);
    const token = resolveTokenFromKeys(keys);
    if (!token)
        return;
    await token.setFlag(FLAG_SCOPE, FLAG_KEY_REVEALED, !token.getFlag(FLAG_SCOPE, FLAG_KEY_REVEALED));
    const tokenKeys = keys.filter(k => k.startsWith("tid:") || k.startsWith("t:"));
    const uKey = keys.find(k => k.startsWith("u:"));
    if (uKey) {
        const doc = docFromUuidSync(uKey.slice(2));
        if (doc?.documentName === "Token" || doc?.parent?.documentName === "Token")
            tokenKeys.push(uKey);
    }
    const refreshKeys = tokenKeys.length ? tokenKeys : keys;
    refreshByKeys(refreshKeys);
    refreshCombatDock();
    refreshNativeCombatTracker();
    try {
        game.socket?.emit(`module.${MOD}`, { op: "refreshByKeys", keys: refreshKeys });
        game.socket?.emit(`module.${MOD}`, { op: "refreshCombatDock", full: false });
        game.socket?.emit(`module.${MOD}`, { op: "refreshNativeTracker" });
    }
    catch { /* ignore */ }
}
