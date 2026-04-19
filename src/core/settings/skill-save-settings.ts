import { MOD } from "../constants.js";
import { applyThemeToElement } from "../../ui/theme.js";
import { L, setMany, getSetting } from "../../ui/settings-helpers.js";
import { dbgWarn } from "../../debug/logger.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

Hooks.once("init", () => {
  game.settings.register(MOD, "showSyncMessages", {
    name:     "BSR.MidiSync.Settings.ShowNotifications.Name",
    hint:     "BSR.MidiSync.Settings.ShowNotifications.Hint",
    scope:    "world",
    config:   false,
    type:     Boolean,
    default:  true,
    restricted: true
  });
});

Hooks.once("init", () => {
  game.settings.register(MOD, "enabled", {
    name:  L("BSR.Skills.Settings.Enabled.Name", "Enable Blind Skill Rolls"),
    scope: "world", config: false, restricted: true, type: Boolean, default: true
  });
  game.settings.register(MOD, "blindRollersChat", {
    name:  L("BSR.Skills.Settings.HideFromRoller.Name", "Hide blind skill rolls from the roller"),
    hint:  L("BSR.Skills.Settings.HideFromRoller.Hint", "When enabled, players cannot see their own blind skill roll messages in chat."),
    scope: "world", config: false, type: Boolean, default: true
  });
  game.settings.register(MOD, "savesEnabled", {
    name:  L("BSR.Saves.Settings.Enabled.Name", "Enable Blind Saving Throws"),
    scope: "world", config: false, restricted: true, type: Boolean, default: false
  });
  game.settings.register(MOD, "blindRollersSaveChat", {
    name:  L("BSR.Saves.Settings.HideFromRoller.Name", "Hide blind saving throw rolls from the roller"),
    hint:  L("BSR.Saves.Settings.HideFromRoller.Hint", "When enabled, players cannot see their own blind saving throw messages in chat."),
    scope: "world", config: false, type: Boolean, default: true
  });
});

function registerSkillSettings(): boolean {
  try {
    const skills = CONFIG?.DND5E?.skills; if (!skills) return false;
    const defaults = ["dec","ins","itm","inv","prc","per"];
    for (const [key, skill] of Object.entries(skills)) {
      game.settings.register(MOD, key, { name: skill.label || key.toUpperCase(), scope: "world", config: false, type: Boolean, default: defaults.includes(key) });
      game.settings.register(MOD, key + "_private", { name: (skill.label || key.toUpperCase()) + " (Private)", scope: "world", config: false, type: Boolean, default: false });
    }
    return true;
  } catch (e) { dbgWarn("Failed to register skill settings:", e); return false; }
}

function registerSaveSettings(): boolean {
  try {
    const abilities = CONFIG?.DND5E?.abilities; if (!abilities) return false;
    for (const [key, ability] of Object.entries(abilities)) {
      game.settings.register(MOD, "save_" + key, { name: (ability.label || key.toUpperCase()) + " Save", scope: "world", config: false, type: Boolean, default: false });
      game.settings.register(MOD, "save_" + key + "_private", { name: (ability.label || key.toUpperCase()) + " Save (Private)", scope: "world", config: false, type: Boolean, default: false });
    }
    return true;
  } catch (e) { dbgWarn("Failed to register save settings:", e); return false; }
}

if (!registerSkillSettings()) Hooks.once("ready", registerSkillSettings);
if (!registerSaveSettings())  Hooks.once("ready", registerSaveSettings);

interface GridEntry {
  key: string;
  label: string;
  blind: boolean;
  private: boolean;
}

interface GridRow {
  left: GridEntry;
  right: GridEntry | null;
}

function buildGridRows(entries: GridEntry[]): GridRow[] {
  const half = Math.ceil(entries.length / 2);
  const left = entries.slice(0, half), right = entries.slice(half);
  const rows: GridRow[] = [];
  for (let i = 0; i < half; i++) {
    rows.push({ left: left[i], right: right[i] ?? null });
  }
  return rows;
}

class BSRMenuSkills extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "bsr-skills-config",
    classes: ["bsr-skills-dialog", "bsr-theme"],
    window: { title: "BSR.Skills.Title", icon: "fa-solid fa-sliders", resizable: true },
    position: { width: 640, height: "auto" as const },
    actions: {
      all:       (BSRMenuSkills.prototype as any)._onAllAction,
      none:      (BSRMenuSkills.prototype as any)._onNoneAction,
      defaults:  (BSRMenuSkills.prototype as any)._onDefaultsAction,
      allSaves:  (BSRMenuSkills.prototype as any)._onAllSavesAction,
      noneSaves: (BSRMenuSkills.prototype as any)._onNoneSavesAction,
      save:      (BSRMenuSkills.prototype as any)._onSaveAction,
      cancel:    (BSRMenuSkills.prototype as any)._onCancelAction
    }
  };

  static PARTS = {
    form: { template: `modules/${MOD}/templates/settings-skills.hbs` }
  };

  async _prepareContext(options: Record<string, unknown>): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const skills  = CONFIG?.DND5E?.skills ?? {};
    const entries: GridEntry[] = Object.entries(skills)
      .map(([k, v]) => ({
        key: k, label: v.label,
        blind: !!getSetting<boolean>(k, false),
        private: !!getSetting<boolean>(k + "_private", false)
      }))
      .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang || "en"));

    const abilities   = CONFIG?.DND5E?.abilities ?? {};
    const saveEntries: GridEntry[] = Object.entries(abilities)
      .map(([k, v]) => ({
        key: k, label: v.label || k.toUpperCase(),
        blind: !!getSetting<boolean>("save_" + k, false),
        private: !!getSetting<boolean>("save_" + k + "_private", false)
      }))
      .sort((a, b) => a.label.localeCompare(b.label, game.i18n?.lang || "en"));

    return {
      ...context,
      enabled:              !!getSetting<boolean>("enabled", true),
      blindRollersChat:     !!getSetting<boolean>("blindRollersChat", true),
      savesEnabled:         !!getSetting<boolean>("savesEnabled", false),
      blindRollersSaveChat: !!getSetting<boolean>("blindRollersSaveChat", true),
      skillGridRows: buildGridRows(entries),
      saveGridRows:  buildGridRows(saveEntries),
      labels: {
        pageIntro:              L("BSR.Skills.Description", "Configure which skill checks and saving throws are forced to Blind GM Roll or Private GM Roll."),
        enabledName:            L("BSR.Skills.Settings.Enabled.Name", "Enable Blind Skill Rolls"),
        blindRollersChatName:   L("BSR.Skills.Settings.HideFromRoller.Name", "Hide blind skill rolls from the roller"),
        skills: L("BSR.Skills.Section.Skills", "Skills"), blind: L("BSR.Common.Label.Blind", "Blind"), private: L("BSR.Common.Label.Private", "Private"),
        all: L("BSR.Skills.Button.All", "All"), none: L("BSR.Skills.Button.None", "None"), defaults: L("BSR.Skills.Button.Defaults", "Defaults"),
        cancel: L("BSR.Common.Button.Cancel", "Cancel"), save: L("BSR.Common.Button.Save", "Save"),
        savesEnabledName:       L("BSR.Saves.Settings.Enabled.Name", "Enable Blind Saving Throws"),
        blindRollersSaveChatName: L("BSR.Saves.Settings.HideFromRoller.Name", "Hide blind saving throw rolls from the roller"),
        saves: L("BSR.Saves.Section.Saves", "Saving Throws"), allSaves: L("BSR.Saves.Button.All", "All"), noneSaves: L("BSR.Saves.Button.None", "None")
      }
    };
  }

  _onRender(context: Record<string, unknown>, options: Record<string, unknown>): void {
    super._onRender(context, options);
    applyThemeToElement(this.element);
    const form = this.element.querySelector("form"); if (!form) return;
    form.addEventListener("submit", (ev: Event) => { ev.preventDefault(); this.#onSave(ev); });
    form.querySelectorAll('input[data-skill][data-mode]').forEach((input) => {
      (input as HTMLInputElement).addEventListener("change", () => {
        const el = input as HTMLInputElement;
        const opp = form.querySelector(`input[data-skill="${el.dataset.skill}"][data-mode="${el.dataset.mode === "blind" ? "private" : "blind"}"]`) as HTMLInputElement | null;
        if (opp) { if (el.checked) { opp.checked = false; opp.disabled = true; } else { opp.disabled = false; } }
      });
    });
    form.querySelectorAll('input[data-save][data-mode]').forEach((input) => {
      (input as HTMLInputElement).addEventListener("change", () => {
        const el = input as HTMLInputElement;
        const opp = form.querySelector(`input[data-save="${el.dataset.save}"][data-mode="${el.dataset.mode === "blind" ? "private" : "blind"}"]`) as HTMLInputElement | null;
        if (opp) { if (el.checked) { opp.checked = false; opp.disabled = true; } else { opp.disabled = false; } }
      });
    });
  }

  async #onSave(event: Event | { target: { form: HTMLFormElement | null; closest: (sel: string) => HTMLFormElement | null } }): Promise<void> {
    const target = (event as Event).target as HTMLElement | null;
    const form = (target as HTMLFormElement)?.tagName === "FORM"
      ? target as HTMLFormElement
      : (target as HTMLElement)?.closest?.("form") as HTMLFormElement | null
        ?? ((event as any).target?.form as HTMLFormElement | null);
    if (!form) return;
    const fd: Record<string, any> = new foundry.applications.ux.FormDataExtended(form).object;
    const pairs: [string, unknown][] = [["enabled", !!fd.enabled]];
    form.querySelectorAll('input[type="checkbox"][data-skill][data-mode="blind"]').forEach((i) => pairs.push([(i as HTMLInputElement).dataset.skill!, (i as HTMLInputElement).checked]));
    form.querySelectorAll('input[type="checkbox"][data-skill][data-mode="private"]').forEach((i) => pairs.push([(i as HTMLInputElement).dataset.skill! + "_private", (i as HTMLInputElement).checked]));
    pairs.push(["savesEnabled", !!fd.savesEnabled]);
    form.querySelectorAll('input[type="checkbox"][data-save][data-mode="blind"]').forEach((i) => pairs.push(["save_" + (i as HTMLInputElement).dataset.save!, (i as HTMLInputElement).checked]));
    form.querySelectorAll('input[type="checkbox"][data-save][data-mode="private"]').forEach((i) => pairs.push(["save_" + (i as HTMLInputElement).dataset.save! + "_private", (i as HTMLInputElement).checked]));
    await setMany(pairs);
    await game.settings.set(MOD, "blindRollersChat", !!fd.blindRollersChat);
    await game.settings.set(MOD, "blindRollersSaveChat", !!fd.blindRollersSaveChat);
    this.close();
  }

  async _onAllAction(): Promise<void>       { const f = this.element.querySelector("form")!; f.querySelectorAll('input[data-skill][data-mode="blind"]').forEach((i) => { const el = i as HTMLInputElement; el.checked = true; el.disabled = false; const p = f.querySelector(`input[data-skill="${el.dataset.skill}"][data-mode="private"]`) as HTMLInputElement | null; if (p) { p.checked = false; p.disabled = true; } }); }
  async _onNoneAction(): Promise<void>      { const f = this.element.querySelector("form")!; f.querySelectorAll('input[data-skill][data-mode]').forEach((i) => { const el = i as HTMLInputElement; el.checked = false; el.disabled = false; }); }
  async _onDefaultsAction(): Promise<void>  { const f = this.element.querySelector("form")!; const defs = new Set(["dec","ins","itm","inv","prc","per"]); f.querySelectorAll('input[data-skill][data-mode="blind"]').forEach((i) => { const el = i as HTMLInputElement; el.checked = defs.has(el.dataset.skill!); el.disabled = false; const p = f.querySelector(`input[data-skill="${el.dataset.skill}"][data-mode="private"]`) as HTMLInputElement | null; if (p) { p.checked = false; p.disabled = el.checked; } }); }
  async _onAllSavesAction(): Promise<void>  { const f = this.element.querySelector("form")!; f.querySelectorAll('input[data-save][data-mode="blind"]').forEach((i) => { const el = i as HTMLInputElement; el.checked = true; el.disabled = false; const p = f.querySelector(`input[data-save="${el.dataset.save}"][data-mode="private"]`) as HTMLInputElement | null; if (p) { p.checked = false; p.disabled = true; } }); }
  async _onNoneSavesAction(): Promise<void> { const f = this.element.querySelector("form")!; f.querySelectorAll('input[data-save][data-mode]').forEach((i) => { const el = i as HTMLInputElement; el.checked = false; el.disabled = false; }); }
  async _onSaveAction(): Promise<void>      { await this.#onSave({ target: { form: this.element.querySelector("form"), closest: () => this.element.querySelector("form") } }); }
  async _onCancelAction(): Promise<void>    { this.close(); }
}

Hooks.once("init", () => {
  game.settings.registerMenu(MOD, "menuSkills", {
    name:  "BSR.Skills.Title",
    label: "BSR.Skills.Button.Open",
    hint:  "BSR.Skills.Note.MenuHint",
    icon:  "fa-solid fa-sliders",
    type:  BSRMenuSkills,
    restricted: true
  });
});
