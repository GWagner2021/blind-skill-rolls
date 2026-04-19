import { MOD } from "../../core/constants.js";
import { dbgInfo, dbgWarn } from "../../debug/logger.js";
const MIDI_ID = "midi-qol";
const SKILL_LIST = ["acr", "ani", "arc", "ath", "dec", "his", "ins", "inv", "itm", "med", "nat", "per", "prc", "prf", "rel", "slt", "ste", "sur"];
const SAVE_LIST = ["str", "dex", "con", "int", "wis", "cha"];
const SYNC_DEBOUNCE_MS = 800;
let _isSyncing = false;
let _lastSyncDirection = null;
let _syncTimeout = null;
let _saveSyncTimeout = null;
function isMidiActive() {
    if (typeof game === "undefined" || !game.modules)
        return false;
    return game.modules.get(MIDI_ID)?.active === true;
}
function shouldShowMessages() {
    if (!game.user?.isGM)
        return false;
    try {
        return game.settings.get(MOD, "showSyncMessages");
    }
    catch {
        return true;
    }
}
function showNotification(message) {
    if (shouldShowMessages() && game.user?.isGM)
        ui.notifications.info(message);
}
async function updateMidiConfig(cfgSettings) {
    if (!isMidiActive())
        return;
    try {
        if (game.user.isGM)
            await game.settings.set(MIDI_ID, "ConfigSettings", cfgSettings);
    }
    catch (e) {
        dbgWarn("midi-sync | failed to update midi-qol settings:", e);
    }
}
function buildBlindSkillList() {
    const areSkillsEnabled = (() => { try {
        return !!game.settings.get(MOD, "enabled");
    }
    catch {
        return false;
    } })();
    if (!areSkillsEnabled)
        return [];
    const list = [];
    for (const sk of SKILL_LIST) {
        try {
            if (game.settings.get(MOD, sk))
                list.push(sk);
        }
        catch { /* ignore */ }
    }
    return list;
}
function buildBlindSaveList() {
    const areSavesEnabled = (() => { try {
        return !!game.settings.get(MOD, "savesEnabled");
    }
    catch {
        return false;
    } })();
    if (!areSavesEnabled)
        return [];
    const list = [];
    for (const ab of SAVE_LIST) {
        try {
            if (game.settings.get(MOD, "save_" + ab))
                list.push(ab);
        }
        catch { /* ignore */ }
    }
    return list;
}
async function performInitialSync() {
    if (!isMidiActive()) {
        dbgInfo("midi-sync | midi-qol not active – sync disabled");
        return;
    }
    try {
        _isSyncing = true;
        _lastSyncDirection = "initial";
        let cfgSettings;
        try {
            cfgSettings = game.settings.get(MIDI_ID, "ConfigSettings");
        }
        catch (e) {
            dbgWarn("midi-sync | midi-qol ConfigSettings not found:", e);
            return;
        }
        const blindSkills = buildBlindSkillList();
        const blindSaves = buildBlindSaveList();
        cfgSettings.rollSkillsBlind = blindSkills.length === SKILL_LIST.length ? ["all"] : blindSkills;
        cfgSettings.rollSavesBlind = blindSaves.length === SAVE_LIST.length ? ["all"] : blindSaves;
        await updateMidiConfig(cfgSettings);
        dbgInfo(`midi-sync | Initial sync complete: ${blindSkills.length} blind skills, ${blindSaves.length} blind saves → midi-qol`);
        showNotification(game.i18n.localize("BSR.MidiSync.Notification.InitSync"));
    }
    catch (e) {
        dbgWarn("midi-sync | Initial sync error:", e);
    }
    finally {
        setTimeout(() => { _isSyncing = false; _lastSyncDirection = null; }, 1000);
    }
}
async function syncBSRToMidi() {
    if (!isMidiActive() || _isSyncing)
        return;
    if (_lastSyncDirection === "midi-to-bsr") {
        dbgWarn("midi-sync | Skipping BSR→midi (just synced FROM midi)");
        _lastSyncDirection = null;
        return;
    }
    try {
        _isSyncing = true;
        _lastSyncDirection = "bsr-to-midi";
        let cfgSettings;
        try {
            cfgSettings = game.settings.get(MIDI_ID, "ConfigSettings");
        }
        catch (e) {
            dbgWarn("midi-sync | Failed to get midi-qol ConfigSettings:", e);
            return;
        }
        const blindSkills = buildBlindSkillList();
        const blindSaves = buildBlindSaveList();
        cfgSettings.rollSkillsBlind = blindSkills.length === SKILL_LIST.length ? ["all"] : blindSkills;
        cfgSettings.rollSavesBlind = blindSaves.length === SAVE_LIST.length ? ["all"] : blindSaves;
        await updateMidiConfig(cfgSettings);
        dbgInfo(`midi-sync | Synced ${blindSkills.length} blind skills, ${blindSaves.length} blind saves to midi-qol`);
        showNotification(game.i18n.format("BSR.MidiSync.Notification.SyncedTo", { count: blindSkills.length }));
    }
    catch (e) {
        dbgWarn("midi-sync | sync error (BSR → midi):", e);
    }
    finally {
        setTimeout(() => { _isSyncing = false; _lastSyncDirection = null; }, 1000);
    }
}
Hooks.on("updateSetting", async (document) => {
    if (_isSyncing)
        return;
    if (document.key === `${MIDI_ID}.ConfigSettings`) {
        if (!isMidiActive())
            return;
        if (_lastSyncDirection === "bsr-to-midi") {
            _lastSyncDirection = null;
            return;
        }
        try {
            _isSyncing = true;
            _lastSyncDirection = "midi-to-bsr";
            let cfgSettings;
            try {
                cfgSettings = game.settings.get(MIDI_ID, "ConfigSettings");
            }
            catch (e) {
                dbgWarn("midi-sync | Failed to get midi-qol ConfigSettings:", e);
                return;
            }
            let midiSkills = cfgSettings.rollSkillsBlind || [];
            if (midiSkills.includes("all"))
                midiSkills = [...SKILL_LIST];
            let skillChanges = 0;
            for (const sk of SKILL_LIST) {
                const want = midiSkills.includes(sk);
                const current = game.settings.get(MOD, sk);
                if (current !== want && game.user.isGM) {
                    await game.settings.set(MOD, sk, want);
                    skillChanges++;
                    if (want) {
                        try {
                            if (game.settings.get(MOD, sk + "_private")) {
                                await game.settings.set(MOD, sk + "_private", false);
                                skillChanges++;
                            }
                        }
                        catch { /* ignore */ }
                    }
                }
            }
            const wantSkillsEnabled = midiSkills.length > 0;
            try {
                if (!!game.settings.get(MOD, "enabled") !== wantSkillsEnabled && game.user.isGM) {
                    await game.settings.set(MOD, "enabled", wantSkillsEnabled);
                    skillChanges++;
                }
            }
            catch { /* ignore */ }
            let midiSaves = cfgSettings.rollSavesBlind || [];
            if (midiSaves.includes("all"))
                midiSaves = [...SAVE_LIST];
            let saveChanges = 0;
            for (const ab of SAVE_LIST) {
                const want = midiSaves.includes(ab);
                try {
                    const current = game.settings.get(MOD, "save_" + ab);
                    if (current !== want && game.user.isGM) {
                        await game.settings.set(MOD, "save_" + ab, want);
                        saveChanges++;
                        if (want) {
                            try {
                                if (game.settings.get(MOD, "save_" + ab + "_private")) {
                                    await game.settings.set(MOD, "save_" + ab + "_private", false);
                                    saveChanges++;
                                }
                            }
                            catch { /* ignore */ }
                        }
                    }
                }
                catch { /* ignore */ }
            }
            const wantSavesEnabled = midiSaves.length > 0;
            try {
                if (!!game.settings.get(MOD, "savesEnabled") !== wantSavesEnabled && game.user.isGM) {
                    await game.settings.set(MOD, "savesEnabled", wantSavesEnabled);
                    saveChanges++;
                }
            }
            catch { /* ignore */ }
            if (skillChanges > 0 || saveChanges > 0) {
                dbgInfo(`midi-sync | Synced ${midiSkills.length} blind skills, ${midiSaves.length} blind saves from midi-qol (${skillChanges + saveChanges} changed)`);
                showNotification(game.i18n.format("BSR.MidiSync.Notification.SyncedFrom", { count: midiSkills.length }));
            }
        }
        catch (e) {
            dbgWarn("midi-sync | sync error (midi → BSR):", e);
        }
        finally {
            setTimeout(() => { _isSyncing = false; _lastSyncDirection = null; }, 1000);
        }
        return;
    }
    if (document.key.startsWith(`${MOD}.`)) {
        const settingName = document.key.slice(MOD.length + 1);
        if (SKILL_LIST.includes(settingName)) {
            if (!isMidiActive())
                return;
            if (_syncTimeout)
                clearTimeout(_syncTimeout);
            _syncTimeout = setTimeout(async () => { _syncTimeout = null; await syncBSRToMidi(); }, SYNC_DEBOUNCE_MS);
            return;
        }
        if (settingName.startsWith("save_")) {
            const saveKey = settingName.replace("save_", "").replace("_private", "");
            if (SAVE_LIST.includes(saveKey) && !settingName.endsWith("_private")) {
                if (!isMidiActive())
                    return;
                if (_saveSyncTimeout)
                    clearTimeout(_saveSyncTimeout);
                _saveSyncTimeout = setTimeout(async () => { _saveSyncTimeout = null; await syncBSRToMidi(); }, SYNC_DEBOUNCE_MS);
            }
            return;
        }
        if (settingName === "savesEnabled") {
            if (!isMidiActive())
                return;
            if (_saveSyncTimeout)
                clearTimeout(_saveSyncTimeout);
            _saveSyncTimeout = setTimeout(async () => { _saveSyncTimeout = null; await syncBSRToMidi(); }, SYNC_DEBOUNCE_MS);
        }
        if (settingName === "enabled") {
            if (!isMidiActive())
                return;
            if (_syncTimeout)
                clearTimeout(_syncTimeout);
            _syncTimeout = setTimeout(async () => { _syncTimeout = null; await syncBSRToMidi(); }, SYNC_DEBOUNCE_MS);
        }
    }
});
Hooks.once("ready", async () => {
    setTimeout(async () => { await performInitialSync(); }, 500);
});
