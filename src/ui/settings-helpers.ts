import { MOD } from "../core/constants.js";

export const L = (k: string, fb?: string): string => {
  try {
    const t = game?.i18n?.localize?.(k);
    return (t && t !== k) ? t : (fb ?? k);
  } catch { return fb ?? k; }
};

export const setMany = async (pairs: [string, unknown][]): Promise<void> => {
  for (const [k, v] of pairs) await game.settings.set(MOD, k, v);
};

export const getSetting = <T = unknown>(key: string, fallback: T): T => {
  try { return game.settings.get(MOD, key) as T; }
  catch { return fallback; }
};
