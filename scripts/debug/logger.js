const BSR_DEBUG_LEVELS = Object.freeze({ none: 0, info: 1, warnings: 2, debug: 3, all: 4 });
let _mode = "none";
const normalizeMode = (v) => {
    const m = String(v ?? "none").toLowerCase();
    return Object.prototype.hasOwnProperty.call(BSR_DEBUG_LEVELS, m) ? m : "none";
};
const level = () => BSR_DEBUG_LEVELS[normalizeMode(_mode)];
const _nativeWarn = console.warn.bind(console);
const _nativeError = console.error.bind(console);
const _nativeInfo = console.info.bind(console);
const _nativeDebug = console.debug.bind(console);
const _nativeLog = console.log.bind(console);
const LOG_MAX = 500;
const LIVE_LOG_MAX = 2000;
export const logBuffer = [];
export const liveConsoleBuffer = [];
export const normalizeToString = (v) => {
    if (v === null)
        return "null";
    if (v === undefined)
        return "undefined";
    if (typeof v === "string")
        return v;
    if (v instanceof Error)
        return `${v.message}\n${v.stack ?? ""}`.trim();
    try {
        return JSON.stringify(v);
    }
    catch {
        try {
            return String(v);
        }
        catch {
            return "<unprintable>";
        }
    }
};
export const pushLog = ({ level: lvl, message, stack = null, source = "console", origin = null, file = null, line = null, column = null, moduleId = null, relatedToBSR = false, inclusionReason = null }) => {
    const entry = {
        time: new Date().toISOString(), level: lvl, source, message, stack, origin,
        file, line, column, moduleId, relatedToBSR, inclusionReason
    };
    logBuffer.unshift(entry);
    if (logBuffer.length > LOG_MAX)
        logBuffer.length = LOG_MAX;
};
export const pushLiveLog = ({ level: lvl, message, stack = null, source = "console", origin = null, file = null, line = null, column = null, moduleId = null }) => {
    const entry = {
        time: new Date().toISOString(), level: lvl, source, message, stack, origin,
        file, line, column, moduleId
    };
    liveConsoleBuffer.unshift(entry);
    if (liveConsoleBuffer.length > LIVE_LOG_MAX)
        liveConsoleBuffer.length = LIVE_LOG_MAX;
};
export const clearLog = () => { logBuffer.length = 0; };
export const clearLiveLog = () => { liveConsoleBuffer.length = 0; };
const BSR_TAG = "%c[Blind Skill Rolls]";
const BSR_STYLE = "color:#7eb8f7;font-weight:bold;";
export const setDebugMode = (mode) => { _mode = normalizeMode(mode); };
export const getDebugMode = () => normalizeMode(_mode);
export const getDebugLevel = () => level();
export const isDebugAtLeast = (mode) => level() >= BSR_DEBUG_LEVELS[normalizeMode(mode)];
export const dbgWarn = (...args) => {
    if (level() >= BSR_DEBUG_LEVELS.warnings) {
        _nativeWarn(BSR_TAG, BSR_STYLE, ...args);
        try {
            const combined = args.map(normalizeToString).join(" ");
            pushLog({
                level: "warn", message: combined, source: "bsr.debug",
                origin: "blind-skill-rolls", moduleId: "blind-skill-rolls",
                relatedToBSR: true, inclusionReason: "BSR debug output"
            });
        }
        catch { /* ignore */ }
    }
};
export const dbgInfo = (...args) => {
    if (level() >= BSR_DEBUG_LEVELS.info)
        _nativeInfo(BSR_TAG, BSR_STYLE, ...args);
};
export const dbgDebug = (...args) => {
    if (level() >= BSR_DEBUG_LEVELS.debug)
        _nativeDebug(BSR_TAG, BSR_STYLE, ...args);
};
export const dbgAll = (...args) => {
    if (level() >= BSR_DEBUG_LEVELS.all)
        _nativeLog(BSR_TAG, BSR_STYLE, ...args);
};
