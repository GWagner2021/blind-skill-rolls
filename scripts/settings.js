Hooks.on("init", () => {
  console.log(game.i18n.localize("BLINDSKILLROLLS.Module.Init"));

  // Global ON/OFF
  game.settings.register("blind-skill-rolls", "enabled", {
    name: game.i18n.localize("BLINDSKILLROLLS.Settings.Enabled.Name"),
    hint: game.i18n.localize("BLINDSKILLROLLS.Settings.Enabled.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // All blind by default
  game.settings.register("blind-skill-rolls", "blindAll", {
    name: game.i18n.localize("BLINDSKILLROLLS.Settings.BlindAll.Name"),
    hint: game.i18n.localize("BLINDSKILLROLLS.Settings.BlindAll.Hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
  
// Singele skills
  const defaultBlindSkills = [
    "arc","dec","his","ins","inv","med","nat","prc","per","rel","slt","ste","sur"
  ];

  for (const [key, skill] of Object.entries(CONFIG.DND5E.skills)) {
    game.settings.register("blind-skill-rolls", key, {
      name: skill.label,
      scope: "world",
      config: true,
      type: Boolean,
      default: defaultBlindSkills.includes(key)
    });
  }
});
