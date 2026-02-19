// scripts/bsr-gm-privacy.js

(() => {
  "use strict";

  const MOD = "blind-skill-rolls";

  const GET = (k, fb=false) => { try { return game.settings.get(MOD, k); } catch { return fb; } };
  const STRIP_GM_PUBLIC      = () => GET("bsrSanitizePublicGm", true);
  const TRUSTED_SEES_DETAILS = () => GET("bsrTrustedSeeDetails", false);

  const isTrusted = () => (game.user?.role ?? 0) >= CONST.USER_ROLES.TRUSTED;
  const isGMUser  = (u) => !!u && (u.isGM || u.role >= CONST.USER_ROLES.ASSISTANT);

  function stripFormulasAndTooltips(scope) {
    if (!scope) return;
    scope.querySelectorAll([
      ".dice-roll .dice-formula",
      ".dice-roll .dice-tooltip",
      ".dice-roll .dice-tooltip-collapser",
      ".inline-roll .dice-tooltip",
      ".inline-roll .collapse-toggle"
    ].join(",")).forEach(n => n.remove());
  }
  Hooks.on("ready", () => {
    window.BSR_102.load_count += 1;
  });

  Hooks.on("renderChatMessageHTML", (message, html) => {
    try {
      const el = html?.[0] ?? html;
      if (!(el instanceof HTMLElement)) return;

      const authorIsGM = isGMUser(message.author);
      const isBlind = el.classList.contains("blind");
      const isWhisper = el.classList.contains("whisper");
      const isPublic = !isBlind && !isWhisper;

      if (!authorIsGM) return;
      if (!isPublic) return;
      if (!STRIP_GM_PUBLIC()) return;
      if (game.user.isGM) return;
      if (TRUSTED_SEES_DETAILS() && isTrusted()) return;

      const content = el.querySelector(".message-content") ?? el;
      stripFormulasAndTooltips(content);
    } catch (e) { globalThis.dbgWarn?.("[BSR] sanitize public GM roll", e); }
  });
})();
window.BSR_102.load_count += 1;
BSR_102.load_complete();
