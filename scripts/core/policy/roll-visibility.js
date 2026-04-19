import { MOD, BLIND, GMROLL } from "../constants.js";
import { isSkillBlind, isSkillPrivate } from "./skill-policy.js";
import { isSaveBlind, isSavePrivate } from "./save-policy.js";
const OPT_HIDE = () => { try {
    return game.settings.get(MOD, "hideForeignSecrets");
}
catch {
    return true;
} };
export function resolveSkillVisibility(skillId) {
    if (!skillId || typeof skillId !== "string")
        return { mode: null, force: false };
    if (isSkillBlind(skillId))
        return { mode: BLIND, force: true };
    if (isSkillPrivate(skillId))
        return { mode: GMROLL, force: true };
    return { mode: null, force: false };
}
export function resolveSaveVisibility(abilityId) {
    if (!abilityId || typeof abilityId !== "string")
        return { mode: null, force: false };
    if (isSaveBlind(abilityId))
        return { mode: BLIND, force: true };
    if (isSavePrivate(abilityId))
        return { mode: GMROLL, force: true };
    return { mode: null, force: false };
}
export function resolveDeathSaveVisibility() {
    try {
        const mode = String(game.settings.get(MOD, "bsrDeathSavesMode") || "blindroll").toLowerCase();
        if (mode === "public")
            return { mode: null, force: true };
        if (mode === "privatroll")
            return { mode: GMROLL, force: true };
        return { mode: BLIND, force: true };
    }
    catch {
        return { mode: BLIND, force: true };
    }
}
export function resolveHiddenNpcVisibility(actor) {
    if (!actor || actor.type === "character")
        return { mode: null, force: false };
    const tokenDoc = actor.token ?? null;
    if (!tokenDoc?.hidden)
        return { mode: null, force: false };
    return { mode: BLIND, force: false };
}
export function buildMessageRecipients(mode, authorId) {
    const gmIds = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
    const isAuthorGM = !!authorId && !!game.users?.get?.(authorId)?.isGM;
    if (mode === BLIND) {
        return { whisper: gmIds, blind: true, bsrBlind: true, bsrPrivate: false };
    }
    if (mode === GMROLL) {
        if (isAuthorGM) {
            const whisperSet = new Set(gmIds);
            if (authorId)
                whisperSet.add(authorId);
            return { whisper: Array.from(whisperSet), blind: false, bsrBlind: false, bsrPrivate: false };
        }
        if (!OPT_HIDE()) {
            return { whisper: [], blind: false, bsrBlind: false, bsrPrivate: true };
        }
        const whisperSet = new Set(gmIds);
        if (authorId)
            whisperSet.add(authorId);
        return { whisper: Array.from(whisperSet), blind: false, bsrBlind: false, bsrPrivate: false };
    }
    return { whisper: [], blind: false, bsrBlind: false, bsrPrivate: false };
}
