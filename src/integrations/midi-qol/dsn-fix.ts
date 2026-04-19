
import { MOD } from "../../core/constants.js";
import { peekDsnPendingMode, setDsnPendingMode } from "../../core/state/pending-dsn.js";
import { peekPendingSkill } from "../../core/state/pending-skill.js";
import { peekPendingSave } from "../../core/state/pending-save.js";
import { isPendingHiddenNpc } from "../../core/state/pending-hidden-npc.js";
import { isSkillPrivate, isSkillBlind } from "../../core/policy/skill-policy.js";
import { isSavePrivate, isSaveBlind } from "../../core/policy/save-policy.js";
import { dbgDebug, dbgWarn } from "../../debug/logger.js";
import { openMute } from "../../feature/audio-suppression.js";

const OPT_MUTE = (): boolean => {
  try { return game.settings.get(MOD, "muteForeignSecretSounds") as boolean; } catch { return true; }
};

const MIDI_ID = "midi-qol";
function isMidiActive(): boolean {
  try { return game.modules?.get(MIDI_ID)?.active === true; } catch { return false; }
}

const OPT_HIDE = (): boolean => {
  try { return game.settings.get(MOD, "hideForeignSecrets") as boolean; } catch { return true; }
};

// ─── Detect pending BSR mode ──────────────────────────────────────────────

function detectPendingMode(): 'blind' | 'private' | 'hidden-npc' | null {
  const dsnMode = peekDsnPendingMode();
  if (dsnMode) return dsnMode;

  if (isPendingHiddenNpc()) return 'hidden-npc';

  const skillKey = peekPendingSkill();
  if (skillKey) {
    if (isSkillBlind(skillKey)) return 'blind';
    if (isSkillPrivate(skillKey)) return 'private';
  }
  const saveKey = peekPendingSave();
  if (saveKey) {
    if (isSaveBlind(saveKey)) return 'blind';
    if (isSavePrivate(saveKey)) return 'private';
  }

  return null;
}


interface RecentMode {
  mode: 'blind' | 'private' | 'hidden-npc';
  synchronized: boolean;
  ts: number;
}

const REPLAY_WINDOW_MS = 1200;

let _recentMode: RecentMode | null = null;
let _recentTimer: ReturnType<typeof setTimeout> | null = null;

function setRecentMode(mode: RecentMode['mode'], synchronized: boolean): void {
  _recentMode = { mode, synchronized, ts: Date.now() };
  if (_recentTimer) clearTimeout(_recentTimer);
  _recentTimer = setTimeout(() => { _recentMode = null; _recentTimer = null; }, REPLAY_WINDOW_MS);
}

function consumeRecentMode(): RecentMode | null {
  const m = _recentMode;
  _recentMode = null;
  if (_recentTimer) { clearTimeout(_recentTimer); _recentTimer = null; }
  if (!m) return null;
  if (Date.now() - m.ts > REPLAY_WINDOW_MS) return null;
  return m;
}

// ─── Per-die marker helpers ───────────────────────────────────────────────

interface DiceNotation {
  _blindSkillRolls?: any;
  throws?: Array<{ dice?: Array<{ options?: Record<string, unknown> }> }>;
  [key: string]: unknown;
}

function markDiceBlind(notation: DiceNotation, rollerId: string | undefined): void {
  for (const throwData of notation?.throws ?? []) {
    for (const die of throwData?.dice ?? []) {
      if (!die || typeof die !== "object") continue;
      if (!die.options || typeof die.options !== "object") die.options = {};
      die.options.bsrBlind = true;
      if (rollerId) die.options.bsrRollerId = rollerId;
    }
  }
}

function markDiceBlindWithGhost(notation: DiceNotation, rollerId: string | undefined): void {
  for (const throwData of notation?.throws ?? []) {
    for (const die of throwData?.dice ?? []) {
      if (!die || typeof die !== "object") continue;
      if (!die.options || typeof die.options !== "object") die.options = {};
      die.options.bsrBlind = true;
      die.options.ghost = true;
      die.options.bsrBlindGhost = true;
      if (rollerId) die.options.bsrRollerId = rollerId;
      delete die.options.secret;
    }
  }
}

function hasBsrBlindGhostMarker(notation: DiceNotation): boolean {
  for (const throwData of notation?.throws ?? []) {
    for (const die of throwData?.dice ?? []) {
      if (die?.options?.bsrBlindGhost) return true;
    }
  }
  return false;
}

function unmarkBlindGhost(notation: DiceNotation): DiceNotation {
  const cloned = cloneNotation(notation);
  for (const throwData of cloned?.throws ?? []) {
    for (const die of throwData?.dice ?? []) {
      if (!die?.options) continue;
      if (die.options.bsrBlindGhost) {
        delete die.options.ghost;
        delete die.options.bsrGhost;
        delete die.options.bsrBlindGhost;
        delete die.options.bsrBlind;
      }
    }
  }
  return cloned;
}

function markDiceGhost(notation: DiceNotation, rollerId: string | undefined): void {
  for (const throwData of notation?.throws ?? []) {
    for (const die of throwData?.dice ?? []) {
      if (!die || typeof die !== "object") continue;
      if (!die.options || typeof die.options !== "object") die.options = {};
      die.options.ghost = true;
      die.options.bsrGhost = true;
      if (rollerId) die.options.bsrRollerId = rollerId;
      delete die.options.secret;
    }
  }
}

function hasBsrBlindMarker(notation: DiceNotation): boolean {
  for (const throwData of notation?.throws ?? []) {
    for (const die of throwData?.dice ?? []) {
      if (die?.options?.bsrBlind) return true;
    }
  }
  return false;
}

function hasBsrGhostMarker(notation: DiceNotation): boolean {
  for (const throwData of notation?.throws ?? []) {
    for (const die of throwData?.dice ?? []) {
      if (die?.options?.bsrGhost) return true;
    }
  }
  return false;
}

function getRollerIdFromDice(notation: DiceNotation): string | undefined {
  for (const throwData of notation?.throws ?? []) {
    for (const die of throwData?.dice ?? []) {
      if (die?.options?.bsrRollerId) return die.options.bsrRollerId as string;
    }
  }
  return undefined;
}

function cloneNotation(notation: DiceNotation): DiceNotation {
  if (!notation?.throws) return { ...notation };
  const clone: DiceNotation = { ...notation };
  clone.throws = notation.throws.map(t => {
    const tc = { ...t };
    if (Array.isArray(t.dice)) {
      tc.dice = t.dice.map(d => {
        if (!d || typeof d !== "object") return d;
        const dc = { ...d };
        if (d.options && typeof d.options === "object") dc.options = { ...d.options };
        return dc;
      });
    }
    return tc;
  });
  return clone;
}

function unmarkGhost(notation: DiceNotation): DiceNotation {
  const cloned = cloneNotation(notation);
  for (const throwData of cloned?.throws ?? []) {
    for (const die of throwData?.dice ?? []) {
      if (!die?.options) continue;
      if (die.options.bsrGhost) {
        delete die.options.ghost;
        delete die.options.bsrGhost;
      }
    }
  }
  return cloned;
}

// ─── dice3d.show() + _showAnimation wrappers ─────────────────────────────

Hooks.on("diceSoNiceReady", () => {
  if (!isMidiActive()) return;

  const dice3d = game.dice3d as any;
  if (!dice3d) return;

  // ══════════════════════════════════════════════════════════════════════
  // show() outer wrapper
  // ══════════════════════════════════════════════════════════════════════
  if (!dice3d._bsrMidiShowFixed) {
    dice3d._bsrMidiShowFixed = true;

    const bsrShow = dice3d.show;

    dice3d.show = function (
      data: DiceNotation,
      user: { id?: string } | undefined,
      synchronize: boolean,
      users: string[] | undefined,
      blind: boolean
    ) {
      try {
        const rollerId = user?.id ?? game.user?.id;

        // ── CHECK FOR DUPLICATE ──
        const recent = consumeRecentMode();
        if (recent) {
          if (recent.synchronized) {
            dbgDebug(`midi-dsn-fix | suppressing duplicate show() (${recent.mode}, was synced)`);
            return Promise.resolve(true);
          }
          dbgDebug(`midi-dsn-fix | replaying mode ${recent.mode} for synced broadcast call`);
          setDsnPendingMode(recent.mode === 'hidden-npc' ? 'blind' : recent.mode);
        }

        // ── DETECT PENDING MODE ──
        const pendingMode = detectPendingMode();

        if (pendingMode && data && typeof data === "object") {
          if (pendingMode === 'blind') {
            markDiceBlindWithGhost(data, rollerId);
            dbgDebug("midi-dsn-fix | pre-marked dice as blind-ghost (blind)");
            users = undefined;
            blind = true;
          } else if (pendingMode === 'hidden-npc') {
            markDiceBlind(data, rollerId);
            dbgDebug("midi-dsn-fix | pre-marked dice as blind (hidden-npc)");
          } else if (pendingMode === 'private' && !OPT_HIDE()) {
            markDiceGhost(data, rollerId);
            dbgDebug("midi-dsn-fix | pre-marked dice as ghost (private, hideSecrets=OFF)");
            users = undefined;
            blind = false;
          } else if (pendingMode === 'private' && OPT_HIDE()) {
            users = undefined;
            blind = false;
          }
        }

        // ── CALL BSR'S INNER SHOW WRAPPER ──
        const result = bsrShow.call(this, data, user, synchronize, users, blind);

        // ── CACHE MODE FOR DEDUP ──
        if (pendingMode) {
          setRecentMode(pendingMode, !!synchronize);
        } else if (data?._blindSkillRolls) {
          const meta = data._blindSkillRolls;
          const detectedMode: RecentMode['mode'] = meta.blockNonAllowed ? 'blind' : 'private';
          setRecentMode(detectedMode, !!synchronize);
        }

        return result;
      } catch (e) {
        dbgWarn("midi-dsn-fix | show() overlay error", e);
        return bsrShow.call(this, data, user, synchronize, users, blind);
      }
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // _showAnimation() outer wrapper
  // ══════════════════════════════════════════════════════════════════════
  if (!dice3d._bsrMidiAnimFixed) {
    dice3d._bsrMidiAnimFixed = true;

    const bsrShowAnim = dice3d._showAnimation;

    dice3d._showAnimation = function (notation: DiceNotation, config: unknown) {
      try {
        const isGM = game.user?.isGM === true;
        const userId = game.user?.id;
        if (hasBsrBlindGhostMarker(notation)) {
          const rollerId = getRollerIdFromDice(notation);
          const isRoller = !!(rollerId && userId === rollerId);

          if (isGM) {
            return bsrShowAnim.call(this, unmarkBlindGhost(notation), config);
          }
          if (isRoller) {
            const cloned = cloneNotation(notation);
            for (const throwData of cloned?.throws ?? []) {
              for (const die of throwData?.dice ?? []) {
                if (!die?.options) continue;
                delete die.options.bsrBlind;
                delete die.options.bsrBlindGhost;
                die.options.bsrGhost = true;
              }
            }
            if (cloned._blindSkillRolls) delete cloned._blindSkillRolls;
            return bsrShowAnim.call(this, cloned, config);
          }
          return Promise.resolve(false);
        }

        if (hasBsrBlindMarker(notation)) {
          const rollerId = getRollerIdFromDice(notation);
          const isRoller = !!(rollerId && userId === rollerId);

          if (!notation._blindSkillRolls) {
            if (isGM || isRoller) {
              const cloned = cloneNotation(notation);
              for (const throwData of cloned?.throws ?? []) {
                for (const die of throwData?.dice ?? []) {
                  if (die?.options) delete die.options.bsrBlind;
                }
              }
              return bsrShowAnim.call(this, cloned, config);
            }
            return Promise.resolve(false);
          }
        }

        if (hasBsrGhostMarker(notation)) {
          const rollerId = getRollerIdFromDice(notation);
          const isRoller = !!(rollerId && userId === rollerId);

          if (!isGM && !isRoller && OPT_MUTE()) {
            try { openMute(2500, false); } catch { /* ignore */ }
          }

          if (!notation._blindSkillRolls) {
            if (isRoller) {
              return bsrShowAnim.call(this, unmarkGhost(notation), config);
            }
          }
        }
      } catch (e) {
        dbgWarn("midi-dsn-fix | _showAnimation overlay error", e);
      }

      return bsrShowAnim.call(this, notation, config);
    };
  }
});

// ─── diceSoNiceRollStart hardening ────────────────────────────────────────
Hooks.on("diceSoNiceRollStart", (messageID: string, context: any) => {
  try {
    if (!messageID) return;
    const chatMessage = game.messages?.get?.(messageID) as any;
    if (!chatMessage) return;

    const isGM = game.user?.isGM === true;
    if (isGM) return;

    const authorId = chatMessage.author?.id ?? chatMessage.author;
    const isAuthor = game.user?.id === authorId;
    if (isAuthor) return;

    if (chatMessage.blind) {
      context.blind = true;
      if (context.roll && typeof context.roll === "object") {
        context.roll.ghost = false;
        context.roll.secret = true;
      }
    }
  } catch { /* ignore */ }
});
