import { MOD } from "../constants.js";
import { applyThemeToElement } from "../../ui/theme.js";
import { L, setMany, getSetting } from "../../ui/settings-helpers.js";
import { dbgWarn } from "../../debug/logger.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
Hooks.once("init", () => {
    game.settings.register(MOD, "showSyncMessages", {
        name: "BSR.MidiSync.Settings.ShowNotifications.Name",
        hint: "BSR.MidiSync.Settings.ShowNotifications.Hint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        restricted: true
    });
});
Hooks.once("init", () => {
    game.settings.register(MOD, "enabled", {
        name: L("BSR.Skills.Settings.Enabled.Name", "Enable Blind Skill Rolls"),
        scope: "world", config: false, restricted: true, type: Boolean, default: true
    });
    game.settings.register(MOD, "blindRollersChat", {
        name: L("BSR.Skills.Settings.HideFromRoller.Name", "Hide blind skill rolls from the roller"),
        hint: L("BSR.Skills.Settings.HideFromRoller.Hint", "When enabled, players cannot see their own blind skill roll messages in chat."),
        scope: "world", config: false, type: Boolean, default: true
    });
    game.settings.register(MOD, "savesEnabled", {
        name: L("BSR.Saves.Settings.Enabled.Name", "Enable Blind Saving Throws"),
        scope: "world", config: false, restricted: true, type: Boolean, default: false
    });
    game.settings.register(MOD, "blindRollersSaveChat", {
        name: L("BSR.Saves.Settings.HideFromRoller.Name", "Hide blind saving throw rolls from the roller"),
        hint: L("BSR.Saves.Settings.HideFromRoller.Hint", "When enabled, players cannot see their own blind saving throw messages in chat."),
        scope: "world", config: false, type: Boolean, default: true
    });
});
function registerSkillSettings() {
    try {
        const skills = CONFIG?.DND5E?.skills;
        if (!skills)
            return false;
        const defaults = ["dec", "ins", "itm", "inv", "prc", "per"];
        for (const [key, skill] of Object.entries(skills)) {
            game.settings.register(MOD, key, { name: skill.label || key.toUpperCase(), scope: "world", config: false, type: Boolean, default: defaults.includes(key) });
            game.settings.register(MOD, key + "_private", { name: (skill.label || key.toUpperCase()) + " (Private)", scope: "world", config: false, type: Boolean, default: false });
        }
        return true;
    }
    catch (e) {
        dbgWarn("Failed to register skill settings:", e);
        return false;
    }
}
function registerSaveSettings() {
    try {
        const abilities = CONFIG?.DND5E?.abilities;
        if (!abilities)
            return false;
        for (const [key, ability] of Object.entries(abilities)) {
            game.settings.register(MOD, "save_" + key, { name: (ability.label || key.toUpperCase()) + " Save", scope: "world", config: false, type: Boolean, default: false });
            game.settings.register(MOD, "save_" + key + "_private", { name: (ability.label || key.toUpperCase()) + " Save (Private)", scope: "world", config: false, type: Boolean, default: false });
        }
        return true;
    }
    catch (e) {
        dbgWarn("Failed to register save settings:", e);
        return false;
    }
}
if (!registerSkillSettings())
    Hooks.once("ready", registerSkillSettings);
if (!registerSaveSettings())
    Hooks.once("ready", registerSaveSettings);
function buildGridRows(entries) {
    const half = Math.ceil(entries.length / 2);
    const left = entries.slice(0, half), right = entries.slice(half);
    const rows = [];
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
        position: { width: 640, height: "auto" },
        actions: {
            all: BSRMenuSkills.prototype._onAllAction,
            none: BSRMenuSkills.prototype._onNoneAction,
            defaults: BSRMenuSkills.prototype._onDefaultsAction,
            allSaves: BSRMenuSkills.prototype._onAllSavesAction,
            noneSaves: BSRMenuSkills.prototype._onNoneSavesAction,
            save: BSRMenuSkills.prototype._onSaveAction,
            cancel: BSRMenuSkills.prototype._onCancelAction
        }
    };
    static PARTS = {
        form: { template: `modules/${MOD}/templates/settings-skills.hbs` }
    };
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const skills = CONFIG?.DND5E?.skills ?? {};
        const entries = Object.entries(skills)
            .map(([k, v]) => ({
            key: k, label: v.label,
            blind: !!getSetting(k, false),
            private: !!getSetting(k + "_private", false)
        }))
            .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang || "en"));
        const abilities = CONFIG?.DND5E?.abilities ?? {};
        const saveEntries = Object.entries(abilities)
            .map(([k, v]) => ({
            key: k, label: v.label || k.toUpperCase(),
            blind: !!getSetting("save_" + k, false),
            private: !!getSetting("save_" + k + "_private", false)
        }))
            .sort((a, b) => a.label.localeCompare(b.label, game.i18n?.lang || "en"));
        return {
            ...context,
            enabled: !!getSetting("enabled", true),
            blindRollersChat: !!getSetting("blindRollersChat", true),
            savesEnabled: !!getSetting("savesEnabled", false),
            blindRollersSaveChat: !!getSetting("blindRollersSaveChat", true),
            skillGridRows: buildGridRows(entries),
            saveGridRows: buildGridRows(saveEntries),
            labels: {
                pageIntro: L("BSR.Skills.Description", "Configure which skill checks and saving throws are forced to Blind GM Roll or Private GM Roll."),
                enabledName: L("BSR.Skills.Settings.Enabled.Name", "Enable Blind Skill Rolls"),
                blindRollersChatName: L("BSR.Skills.Settings.HideFromRoller.Name", "Hide blind skill rolls from the roller"),
                skills: L("BSR.Skills.Section.Skills", "Skills"), blind: L("BSR.Common.Label.Blind", "Blind"), private: L("BSR.Common.Label.Private", "Private"),
                all: L("BSR.Skills.Button.All", "All"), none: L("BSR.Skills.Button.None", "None"), defaults: L("BSR.Skills.Button.Defaults", "Defaults"),
                cancel: L("BSR.Common.Button.Cancel", "Cancel"), save: L("BSR.Common.Button.Save", "Save"),
                savesEnabledName: L("BSR.Saves.Settings.Enabled.Name", "Enable Blind Saving Throws"),
                blindRollersSaveChatName: L("BSR.Saves.Settings.HideFromRoller.Name", "Hide blind saving throw rolls from the roller"),
                saves: L("BSR.Saves.Section.Saves", "Saving Throws"), allSaves: L("BSR.Saves.Button.All", "All"), noneSaves: L("BSR.Saves.Button.None", "None")
            }
        };
    }
    _onRender(context, options) {
        super._onRender(context, options);
        applyThemeToElement(this.element);
        const form = this.element.querySelector("form");
        if (!form)
            return;
        form.addEventListener("submit", (ev) => { ev.preventDefault(); this.#onSave(ev); });
        form.querySelectorAll('input[data-skill][data-mode]').forEach((input) => {
            input.addEventListener("change", () => {
                const el = input;
                const opp = form.querySelector(`input[data-skill="${el.dataset.skill}"][data-mode="${el.dataset.mode === "blind" ? "private" : "blind"}"]`);
                if (opp) {
                    if (el.checked) {
                        opp.checked = false;
                        opp.disabled = true;
                    }
                    else {
                        opp.disabled = false;
                    }
                }
            });
        });
        form.querySelectorAll('input[data-save][data-mode]').forEach((input) => {
            input.addEventListener("change", () => {
                const el = input;
                const opp = form.querySelector(`input[data-save="${el.dataset.save}"][data-mode="${el.dataset.mode === "blind" ? "private" : "blind"}"]`);
                if (opp) {
                    if (el.checked) {
                        opp.checked = false;
                        opp.disabled = true;
                    }
                    else {
                        opp.disabled = false;
                    }
                }
            });
        });
    }
    async #onSave(event) {
        const target = event.target;
        const form = target?.tagName === "FORM"
            ? target
            : target?.closest?.("form")
                ?? event.target?.form;
        if (!form)
            return;
        const fd = new foundry.applications.ux.FormDataExtended(form).object;
        const pairs = [["enabled", !!fd.enabled]];
        form.querySelectorAll('input[type="checkbox"][data-skill][data-mode="blind"]').forEach((i) => pairs.push([i.dataset.skill, i.checked]));
        form.querySelectorAll('input[type="checkbox"][data-skill][data-mode="private"]').forEach((i) => pairs.push([i.dataset.skill + "_private", i.checked]));
        pairs.push(["savesEnabled", !!fd.savesEnabled]);
        form.querySelectorAll('input[type="checkbox"][data-save][data-mode="blind"]').forEach((i) => pairs.push(["save_" + i.dataset.save, i.checked]));
        form.querySelectorAll('input[type="checkbox"][data-save][data-mode="private"]').forEach((i) => pairs.push(["save_" + i.dataset.save + "_private", i.checked]));
        await setMany(pairs);
        await game.settings.set(MOD, "blindRollersChat", !!fd.blindRollersChat);
        await game.settings.set(MOD, "blindRollersSaveChat", !!fd.blindRollersSaveChat);
        this.close();
    }
    async _onAllAction() { const f = this.element.querySelector("form"); f.querySelectorAll('input[data-skill][data-mode="blind"]').forEach((i) => { const el = i; el.checked = true; el.disabled = false; const p = f.querySelector(`input[data-skill="${el.dataset.skill}"][data-mode="private"]`); if (p) {
        p.checked = false;
        p.disabled = true;
    } }); }
    async _onNoneAction() { const f = this.element.querySelector("form"); f.querySelectorAll('input[data-skill][data-mode]').forEach((i) => { const el = i; el.checked = false; el.disabled = false; }); }
    async _onDefaultsAction() { const f = this.element.querySelector("form"); const defs = new Set(["dec", "ins", "itm", "inv", "prc", "per"]); f.querySelectorAll('input[data-skill][data-mode="blind"]').forEach((i) => { const el = i; el.checked = defs.has(el.dataset.skill); el.disabled = false; const p = f.querySelector(`input[data-skill="${el.dataset.skill}"][data-mode="private"]`); if (p) {
        p.checked = false;
        p.disabled = el.checked;
    } }); }
    async _onAllSavesAction() { const f = this.element.querySelector("form"); f.querySelectorAll('input[data-save][data-mode="blind"]').forEach((i) => { const el = i; el.checked = true; el.disabled = false; const p = f.querySelector(`input[data-save="${el.dataset.save}"][data-mode="private"]`); if (p) {
        p.checked = false;
        p.disabled = true;
    } }); }
    async _onNoneSavesAction() { const f = this.element.querySelector("form"); f.querySelectorAll('input[data-save][data-mode]').forEach((i) => { const el = i; el.checked = false; el.disabled = false; }); }
    async _onSaveAction() { await this.#onSave({ target: { form: this.element.querySelector("form"), closest: () => this.element.querySelector("form") } }); }
    async _onCancelAction() { this.close(); }
}
Hooks.once("init", () => {
    game.settings.registerMenu(MOD, "menuSkills", {
        name: "BSR.Skills.Title",
        label: "BSR.Skills.Button.Open",
        hint: "BSR.Skills.Note.MenuHint",
        icon: "fa-solid fa-sliders",
        type: BSRMenuSkills,
        restricted: true
    });
});
