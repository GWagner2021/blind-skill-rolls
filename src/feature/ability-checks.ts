import { MOD, BLIND, GMROLL } from "../core/constants.js";
import { resolveAbilityCheckVisibility, buildMessageRecipients } from "../core/policy/roll-visibility.js";
import { normalizeAbilityId } from "../core/policy/ability-check-policy.js";
import { setPendingAbilityCheck, peekPendingAbilityCheck, clearPendingAbilityCheck, clearPendingAbilityChecksForActor } from "../core/state/pending-ability-check.js";
import { setDsnPendingMode } from "../core/state/pending-dsn.js";
import { guardedHookOnce } from "../core/state/roll-config-guard.js";
import { setRollConfigSelectBlind, setRollConfigSelectPrivate } from "../ui/roll-config-dialog.js";
import { dbgWarn } from "../debug/logger.js";

const CHECK_BLIND_NOTE_KEY = "BSR.AbilityChecks.Note.BlindGMRoll";
const CHECK_BLIND_NOTE_FB = "This ability check is configured for Blind GM Roll";
const CHECK_PRIVATE_NOTE_KEY = "BSR.AbilityChecks.Note.PrivateGMRoll";
const CHECK_PRIVATE_NOTE_FB = "This ability check is configured for Private GM Roll";

const resolveActorId = (cfg: any): string | null => cfg?.subject?.id ?? cfg?.subject?.actor?.id ?? cfg?.actorId ?? null;

const abilityIdFrom = (...values: unknown[]): string | null => {
  for (const value of values) {
    const abilityId = normalizeAbilityId(value);
    if (abilityId) return abilityId;
  }
  return null;
};

const isSecondaryAbilityHook = (config: any): boolean => {
  const names = config?.hookNames;
  return Array.isArray(names) && (names.includes("skill") || names.includes("tool") || names.includes("savingThrow") || names.includes("save") || names.includes("deathSave"));
};

const applyVisibilityToConfig = (config: any, abilityId: string, vis: { mode: string | null }): void => {
  if (!vis.mode || !config || typeof config !== "object") return;

  config.rollMode = vis.mode;
  if (config.dialog && typeof config.dialog === "object") config.dialog.rollMode = vis.mode;

  setPendingAbilityCheck(abilityId, null, resolveActorId(config));
  if (vis.mode === BLIND) {
    guardedHookOnce("renderRollConfigurationDialog", (app: any, el: HTMLElement) => setRollConfigSelectBlind(el ?? app?.element, CHECK_BLIND_NOTE_KEY, CHECK_BLIND_NOTE_FB));
  } else if (vis.mode === GMROLL) {
    guardedHookOnce("renderRollConfigurationDialog", (app: any, el: HTMLElement) => setRollConfigSelectPrivate(el ?? app?.element, CHECK_PRIVATE_NOTE_KEY, CHECK_PRIVATE_NOTE_FB));
  }
};

Hooks.on("dnd5e.preRollAbilityCheckV2", (cfg: any, dialog: any, message: any) => {
  try {
    if (isSecondaryAbilityHook(cfg)) return;
    const key: string | null = abilityIdFrom(
      cfg?.ability,
      cfg?.abilityId,
      cfg?.roll?.abilityId,
      cfg?.roll?.ability,
      cfg?.roll?.context?.ability,
      cfg?.context?.ability,
      cfg?.data?.abilityId,
      cfg?.data?.ability
    );
    if (!key) return;
    const vis = resolveAbilityCheckVisibility(key);
    if (!vis.mode) {
      clearPendingAbilityChecksForActor(null, resolveActorId(cfg));
      return;
    }

    applyVisibilityToConfig(cfg, key, vis);
    if (message && typeof message === "object") message.rollMode = vis.mode;
    if (dialog && typeof dialog === "object") {
      if (!dialog.options) dialog.options = {};
      if (!dialog.options.default) dialog.options.default = {};
      dialog.options.default.rollMode = vis.mode;
    }
  } catch (e) {
    dbgWarn("preRollAbilityCheckV2", e);
  }
});

Hooks.on("dnd5e.postAbilityCheckRollConfiguration", (rolls: any, config: any, dialog: any, message: any) => {
  try {
    if (isSecondaryAbilityHook(config)) return;
    const key: string | null = abilityIdFrom(
      config?.ability,
      config?.abilityId,
      config?.roll?.abilityId,
      config?.roll?.ability,
      config?.roll?.context?.ability,
      config?.context?.ability,
      config?.data?.abilityId,
      config?.data?.ability,
      rolls?.[0]?.data?.abilityId,
      rolls?.[0]?.data?.ability,
      rolls?.[0]?.options?.abilityId,
      rolls?.[0]?.options?.ability,
      peekPendingAbilityCheck(null, resolveActorId(config))
    );
    if (!key) return;

    const vis = resolveAbilityCheckVisibility(key);
    if (!vis.mode) {
      clearPendingAbilityChecksForActor(null, resolveActorId(config));
      return;
    }

    if (message && typeof message === "object") message.rollMode = vis.mode;
    if (Array.isArray(rolls)) for (const roll of rolls) { if (roll?.options) roll.options.rollMode = vis.mode; }
    setPendingAbilityCheck(key, null, resolveActorId(config));
  } catch (e) {
    dbgWarn("postAbilityCheckRollConfiguration", e);
  }
});

Hooks.on("preCreateChatMessage", (msg: any, data: any, options: any, userId: any) => {
  try {
    const d5data = data?.flags?.dnd5e ?? {};
    const d5doc = msg?.flags?.dnd5e ?? {};

    const hasAbilityInfo = (o: any): boolean => !!(o?.roll?.abilityId || o?.roll?.ability || o?.abilityId || o?.ability);
    const hasSkillInfo = (o: any): boolean => !!(o?.roll?.skillId || o?.roll?.skill || o?.skillId || o?.skill);
    const d5 = hasAbilityInfo(d5data) ? d5data : (hasAbilityInfo(d5doc) ? d5doc : d5data);

    const isDeath = d5?.roll?.type === "death" || d5?.type === "death" || d5?.rollType === "death";
    if (isDeath || hasSkillInfo(d5data) || hasSkillInfo(d5doc)) return;

    const author = userId ?? data?.author ?? msg?.author?.id ?? game.user?.id;
    const authorId: string = typeof author === "object" ? author.id : author;
    const actorId: string | null = msg?.speaker?.actor ?? data?.speaker?.actor ?? null;

    const pendingKey = peekPendingAbilityCheck(authorId, actorId);
    const effectiveRollType = (d5data?.roll?.type ?? d5data?.type ?? d5data?.rollType)
      ?? (d5doc?.roll?.type ?? d5doc?.type ?? d5doc?.rollType) ?? null;
    const rollType = typeof effectiveRollType === "string" ? effectiveRollType.toLowerCase().replace(/[-_\s]/g, "") : null;
    if (rollType && !["ability", "abilitycheck", "check"].includes(rollType) && !pendingKey) return;
    if (!rollType && !pendingKey) return;

    let key: string | null =
      abilityIdFrom(
        d5?.roll?.abilityId,
        d5?.roll?.ability,
        d5?.roll?.context?.ability,
        d5?.abilityId,
        d5?.ability,
        d5?.context?.ability
      );

    if (!key) {
      try {
        for (const roll of (msg?.rolls ?? [])) {
          const ab = abilityIdFrom(
            roll?.options?.abilityId,
            roll?.options?.ability,
            roll?.options?.context?.ability,
            roll?.data?.abilityId,
            roll?.data?.ability,
            roll?.data?.context?.ability
          );
          if (ab) { key = ab; break; }
        }
      } catch { /* ignore */ }
    }

    if (!key) key = pendingKey;
    if (!key) return;

    const vis = resolveAbilityCheckVisibility(key);
    if (!vis.mode) return;

    const recipients = buildMessageRecipients(vis.mode, authorId);
    msg.updateSource({ blind: recipients.blind, whisper: recipients.whisper });
    msg.updateSource({ [`flags.${MOD}.rollKind`]: "abilityCheck" });
    if (recipients.bsrBlind) {
      msg.updateSource({ [`flags.${MOD}.bsrBlind`]: true });
    }
    if (recipients.bsrPrivate) {
      msg.updateSource({ [`flags.${MOD}.bsrPrivate`]: true });
    }
    if (vis.mode === BLIND) setDsnPendingMode("blind");
    else if (vis.mode === GMROLL) setDsnPendingMode("private");
    clearPendingAbilityCheck(key, authorId, actorId);
  } catch (e) {
    dbgWarn("preCreateChatMessage (ability checks)", e);
  }
});
