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
       name: "Blind Roller's Death Saves Chat",
       hint: "Hides blind  death saves chat messages from the roller as well.",
       scope: "world",
       config: false,
       type: Boolean,
       default: true
     });

    class BSRMenuDeathSaves extends FormApplication {
      render() {
        const mode = String(game.settings.get(MOD, "bsrDeathSavesMode") || "blindroll").toLowerCase();
        const blindRollersDeathSaveChat = game.settings.get(MOD, "blindRollersDeathSaveChat");



        const content = `
          <form style="min-width: 560px;">
            <fieldset class="form-group">
              <legend style="font-weight:600;">${L("BLINDSKILLROLLS.Section.DeathSaves","Death Saves")}</legend>
              <p class="hint" style="margin-top:.25rem;">
                ${L("BLINDSKILLROLLS.Settings.DeathSaves.Mode.Hint","Choose how death saves are posted: public, private to GM, or blind (GM only).")}
              </p>

              <div style="display:flex; align-items:center; gap:.75rem; margin-top:.5rem;">
                <label style="min-width: 14rem;">${L("BLINDSKILLROLLS.Settings.DeathSaves.Mode.Name","Death save visibility")}</label>
                <select name="dsMode" style="flex:1;">
                  <option value="public" ${mode === "public" ? "selected" : ""}>
                    ${L("BLINDSKILLROLLS.Settings.DeathSaves.Mode.public","Public (everyone sees the roll)")}
                  </option>
                  <option value="privatroll" ${mode === "privatroll" ? "selected" : ""}>
                    ${L("BLINDSKILLROLLS.Settings.DeathSaves.Mode.privatroll","Private GM Roll (author + GM)")}
                  </option>
                  <option value="blindroll" ${mode === "blindroll" ? "selected" : ""}>
                    ${L("BLINDSKILLROLLS.Settings.DeathSaves.Mode.blindroll","Blind GM Roll (GM only)")}
                  </option>
                </select>
              </div>
            </fieldset>
            <fieldset style="margin-bottom: 12px;">
              <legend>${L("BLINDSKILLROLLS.Section.DeathSaves","Hide Death Saves Rolls Chats From The Roller")}</legend>
              <label style="display:flex; gap:.5rem; align-items:center;">
                  <input type="checkbox" name="blindRollersDeathSaveChat" ${blindRollersDeathSaveChat ? "checked" : ""}></input>
                <span>${L("BLINDSKILLROLLS.Settings.DeathSaves.blindRollersDeathSaveChat.Name","Hide the roller's own blind death saves chat messages")}</span>
              </label>
              <p style="margin:.35rem 0 0; color: var(--color-text-dark-secondary);">
                ${L("BLINDSKILLROLLS.Settings.DeathSaves.blindRollersDeathSaveChat.Hint","Hide the roller's own blind death saves chat messages.")}
              </p>
              </fieldset>

          </form>
        `;

        new Dialog({
          title: L("BSR.Menu.DeathSaves.Name","Configure Death Saves"),
          content,
          buttons: {
            cancel: { label: L("BSR.UI.Cancel","Cancel") },
            save: {
              label: L("BSR.UI.Save","Save"),
              callback: async (html) => {
                try {
                  const root = html?.[0] ?? html;
                  const f    = root.querySelector("form");
                  const sel  = f?.dsMode?.value || "blindroll";
                  await game.settings.set(MOD, "bsrDeathSavesMode", sel);
                  await game.settings.set(MOD, "blindRollersDeathSaveChat", !!f.blindRollersDeathSaveChat.checked);
                  log("| death saves mode ->", sel);
                } catch (e) {
                  warn("| saving death saves mode failed", e);
                }
              }
            }
          },
          default: "save"
        }, {
          width: 720,
          height: "auto",
          resizable: true,
          classes: ["bsr-death-dialog"]
        }).render(true);

        return this;
      }
    }

    game.settings.registerMenu(MOD, "menuDeathSaves", {
      name:  L("BSR.Menu.DeathSaves.Name","Configure Death Saves"),
      label: L("BSR.Menu.DeathSaves.Label","visibility of death saves"),
      icon:  "fa-solid fa-heart-pulse",
      type:  BSRMenuDeathSaves,
      restricted: true
    });

    log("death saves settings + menu registered");
  });

  Hooks.once("ready", () => {
    if (document.getElementById("bsr-death-dialog-css")) return;
    const style = document.createElement("style");
    style.id = "bsr-death-dialog-css";
    style.textContent = `
      .dialog.bsr-death-dialog { max-width: 92vw; }
      .dialog.bsr-death-dialog .window-content { overflow: auto; }
    `;
    document.head.appendChild(style);
  });
})();
