import { MOD } from "../constants.js";

const sget = (k: string, fb: boolean = false): boolean => {
  try { return !!game.settings.get(MOD, k); } catch { return fb; }
};

export const isEnabled = (): boolean => !!sget("enabled", false);

export const isSkillBlind = (skillId: string): boolean => {
  if (!isEnabled()) return false;
  if (typeof skillId !== "string" || !skillId) return false;
  try { return !!game.settings.get(MOD, skillId); } catch { return false; }
};

export const isSkillPrivate = (skillId: string): boolean => {
  if (!isEnabled()) return false;
  if (typeof skillId !== "string" || !skillId) return false;
  if (isSkillBlind(skillId)) return false;
  try { return !!game.settings.get(MOD, skillId + "_private"); } catch { return false; }
};
