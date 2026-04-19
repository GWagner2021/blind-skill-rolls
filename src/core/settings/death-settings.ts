import { MOD } from "../constants.js";
import { applyThemeToElement } from "../../ui/theme.js";
import { L, getSetting } from "../../ui/settings-helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

Hooks.once("init", () => {
  game.settings.register(MOD, "bsrDeathSavesMode", {
    name:  L("BSR.DeathSaves.Settings.Mode.Name", "Death save visibility"),
    hint:  L("BSR.DeathSaves.Settings.Mode.Hint", "Controls who can see death save rolls: everyone, the roller and GM, or GM only."),
    scope: "world", config: false, restricted: true, type: String, default: "blindroll"
  });
  game.settings.register(MOD, "blindRollersDeathSaveChat", {
    name:  L("BSR.DeathSaves.Settings.HideFromRoller.Name", "Hide blind death saves from the roller"),
    hint:  L("BSR.DeathSaves.Settings.HideFromRoller.Hint", "When enabled, players cannot see their own blind death save messages in chat."),
    scope: "world", config: false, type: Boolean, default: true
  });

  class BSRMenuDeathSaves extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "bsr-death-saves-config",
      classes: ["bsr-death-dialog", "bsr-theme"],
      window: { title: L("BSR.DeathSaves.Title", "Death Saves"), icon: "fa-solid fa-heart-pulse", resizable: true },
      position: { width: 720, height: "auto" as const },
      actions: {
        save:   (BSRMenuDeathSaves.prototype as any)._onSaveAction,
        cancel: (BSRMenuDeathSaves.prototype as any)._onCancelAction
      }
    };

    static PARTS = {
      form: { template: `modules/${MOD}/templates/settings-death.hbs` }
    };

    async _prepareContext(options: Record<string, unknown>): Promise<Record<string, unknown>> {
      const context = await super._prepareContext(options);
      const mode = String(getSetting<string>("bsrDeathSavesMode", "blindroll")).toLowerCase();
      return {
        ...context,
        mode,
        modePublic:  mode === "public",
        modePrivate: mode === "privatroll",
        modeBlind:   mode === "blindroll",
        blindRollersDeathSaveChat: !!getSetting<boolean>("blindRollersDeathSaveChat", true),
        labels: {
          deathSaves:            L("BSR.DeathSaves.Section.DeathSaves", "Death Saves"),
          modeHint:              L("BSR.DeathSaves.Settings.Mode.Hint", "Controls who can see death save rolls: everyone, the roller and GM, or GM only."),
          modeName:              L("BSR.DeathSaves.Settings.Mode.Name", "Death save visibility"),
          modePublic:            L("BSR.DeathSaves.Option.Public", "Public (visible to everyone)"),
          modePrivate:           L("BSR.DeathSaves.Option.PrivateRoll", "Private GM Roll (visible to roller and GM)"),
          modeBlind:             L("BSR.DeathSaves.Option.BlindRoll", "Blind GM Roll (visible to GM only)"),
          blindRollersChatLegend: L("BSR.DeathSaves.Section.HiddenChats", "Hide Death Save Messages From the Roller"),
          blindRollersChatName:  L("BSR.DeathSaves.Settings.HideFromRoller.Name", "Hide blind death saves from the roller"),
          blindRollersChatHint:  L("BSR.DeathSaves.Settings.HideFromRoller.Hint", "When enabled, players cannot see their own blind death save messages in chat."),
          cancel: L("BSR.Common.Button.Cancel", "Cancel"),
          save:   L("BSR.Common.Button.Save", "Save")
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
      try {
        const target = (event as Event).target as HTMLElement | null;
        const form = (target as HTMLFormElement)?.tagName === "FORM"
          ? target as HTMLFormElement
          : (target as HTMLElement)?.closest?.("form") as HTMLFormElement | null
            ?? ((event as any).target?.form as HTMLFormElement | null);
        if (!form) return;
        const fd: Record<string, any> = new foundry.applications.ux.FormDataExtended(form).object;
        await game.settings.set(MOD, "bsrDeathSavesMode",         fd.dsMode || "blindroll");
        await game.settings.set(MOD, "blindRollersDeathSaveChat", !!fd.blindRollersDeathSaveChat);
      } catch { /* ignore */ }
      this.close();
    }

    async _onSaveAction(): Promise<void>   { await this.#onSave({ target: { form: this.element.querySelector("form"), closest: () => this.element.querySelector("form") } }); }
    async _onCancelAction(): Promise<void> { this.close(); }
  }

  game.settings.registerMenu(MOD, "menuDeathSaves", { name: "BSR.DeathSaves.Title", label: "BSR.DeathSaves.Button.Open", hint: "BSR.DeathSaves.Note.MenuHint", icon: "fa-solid fa-heart-pulse", type: BSRMenuDeathSaves, restricted: true });
});
