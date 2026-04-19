import { MOD } from "../core/constants.js";
export const L = (k, fb) => {
    try {
        const t = game?.i18n?.localize?.(k);
        return (t && t !== k) ? t : (fb ?? k);
    }
    catch {
        return fb ?? k;
    }
};
export const setMany = async (pairs) => {
    for (const [k, v] of pairs)
        await game.settings.set(MOD, k, v);
};
export const getSetting = (key, fallback) => {
    try {
        return game.settings.get(MOD, key);
    }
    catch {
        return fallback;
    }
};
