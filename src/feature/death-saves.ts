import { MOD, BLIND, GMROLL } from "../core/constants.js";
import { resolveDeathSaveVisibility, buildMessageRecipients } from "../core/policy/roll-visibility.js";
import { guardedHookOnce } from "../core/state/roll-config-guard.js";
import { setDsnPendingMode } from "../core/state/pending-dsn.js";
import { setRollConfigSelectBlind, setRollConfigSelectPrivate } from "../ui/roll-config-dialog.js";
import { dbgWarn } from "../debug/logger.js";

const DEATH_BLIND_NOTE_KEY = "BSR.DeathSaves.Note.BlindGMRoll";
const DEATH_BLIND_NOTE_FB = "This death save is set to Blind GM Roll";
const DEATH_PRIVATE_NOTE_KEY = "BSR.DeathSaves.Note.PrivateGMRoll";
const DEATH_PRIVATE_NOTE_FB = "This death save is set to Private GM Roll";

const isDeathSave = (msg: any): boolean => {
  const d5 = msg?.flags?.dnd5e ?? {};
  const t: string = d5?.roll?.type ?? d5?.type ?? d5?.rollType ?? "";
  return t === "death";
};

const modeTag = (): string => String(game.settings.get(MOD, "bsrDeathSavesMode") || "blindroll").toLowerCase();

Hooks.on("dnd5e.rollDeathSaveV2", (_rolls: unknown, details: any) => {
  if (details && typeof details === "object") details.chatString = undefined;
});

function isDeathSaveConfig(cfg: any): boolean {
  try {
    const hookNames = Array.isArray(cfg?.hookNames) ? cfg.hookNames : [];
    return cfg?.type === "death"
      || cfg?.rollType === "death"
      || cfg?.subject?.type === "death"
      || cfg?.data?.type === "death"
      || cfg?.hook === "deathSave"
      || cfg?.hook === "rollDeathSave"
      || hookNames.includes("deathSave")
      || hookNames.includes("rollDeathSave");
  } catch {
    return false;
  }
}

function handleDeathSavePreRoll(cfg: any, dialog: any, message: any, hookLabel: string): void {
  try {
    const vis = resolveDeathSaveVisibility();
    if (!vis.mode) return;

    if (cfg && typeof cfg === "object") cfg.rollMode = vis.mode;
    if (message && typeof message === "object") message.rollMode = vis.mode;
    if (dialog && typeof dialog === "object") {
      if (!dialog.options) dialog.options = {};
      if (!dialog.options.default) dialog.options.default = {};
      dialog.options.default.rollMode = vis.mode;
    }

    if (vis.mode === BLIND) {
      setDsnPendingMode('blind');
      guardedHookOnce("renderRollConfigurationDialog", (app: any, el: HTMLElement) => setRollConfigSelectBlind(el ?? app?.element, DEATH_BLIND_NOTE_KEY, DEATH_BLIND_NOTE_FB));
    } else if (vis.mode === GMROLL) {
      setDsnPendingMode('private');
      guardedHookOnce("renderRollConfigurationDialog", (app: any, el: HTMLElement) => setRollConfigSelectPrivate(el ?? app?.element, DEATH_PRIVATE_NOTE_KEY, DEATH_PRIVATE_NOTE_FB));
    }
  } catch (e) {
    dbgWarn(hookLabel, e);
  }
}

Hooks.on("dnd5e.preRollDeathSaveV2", (cfg: any, dialog: any, message: any) => {
  handleDeathSavePreRoll(cfg, dialog, message, "preRollDeathSaveV2");
});

Hooks.on("dnd5e.preRollSavingThrowV2", (cfg: any, dialog: any, message: any) => {
  if (!isDeathSaveConfig(cfg)) return;
  handleDeathSavePreRoll(cfg, dialog, message, "preRollSavingThrowV2 death save");
});

Hooks.on("preCreateChatMessage", (msg: any) => {
  if (!isDeathSave(msg)) return;

  const vis = resolveDeathSaveVisibility();
  if (!vis.mode) {
    msg.updateSource({ blind: false, whisper: [] });
    return;
  }

  const author: string = msg.author?.id ?? game.user?.id;
  const recipients = buildMessageRecipients(vis.mode, author);
  msg.updateSource({ blind: recipients.blind, whisper: recipients.whisper });
  if (recipients.bsrBlind) {
    msg.updateSource({ [`flags.${MOD}.bsrBlind`]: true });
  }
  if (recipients.bsrPrivate) {
    msg.updateSource({ [`flags.${MOD}.bsrPrivate`]: true });
  }
  if (vis.mode === BLIND) setDsnPendingMode('blind');
  else if (vis.mode === GMROLL) setDsnPendingMode('private');
});

Hooks.on("renderActorSheetV2", (app: any, html: HTMLElement) => {
  if (modeTag() !== "blindroll" || game.user!.isGM) return;

  if (app.options.classes?.includes?.("tidy5e-sheet")) {
    html.querySelectorAll('[data-tidy-sheet-part="death-save-failures"], [data-tidy-sheet-part="death-save-successes"]')
        .forEach(n => n.remove());
    html.querySelectorAll('.death-saves .fa-check, .death-saves .death-save-result, .death-saves .fa-times')
        .forEach(n => n.remove());
  } else {
    html.querySelectorAll('.death-tray .death-saves .pips')
        .forEach(n => n.remove());
  }
});

Hooks.on("renderPortraitPanelArgonComponent", (_pp: unknown, el: HTMLElement) => {
  if (modeTag() === "blindroll" && !game.user!.isGM) {
    el.querySelectorAll('.death-save-result-container').forEach(n => n.remove());
  }
});
