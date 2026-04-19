import { BLIND } from "../core/constants.js";
import { resolveHiddenNpcVisibility } from "../core/policy/roll-visibility.js";
import { setPendingHiddenNpc, clearPendingHiddenNpc } from "../core/state/pending-hidden-npc.js";
import { guardedHookOnce } from "../core/state/roll-config-guard.js";
import { dbgWarn } from "../debug/logger.js";
function resolveActorFromCfg(cfg) {
    const sub = cfg?.subject ?? null;
    if (!sub)
        return null;
    if (sub.documentName === "Actor")
        return sub;
    if (sub.actor?.documentName === "Actor")
        return sub.actor;
    return null;
}
function preselectBlind(root) {
    if (!(root instanceof HTMLElement))
        return;
    const sel = root.querySelector('select[name="rollMode"]');
    if (sel && sel.value !== BLIND)
        sel.value = BLIND;
}
function applyHiddenNpcDefault(cfg, dialog, message) {
    const actor = resolveActorFromCfg(cfg);
    const vis = resolveHiddenNpcVisibility(actor);
    if (!vis.mode) {
        clearPendingHiddenNpc();
        return;
    }
    setPendingHiddenNpc();
    cfg.rollMode = vis.mode;
    if (message && typeof message === "object")
        message.rollMode = vis.mode;
    if (dialog && typeof dialog === "object") {
        if (!dialog.options)
            dialog.options = {};
        if (!dialog.options.default)
            dialog.options.default = {};
        dialog.options.default.rollMode = vis.mode;
    }
    guardedHookOnce("renderRollConfigurationDialog", (_app, el) => preselectBlind(el ?? _app?.element));
}
// ---- Pre-Roll Hooks (loop registration) ----
const PRE_ROLL_HOOKS = [
    "dnd5e.preRollSkillV2",
    "dnd5e.preRollSavingThrowV2",
    "dnd5e.preRollAbilityCheckV2",
    "dnd5e.preRollToolV2",
    "dnd5e.preRollAttackV2",
    "dnd5e.preRollDamageV2"
];
for (const hook of PRE_ROLL_HOOKS) {
    Hooks.on(hook, (cfg, dialog, message) => {
        try {
            if (hook === "dnd5e.preRollAbilityCheckV2") {
                const names = cfg?.hookNames;
                if (Array.isArray(names) && (names.includes("skill") || names.includes("tool")))
                    return;
            }
            applyHiddenNpcDefault(cfg, dialog, message);
        }
        catch (e) {
            dbgWarn(`npc-hidden-token-rolls | ${hook}`, e);
        }
    });
}
// ==================== Activity / Item Use – Chat Cards ====================
Hooks.on("dnd5e.preCreateUsageMessage", (activity, messageConfig) => {
    try {
        const actor = activity?.actor ?? null;
        const vis = resolveHiddenNpcVisibility(actor);
        if (vis.mode)
            messageConfig.rollMode = vis.mode;
    }
    catch (e) {
        dbgWarn("npc-hidden-token-rolls | preCreateUsageMessage", e);
    }
});
Hooks.on("dnd5e.preDisplayCard", (item, messageConfig) => {
    try {
        const actor = item?.actor ?? null;
        const vis = resolveHiddenNpcVisibility(actor);
        if (vis.mode)
            messageConfig.rollMode = vis.mode;
    }
    catch (e) {
        dbgWarn("npc-hidden-token-rolls | preDisplayCard", e);
    }
});
// ==================== preCreateChatMessage safety net ====================
Hooks.on("preCreateChatMessage", (msg, data) => {
    try {
        if (!game.user?.isGM)
            return;
        if (msg.blind)
            return;
        const speaker = msg?.speaker ?? {};
        const sceneId = speaker.scene ?? null;
        const tokenId = speaker.token ?? null;
        if (!sceneId || !tokenId)
            return;
        let tokenDoc = null;
        try {
            tokenDoc = fromUuidSync(`Scene.${sceneId}.Token.${tokenId}`);
        }
        catch {
            return;
        }
        if (!tokenDoc?.hidden)
            return;
        const actor = tokenDoc?.actor ?? null;
        if (!actor || actor.type === "character")
            return;
        const gmIds = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
        msg.updateSource({ blind: true, whisper: gmIds });
    }
    catch (e) {
        dbgWarn("npc-hidden-token-rolls | preCreateChatMessage", e);
    }
});
