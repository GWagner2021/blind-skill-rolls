import { peekPendingSkill } from "../../core/state/pending-skill.js";
import { peekPendingSave } from "../../core/state/pending-save.js";
import { consumeDsnPendingMode } from "../../core/state/pending-dsn.js";
import { isPendingHiddenNpc } from "../../core/state/pending-hidden-npc.js";
import { isSkillPrivate, isSkillBlind } from "../../core/policy/skill-policy.js";
import { isSavePrivate, isSaveBlind } from "../../core/policy/save-policy.js";
import { MOD } from "../../core/constants.js";

Hooks.on("diceSoNiceRollStart", (messageID: string, context: any) => {
  try {
    if (!messageID) return;
    const chatMessage = game.messages?.get?.(messageID) as any;
    if (!chatMessage) return;

    const bsrFlags = chatMessage.flags?.["blind-skill-rolls"];
    const isGM     = game.user?.isGM === true;
    const authorId = chatMessage.author?.id ?? chatMessage.author;
    const isAuthor = game.user?.id === authorId;

    // ── Blind rolls ──────────────────────────────────────────────────
    if (bsrFlags?.bsrBlind || chatMessage.blind) {
      if (!isGM && !isAuthor) {
        context.blind = true;
      }
      return;
    }

    // ── BSR Private rolls ────────────────────
    if (bsrFlags?.bsrPrivate) {
      if (!isGM && !isAuthor) {
        if (context.roll && typeof context.roll === "object") {
          context.roll.ghost = true;
        }
      }
      return;
    }

    // ── Native whisper messages ───────────────────────────────────────
    const whisper: string[] = Array.isArray(chatMessage.whisper) ? chatMessage.whisper : [];
    if (whisper.length > 0 && !isGM && !isAuthor) {
      const me = game.user?.id;
      if (me && !whisper.includes(me)) {
        context.blind = true;
      }
    }
  } catch { /* ignore */ }
});

interface BlindSkillRollsMeta {
  rollerId: string | undefined;
  allowedUsers: string[] | null;
  blockNonAllowed: boolean;
}

interface DiceNotation {
  _blindSkillRolls?: BlindSkillRollsMeta;
  throws?: Array<{ dice?: Array<{ options?: Record<string, unknown> }> }>;
  [key: string]: unknown;
}

function markNotationAsGhost(notation: DiceNotation): void {
  for (const throwData of notation?.throws ?? []) {
    for (const die of throwData?.dice ?? []) {
      if (!die || typeof die !== "object") continue;
      if (!die.options || typeof die.options !== "object") die.options = {};
      die.options.ghost = true;
      die.options.bsrGhost = true;
      delete die.options.secret;
    }
  }
}

function cloneNotation(notation: DiceNotation): DiceNotation {
  if (!notation?.throws) return notation;
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

function unmarkNotationGhost(notation: DiceNotation): DiceNotation {
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

function hasBsrGhostMarker(notation: DiceNotation): boolean {
  for (const throwData of notation?.throws ?? []) {
    for (const die of throwData?.dice ?? []) {
      if (die?.options?.bsrGhost) return true;
    }
  }
  return false;
}

const OPT_HIDE = (): boolean => { try { return game.settings.get(MOD, "hideForeignSecrets") as boolean; } catch { return true; } };

const isPendingSkillPrivate = (): boolean => {
  const key = peekPendingSkill();
  return key ? isSkillPrivate(key) : false;
};

const isPendingSavePrivate = (): boolean => {
  const key = peekPendingSave();
  return key ? isSavePrivate(key) : false;
};

const isPendingSkillBlind = (): boolean => {
  const key = peekPendingSkill();
  return key ? isSkillBlind(key) : false;
};

const isPendingSaveBlind = (): boolean => {
  const key = peekPendingSave();
  return key ? isSaveBlind(key) : false;
};

Hooks.on("diceSoNiceReady", () => {
  const dice3d = game.dice3d as any;
  if (!dice3d) return;

  if (!dice3d._bsrShowWrapped) {
    dice3d._bsrShowWrapped = true;

    const originalShow = dice3d.show;
    dice3d.show = function (
      data: DiceNotation,
      user: { id?: string } | undefined,
      synchronize: boolean,
      users: string[] | undefined,
      blind: boolean
    ) {
      let blockNonAllowed = true;
      try {
        const gmIds = (game.users?.filter((u: any) => u.isGM) ?? []).map((u: any) => u.id);
        const rollerId = user?.id ?? game.user?.id;

        const dsnMode = consumeDsnPendingMode();
        const isBlindRoll = dsnMode === 'blind' || isPendingSkillBlind() || isPendingSaveBlind();
        const isPrivateRoll = dsnMode === 'private' || isPendingSkillPrivate() || isPendingSavePrivate();

        if (!blind && isPendingHiddenNpc()) {
          users = gmIds;
          blockNonAllowed = true;
        }

        if (isBlindRoll) {
          blind = false;
          users = Array.from(new Set([...gmIds, rollerId].filter(Boolean) as string[]));
          blockNonAllowed = true;
        }

        if (!blind && isPrivateRoll) {
          const authorizedUsers = Array.from(new Set([...gmIds, rollerId].filter(Boolean) as string[]));
          if (OPT_HIDE()) {
            users = authorizedUsers;
            blockNonAllowed = true;
          } else {
            blockNonAllowed = false;
            if (data && typeof data === "object") {
              markNotationAsGhost(data);
              data._blindSkillRolls = {
                rollerId: user?.id ?? game.user?.id,
                allowedUsers: authorizedUsers,
                blockNonAllowed: false
              };
            }
          }
        }
      } catch { /* ignore */ }

      const isHiddenRoll =
        blind === true ||
        (Array.isArray(users) && !users.includes("all"));

      if (isHiddenRoll && data && typeof data === "object" && !data._blindSkillRolls) {
        data._blindSkillRolls = {
          rollerId: user?.id,
          allowedUsers: users ?? null,
          blockNonAllowed
        };
      }
      return originalShow.call(this, data, user, synchronize, users, blind);
    };
  }

  if (!dice3d._bsrAnimWrapped) {
    dice3d._bsrAnimWrapped = true;

    const originalShowAnimation = dice3d._showAnimation;
    dice3d._showAnimation = function (notation: DiceNotation, config: unknown) {
      const meta = notation && notation._blindSkillRolls;

      if (!meta) {
        if (hasBsrGhostMarker(notation)) {
          const local = game.user?.isGM === true ? unmarkNotationGhost(notation) : notation;
          return originalShowAnimation.call(this, local, config);
        }
        return originalShowAnimation.call(this, notation, config);
      }

      const userId = game.user?.id;
      const allowedUsers = Array.isArray(meta.allowedUsers) ? meta.allowedUsers : null;

      if (allowedUsers) {
        if (userId && allowedUsers.includes(userId)) {
          const real = unmarkNotationGhost(notation);
          return originalShowAnimation.call(this, real, config);
        }
        if (meta.blockNonAllowed) {
          return Promise.resolve(false);
        }
        markNotationAsGhost(notation);
        return originalShowAnimation.call(this, notation, config);
      }

      if (userId === meta.rollerId || game.user?.isGM === true) {
        const real = unmarkNotationGhost(notation);
        return originalShowAnimation.call(this, real, config);
      }

      return Promise.resolve(false);
    };
  }
});
