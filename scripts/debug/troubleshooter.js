import { MOD } from "../core/constants.js";
import { logBuffer, liveConsoleBuffer, clearLog, clearLiveLog, pushLog, pushLiveLog, normalizeToString, setDebugMode, getDebugMode } from "./logger.js";
import { applyThemeToElement } from "../ui/theme.js";
import { L } from "../ui/settings-helpers.js";
const FILE_NAME = "fvtt-bsr-troubleshooter.json";
const BSR_ID = "blind-skill-rolls";
const BSR_PATH_SEGMENT = `modules/${BSR_ID}/`;
const KNOWN_COMPAT_MODULES = Object.freeze([
    "blind-skill-rolls", "midi-qol", "dice-so-nice", "combat-tracker-dock"
]);
const MODULE_ALIASES = Object.freeze(new Map([
    ["blind-skill-rolls", ["blind skill rolls", "bsr"]],
    ["midi-qol", ["midi qol", "midiqol"]],
    ["dice-so-nice", ["dicesonice"]],
    ["combat-tracker-dock", []]
]));
// =====================================================================
//  Capture & Filter Helpers
// =====================================================================
let _capturing = false;
let _liveCaptureActive = false;
let _liveCaptureStartedAt = null;
const stripOwnFrames = (stack) => {
    if (!stack)
        return null;
    return String(stack)
        .split("\n")
        .filter(l => !l.includes("/debug/troubleshooter.js") && !l.includes("/debug/logger.js"))
        .join("\n") || null;
};
/** Extract first module ID from a path string  (modules/<id>/…) */
const moduleIdFromPath = (text) => {
    if (!text)
        return null;
    const m = String(text).match(/modules\/([^/]+)\//);
    return m ? m[1] : null;
};
/** Walk cleaned stack lines and return the first module ID found */
const moduleIdFromStack = (cleaned) => {
    if (!cleaned)
        return null;
    for (const line of String(cleaned).split("\n")) {
        const id = moduleIdFromPath(line);
        if (id)
            return id;
    }
    return null;
};
/** Extract first URL from cleaned stack */
const fileFromStack = (cleaned) => {
    if (!cleaned)
        return null;
    for (const line of String(cleaned).split("\n")) {
        const m = line.match(/(https?:\/\/[^\s)]+)/);
        if (m)
            return m[1];
    }
    return null;
};
/** Check combined text for a known compat module path */
const classifyOrigin = (file, cleaned) => {
    const combined = [file, cleaned].filter(Boolean).join("\n");
    for (const id of KNOWN_COMPAT_MODULES) {
        if (combined.includes(`modules/${id}/`))
            return id;
    }
    return null;
};
/** Check message text for a module name or alias */
const findMentionedModule = (text) => {
    if (!text)
        return null;
    const t = String(text).toLowerCase();
    for (const id of KNOWN_COMPAT_MODULES) {
        if (t.includes(id))
            return id;
    }
    for (const [id, aliases] of MODULE_ALIASES) {
        for (const a of aliases) {
            if (t.includes(a))
                return id;
        }
    }
    return null;
};
const hasBSRInStack = (cleaned) => cleaned ? String(cleaned).includes(BSR_PATH_SEGMENT) : false;
const hasBSRReference = (text) => {
    if (!text)
        return false;
    const l = String(text).toLowerCase();
    return l.includes("blind-skill-rolls") || l.includes("blind skill rolls") || l.includes("[bsr]");
};
const formatConsoleArgs = (args) => {
    if (!args.length)
        return "";
    if (typeof args[0] === "string" && args[0].includes("%c")) {
        let fmt = args[0];
        const rest = args.slice(1);
        let styleCount = 0;
        fmt = fmt.replace(/%c/g, () => { styleCount++; return ""; });
        const meaningful = rest.slice(styleCount);
        return [fmt.trim(), ...meaningful.map(normalizeToString)].filter(Boolean).join(" ");
    }
    return args.map(normalizeToString).join(" ");
};
const determineBSRRelevance = ({ message, file, origin, moduleId }, cleaned) => {
    if (file && String(file).includes(BSR_PATH_SEGMENT))
        return { relatedToBSR: true, inclusionReason: "direct BSR source file" };
    if (hasBSRInStack(cleaned))
        return { relatedToBSR: true, inclusionReason: "BSR in call stack" };
    if (origin === BSR_ID || moduleId === BSR_ID)
        return { relatedToBSR: true, inclusionReason: "origin is BSR module" };
    if (hasBSRReference(message))
        return { relatedToBSR: true, inclusionReason: "BSR referenced in message" };
    const detected = origin ?? moduleId;
    if (detected && KNOWN_COMPAT_MODULES.includes(detected) && detected !== BSR_ID) {
        if (hasBSRInStack(cleaned))
            return { relatedToBSR: true, inclusionReason: `compat module '${detected}' called from BSR path` };
        if (hasBSRReference(message))
            return { relatedToBSR: true, inclusionReason: `compat module '${detected}' message references BSR` };
        return { relatedToBSR: false, inclusionReason: null };
    }
    return { relatedToBSR: false, inclusionReason: null };
};
/* ---------- unified capture pipeline ---------- */
const captureEntry = ({ level, message, rawStack, source, file, line, column }) => {
    const cleaned = stripOwnFrames(rawStack);
    const effectiveFile = file ?? fileFromStack(cleaned);
    const origin = classifyOrigin(effectiveFile, cleaned)
        ?? findMentionedModule(message)
        ?? findMentionedModule(cleaned);
    const moduleId = moduleIdFromPath(effectiveFile)
        ?? moduleIdFromStack(cleaned)
        ?? origin;
    const entry = {
        level,
        message: String(message ?? ""),
        stack: rawStack ?? null,
        source,
        file: effectiveFile ?? null,
        line: line ?? null,
        column: column ?? null,
        origin: origin ?? null,
        moduleId: moduleId ?? null
    };
    if (_liveCaptureActive) {
        pushLiveLog(entry);
    }
    const { relatedToBSR, inclusionReason } = determineBSRRelevance(entry, cleaned);
    if (relatedToBSR) {
        pushLog({ ...entry, relatedToBSR, inclusionReason });
    }
};
// =====================================================================
//  Passive Capture (always-on, non-invasive)
// =====================================================================
const PASSIVE_FLAG = "__BSR_TS_PASSIVE_V3__";
if (!globalThis[PASSIVE_FLAG]) {
    globalThis[PASSIVE_FLAG] = true;
    window.addEventListener("error", (ev) => {
        if (_capturing)
            return;
        if (ev.target !== window && ev.target !== globalThis)
            return;
        _capturing = true;
        try {
            const err = ev?.error;
            captureEntry({
                level: "error",
                message: err?.message ?? ev?.message ?? "Unknown error",
                rawStack: err?.stack ?? null,
                source: "window.error",
                file: ev?.filename ?? null,
                line: ev?.lineno ?? null,
                column: ev?.colno ?? null
            });
        }
        catch { /* ignore */ }
        finally {
            _capturing = false;
        }
    });
    window.addEventListener("error", (ev) => {
        if (_capturing)
            return;
        const el = ev.target;
        if (!el || el === window || el === globalThis || !el.tagName)
            return;
        _capturing = true;
        try {
            const src = el.src || el.href || "";
            captureEntry({
                level: "error",
                message: `Failed to load resource: <${el.tagName.toLowerCase()}> ${src}`,
                rawStack: null,
                source: "window.error.resource",
                file: src || null
            });
        }
        catch { /* ignore */ }
        finally {
            _capturing = false;
        }
    }, true);
    window.addEventListener("unhandledrejection", (ev) => {
        if (_capturing)
            return;
        _capturing = true;
        try {
            const reason = ev?.reason;
            captureEntry({
                level: "error",
                message: reason?.message ?? String(reason ?? "Unhandled promise rejection"),
                rawStack: reason?.stack ?? null,
                source: "window.unhandledrejection"
            });
        }
        catch { /* ignore */ }
        finally {
            _capturing = false;
        }
    });
}
// =====================================================================
//  Live Capture (only while troubleshooter window is open)
// =====================================================================
let _savedConsoleWarn = null;
let _savedConsoleError = null;
let _savedFetch = null;
const startLiveCapture = () => {
    if (_liveCaptureActive)
        return;
    _liveCaptureActive = true;
    _liveCaptureStartedAt = new Date().toISOString();
    clearLiveLog();
    _savedConsoleWarn = console.warn;
    _savedConsoleError = console.error;
    _savedFetch = window.fetch;
    console.warn = (...args) => {
        _savedConsoleWarn.apply(console, args);
        if (_capturing)
            return;
        _capturing = true;
        try {
            const message = formatConsoleArgs(args);
            captureEntry({ level: "warn", message, rawStack: new Error().stack, source: "console.warn" });
        }
        catch { /* ignore */ }
        finally {
            _capturing = false;
        }
    };
    console.error = (...args) => {
        _savedConsoleError.apply(console, args);
        if (_capturing)
            return;
        _capturing = true;
        try {
            const errObj = args[0] instanceof Error ? args[0] : null;
            const message = errObj ? errObj.message : formatConsoleArgs(args);
            const stk = errObj?.stack ?? new Error().stack ?? null;
            captureEntry({ level: "error", message, rawStack: stk, source: "console.error" });
        }
        catch { /* ignore */ }
        finally {
            _capturing = false;
        }
    };
    window.fetch = function (...args) {
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url ?? "";
        const relevant = KNOWN_COMPAT_MODULES.some(id => url.includes(`modules/${id}/`));
        if (!relevant)
            return _savedFetch.apply(this, args);
        return _savedFetch.apply(this, args).then((resp) => {
            if (!resp.ok && !_capturing) {
                _capturing = true;
                try {
                    captureEntry({
                        level: "warn",
                        message: `Fetch failed: ${resp.status} ${resp.statusText} – ${url}`,
                        rawStack: null, source: "fetch", file: url
                    });
                }
                catch { /* ignore */ }
                finally {
                    _capturing = false;
                }
            }
            return resp;
        }, (err) => {
            if (!_capturing) {
                _capturing = true;
                try {
                    captureEntry({
                        level: "error",
                        message: `Fetch error: ${err?.message ?? err} – ${url}`,
                        rawStack: err?.stack ?? null, source: "fetch", file: url
                    });
                }
                catch { /* ignore */ }
                finally {
                    _capturing = false;
                }
            }
            throw err;
        });
    };
};
const stopLiveCapture = () => {
    if (!_liveCaptureActive)
        return;
    _liveCaptureActive = false;
    if (_savedConsoleWarn) {
        console.warn = _savedConsoleWarn;
        _savedConsoleWarn = null;
    }
    if (_savedConsoleError) {
        console.error = _savedConsoleError;
        _savedConsoleError = null;
    }
    if (_savedFetch) {
        window.fetch = _savedFetch;
        _savedFetch = null;
    }
};
// =====================================================================
//  Utility helpers
// =====================================================================
const safeGetSetting = (ns, key, fb = null) => { try {
    return game.settings.get(ns, key);
}
catch {
    return fb;
} };
const safeJson = (v) => {
    if (v === undefined || v === null)
        return v ?? null;
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean")
        return v;
    try {
        return JSON.parse(JSON.stringify(v));
    }
    catch {
        try {
            return String(v);
        }
        catch {
            return "<unserializable>";
        }
    }
};
const stringifyVal = (v) => {
    if (v === null)
        return "null";
    if (v === undefined)
        return "undefined";
    if (typeof v === "string")
        return v;
    try {
        return JSON.stringify(v);
    }
    catch {
        return String(v);
    }
};
const downloadJsonText = (text) => {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = FILE_NAME;
    a.click();
    URL.revokeObjectURL(url);
};
const downloadJson = (obj) => downloadJsonText(JSON.stringify(obj, null, 2));
// =====================================================================
//  Settings display helpers
// =====================================================================
const SKILL_KEYS = new Set(["acr", "ani", "arc", "ath", "dec", "his", "ins", "itm", "inv", "med", "nat", "prc", "per", "prf", "rel", "slt", "ste", "sur"]);
const localizeMaybe = (s) => { if (!s || typeof s !== "string")
    return s; try {
    const loc = game.i18n?.localize?.(s);
    return loc && loc !== s ? loc : s;
}
catch {
    return s;
} };
const displayNameForSetting = (key) => {
    const k = String(key ?? ""), lower = k.toLowerCase();
    if (lower.startsWith("save_")) {
        const abilityKey = lower.replace(/^save_/, "").replace(/_private$/, "");
        try {
            const entry = CONFIG?.DND5E?.abilities?.[abilityKey];
            if (entry?.label)
                return localizeMaybe(entry.label);
        }
        catch { /* ignore */ }
    }
    const baseSkill = lower.replace(/_private$/, "");
    if (SKILL_KEYS.has(baseSkill)) {
        try {
            const entry = CONFIG?.DND5E?.skills?.[baseSkill];
            if (entry?.label)
                return entry.label;
        }
        catch { /* ignore */ }
        return baseSkill;
    }
    try {
        const meta = game.settings?.settings?.get(`${MOD}.${k}`);
        const rawName = meta?.name ?? null;
        if (rawName)
            return localizeMaybe(rawName);
    }
    catch { /* ignore */ }
    return `${MOD}.${k}`;
};
const groupNameForSetting = (key) => {
    const k = String(key ?? "").toLowerCase();
    const base = k.replace(/_private$/, "");
    if (SKILL_KEYS.has(base) || k.startsWith("skill"))
        return k.endsWith("_private") ? "Skills Private" : "Skills Blind";
    if (k.startsWith("save_"))
        return k.endsWith("_private") ? "Saving Throws Private" : "Saving Throws Blind";
    if (k.startsWith("ff"))
        return k.startsWith("ffplayer") ? "Fast Forward Player" : "Fast Forward GM";
    if (k.startsWith("death") || k.includes("deathsave"))
        return "Death Saves";
    if (k === "hideforeignsecrets" || k === "muteforeignsecretsounds" || k === "bsrsanitizepublicgm" || k === "bsrtrustedseedetails" || k.includes("npc") || k.includes("reveal"))
        return "Chat Display & Privacy";
    if (k.startsWith("debug") || k === "showsyncmessages" || k === "bsrtheme")
        return "Other BSR Settings";
    if (k.startsWith("dsn") || k.includes("dicesonice") || k.includes("ghost"))
        return "Dice So Nice";
    return "Other";
};
const groupOrder = ["Skills Blind", "Skills Private", "Saving Throws Blind", "Saving Throws Private", "Death Saves", "Fast Forward GM", "Fast Forward Player", "Chat Display & Privacy", "Other BSR Settings", "Dice So Nice", "Other"];
const GROUP_META = Object.freeze({
    "Skills Blind": { label: "Skills", tag: "Blind" }, "Skills Private": { label: "Skills", tag: "Private" },
    "Saving Throws Blind": { label: "Saving Throws", tag: "Blind" }, "Saving Throws Private": { label: "Saving Throws", tag: "Private" },
    "Fast Forward GM": { label: "Fast Forward", tag: "GM" }, "Fast Forward Player": { label: "Fast Forward", tag: "Player" }
});
const PAIRED_GROUPS = Object.freeze([["Skills Blind", "Skills Private"], ["Saving Throws Blind", "Saving Throws Private"], ["Fast Forward GM", "Fast Forward Player"]]);
const PAIRED_HEADER_KEYS = Object.freeze({ "Skills Blind": { left: "enabled", right: "blindRollersChat" }, "Saving Throws Blind": { left: "savesEnabled", right: "blindRollersSaveChat" } });
const HEADER_KEY_SET = new Set(Object.values(PAIRED_HEADER_KEYS).flatMap(v => [v.left, v.right]).filter(Boolean));
const getPath = (obj, path) => {
    if (!obj)
        return undefined;
    const parts = String(path).split(".");
    let cur = obj;
    for (const p of parts) {
        if (cur == null)
            return undefined;
        cur = cur[p];
    }
    return cur;
};
const firstDefined = (obj, paths) => { for (const p of paths) {
    const v = getPath(obj, p);
    if (v !== undefined)
        return v;
} return undefined; };
const buildMidiSummaryRows = () => {
    const rows = [];
    const midiActive = !!game.modules?.get("midi-qol")?.active;
    if (!midiActive)
        return rows;
    const ew = safeGetSetting("midi-qol", "EnableWorkflow", undefined);
    rows.push({ label: "Enable Roll Automation Support (Client Setting)", value: ew === undefined ? "unknown" : stringifyVal(ew) });
    const cfg = safeGetSetting("midi-qol", "ConfigSettings", null);
    rows.push({ label: "GM: Auto fast forward rolls", value: stringifyVal(firstDefined(cfg, ["gmAutoFastForward", "gmAutoFastForwardRolls", "gmAutoFastForwardAbilityRolls", "gmAutoFastForwardAbility", "gm.autoFastForwardRolls", "gm.autoFastForwardAbilityRolls", "workflow.gm.autoFastForwardRolls", "workflow.gm.autoFastForwardAbilityRolls"]) ?? "unknown") });
    rows.push({ label: "Player: Auto fast forward rolls", value: stringifyVal(firstDefined(cfg, ["autoFastForward", "autoFastForwardRolls", "autoFastForwardAbilityRolls", "playerAutoFastForwardRolls", "playerAutoFastForwardAbilityRolls", "player.autoFastForwardRolls", "workflow.player.autoFastForwardRolls"]) ?? "unknown") });
    rows.push({ label: "Which skill checks are rolled blind", value: stringifyVal(firstDefined(cfg, ["rollSkillsBlind", "workflow.rollSkillsBlind", "blind.rollSkillsBlind"]) ?? "unknown") });
    return rows;
};
// =====================================================================
//  Export / Report builder
// =====================================================================
const getBsrSettingsDump = () => {
    const out = [];
    try {
        const all = game.settings?.settings;
        if (!all)
            return out;
        for (const [, setting] of all.entries()) {
            if (!setting || setting.namespace !== MOD)
                continue;
            out.push({ key: setting.key, value: safeJson(safeGetSetting(MOD, setting.key, "<unreadable>")), scope: setting.scope, config: !!setting.config, restricted: !!setting.restricted, type: setting.type?.name ?? typeof safeGetSetting(MOD, setting.key, null) });
        }
        out.sort((a, b) => a.key.localeCompare(b.key));
    }
    catch { /* ignore */ }
    return out;
};
const buildReportObject = () => {
    const now = new Date().toISOString();
    const self = game.modules?.get(MOD);
    const bsrSettings = getBsrSettingsDump();
    const installedModules = (() => { try {
        return Array.from(game.modules?.values?.() ?? []).map((m) => ({ id: m.id, title: m.title ?? m.id, version: m.version ?? null, active: !!m.active, compatibility: safeJson(m.compatibility ?? null) })).sort((a, b) => a.id.localeCompare(b.id));
    }
    catch {
        return [];
    } })();
    let midiQol = null;
    if (game.modules?.get("midi-qol")?.active) {
        midiQol = { version: game.modules.get("midi-qol")?.version ?? null, enableWorkflow: safeJson(safeGetSetting("midi-qol", "EnableWorkflow", null)), configSettings: safeJson(safeGetSetting("midi-qol", "ConfigSettings", null)) };
    }
    const activeCompatModules = KNOWN_COMPAT_MODULES
        .filter(id => id !== BSR_ID && !!game.modules?.get(id)?.active)
        .map(id => ({ id, version: game.modules.get(id)?.version ?? null }));
    return {
        schema: "bsr.troubleshooter", schemaVersion: 3, generatedAt: now,
        exportMeta: {
            timestamp: now,
            moduleVersion: self?.version ?? null,
            foundryVersion: game.version ?? null,
            dnd5eVersion: game.system?.version ?? null,
            worldName: game.world?.title ?? game.world?.id ?? null,
            browser: typeof navigator !== "undefined" ? navigator.userAgent : null,
            activeCompatModules
        },
        module: { id: MOD, title: self?.title ?? MOD, version: self?.version ?? null },
        core: { foundryVersion: game.version ?? null, build: safeJson(game.build ?? null), release: safeJson(game.release ?? null) },
        system: { id: game.system?.id ?? null, title: game.system?.title ?? null, version: game.system?.version ?? null },
        world: { id: game.world?.id ?? null, title: game.world?.title ?? null },
        user: { id: game.user?.id ?? null, name: game.user?.name ?? null, isGM: !!game.user?.isGM, isActiveGM: !!game.user?.isActiveGM },
        browser: { userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null },
        bsrSettings,
        midiQol,
        modules: installedModules,
        filteredLog: safeJson(logBuffer),
        liveConsoleCapture: {
            info: {
                startedAt: _liveCaptureStartedAt,
                isActive: _liveCaptureActive,
                entryCount: liveConsoleBuffer.length
            },
            entries: safeJson(liveConsoleBuffer)
        }
    };
};
// =====================================================================
//  ApplicationV2 UI
// =====================================================================
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
class BsrTroubleshooterApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "bsr-troubleshooter", classes: ["bsr-ts", "bsr-theme"],
        window: { title: "BSR.Troubleshooter.Title", resizable: true },
        position: { width: 960, height: 640 }
    };
    static PARTS = { main: { template: `modules/${MOD}/templates/bsr-troubleshooter.hbs` } };
    #activeTab = "summary";
    async _prepareContext(_options) {
        const report = buildReportObject();
        const modules = report.modules ?? [];
        const allModulesRows = modules.map(m => ({ id: m.id, title: m.title, active: !!m.active, version: m.version ?? "", foundry: m.compatibility?.verified ?? m.compatibility?.minimum ?? "" })).sort((a, b) => { if (a.active !== b.active)
            return a.active ? -1 : 1; return (a.title ?? "").toLowerCase().localeCompare((b.title ?? "").toLowerCase()) || (a.id ?? "").localeCompare(b.id ?? ""); });
        const grouped = {}, headerItems = {};
        for (const s of report.bsrSettings ?? []) {
            if (HEADER_KEY_SET.has(s.key)) {
                headerItems[s.key] = { name: displayNameForSetting(s.key), value: stringifyVal(s.value) };
                continue;
            }
            const group = groupNameForSetting(s.key);
            (grouped[group] ??= []).push({ name: displayNameForSetting(s.key), value: stringifyVal(s.value) });
        }
        const bsrSettingsGroups = Object.entries(grouped).sort((a, b) => { const ai = groupOrder.indexOf(a[0]), bi = groupOrder.indexOf(b[0]); return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a[0].localeCompare(b[0]); }).map(([group, items]) => ({ group, items: items.sort((x, y) => x.name.localeCompare(y.name)) }));
        const pairedLeftSet = new Set(PAIRED_GROUPS.map(p => p[0])), pairedRightSet = new Set(PAIRED_GROUPS.map(p => p[1]));
        const pairMap = Object.fromEntries(PAIRED_GROUPS), processed = new Set(), settingsLayout = [];
        for (const g of bsrSettingsGroups) {
            if (processed.has(g.group))
                continue;
            processed.add(g.group);
            const meta = GROUP_META[g.group] ?? { label: g.group, tag: null };
            if (pairedLeftSet.has(g.group)) {
                const rightName = pairMap[g.group], right = bsrSettingsGroups.find(x => x.group === rightName);
                processed.add(rightName);
                const rightMeta = GROUP_META[rightName] ?? { label: rightName, tag: null };
                const hdrDef = PAIRED_HEADER_KEYS[g.group];
                settingsLayout.push({ paired: true, left: { headerItem: hdrDef ? headerItems[hdrDef.left] ?? null : null, label: meta.label, tag: meta.tag, items: g.items }, right: right ? { headerItem: hdrDef ? headerItems[hdrDef.right] ?? null : null, label: rightMeta.label, tag: rightMeta.tag, items: right.items } : null });
            }
            else if (!pairedRightSet.has(g.group)) {
                settingsLayout.push({ paired: false, group: { label: meta.label, tag: meta.tag, items: g.items } });
            }
        }
        const activeCount = modules.filter(m => m.active).length;
        return {
            activeTab: this.#activeTab,
            debugMode: getDebugMode(),
            debugModeChoices: [
                { value: "none", label: L("BSR.Troubleshooter.Option.DebugNone", "None") },
                { value: "info", label: L("BSR.Troubleshooter.Option.DebugInfo", "Info") },
                { value: "warnings", label: L("BSR.Troubleshooter.Option.DebugWarnings", "Warnings") },
                { value: "debug", label: L("BSR.Troubleshooter.Option.DebugDebug", "Debug") },
                { value: "all", label: L("BSR.Troubleshooter.Option.DebugAll", "All") }
            ],
            summaryRows: [
                { label: L("BSR.Troubleshooter.Summary.FoundryVersion", "Foundry Version"), value: report.core?.foundryVersion ?? "" },
                { label: L("BSR.Troubleshooter.Summary.System", "System"), value: `${report.system?.id ?? ""} ${report.system?.version ?? ""}`.trim() },
                { label: L("BSR.Troubleshooter.Summary.BSRVersion", "BSR Version"), value: report.module?.version ?? "" },
                { label: L("BSR.Troubleshooter.Summary.ModuleCount", "Module Count"), value: game.i18n?.format?.("BSR.Troubleshooter.Summary.ModuleCountValue", { active: activeCount, total: modules.length }) ?? `Active: ${activeCount} | Installed: ${modules.length}` }
            ],
            settingsLayout, midiSettingsRows: buildMidiSummaryRows(),
            problemsRows: (logBuffer ?? []).map((e) => ({
                time: e.time, level: e.level, source: e.source,
                message: e.message, stack: e.stack,
                origin: e.origin ?? "unknown",
                moduleId: e.moduleId ?? null,
                inclusionReason: e.inclusionReason ?? ""
            })),
            allModulesRows, reportJson: JSON.stringify(report, null, 2),
            labels: {
                tabSummary: L("BSR.Troubleshooter.Tab.Summary", "Summary"),
                tabProblems: L("BSR.Troubleshooter.Tab.Problems", "Problems"),
                tabAllModules: L("BSR.Troubleshooter.Tab.AllModules", "All Modules"),
                sectionEnv: L("BSR.Troubleshooter.Section.Environment", "Environment"),
                sectionSettings: L("BSR.Troubleshooter.Section.BSRSettings", "BSR Settings"),
                sectionMidi: L("BSR.Troubleshooter.Section.MidiQOLSettings", "MidiQOL Settings"),
                sectionErrors: L("BSR.Troubleshooter.Section.Errors", "BSR & Compatibility Module Errors"),
                sectionAllMods: L("BSR.Troubleshooter.Section.AllModules", "All Installed Modules"),
                thSetting: L("BSR.Troubleshooter.Table.Setting", "Setting"),
                thValue: L("BSR.Troubleshooter.Table.Value", "Value"),
                thTime: L("BSR.Troubleshooter.Table.Time", "Time"),
                thLevel: L("BSR.Troubleshooter.Table.Level", "Level"),
                thOrigin: L("BSR.Troubleshooter.Table.Origin", "Origin"),
                thSource: L("BSR.Troubleshooter.Table.Source", "Source"),
                thMessage: L("BSR.Troubleshooter.Table.Message", "Message"),
                thModuleID: L("BSR.Troubleshooter.Table.ModuleID", "Module ID"),
                thStatus: L("BSR.Troubleshooter.Table.Status", "Status"),
                thTitle: L("BSR.Troubleshooter.Table.Title", "Title"),
                thVersion: L("BSR.Troubleshooter.Table.Version", "Version"),
                thFoundry: L("BSR.Troubleshooter.Table.Foundry", "Foundry"),
                badgeActive: L("BSR.Troubleshooter.Badge.Active", "active"),
                badgeOff: L("BSR.Troubleshooter.Badge.Off", "off"),
                hintErrorCapture: L("BSR.Troubleshooter.Hint.ErrorCapture", "Only errors directly related to Blind Skill Rolls or triggered through BSR integrations are shown here. Extended console capture is active while this window is open. Hover a problem row to see why it was included."),
                hintNoErrors: L("BSR.Troubleshooter.Hint.NoErrors", "No errors captured yet."),
                hintExportNote: L("BSR.Troubleshooter.Hint.ExportNote", "Export includes the filtered BSR log and a live console capture recorded while the troubleshooter was open."),
                btnReload: L("BSR.Troubleshooter.Button.Reload", "Reload"),
                btnClearLog: L("BSR.Troubleshooter.Button.ClearLog", "Clear Log"),
                btnExportData: L("BSR.Troubleshooter.Button.ExportData", "Export Data"),
                lblDebug: L("BSR.Troubleshooter.Label.Debug", "Debug")
            }
        };
    }
    _onRender(_context, _options) {
        super._onRender(_context, _options);
        startLiveCapture();
        applyThemeToElement(this.element);
        const root = this.element;
        if (!root)
            return;
        root.querySelectorAll("[data-tab]").forEach(btn => btn.addEventListener("click", () => { this.#activeTab = btn.dataset.tab; this.render({ force: true }); }));
        root.querySelector("[data-action='reload']")?.addEventListener("click", () => this.render({ force: true }));
        root.querySelector("[data-action='clearLog']")?.addEventListener("click", () => { clearLog(); clearLiveLog(); ui.notifications.info(L("BSR.Troubleshooter.Notification.LogCleared", "Troubleshooter log cleared.")); this.render({ force: true }); });
        root.querySelector("[data-action='export']")?.addEventListener("click", () => { const json = root.querySelector("textarea[data-json]")?.value; if (json)
            downloadJsonText(json);
        else
            downloadJson(buildReportObject()); });
        root.querySelector("[data-action='debugMode']")?.addEventListener("change", async (ev) => {
            const val = ev.currentTarget.value;
            try {
                await game.settings.set(MOD, "debugMode", val);
                setDebugMode(val);
            }
            catch { /* ignore */ }
        });
    }
    async close(options = {}) {
        stopLiveCapture();
        return super.close(options);
    }
    static open() { new BsrTroubleshooterApp().render({ force: true }); }
}
Hooks.once("init", () => {
    try {
        game.settings.register(MOD, "debugMode", {
            name: L("BSR.Troubleshooter.Settings.DebugMode.Name", "Debug mode"),
            hint: L("BSR.Troubleshooter.Settings.DebugMode.Hint", "Controls how much detail BSR logs to the browser console."),
            scope: "client", config: false, restricted: false, type: String,
            choices: { none: L("BSR.Troubleshooter.Option.DebugNone", "None"), info: L("BSR.Troubleshooter.Option.DebugInfo", "Info"), warnings: L("BSR.Troubleshooter.Option.DebugWarnings", "Warnings"), debug: L("BSR.Troubleshooter.Option.DebugDebug", "Debug"), all: L("BSR.Troubleshooter.Option.DebugAll", "All") },
            default: "none",
            onChange: (value) => { try {
                setDebugMode(value);
            }
            catch { /* ignore */ } }
        });
    }
    catch (e) {
        console.warn("[BSR]", "Failed to register debug mode setting:", e);
    }
    try {
        game.settings.registerMenu(MOD, "troubleshooter", {
            name: "BSR.Troubleshooter.Settings.Name",
            label: "BSR.Troubleshooter.Button.Open",
            hint: "BSR.Troubleshooter.Note.MenuHint",
            icon: "fas fa-stethoscope", restricted: true, type: BsrTroubleshooterApp
        });
    }
    catch (e) {
        console.warn("BSR | Failed to register troubleshooter menu:", e);
    }
});
Hooks.once("ready", () => {
    try {
        setDebugMode(game.settings.get(MOD, "debugMode"));
    }
    catch { /* ignore */ }
});
Hooks.once("init", () => {
    const mod = game.modules.get(MOD);
    if (mod) {
        mod.api = Object.freeze({
            open: () => BsrTroubleshooterApp.open(),
            export: () => downloadJson(buildReportObject()),
            clearLog: () => { clearLog(); clearLiveLog(); },
            buildReportObject,
            capture: ({ level = "warn", message = "", source = "api", origin = null } = {}) => {
                pushLog({
                    level, message: String(message), source, origin,
                    relatedToBSR: true, inclusionReason: "manual API capture"
                });
            }
        });
    }
});
