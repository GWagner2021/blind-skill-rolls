import { isAutoFastForward } from "../integrations/midi-qol/ff-api.js";
import { initFFSync } from "../integrations/midi-qol/ff-sync.js";

const FF_HOOKS: readonly [string, string][] = [
  ["attack",       "dnd5e.preRollAttackV2"],
  ["damage",       "dnd5e.preRollDamageV2"],
  ["abilityCheck", "dnd5e.preRollAbilityCheckV2"],
  ["savingThrow",  "dnd5e.preRollSavingThrowV2"],
  ["skill",        "dnd5e.preRollSkillV2"],
  ["tool",         "dnd5e.preRollToolV2"]
];

interface RollConfig {
  fastForward?: boolean;
  hookNames?: string[];
  [key: string]: unknown;
}

interface DialogConfig {
  configure?: boolean;
  [key: string]: unknown;
}

const applyFFv2 = (config: RollConfig, dialog: DialogConfig): void => {
  try {
    if (dialog && typeof dialog === "object") dialog.configure = false;
    if (config && typeof config === "object") config.fastForward = true;
  } catch { /* ignore */ }
};

for (const [type, hook] of FF_HOOKS) {
  Hooks.on(hook, (cfg: RollConfig, dlg: DialogConfig) => {
    if (type === "abilityCheck") {
      const names = cfg?.hookNames;
      if (Array.isArray(names) && (names.includes("tool") || names.includes("skill"))) return;
    }
    if (isAutoFastForward(type)) applyFFv2(cfg, dlg);
  });
}

Hooks.once("ready", () => {
  initFFSync();
});
