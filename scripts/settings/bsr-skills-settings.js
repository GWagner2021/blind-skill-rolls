// scripts/settings/bsr-skills-settings.js
(() => {
  "use strict";
  const MOD = "blind-skill-rolls";

  const L = (k, fb) => {
    try { const t = game?.i18n?.localize?.(k); return (t && t !== k) ? t : (fb ?? k); }
    catch { return fb ?? k; }
  };

  const coerceEl = (html) => html?.[0] ?? html;
  const setMany = async (pairs) => {
    for (const [k, v] of pairs) await game.settings.set(MOD, k, v);
  };
  const openDialog = ({ title, content, buttons }) => {
    new Dialog({ title, content, buttons, default: "save" }, {
      width: 640, height: "auto", resizable: true
    }).render(true);
  };

  Hooks.once("init", () => {
    game.settings.register(MOD, "enabled", {
      name: L("BLINDSKILLROLLS.Settings.Enabled.Name","Enable Blind Skill Rolls"),
      scope: "world", config: false, restricted: true, type: Boolean, default: true
    });
  });

  function registerSkillSettings() {
    try {
      const skills = CONFIG?.DND5E?.skills;
      if (!skills) return false;

      const defaults = ["arc","dec","his","ins","inv","med","nat","prc","per","rel","slt","ste","sur"];
      for (const [key, skill] of Object.entries(skills)) {
        game.settings.register(MOD, key, {
          name: skill.label || key.toUpperCase(),
          scope: "world",
          config: false,
          type: Boolean,
          default: defaults.includes(key)
        });
      }
      return true;
    } catch (e) {
      console.error("blind-skill-rolls | Failed to register skill settings:", e);
      return false;
    }
  }
  if (!registerSkillSettings()) Hooks.once("ready", registerSkillSettings);

  class BSRMenuSkills extends FormApplication {
    render() {
      const skills = CONFIG?.DND5E?.skills ?? {};
      const entries = Object.entries(skills)
        .map(([k, v]) => ({ key: k, label: v.label, val: game.settings.get(MOD, k) }))
        .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang || "en"));

      const enabled = game.settings.get(MOD, "enabled");
      const defaults = new Set(["arc","dec","his","ins","inv","med","nat","prc","per","rel","slt","ste","sur"]);

      const content = `
        <form class="bsr-form" style="min-width: 580px; padding-right:.25rem;">
          <fieldset style="margin-bottom: 12px;">
            <legend>${L("BSR.SettingsGroup.Skills.Legend","Blind Skill Rolls")}</legend>
            <label style="display:flex; gap:.5rem; align-items:center;">
              <input type="checkbox" name="enabled" ${enabled ? "checked":""}>
              <span>${L("BLINDSKILLROLLS.Settings.Enabled.Name","Enable Blind Skill Rolls")}</span>
            </label>
            <p style="margin:.35rem 0 0; color: var(--color-text-dark-secondary);">
              ${L("BSR.SettingsGroup.Skills.Hint","Choose which skills should be forced to Blind GM Roll.")}
            </p>
          </fieldset>

          <div style="display:flex; justify-content:space-between; align-items:center; margin:.5rem 0;">
            <strong>${L("BSR.UI.Skills","Skills")}</strong>
            <div style="display:flex; gap:.5rem;">
              <button type="button" data-action="all">${L("BSR.UI.All","All")}</button>
              <button type="button" data-action="none">${L("BSR.UI.None","None")}</button>
              <button type="button" data-action="defaults">${L("BSR.UI.Defaults","Defaults")}</button>
            </div>
          </div>

          <div class="grid" style="display:grid; grid-template-columns:repeat(3,1fr); gap:.35rem .75rem;">
            ${entries.map(e => `
              <label style="display:flex; gap:.5rem; align-items:center;">
                <input type="checkbox" data-skill="${e.key}" ${e.val ? "checked":""}>
                <span>${e.label}</span>
              </label>
            `).join("")}
          </div>
        </form>
      `;

      openDialog({
        title: L("BSR.Menu.Skills.Name","Configure Blind Skill Rolls"),
        content,
        buttons: {
          cancel: { label: L("BSR.UI.Cancel","Cancel") },
          save: {
            label: L("BSR.UI.Save","Save"),
            callback: async (html) => {
              const root = coerceEl(html);
              const form = root.querySelector("form");
              const en = form.querySelector('input[name="enabled"]').checked;
              const pairs = [["enabled", en]];
              form.querySelectorAll('input[type="checkbox"][data-skill]').forEach(i => {
                pairs.push([i.dataset.skill, i.checked]);
              });
              await setMany(pairs);
            }
          }
        }
      });

      Hooks.once("renderDialog", (_dlg, htmlEl) => {
        const root = coerceEl(htmlEl);
        root.querySelector('[data-action="all"]')?.addEventListener("click", () => {
          root.querySelectorAll('input[data-skill]').forEach(i => i.checked = true);
        });
        root.querySelector('[data-action="none"]')?.addEventListener("click", () => {
          root.querySelectorAll('input[data-skill]').forEach(i => i.checked = false);
        });
        root.querySelector('[data-action="defaults"]')?.addEventListener("click", () => {
          root.querySelectorAll('input[data-skill]').forEach(i => {
            i.checked = defaults.has(i.dataset.skill);
          });
        });
      });

      return this;
    }
  }

  Hooks.once("init", () => {
    game.settings.registerMenu(MOD, "menuSkills", {
      name:  L("BSR.Menu.Skills.Name","Configure Blind Skill Rolls"),
      label: L("BSR.Menu.Skills.Label","enable/disable specific skills"),
      icon:  "fa-solid fa-sliders",
      type:  BSRMenuSkills,
      restricted: true
    });
  });
})();
