import { MOD } from "../constants.js";
export function shouldHideForeignSecrets() {
    try {
        return game.settings.get(MOD, "hideForeignSecrets");
    }
    catch {
        return true;
    }
}
export function shouldMuteForeignSecretSounds() {
    if (shouldHideForeignSecrets())
        return true;
    try {
        return game.settings.get(MOD, "muteForeignSecretSounds");
    }
    catch {
        return true;
    }
}
