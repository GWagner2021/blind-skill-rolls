// scripts/settings/bsr-skills-settings.js

(() => {

 //=========================================================================================
 //This section synchronizes the BSR and MidiQOL modules  blind-skill-rolls settings lists
 //During Initializtion the lead is currently given to BST.
 //=========================================================================================


  let skillList = ["acr","ani","arc","ath","dec","his","ins","inv","itm","med","nat","per","prc","prf","rel","slt","ste","sur"];
  const midiID = "midi-qol";
  const bsrID = "blind-skill-rolls";
  let isSyncing = false;
  let bsrSyncTimeout = null;
  let lastSyncDirection = null;

  const L = (k, fb) => {
    try {
      const t = game?.i18n?.localize?.(k);
      return (t && t !== k) ? t : (fb ?? k);
    } catch (e) { return fb ?? k; }
  };

  Hooks.once("init", () => {
    game.settings.register(bsrID, "showSyncMessages", {
      name: "BSR.Settings.MidiSync.ShowSyncMessages.Name",
      hint: "BSR.Settings.MidiSync.ShowSyncMessages.Hint",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      restricted: true
    });
  });
  function shouldShowMessages() {
    if (!game.user?.isGM) {
      return false;
    }
    try {
      return game.settings.get(bsrID, "showSyncMessages");
    } catch (e) {
      return true;
    }
  }
  function showNotification(message) {
    if (shouldShowMessages()) {
        if (game.user?.isGM) {
        ui.notifications.info(message);
      }
    }
  }
  function isMidiQolAvailable() {
    if (typeof game === 'undefined' || !game.modules) {
      return false;
    }
    const midiModule = game.modules.get(midiID);
    return midiModule?.active === true;
  }
  async function updateMidiQOLConfig(_configSettings) {
    if (!isMidiQolAvailable()) {
      return;
    }
    try {
      if(game.user.isGM){
          await game.settings.set("midi-qol", "ConfigSettings", _configSettings);
      }
    } catch (e) {
      globalThis.dbgWarn?.("BSR-Sync | Failed to update midi-qol settings:", e.message);
    }
  }
  async function performInitialSync() {
    if (!isMidiQolAvailable()) {
      globalThis.dbgWarn?.("BSR-Sync | midi-qol not active - sync disabled");
      return;
    }
    try {
      isSyncing = true;
      lastSyncDirection = "initial";
      let cfgSettings;
      try {
        cfgSettings = game.settings.get("midi-qol", "ConfigSettings");
      } catch (e) {
        globalThis.dbgWarn?.("BSR-Sync | midi-qol ConfigSettings not found:", e.message);
        return;
      }
      let new_blindList = [];
      for (let i = 0; i < skillList.length; i++) {
        try {
          if (game.settings.get(bsrID, skillList[i]) == true) {
            new_blindList.push(skillList[i]);
          }
        } catch (e) {}
      }
      let allBlind = new_blindList.length === skillList.length;
      cfgSettings.rollSkillsBlind = allBlind ? ["all"] : new_blindList;
      await updateMidiQOLConfig(cfgSettings);
      globalThis.dbgWarn?.(`BSR-Sync | Initial sync complete: ${new_blindList.length} blind skills → midi-qol`);
      showNotification(game.i18n.localize("BLINDSKILLROLLS.UINotification.BSRMIDIInitSync"));
    } catch (e) {
      globalThis.dbgWarn?.("BSR-Sync | Initial sync error:", e);
    } finally {
      setTimeout(() => {
        isSyncing = false;
        lastSyncDirection = null;
      }, 1000);
    }
  }
  async function syncBSRToMidi() {
    if (!isMidiQolAvailable() || isSyncing) {
      return;
    }
    if (lastSyncDirection === "midi-to-bsr") {
      globalThis.dbgWarn?.("BSR-Sync | Skipping BSR→midi (just synced FROM midi)");
      lastSyncDirection = null;
      return;
    }
    try {
      isSyncing = true;
      lastSyncDirection = "bsr-to-midi";
      let cfgSettings;
      try {
        cfgSettings = game.settings.get("midi-qol", "ConfigSettings");
      } catch (e) {
        globalThis.dbgWarn?.("BSR-Sync | Failed to get midi-qol ConfigSettings:", e.message);
        return;
      }
      let new_blindList = [];
      for (let i = 0; i < skillList.length; i++) {
        if (game.settings.get(bsrID, skillList[i]) == true) {
          new_blindList.push(skillList[i]);
        }
      }
      let allBlind = new_blindList.length === skillList.length;
      cfgSettings.rollSkillsBlind = allBlind ? ["all"] : new_blindList;
      await updateMidiQOLConfig(cfgSettings);
      globalThis.dbgWarn?.(`BSR-Sync | Synced ${new_blindList.length} blind skills to midi-qol`);
      showNotification(`${game.i18n.localize("BLINDSKILLROLLS.UINotification.Synced")}  ${new_blindList.length}   ${game.i18n.localize("BLINDSKILLROLLS.UINotification.BSRToMIDIQ")}`);
    } catch (e) {
      globalThis.dbgWarn?.("BSR-Sync | Sync error (BSR → midi):", e);
    } finally {
      setTimeout(() => {
        isSyncing = false;
        lastSyncDirection = null;
      }, 1000);
    }
  }
  Hooks.on("updateSetting", async (document, changed, options, userId) => {
    if (isSyncing) {
      return;
    }
    if (document.key == "midi-qol.ConfigSettings") {
      if (!isMidiQolAvailable()) {
        return;
      }
      if (lastSyncDirection === "bsr-to-midi") {
        globalThis.dbgWarn?.("BSR-Sync | Skipping midi→BSR (just synced TO midi)");
        lastSyncDirection = null;
        return;
      }
      try {
        isSyncing = true;
        lastSyncDirection = "midi-to-bsr";
        let cfgSettings;
        try {
          cfgSettings = game.settings.get("midi-qol", "ConfigSettings");
        } catch (e) {
          globalThis.dbgWarn?.("BSR-Sync | Failed to get midi-qol ConfigSettings:", e.message);
          return;
        }
        let new_blindList = cfgSettings.rollSkillsBlind || [];
        if (new_blindList.includes("all")) {
          new_blindList = skillList;
        }
        let updatedCount = 0;
        for (let i = 0; i < skillList.length; i++) {
          let shouldBeBlind = new_blindList.includes(skillList[i]);
          let currentValue = game.settings.get(bsrID, skillList[i]);
          if (currentValue !== shouldBeBlind) {
            if(game.user.isGM){
              await game.settings.set(bsrID, skillList[i], shouldBeBlind);
              updatedCount++;
            }
          }
        }
        if (updatedCount > 0) {
          globalThis.dbgWarn?.(`BSR-Sync | Synced ${new_blindList.length} blind skills from midi-qol (${updatedCount} changed)`);
          showNotification(`${game.i18n.localize("BLINDSKILLROLLS.UINotification.Synced")}  ${new_blindList.length}  ${game.i18n.localize("BLINDSKILLROLLS.UINotification.BSRFromMIDIQ")}`);
        }
      } catch (e) {
        globalThis.dbgWarn?.("BSR-Sync | Sync error (midi → BSR):", e);
      } finally {
        setTimeout(() => {
          isSyncing = false;
          lastSyncDirection = null;
        }, 1000);
      }
      return;
    }
    if (document.key.startsWith(bsrID)) {
      let skillKey = document.key.replace(bsrID + ".", "");
      if (!skillList.includes(skillKey)) {
        return;
      }
      if (!isMidiQolAvailable()) {
        return;
      }
      if (bsrSyncTimeout) {
        clearTimeout(bsrSyncTimeout);
      }
      bsrSyncTimeout = setTimeout(async () => {
        bsrSyncTimeout = null;
        await syncBSRToMidi();
      }, 800);
    }
  });
  Hooks.once("ready", async () => {
    setTimeout(async () => {
      await performInitialSync();
    }, 500);
  });
  globalThis.dbgWarn?.("BSR-Sync | Script loaded");
  window.BSR_102.load_count += 1;
})();

//=========================================================================================
//This section defines the settings menu for blind skill rolls.
//========================================================================================= 

(() => {
  "use strict";
  const MOD = "blind-skill-rolls";

  const L = (k, fb) => {
    try { const t = game?.i18n?.localize?.(k); return (t && t !== k) ? t : (fb ?? k); }
    catch { return fb ?? k; }
  };

  const setMany = async (pairs) => {
    for (const [k, v] of pairs) await game.settings.set(MOD, k, v);
  };

  Hooks.once("init", () => {
    game.settings.register(MOD, "enabled", {
      name: L("BLINDSKILLROLLS.Settings.Enabled.Name","Enable Blind Skill Rolls"),
      scope: "world", config: false, restricted: true, type: Boolean, default: true
    });
    game.settings.register(MOD, "blindRollersChat", {
      name: L("BSR.Settings.BlindRollersChat.Name", "Hide the roller's own blind chat messages"),
      hint: L("BSR.Settings.BlindRollersChat.Hint", "Hide player's own blind chat messages from the them."),
      scope: "world",
      config: false,
      type: Boolean,
      default: true
    });
  });

  function registerSkillSettings() {
    try {
      const skills = CONFIG?.DND5E?.skills;
      if (!skills) return false;

      const defaults = ["dec","ins","itm","inv","prc","per"];
      for (const [key, skill] of Object.entries(skills)) {
        game.settings.register(MOD, key, {
          name: skill.label || key.toUpperCase(),
          scope: "world",
          config: false,
          type: Boolean,
          default: defaults.includes(key)
        });
      }
      return true;
    } catch (e) {
      globalThis.dbgWarn?.("blind-skill-rolls | Failed to register skill settings:", e);
      return false;
    }
  }
  if (!registerSkillSettings()) Hooks.once("ready", registerSkillSettings);

  class BSRMenuSkills extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: "bsr-skills-config",
      classes: ["bsr-skills-dialog", "bsr-theme"],
      window: {
        title: "BSR.Menu.Skills.Name",
        icon: "fa-solid fa-sliders",
        resizable: true
      },
      position: {
        width: 640,
        height: "auto"
      },
      actions: {
        all: BSRMenuSkills.prototype._onAllAction,
        none: BSRMenuSkills.prototype._onNoneAction,
        defaults: BSRMenuSkills.prototype._onDefaultsAction,
        save: BSRMenuSkills.prototype._onSaveAction,
        cancel: BSRMenuSkills.prototype._onCancelAction
      }
    };

    async _prepareContext(options) {
      const context = await super._prepareContext(options);

      const skills = CONFIG?.DND5E?.skills ?? {};
      const entries = Object.entries(skills)
        .map(([k, v]) => ({ key: k, label: v.label, val: game.settings.get(MOD, k) }))
        .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang || "en"));

      const enabled = game.settings.get(MOD, "enabled");
      const blindRollersChat = !!game.settings.get(MOD, "blindRollersChat");

      return {
        ...context,
        enabled,
        blindRollersChat,
        entries,
        labels: {
          skillsLegend: L("BSR.SettingsGroup.Skills.Legend", "Blind Skill Rolls"),
          enabledName: L("BLINDSKILLROLLS.Settings.Enabled.Name", "Enable Blind Skill Rolls"),
          skillsHint: L("BSR.SettingsGroup.Skills.Hint", "Choose which skills should be forced to Blind GM Roll."),
          blindRollersChatLegend: L("BSR.SettingsGroup.RChats.Legend", "Hide Blind Skill Rolls Chats From The Roller"),
          blindRollersChatName: L("BSR.Settings.BlindRollersChat.Name", "Hide the roller's own blind chat messages"),
          blindRollersChatHint: L("BSR.Settings.BlindRollersChat.Hint", "Hide player's own blind chat messages from the them."),
          skills: L("BSR.UI.Skills", "Skills"),
          all: L("BSR.UI.All", "All"),
          none: L("BSR.UI.None", "None"),
          defaults: L("BSR.UI.Defaults", "Defaults"),
          cancel: L("BSR.UI.Cancel", "Cancel"),
          save: L("BSR.UI.Save", "Save")
        }
      };
    }

    async _renderHTML(context, options) {
      const content = `
        <form class="bsr-form" style="min-width: 580px; padding-right:.25rem;">
          <fieldset style="margin-bottom: 12px;">
            <legend>${context.labels.skillsLegend}</legend>
            <label style="display:flex; gap:.5rem; align-items:center;">
              <input type="checkbox" name="enabled" ${context.enabled ? "checked" : ""}>
              <span>${context.labels.enabledName}</span>
            </label>
            <p style="margin:.35rem 0 0; color: var(--color-text-dark-secondary);">
              ${context.labels.skillsHint}
            </p>
          </fieldset>

          <fieldset style="margin-bottom: 12px;">
            <legend>${context.labels.blindRollersChatLegend}</legend>
            <label style="display:flex; gap:.5rem; align-items:center;">
              <input type="checkbox" name="blindRollersChat" ${context.blindRollersChat ? "checked" : ""}>
              <span>${context.labels.blindRollersChatName}</span>
            </label>
            <p style="margin:.35rem 0 0; color: var(--color-text-dark-secondary);">
              ${context.labels.blindRollersChatHint}
            </p>
          </fieldset>

          <div style="display:flex; justify-content:space-between; align-items:center; margin:.5rem 0;">
            <strong>${context.labels.skills}</strong>
            <div style="display:flex; gap:.5rem;">
              <button type="button" data-action="all">${context.labels.all}</button>
              <button type="button" data-action="none">${context.labels.none}</button>
              <button type="button" data-action="defaults">${context.labels.defaults}</button>
            </div>
          </div>

          <div class="grid" style="display:grid; grid-template-columns:repeat(3,1fr); gap:.35rem .75rem;">
            ${context.entries.map(e => `
              <label style="display:flex; gap:.5rem; align-items:center;">
                <input type="checkbox" data-skill="${e.key}" ${e.val ? "checked" : ""}>
                <span>${e.label}</span>
              </label>
            `).join("")}
          </div>

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
      const form = event.target.form ?? event.target.closest("form");
      const formData = new foundry.applications.ux.FormDataExtended(form).object;

      const en = !!formData.enabled;
      const pairs = [["enabled", en]];

      form.querySelectorAll('input[type="checkbox"][data-skill]').forEach(i => {
        pairs.push([i.dataset.skill, i.checked]);
      });

      await setMany(pairs);
      await game.settings.set(MOD, "blindRollersChat", !!formData.blindRollersChat);

      this.close();
    }

    async _onAllAction(event, target) {
      const form = this.element.querySelector("form");
      form.querySelectorAll('input[data-skill]').forEach(i => i.checked = true);
    }

    async _onNoneAction(event, target) {
      const form = this.element.querySelector("form");
      form.querySelectorAll('input[data-skill]').forEach(i => i.checked = false);
    }

    async _onDefaultsAction(event, target) {
      const form = this.element.querySelector("form");
      const defaults = new Set(["dec","ins","itm","inv","prc","per"]);
      form.querySelectorAll('input[data-skill]').forEach(i => {
        i.checked = defaults.has(i.dataset.skill);
      });
    }

    async _onSaveAction(event, target) {
      const form = this.element.querySelector("form");
      if (form) {
        const formData = new foundry.applications.ux.FormDataExtended(form).object;

        const en = !!formData.enabled;
        const pairs = [["enabled", en]];

        form.querySelectorAll('input[type="checkbox"][data-skill]').forEach(i => {
          pairs.push([i.dataset.skill, i.checked]);
        });

        await setMany(pairs);
        await game.settings.set(MOD, "blindRollersChat", !!formData.blindRollersChat);
      }

      this.close();
    }

    async _onCancelAction(event, target) {
      this.close();
    }
  }

  Hooks.once("init", () => {
    game.settings.registerMenu(MOD, "menuSkills", {
      name:  "BSR.Menu.Skills.Name",
      label: "BSR.Menu.Skills.Label",
      icon:  "fa-solid fa-sliders",
      type:  BSRMenuSkills,
      restricted: true
    });
  });
})();
window.BSR_102.load_count += 1;
BSR_102.load_complete();
