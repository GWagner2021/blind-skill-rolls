// scripts/settings/bsr-fast-forward-settings.js

(() => {
  "use strict";
  const MOD = "blind-skill-rolls";

  const L = (k, fb) => {
    try { const t = game?.i18n?.localize?.(k); return (t && t !== k) ? t : (fb ?? k); }
    catch { return fb ?? k; }
  };

  const FF_GM_TYPES = [
    { key: "attack",       settingKey: "ffAttack",       nameKey: "BSR.FastForward.Attack.Name",       nameFb: "Attack Rolls" },
    { key: "damage",       settingKey: "ffDamage",       nameKey: "BSR.FastForward.Damage.Name",       nameFb: "Damage Rolls" },
    { key: "abilityCheck", settingKey: "ffAbilityCheck", nameKey: "BSR.FastForward.AbilityCheck.Name", nameFb: "Ability Checks" },
    { key: "savingThrow",  settingKey: "ffSavingThrow",  nameKey: "BSR.FastForward.SavingThrow.Name",  nameFb: "Saving Throws" },
    { key: "skill",        settingKey: "ffSkill",        nameKey: "BSR.FastForward.Skill.Name",        nameFb: "Skill Checks" },
    { key: "tool",         settingKey: "ffTool",         nameKey: "BSR.FastForward.Tool.Name",         nameFb: "Tool Checks" }
  ];

  const FF_PLAYER_TYPES = [
    { key: "attack",       settingKey: "ffPlayerAttack",       nameKey: "BSR.FastForward.Attack.Name",       nameFb: "Attack Rolls" },
    { key: "damage",       settingKey: "ffPlayerDamage",       nameKey: "BSR.FastForward.Damage.Name",       nameFb: "Damage Rolls" },
    { key: "abilityCheck", settingKey: "ffPlayerAbilityCheck", nameKey: "BSR.FastForward.AbilityCheck.Name", nameFb: "Ability Checks" },
    { key: "savingThrow",  settingKey: "ffPlayerSavingThrow",  nameKey: "BSR.FastForward.SavingThrow.Name",  nameFb: "Saving Throws" },
    { key: "skill",        settingKey: "ffPlayerSkill",        nameKey: "BSR.FastForward.Skill.Name",        nameFb: "Skill Checks" },
    { key: "tool",         settingKey: "ffPlayerTool",         nameKey: "BSR.FastForward.Tool.Name",         nameFb: "Tool Checks" }
  ];

  const FF_ALL_TYPES = [...FF_GM_TYPES, ...FF_PLAYER_TYPES];
  const GM_TYPE_TO_SETTING     = Object.fromEntries(FF_GM_TYPES.map(t => [t.key, t.settingKey]));
  const PLAYER_TYPE_TO_SETTING = Object.fromEntries(FF_PLAYER_TYPES.map(t => [t.key, t.settingKey]));
  const SETTING_TO_TYPE = Object.fromEntries(FF_ALL_TYPES.map(t => [t.settingKey, t.key]));

  // ---- Helpers exposed globally ----
  globalThis.BSR = globalThis.BSR ?? {};

  globalThis.BSR.getAutoFastForwardGM = () => {
    const enabled = [];
    for (const t of FF_GM_TYPES) {
      try { if (game.settings.get(MOD, t.settingKey)) enabled.push(t.key); }
      catch { }
    }
    return enabled;
  };

  globalThis.BSR.getAutoFastForwardPlayer = () => {
    const enabled = [];
    for (const t of FF_PLAYER_TYPES) {
      try { if (game.settings.get(MOD, t.settingKey)) enabled.push(t.key); }
      catch { }
    }
    return enabled;
  };

  globalThis.BSR.getAutoFastForward = () => globalThis.BSR.getAutoFastForwardGM();
  globalThis.BSR.isAutoFastForward = (type) => {
    const isGM = game.user?.isGM ?? false;
    const map = isGM ? GM_TYPE_TO_SETTING : PLAYER_TYPE_TO_SETTING;
    const sk = map[type];
    if (!sk) return false;
    try { return !!game.settings.get(MOD, sk); }
    catch { return false; }
  };

  globalThis.BSR.setAutoFastForward = async (type, value) => {
    const sk = GM_TYPE_TO_SETTING[type];
    if (!sk) return;
    await game.settings.set(MOD, sk, !!value);
  };

  globalThis.BSR.setAutoFastForwardPlayer = async (type, value) => {
    const sk = PLAYER_TYPE_TO_SETTING[type];
    if (!sk) return;
    await game.settings.set(MOD, sk, !!value);
  };

  globalThis.BSR.FF_SETTING_TO_TYPE = SETTING_TO_TYPE;
  globalThis.BSR.FF_SETTING_KEYS = new Set(FF_ALL_TYPES.map(t => t.settingKey));
  globalThis.BSR.FF_GM_SETTING_KEYS = new Set(FF_GM_TYPES.map(t => t.settingKey));
  globalThis.BSR.FF_PLAYER_SETTING_KEYS = new Set(FF_PLAYER_TYPES.map(t => t.settingKey));

  Hooks.once("init", () => {
    for (const t of FF_GM_TYPES) {
      game.settings.register(MOD, t.settingKey, {
        name: L(t.nameKey, t.nameFb),
        hint: L("BSR.FastForward.Hint", "Skip the roll configuration dialog for this roll type."),
        scope: "world",
        config: false,
        restricted: true,
        type: Boolean,
        default: false
      });
    }

    for (const t of FF_PLAYER_TYPES) {
      game.settings.register(MOD, t.settingKey, {
        name: L(t.nameKey, t.nameFb),
        hint: L("BSR.FastForward.PlayerHint", "Skip the roll configuration dialog for this roll type (players)."),
        scope: "world",
        config: false,
        restricted: true,
        type: Boolean,
        default: false
      });
    }

    // ---- ApplicationV2 config window ----
    class BSRMenuFastForward extends foundry.applications.api.ApplicationV2 {
      static DEFAULT_OPTIONS = {
        id: "bsr-fast-forward-config",
        classes: ["bsr-fast-forward-dialog", "bsr-theme"],
        window: {
          title: L("BSR.Menu.FastForward.Name", "Configure Fast Forward"),
          icon: "fa-solid fa-forward-fast",
          resizable: true
        },
        position: {
          width: 720,
          height: "auto"
        },
        actions: {
          save: BSRMenuFastForward.prototype._onSaveAction,
          cancel: BSRMenuFastForward.prototype._onCancelAction
        }
      };

      async _prepareContext(options) {
        const context = await super._prepareContext(options);

        const gmEntries = FF_GM_TYPES.map(t => ({
          key: t.settingKey,
          label: L(t.nameKey, t.nameFb),
          checked: (() => { try { return !!game.settings.get(MOD, t.settingKey); } catch { return false; } })()
        }));

        const playerEntries = FF_PLAYER_TYPES.map(t => ({
          key: t.settingKey,
          label: L(t.nameKey, t.nameFb),
          checked: (() => { try { return !!game.settings.get(MOD, t.settingKey); } catch { return false; } })()
        }));

        return {
          ...context,
          gmEntries,
          playerEntries,
          labels: {
            pageIntro: L("BSR.FastForward.PageIntro", "Configure which roll types are automatically fast-forwarded (skip the roll configuration dialog)."),
            hint: L("BSR.FastForward.Hint", "Skip the roll configuration dialog for this roll type."),
            gmLegend: L("BSR.FastForward.GM.Legend", "GM Fast Forward"),
            playerLegend: L("BSR.FastForward.Player.Legend", "Player Fast Forward"),
            cancel: L("BSR.UI.Cancel", "Cancel"),
            save: L("BSR.UI.Save", "Save")
          }
        };
      }

      async _renderHTML(context, options) {
        let gmRows = "";
        for (const e of context.gmEntries) {
          gmRows += `
            <label style="display:flex; gap:.5rem; align-items:center; padding:.25rem 0;">
              <input type="checkbox" name="${e.key}" ${e.checked ? "checked" : ""}>
              <span>${e.label}</span>
            </label>`;
        }

        let playerRows = "";
        for (const e of context.playerEntries) {
          playerRows += `
            <label style="display:flex; gap:.5rem; align-items:center; padding:.25rem 0;">
              <input type="checkbox" name="${e.key}" ${e.checked ? "checked" : ""}>
              <span>${e.label}</span>
            </label>`;
        }

        return `
          <form style="min-width: 560px;">
            <p style="margin:0 0 .75rem; color:var(--color-text-dark-secondary);">
              ${context.labels.pageIntro}
            </p>

            <fieldset class="form-group">
              <legend style="font-weight:600;">${context.labels.gmLegend}</legend>
              <p class="hint" style="margin-bottom:.5rem;">${context.labels.hint}</p>
              ${gmRows}
            </fieldset>

            <fieldset class="form-group" style="margin-top: 1rem;">
              <legend style="font-weight:600;">${context.labels.playerLegend}</legend>
              <p class="hint" style="margin-bottom:.5rem;">${context.labels.hint}</p>
              ${playerRows}
            </fieldset>

            <footer class="form-footer" style="display: flex; flex-direction: column; gap: 0; margin-top: 1rem;">
              <button type="button" data-action="cancel" style="width: 100%; margin-bottom: 0; border-radius: 0;">
                ${context.labels.cancel}
              </button>
              <button type="submit" data-action="save" style="width: 100%; margin-bottom: 0; border-radius: 0;">
                ${context.labels.save}
              </button>
            </footer>
          </form>`;
      }

      _replaceHTML(result, content, options) {
        const wc = content.querySelector(".window-content");
        if (wc) wc.innerHTML = result;
        else content.innerHTML = result;
      }

      _onRender(context, options) {
        super._onRender(context, options);

        const theme = window.BSR?.getTheme?.() || "light";
        const style = document.createElement("style");
        style.textContent = window.BSR?.getThemeStyles?.(theme) || "";
        if (this.element && !this.element.querySelector("style.bsr-theme-style")) {
          style.classList.add("bsr-theme-style");
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
        const form = event.target.form ?? event.target.closest("form");
        const formData = new foundry.applications.ux.FormDataExtended(form).object;

        for (const t of FF_ALL_TYPES) {
          await game.settings.set(MOD, t.settingKey, !!formData[t.settingKey]);
        }
        this.close();
      }

      async _onSaveAction(event, target) {
        const form = this.element.querySelector("form");
        if (form) {
          const formData = new foundry.applications.ux.FormDataExtended(form).object;
          for (const t of FF_ALL_TYPES) {
            await game.settings.set(MOD, t.settingKey, !!formData[t.settingKey]);
          }
        }
        this.close();
      }

      async _onCancelAction(event, target) {
        this.close();
      }
    }

    // ---- Register menu entry ----
    game.settings.registerMenu(MOD, "menuFastForward", {
      name:  "BSR.Menu.FastForward.Name",
      label: "BSR.Menu.FastForward.Label",
      icon:  "fa-solid fa-forward-fast",
      type:  BSRMenuFastForward,
      restricted: true
    });
  });
})();

window.BSR_102.load_count += 1;
BSR_102.load_complete();
