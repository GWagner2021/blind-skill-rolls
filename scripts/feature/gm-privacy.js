import { MOD } from "../core/constants.js";
import { dbgWarn } from "../debug/logger.js";
const GET = (k, fb = false) => { try {
    return game.settings.get(MOD, k);
}
catch {
    return fb;
} };
const STRIP_GM_PUBLIC = () => GET("bsrSanitizePublicGm", true);
const TRUSTED_SEES_DETAILS = () => GET("bsrTrustedSeeDetails", false);
const isTrusted = () => (game.user?.role ?? 0) >= CONST.USER_ROLES.TRUSTED;
const isGMUser = (u) => !!u && (u.isGM || u.role >= CONST.USER_ROLES.ASSISTANT);
function stripFormulasAndTooltips(scope) {
    if (!scope)
        return;
    scope.querySelectorAll([
        ".dice-roll .dice-formula",
        ".dice-roll .dice-tooltip",
        ".dice-roll .dice-tooltip-collapser",
        ".inline-roll .dice-tooltip",
        ".inline-roll .collapse-toggle"
    ].join(",")).forEach(n => n.remove());
}
function shouldStrip(message, html) {
    if (!(html instanceof HTMLElement))
        return false;
    const authorIsGM = isGMUser(message.author);
    const isBlind = html.classList.contains("blind");
    const isWhisper = html.classList.contains("whisper");
    const isPublic = !isBlind && !isWhisper;
    if (!authorIsGM)
        return false;
    if (!isPublic)
        return false;
    if (!STRIP_GM_PUBLIC())
        return false;
    if (game.user.isGM)
        return false;
    if (TRUSTED_SEES_DETAILS() && isTrusted())
        return false;
    return true;
}
Hooks.on("renderChatMessageHTML", (message, html) => {
    try {
        if (!shouldStrip(message, html))
            return;
        stripFormulasAndTooltips(html.querySelector(".message-content") ?? html);
    }
    catch (e) {
        dbgWarn("sanitize public GM roll", e);
    }
});
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
    try {
        if (!shouldStrip(message, html))
            return;
        stripFormulasAndTooltips(html.querySelector(".message-content") ?? html);
    }
    catch (e) {
        dbgWarn("sanitize public GM roll (dnd5e)", e);
    }
});
