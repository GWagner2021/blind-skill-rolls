import { MOD, BLIND, GMROLL } from "../core/constants.js";
import { resolveDeathSaveVisibility, buildMessageRecipients } from "../core/policy/roll-visibility.js";
import { setDsnPendingMode } from "../core/state/pending-dsn.js";
const isDeathSave = (msg) => {
    const d5 = msg?.flags?.dnd5e ?? {};
    const t = d5?.roll?.type ?? d5?.type ?? d5?.rollType ?? "";
    return t === "death";
};
const modeTag = () => String(game.settings.get(MOD, "bsrDeathSavesMode") || "blindroll").toLowerCase();
Hooks.on("dnd5e.rollDeathSaveV2", (_rolls, details) => {
    if (details && typeof details === "object")
        details.chatString = undefined;
});
Hooks.on("preCreateChatMessage", (msg) => {
    if (!isDeathSave(msg))
        return;
    const vis = resolveDeathSaveVisibility();
    if (!vis.mode) {
        msg.updateSource({ blind: false, whisper: [] });
        return;
    }
    const author = msg.author?.id ?? game.user?.id;
    const recipients = buildMessageRecipients(vis.mode, author);
    msg.updateSource({ blind: recipients.blind, whisper: recipients.whisper });
    if (recipients.bsrBlind) {
        msg.updateSource({ [`flags.${MOD}.bsrBlind`]: true });
    }
    if (recipients.bsrPrivate) {
        msg.updateSource({ [`flags.${MOD}.bsrPrivate`]: true });
    }
    if (vis.mode === BLIND)
        setDsnPendingMode('blind');
    else if (vis.mode === GMROLL)
        setDsnPendingMode('private');
});
Hooks.on("renderActorSheetV2", (app, html) => {
    if (modeTag() !== "blindroll" || game.user.isGM)
        return;
    if (app.options.classes?.includes?.("tidy5e-sheet")) {
        html.querySelectorAll('[data-tidy-sheet-part="death-save-failures"], [data-tidy-sheet-part="death-save-successes"]')
            .forEach(n => n.remove());
        html.querySelectorAll('.death-saves .fa-check, .death-saves .death-save-result, .death-saves .fa-times')
            .forEach(n => n.remove());
    }
    else {
        html.querySelectorAll('.death-tray .death-saves .pips')
            .forEach(n => n.remove());
    }
});
Hooks.on("renderPortraitPanelArgonComponent", (_pp, el) => {
    if (modeTag() === "blindroll" && !game.user.isGM) {
        el.querySelectorAll('.death-save-result-container').forEach(n => n.remove());
    }
});
