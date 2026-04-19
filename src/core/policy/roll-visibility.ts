import { MOD, BLIND, GMROLL } from "../constants.js";
import { isSkillBlind, isSkillPrivate } from "./skill-policy.js";
import { isSaveBlind, isSavePrivate } from "./save-policy.js";

export interface VisibilityResult {
  mode: string | null;
  force: boolean;
}

export interface MessageRecipients {
  whisper: string[];
  blind: boolean;
  bsrBlind: boolean;
  bsrPrivate: boolean;
}

const OPT_HIDE = (): boolean => { try { return game.settings.get(MOD, "hideForeignSecrets") as boolean; } catch { return true; } };

export function resolveSkillVisibility(skillId: string | null | undefined): VisibilityResult {
  if (!skillId || typeof skillId !== "string") return { mode: null, force: false };
  if (isSkillBlind(skillId))   return { mode: BLIND,  force: true };
  if (isSkillPrivate(skillId)) return { mode: GMROLL, force: true };
  return { mode: null, force: false };
}

export function resolveSaveVisibility(abilityId: string | null | undefined): VisibilityResult {
  if (!abilityId || typeof abilityId !== "string") return { mode: null, force: false };
  if (isSaveBlind(abilityId))   return { mode: BLIND,  force: true };
  if (isSavePrivate(abilityId)) return { mode: GMROLL, force: true };
  return { mode: null, force: false };
}

export function resolveDeathSaveVisibility(): VisibilityResult {
  try {
    const mode = String(game.settings.get(MOD, "bsrDeathSavesMode") || "blindroll").toLowerCase();
    if (mode === "public") return { mode: null, force: true };
    if (mode === "privatroll") return { mode: GMROLL, force: true };
    return { mode: BLIND, force: true };
  } catch {
    return { mode: BLIND, force: true };
  }
}

export function resolveHiddenNpcVisibility(actor: Actor | null | undefined): VisibilityResult {
  if (!actor || actor.type === "character") return { mode: null, force: false };
  const tokenDoc: TokenDocument | null = actor.token ?? null;
  if (!tokenDoc?.hidden) return { mode: null, force: false };
  return { mode: BLIND, force: false };
}

export function buildMessageRecipients(mode: string | null, authorId: string | null): MessageRecipients {
  const gmIds: string[] = ChatMessage.getWhisperRecipients("GM").map((u: User) => u.id);
  const isAuthorGM = !!authorId && !!game.users?.get?.(authorId)?.isGM;
  if (mode === BLIND) {
    return { whisper: gmIds, blind: true, bsrBlind: true, bsrPrivate: false };
  }
  if (mode === GMROLL) {
    if (isAuthorGM) {
      const whisperSet = new Set<string>(gmIds);
      if (authorId) whisperSet.add(authorId);
      return { whisper: Array.from(whisperSet), blind: false, bsrBlind: false, bsrPrivate: false };
    }
    if (!OPT_HIDE()) {
      return { whisper: [], blind: false, bsrBlind: false, bsrPrivate: true };
    }
    const whisperSet = new Set<string>(gmIds);
    if (authorId) whisperSet.add(authorId);
    return { whisper: Array.from(whisperSet), blind: false, bsrBlind: false, bsrPrivate: false };
  }
  return { whisper: [], blind: false, bsrBlind: false, bsrPrivate: false };
}
