import { MOD } from "../constants.js";
const ABILITY_ALIASES = Object.freeze({
    str: "str",
    strength: "str",
    staerke: "str",
    starke: "str",
    dex: "dex",
    dexterity: "dex",
    geschicklichkeit: "dex",
    con: "con",
    constitution: "con",
    konstitution: "con",
    int: "int",
    intelligence: "int",
    intelligenz: "int",
    wis: "wis",
    wisdom: "wis",
    weisheit: "wis",
    cha: "cha",
    charisma: "cha"
});
export const normalizeAbilityId = (value) => {
    if (typeof value === "string") {
        const key = value.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
        return ABILITY_ALIASES[key] ?? null;
    }
    if (!value || typeof value !== "object")
        return null;
    const source = value;
    return normalizeAbilityId(source.id)
        ?? normalizeAbilityId(source.key)
        ?? normalizeAbilityId(source.value)
        ?? normalizeAbilityId(source.abilityId)
        ?? normalizeAbilityId(source.ability);
};
export const isAbilityChecksEnabled = () => {
    try {
        return !!game.settings.get(MOD, "abilityChecksEnabled");
    }
    catch {
        return false;
    }
};
export const isAbilityCheckBlind = (abilityId) => {
    if (!isAbilityChecksEnabled())
        return false;
    const normalized = normalizeAbilityId(abilityId);
    if (!normalized)
        return false;
    try {
        return !!game.settings.get(MOD, "ability_" + normalized);
    }
    catch {
        return false;
    }
};
export const isAbilityCheckPrivate = (abilityId) => {
    if (!isAbilityChecksEnabled())
        return false;
    const normalized = normalizeAbilityId(abilityId);
    if (!normalized)
        return false;
    if (isAbilityCheckBlind(normalized))
        return false;
    try {
        return !!game.settings.get(MOD, "ability_" + normalized + "_private");
    }
    catch {
        return false;
    }
};
