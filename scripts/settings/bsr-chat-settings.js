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
  Hooks.on("ready",() => {
    window.BSR_102.load_count += 1;
  });

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
      name: L("BLINDSKILLROLLS.Settings.NpcMaskDefault.Name", "Hide NPC names from players"),
      hint: L("BLINDSKILLROLLS.Settings.NpcMaskDefault.Hint", "When enabled, NPC names are masked for players until revealed."),
      scope: "world", config: false, restricted: true, type: Boolean, default: false
    });
    game.settings.register(MOD, "bsrNpcNameReplacement", {
      name: L("BLINDSKILLROLLS.Settings.NpcReplacement.Name", "NPC placeholder name"),
      hint: L("BLINDSKILLROLLS.Settings.NpcReplacement.Hint", "Placeholder shown to players instead of the real NPC name."),
      scope: "world", config: false, restricted: true, type: String, default: ""
    });

    class BSRMenuChatDisplay extends foundry.applications.api.ApplicationV2 {
      static DEFAULT_OPTIONS = {
        id: "bsr-chat-display-config",
        classes: ["bsr-chat-dialog", "bsr-theme"],
        window: {
          title: L("BSR.Menu.Chat.Name", "Configure Chat Display"),
          icon: "fa-solid fa-comments",
          resizable: true
        },
        position: {
          width: 820,
          height: "auto"
        },
        actions: {
          save: BSRMenuChatDisplay.prototype._onSaveAction,
          cancel: BSRMenuChatDisplay.prototype._onCancelAction
        }
      };

      async _prepareContext(options) {
        const context = await super._prepareContext(options);

        return {
          ...context,
          hide: !!game.settings.get(MOD, "hideForeignSecrets"),
          mute: !!game.settings.get(MOD, "muteForeignSecretSounds"),
          sanitize: !!game.settings.get(MOD, "bsrSanitizePublicGm"),
          trusted: !!game.settings.get(MOD, "bsrTrustedSeeDetails"),
          maskDef: !!game.settings.get(MOD, "bsrNpcMaskDefault"),
          repl: game.settings.get(MOD, "bsrNpcNameReplacement") ?? "",
          labels: {
            chatDisplay: L("BLINDSKILLROLLS.Section.ChatDisplay", "Chat Display & Privacy"),
            hideForeignName: L("BLINDSKILLROLLS.Settings.HideForeign.Name", "Hide foreign secret messages"),
            hideForeignHint: L("BLINDSKILLROLLS.Settings.HideForeign.Hint", "Hide blind/whisper messages not addressed to the current player."),
            muteForeignName: L("BLINDSKILLROLLS.Settings.MuteForeign.Name", "Mute foreign dice sounds"),
            muteForeignHint: L("BLINDSKILLROLLS.Settings.MuteForeign.Hint", "Suppress dice sounds for secret rolls made by other players."),
            gmRolls: L("BSR.Menu.GMRolls.Legend", "GM Rolls"),
            sanitizeName: L("BLINDSKILLROLLS.Settings.GmSanitize.Name", "Sanitize public GM rolls"),
            trustedName: L("BLINDSKILLROLLS.Settings.TrustedDetails.Name", "Trusted users see details"),
            npcMasking: L("BLINDSKILLROLLS.Section.NPC", "NPC Masking"),
            npcMaskName: L("BLINDSKILLROLLS.Settings.NpcMaskDefault.Name", "Hide NPC names from players"),
            npcMaskHint: L("BLINDSKILLROLLS.Settings.NpcMaskDefault.Hint", "When enabled, NPC names are masked for players until revealed."),
            npcReplName: L("BLINDSKILLROLLS.Settings.NpcReplacement.Name", "NPC placeholder name"),
            npcReplHint: L("BLINDSKILLROLLS.Settings.NpcReplacement.Hint", "Placeholder shown to players instead of the real NPC name."),
            note: L("BLINDSKILLROLLS.Menu.Chat.Note", "-"),
            cancel: L("BSR.UI.Cancel", "Cancel"),
            save: L("BSR.UI.Save", "Save")
          }
        };
      }

      async _renderHTML(context, options) {
        const content = `
          <form style="min-width: 740px;">
            <fieldset class="form-group">
              <legend style="font-weight:600;">${context.labels.chatDisplay}</legend>

              <div style="display:flex; gap:1rem; flex-wrap:wrap;">
                <label style="display:flex; gap:.5rem; align-items:center;">
                  <input type="checkbox" name="hide" ${context.hide ? "checked" : ""}>
                  <span>${context.labels.hideForeignName}</span>
                </label>

                <label style="display:flex; gap:.5rem; align-items:center;">
                  <input type="checkbox" name="mute" ${context.mute ? "checked" : ""}>
                  <span>${context.labels.muteForeignName}</span>
                </label>
              </div>
              <p class="hint" style="margin-top:.35rem;">
                ${context.labels.hideForeignHint}
              </p>
              <p class="hint">
                ${context.labels.muteForeignHint}
              </p>
            </fieldset>

            <hr style="margin:.6rem 0;opacity:.3;">

            <fieldset class="form-group">
              <legend style="font-weight:600;">${context.labels.gmRolls}</legend>

              <label style="display:flex; gap:.5rem; align-items:center;">
                <input type="checkbox" name="sanitize" ${context.sanitize ? "checked" : ""}>
                <span>${context.labels.sanitizeName}</span>
              </label>

              <label style="display:flex; gap:.5rem; align-items:center; margin-top:.35rem;">
                <input type="checkbox" name="trusted" ${context.trusted ? "checked" : ""}>
                <span>${context.labels.trustedName}</span>
              </label>
            </fieldset>

            <hr style="margin:.6rem 0;opacity:.3;">

            <fieldset class="form-group">
              <legend style="font-weight:600;">${context.labels.npcMasking}</legend>

              <label style="display:flex; gap:.5rem; align-items:center;">
                <input type="checkbox" name="maskDef" ${context.maskDef ? "checked" : ""}>
                <span>${context.labels.npcMaskName}</span>
              </label>
              <p class="hint">${context.labels.npcMaskHint}</p>

              <div style="display:flex; align-items:center; gap:.75rem; margin-top:.35rem;">
                <label style="min-width: 16rem;">${context.labels.npcReplName}</label>
                <input type="text" name="repl" value="${context.repl}" style="flex:1;">
              </div>
              <p class="hint">${context.labels.npcReplHint}</p>
            </fieldset>

            <p style="color: var(--color-text-dark-secondary); margin-top:.6rem;">
              ${context.labels.note}
            </p>

            <footer class="form-footer" style="display: flex; flex-direction: column; gap: 0; margin-top: 1rem;">
              <button type="button" data-action="cancel" style="width: 100%; margin-bottom: 0; border-radius: 0;">
                ${context.labels.cancel}
              </button>
              <button type="submit" data-action="save" style="width: 100%; margin-bottom: 0; border-radius: 0;">
                ${context.labels.save}
              </button>
            </footer>
          </form>
        `;

        return content;
      }

      _replaceHTML(result, content, options) {
        let windowContent = content.querySelector(".window-content");
        if (!windowContent) {
          content.innerHTML = result;
        } else {
          windowContent.innerHTML = result;
        }
      }

      _onRender(context, options) {
        super._onRender(context, options);

        const theme = window.BSR?.getTheme?.() || "light";

        const style = document.createElement('style');
        style.textContent = window.BSR?.getThemeStyles?.(theme) || "";

        if (this.element && !this.element.querySelector('style.bsr-theme-style')) {
          style.classList.add('bsr-theme-style');
          this.element.appendChild(style);
        }

        const form = this.element.querySelector("form");
        if (form) {
          form.addEventListener("submit", (event) => {
            event.preventDefault();
            this.#onSave(event);
          });
        }
      }

      async #onSave(event) {
        const formData = new foundry.applications.ux.FormDataExtended(event.target.form ?? event.target.closest("form")).object;

        await game.settings.set(MOD, "hideForeignSecrets", !!formData.hide);
        await game.settings.set(MOD, "muteForeignSecretSounds", !!formData.mute);
        await game.settings.set(MOD, "bsrSanitizePublicGm", !!formData.sanitize);
        await game.settings.set(MOD, "bsrTrustedSeeDetails", !!formData.trusted);
        await game.settings.set(MOD, "bsrNpcMaskDefault", !!formData.maskDef);
        await game.settings.set(MOD, "bsrNpcNameReplacement", String(formData.repl ?? "").trim());

        this.close();
      }

      async _onSaveAction(event, target) {
        const form = this.element.querySelector("form");
        if (form) {
          const formData = new foundry.applications.ux.FormDataExtended(form).object;

          await game.settings.set(MOD, "hideForeignSecrets", !!formData.hide);
          await game.settings.set(MOD, "muteForeignSecretSounds", !!formData.mute);
          await game.settings.set(MOD, "bsrSanitizePublicGm", !!formData.sanitize);
          await game.settings.set(MOD, "bsrTrustedSeeDetails", !!formData.trusted);
          await game.settings.set(MOD, "bsrNpcMaskDefault", !!formData.maskDef);
          await game.settings.set(MOD, "bsrNpcNameReplacement", String(formData.repl ?? "").trim());
        }

        this.close();
      }

      async _onCancelAction(event, target) {
        this.close();
      }
    }

    game.settings.registerMenu(MOD, "menuChat", {
      name:  "BSR.Menu.Chat.Name",
      label: "BSR.Menu.Chat.Label",
      icon:  "fa-solid fa-comments",
      type:  BSRMenuChatDisplay,
      restricted: true
    });

    globalThis.dbgWarn?.("BSR| chat + gm-rolls + npc settings registered (single menu)");
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
      const repl    =  game.settings.get(MOD, "bsrNpcNameReplacement") ?? "";

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
          game.settings.set(MOD, "bsrNpcNameReplacement", String(ev.currentTarget.value ?? "").trim())
        );
      }
    } catch (e) {
      globalThis.dbgWarn?.("BSR| inject Chat Display controls failed", e);
    }
  }

  Hooks.on("renderChatLogConfig", injectChatDisplayControls);
  Hooks.on("renderChatDisplayConfig", injectChatDisplayControls);
  Hooks.on("renderChatConfig", injectChatDisplayControls);

})();
window.BSR_102.load_count += 1;
BSR_102.load_complete();
