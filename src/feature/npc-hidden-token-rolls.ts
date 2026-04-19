import { BLIND } from "../core/constants.js";
import { resolveHiddenNpcVisibility } from "../core/policy/roll-visibility.js";
import { setPendingHiddenNpc, clearPendingHiddenNpc } from "../core/state/pending-hidden-npc.js";
import { guardedHookOnce } from "../core/state/roll-config-guard.js";
import { dbgWarn } from "../debug/logger.js";

function resolveActorFromCfg(cfg: any): any {
  const sub = cfg?.subject ?? null;
  if (!sub) return null;
  if (sub.documentName === "Actor") return sub;
  if (sub.actor?.documentName === "Actor") return sub.actor;
  return null;
}

function preselectBlind(root: HTMLElement | null): void {
  if (!(root instanceof HTMLElement)) return;
  const sel = root.querySelector('select[name="rollMode"]') as HTMLSelectElement | null;
  if (sel && sel.value !== BLIND) sel.value = BLIND;
}

function applyHiddenNpcDefault(cfg: any, dialog: any, message: any): void {
  const actor = resolveActorFromCfg(cfg);
  const vis = resolveHiddenNpcVisibility(actor);
  if (!vis.mode) {
    clearPendingHiddenNpc();
    return;
  }

  setPendingHiddenNpc();
  cfg.rollMode = vis.mode;
  if (message && typeof message === "object") message.rollMode = vis.mode;
  if (dialog && typeof dialog === "object") {
    if (!dialog.options) dialog.options = {};
    if (!dialog.options.default) dialog.options.default = {};
    dialog.options.default.rollMode = vis.mode;
  }
  guardedHookOnce("renderRollConfigurationDialog", (_app: any, el: HTMLElement) => preselectBlind(el ?? _app?.element));
}

// ---- Pre-Roll Hooks (loop registration) ----
const PRE_ROLL_HOOKS: readonly string[] = [
  "dnd5e.preRollSkillV2",
  "dnd5e.preRollSavingThrowV2",
  "dnd5e.preRollAbilityCheckV2",
  "dnd5e.preRollToolV2",
  "dnd5e.preRollAttackV2",
  "dnd5e.preRollDamageV2"
];

for (const hook of PRE_ROLL_HOOKS) {
  Hooks.on(hook, (cfg: any, dialog: any, message: any) => {
    try {
      if (hook === "dnd5e.preRollAbilityCheckV2") {
        const names = cfg?.hookNames;
        if (Array.isArray(names) && (names.includes("skill") || names.includes("tool"))) return;
      }
      applyHiddenNpcDefault(cfg, dialog, message);
    } catch (e) {
      dbgWarn(`npc-hidden-token-rolls | ${hook}`, e);
    }
  });
}

// ==================== Activity / Item Use – Chat Cards ====================
Hooks.on("dnd5e.preCreateUsageMessage", (activity: any, messageConfig: any) => {
  try {
    const actor = activity?.actor ?? null;
    const vis = resolveHiddenNpcVisibility(actor);
    if (vis.mode) messageConfig.rollMode = vis.mode;
  } catch (e) { dbgWarn("npc-hidden-token-rolls | preCreateUsageMessage", e); }
});

Hooks.on("dnd5e.preDisplayCard", (item: any, messageConfig: any) => {
  try {
    const actor = item?.actor ?? null;
    const vis = resolveHiddenNpcVisibility(actor);
    if (vis.mode) messageConfig.rollMode = vis.mode;
  } catch (e) { dbgWarn("npc-hidden-token-rolls | preDisplayCard", e); }
});

// ==================== preCreateChatMessage safety net ====================
Hooks.on("preCreateChatMessage", (msg: any, data: any) => {
  try {
    if (!game.user?.isGM) return;
    if (msg.blind) return;

    const speaker = msg?.speaker ?? {};
    const sceneId: string | null = speaker.scene ?? null;
    const tokenId: string | null = speaker.token ?? null;
    if (!sceneId || !tokenId) return;

    let tokenDoc: any = null;
    try { tokenDoc = fromUuidSync(`Scene.${sceneId}.Token.${tokenId}`); } catch { return; }
    if (!tokenDoc?.hidden) return;

    const actor = tokenDoc?.actor ?? null;
    if (!actor || actor.type === "character") return;

    const gmIds: string[] = ChatMessage.getWhisperRecipients("GM").map((u: User) => u.id);
    msg.updateSource({ blind: true, whisper: gmIds });
  } catch (e) {
    dbgWarn("npc-hidden-token-rolls | preCreateChatMessage", e);
  }
});
