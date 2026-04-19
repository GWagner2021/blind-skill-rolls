import { MOD } from "../core/constants.js";
import { dbgWarn } from "../debug/logger.js";

const GET = (k: string, fb: boolean = false): boolean => { try { return game.settings.get(MOD, k) as boolean; } catch { return fb; } };
const STRIP_GM_PUBLIC = (): boolean => GET("bsrSanitizePublicGm", true);
const TRUSTED_SEES_DETAILS = (): boolean => GET("bsrTrustedSeeDetails", false);

const isTrusted = (): boolean => (game.user?.role ?? 0) >= CONST.USER_ROLES.TRUSTED;
const isGMUser = (u: any): boolean => !!u && (u.isGM || u.role >= CONST.USER_ROLES.ASSISTANT);

function stripFormulasAndTooltips(scope: Element): void {
  if (!scope) return;
  scope.querySelectorAll([
    ".dice-roll .dice-formula",
    ".dice-roll .dice-tooltip",
    ".dice-roll .dice-tooltip-collapser",
    ".inline-roll .dice-tooltip",
    ".inline-roll .collapse-toggle"
  ].join(",")).forEach(n => n.remove());
}

function shouldStrip(message: any, html: Element): boolean {
  if (!(html instanceof HTMLElement)) return false;

  const authorIsGM = isGMUser(message.author);
  const isBlind = html.classList.contains("blind");
  const isWhisper = html.classList.contains("whisper");
  const isPublic = !isBlind && !isWhisper;

  if (!authorIsGM) return false;
  if (!isPublic) return false;
  if (!STRIP_GM_PUBLIC()) return false;
  if (game.user!.isGM) return false;
  if (TRUSTED_SEES_DETAILS() && isTrusted()) return false;
  return true;
}

Hooks.on("renderChatMessageHTML", (message: any, html: HTMLElement) => {
  try {
    if (!shouldStrip(message, html)) return;
    stripFormulasAndTooltips(html.querySelector(".message-content") ?? html);
  } catch (e) {
    dbgWarn("sanitize public GM roll", e);
  }
});

Hooks.on("dnd5e.renderChatMessage", (message: any, html: HTMLElement) => {
  try {
    if (!shouldStrip(message, html)) return;
    stripFormulasAndTooltips(html.querySelector(".message-content") ?? html);
  } catch (e) {
    dbgWarn("sanitize public GM roll (dnd5e)", e);
  }
});
