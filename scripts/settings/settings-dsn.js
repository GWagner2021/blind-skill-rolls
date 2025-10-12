// scripts/settings-dsn.js
(() => {
  const MOD = "blind-skill-rolls";
  const DSN_MOD = "dice-so-nice";
  const DSN_KEY = "showGhostDice";
  const PROXY_KEY = "dsnGhostDiceMode";

  const L = (k) => game.i18n?.localize?.(k) ?? k;
  const isValid = (v) => v === "0" || v === "2";

  globalThis.BSR ??= {};
  BSR.getDsnGhostMode = function () {
    const key = `${MOD}.${PROXY_KEY}`;
    if (!game.settings?.settings?.has(key)) return "2";
    const v = String(game.settings.get(MOD, PROXY_KEY) ?? "2");
    return isValid(v) ? v : "2";
  };

  BSR.setDsnGhost = async function (v, { silent = false } = {}) {
    if (!game.user?.isGM) return;
    if (!game.modules.get(DSN_MOD)?.active) {
      if (!silent) ui.notifications?.warn(L("BSR.Errors.DSNNotActive"));
      return;
    }
    v = String(v);
    if (!isValid(v)) return;

    const cur = String(game.settings.get(DSN_MOD, DSN_KEY));
    if (cur === v) return;

    await game.settings.set(DSN_MOD, DSN_KEY, v);

    if (!silent) {
      const target = L(v === "2"
        ? "DICESONICE.ghostDiceForRollAuthor"
        : "DICESONICE.ghostDiceDisabled"
      );
      ui.notifications?.info(game.i18n.format("BSR.Notifications.DSNGhostDiceSet", { target }));
    }
  };

  Hooks.once("init", () => {
    try {
      game.settings.register(MOD, PROXY_KEY, {
        name: L("BSR.Settings.DSNGhostDice.Name"),
        hint: L("BSR.Settings.DSNGhostDice.Hint"),
        scope: "world",
        config: true,
        restricted: true,
        type: String,
        choices: {
          "0": L("DICESONICE.ghostDiceDisabled"),
          "2": L("DICESONICE.ghostDiceForRollAuthor")
        },
        default: "2",
        onChange: (v) => { if (game.user?.isGM) BSR.setDsnGhost(String(v)).catch(console.warn); }
      });
      console.log("BSR | DSN proxy setting registered.");
    } catch (e) {
      console.error("BSR | Registering DSN proxy setting failed:", e);
    }
  });

  Hooks.once("ready", async () => {
    try {
      if (!game.user?.isGM) return;

      const key = `${MOD}.${PROXY_KEY}`;
      let v = "2";
      if (game.settings?.settings?.has(key)) {
        v = String(game.settings.get(MOD, PROXY_KEY) ?? "2");
        if (v === "1") {
          v = "2";
          await game.settings.set(MOD, PROXY_KEY, v);
        }
        if (!isValid(v)) v = "2";
      }

      if (!game.modules.get(DSN_MOD)?.active) return;
      await BSR.setDsnGhost(v, { silent: true });
    } catch (e) {
      console.warn("BSR | ready sync failed:", e);
    }
  });
})();
