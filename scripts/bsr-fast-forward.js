// scripts/bsr-fast-forward.js

(() => {
  "use strict";
  const MOD = "blind-skill-rolls";

  // Timing constants (ms) – aligned with existing BSR sync in bsr-skills-settings.js
  const INITIAL_SYNC_DELAY_MS = 600;
  const SYNC_DEBOUNCE_MS      = 800;
  const SYNC_LOCK_TIMEOUT_MS  = 1000;

  const isFF = (type) => globalThis.BSR?.isAutoFastForward?.(type) ?? false;

  const applyFFv2 = (config, dialog) => {
    try {
      if (dialog && typeof dialog === "object") dialog.configure = false;
      if (config && typeof config === "object") config.fastForward = true;
    } catch { /* safe fallthrough */ }
  };

  const FF_HOOKS = [
    ["attack",      "dnd5e.preRollAttackV2"],
    ["damage",      "dnd5e.preRollDamageV2"],
    ["abilityCheck", "dnd5e.preRollAbilityCheckV2"],
    ["savingThrow", "dnd5e.preRollSavingThrowV2"],
    ["skill",       "dnd5e.preRollSkillV2"],
    ["tool",        "dnd5e.preRollToolV2"]
  ];

  Hooks.on("ready", () => {
    window.BSR_102.load_count += 1;

    for (const [type, hook] of FF_HOOKS) {
      Hooks.on(hook, (cfg, dlg) => {
        if (type === "abilityCheck") {
          const names = cfg?.hookNames;
          if (Array.isArray(names) && (names.includes("tool") || names.includes("skill"))) return;
        }
        if (isFF(type)) applyFFv2(cfg, dlg);
      });
    }

    setTimeout(syncFastForwardInitial, INITIAL_SYNC_DELAY_MS);
  });

  // ---- MidiQOL Sync ----
  const midiID = "midi-qol";
  let _ffSyncing = false;
  let _ffSyncDirection = null;
  let _ffSyncTimeout = null;
  let _ffInitDone = false;

  const BSR_TO_MIDI = {
    attack: "attack",
    damage: "damage",
    abilityCheck: "check",
    savingThrow: "save",
    skill: "skill",
    tool: "tool"
  };

  const MIDI_TO_BSR = Object.fromEntries(
    Object.entries(BSR_TO_MIDI).map(([bsr, midi]) => [midi, bsr])
  );

  const ALL_BSR_TYPES = Object.keys(BSR_TO_MIDI);

  function isMidiActive() {
    try { return game.modules.get(midiID)?.active === true; } catch { return false; }
  }

  function bsrToMidiArray(bsrTypes) {
    return bsrTypes.map(t => BSR_TO_MIDI[t]).filter(Boolean);
  }

  function midiToBsrSet(midiArr) {
    if (!Array.isArray(midiArr)) return new Set();
    return new Set(midiArr.map(v => MIDI_TO_BSR[v]).filter(Boolean));
  }

  function arraysEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    const sorted1 = [...a].sort();
    const sorted2 = [...b].sort();
    return sorted1.every((v, i) => v === sorted2[i]);
  }

  // ---- Initial sync: BSR is source of truth ----
  async function syncFastForwardInitial() {
    if (!isMidiActive()) { _ffInitDone = true; return; }
    try {
      _ffSyncing = true;
      _ffSyncDirection = "initial";

      let cfgSettings;
      try { cfgSettings = game.settings.get(midiID, "ConfigSettings"); }
      catch { _ffInitDone = true; return; }

      const gmFF = globalThis.BSR.getAutoFastForwardGM();
      const playerFF = globalThis.BSR.getAutoFastForwardPlayer();
      let changed = false;
      const wantGmArr = bsrToMidiArray(gmFF);
      const wantPlayerArr = bsrToMidiArray(playerFF);

      if (!Array.isArray(cfgSettings.gmAutoFastForward)) cfgSettings.gmAutoFastForward = [];
      if (!Array.isArray(cfgSettings.autoFastForward)) cfgSettings.autoFastForward = [];
      if (!arraysEqual(cfgSettings.gmAutoFastForward, wantGmArr)) {
        cfgSettings.gmAutoFastForward = wantGmArr;
        changed = true;
      }

      if (!arraysEqual(cfgSettings.autoFastForward, wantPlayerArr)) {
        cfgSettings.autoFastForward = wantPlayerArr;
        changed = true;
      }

      if (changed && game.user?.isGM) {
        await game.settings.set(midiID, "ConfigSettings", cfgSettings);
        globalThis.dbgInfo?.("BSR-FF | Initial sync: BSR \u2192 MidiQOL complete");
      }
    } catch (e) {
      globalThis.dbgWarn?.("BSR-FF | Initial sync failed:", e);
    } finally {
      setTimeout(() => {
        _ffSyncing = false;
        _ffSyncDirection = null;
        _ffInitDone = true;
      }, SYNC_LOCK_TIMEOUT_MS);
    }
  }

  async function syncBSRToMidi() {
    if (!isMidiActive() || _ffSyncing) return;
    if (_ffSyncDirection === "midi-to-bsr") {
      _ffSyncDirection = null;
      return;
    }
    try {
      _ffSyncing = true;
      _ffSyncDirection = "bsr-to-midi";

      let cfgSettings;
      try { cfgSettings = game.settings.get(midiID, "ConfigSettings"); }
      catch { return; }

      const gmFF = globalThis.BSR.getAutoFastForwardGM();
      const playerFF = globalThis.BSR.getAutoFastForwardPlayer();
      let changed = false;

      const wantGmArr = bsrToMidiArray(gmFF);
      const wantPlayerArr = bsrToMidiArray(playerFF);

      if (!Array.isArray(cfgSettings.gmAutoFastForward)) cfgSettings.gmAutoFastForward = [];
      if (!Array.isArray(cfgSettings.autoFastForward)) cfgSettings.autoFastForward = [];

      if (!arraysEqual(cfgSettings.gmAutoFastForward, wantGmArr)) {
        cfgSettings.gmAutoFastForward = wantGmArr;
        changed = true;
      }

      if (!arraysEqual(cfgSettings.autoFastForward, wantPlayerArr)) {
        cfgSettings.autoFastForward = wantPlayerArr;
        changed = true;
      }

      if (changed && game.user?.isGM) {
        await game.settings.set(midiID, "ConfigSettings", cfgSettings);
        globalThis.dbgInfo?.("BSR-FF | Synced fast-forward to MidiQOL");
      }
    } catch (e) {
      globalThis.dbgWarn?.("BSR-FF | BSR \u2192 MidiQOL sync failed:", e);
    } finally {
      setTimeout(() => { _ffSyncing = false; _ffSyncDirection = null; }, SYNC_LOCK_TIMEOUT_MS);
    }
  }

  // ---- Runtime sync: MidiQOL → BSR ----
  async function syncMidiToBSR() {
    if (!isMidiActive() || _ffSyncing) return;
    if (_ffSyncDirection === "bsr-to-midi") {
      _ffSyncDirection = null;
      return;
    }
    try {
      _ffSyncing = true;
      _ffSyncDirection = "midi-to-bsr";

      let cfgSettings;
      try { cfgSettings = game.settings.get(midiID, "ConfigSettings"); }
      catch { return; }

      // Read MidiQOL arrays and convert to BSR type sets
      const midiGmArr = Array.isArray(cfgSettings.gmAutoFastForward) ? cfgSettings.gmAutoFastForward : [];
      const midiPlayerArr = Array.isArray(cfgSettings.autoFastForward) ? cfgSettings.autoFastForward : [];

      const wantGM = midiToBsrSet(midiGmArr);
      const wantPlayer = midiToBsrSet(midiPlayerArr);

      if (game.user?.isGM) {
        const setGM = globalThis.BSR.setAutoFastForward;
        const setPlayer = globalThis.BSR.setAutoFastForwardPlayer;
        let anyChanged = false;

        if (setGM) {
          const currentGM = globalThis.BSR.getAutoFastForwardGM();
          for (const t of ALL_BSR_TYPES) {
            const want = wantGM.has(t);
            const have = currentGM.includes(t);
            if (want !== have) {
              await setGM(t, want);
              anyChanged = true;
            }
          }
        }

        if (setPlayer) {
          const currentPlayer = globalThis.BSR.getAutoFastForwardPlayer();
          for (const t of ALL_BSR_TYPES) {
            const want = wantPlayer.has(t);
            const have = currentPlayer.includes(t);
            if (want !== have) {
              await setPlayer(t, want);
              anyChanged = true;
            }
          }
        }

        if (anyChanged) globalThis.dbgInfo?.("BSR-FF | Synced fast-forward from MidiQOL");
      }
    } catch (e) {
      globalThis.dbgWarn?.("BSR-FF | MidiQOL \u2192 BSR sync failed:", e);
    } finally {
      setTimeout(() => { _ffSyncing = false; _ffSyncDirection = null; }, SYNC_LOCK_TIMEOUT_MS);
    }
  }

  // ---- Watch for setting changes ----
  Hooks.on("updateSetting", (document, changed) => {
    if (_ffSyncing) return;

    // BSR fast-forward setting changed (GM or player) → sync to MidiQOL
    const ffKeys = globalThis.BSR?.FF_SETTING_KEYS;
    if (ffKeys && document.key.startsWith(`${MOD}.`)) {
      const settingName = document.key.slice(MOD.length + 1);
      if (ffKeys.has(settingName)) {
        if (!isMidiActive()) return;
        if (_ffSyncTimeout) clearTimeout(_ffSyncTimeout);
        _ffSyncTimeout = setTimeout(async () => {
          _ffSyncTimeout = null;
          await syncBSRToMidi();
        }, SYNC_DEBOUNCE_MS);
      }
    }

    // MidiQOL ConfigSettings changed → sync back to BSR (only after init)
    if (document.key === `${midiID}.ConfigSettings`) {
      if (!isMidiActive() || !_ffInitDone) return;
      if (_ffSyncDirection === "bsr-to-midi" || _ffSyncDirection === "initial") return;
      if (_ffSyncTimeout) clearTimeout(_ffSyncTimeout);
      _ffSyncTimeout = setTimeout(async () => {
        _ffSyncTimeout = null;
        await syncMidiToBSR();
      }, SYNC_DEBOUNCE_MS);
    }
  });
})();

window.BSR_102.load_count += 1;
BSR_102.load_complete();
