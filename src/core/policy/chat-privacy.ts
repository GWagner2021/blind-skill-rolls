import { MOD } from "../constants.js";

export function shouldHideForeignSecrets(): boolean {
  try { return game.settings.get(MOD, "hideForeignSecrets") as boolean; }
  catch { return true; }
}

export function shouldMuteForeignSecretSounds(): boolean {
  if (shouldHideForeignSecrets()) return true;
  try { return game.settings.get(MOD, "muteForeignSecretSounds") as boolean; }
  catch { return true; }
}
