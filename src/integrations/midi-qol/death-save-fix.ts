
import { MOD, BLIND, GMROLL } from "../../core/constants.js";
import {
  resolveDeathSaveVisibility,
  buildMessageRecipients
} from "../../core/policy/roll-visibility.js";
import { setDsnPendingMode } from "../../core/state/pending-dsn.js";
import { dbgDebug, dbgWarn } from "../../debug/logger.js";

const MIDI_ID = "midi-qol";
function isMidiActive(): boolean {
  try { return game.modules?.get(MIDI_ID)?.active === true; } catch { return false; }
}

// ─── Pre-roll hooks: set DSN pending mode for death saves ─────────────────

function handleDeathSavePreRoll(): void {
  if (!isMidiActive()) return;

  const vis = resolveDeathSaveVisibility();
  if (!vis.mode) return;

  if (vis.mode === BLIND) setDsnPendingMode('blind');
  else if (vis.mode === GMROLL) setDsnPendingMode('private');

  dbgDebug(`midi-death-fix | set DSN pending mode in pre-roll (${vis.mode})`);
}

Hooks.on("dnd5e.preRollDeathSaveV2", handleDeathSavePreRoll);

Hooks.on("dnd5e.preRollSavingThrowV2", (cfg: any) => {
  try {
    if (!cfg) return;
    const isDeath =
      cfg.type === "death" ||
      cfg.rollType === "death" ||
      cfg.subject?.type === "death" ||
      cfg.data?.type === "death" ||
      cfg.hook === "rollDeathSave" ||
      cfg.hookNames?.includes?.("rollDeathSave");
    if (isDeath) handleDeathSavePreRoll();
  } catch { /* ignore */ }
});

// ─── Broader death-save detection ─────────────────────────────────────────

function isDeathSaveMsg(msg: any, data?: any): boolean {
  const d5msg = msg?.flags?.dnd5e ?? {};
  const d5data = data?.flags?.dnd5e ?? {};
  const typeFrom = (src: any): string =>
    String(src?.roll?.type ?? src?.type ?? src?.rollType ?? "").toLowerCase();
  if (typeFrom(d5msg) === "death" || typeFrom(d5data) === "death") return true;

  const flavor: string = msg?.flavor ?? data?.flavor ?? "";
  if (/death\s*sav/i.test(flavor) || /todesrettung/i.test(flavor)) return true;

  try {
    for (const roll of (msg?.rolls ?? [])) {
      const rt = roll?.options?.type ?? roll?.data?.type ?? null;
      if (rt === "death") return true;
    }
  } catch { /* ignore */ }

  return false;
}

// ─── Safety-net preCreateChatMessage ──────────────────────────────────────

Hooks.on("preCreateChatMessage", (msg: any, data: any) => {
  try {
    if (!isMidiActive()) return;

    const flags = msg.flags?.[MOD] ?? {};

    // ── Case A: Death save already handled by BSR → check for whisper override ──
    if (flags.bsrBlind || flags.bsrPrivate) {
      fixWhisperOverride(msg, flags);
      return;
    }

    // ── Case B: Death save NOT handled → apply visibility ──
    if (!isDeathSaveMsg(msg, data)) {
      return;
    }

    const vis = resolveDeathSaveVisibility();
    if (!vis.mode) return;

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

    dbgDebug("midi-death-fix | applied death save visibility in safety-net preCreateChatMessage");
  } catch (e) {
    dbgWarn("midi-death-fix | preCreateChatMessage error", e);
  }
});

// ─── Whisper-fixup for BSR-managed messages ───────────────────────────────

function fixWhisperOverride(msg: any, flags: any): void {
  if (flags.bsrPrivate && Array.isArray(msg.whisper) && msg.whisper.length > 0) {
    const hideSecrets: boolean = (() => {
      try { return game.settings.get(MOD, "hideForeignSecrets") as boolean; }
      catch { return true; }
    })();
    if (!hideSecrets) {
      msg.updateSource({ whisper: [], blind: false });
      dbgDebug("midi-death-fix | re-cleared whisper (MidiQOL override detected)");
    }
  }
}
