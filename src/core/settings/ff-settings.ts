import { MOD } from "../constants.js";
import { FF_GM_TYPES, FF_PLAYER_TYPES, FF_ALL_TYPES } from "../../integrations/midi-qol/ff-api.js";
import { applyThemeToElement } from "../../ui/theme.js";
import { L, getSetting } from "../../ui/settings-helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

interface FFTypeEntry {
  key: string;
  settingKey: string;
  nameKey: string;
  nameFb: string;
}

Hooks.once("init", () => {
  for (const t of FF_GM_TYPES) {
    game.settings.register(MOD, t.settingKey, {
      name:  L(t.nameKey, t.nameFb),
      hint:  L("BSR.FastForward.Note.Hint", "Automatically skip the roll dialog for this roll type."),
      scope: "world", config: false, restricted: true, type: Boolean, default: false
    });
  }
  for (const t of FF_PLAYER_TYPES) {
    game.settings.register(MOD, t.settingKey, {
      name:  L(t.nameKey, t.nameFb),
      hint:  L("BSR.FastForward.Note.PlayerHint", "Automatically skip the roll dialog for this roll type (players only)."),
      scope: "world", config: false, restricted: true, type: Boolean, default: false
    });
  }

  class BSRMenuFastForward extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "bsr-fast-forward-config",
      classes: ["bsr-fast-forward-dialog", "bsr-theme"],
      window: { title: L("BSR.FastForward.Title", "Fast Forward"), icon: "fa-solid fa-forward-fast", resizable: true },
      position: { width: 720, height: "auto" as const },
      actions: {
        save:   (BSRMenuFastForward.prototype as any)._onSaveAction,
        cancel: (BSRMenuFastForward.prototype as any)._onCancelAction
      }
    };

    static PARTS = {
      form: { template: `modules/${MOD}/templates/settings-ff.hbs` }
    };

    async _prepareContext(options: Record<string, unknown>): Promise<Record<string, unknown>> {
      const context = await super._prepareContext(options);
      const gmEntries     = FF_GM_TYPES.map((t: FFTypeEntry) => ({ key: t.settingKey, label: L(t.nameKey, t.nameFb), checked: !!getSetting<boolean>(t.settingKey, false) }));
      const playerEntries = FF_PLAYER_TYPES.map((t: FFTypeEntry) => ({ key: t.settingKey, label: L(t.nameKey, t.nameFb), checked: !!getSetting<boolean>(t.settingKey, false) }));
      return {
        ...context, gmEntries, playerEntries,
        labels: {
          pageIntro:    L("BSR.FastForward.Description", "Configure which roll types automatically skip the roll configuration dialog (fast forward)."),
          hint:         L("BSR.FastForward.Note.Hint", "Automatically skip the roll dialog for this roll type."),
          gmLegend:     L("BSR.FastForward.Section.GM", "GM Fast Forward"),
          playerLegend: L("BSR.FastForward.Section.Player", "Player Fast Forward"),
          cancel:       L("BSR.Common.Button.Cancel", "Cancel"),
          save:         L("BSR.Common.Button.Save", "Save")
        }
      };
    }

    _onRender(context: Record<string, unknown>, options: Record<string, unknown>): void {
      super._onRender(context, options);
      applyThemeToElement(this.element);
      const form = this.element.querySelector("form");
      if (form) form.addEventListener("submit", (ev: Event) => { ev.preventDefault(); this.#onSave(ev); });
    }

    async #onSave(event: Event | { target: { form: HTMLFormElement | null; closest: (sel: string) => HTMLFormElement | null } }): Promise<void> {
      const target = (event as Event).target as HTMLElement | null;
      const form = (target as HTMLFormElement)?.tagName === "FORM"
        ? target as HTMLFormElement
        : (target as HTMLElement)?.closest?.("form") as HTMLFormElement | null
          ?? ((event as any).target?.form as HTMLFormElement | null);
      if (!form) return;
      const fd: Record<string, any> = new foundry.applications.ux.FormDataExtended(form).object;
      for (const t of FF_ALL_TYPES) await game.settings.set(MOD, t.settingKey, !!fd[t.settingKey]);
      this.close();
    }

    async _onSaveAction(): Promise<void>   { await this.#onSave({ target: { form: this.element.querySelector("form"), closest: () => this.element.querySelector("form") } }); }
    async _onCancelAction(): Promise<void> { this.close(); }
  }

  game.settings.registerMenu(MOD, "menuFastForward", { name: "BSR.FastForward.Title", label: "BSR.FastForward.Button.Open", hint: "BSR.FastForward.Note.MenuHint", icon: "fa-solid fa-forward-fast", type: BSRMenuFastForward, restricted: true });
});
