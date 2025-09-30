Hooks.on("ready", () => {
  console.log(game.i18n.localize("BLINDSKILLROLLS.Module.Ready"));

  const isEnabled    = () => game.settings.get("blind-skill-rolls", "enabled");
  const blindAll     = () => game.settings.get("blind-skill-rolls", "blindAll");
  const isSkillBlind = (skillId) => blindAll() || game.settings.get("blind-skill-rolls", skillId);

  const forceBlind = (config, skillId) => {
    if (!isEnabled() || !skillId || !isSkillBlind(skillId)) return;
    config.rollMode = CONST.DICE_ROLL_MODES.BLIND;
    const label = CONFIG.DND5E.skills?.[skillId]?.label ?? skillId;
    console.debug(game.i18n.format("BLINDSKILLROLLS.Debug.SetRollMode", { skill: label }));

    Hooks.once("renderApplicationV2", (app, html) => {
      const root = html instanceof HTMLElement ? html : app.element ?? null;
      const select = root?.querySelector?.('select[name="rollMode"]');
      if (select) {
        select.value = CONST.DICE_ROLL_MODES.BLIND;
        select.dispatchEvent(new Event("change"));
      }
    });
  };

  Hooks.on("dnd5e.preRollSkillV2", (config) => {
    const skillId = config?.skill ?? config?.skillId ?? config?.abilitySkill;
    forceBlind(config, skillId);
  });

  Hooks.on("dnd5e.preRollSkill", (actor, skillId, options) => {
    if (!isEnabled()) return;
    if (isSkillBlind(skillId)) options.rollMode = CONST.DICE_ROLL_MODES.BLIND;
  });

  Hooks.on("preCreateChatMessage", (doc, data) => {
    if (!isEnabled()) return;
    const d5e = data.flags?.dnd5e ?? {};
    const skillId = d5e?.roll?.skillId ?? d5e?.skillId ?? d5e?.skill;
    if (!skillId || !isSkillBlind(skillId)) return;

    const gmIds = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
    data.blind = true;
    data.whisper = gmIds;
    data.rollMode = CONST.DICE_ROLL_MODES.BLIND;
  });
});

