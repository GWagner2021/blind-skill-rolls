// scripts/bsr-troubleshooter.js
(() => {
  "use strict";

  const MOD = "blind-skill-rolls";
  const FILE_NAME = "fvtt-bsr-troubleshooter.json";

  const KNOWN_COMPAT_MODULES = Object.freeze([
    "blind-skill-rolls",
    "lib-wrapper",
    "midi-qol",
    "dice-so-nice",
    "combat-tracker-dock"
  ]);

  const MODULE_ALIASES = Object.freeze(new Map([
    ["blind-skill-rolls", ["blind skill rolls", "bsr"]],
    ["midi-qol", ["midi qol", "midiqol"]],
    ["dice-so-nice", ["dicesonice"]],
    ["lib-wrapper", ["libwrapper"]],
    ["combat-tracker-dock", []]
  ]));

  // -----------------------------
  // Debug mode (client setting)
  // -----------------------------
  globalThis.BSR_DEBUG_MODE ??= "none";

  const BSR_DEBUG_LEVELS = Object.freeze({
    none: 0,
    info: 1,
    warnings: 2,
    debug: 3,
    all: 4
  });

  const bsrNormalizeDebugMode = (v) => {
    const m = String(v ?? "none").toLowerCase();
    return Object.prototype.hasOwnProperty.call(BSR_DEBUG_LEVELS, m) ? m : "none";
  };

  const bsrDebugLevel = () => BSR_DEBUG_LEVELS[bsrNormalizeDebugMode(globalThis.BSR_DEBUG_MODE)];

  const bsrApplyDebugMode = (mode) => {
    const m = bsrNormalizeDebugMode(mode);
    globalThis.BSR_DEBUG_MODE = m;
    return m;
  };

  // Public helpers
  globalThis.BSR_setDebugMode ??= bsrApplyDebugMode;
  globalThis.BSR_getDebugMode ??= () => bsrNormalizeDebugMode(globalThis.BSR_DEBUG_MODE);
  globalThis.BSR_getDebugLevel ??= () => bsrDebugLevel();
  globalThis.BSR_isDebugAtLeast ??= (mode) =>
    bsrDebugLevel() >= BSR_DEBUG_LEVELS[bsrNormalizeDebugMode(mode)];

  // Logging helpers
  globalThis.dbgWarn ??= (...args) => {
    if (bsrDebugLevel() >= BSR_DEBUG_LEVELS.warnings) {
      console.warn(...args);
      try {
        const combined = args.map(normalizeToString).join(" ");
        pushLog({ level: "warn", message: combined, source: "bsr.debug", origin: MOD });
      } catch {}
    }
  };
  globalThis.dbgInfo ??= (...args) => {
    if (bsrDebugLevel() >= BSR_DEBUG_LEVELS.info) console.info(...args);
  };
  globalThis.dbgDebug ??= (...args) => {
    if (bsrDebugLevel() >= BSR_DEBUG_LEVELS.debug) console.debug(...args);
  };
  globalThis.dbgAll ??= (...args) => {
    if (bsrDebugLevel() >= BSR_DEBUG_LEVELS.all) console.log(...args);
  };

  // -----------------------------
  // Helpers
  // -----------------------------
  const safeGetSetting = (namespace, key, fallback = null) => {
    try {
      return game.settings.get(namespace, key);
    } catch {
      return fallback;
    }
  };

  const safeJson = (value) => {
    if (value === undefined) return null;
    if (value === null) return null;
    const t = typeof value;
    if (t === "string" || t === "number" || t === "boolean") return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      try {
        return String(value);
      } catch {
        return "<unserializable>";
      }
    }
  };

  const stringifyVal = (v) => {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "string") return v;
    try {
      return JSON.stringify(v);
    } catch {
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

  const getModuleVersion = (id) => {
    const m = game.modules?.get(id);
    return m?.version ?? null;
  };

  const getInstalledModules = () => {
    try {
      return Array.from(game.modules?.values?.() ?? [])
        .map((m) => ({
          id: m.id,
          title: m.title ?? m.id,
          version: m.version ?? null,
          active: !!m.active,
          compatibility: safeJson(m.compatibility ?? null)
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
    } catch {
      return [];
    }
  };

  const getBsrSettingsDump = () => {
    const out = [];
    try {
      const all = game.settings?.settings;
      if (!all) return out;

      for (const [, setting] of all.entries()) {
        if (!setting || setting.namespace !== MOD) continue;
        const key = setting.key;
        const value = safeGetSetting(MOD, key, "<unreadable>");
        out.push({
          key,
          value: safeJson(value),
          scope: setting.scope,
          config: !!setting.config,
          restricted: !!setting.restricted,
          type: setting.type?.name ?? typeof value
        });
      }

      out.sort((a, b) => a.key.localeCompare(b.key));
      return out;
    } catch {
      return out;
    }
  };

  // -----------------------------
  // Settings display: readable names + grouping
  // -----------------------------
  const SKILL_KEYS = new Set([
    "acr", "ani", "arc", "ath", "dec", "his", "ins", "itm", "inv",
    "med", "nat", "prc", "per", "prf", "rel", "slt", "ste", "sur"
  ]);

  const getSkillLabel = (key) => {
    try {
      const entry = CONFIG?.DND5E?.skills?.[key];
      return entry?.label ?? null;
    } catch {
      return null;
    }
  };

  const getAbilityLabel = (key) => {
    try {
      const entry = CONFIG?.DND5E?.abilities?.[key];
      return entry?.label ?? null;
    } catch {
      return null;
    }
  };

  const localizeMaybe = (s) => {
    if (!s || typeof s !== "string") return s;
    try {
      const loc = game.i18n?.localize?.(s);
      return loc && loc !== s ? loc : s;
    } catch {
      return s;
    }
  };

  const getSettingMeta = (key) => {
    try {
      return game.settings?.settings?.get(`${MOD}.${key}`) ?? null;
    } catch {
      return null;
    }
  };

  const stripPrivateSuffix = (k) => k.replace(/_private$/, "");

  const displayNameForSetting = (key) => {
    const k = String(key ?? "");
    const lower = k.toLowerCase();

    // Save keys: extract ability name from save_{ability} or save_{ability}_private
    if (lower.startsWith("save_")) {
      const abilityKey = stripPrivateSuffix(lower.replace(/^save_/, ""));
      const label = getAbilityLabel(abilityKey);
      if (label) return localizeMaybe(label);
    }

    // Skill keys: strip _private suffix to get base skill label
    const baseSkill = stripPrivateSuffix(lower);
    if (SKILL_KEYS.has(baseSkill)) return getSkillLabel(baseSkill) ?? baseSkill;

    const meta = getSettingMeta(k);
    const rawName = meta?.name ?? null;
    if (rawName) return localizeMaybe(rawName);

    return `${MOD}.${k}`;
  };

  const groupNameForSetting = (key) => {
    const k = String(key ?? "").toLowerCase();

    // Skills: split blind vs private
    const baseSkill = stripPrivateSuffix(k);
    if (SKILL_KEYS.has(baseSkill)) {
      return k.endsWith("_private") ? "Skills Private" : "Skills Blind";
    }
    if (k.startsWith("skill")) {
      return k.endsWith("_private") ? "Skills Private" : "Skills Blind";
    }

    // Saves: split blind vs private
    if (k.startsWith("save_")) {
      return k.endsWith("_private") ? "Saving Throws Private" : "Saving Throws Blind";
    }

    // Fast Forward: split GM vs Player
    if (k.startsWith("ff")) {
      return k.startsWith("ffplayer") ? "Fast Forward Player" : "Fast Forward GM";
    }

    if (k.startsWith("death") || k.includes("deathsave")) return "Death Saves";

    // Chat Display & Privacy (includes NPC masking settings)
    if (k === "hideforeignsecrets" || k === "muteforeignsecretsounds" ||
        k === "bsrsanitizepublicgm" || k === "bsrtrustedseedetails" ||
        k.includes("npc") || k.includes("reveal")) {
      return "Chat Display & Privacy";
    }

    // Other BSR Settings (debug, sync notifications, theme)
    if (k.startsWith("debug") || k === "showsyncmessages" || k === "bsrtheme") {
      return "Other BSR Settings";
    }

    if (k.startsWith("dsn") || k.includes("dicesonice") || k.includes("ghost")) return "Dice So Nice";

    return "Other";
  };

  const groupOrder = [
    "Skills Blind",
    "Skills Private",
    "Saving Throws Blind",
    "Saving Throws Private",
    "Death Saves",
    "Fast Forward GM",
    "Fast Forward Player",
    "Chat Display & Privacy",
    "Other BSR Settings",
    "Dice So Nice",
    "Other"
  ];

  // Metadata for group header display (label + colored tag)
  const GROUP_META = Object.freeze({
    "Skills Blind": { label: "Skills", tag: "Blind" },
    "Skills Private": { label: "Skills", tag: "Private" },
    "Saving Throws Blind": { label: "Saving Throws", tag: "Blind" },
    "Saving Throws Private": { label: "Saving Throws", tag: "Private" },
    "Fast Forward GM": { label: "Fast Forward", tag: "GM" },
    "Fast Forward Player": { label: "Fast Forward", tag: "Player" }
  });

  // Groups that should be displayed side-by-side
  const PAIRED_GROUPS = Object.freeze([
    ["Skills Blind", "Skills Private"],
    ["Saving Throws Blind", "Saving Throws Private"],
    ["Fast Forward GM", "Fast Forward Player"]
  ]);

  // Setting keys shown as per-column headers above each paired group
  const PAIRED_HEADER_KEYS = Object.freeze({
    "Skills Blind": { left: "enabled", right: "blindRollersChat" },
    "Saving Throws Blind": { left: "savesEnabled", right: "blindRollersSaveChat" }
  });
  const HEADER_KEY_SET = new Set(
    Object.values(PAIRED_HEADER_KEYS).flatMap(v => [v.left, v.right]).filter(Boolean)
  );

  const getPath = (obj, path) => {
    if (!obj) return undefined;
    const parts = String(path).split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  };

  const firstDefined = (obj, paths) => {
    for (const p of paths) {
      const v = getPath(obj, p);
      if (v !== undefined) return v;
    }
    return undefined;
  };

  const buildMidiSummaryRows = () => {
    const rows = [];
    const midiActive = !!game.modules?.get("midi-qol")?.active;
    if (!midiActive) return rows;

    const enableWorkflow = safeGetSetting("midi-qol", "EnableWorkflow", undefined);
    rows.push({
      label: "Enable Roll Automation Support (Client Setting)",
      value: enableWorkflow === undefined ? "unknown" : stringifyVal(enableWorkflow)
    });

    const cfg = safeGetSetting("midi-qol", "ConfigSettings", null);

    const gmFastForward = firstDefined(cfg, [
      "gmAutoFastForwardRolls",
      "gmAutoFastForwardAbilityRolls",
      "gmAutoFastForwardAbility",
      "gmAutoFastForward",
      "gm.autoFastForwardRolls",
      "gm.autoFastForwardAbilityRolls",
      "workflow.gm.autoFastForwardRolls",
      "workflow.gm.autoFastForwardAbilityRolls"
    ]);

    rows.push({
      label: "GM: Auto fast forward rolls",
      value: gmFastForward === undefined ? "unknown" : stringifyVal(gmFastForward)
    });

    const playerFastForward = firstDefined(cfg, [
      "autoFastForward",
      "autoFastForwardRolls",
      "autoFastForwardAbilityRolls",
      "playerAutoFastForwardRolls",
      "playerAutoFastForwardAbilityRolls",
      "player.autoFastForwardRolls",
      "workflow.player.autoFastForwardRolls"
    ]);

    rows.push({
      label: "Player: Auto fast forward rolls",
      value: playerFastForward === undefined ? "unknown" : stringifyVal(playerFastForward)
    });

    const rollSkillsBlind = firstDefined(cfg, [
      "rollSkillsBlind",
      "workflow.rollSkillsBlind",
      "blind.rollSkillsBlind"
    ]);

    rows.push({
      label: "Which skill checks are rolled blind",
      value: rollSkillsBlind === undefined ? "unknown" : stringifyVal(rollSkillsBlind)
    });

    return rows;
  };

  const LOG_MAX = 250;
  const logBuffer = [];

  const normalizeToString = (v) => {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "string") return v;
    if (v instanceof Error) return `${v.message}\n${v.stack ?? ""}`.trim();
    try {
      return JSON.stringify(v);
    } catch {
      try {
        return String(v);
      } catch {
        return "<unprintable>";
      }
    }
  };

  const classifyOrigin = (filename, stack) => {
    const sources = [filename, stack].filter(Boolean).join("\n").toLowerCase();
    for (const id of KNOWN_COMPAT_MODULES) {
      if (sources.includes(`modules/${id}/`)) return id;
    }
    return null;
  };

  const findMentionedModule = (text) => {
    if (!text) return null;
    const t = String(text).toLowerCase();
    for (const id of KNOWN_COMPAT_MODULES) {
      if (t.includes(id)) return id;
    }
    for (const [id, aliases] of MODULE_ALIASES) {
      for (const alias of aliases) {
        if (t.includes(alias)) return id;
      }
    }
    return null;
  };

  const pushLog = ({ level, message, stack = null, source = "console", origin = null }) => {
    const entry = {
      time: new Date().toISOString(),
      level,
      source,
      message,
      stack,
      origin
    };
    logBuffer.unshift(entry);
    if (logBuffer.length > LOG_MAX) logBuffer.length = LOG_MAX;
  };

  const WRAP_FLAG = "__BSR_TS_CONSOLE_WRAPPED__";
  if (!globalThis[WRAP_FLAG]) {
    globalThis[WRAP_FLAG] = true;

    window.addEventListener("error", (ev) => {
      try {
        const err = ev?.error;
        const msg = err?.message ?? ev?.message ?? "Unknown error";
        const filename = ev?.filename ?? "";
        const where = filename ? `${filename}:${ev.lineno}:${ev.colno}` : "";
        const combined = `${msg}${where ? ` (${where})` : ""}`;
        const stack = err?.stack ?? null;

        const origin = classifyOrigin(filename, stack)
          ?? findMentionedModule(combined)
          ?? findMentionedModule(stack);
        if (origin) {
          pushLog({ level: "error", message: combined, stack, source: "window.error", origin });
        }
      } catch {}
    });

    window.addEventListener("unhandledrejection", (ev) => {
      try {
        const reason = ev?.reason;
        const msg = reason?.message ?? String(reason ?? "Unhandled promise rejection");
        const stack = reason?.stack ?? null;

        const origin = classifyOrigin(null, stack)
          ?? findMentionedModule(msg)
          ?? findMentionedModule(stack);
        if (origin) {
          pushLog({
            level: "error",
            message: msg,
            stack,
            source: "window.unhandledrejection",
            origin
          });
        }
      } catch {}
    });

  }

  const clearLog = () => {
    logBuffer.length = 0;
  };

  // -----------------------------
  // JSON report
  // -----------------------------
  const buildReportObject = () => {
    const now = new Date().toISOString();

    const self = game.modules?.get(MOD);
    const moduleInfo = {
      id: MOD,
      title: self?.title ?? MOD,
      version: self?.version ?? null
    };

    const installedModules = getInstalledModules();
    const bsrSettings = getBsrSettingsDump();

    let midiQol = null;
    if (!!game.modules?.get("midi-qol")?.active) {
      midiQol = {
        version: getModuleVersion("midi-qol"),
        enableWorkflow: safeJson(safeGetSetting("midi-qol", "EnableWorkflow", null)),
        configSettings: safeJson(safeGetSetting("midi-qol", "ConfigSettings", null))
      };
    }

    return {
      schema: "bsr.troubleshooter",
      schemaVersion: 1,
      generatedAt: now,
      module: moduleInfo,
      core: {
        foundryVersion: game.version ?? null,
        build: safeJson(game.build ?? null),
        release: safeJson(game.release ?? null)
      },
      system: {
        id: game.system?.id ?? null,
        title: game.system?.title ?? null,
        version: game.system?.version ?? null
      },
      world: {
        id: game.world?.id ?? null,
        title: game.world?.title ?? null
      },
      user: {
        id: game.user?.id ?? null,
        name: game.user?.name ?? null,
        isGM: !!game.user?.isGM,
        isActiveGM: !!game.user?.isActiveGM
      },
      browser: {
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null
      },
      bsrSettings,
      midiQol,
      modules: installedModules,
      capturedLogs: safeJson(logBuffer)
    };
  };

  // -----------------------------
  // ApplicationV2 UI
  // -----------------------------
  const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

  class BsrTroubleshooterApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
      id: "bsr-troubleshooter",
      classes: ["bsr-ts"],
      window: { title: "Troubleshooter", resizable: true },
      position: { width: 960, height: 640 }
    };

    static PARTS = {
      main: { template: `modules/${MOD}/templates/bsr-troubleshooter.hbs` }
    };

    #activeTab = "summary";

    async _prepareContext(_options) {
      const report = buildReportObject();
      const modules = report.modules ?? [];

      const allModulesRows = modules
        .map((m) => ({
          id: m.id,
          title: m.title,
          active: !!m.active,
          version: m.version ?? "",
          foundry: m.compatibility?.verified ?? m.compatibility?.minimum ?? ""
        }))
        .sort((a, b) => {
          if (a.active !== b.active) return a.active ? -1 : 1;

          const at = (a.title ?? "").toLowerCase();
          const bt = (b.title ?? "").toLowerCase();
          if (at !== bt) return at.localeCompare(bt);

          return (a.id ?? "").localeCompare(b.id ?? "");
        });

      const grouped = {};
      const headerItems = {};
      for (const s of report.bsrSettings ?? []) {
        if (HEADER_KEY_SET.has(s.key)) {
          headerItems[s.key] = { name: displayNameForSetting(s.key), value: stringifyVal(s.value) };
          continue;
        }
        const group = groupNameForSetting(s.key);
        (grouped[group] ??= []).push({
          name: displayNameForSetting(s.key),
          value: stringifyVal(s.value)
        });
      }

      const bsrSettingsGroups = Object.entries(grouped)
        .sort((a, b) => {
          const ai = groupOrder.indexOf(a[0]);
          const bi = groupOrder.indexOf(b[0]);
          if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          return a[0].localeCompare(b[0]);
        })
        .map(([group, items]) => ({
          group,
          items: items.sort((x, y) => x.name.localeCompare(y.name))
        }));

      // Build paired/single layout for side-by-side rendering
      const pairedLeftSet = new Set(PAIRED_GROUPS.map(p => p[0]));
      const pairedRightSet = new Set(PAIRED_GROUPS.map(p => p[1]));
      const pairMap = Object.fromEntries(PAIRED_GROUPS);
      const processed = new Set();

      const settingsLayout = [];
      for (const g of bsrSettingsGroups) {
        if (processed.has(g.group)) continue;
        processed.add(g.group);

        const meta = GROUP_META[g.group] ?? { label: g.group, tag: null };

        if (pairedLeftSet.has(g.group)) {
          const rightName = pairMap[g.group];
          const right = bsrSettingsGroups.find(x => x.group === rightName);
          processed.add(rightName);

          const rightMeta = GROUP_META[rightName] ?? { label: rightName, tag: null };

          // Collect per-column header settings for this pair
          const hdrDef = PAIRED_HEADER_KEYS[g.group];
          const leftHeader = hdrDef ? headerItems[hdrDef.left] ?? null : null;
          const rightHeader = hdrDef ? headerItems[hdrDef.right] ?? null : null;

          settingsLayout.push({
            paired: true,
            left: { headerItem: leftHeader, label: meta.label, tag: meta.tag, items: g.items },
            right: right
              ? { headerItem: rightHeader, label: rightMeta.label, tag: rightMeta.tag, items: right.items }
              : null
          });
        } else if (!pairedRightSet.has(g.group)) {
          settingsLayout.push({
            paired: false,
            group: { label: meta.label, tag: meta.tag, items: g.items }
          });
        }
      }

      const summaryRows = [
        { label: "Foundry Version", value: report.core?.foundryVersion ?? "" },
        { label: "System", value: `${report.system?.id ?? ""} ${report.system?.version ?? ""}`.trim() },
        { label: "BSR Version", value: report.module?.version ?? "" },
        {
          label: "Module Count",
          value: `Active: ${modules.filter((m) => m.active).length} | Installed: ${modules.length}`
        }
      ];

      const midiSettingsRows = buildMidiSummaryRows();

      const problemsRows = (logBuffer ?? []).map((e) => ({
        time: e.time,
        level: e.level,
        source: e.source,
        message: e.message,
        stack: e.stack,
        origin: e.origin ?? "unknown"
      }));

      return {
        activeTab: this.#activeTab,
        summaryRows,
        settingsLayout,
        midiSettingsRows,
        problemsRows,
        allModulesRows,
        reportJson: JSON.stringify(report, null, 2)
      };
    }

    _onRender(_context, _options) {
      super._onRender(_context, _options);
      const root = this.element;
      if (!root) return;

      root.querySelectorAll("[data-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.#activeTab = btn.dataset.tab;
          this.render({ force: true });
        });
      });

      root.querySelector("[data-action='reload']")?.addEventListener("click", () => {
        this.render({ force: true });
      });

      root.querySelector("[data-action='clearLog']")?.addEventListener("click", () => {
        clearLog();
        ui.notifications.info("Troubleshooter log cleared.");
        this.render({ force: true });
      });

      root.querySelector("[data-action='export']")?.addEventListener("click", () => {
        const json = root.querySelector("textarea[data-json]")?.value;
        if (json) downloadJsonText(json);
        else downloadJson(buildReportObject());
      });
    }

    static open() {
      new BsrTroubleshooterApp().render({ force: true });
    }
  }

  Hooks.once("init", () => {
    const L = (k, fb) => {
      try {
        const t = game.i18n?.localize?.(k);
        return t && t !== k ? t : (fb ?? k);
      } catch {
        return fb ?? k;
      }
    };

    try {
      game.settings.register(MOD, "debugMode", {
        name: L("BSR.Settings.DebugMode.Name", "Debug mode"),
        hint: L("BSR.Settings.DebugMode.Hint", "Controls how much BSR writes to the browser console."),
        scope: "client",
        config: true,
        restricted: false,
        type: String,
        choices: {
          none: L("BSR.Settings.DebugMode.None", "None"),
          info: L("BSR.Settings.DebugMode.Info", "Info"),
          warnings: L("BSR.Settings.DebugMode.Warnings", "Warnings"),
          debug: L("BSR.Settings.DebugMode.Debug", "Debug"),
          all: L("BSR.Settings.DebugMode.All", "All")
        },
        default: "none",
        onChange: (value) => {
          try {
            globalThis.BSR_setDebugMode?.(value);
          } catch {}
        }
      });
    } catch (e) {
      globalThis.dbgWarn?.("[BSR]", "Failed to register debug mode setting:", e);
    }

    try {
      game.settings.registerMenu(MOD, "troubleshooter", {
        name: "Troubleshooter",
        label: "Open Troubleshooter",
        hint: "Generate a troubleshooting report (JSON export) and show BSR/MidiQOL related warn/error output.",
        icon: "fas fa-stethoscope",
        restricted: true,
        type: BsrTroubleshooterApp
      });
    } catch (e) {
      globalThis.dbgWarn?.("BSR | Failed to register troubleshooter menu:", e);
    }
  });

  Hooks.once("ready", () => {
    try {
      const v = game.settings.get(MOD, "debugMode");
      globalThis.BSR_setDebugMode?.(v);
    } catch {}
  });

  globalThis.BSR_TROUBLESHOOTER = {
    open: () => BsrTroubleshooterApp.open(),
    export: () => downloadJson(buildReportObject()),
    clearLog,
    buildReportObject,
    capture: ({ level = "warn", message = "", source = "api", origin = null } = {}) => {
      pushLog({ level, message: String(message), source, origin });
    }
  };
})();
