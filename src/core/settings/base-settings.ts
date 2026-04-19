import { MOD } from "../constants.js";
import { dbgInfo } from "../../debug/logger.js";
import { L } from "../../ui/settings-helpers.js";

Hooks.once("i18nInit", () => {
  game.settings.register(MOD, "bsrTheme", {
    name:     L("BSR.General.Settings.Theme.Name", "Dialog Theme"),
    hint:     L("BSR.General.Settings.Theme.Hint", "Choose between a light or dark theme for module dialogs."),
    scope:    "world",
    config:   false,
    restricted: false,
    type:     String,
    choices:  {
      light: L("BSR.General.Option.ThemeLight", "Light"),
      dark:  L("BSR.General.Option.ThemeDark",  "Dark")
    },
    default: "light",
    onChange: (value: unknown) => { dbgInfo(`theme changed to: ${value}`); }
  });
  dbgInfo("theme setting registered");
});

function _onRenderSettingsPage(_app: unknown, html: HTMLElement | { [index: number]: HTMLElement } | null): void {
  try {
    const root = html instanceof HTMLElement ? html : (html as Record<number, HTMLElement>)?.[0] ?? html;
    if (!(root as HTMLElement)?.querySelector) return;
    const section = (root as HTMLElement).querySelector(`[data-tab="${MOD}"], [data-category="${MOD}"]`);
    if (section && !section.classList.contains("bsr-main-settings")) {
      section.classList.add("bsr-main-settings");
    }
  } catch { /* ignore */ }
}
Hooks.on("renderSettingsConfig", _onRenderSettingsPage);
Hooks.on("renderPackageConfiguration", _onRenderSettingsPage);
