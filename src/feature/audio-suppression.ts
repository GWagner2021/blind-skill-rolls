import { MOD } from "../core/constants.js";
import { dbgWarn } from "../debug/logger.js";

const OPT_MUTE = (): boolean => { try { return game.settings.get(MOD, "muteForeignSecretSounds") as boolean; } catch { return true; } };

const meId = (): string | null => game.user?.id ?? null;

const isGMUser = (u: any): boolean => !!u && (u.isGM || (u.role ?? 0) >= CONST.USER_ROLES.ASSISTANT);
const whisperIds = (m: any): string[] =>
  Array.isArray(m?.whisper) ? m.whisper
  : Array.isArray(m?.whisperRecipients) ? m.whisperRecipients.map((u: any) => u?.id ?? u?._id).filter(Boolean)
  : [];

const hasBsrSecretFlag = (m: any): boolean => {
  try {
    const f = m?.flags?.['blind-skill-rolls'];
    return !!(f?.bsrBlind || f?.bsrPrivate);
  } catch { return false; }
};

function isAddressedToMe(m: any): boolean {
  const me = meId(); if (!me) return false;
  const blind = !!m?.blind;
  const whisper: string[] = Array.isArray(m?.whisper) ? m.whisper : [];
  const secret = blind || whisper.length > 0 || hasBsrSecretFlag(m);
  if (!secret) return true;
  const author = m?.author?.id ?? m?.author;
  if (String(author) === String(me)) return true;
  return whisperIds(m).map(String).includes(String(me));
}

// ---- Source resolution ----
function resolveSrc(first: unknown, rest: unknown[] = []): string {
  const cand: string[] = [];
  const push = (v: unknown): void => {
    if (!v) return;
    if (typeof v === "string") { cand.push(v); return; }
    if (typeof v === "object" && v !== null) {
      const obj = v as Record<string, unknown>;
      if (typeof obj.src === "string") cand.push(obj.src);
      else if (Array.isArray(obj.src) && obj.src.length) cand.push(obj.src[0]);
      if (typeof obj.url === "string") cand.push(obj.url);
      if (typeof obj.path === "string") cand.push(obj.path);
      if (typeof obj.sound === "string") cand.push(obj.sound);
    }
  };
  push(first); for (const a of rest) push(a); return cand.find(Boolean) || "";
}

const RX_DICE_CORE = /(^|\/)sounds\/dice\.wav(?:\?.*)?$/i;
const RX_DICE_GENERIC = /(\/|^)sounds\/.*dice|(^|\/)dice\.(wav|mp3|ogg)|\bd(20|12|10|8|6|4)\b|roll/i;

function shouldBlockSrc(src: string): boolean {
  if (game.user?.isGM) return false;
  if (!OPT_MUTE() && !muteGate.force) return false;
  if (!muteGate.active) return false;
  const s = String(src || "");
  return RX_DICE_CORE.test(s) || RX_DICE_GENERIC.test(s);
}

// ---- Mute gate ----
const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

interface MuteGateState {
  active: boolean;
  until: number;
  prevMuted: boolean | null;
  timer: ReturnType<typeof setTimeout> | null;
  force: boolean;
}

const muteGate: MuteGateState = { active: false, until: 0, prevMuted: null, timer: null, force: false };

export function openMute(ms = 4000, force = false): void {
  if (game.user!.isGM) return;
  if (!force && !OPT_MUTE()) return;
  const t = now() + ms; muteGate.until = Math.max(muteGate.until, t);
  if (force) muteGate.force = true;
  if (!muteGate.active) {
    muteGate.active = true;
    try { if (Howler) { muteGate.prevMuted = !!Howler._muted; Howler.mute(true); } } catch { /* ignore */ }
  }
  scheduleMuteCheck();
}

function extendMute(ms = 250): void { if (!muteGate.active) return openMute(ms); muteGate.until = Math.max(muteGate.until, now() + ms); scheduleMuteCheck(); }
function scheduleMuteCheck(): void { if (!muteGate.timer) muteGate.timer = setTimeout(checkMute, 100); }
function checkMute(): void {
  muteGate.timer = null; if (!muteGate.active) return;
  if (now() <= muteGate.until) return scheduleMuteCheck();
  try { if (Howler && muteGate.prevMuted !== null) Howler.mute(!!muteGate.prevMuted); } catch { /* ignore */ }
  muteGate.active = false; muteGate.prevMuted = null; muteGate.until = 0; muteGate.force = false;
}

// ---- Patches ----
const PATCHED = { audio: false, sound: false, howl: false, html: false };

function patchAudioHelperPlay(): void {
  if (PATCHED.audio) return;
  try {
    if (!foundry?.audio?.AudioHelper?.play) return;
    const AH = foundry.audio.AudioHelper;
    if ((AH.play as any)._bsrPatched) { PATCHED.audio = true; return; }
    const _play = AH.play;
    AH.play = async function (this: any, arg0: unknown, ...args: unknown[]) {
      const src = resolveSrc(arg0, args);
      if (shouldBlockSrc(src)) return null;
      if (!game.user!.isGM && (OPT_MUTE() || muteGate.force) && muteGate.active) { extendMute(200); return null; }
      return (_play as any).call(this, arg0, ...args);
    } as any;
    (AH.play as any)._bsrPatched = true;
    PATCHED.audio = true;
  } catch (e) { dbgWarn("audio-suppression | AudioHelper patch failed", e); }
}

function patchFoundrySoundClass(): void {
  if (PATCHED.sound) return;
  try {
    if (!foundry?.audio?.Sound?.prototype?.play) return;
    const _play = foundry.audio.Sound.prototype.play;
    if ((_play as any)._bsrPatched) { PATCHED.sound = true; return; }
    foundry.audio.Sound.prototype.play = function (this: any, ...args: unknown[]) {
      try {
        const src: string = this?.src ?? this?.path ?? this?.url ?? this?.howl?._src ?? "";
        if (shouldBlockSrc(src)) return null;
        if (!game.user!.isGM && (OPT_MUTE() || muteGate.force) && muteGate.active) { extendMute(200); return null; }
      } catch { /* ignore */ }
      return _play.apply(this, args as any);
    } as any;
    (foundry.audio.Sound.prototype.play as any)._bsrPatched = true;
    PATCHED.sound = true;
  } catch (e) { dbgWarn("audio-suppression | Sound.prototype.play patch failed", e); }
}

function patchHowlerPlay(): void {
  if (PATCHED.howl) return;
  try {
    if (typeof Howl === "undefined" || !Howl?.prototype?.play) return;
    const _hplay = Howl.prototype.play;
    if ((_hplay as any)._bsrPatched) { PATCHED.howl = true; return; }
    Howl.prototype.play = function (this: any, ...args: unknown[]) {
      try {
        const src: string = Array.isArray(this._src) ? this._src[0] : this._src;
        if (shouldBlockSrc(src)) return this;
        if (!game.user!.isGM && (OPT_MUTE() || muteGate.force) && muteGate.active) { extendMute(200); return this; }
      } catch { /* ignore */ }
      return _hplay.apply(this, args as any);
    } as any;
    (Howl.prototype.play as any)._bsrPatched = true;
    PATCHED.howl = true;
  } catch (e) { dbgWarn("audio-suppression | Howler patch failed", e); }
}

function patchHTMLAudioPlay(): void {
  if (PATCHED.html) return;
  try {
    const P = globalThis.HTMLMediaElement?.prototype; if (!P?.play) return;
    const _play = P.play;
    if ((_play as any)._bsrPatched) { PATCHED.html = true; return; }
    P.play = function (this: HTMLMediaElement, ...args: unknown[]) {
      try {
        const src = this?.currentSrc || this?.src || "";
        if (shouldBlockSrc(src)) return Promise.resolve();
        if (!game.user!.isGM && (OPT_MUTE() || muteGate.force) && muteGate.active) { extendMute(200); return Promise.resolve(); }
      } catch { /* ignore */ }
      return _play.apply(this, args as []);
    } as any;
    (P.play as any)._bsrPatched = true;
    PATCHED.html = true;
  } catch (e) { dbgWarn("audio-suppression | HTMLAudio patch failed", e); }
}

export function installAudioPatches(): void {
  patchAudioHelperPlay();
  patchFoundrySoundClass();
  patchHowlerPlay();
  patchHTMLAudioPlay();

  if (!PATCHED.howl || !PATCHED.audio || !PATCHED.sound) {
    Hooks.once("ready", () => {
      if (!PATCHED.audio) patchAudioHelperPlay();
      if (!PATCHED.sound) patchFoundrySoundClass();
      if (!PATCHED.howl) patchHowlerPlay();
    });
  }
}

export function registerAudioHooks(): void {
  Hooks.on("preCreateChatMessage", (_doc: any, data: any) => {
    try {
      if (game.user!.isGM) return;
      const whisper = _doc?.whisper ?? data?.whisper;
      const blind = _doc?.blind ?? data?.blind;
      const bsrFlags = _doc?.flags?.['blind-skill-rolls'] ?? data?.flags?.['blind-skill-rolls'];
      const isBlind = !!blind || !!(bsrFlags?.bsrBlind);
      const secret = isBlind || (Array.isArray(whisper) && whisper.length > 0) || !!(bsrFlags?.bsrPrivate);
      if (!secret) return;
      const authorId = _doc?.author?.id ?? data?.author?.id ?? data?.author ?? "";
      const authorUser = game.users?.get(String(authorId));
      const isGmAuthored = !!authorUser && isGMUser(authorUser);
      const forceMute = isBlind || isGmAuthored;
      if (!forceMute && !OPT_MUTE()) return;
      const me = meId();
      const author = String(_doc?.author?.id ?? data?.author?.id ?? data?.author ?? "");
      const wh: string[] = Array.isArray(whisper) ? whisper.map(String) : [];
      const toMe = (author === String(me)) || wh.includes(String(me));
      if (!toMe) openMute(3500, forceMute);
    } catch { /* ignore */ }
  });

  Hooks.on("createChatMessage", (doc: any) => {
    try {
      if (game.user!.isGM) return;
      const isBlind = !!doc?.blind || !!(doc?.flags?.['blind-skill-rolls']?.bsrBlind);
      const isSecret = isBlind || (Array.isArray(doc?.whisper) && doc.whisper.length > 0) || hasBsrSecretFlag(doc);
      if (!isSecret) return;
      const authorUser = doc?.author;
      const isGmAuthored = !!authorUser && isGMUser(authorUser);
      const forceMute = isBlind || isGmAuthored;
      if (!forceMute && !OPT_MUTE()) return;
      if (!isAddressedToMe(doc)) openMute(1800, forceMute);
    } catch { /* ignore */ }
  });
}
