export interface LogEntry {
  time: string;
  level: string;
  source: string;
  message: string;
  stack: string | null;
  origin: string | null;
  file: string | null;
  line: number | null;
  column: number | null;
  moduleId: string | null;
  relatedToBSR: boolean;
  inclusionReason: string | null;
}

export interface LiveLogEntry {
  time: string;
  level: string;
  source: string;
  message: string;
  stack: string | null;
  origin: string | null;
  file: string | null;
  line: number | null;
  column: number | null;
  moduleId: string | null;
}

export type DebugLevel = "none" | "info" | "warnings" | "debug" | "all";

const BSR_DEBUG_LEVELS: Readonly<Record<DebugLevel, number>> = Object.freeze({ none: 0, info: 1, warnings: 2, debug: 3, all: 4 });

let _mode: DebugLevel = "none";

const normalizeMode = (v: unknown): DebugLevel => {
  const m = String(v ?? "none").toLowerCase() as DebugLevel;
  return Object.prototype.hasOwnProperty.call(BSR_DEBUG_LEVELS, m) ? m : "none";
};

const level = (): number => BSR_DEBUG_LEVELS[normalizeMode(_mode)];

const _nativeWarn:  (...args: unknown[]) => void = console.warn.bind(console);
const _nativeError: (...args: unknown[]) => void = console.error.bind(console);
const _nativeInfo:  (...args: unknown[]) => void = console.info.bind(console);
const _nativeDebug: (...args: unknown[]) => void = console.debug.bind(console);
const _nativeLog:   (...args: unknown[]) => void = console.log.bind(console);

const LOG_MAX      = 500;
const LIVE_LOG_MAX = 2000;

export const logBuffer: LogEntry[] = [];

export const liveConsoleBuffer: LiveLogEntry[] = [];

export const normalizeToString = (v: unknown): string => {
  if (v === null)      return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "string") return v;
  if (v instanceof Error) return `${v.message}\n${v.stack ?? ""}`.trim();
  try { return JSON.stringify(v); } catch { try { return String(v); } catch { return "<unprintable>"; } }
};

export const pushLog = ({
  level: lvl, message, stack = null, source = "console", origin = null,
  file = null, line = null, column = null, moduleId = null,
  relatedToBSR = false, inclusionReason = null
}: {
  level: string; message: string; stack?: string | null; source?: string; origin?: string | null;
  file?: string | null; line?: number | null; column?: number | null; moduleId?: string | null;
  relatedToBSR?: boolean; inclusionReason?: string | null;
}): void => {
  const entry: LogEntry = {
    time: new Date().toISOString(), level: lvl, source, message, stack, origin,
    file, line, column, moduleId, relatedToBSR, inclusionReason
  };
  logBuffer.unshift(entry);
  if (logBuffer.length > LOG_MAX) logBuffer.length = LOG_MAX;
};

export const pushLiveLog = ({
  level: lvl, message, stack = null, source = "console", origin = null,
  file = null, line = null, column = null, moduleId = null
}: {
  level: string; message: string; stack?: string | null; source?: string; origin?: string | null;
  file?: string | null; line?: number | null; column?: number | null; moduleId?: string | null;
}): void => {
  const entry: LiveLogEntry = {
    time: new Date().toISOString(), level: lvl, source, message, stack, origin,
    file, line, column, moduleId
  };
  liveConsoleBuffer.unshift(entry);
  if (liveConsoleBuffer.length > LIVE_LOG_MAX) liveConsoleBuffer.length = LIVE_LOG_MAX;
};

export const clearLog     = (): void => { logBuffer.length = 0; };
export const clearLiveLog = (): void => { liveConsoleBuffer.length = 0; };

const BSR_TAG   = "%c[Blind Skill Rolls]";
const BSR_STYLE = "color:#7eb8f7;font-weight:bold;";

export const setDebugMode  = (mode: unknown): void    => { _mode = normalizeMode(mode); };
export const getDebugMode  = (): DebugLevel            => normalizeMode(_mode);
export const getDebugLevel = (): number                => level();
export const isDebugAtLeast = (mode: DebugLevel): boolean => level() >= BSR_DEBUG_LEVELS[normalizeMode(mode)];

export const dbgWarn = (...args: unknown[]): void => {
  if (level() >= BSR_DEBUG_LEVELS.warnings) {
    _nativeWarn(BSR_TAG, BSR_STYLE, ...args);
    try {
      const combined = args.map(normalizeToString).join(" ");
      pushLog({
        level: "warn", message: combined, source: "bsr.debug",
        origin: "blind-skill-rolls", moduleId: "blind-skill-rolls",
        relatedToBSR: true, inclusionReason: "BSR debug output"
      });
    } catch { /* ignore */ }
  }
};

export const dbgInfo = (...args: unknown[]): void => {
  if (level() >= BSR_DEBUG_LEVELS.info) _nativeInfo(BSR_TAG, BSR_STYLE, ...args);
};

export const dbgDebug = (...args: unknown[]): void => {
  if (level() >= BSR_DEBUG_LEVELS.debug) _nativeDebug(BSR_TAG, BSR_STYLE, ...args);
};

export const dbgAll = (...args: unknown[]): void => {
  if (level() >= BSR_DEBUG_LEVELS.all) _nativeLog(BSR_TAG, BSR_STYLE, ...args);
};
