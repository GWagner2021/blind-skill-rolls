// scripts/settings/bsr-skills-settings.js

(() => {

  let skillList = ["acr","ani","arc","ath","dec","his","ins","inv","itm","med","nat","per","prc","prf","rel","slt","ste","sur"];
  let saveList = ["str","dex","con","int","wis","cha"];
  const midiID = "midi-qol";
  const bsrID = "blind-skill-rolls";
  let isSyncing = false;
  let bsrSyncTimeout = null;
  let bsrSaveSyncTimeout = null;
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
      globalThis.dbgWarn?.("BSR-Sync | Failed to update midi-qol settings:", e);
    }
  }
  async function performInitialSync() {
    if (!isMidiQolAvailable()) {
      globalThis.dbgWInfo?.("BSR-Sync | midi-qol not active - sync disabled");
      return;
    }
    try {
      isSyncing = true;
      lastSyncDirection = "initial";
      let cfgSettings;
      try {
        cfgSettings = game.settings.get("midi-qol", "ConfigSettings");
      } catch (e) {
        globalThis.dbgWarn?.("BSR-Sync | midi-qol ConfigSettings not found:", e);
        return;
      }
      // Sync skills
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
      let new_blindSaveList = [];
      const areSavesEnabled = (() => { try { return !!game.settings.get(bsrID, "savesEnabled"); } catch { return false; } })();
      if (areSavesEnabled) {
        for (let i = 0; i < saveList.length; i++) {
          try {
            if (game.settings.get(bsrID, "save_" + saveList[i]) == true) {
              new_blindSaveList.push(saveList[i]);
            }
          } catch (e) {}
        }
      }
      let allSavesBlind = areSavesEnabled && new_blindSaveList.length === saveList.length;
      cfgSettings.rollSavesBlind = allSavesBlind ? ["all"] : new_blindSaveList;
      await updateMidiQOLConfig(cfgSettings);
      globalThis.dbgInfo?.(`BSR-Sync | Initial sync complete: ${new_blindList.length} blind skills, ${new_blindSaveList.length} blind saves → midi-qol`);
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
        globalThis.dbgWarn?.("BSR-Sync | Failed to get midi-qol ConfigSettings:", e);
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
      let new_blindSaveList = [];
      const areSavesEnabled = (() => { try { return !!game.settings.get(bsrID, "savesEnabled"); } catch { return false; } })();
      if (areSavesEnabled) {
        for (let i = 0; i < saveList.length; i++) {
          try {
            if (game.settings.get(bsrID, "save_" + saveList[i]) == true) {
              new_blindSaveList.push(saveList[i]);
            }
          } catch (e) {}
        }
      }
      let allSavesBlind = areSavesEnabled && new_blindSaveList.length === saveList.length;
      cfgSettings.rollSavesBlind = allSavesBlind ? ["all"] : new_blindSaveList;
      await updateMidiQOLConfig(cfgSettings);
      globalThis.dbgInfo?.(`BSR-Sync | Synced ${new_blindList.length} blind skills, ${new_blindSaveList.length} blind saves to midi-qol`);
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
          globalThis.dbgWarn?.("BSR-Sync | Failed to get midi-qol ConfigSettings:", e);
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

        let new_blindSaveList = cfgSettings.rollSavesBlind || [];
        if (new_blindSaveList.includes("all")) {
          new_blindSaveList = saveList;
        }
        let saveUpdatedCount = 0;
        for (let i = 0; i < saveList.length; i++) {
          let shouldBeBlind = new_blindSaveList.includes(saveList[i]);
          try {
            let currentValue = game.settings.get(bsrID, "save_" + saveList[i]);
            if (currentValue !== shouldBeBlind) {
              if(game.user.isGM){
                await game.settings.set(bsrID, "save_" + saveList[i], shouldBeBlind);
                saveUpdatedCount++;
              }
            }
          } catch (e) {}
        }
        if (updatedCount > 0 || saveUpdatedCount > 0) {
          globalThis.dbgInfo?.(`BSR-Sync | Synced ${new_blindList.length} blind skills, ${new_blindSaveList.length} blind saves from midi-qol (${updatedCount + saveUpdatedCount} changed)`);
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
      let settingKey = document.key.replace(bsrID + ".", "");

      if (skillList.includes(settingKey)) {
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

      if (settingKey.startsWith("save_")) {
        let saveKey = settingKey.replace("save_", "").replace("_private", "");
        if (saveList.includes(saveKey) && !settingKey.endsWith("_private")) {
          if (!isMidiQolAvailable()) {
            return;
          }
          if (bsrSaveSyncTimeout) {
            clearTimeout(bsrSaveSyncTimeout);
          }
          bsrSaveSyncTimeout = setTimeout(async () => {
            bsrSaveSyncTimeout = null;
            await syncBSRToMidi();
          }, 800);
        }
      }

      if (settingKey === "savesEnabled") {
        if (!isMidiQolAvailable()) {
          return;
        }
        if (bsrSaveSyncTimeout) {
          clearTimeout(bsrSaveSyncTimeout);
        }
        bsrSaveSyncTimeout = setTimeout(async () => {
          bsrSaveSyncTimeout = null;
          await syncBSRToMidi();
        }, 800);
      }
    }
  });
  Hooks.once("ready", async () => {
    setTimeout(async () => {
      await performInitialSync();
    }, 500);
  });
  globalThis.dbgInfo?.("BSR-Sync | Script loaded");
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
    game.settings.register(MOD, "savesEnabled", {
      name: L("BSR.Settings.SavesEnabled.Name", "Enable Blind Saving Throws"),
      scope: "world", config: false, restricted: true, type: Boolean, default: false
    });
    game.settings.register(MOD, "blindRollersSaveChat", {
      name: L("BSR.Settings.BlindRollersSaveChat.Name", "Hide the roller's own blind saving throw chat messages"),
      hint: L("BSR.Settings.BlindRollersSaveChat.Hint", "Hide player's own blind saving throw chat messages from them."),
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
        game.settings.register(MOD, key + "_private", {
          name: (skill.label || key.toUpperCase()) + " (Private)",
          scope: "world",
          config: false,
          type: Boolean,
          default: false
        });
      }
      return true;
    } catch (e) {
      globalThis.dbgWarn?.("blind-skill-rolls | Failed to register skill settings:", e);
      return false;
    }
  }
  if (!registerSkillSettings()) Hooks.once("ready", registerSkillSettings);

  function registerSaveSettings() {
    try {
      const abilities = CONFIG?.DND5E?.abilities;
      if (!abilities) return false;

      for (const [key, ability] of Object.entries(abilities)) {
        game.settings.register(MOD, "save_" + key, {
          name: (ability.label || key.toUpperCase()) + " Save",
          scope: "world",
          config: false,
          type: Boolean,
          default: false
        });
        game.settings.register(MOD, "save_" + key + "_private", {
          name: (ability.label || key.toUpperCase()) + " Save (Private)",
          scope: "world",
          config: false,
          type: Boolean,
          default: false
        });
      }
      return true;
    } catch (e) {
      globalThis.dbgWarn?.("blind-skill-rolls | Failed to register save settings:", e);
      return false;
    }
  }
  if (!registerSaveSettings()) Hooks.once("ready", registerSaveSettings);

  class BSRMenuSkills extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: "bsr-skills-config",
      classes: ["bsr-skills-dialog", "bsr-theme"],
      window: {
        title: "BSR.Menu.SkillsAndSaves.Name",
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
        allSaves: BSRMenuSkills.prototype._onAllSavesAction,
        noneSaves: BSRMenuSkills.prototype._onNoneSavesAction,
        save: BSRMenuSkills.prototype._onSaveAction,
        cancel: BSRMenuSkills.prototype._onCancelAction
      }
    };

    async _prepareContext(options) {
      const context = await super._prepareContext(options);

      const skills = CONFIG?.DND5E?.skills ?? {};
      const entries = Object.entries(skills)
        .map(([k, v]) => {
          let isPrivate = false;
          try { isPrivate = !!game.settings.get(MOD, k + "_private"); } catch { }
          return {
            key: k,
            label: v.label,
            blind: game.settings.get(MOD, k),
            private: isPrivate
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang || "en"));

      const enabled = game.settings.get(MOD, "enabled");
      const blindRollersChat = !!game.settings.get(MOD, "blindRollersChat");
      const abilities = CONFIG?.DND5E?.abilities ?? {};
      const saveEntries = Object.entries(abilities)
        .map(([k, v]) => {
          let isPrivate = false;
          try { isPrivate = !!game.settings.get(MOD, "save_" + k + "_private"); } catch { }
          return {
            key: k,
            label: v.label || k.toUpperCase(),
            blind: (() => { try { return !!game.settings.get(MOD, "save_" + k); } catch { return false; } })(),
            private: isPrivate
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label, game.i18n?.lang || "en"));

      const savesEnabled = (() => { try { return !!game.settings.get(MOD, "savesEnabled"); } catch { return false; } })();
      const blindRollersSaveChat = (() => { try { return !!game.settings.get(MOD, "blindRollersSaveChat"); } catch { return true; } })();

      return {
        ...context,
        enabled,
        blindRollersChat,
        entries,
        saveEntries,
        savesEnabled,
        blindRollersSaveChat,
        labels: {
          pageIntro: L("BSR.UI.PageIntro", "Configure which skill checks and saving throws are forced to Blind or Private GM Roll."),
          enabledName: L("BLINDSKILLROLLS.Settings.Enabled.Name", "Enable Blind Skill Rolls"),
          blindRollersChatName: L("BSR.Settings.BlindRollersChat.Name", "Hide the roller's own blind chat messages"),
          skills: L("BSR.UI.Skills", "Skills"),
          blind: L("BSR.UI.Blind", "Blind"),
          private: L("BSR.UI.Private", "Private"),
          all: L("BSR.UI.All", "All"),
          none: L("BSR.UI.None", "None"),
          defaults: L("BSR.UI.Defaults", "Defaults"),
          cancel: L("BSR.UI.Cancel", "Cancel"),
          save: L("BSR.UI.Save", "Save"),
          savesEnabledName: L("BSR.Settings.SavesEnabled.Name", "Enable Blind Saving Throws"),
          blindRollersSaveChatName: L("BSR.Settings.BlindRollersSaveChat.Name", "Hide the roller's own blind saving throw chat messages"),
          saves: L("BSR.UI.Saves", "Saving Throws"),
          allSaves: L("BSR.UI.AllSaves", "All"),
          noneSaves: L("BSR.UI.NoneSaves", "None")
        }
      };
    }

    async _renderHTML(context, options) {
      const content = `
        <form class="bsr-form" style="min-width: 580px; padding-right:.25rem;">
          <p style="margin:0 0 .75rem; color: var(--color-text-dark-secondary);">
            ${context.labels.pageIntro}
          </p>

          <label style="display:flex; gap:.5rem; align-items:center; margin-bottom:.35rem;">
            <input type="checkbox" name="enabled" ${context.enabled ? "checked" : ""}>
            <span>${context.labels.enabledName}</span>
          </label>
          <label style="display:flex; gap:.5rem; align-items:center; margin-bottom:.75rem;">
            <input type="checkbox" name="blindRollersChat" ${context.blindRollersChat ? "checked" : ""}>
            <span>${context.labels.blindRollersChatName}</span>
          </label>

          <div style="display:flex; justify-content:space-between; align-items:center; margin:.5rem 0;">
            <strong>${context.labels.skills}</strong>
            <div style="display:flex; gap:.5rem;">
              <button type="button" data-action="all">${context.labels.all}</button>
              <button type="button" data-action="none">${context.labels.none}</button>
              <button type="button" data-action="defaults">${context.labels.defaults}</button>
            </div>
          </div>

          <div class="bsr-skill-grid">
            <strong></strong>
            <strong class="bsr-skill-grid__colhdr">${context.labels.blind}</strong>
            <strong class="bsr-skill-grid__colhdr">${context.labels.private}</strong>
            <span class="bsr-skill-grid__sep"></span>
            <strong></strong>
            <strong class="bsr-skill-grid__colhdr">${context.labels.blind}</strong>
            <strong class="bsr-skill-grid__colhdr">${context.labels.private}</strong>
            ${(() => {
              const half = Math.ceil(context.entries.length / 2);
              const left = context.entries.slice(0, half);
              const right = context.entries.slice(half);
              let rows = "";
              for (let i = 0; i < half; i++) {
                const l = left[i];
                const r = right[i];
                rows += `
                  <span class="bsr-skill-grid__name">${l.label}</span>
                  <label class="bsr-skill-grid__cb"><input type="checkbox" data-skill="${l.key}" data-mode="blind" ${l.blind ? "checked" : ""} ${l.private ? "disabled" : ""}></label>
                  <label class="bsr-skill-grid__cb"><input type="checkbox" data-skill="${l.key}" data-mode="private" ${l.private ? "checked" : ""} ${l.blind ? "disabled" : ""}></label>
                  <span class="bsr-skill-grid__sep"></span>`;
                if (r) {
                  rows += `
                  <span class="bsr-skill-grid__name">${r.label}</span>
                  <label class="bsr-skill-grid__cb"><input type="checkbox" data-skill="${r.key}" data-mode="blind" ${r.blind ? "checked" : ""} ${r.private ? "disabled" : ""}></label>
                  <label class="bsr-skill-grid__cb"><input type="checkbox" data-skill="${r.key}" data-mode="private" ${r.private ? "checked" : ""} ${r.blind ? "disabled" : ""}></label>`;
                } else {
                  rows += `<span></span><span></span><span></span>`;
                }
              }
              return rows;
            })()}
          </div>

          <hr style="margin: 1rem 0; opacity: 0.3;">

          <label style="display:flex; gap:.5rem; align-items:center; margin-bottom:.35rem;">
            <input type="checkbox" name="savesEnabled" ${context.savesEnabled ? "checked" : ""}>
            <span>${context.labels.savesEnabledName}</span>
          </label>
          <label style="display:flex; gap:.5rem; align-items:center; margin-bottom:.75rem;">
            <input type="checkbox" name="blindRollersSaveChat" ${context.blindRollersSaveChat ? "checked" : ""}>
            <span>${context.labels.blindRollersSaveChatName}</span>
          </label>

          <div style="display:flex; justify-content:space-between; align-items:center; margin:.5rem 0;">
            <strong>${context.labels.saves}</strong>
            <div style="display:flex; gap:.5rem;">
              <button type="button" data-action="allSaves">${context.labels.allSaves}</button>
              <button type="button" data-action="noneSaves">${context.labels.noneSaves}</button>
            </div>
          </div>

          <div class="bsr-skill-grid">
            <strong></strong>
            <strong class="bsr-skill-grid__colhdr">${context.labels.blind}</strong>
            <strong class="bsr-skill-grid__colhdr">${context.labels.private}</strong>
            <span class="bsr-skill-grid__sep"></span>
            <strong></strong>
            <strong class="bsr-skill-grid__colhdr">${context.labels.blind}</strong>
            <strong class="bsr-skill-grid__colhdr">${context.labels.private}</strong>
            ${(() => {
              const half = Math.ceil(context.saveEntries.length / 2);
              const left = context.saveEntries.slice(0, half);
              const right = context.saveEntries.slice(half);
              let rows = "";
              for (let i = 0; i < half; i++) {
                const l = left[i];
                const r = right[i];
                rows += `
                  <span class="bsr-skill-grid__name">${l.label}</span>
                  <label class="bsr-skill-grid__cb"><input type="checkbox" data-save="${l.key}" data-mode="blind" ${l.blind ? "checked" : ""} ${l.private ? "disabled" : ""}></label>
                  <label class="bsr-skill-grid__cb"><input type="checkbox" data-save="${l.key}" data-mode="private" ${l.private ? "checked" : ""} ${l.blind ? "disabled" : ""}></label>
                  <span class="bsr-skill-grid__sep"></span>`;
                if (r) {
                  rows += `
                  <span class="bsr-skill-grid__name">${r.label}</span>
                  <label class="bsr-skill-grid__cb"><input type="checkbox" data-save="${r.key}" data-mode="blind" ${r.blind ? "checked" : ""} ${r.private ? "disabled" : ""}></label>
                  <label class="bsr-skill-grid__cb"><input type="checkbox" data-save="${r.key}" data-mode="private" ${r.private ? "checked" : ""} ${r.blind ? "disabled" : ""}></label>`;
                } else {
                  rows += `<span></span><span></span><span></span>`;
                }
              }
              return rows;
            })()}
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

        form.querySelectorAll('input[data-skill][data-mode]').forEach(input => {
          input.addEventListener("change", () => {
            const skill = input.dataset.skill;
            const mode = input.dataset.mode;
            if (!input.checked) {
              const opposite = form.querySelector(`input[data-skill="${skill}"][data-mode="${mode === "blind" ? "private" : "blind"}"]`);
              if (opposite) opposite.disabled = false;
            } else {
              const opposite = form.querySelector(`input[data-skill="${skill}"][data-mode="${mode === "blind" ? "private" : "blind"}"]`);
              if (opposite) {
                opposite.checked = false;
                opposite.disabled = true;
              }
            }
          });
        });

        form.querySelectorAll('input[data-save][data-mode]').forEach(input => {
          input.addEventListener("change", () => {
            const save = input.dataset.save;
            const mode = input.dataset.mode;
            if (!input.checked) {
              const opposite = form.querySelector(`input[data-save="${save}"][data-mode="${mode === "blind" ? "private" : "blind"}"]`);
              if (opposite) opposite.disabled = false;
            } else {
              const opposite = form.querySelector(`input[data-save="${save}"][data-mode="${mode === "blind" ? "private" : "blind"}"]`);
              if (opposite) {
                opposite.checked = false;
                opposite.disabled = true;
              }
            }
          });
        });
      }
    }

    async #onSave(event) {
      const form = event.target.form ?? event.target.closest("form");
      const formData = new foundry.applications.ux.FormDataExtended(form).object;

      const en = !!formData.enabled;
      const pairs = [["enabled", en]];

      form.querySelectorAll('input[type="checkbox"][data-skill][data-mode="blind"]').forEach(i => {
        pairs.push([i.dataset.skill, i.checked]);
      });
      form.querySelectorAll('input[type="checkbox"][data-skill][data-mode="private"]').forEach(i => {
        pairs.push([i.dataset.skill + "_private", i.checked]);
      });

      pairs.push(["savesEnabled", !!formData.savesEnabled]);
      form.querySelectorAll('input[type="checkbox"][data-save][data-mode="blind"]').forEach(i => {
        pairs.push(["save_" + i.dataset.save, i.checked]);
      });
      form.querySelectorAll('input[type="checkbox"][data-save][data-mode="private"]').forEach(i => {
        pairs.push(["save_" + i.dataset.save + "_private", i.checked]);
      });

      await setMany(pairs);
      await game.settings.set(MOD, "blindRollersChat", !!formData.blindRollersChat);
      await game.settings.set(MOD, "blindRollersSaveChat", !!formData.blindRollersSaveChat);

      this.close();
    }

    async _onAllAction(event, target) {
      const form = this.element.querySelector("form");
      form.querySelectorAll('input[data-skill][data-mode="blind"]').forEach(i => {
        i.checked = true;
        i.disabled = false;
        const priv = form.querySelector(`input[data-skill="${i.dataset.skill}"][data-mode="private"]`);
        if (priv) { priv.checked = false; priv.disabled = true; }
      });
    }

    async _onNoneAction(event, target) {
      const form = this.element.querySelector("form");
      form.querySelectorAll('input[data-skill][data-mode="blind"]').forEach(i => {
        i.checked = false;
        i.disabled = false;
      });
      form.querySelectorAll('input[data-skill][data-mode="private"]').forEach(i => {
        i.checked = false;
        i.disabled = false;
      });
    }

    async _onDefaultsAction(event, target) {
      const form = this.element.querySelector("form");
      const defaults = new Set(["dec","ins","itm","inv","prc","per"]);
      form.querySelectorAll('input[data-skill][data-mode="blind"]').forEach(i => {
        i.checked = defaults.has(i.dataset.skill);
        i.disabled = false;
        const priv = form.querySelector(`input[data-skill="${i.dataset.skill}"][data-mode="private"]`);
        if (priv) {
          priv.checked = false;
          priv.disabled = i.checked;
        }
      });
    }

    async _onAllSavesAction(event, target) {
      const form = this.element.querySelector("form");
      form.querySelectorAll('input[data-save][data-mode="blind"]').forEach(i => {
        i.checked = true;
        i.disabled = false;
        const priv = form.querySelector(`input[data-save="${i.dataset.save}"][data-mode="private"]`);
        if (priv) { priv.checked = false; priv.disabled = true; }
      });
    }

    async _onNoneSavesAction(event, target) {
      const form = this.element.querySelector("form");
      form.querySelectorAll('input[data-save][data-mode="blind"]').forEach(i => {
        i.checked = false;
        i.disabled = false;
      });
      form.querySelectorAll('input[data-save][data-mode="private"]').forEach(i => {
        i.checked = false;
        i.disabled = false;
      });
    }

    async _onSaveAction(event, target) {
      const form = this.element.querySelector("form");
      if (form) {
        const formData = new foundry.applications.ux.FormDataExtended(form).object;

        const en = !!formData.enabled;
        const pairs = [["enabled", en]];

        form.querySelectorAll('input[type="checkbox"][data-skill][data-mode="blind"]').forEach(i => {
          pairs.push([i.dataset.skill, i.checked]);
        });
        form.querySelectorAll('input[type="checkbox"][data-skill][data-mode="private"]').forEach(i => {
          pairs.push([i.dataset.skill + "_private", i.checked]);
        });

        pairs.push(["savesEnabled", !!formData.savesEnabled]);
        form.querySelectorAll('input[type="checkbox"][data-save][data-mode="blind"]').forEach(i => {
          pairs.push(["save_" + i.dataset.save, i.checked]);
        });
        form.querySelectorAll('input[type="checkbox"][data-save][data-mode="private"]').forEach(i => {
          pairs.push(["save_" + i.dataset.save + "_private", i.checked]);
        });

        await setMany(pairs);
        await game.settings.set(MOD, "blindRollersChat", !!formData.blindRollersChat);
        await game.settings.set(MOD, "blindRollersSaveChat", !!formData.blindRollersSaveChat);
      }

      this.close();
    }

    async _onCancelAction(event, target) {
      this.close();
    }
  }

  Hooks.once("init", () => {
    game.settings.registerMenu(MOD, "menuSkills", {
      name:  "BSR.Menu.SkillsAndSaves.Name",
      label: "BSR.Menu.SkillsAndSaves.Label",
      icon:  "fa-solid fa-sliders",
      type:  BSRMenuSkills,
      restricted: true
    });
  });
})();
window.BSR_102.load_count += 1;
BSR_102.load_complete();
