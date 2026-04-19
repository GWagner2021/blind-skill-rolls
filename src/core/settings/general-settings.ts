import { MOD, DEFAULT_BLIND_CARD_COLOR, DEFAULT_PRIVATE_CARD_COLOR } from "../constants.js";
import { applyThemeToElement } from "../../ui/theme.js";
import { L, getSetting } from "../../ui/settings-helpers.js";
import { parseHexAlpha, toHexAlpha, alphaToPercent } from "../../ui/color-utils.js";
import { dbgInfo } from "../../debug/logger.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class BSRMenuGeneral extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "bsr-general-config",
    classes: ["bsr-general-dialog", "bsr-theme"],
    window: { title: L("BSR.General.Title", "General"), icon: "fa-solid fa-gear", resizable: true },
    position: { width: 720, height: "auto" as const },
    actions: {
      save:              (BSRMenuGeneral.prototype as any)._onSaveAction,
      cancel:            (BSRMenuGeneral.prototype as any)._onCancelAction,
      resetBlindColor:   (BSRMenuGeneral.prototype as any)._onResetBlindColor,
      resetPrivateColor: (BSRMenuGeneral.prototype as any)._onResetPrivateColor
    }
  };

  static PARTS = {
    form: { template: `modules/${MOD}/templates/settings-general.hbs` }
  };

  async _prepareContext(options: Record<string, unknown>): Promise<Record<string, unknown>> {
    const context = await super._prepareContext(options);
    const theme = getSetting<string>("bsrTheme", "light");
    const dsn   = String(getSetting<string>("dsnGhostDiceMode", "2"));
    return {
      ...context,
      themeLight: theme === "light",
      themeDark:  theme === "dark",
      showSyncMessages: !!getSetting<boolean>("showSyncMessages", true),
      dsnOff:     dsn === "0",
      dsnOn:      dsn === "1",
      dsnAuthor:  dsn === "2",
      customColors: !!getSetting<boolean>("bsrCustomCardColorsEnabled", false),
      blindCardColorRgb:        parseHexAlpha(getSetting<string>("bsrBlindCardColor",   DEFAULT_BLIND_CARD_COLOR)).rgb,
      blindCardColorAlpha:      parseHexAlpha(getSetting<string>("bsrBlindCardColor",   DEFAULT_BLIND_CARD_COLOR)).alpha,
      blindCardColorAlphaLabel: alphaToPercent(parseHexAlpha(getSetting<string>("bsrBlindCardColor",   DEFAULT_BLIND_CARD_COLOR)).alpha),
      privateCardColorRgb:        parseHexAlpha(getSetting<string>("bsrPrivateCardColor", DEFAULT_PRIVATE_CARD_COLOR)).rgb,
      privateCardColorAlpha:      parseHexAlpha(getSetting<string>("bsrPrivateCardColor", DEFAULT_PRIVATE_CARD_COLOR)).alpha,
      privateCardColorAlphaLabel: alphaToPercent(parseHexAlpha(getSetting<string>("bsrPrivateCardColor", DEFAULT_PRIVATE_CARD_COLOR)).alpha),
      labels: {
        appearance: L("BSR.General.Section.Appearance", "Appearance"),
        themeName:  L("BSR.General.Settings.Theme.Name", "Dialog Theme"),
        themeHint:  L("BSR.General.Settings.Theme.Hint", "Choose between a light or dark theme for module dialogs."),
        themeLight: L("BSR.General.Option.ThemeLight", "Light"),
        themeDark:  L("BSR.General.Option.ThemeDark", "Dark"),
        integration: L("BSR.General.Section.Integration", "Integration"),
        syncName:   L("BSR.MidiSync.Settings.ShowNotifications.Name", "Show sync notifications"),
        syncHint:   L("BSR.MidiSync.Settings.ShowNotifications.Hint", "Display notifications when blind skill settings are synced with midi-qol. (GM only)"),
        dsnSection: L("BSR.General.Section.DSN", "Dice So Nice"),
        dsnName:    L("BSR.DSN.Settings.GhostDice.Name", "Dice So Nice: Ghost dice"),
        dsnHint:    L("BSR.DSN.Settings.GhostDice.Hint", "Show ghost dice for all players, or disable ghost dice entirely."),
        dsnOff:     L("DICESONICE.ghostDiceDisabled", "Disabled"),
        dsnOn:      L("DICESONICE.ghostDiceForAll", "Show for all players"),
        dsnAuthor:  L("DICESONICE.ghostDiceForRollAuthor", "To the roll author only"),
        cardColors:        L("BSR.Chat.Section.CardColors", "Chat Card Colors"),
        customColorsName:  L("BSR.Chat.Settings.CustomCardColors.Name", "Enable custom chat card colors"),
        customColorsHint:  L("BSR.Chat.Settings.CustomCardColors.Hint", "When enabled, applies your chosen background colors to Blind GM Roll and Private GM Roll chat cards. When disabled, the default FoundryVTT styling is used."),
        blindColorName:    L("BSR.Chat.Settings.BlindCardColor.Name",   "Blind GM Roll card color"),
        blindColorHint:    L("BSR.Chat.Settings.BlindCardColor.Hint",   "Background color for Blind GM Roll chat cards."),
        privateColorName:  L("BSR.Chat.Settings.PrivateCardColor.Name", "Private GM Roll card color"),
        privateColorHint:  L("BSR.Chat.Settings.PrivateCardColor.Hint", "Background color for Private GM Roll chat cards."),
        resetColor:        L("BSR.Common.Button.ResetColor", "Reset to default"),
        cancel:     L("BSR.Common.Button.Cancel", "Cancel"),
        save:       L("BSR.Common.Button.Save", "Save")
      }
    };
  }

  _onRender(context: Record<string, unknown>, options: Record<string, unknown>): void {
    super._onRender(context, options);
    applyThemeToElement(this.element);
    const form = this.element.querySelector("form");
    if (form) form.addEventListener("submit", (ev: Event) => { ev.preventDefault(); this.#onSave(ev); });
    for (const slider of this.element.querySelectorAll(".bsr-alpha-slider")) {
      (slider as HTMLInputElement).addEventListener("input", () => {
        const output = (slider as HTMLElement).parentElement?.querySelector(".bsr-alpha-value");
        if (output) output.textContent = alphaToPercent(Number((slider as HTMLInputElement).value));
      });
    }
  }

  async #onSave(event: Event | { target: { form: HTMLFormElement | null; closest: (sel: string) => HTMLFormElement | null } }): Promise<void> {
    const target = (event as Event).target as HTMLElement | null;
    const form = (target as HTMLFormElement)?.tagName === "FORM"
      ? target as HTMLFormElement
      : (target as HTMLElement)?.closest?.("form") as HTMLFormElement | null
        ?? ((event as any).target?.form as HTMLFormElement | null);
    if (!form) return;
    const fd: Record<string, any> = new foundry.applications.ux.FormDataExtended(form).object;
    await game.settings.set(MOD, "bsrTheme",          String(fd.bsrTheme ?? "light"));
    await game.settings.set(MOD, "showSyncMessages",   !!fd.showSyncMessages);
    await game.settings.set(MOD, "dsnGhostDiceMode",   String(fd.dsnGhostDiceMode ?? "2"));
    await game.settings.set(MOD, "bsrCustomCardColorsEnabled", !!fd.customColors);
    await game.settings.set(MOD, "bsrBlindCardColor",   toHexAlpha(fd.blindCardColorRgb   || parseHexAlpha(DEFAULT_BLIND_CARD_COLOR).rgb,   fd.blindCardColorAlpha   ?? parseHexAlpha(DEFAULT_BLIND_CARD_COLOR).alpha));
    await game.settings.set(MOD, "bsrPrivateCardColor", toHexAlpha(fd.privateCardColorRgb || parseHexAlpha(DEFAULT_PRIVATE_CARD_COLOR).rgb, fd.privateCardColorAlpha ?? parseHexAlpha(DEFAULT_PRIVATE_CARD_COLOR).alpha));
    this.close();
  }

  async _onSaveAction(): Promise<void>   { await this.#onSave({ target: { form: this.element.querySelector("form"), closest: () => this.element.querySelector("form") } }); }
  async _onCancelAction(): Promise<void> { this.close(); }

  _onResetBlindColor(): void {
    const { rgb, alpha } = parseHexAlpha(DEFAULT_BLIND_CARD_COLOR);
    const colorInput = this.element.querySelector('input[name="blindCardColorRgb"]') as HTMLInputElement | null;
    const slider     = this.element.querySelector('input[name="blindCardColorAlpha"]') as HTMLInputElement | null;
    const output     = slider?.parentElement?.querySelector(".bsr-alpha-value");
    if (colorInput) colorInput.value = rgb;
    if (slider)     slider.value = String(alpha);
    if (output)     output.textContent = alphaToPercent(alpha);
  }

  _onResetPrivateColor(): void {
    const { rgb, alpha } = parseHexAlpha(DEFAULT_PRIVATE_CARD_COLOR);
    const colorInput = this.element.querySelector('input[name="privateCardColorRgb"]') as HTMLInputElement | null;
    const slider     = this.element.querySelector('input[name="privateCardColorAlpha"]') as HTMLInputElement | null;
    const output     = slider?.parentElement?.querySelector(".bsr-alpha-value");
    if (colorInput) colorInput.value = rgb;
    if (slider)     slider.value = String(alpha);
    if (output)     output.textContent = alphaToPercent(alpha);
  }
}

Hooks.once("init", () => {
  game.settings.registerMenu(MOD, "menuGeneral", {
    name:  "BSR.General.Title",
    label: "BSR.General.Button.Open",
    hint:  "BSR.General.Description",
    icon:  "fa-solid fa-gear",
    type:  BSRMenuGeneral,
    restricted: true
  });
  dbgInfo("General settings menu registered.");
});
