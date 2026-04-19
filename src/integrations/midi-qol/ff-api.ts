import { MOD } from "../../core/constants.js";

export interface FFTypeEntry {
  readonly key: string;
  readonly settingKey: string;
  readonly nameKey: string;
  readonly nameFb: string;
}

export const FF_GM_TYPES: readonly FFTypeEntry[] = Object.freeze([
  { key: "attack",       settingKey: "ffAttack",       nameKey: "BSR.FastForward.Settings.Attack.Name",       nameFb: "Attack Rolls" },
  { key: "damage",       settingKey: "ffDamage",       nameKey: "BSR.FastForward.Settings.Damage.Name",       nameFb: "Damage Rolls" },
  { key: "abilityCheck", settingKey: "ffAbilityCheck", nameKey: "BSR.FastForward.Settings.AbilityCheck.Name", nameFb: "Ability Checks" },
  { key: "savingThrow",  settingKey: "ffSavingThrow",  nameKey: "BSR.FastForward.Settings.SavingThrow.Name",  nameFb: "Saving Throws" },
  { key: "skill",        settingKey: "ffSkill",        nameKey: "BSR.FastForward.Settings.Skill.Name",        nameFb: "Skill Checks" },
  { key: "tool",         settingKey: "ffTool",         nameKey: "BSR.FastForward.Settings.Tool.Name",         nameFb: "Tool Checks" }
]);

export const FF_PLAYER_TYPES: readonly FFTypeEntry[] = Object.freeze([
  { key: "attack",       settingKey: "ffPlayerAttack",       nameKey: "BSR.FastForward.Settings.Attack.Name",       nameFb: "Attack Rolls" },
  { key: "damage",       settingKey: "ffPlayerDamage",       nameKey: "BSR.FastForward.Settings.Damage.Name",       nameFb: "Damage Rolls" },
  { key: "abilityCheck", settingKey: "ffPlayerAbilityCheck", nameKey: "BSR.FastForward.Settings.AbilityCheck.Name", nameFb: "Ability Checks" },
  { key: "savingThrow",  settingKey: "ffPlayerSavingThrow",  nameKey: "BSR.FastForward.Settings.SavingThrow.Name",  nameFb: "Saving Throws" },
  { key: "skill",        settingKey: "ffPlayerSkill",        nameKey: "BSR.FastForward.Settings.Skill.Name",        nameFb: "Skill Checks" },
  { key: "tool",         settingKey: "ffPlayerTool",         nameKey: "BSR.FastForward.Settings.Tool.Name",         nameFb: "Tool Checks" }
]);

export const FF_ALL_TYPES: readonly FFTypeEntry[] = Object.freeze([...FF_GM_TYPES, ...FF_PLAYER_TYPES]);

const GM_TYPE_TO_SETTING: Record<string, string> = Object.fromEntries(FF_GM_TYPES.map(t => [t.key, t.settingKey]));
const PLAYER_TYPE_TO_SETTING: Record<string, string> = Object.fromEntries(FF_PLAYER_TYPES.map(t => [t.key, t.settingKey]));
const MIDI_TO_BSR: Record<string, string> = Object.fromEntries(
  Object.entries({ attack: "attack", damage: "damage", check: "abilityCheck", save: "savingThrow", skill: "skill", tool: "tool" })
    .map(([midi, bsr]) => [midi, bsr])
);
const BSR_TO_MIDI: Record<string, string> = Object.fromEntries(
  Object.entries({ attack: "attack", damage: "damage", abilityCheck: "check", savingThrow: "save", skill: "skill", tool: "tool" })
);

export const FF_SETTING_TO_TYPE: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries(FF_ALL_TYPES.map(t => [t.settingKey, t.key])));
export const FF_SETTING_KEYS: ReadonlySet<string> = Object.freeze(new Set(FF_ALL_TYPES.map(t => t.settingKey)));
export const FF_GM_SETTING_KEYS: ReadonlySet<string> = Object.freeze(new Set(FF_GM_TYPES.map(t => t.settingKey)));
export const FF_PLAYER_SETTING_KEYS: ReadonlySet<string> = Object.freeze(new Set(FF_PLAYER_TYPES.map(t => t.settingKey)));
export const ALL_BSR_FF_TYPES: readonly string[] = Object.freeze(Object.keys(GM_TYPE_TO_SETTING));

export const isAutoFastForward = (type: string): boolean => {
  const isGM = game.user?.isGM ?? false;
  const map = isGM ? GM_TYPE_TO_SETTING : PLAYER_TYPE_TO_SETTING;
  const sk = map[type];
  if (!sk) return false;
  try { return !!game.settings.get(MOD, sk); } catch { return false; }
};

export const getAutoFastForwardGM = (): string[] => {
  const enabled: string[] = [];
  for (const t of FF_GM_TYPES) {
    try { if (game.settings.get(MOD, t.settingKey)) enabled.push(t.key); } catch { /* ignore */ }
  }
  return enabled;
};

export const getAutoFastForwardPlayer = (): string[] => {
  const enabled: string[] = [];
  for (const t of FF_PLAYER_TYPES) {
    try { if (game.settings.get(MOD, t.settingKey)) enabled.push(t.key); } catch { /* ignore */ }
  }
  return enabled;
};

export const setAutoFastForward = async (type: string, value: boolean): Promise<void> => {
  const sk = GM_TYPE_TO_SETTING[type];
  if (!sk) return;
  await game.settings.set(MOD, sk, !!value);
};

export const setAutoFastForwardPlayer = async (type: string, value: boolean): Promise<void> => {
  const sk = PLAYER_TYPE_TO_SETTING[type];
  if (!sk) return;
  await game.settings.set(MOD, sk, !!value);
};

export const bsrToMidiArray = (bsrTypes: string[]): string[] =>
  bsrTypes.map(t => BSR_TO_MIDI[t]).filter(Boolean);

export const midiToBsrSet = (midiArr: string[]): Set<string> => {
  if (!Array.isArray(midiArr)) return new Set();
  return new Set(midiArr.map(v => MIDI_TO_BSR[v]).filter(Boolean));
};
