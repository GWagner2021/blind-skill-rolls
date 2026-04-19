import { MOD } from "../constants.js";
const sget = (k, fb = false) => {
    try {
        return !!game.settings.get(MOD, k);
    }
    catch {
        return fb;
    }
};
export const isEnabled = () => !!sget("enabled", false);
export const isSkillBlind = (skillId) => {
    if (!isEnabled())
        return false;
    if (typeof skillId !== "string" || !skillId)
        return false;
    try {
        return !!game.settings.get(MOD, skillId);
    }
    catch {
        return false;
    }
};
export const isSkillPrivate = (skillId) => {
    if (!isEnabled())
        return false;
    if (typeof skillId !== "string" || !skillId)
        return false;
    if (isSkillBlind(skillId))
        return false;
    try {
        return !!game.settings.get(MOD, skillId + "_private");
    }
    catch {
        return false;
    }
};
