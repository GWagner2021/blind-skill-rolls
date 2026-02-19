// scripts/settings/bsr-death-settings.js

(() => {
  "use strict";
  const MOD = "blind-skill-rolls";

  const STY = "color:#8B0000;font-weight:700;";
  const tag = () => [`%c${MOD}%c`, STY, "color:inherit;"];
  const log  = (...a) => { try { console.log(...tag(), ...a); } catch {} };
  const warn = (...a) => { try { console.warn(...tag(), ...a); } catch {} };

  const L = (k, fb) => {
    try { const t = game?.i18n?.localize?.(k); return (t && t !== k) ? t : (fb ?? k); }
    catch { return fb ?? k; }
  };
  Hooks.on("ready",() => {
    window.BSR_102.load_count += 1;
  });

  Hooks.once("init", () => {
    game.settings.register(MOD, "bsrDeathSavesMode", {
      name: L("BLINDSKILLROLLS.Settings.DeathSaves.Mode.Name", "Death save visibility"),
      hint: L("BLINDSKILLROLLS.Settings.DeathSaves.Mode.Hint", "Choose how death saves are posted: public, private to GM, or blind (GM only)."),
      scope: "world",
      config: false,
      restricted: true,
      type: String,
      default: "blindroll"
    });

    game.settings.register(MOD, "blindRollersDeathSaveChat", {
       name: L("BLINDSKILLROLLS.Settings.DeathSaves.BlindRollersDeathSaveChat.Name", "Hide the roller's own blind death saves chat messages"),
       hint: L("BLINDSKILLROLLS.Settings.DeathSaves.BlindRollersDeathSaveChat.Hint", "Hide the players's own blind death saves chat messages from them."),
       scope: "world",
       config: false,
       type: Boolean,
       default: true
     });

    class BSRMenuDeathSaves extends foundry.applications.api.ApplicationV2 {
      static DEFAULT_OPTIONS = {
        id: "bsr-death-saves-config",
        classes: ["bsr-death-dialog", "bsr-theme"],
        window: {
          title: L("BSR.Menu.DeathSaves.Name", "Configure Death Saves"),
          icon: "fa-solid fa-heart-pulse",
          resizable: true
        },
        position: {
          width: 720,
          height: "auto"
        },
        actions: {
          save: BSRMenuDeathSaves.prototype._onSaveAction,
          cancel: BSRMenuDeathSaves.prototype._onCancelAction
        }
      };

      async _prepareContext(options) {
        const context = await super._prepareContext(options);

        const mode = String(game.settings.get(MOD, "bsrDeathSavesMode") || "blindroll").toLowerCase();
        const blindRollersDeathSaveChat = !!game.settings.get(MOD, "blindRollersDeathSaveChat");

        return {
          ...context,
          mode,
          blindRollersDeathSaveChat,
          labels: {
            deathSaves: L("BLINDSKILLROLLS.Section.DeathSaves", "Death Saves"),
            modeHint: L("BLINDSKILLROLLS.Settings.DeathSaves.Mode.Hint", "Choose how death saves are posted: public, private to GM, or blind (GM only)."),
            modeName: L("BLINDSKILLROLLS.Settings.DeathSaves.Mode.Name", "Death save visibility"),
            modePublic: L("BLINDSKILLROLLS.Settings.DeathSaves.Mode.public", "Public (everyone sees the roll)"),
            modePrivate: L("BLINDSKILLROLLS.Settings.DeathSaves.Mode.privatroll", "Private GM Roll (author + GM)"),
            modeBlind: L("BLINDSKILLROLLS.Settings.DeathSaves.Mode.blindroll", "Blind GM Roll (GM only)"),
            blindRollersChatLegend: L("BLINDSKILLROLLS.Section.DeathSavesHiddenChats", "Hide Death Saves Rolls Chats From The Roller"),
            blindRollersChatName: L("BLINDSKILLROLLS.Settings.DeathSaves.BlindRollersDeathSaveChat.Name", "Hide the roller's own blind death saves chat messages"),
            blindRollersChatHint: L("BLINDSKILLROLLS.Settings.DeathSaves.BlindRollersDeathSaveChat.Hint", "Hide the players's own blind death saves chat messages from them."),
            cancel: L("BSR.UI.Cancel", "Cancel"),
            save: L("BSR.UI.Save", "Save")
          }
        };
      }

      async _renderHTML(context, options) {
        const content = `
          <form style="min-width: 560px;">
            <fieldset class="form-group">
              <legend style="font-weight:600;">${context.labels.deathSaves}</legend>
              <p class="hint" style="margin-top:.25rem;">
                ${context.labels.modeHint}
              </p>

              <div style="display:flex; align-items:center; gap:.75rem; margin-top:.5rem;">
                <label style="min-width: 14rem;">${context.labels.modeName}</label>
                <select name="dsMode" style="flex:1;">
                  <option value="public" ${context.mode === "public" ? "selected" : ""}>
                    ${context.labels.modePublic}
                  </option>
                  <option value="privatroll" ${context.mode === "privatroll" ? "selected" : ""}>
                    ${context.labels.modePrivate}
                  </option>
                  <option value="blindroll" ${context.mode === "blindroll" ? "selected" : ""}>
                    ${context.labels.modeBlind}
                  </option>
                </select>
              </div>
            </fieldset>

            <fieldset style="margin-bottom: 12px;">
              <legend>${context.labels.blindRollersChatLegend}</legend>
              <label style="display:flex; gap:.5rem; align-items:center;">
                <input type="checkbox" name="blindRollersDeathSaveChat" ${context.blindRollersDeathSaveChat ? "checked" : ""}>
                <span>${context.labels.blindRollersChatName}</span>
              </label>
              <p style="margin:.35rem 0 0; color: var(--color-text-dark-secondary);">
                ${context.labels.blindRollersChatHint}
              </p>
            </fieldset>

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
        try {
          const form = event.target.form ?? event.target.closest("form");
          const formData = new foundry.applications.ux.FormDataExtended(form).object;

          const sel = formData.dsMode || "blindroll";
          await game.settings.set(MOD, "bsrDeathSavesMode", sel);
          await game.settings.set(MOD, "blindRollersDeathSaveChat", !!formData.blindRollersDeathSaveChat);

        } catch (e) {

        }

        this.close();
      }

      async _onSaveAction(event, target) {
        try {
          const form = this.element.querySelector("form");
          if (form) {
            const formData = new foundry.applications.ux.FormDataExtended(form).object;

            const sel = formData.dsMode || "blindroll";
            await game.settings.set(MOD, "bsrDeathSavesMode", sel);
            await game.settings.set(MOD, "blindRollersDeathSaveChat", !!formData.blindRollersDeathSaveChat);

          }
        } catch (e) {
        }

        this.close();
      }

      async _onCancelAction(event, target) {
        this.close();
      }
    }

    game.settings.registerMenu(MOD, "menuDeathSaves", {
      name:  "BSR.Menu.DeathSaves.Name",
      label: "BSR.Menu.DeathSaves.Label",
      icon:  "fa-solid fa-heart-pulse",
      type:  BSRMenuDeathSaves,
      restricted: true
    });
  });
})();
window.BSR_102.load_count += 1;
BSR_102.load_complete();
