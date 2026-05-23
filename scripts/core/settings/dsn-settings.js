import { MOD } from "../constants.js";
import { dbgDebug, dbgWarn } from "../../debug/logger.js";
const DSN_MOD = "dice-so-nice";
const DSN_KEY = "showGhostDice";
const LEGACY_BSR_GHOST_MODE_KEY = `${MOD}.dsnGhostDiceMode`;
const FORCED_GHOST_MODE = "2";
async function setDsnGhost() {
    if (!game.user?.isGM)
        return;
    if (!game.modules.get(DSN_MOD)?.active)
        return;
    const cur = String(game.settings.get(DSN_MOD, DSN_KEY));
    if (cur === FORCED_GHOST_MODE)
        return;
    await game.settings.set(DSN_MOD, DSN_KEY, FORCED_GHOST_MODE);
}
async function deleteLegacyBsrGhostModeSetting() {
    try {
        if (!game.user?.isGM)
            return;
        const worldSettings = game.settings.storage?.get?.("world");
        const legacy = worldSettings?.getSetting?.(LEGACY_BSR_GHOST_MODE_KEY, null);
        if (!legacy)
            return;
        await legacy.delete();
        dbgDebug("dsn-settings | removed legacy BSR dsnGhostDiceMode setting");
    }
    catch (e) {
        dbgWarn("dsn-settings | legacy dsnGhostDiceMode cleanup failed", e);
    }
}
Hooks.once("ready", async () => {
    try {
        if (!game.user?.isGM)
            return;
        await deleteLegacyBsrGhostModeSetting();
        if (!game.modules.get(DSN_MOD)?.active)
            return;
        await setDsnGhost();
    }
    catch (e) {
        dbgWarn("dsn-settings | ready sync failed", e);
    }
});
