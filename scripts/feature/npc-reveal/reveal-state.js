import { MOD } from "../../core/constants.js";
export const FLAG_SCOPE = MOD;
export const FLAG_KEY_REVEALED = "revealed";
export const FLAG_KEY_PERM_REVEALED = "permRevealed";
export function maskLabel() {
    try {
        const fromSetting = String(game.settings.get(MOD, "bsrNpcNameReplacement") ?? "").trim();
        if (fromSetting)
            return fromSetting;
    }
    catch { /* ignore */ }
    const key = "BSR.NPC.Label.Unknown";
    if (game.i18n?.has?.(key))
        return game.i18n.localize(key);
    return "Unknown";
}
export function L(key, fallback) {
    try {
        if (game.i18n?.has?.(key))
            return game.i18n.localize(key);
    }
    catch { /* ignore */ }
    return fallback ?? key;
}
export const isGM = () => !!game.user?.isGM;
export const uniq = (arr) => Array.from(new Set(arr));
export const safeParse = (s, fb = []) => { try {
    return JSON.parse(s);
}
catch {
    return fb;
} };
export const getActorById = (id) => game.actors?.get?.(id) ?? null;
export function resolveBaseActor(actor) {
    if (!actor)
        return null;
    try {
        if (actor.isToken)
            return actor.baseActor ?? game.actors?.get?.(actor.id) ?? actor;
    }
    catch { /* ignore */ }
    return actor;
}
export function docFromUuidSync(uuid) {
    try {
        return fromUuidSync?.(uuid) ?? null;
    }
    catch {
        return null;
    }
}
export function resolveTokenFromKeys(keys) {
    const uuidKey = keys.find(k => k.startsWith("t:")) || keys.find(k => k.startsWith("u:"));
    if (uuidKey) {
        const doc = docFromUuidSync(uuidKey.slice(2));
        if (doc?.documentName === "Token")
            return doc;
        if (doc?.parent?.documentName === "Token")
            return doc.parent;
    }
    const tidKey = keys.find(k => k.startsWith("tid:"));
    if (tidKey && canvas?.scene) {
        const doc = docFromUuidSync(`Scene.${canvas.scene.id}.Token.${tidKey.slice(4)}`);
        if (doc?.documentName === "Token")
            return doc;
    }
    return null;
}
export function resolveActorFromKeys(keys) {
    const aid = (keys.find(k => k.startsWith("aid:")) || "").slice(4) || null;
    if (aid) {
        const a = getActorById(aid);
        if (a)
            return a;
    }
    const uuidKey = keys.find(k => k.startsWith("t:")) || keys.find(k => k.startsWith("u:"));
    if (uuidKey) {
        const doc = docFromUuidSync(uuidKey.slice(2));
        if (doc?.actor)
            return doc.actor;
        if (doc?.documentName === "Actor")
            return doc;
    }
    return null;
}
export function isPureGMRoll(keys, message) {
    const hasActorKeys = keys.some(k => k.startsWith("aid:") || k.startsWith("a:") || k.startsWith("tid:") || k.startsWith("t:") || k.startsWith("u:"));
    if (hasActorKeys)
        return false;
    const hasActorDoc = !!message?.actor;
    const hasActorInSpeaker = !!(message?.speaker?.actor || message?.speaker?.token);
    if (hasActorDoc || hasActorInSpeaker)
        return false;
    return true;
}
export function shouldMaskByDefault(actor) {
    if (!actor) {
        try {
            return !!game.settings.get(MOD, "bsrNpcMaskDefault");
        }
        catch {
            return true;
        }
    }
    if (actor.type === "character")
        return false;
    try {
        return !!game.settings.get(MOD, "bsrNpcMaskDefault");
    }
    catch {
        return true;
    }
}
export function isNpcPermanentlyRevealed(actor) {
    if (!actor)
        return false;
    const base = resolveBaseActor(actor);
    if (!base)
        return false;
    try {
        return base.getFlag?.(FLAG_SCOPE, FLAG_KEY_PERM_REVEALED) === true;
    }
    catch {
        return false;
    }
}
export function isNpcRevealed(actor, tokenDoc) {
    if (!actor && !tokenDoc)
        return false;
    const a = actor ?? tokenDoc?.actor ?? null;
    if (a?.type === "character")
        return true;
    try {
        if (!game.settings.get(MOD, "bsrNpcMaskDefault"))
            return true;
    }
    catch { /* ignore */ }
    if (isNpcPermanentlyRevealed(a))
        return true;
    if (tokenDoc) {
        try {
            const tflag = tokenDoc.getFlag?.(FLAG_SCOPE, FLAG_KEY_REVEALED);
            if (typeof tflag === "boolean")
                return tflag;
        }
        catch { /* ignore */ }
    }
    return !shouldMaskByDefault(a);
}
export function isRevealedForKeys(keys) {
    try {
        if (!game.settings.get(MOD, "bsrNpcMaskDefault"))
            return true;
    }
    catch { /* ignore */ }
    const token = resolveTokenFromKeys(keys);
    const actor = token?.actor ?? resolveActorFromKeys(keys);
    return isNpcRevealed(actor, token);
}
export const clientShouldSeeRealName = () => isGM();
