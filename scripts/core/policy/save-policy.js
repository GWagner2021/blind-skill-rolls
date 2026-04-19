import { MOD } from "../constants.js";
export const isSavesEnabled = () => {
    try {
        return !!game.settings.get(MOD, "savesEnabled");
    }
    catch {
        return false;
    }
};
export const isSaveBlind = (abilityId) => {
    if (!isSavesEnabled())
        return false;
    if (typeof abilityId !== "string" || !abilityId)
        return false;
    try {
        return !!game.settings.get(MOD, "save_" + abilityId);
    }
    catch {
        return false;
    }
};
export const isSavePrivate = (abilityId) => {
    if (!isSavesEnabled())
        return false;
    if (typeof abilityId !== "string" || !abilityId)
        return false;
    if (isSaveBlind(abilityId))
        return false;
    try {
        return !!game.settings.get(MOD, "save_" + abilityId + "_private");
    }
    catch {
        return false;
    }
};
