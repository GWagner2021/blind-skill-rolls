import { PENDING_TIMEOUT_MS } from "../constants.js";
import { clearPendingSkillsForActor } from "./pending-skill.js";
import { clearPendingSavesForActor } from "./pending-save.js";
const HOOK_TIMEOUT_MS = PENDING_TIMEOUT_MS + 1000;
const _trackedHooks = [];
export function guardedHookOnce(hookName, callback) {
    const id = Hooks.once(hookName, (...args) => {
        const idx = _trackedHooks.findIndex((h) => h.id === id);
        if (idx >= 0) {
            clearTimeout(_trackedHooks[idx].timer);
            _trackedHooks.splice(idx, 1);
        }
        return callback(...args);
    });
    const timer = setTimeout(() => {
        const idx = _trackedHooks.findIndex((h) => h.id === id);
        if (idx >= 0) {
            Hooks.off(hookName, id);
            _trackedHooks.splice(idx, 1);
        }
    }, HOOK_TIMEOUT_MS);
    _trackedHooks.push({ hookName, id, timer });
}
function clearTrackedHooks() {
    for (const { hookName, id, timer } of _trackedHooks) {
        clearTimeout(timer);
        Hooks.off(hookName, id);
    }
    _trackedHooks.length = 0;
}
const SKILL_HOOKS = new Set(["dnd5e.preRollSkillV2"]);
const SAVE_HOOKS = new Set(["dnd5e.preRollSavingThrowV2"]);
const ALL_PRE_ROLL_HOOKS = [
    "dnd5e.preRollSkillV2",
    "dnd5e.preRollSavingThrowV2",
    "dnd5e.preRollAttackV2",
    "dnd5e.preRollDamageV2",
    "dnd5e.preRollAbilityCheckV2",
    "dnd5e.preRollToolV2"
];
const SECONDARY_HOOKS = new Set(["dnd5e.preRollAbilityCheckV2"]);
for (const hook of ALL_PRE_ROLL_HOOKS) {
    Hooks.on(hook, (cfg) => {
        if (SECONDARY_HOOKS.has(hook)) {
            const names = cfg?.hookNames;
            if (Array.isArray(names) && (names.includes("skill") || names.includes("tool")))
                return;
        }
        clearTrackedHooks();
        const userId = game.user?.id ?? null;
        const actorId = cfg?.subject?.id ?? cfg?.subject?.actor?.id ?? cfg?.actorId ?? null;
        if (!SKILL_HOOKS.has(hook))
            clearPendingSkillsForActor(userId, actorId);
        if (!SAVE_HOOKS.has(hook))
            clearPendingSavesForActor(userId, actorId);
    });
}
