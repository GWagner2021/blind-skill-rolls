import { MOD } from "../constants.js";
import { dbgInfo, dbgWarn } from "../../debug/logger.js";
import { L } from "../../ui/settings-helpers.js";

const DSN_MOD  = "dice-so-nice";
const DSN_KEY  = "showGhostDice";
const PROXY_KEY = "dsnGhostDiceMode";

const isValid = (v: string): boolean => v === "0" || v === "1" || v === "2";

async function setDsnGhost(v: string, { silent = false }: { silent?: boolean } = {}): Promise<void> {
  if (!game.user?.isGM) return;
  if (!game.modules.get(DSN_MOD)?.active) {
    if (!silent) ui.notifications?.warn(L("BSR.DSN.Error.NotActive"));
    return;
  }
  v = String(v);
  if (!isValid(v)) return;
  const cur = String(game.settings.get(DSN_MOD, DSN_KEY));
  if (cur === v) return;
  await game.settings.set(DSN_MOD, DSN_KEY, v);
  if (!silent) {
    const target = L(v === "2" ? "DICESONICE.ghostDiceForRollAuthor" : v === "1" ? "DICESONICE.ghostDiceForAll" : "DICESONICE.ghostDiceDisabled");
    ui.notifications?.info(game.i18n.format("BSR.DSN.Notification.GhostDiceSet", { target }));
  }
}

Hooks.once("init", () => {
  try {
    game.settings.register(MOD, PROXY_KEY, {
      name:  L("BSR.DSN.Settings.GhostDice.Name"),
      hint:  L("BSR.DSN.Settings.GhostDice.Hint"),
      scope: "world",
      config: false,
      restricted: true,
      type: String,
      choices: { "0": L("DICESONICE.ghostDiceDisabled"), "1": L("DICESONICE.ghostDiceForAll"), "2": L("DICESONICE.ghostDiceForRollAuthor", "To the roll author only") },
      default: "2",
      onChange: (v: unknown) => { if (game.user?.isGM) setDsnGhost(String(v)).catch(() => {}); }
    });
    dbgInfo("DSN proxy setting registered.");
  } catch (e) {
    console.error("BSR | Failed to register DSN proxy setting:", e);
  }
});

Hooks.once("ready", async () => {
  try {
    if (!game.user?.isGM) return;
    const key = `${MOD}.${PROXY_KEY}`;
    let v = "2";
    if (game.settings?.settings?.has(key)) {
      v = String(game.settings.get(MOD, PROXY_KEY) ?? "2");
      if (!isValid(v)) v = "2";
    }
    if (!game.modules.get(DSN_MOD)?.active) return;
    await setDsnGhost(v, { silent: true });
  } catch (e) {
    dbgWarn("dsn-settings | ready sync failed", e);
  }
});
