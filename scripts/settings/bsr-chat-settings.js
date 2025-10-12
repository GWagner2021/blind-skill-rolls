// scripts/settings/bsr-chat-settings.js
(() => {
  "use strict";
  const MOD = "blind-skill-rolls";

  // Logger
  const STY = "color:#8B0000;font-weight:700;";
  const tag = () => [`%c${MOD}%c`, STY, "color:inherit;"];
  const log  = (...a) => { try { console.log(...tag(), ...a); } catch {} };
  const warn = (...a) => { try { console.warn(...tag(), ...a); } catch {} };

  // i18n helper
  const L = (k, fb) => {
    try { const t = game?.i18n?.localize?.(k); return (t && t !== k) ? t : (fb ?? k); }
    catch { return fb ?? k; }
  };

  Hooks.once("init", () => {
    // ---------- Chat-Hide/Mute ----------
    game.settings.register(MOD, "hideForeignSecrets", {
      name: L("BLINDSKILLROLLS.Settings.HideForeign.Name", "Hide foreign secret messages"),
      hint: L("BLINDSKILLROLLS.Settings.HideForeign.Hint", "Hide blind/whisper messages not addressed to the current player."),
      scope: "world", config: false, restricted: true, type: Boolean, default: true
    });
    game.settings.register(MOD, "muteForeignSecretSounds", {
      name: L("BLINDSKILLROLLS.Settings.MuteForeign.Name", "Mute foreign dice sounds"),
      hint: L("BLINDSKILLROLLS.Settings.MuteForeign.Hint", "Suppress dice sounds for secret rolls made by other players."),
      scope: "world", config: false, restricted: true, type: Boolean, default: true
    });

    // ---------- GM Rolls / Privacy ----------
    game.settings.register(MOD, "bsrSanitizePublicGm", {
      name: L("BLINDSKILLROLLS.Settings.GmSanitize.Name", "Sanitize public GM rolls"),
      scope: "world", config: false, restricted: true, type: Boolean, default: true
    });
    game.settings.register(MOD, "bsrTrustedSeeDetails", {
      name: L("BLINDSKILLROLLS.Settings.TrustedDetails.Name", "Trusted users see details"),
      scope: "world", config: false, restricted: true, type: Boolean, default: false
    });

    // ---------- NPC-Masken ----------
    game.settings.register(MOD, "bsrNpcMaskDefault", {
      name: L("BLINDSKILLROLLS.Settings.NpcMaskDefault.Name", "Hide NPC names from players (experimental)"),
      hint: L("BLINDSKILLROLLS.Settings.NpcMaskDefault.Hint", "When enabled, NPC names are masked for players until revealed."),
      scope: "world", config: false, restricted: true, type: Boolean, default: false
    });
    game.settings.register(MOD, "bsrNpcNameReplacement", {
      name: L("BLINDSKILLROLLS.Settings.NpcReplacement.Name", "NPC placeholder name"),
      hint: L("BLINDSKILLROLLS.Settings.NpcReplacement.Hint", "Placeholder shown to players instead of the real NPC name."),
      scope: "world", config: false, restricted: true, type: String, default: "Unknown"
    });

    class BSRMenuChatDisplay extends FormApplication {
      render() {
        const hide    = !!game.settings.get(MOD, "hideForeignSecrets");
        const mute    = !!game.settings.get(MOD, "muteForeignSecretSounds");
        const sanitize= !!game.settings.get(MOD, "bsrSanitizePublicGm");
        const trusted = !!game.settings.get(MOD, "bsrTrustedSeeDetails");
        const maskDef = !!game.settings.get(MOD, "bsrNpcMaskDefault");
        const repl    = game.settings.get(MOD, "bsrNpcNameReplacement") ?? "Unknown";

        const content = `
          <form style="min-width: 740px;">
            <fieldset class="form-group">
              <legend style="font-weight:600;">${L("BLINDSKILLROLLS.Section.ChatDisplay","Chat Display & Privacy (GM)")}</legend>

              <div style="display:flex; gap:1rem; flex-wrap:wrap;">
                <label style="display:flex; gap:.5rem; align-items:center;">
                  <input type="checkbox" name="hide" ${hide ? "checked":""}>
                  <span>${L("BLINDSKILLROLLS.Settings.HideForeign.Name","Hide foreign secret messages")}</span>
                </label>

                <label style="display:flex; gap:.5rem; align-items:center;">
                  <input type="checkbox" name="mute" ${mute ? "checked":""}>
                  <span>${L("BLINDSKILLROLLS.Settings.MuteForeign.Name","Mute foreign dice sounds")}</span>
                </label>
              </div>
              <p class="hint" style="margin-top:.35rem;">
                ${L("BLINDSKILLROLLS.Settings.HideForeign.Hint","Hide blind/whisper messages not addressed to the current player.")}
              </p>
              <p class="hint">
                ${L("BLINDSKILLROLLS.Settings.MuteForeign.Hint","Suppress dice sounds for secret rolls made by other players.")}
              </p>
            </fieldset>

            <hr style="margin:.6rem 0;opacity:.3;">

            <fieldset class="form-group">
              <legend style="font-weight:600;">${L("BSR.Menu.GMRolls.Legend","GM Rolls")}</legend>

              <label style="display:flex; gap:.5rem; align-items:center;">
                <input type="checkbox" name="sanitize" ${sanitize ? "checked":""}>
                <span>${L("BLINDSKILLROLLS.Settings.GmSanitize.Name","Sanitize public GM rolls")}</span>
              </label>

              <label style="display:flex; gap:.5rem; align-items:center; margin-top:.35rem;">
                <input type="checkbox" name="trusted" ${trusted ? "checked":""}>
                <span>${L("BLINDSKILLROLLS.Settings.TrustedDetails.Name","Trusted users see details")}</span>
              </label>
            </fieldset>

            <hr style="margin:.6rem 0;opacity:.3;">

            <fieldset class="form-group">
              <legend style="font-weight:600;">${L("BLINDSKILLROLLS.Section.NPC","NPC Masking")}</legend>

              <label style="display:flex; gap:.5rem; align-items:center;">
                <input type="checkbox" name="maskDef" ${maskDef ? "checked":""}>
                <span>${L("BLINDSKILLROLLS.Settings.NpcMaskDefault.Name","Hide NPC names from players")}</span>
              </label>
              <p class="hint">${L("BLINDSKILLROLLS.Settings.NpcMaskDefault.Hint","When enabled, NPC names are masked for players until revealed.")}</p>

              <div style="display:flex; align-items:center; gap:.75rem; margin-top:.35rem;">
                <label style="min-width: 16rem;">${L("BLINDSKILLROLLS.Settings.NpcReplacement.Name","NPC placeholder name")}</label>
                <input type="text" name="repl" value="${repl}" style="flex:1;">
              </div>
              <p class="hint">${L("BLINDSKILLROLLS.Settings.NpcReplacement.Hint","Placeholder shown to players instead of the real NPC name.")}</p>
            </fieldset>

            <p style="color: var(--color-text-dark-secondary); margin-top:.6rem;">
              ${L("BLINDSKILLROLLS.Menu.Chat.Note","-")}
            </p>
          </form>
        `;

        new Dialog({
          title: L("BSR.Menu.Chat.Name","Configure Chat Display"),
          content,
          buttons: {
            cancel: { label: L("BSR.UI.Cancel","Cancel") },
            save: {
              label: L("BSR.UI.Save","Save"),
              callback: async (html) => {
                const root = html?.[0] ?? html;
                const f = root.querySelector("form");
                await game.settings.set(MOD, "hideForeignSecrets",      !!f.hide.checked);
                await game.settings.set(MOD, "muteForeignSecretSounds", !!f.mute.checked);
                await game.settings.set(MOD, "bsrSanitizePublicGm",     !!f.sanitize.checked);
                await game.settings.set(MOD, "bsrTrustedSeeDetails",    !!f.trusted.checked);
                await game.settings.set(MOD, "bsrNpcMaskDefault",       !!f.maskDef.checked);
                await game.settings.set(MOD, "bsrNpcNameReplacement",    f.repl.value?.trim() || "Unknown");
              }
            }
          },
          default: "save"
        }, {
          width: 820,
          height: "auto",
          resizable: true,
          classes: ["bsr-chat-dialog"]
        }).render(true);

        return this;
      }
    }

    game.settings.registerMenu(MOD, "menuChat", {
      name:  L("BSR.Menu.Chat.Name","Configure Chat Display"),
      label: L("BSR.Menu.Chat.Label","visibility of chat messages"),
      icon:  "fa-solid fa-comments",
      type:  BSRMenuChatDisplay,
      restricted: true
    });

    log("| chat + gm-rolls + npc settings registered (single menu)");
  });

  function injectChatDisplayControls(_app, jqOrHtml) {
    try {
      const root = (jqOrHtml?.[0] ?? jqOrHtml);
      if (!(root instanceof HTMLElement)) return;

      const form = root.querySelector("form") ?? root.querySelector(".window-content form") ?? root;
      if (!form) return;

      const isGM    = !!game.user?.isGM;
      const hide    = !!game.settings.get(MOD, "hideForeignSecrets");
      const mute    = !!game.settings.get(MOD, "muteForeignSecretSounds");
      const sanitize= !!game.settings.get(MOD, "bsrSanitizePublicGm");
      const trusted = !!game.settings.get(MOD, "bsrTrustedSeeDetails");
      const mask    = !!game.settings.get(MOD, "bsrNpcMaskDefault");
      const repl    =  game.settings.get(MOD, "bsrNpcNameReplacement") ?? "Unknown";

      const fs = document.createElement("fieldset");
      fs.className = "form-group bsr-chatdisplay";
      fs.style.marginTop = "0.75rem";
      fs.innerHTML = `
        <legend style="font-weight:600;">${L("BLINDSKILLROLLS.Section.ChatDisplay","Chat Display & Privacy (GM)")}</legend>

        <label style="display:flex;gap:.5rem;align-items:center;">
          <input type="checkbox" name="bsrHide" ${hide ? "checked" : ""} ${!isGM ? "disabled" : ""}/>
          <span>${L("BLINDSKILLROLLS.Settings.HideForeign.Name","Hide foreign secret messages")}</span>
        </label>
        <p class="hint">${L("BLINDSKILLROLLS.Settings.HideForeign.Hint","Hide blind/whisper messages not addressed to the current player.")}</p>

        <label style="display:flex;gap:.5rem;align-items:center;margin-top:.5rem;">
          <input type="checkbox" name="bsrMute" ${mute ? "checked" : ""} ${!isGM ? "disabled" : ""}/>
          <span>${L("BLINDSKILLROLLS.Settings.MuteForeign.Name","Mute foreign dice sounds")}</span>
        </label>
        <p class="hint">${L("BLINDSKILLROLLS.Settings.MuteForeign.Hint","Suppress dice sounds for secret rolls made by other players.")}</p>

        <hr style="margin:.6rem 0;opacity:.3;">

        <legend style="font-weight:600;">${L("BSR.Menu.GMRolls.Legend","GM Rolls")}</legend>

        <label style="display:flex;gap:.5rem;align-items:center;">
          <input type="checkbox" name="bsrSanitize" ${sanitize ? "checked" : ""} ${!isGM ? "disabled" : ""}/>
          <span>${L("BLINDSKILLROLLS.Settings.GmSanitize.Name","Sanitize public GM rolls")}</span>
        </label>

        <label style="display:flex;gap:.5rem;align-items:center;margin-top:.5rem;">
          <input type="checkbox" name="bsrTrusted" ${trusted ? "checked" : ""} ${!isGM ? "disabled" : ""}/>
          <span>${L("BLINDSKILLROLLS.Settings.TrustedDetails.Name","Trusted users see details")}</span>
        </label>

        <hr style="margin:.6rem 0;opacity:.3;">

        <legend style="font-weight:600;">${L("BLINDSKILLROLLS.Section.NPC","NPC Masking")}</legend>

        <label style="display:flex;gap:.5rem;align-items:center;">
          <input type="checkbox" name="bsrNpcMaskDefault" ${mask ? "checked" : ""} ${!isGM ? "disabled" : ""}/>
          <span>${L("BLINDSKILLROLLS.Settings.NpcMaskDefault.Name","Hide NPC names from players (experimental)")}</span>
        </label>
        <p class="hint">${L("BLINDSKILLROLLS.Settings.NpcMaskDefault.Hint","When enabled, NPC names are masked for players until revealed.")}</p>

        <div style="display:flex;align-items:center;gap:.5rem;margin-top:.35rem;">
          <label style="min-width:14rem;">${L("BLINDSKILLROLLS.Settings.NpcReplacement.Name","NPC placeholder name")}</label>
          <input type="text" name="bsrNpcNameReplacement" value="${repl}" ${!isGM ? "disabled" : ""} style="flex:1;">
        </div>
        <p class="hint">${L("BLINDSKILLROLLS.Settings.NpcReplacement.Hint","Placeholder shown to players instead of the real NPC name.")}</p>
      `;
      form.appendChild(fs);

      if (isGM) {
        fs.querySelector('input[name="bsrHide"]')?.addEventListener("change", ev =>
          game.settings.set(MOD, "hideForeignSecrets", ev.currentTarget.checked)
        );
        fs.querySelector('input[name="bsrMute"]')?.addEventListener("change", ev =>
          game.settings.set(MOD, "muteForeignSecretSounds", ev.currentTarget.checked)
        );
        fs.querySelector('input[name="bsrSanitize"]')?.addEventListener("change", ev =>
          game.settings.set(MOD, "bsrSanitizePublicGm", ev.currentTarget.checked)
        );
        fs.querySelector('input[name="bsrTrusted"]')?.addEventListener("change", ev =>
          game.settings.set(MOD, "bsrTrustedSeeDetails", ev.currentTarget.checked)
        );
        fs.querySelector('input[name="bsrNpcMaskDefault"]')?.addEventListener("change", ev =>
          game.settings.set(MOD, "bsrNpcMaskDefault", ev.currentTarget.checked)
        );
        fs.querySelector('input[name="bsrNpcNameReplacement"]')?.addEventListener("change", ev =>
          game.settings.set(MOD, "bsrNpcNameReplacement", ev.currentTarget.value?.trim() || "Unknown")
        );
      }
    } catch (e) {
      warn("| inject Chat Display controls failed", e);
    }
  }

  Hooks.on("renderChatLogConfig", injectChatDisplayControls);
  Hooks.on("renderChatDisplayConfig", injectChatDisplayControls);
  Hooks.on("renderChatConfig", injectChatDisplayControls);
})();
