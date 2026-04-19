import { MOD } from "../../core/constants.js";
import { FF_SETTING_KEYS, ALL_BSR_FF_TYPES, getAutoFastForwardGM, getAutoFastForwardPlayer, setAutoFastForward, setAutoFastForwardPlayer, bsrToMidiArray, midiToBsrSet } from "./ff-api.js";
import { dbgInfo, dbgWarn } from "../../debug/logger.js";
const MIDI_ID = "midi-qol";
const INITIAL_SYNC_DELAY_MS = 600;
const SYNC_DEBOUNCE_MS = 800;
const SYNC_LOCK_TIMEOUT_MS = 1000;
let _ffSyncing = false;
let _ffSyncDirection = null;
let _ffSyncTimeout = null;
let _ffInitDone = false;
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
function isMidiActive() {
    try {
        return game.modules.get(MIDI_ID)?.active === true;
    }
    catch {
        return false;
    }
}
function arraysEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b))
        return false;
    if (a.length !== b.length)
        return false;
    const s1 = [...a].sort();
    const s2 = [...b].sort();
    return s1.every((v, i) => v === s2[i]);
}
// ---- Initial: BSR ist Source of Truth ----
async function syncFastForwardInitial() {
    if (!isMidiActive()) {
        _ffInitDone = true;
        return;
    }
    try {
        _ffSyncing = true;
        _ffSyncDirection = "initial";
        let cfgSettings;
        try {
            cfgSettings = game.settings.get(MIDI_ID, "ConfigSettings");
        }
        catch {
            _ffInitDone = true;
            return;
        }
        const gmFF = getAutoFastForwardGM();
        const playerFF = getAutoFastForwardPlayer();
        let changed = false;
        const wantGm = bsrToMidiArray(gmFF);
        const wantPlayer = bsrToMidiArray(playerFF);
        if (!Array.isArray(cfgSettings.gmAutoFastForward))
            cfgSettings.gmAutoFastForward = [];
        if (!Array.isArray(cfgSettings.autoFastForward))
            cfgSettings.autoFastForward = [];
        if (!arraysEqual(cfgSettings.gmAutoFastForward, wantGm)) {
            cfgSettings.gmAutoFastForward = wantGm;
            changed = true;
        }
        if (!arraysEqual(cfgSettings.autoFastForward, wantPlayer)) {
            cfgSettings.autoFastForward = wantPlayer;
            changed = true;
        }
        if (changed && game.user?.isGM) {
            await game.settings.set(MIDI_ID, "ConfigSettings", cfgSettings);
            dbgInfo("ff-sync | initial sync: BSR → MidiQOL complete");
            showNotification("BSR FF sync: initial sync to MidiQOL completed.");
        }
    }
    catch (e) {
        dbgWarn("ff-sync | initial sync failed:", e);
    }
    finally {
        setTimeout(() => { _ffSyncing = false; _ffSyncDirection = null; _ffInitDone = true; }, SYNC_LOCK_TIMEOUT_MS);
    }
}
// ---- BSR → MidiQOL ----
async function syncBSRToMidi() {
    if (!isMidiActive() || _ffSyncing)
        return;
    if (_ffSyncDirection === "midi-to-bsr") {
        _ffSyncDirection = null;
        return;
    }
    try {
        _ffSyncing = true;
        _ffSyncDirection = "bsr-to-midi";
        let cfgSettings;
        try {
            cfgSettings = game.settings.get(MIDI_ID, "ConfigSettings");
        }
        catch {
            return;
        }
        const wantGm = bsrToMidiArray(getAutoFastForwardGM());
        const wantPlayer = bsrToMidiArray(getAutoFastForwardPlayer());
        let changed = false;
        if (!Array.isArray(cfgSettings.gmAutoFastForward))
            cfgSettings.gmAutoFastForward = [];
        if (!Array.isArray(cfgSettings.autoFastForward))
            cfgSettings.autoFastForward = [];
        if (!arraysEqual(cfgSettings.gmAutoFastForward, wantGm)) {
            cfgSettings.gmAutoFastForward = wantGm;
            changed = true;
        }
        if (!arraysEqual(cfgSettings.autoFastForward, wantPlayer)) {
            cfgSettings.autoFastForward = wantPlayer;
            changed = true;
        }
        if (changed && game.user?.isGM) {
            await game.settings.set(MIDI_ID, "ConfigSettings", cfgSettings);
            dbgInfo("ff-sync | synced fast-forward to MidiQOL");
            showNotification("BSR FF sync: settings synced to MidiQOL.");
        }
    }
    catch (e) {
        dbgWarn("ff-sync | BSR → MidiQOL sync failed:", e);
    }
    finally {
        setTimeout(() => { _ffSyncing = false; _ffSyncDirection = null; }, SYNC_LOCK_TIMEOUT_MS);
    }
}
// ---- MidiQOL → BSR ----
async function syncMidiToBSR() {
    if (!isMidiActive() || _ffSyncing)
        return;
    if (_ffSyncDirection === "bsr-to-midi") {
        _ffSyncDirection = null;
        return;
    }
    try {
        _ffSyncing = true;
        _ffSyncDirection = "midi-to-bsr";
        let cfgSettings;
        try {
            cfgSettings = game.settings.get(MIDI_ID, "ConfigSettings");
        }
        catch {
            return;
        }
        const wantGM = midiToBsrSet(Array.isArray(cfgSettings.gmAutoFastForward) ? cfgSettings.gmAutoFastForward : []);
        const wantPlayer = midiToBsrSet(Array.isArray(cfgSettings.autoFastForward) ? cfgSettings.autoFastForward : []);
        if (game.user?.isGM) {
            let anyChanged = false;
            const currentGM = getAutoFastForwardGM();
            const currentPlayer = getAutoFastForwardPlayer();
            for (const t of ALL_BSR_FF_TYPES) {
                if (wantGM.has(t) !== currentGM.includes(t)) {
                    await setAutoFastForward(t, wantGM.has(t));
                    anyChanged = true;
                }
            }
            for (const t of ALL_BSR_FF_TYPES) {
                if (wantPlayer.has(t) !== currentPlayer.includes(t)) {
                    await setAutoFastForwardPlayer(t, wantPlayer.has(t));
                    anyChanged = true;
                }
            }
            if (anyChanged) {
                dbgInfo("ff-sync | synced fast-forward from MidiQOL");
                showNotification("BSR FF sync: settings synced from MidiQOL.");
            }
        }
    }
    catch (e) {
        dbgWarn("ff-sync | MidiQOL → BSR sync failed:", e);
    }
    finally {
        setTimeout(() => { _ffSyncing = false; _ffSyncDirection = null; }, SYNC_LOCK_TIMEOUT_MS);
    }
}
// ---- updateSetting-Listener ----
Hooks.on("updateSetting", (document) => {
    if (_ffSyncing)
        return;
    if (document.key.startsWith(`${MOD}.`)) {
        const settingName = document.key.slice(MOD.length + 1);
        if (FF_SETTING_KEYS.has(settingName)) {
            if (!isMidiActive())
                return;
            if (_ffSyncTimeout)
                clearTimeout(_ffSyncTimeout);
            _ffSyncTimeout = setTimeout(async () => {
                _ffSyncTimeout = null;
                await syncBSRToMidi();
            }, SYNC_DEBOUNCE_MS);
            return;
        }
    }
    if (document.key === `${MIDI_ID}.ConfigSettings`) {
        if (!isMidiActive() || !_ffInitDone)
            return;
        if (_ffSyncDirection === "bsr-to-midi" || _ffSyncDirection === "initial")
            return;
        if (_ffSyncTimeout)
            clearTimeout(_ffSyncTimeout);
        _ffSyncTimeout = setTimeout(async () => {
            _ffSyncTimeout = null;
            await syncMidiToBSR();
        }, SYNC_DEBOUNCE_MS);
    }
});
export const initFFSync = () => {
    setTimeout(syncFastForwardInitial, INITIAL_SYNC_DELAY_MS);
};
