import { MOD, DEFAULT_BLIND_CARD_COLOR, DEFAULT_PRIVATE_CARD_COLOR } from "../constants.js";
import { applyThemeToElement } from "../../ui/theme.js";
import { L, getSetting } from "../../ui/settings-helpers.js";
import { parseHexAlpha, toHexAlpha, alphaToPercent } from "../../ui/color-utils.js";
import { dbgInfo, dbgWarn } from "../../debug/logger.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

Hooks.once("init", () => {
  game.settings.register(MOD, "hideForeignSecrets",    { name: L("BSR.Chat.Settings.HideForeign.Name", "Hide other players' secret messages"), hint: L("BSR.Chat.Settings.HideForeign.Hint", "Hide blind rolls and whispers that are not addressed to the current player."), scope: "world", config: false, restricted: true, type: Boolean, default: true });
  game.settings.register(MOD, "muteForeignSecretSounds", { name: L("BSR.Chat.Settings.MuteForeign.Name", "Mute other players' dice sounds"), hint: L("BSR.Chat.Settings.MuteForeign.Hint", "Suppress dice sounds for secret rolls made by other players."), scope: "world", config: false, restricted: true, type: Boolean, default: true });
  game.settings.register(MOD, "bsrSanitizePublicGm",  { name: L("BSR.Chat.Settings.GmSanitize.Name", "Strip roll details from public GM rolls"), hint: L("BSR.Chat.Settings.GmSanitize.Hint", "Remove dice formulas and tooltips from public GM rolls so players only see the result, not how it was calculated."), scope: "world", config: false, restricted: true, type: Boolean, default: true });
  game.settings.register(MOD, "bsrTrustedSeeDetails", { name: L("BSR.Chat.Settings.TrustedDetails.Name", "Trusted players can see GM roll details"), hint: L("BSR.Chat.Settings.TrustedDetails.Hint", "When enabled, players with the Trusted role or higher can still see dice formulas and tooltips on public GM rolls, even when stripping is active."), scope: "world", config: false, restricted: true, type: Boolean, default: false });
  game.settings.register(MOD, "bsrNpcMaskDefault",    { name: L("BSR.NPC.Settings.MaskDefault.Name", "Hide NPC names from players"), hint: L("BSR.NPC.Settings.MaskDefault.Hint", "When enabled, NPC names in chat and the combat tracker are hidden from players until explicitly revealed."), scope: "world", config: false, restricted: true, type: Boolean, default: false });
  game.settings.register(MOD, "bsrNpcNameReplacement", { name: L("BSR.NPC.Settings.Replacement.Name", "Placeholder name"), hint: L("BSR.NPC.Settings.Replacement.Hint", "The name shown to players in place of hidden NPC names. Leave empty to use the default."), scope: "world", config: false, restricted: true, type: String, default: "" });
  game.settings.register(MOD, "bsrCustomCardColorsEnabled", { name: L("BSR.Chat.Settings.CustomCardColors.Name", "Enable custom chat card colors"), hint: L("BSR.Chat.Settings.CustomCardColors.Hint", "When enabled, applies your chosen background colors to Blind GM Roll and Private GM Roll chat cards. When disabled, the default FoundryVTT styling is used."), scope: "client", config: true, type: Boolean, default: false });
  game.settings.register(MOD, "bsrBlindCardColor",   { name: L("BSR.Chat.Settings.BlindCardColor.Name",   "Blind GM Roll card color"),   hint: L("BSR.Chat.Settings.BlindCardColor.Hint",   "Background color for Blind GM Roll chat cards."),   scope: "client", config: true, type: String, default: DEFAULT_BLIND_CARD_COLOR });
  game.settings.register(MOD, "bsrPrivateCardColor", { name: L("BSR.Chat.Settings.PrivateCardColor.Name", "Private GM Roll card color"), hint: L("BSR.Chat.Settings.PrivateCardColor.Hint", "Background color for Private GM Roll chat cards."), scope: "client", config: true, type: String, default: DEFAULT_PRIVATE_CARD_COLOR });

  class BSRMenuChatDisplay extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "bsr-chat-display-config",
      classes: ["bsr-chat-dialog", "bsr-theme"],
      window: { title: L("BSR.Chat.Title", "Chat Display & Privacy"), icon: "fa-solid fa-comments", resizable: true },
      position: { width: 820, height: "auto" as const },
      actions: {
        save:          (BSRMenuChatDisplay.prototype as any)._onSaveAction,
        cancel:        (BSRMenuChatDisplay.prototype as any)._onCancelAction
      }
    };

    static PARTS = {
      form: { template: `modules/${MOD}/templates/settings-chat.hbs` }
    };

    async _prepareContext(options: Record<string, unknown>): Promise<Record<string, unknown>> {
      const context = await super._prepareContext(options);
      return {
        ...context,
        hide:     !!getSetting<boolean>("hideForeignSecrets", true),
        mute:     !!getSetting<boolean>("muteForeignSecretSounds", true),
        sanitize: !!getSetting<boolean>("bsrSanitizePublicGm", true),
        trusted:  !!getSetting<boolean>("bsrTrustedSeeDetails", false),
        maskDef:  !!getSetting<boolean>("bsrNpcMaskDefault", false),
        repl:      getSetting<string>("bsrNpcNameReplacement", ""),
        labels: {
          chatDisplay:     L("BSR.Chat.Section.ChatDisplay", "Chat Display & Privacy"),
          hideForeignName: L("BSR.Chat.Settings.HideForeign.Name", "Hide other players' secret messages"),
          hideForeignHint: L("BSR.Chat.Settings.HideForeign.Hint", "Hide blind rolls and whispers that are not addressed to the current player."),
          muteForeignName: L("BSR.Chat.Settings.MuteForeign.Name", "Mute other players' dice sounds"),
          muteForeignHint: L("BSR.Chat.Settings.MuteForeign.Hint", "Suppress dice sounds for secret rolls made by other players."),
          gmRolls:         L("BSR.Chat.Section.GMRolls", "GM Roll Privacy"),
          sanitizeName:    L("BSR.Chat.Settings.GmSanitize.Name", "Strip roll details from public GM rolls"),
          sanitizeHint:    L("BSR.Chat.Settings.GmSanitize.Hint", "Remove dice formulas and tooltips from public GM rolls so players only see the result, not how it was calculated."),
          trustedName:     L("BSR.Chat.Settings.TrustedDetails.Name", "Trusted players can see GM roll details"),
          trustedHint:     L("BSR.Chat.Settings.TrustedDetails.Hint", "When enabled, players with the Trusted role or higher can still see dice formulas and tooltips on public GM rolls, even when stripping is active."),
          npcMasking:      L("BSR.NPC.Section.NameMasking", "NPC Name Masking"),
          npcMaskName:     L("BSR.NPC.Settings.MaskDefault.Name", "Hide NPC names from players"),
          npcMaskHint:     L("BSR.NPC.Settings.MaskDefault.Hint", "When enabled, NPC names in chat and the combat tracker are hidden from players until explicitly revealed."),
          npcReplName:     L("BSR.NPC.Settings.Replacement.Name", "Placeholder name"),
          npcReplHint:     L("BSR.NPC.Settings.Replacement.Hint", "The name shown to players in place of hidden NPC names. Leave empty to use the default."),
          cancel: L("BSR.Common.Button.Cancel", "Cancel"),
          save:   L("BSR.Common.Button.Save", "Save")
        }
      };
    }

    _onRender(context: Record<string, unknown>, options: Record<string, unknown>): void {
      super._onRender(context, options);
      applyThemeToElement(this.element);
      const form = this.element.querySelector("form");
      if (form) form.addEventListener("submit", (ev: Event) => { ev.preventDefault(); });
    }

    async #onSave(event: Event | { target: { form: HTMLFormElement | null; closest: (sel: string) => HTMLFormElement | null } }): Promise<void> {
      const target = (event as Event).target as HTMLElement | null;
      const form = (target as HTMLFormElement)?.tagName === "FORM"
        ? target as HTMLFormElement
        : (target as HTMLElement)?.closest?.("form") as HTMLFormElement | null
          ?? ((event as any).target?.form as HTMLFormElement | null);
      if (!form) return;
      const fd: Record<string, any> = new foundry.applications.ux.FormDataExtended(form).object;
      await game.settings.set(MOD, "hideForeignSecrets",     !!fd.hide);
      await game.settings.set(MOD, "muteForeignSecretSounds", !!fd.mute);
      await game.settings.set(MOD, "bsrSanitizePublicGm",   !!fd.sanitize);
      await game.settings.set(MOD, "bsrTrustedSeeDetails",  !!fd.trusted);
      await game.settings.set(MOD, "bsrNpcMaskDefault",     !!fd.maskDef);
      await game.settings.set(MOD, "bsrNpcNameReplacement", String(fd.repl ?? "").trim());

      if (!!fd.hide && !fd.mute) {
        ui.notifications?.warn(L("BSR.Chat.Warn.HideWithoutMute", "Secret messages are hidden but dice sounds are not muted — other players will hear dice sounds without seeing a chat card or dice."));
      }

      this.close();
    }

    async _onSaveAction(): Promise<void>   { await this.#onSave({ target: { form: this.element.querySelector("form"), closest: () => this.element.querySelector("form") } }); }
    async _onCancelAction(): Promise<void> { this.close(); }

  }

  game.settings.registerMenu(MOD, "menuChat", { name: "BSR.Chat.Title", label: "BSR.Chat.Button.Open", hint: "BSR.Chat.Note.MenuHint", icon: "fa-solid fa-comments", type: BSRMenuChatDisplay, restricted: true });
  dbgInfo("Settings registered: Chat Privacy, GM Roll Privacy, NPC Masking");

  const COLOR_DEFAULTS: Record<string, string> = { bsrBlindCardColor: DEFAULT_BLIND_CARD_COLOR, bsrPrivateCardColor: DEFAULT_PRIVATE_CARD_COLOR };
  const GM_ONLY_KEYS = ["bsrCustomCardColorsEnabled", "bsrBlindCardColor", "bsrPrivateCardColor"];
  Hooks.on("renderSettingsConfig", (_app: unknown, el: HTMLElement) => {
    if (game.user?.isGM) {
      for (const key of GM_ONLY_KEYS) {
        const input = el.querySelector(`[name="${MOD}.${key}"]`);
        if (input) input.closest(".form-group")?.remove();
      }
      return;
    }
    for (const [key, def] of Object.entries(COLOR_DEFAULTS)) {
      const textInput = el.querySelector(`input[name="${MOD}.${key}"]`) as HTMLInputElement | null;
      if (!textInput) continue;
      const group = textInput.closest(".form-group");
      if (!group) continue;
      const { rgb, alpha } = parseHexAlpha(textInput.value || def);
      const wrapper = document.createElement("div");
      wrapper.className = "bsr-alpha-color";
      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.value = rgb;
      const slider = document.createElement("input");
      slider.type = "range";
      slider.className = "bsr-alpha-slider";
      slider.min = "0";
      slider.max = "255";
      slider.value = String(alpha);
      const output = document.createElement("output");
      output.className = "bsr-alpha-value";
      output.textContent = alphaToPercent(alpha);
      const hidden = textInput;
      hidden.type = "hidden";
      const sync = (): void => {
        const combined = toHexAlpha(colorInput.value, Number(slider.value));
        hidden.value = combined;
        output.textContent = alphaToPercent(Number(slider.value));
      };
      colorInput.addEventListener("input", sync);
      slider.addEventListener("input", sync);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "icon";
      btn.dataset.tooltip = L("BSR.Common.Button.ResetColor", "Reset to default");
      const btnIcon = document.createElement("i");
      btnIcon.className = "fa-solid fa-rotate-left";
      btn.appendChild(btnIcon);
      btn.addEventListener("click", () => {
        const d = parseHexAlpha(def);
        colorInput.value = d.rgb;
        slider.value = String(d.alpha);
        hidden.value = def;
        output.textContent = alphaToPercent(d.alpha);
      });
      wrapper.append(colorInput, slider, output, btn);
      hidden.parentElement!.insertBefore(wrapper, hidden);
    }
  });

  // ---- Inject-Controls in der Chat-Konfig-Seite ----

  function _checkbox(name: string, labelText: string, checked: unknown, disabled: boolean): HTMLLabelElement {
    const lbl   = document.createElement("label");
    lbl.className = "bsr-form-check";
    const input = document.createElement("input");
    input.type  = "checkbox";
    input.name  = name;
    if (checked)  input.checked  = true;
    if (disabled) input.disabled = true;
    const span  = document.createElement("span");
    span.textContent = labelText;
    lbl.append(input, span);
    return lbl;
  }

  function _hint(text: string): HTMLParagraphElement {
    const p = document.createElement("p");
    p.className = "bsr-hint";
    p.textContent = text;
    return p;
  }

  function _legend(text: string): HTMLLegendElement {
    const legend = document.createElement("legend");
    legend.className = "bsr-inject__legend";
    legend.textContent = text;
    return legend;
  }

  function _divider(): HTMLHRElement {
    const hr = document.createElement("hr");
    hr.className = "bsr-divider bsr-inject__divider";
    return hr;
  }

  function injectChatDisplayControls(_app: unknown, html: HTMLElement): void {
    try {
      if (!(html instanceof HTMLElement)) return;
      const form = html.querySelector("form") ?? html.querySelector(".window-content form") ?? html; if (!form) return;
      if (form.querySelector(".bsr-chatdisplay")) return;
      const isGM  = !!game.user?.isGM;
      const dis   = !isGM;

      const fs = document.createElement("fieldset");
      fs.className = "form-group bsr-chatdisplay bsr-inject";

      // ── Chat Display & Privacy ──
      fs.append(
        _legend(L("BSR.Chat.Section.ChatDisplay", "Chat Display & Privacy")),
        _checkbox("bsrHide", L("BSR.Chat.Settings.HideForeign.Name", "Hide other players' secret messages"), getSetting("hideForeignSecrets", true), dis),
        _hint(L("BSR.Chat.Settings.HideForeign.Hint", "Hide blind rolls and whispers that are not addressed to the current player.")),
        _checkbox("bsrMute", L("BSR.Chat.Settings.MuteForeign.Name", "Mute other players' dice sounds"), getSetting("muteForeignSecretSounds", true), dis),
        _hint(L("BSR.Chat.Settings.MuteForeign.Hint", "Suppress dice sounds for secret rolls made by other players.")),
      );

      // ── GM Rolls ──
      fs.append(
        _divider(),
        _legend(L("BSR.Chat.Section.GMRolls", "GM Roll Privacy")),
        _checkbox("bsrSanitize", L("BSR.Chat.Settings.GmSanitize.Name", "Strip roll details from public GM rolls"), getSetting("bsrSanitizePublicGm", true), dis),
        _hint(L("BSR.Chat.Settings.GmSanitize.Hint", "Remove dice formulas and tooltips from public GM rolls so players only see the result, not how it was calculated.")),
        _checkbox("bsrTrusted", L("BSR.Chat.Settings.TrustedDetails.Name", "Trusted players can see GM roll details"), getSetting("bsrTrustedSeeDetails", false), dis),
        _hint(L("BSR.Chat.Settings.TrustedDetails.Hint", "When enabled, players with the Trusted role or higher can still see dice formulas and tooltips on public GM rolls, even when stripping is active.")),
      );

      // ── Chat Card Colors (client-scoped, all users) ──
      function _colorGroup(labelText: string, settingKey: string, fallback: string): HTMLDivElement {
        const group = document.createElement("div");
        group.className = "bsr-form-group";
        const lbl = document.createElement("label");
        lbl.className = "bsr-form-group__label";
        lbl.textContent = labelText;
        const ctrl = document.createElement("div");
        ctrl.className = "bsr-form-group__control bsr-alpha-color";
        const stored = getSetting<string>(settingKey, fallback);
        const { rgb, alpha } = parseHexAlpha(stored);
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = rgb;
        const slider = document.createElement("input");
        slider.type = "range";
        slider.className = "bsr-alpha-slider";
        slider.min = "0";
        slider.max = "255";
        slider.value = String(alpha);
        const output = document.createElement("output");
        output.className = "bsr-alpha-value";
        output.textContent = alphaToPercent(alpha);
        const sync = (): void => {
          const combined = toHexAlpha(colorInput.value, Number(slider.value));
          output.textContent = alphaToPercent(Number(slider.value));
          game.settings.set(MOD, settingKey, combined);
        };
        colorInput.addEventListener("change", sync);
        slider.addEventListener("change", sync);
        ctrl.append(colorInput, slider, output);
        group.append(lbl, ctrl);
        return group;
      }

      fs.append(
        _divider(),
        _legend(L("BSR.Chat.Section.CardColors", "Chat Card Colors")),
        _colorGroup(L("BSR.Chat.Settings.BlindCardColor.Name", "Blind GM Roll card color"), "bsrBlindCardColor", DEFAULT_BLIND_CARD_COLOR),
        _hint(L("BSR.Chat.Settings.BlindCardColor.Hint", "Background color for Blind GM Roll chat cards.")),
        _colorGroup(L("BSR.Chat.Settings.PrivateCardColor.Name", "Private GM Roll card color"), "bsrPrivateCardColor", DEFAULT_PRIVATE_CARD_COLOR),
        _hint(L("BSR.Chat.Settings.PrivateCardColor.Hint", "Background color for Private GM Roll chat cards.")),
      );

      // ── NPC Masking ──
      const replGroup = document.createElement("div");
      replGroup.className = "bsr-form-group bsr-inject__npc-repl";
      const replLabel = document.createElement("label");
      replLabel.className = "bsr-form-group__label";
      replLabel.textContent = L("BSR.NPC.Settings.Replacement.Name", "Placeholder name");
      const replInput = document.createElement("input");
      replInput.type = "text";
      replInput.name = "bsrNpcNameReplacement";
      replInput.value = getSetting<string>("bsrNpcNameReplacement", "");
      replInput.className = "bsr-form-group__control";
      if (dis) replInput.disabled = true;
      replGroup.append(replLabel, replInput);

      fs.append(
        _divider(),
        _legend(L("BSR.NPC.Section.NameMasking", "NPC Name Masking")),
        _checkbox("bsrNpcMaskDefault", L("BSR.NPC.Settings.MaskDefault.Name", "Hide NPC names from players"), getSetting("bsrNpcMaskDefault", false), dis),
        _hint(L("BSR.NPC.Settings.MaskDefault.Hint", "When enabled, NPC names in chat and the combat tracker are hidden from players until explicitly revealed.")),
        replGroup,
        _hint(L("BSR.NPC.Settings.Replacement.Hint", "The name shown to players in place of hidden NPC names. Leave empty to use the default.")),
      );

      form.appendChild(fs);

      // ── Bind change events (GM only) ──
      if (isGM) {
        const bind = (name: string, key: string): void => {
          fs.querySelector(`input[name="${name}"]`)?.addEventListener("change", (ev: Event) =>
            game.settings.set(MOD, key, (ev.currentTarget as HTMLInputElement).checked)
          );
        };
        bind("bsrHide",            "hideForeignSecrets");
        bind("bsrMute",            "muteForeignSecretSounds");
        bind("bsrSanitize",        "bsrSanitizePublicGm");
        bind("bsrTrusted",         "bsrTrustedSeeDetails");
        bind("bsrNpcMaskDefault",  "bsrNpcMaskDefault");
        replInput.addEventListener("change", (ev: Event) =>
          game.settings.set(MOD, "bsrNpcNameReplacement", String((ev.currentTarget as HTMLInputElement).value ?? "").trim())
        );
      }
    } catch (e) { dbgWarn("Inject Chat Display controls failed", e); }
  }

  Hooks.on("renderChatLogConfig",     injectChatDisplayControls);
  Hooks.on("renderChatDisplayConfig", injectChatDisplayControls);
  Hooks.on("renderChatConfig",        injectChatDisplayControls);
});
