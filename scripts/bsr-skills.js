//scripts/blind-skill-rolls.js
(() => {

    const MODULE_ID = "blind-skill-rolls";

    Hooks.on("diceSoNiceReady", () => {
      const dice3d = game.dice3d;
      if (!dice3d) return;

      if (dice3d._bsrShowWrapped) return;
      dice3d._bsrShowWrapped = true;

      const originalShow = dice3d.show;

      dice3d.show = function (data, user, synchronize, users, blind) {

        const isHiddenRoll =
          blind === true ||
          (Array.isArray(users) && !users.includes("all"));
        if (isHiddenRoll && data && typeof data === "object") {
          data._blindSkillRolls = {
            rollerId: user?.id,
            allowedUsers: users ?? null
          };
        }

        return originalShow.call(this, data, user, synchronize, users, blind);
      };


    });

    Hooks.on("diceSoNiceReady", () => {
      const dice3d = game.dice3d;
      if (!dice3d) return;

      if (dice3d._bsrAnimWrapped) return;
      dice3d._bsrAnimWrapped = true;

      const originalShowAnimation = dice3d._showAnimation;

      dice3d._showAnimation = function (notation, config) {
        const meta = notation && notation._blindSkillRolls;

        if (meta) {
          const userId = game.user?.id;
          const isGM = game.user?.isGM === true;

          if (userId === meta.rollerId) {
            return originalShowAnimation.call(this, notation, config);
          }

          if (isGM) {
            return originalShowAnimation.call(this, notation, config);
          }

          return Promise.resolve(false);
        }

        return originalShowAnimation.call(this, notation, config);
      };

      console.log(`${MODULE_ID} | Invisible dice enforcement active`);
    });

  })();
(() => {
    "use strict";

    const MOD   = "blind-skill-rolls";
    const BLIND = CONST.DICE_ROLL_MODES.BLIND;
    const skillIdList = {
      Acrobatics: "acr",
      AnimalHandling: "ani",
      Arcana:  "arc",
      Athletics: "ath",
      Deception: "dec",
      History: "his",
      Insight: "ins",
      Investigation: "inv",
      Intimidation: "itm",
      Medicine: "med",
      Nature: "nat",
      Persuasion: "per",
      Perception: "prc",
      Performance: "prf",
      Religion: "rel",
      SleightofHand: "slt",
      Stealth: "ste",
      Survival: "sur"

    }

    //Death Saves
    window.bsr_deathSavesEventTarget = null;
    window.bsr_deathSaveRollisAlreadyBlind = false;
    window.bsr_deathSaveMSKCSC = false;
    window.bsr_deathSaveIsScheduledRoll = false;
    let isDeathSave0 = false;
    let shouldResetDsState = false;

    //Force Blind skills
    window.skillEventTarget = null;
    window.bsr_skillRollisAlreadyBlind = false;
    window.bsr_skillRollMSKCSC = false;
    window.bsr_skillRollScheduledRoll = false;
    let shouldResetFbsState = false;

    //Shared --
    let activeRoll = 0;
    window.worldRollMode = null;

  function makeBlind(eventTarget,caller){

      if(bsr_deathSavesEventTarget != null && caller == 2){
        bsr_deathSaveIsScheduledRoll = true;
        eventTarget.click();
        shouldResetDsState = true;
      }
      if(skillEventTarget != null && caller == 1){
       bsr_skillRollScheduledRoll = true;
       eventTarget.click();
       shouldResetFbsState = true;
     }
    }

  function resetDsrState(){
    window.bsr_deathSavesEventTarget = null;
    window.bsr_deathSaveIsScheduledRoll = false;
    window.bsr_deathSaveMSKCSC = false;
    window.bsr_deathSaveIsScheduledRoll = false;
    isDeathSave0 = false;
    let wRM = window.worldRollMode;
    game.settings.get('core', 'rollMode');
    game.settings.set("core","rollMode",wRM);

  }

  function resetFbState(){
    window.skillEventTarget = null;
    window.bsr_skillRollScheduledRoll = false;
    window.bsr_skillRollMSKCSC = false;
    window.bsr_skillRollScheduledRoll = false;
    let wRM = window.worldRollMode;
    game.settings.get('core', 'rollMode');
    game.settings.set("core","rollMode",wRM);


  }

  window.addEventListener("click",(event) => {

    let skillLabel = event.target.innerText;
    if(skillLabel.length >= 2){
        let skill = skillLabel.replaceAll(" ","");
        let isBlindSkill = false;
        let skillId_ = "";
        if(skill in skillIdList){
          skillId_ = skillIdList[skill];
          isBlindSkill = game.settings.get(MOD,skillId_);
          if(isBlindSkill){
            window.skillEventTarget = event.target;
            makeBlind(event.target,1);
          }
        }
      }
      if(isDeathSave0 && event.target.classList.contains("death-save")){

            window.bsr_deathSavesEventTarget = event.target;
            makeBlind(event.target,2);
          }
    });

  Hooks.once("ready", () => {
    window.worldRollMode = game.settings.get('core', 'rollMode');

  });

  Hooks.on("dnd5e.preRollSkill", (config, dialog, message) => {
       console.log("DND5e preRollSkill-----------------------------------------");
       let skillid_ = config["skill"];
       let isBlindSkill = game.settings.get(MOD,skillid_);

       if(isBlindSkill && window.bsr_skillRollScheduledRoll && bsr_skillRollScheduledRoll){

         return true;
       }

       if(isBlindSkill && !bsr_skillRollScheduledRoll){

         window.bsr_skillRollMSKCSC = true;
         activeRoll = 1;
         game.settings.get('core', 'rollMode');
         game.settings.set("core","rollMode","blindroll");


         return false;
       }


       if(!isBlindSkill){

         return true;
       }

     });

  Hooks.on("dnd5e.preRollDeathSave", (config, dialog, message) => {
        let deathSavesMode = game.settings.get("blind-skill-rolls","bsrDeathSavesMode");
        let isDeathSave = message.data.flavor === "Death Saving Throw";

        if(isDeathSave && window.bsr_deathSaveIsScheduledRoll){
          return true;
        }

        if(isDeathSave && !bsr_deathSaveIsScheduledRoll){
            window.bsr_deathSaveMSKCSC = true;
            if(deathSavesMode === "blindroll"){
              activeRoll = 2;
              game.settings.get('core', 'rollMode');
              game.settings.set("core","rollMode","blindroll");
            }
            if(deathSavesMode === "privatroll"){
              activeRoll = 2;
              game.settings.get('core', 'rollMode');
              game.settings.set("core","rollMode","gmroll");
            }
            isDeathSave0 = true;

            return false;
          }

          if(!isDeathSave){

            return true;
          }


      });

  Hooks.on("clientSettingChanged", (key, value, options) => {
          let deathSavesMode = game.settings.get("blind-skill-rolls","bsrDeathSavesMode");

          if(bsr_deathSaveMSKCSC == true && deathSavesMode === "blindroll" && activeRoll == 2){
            game.settings.get('core', 'rollMode');
            game.settings.set("core","rollMode","blindroll");
            activeRoll == 0;
          }
          if(bsr_deathSaveMSKCSC == true && deathSavesMode === "privatroll" && activeRoll == 2){
            activeRoll == 0;
            game.settings.get('core', 'rollMode');
            game.settings.set("core","rollMode","gmroll");

          }
          if(bsr_deathSaveMSKCSC == false && activeRoll == 2){
            activeRoll == 0;
            window.worldRollMode = game.settings.get('core', 'rollMode');

          }

          if(bsr_skillRollMSKCSC == true && activeRoll == 1){
            activeRoll == 0;
             game.settings.get('core', 'rollMode');
             game.settings.set("core","rollMode","blindroll");

           }
          if(bsr_skillRollMSKCSC == false && activeRoll == 1){
             activeRoll == 0;
             window.worldRollMode = game.settings.get('core', 'rollMode');

          }

      });

  Hooks.on("diceSoNiceRollComplete",(messageId) => {

      if(shouldResetDsState){
        resetDsrState();
        shouldResetDsState = false;
      }
      if(shouldResetFbsState){
        resetFbState();
        shouldResetFbsState = false;

      }

    });

    Hooks.on("ready", () => {
      console.log(
        `------------------- %c${MOD}%c -------------------`,
        'color:#8B0000;font-weight:700;',
        'color:inherit;'
      );
      console.log(
        `%c${MOD}%c | Bilnd Skills ready`,
        'color:#8B0000;font-weight:700;',
        'color:inherit;'
      );

      //------------------------------------------------------------------------------
      Hooks.on("dnd5e.preRollSkillV2", (cfg) => {
        let testV = "123"
        console.log(
          `-------The value of sel: ---------- %c${cfg}%c -------------------`,
          `-------The value of sel: ---------- %c${testV}%c -------------------`,
          'color:#8B0088;font-weight:700;',
          'color:inherit;'
        );


       });
      //------------------------------------------------------------------------------

      const sget = (k, fb=false) => { try { return game.settings.get(MOD, k); } catch { return fb; } };
      const isEnabled = () => !!sget("enabled", false);
      const blindAll  = () => !!sget("blindAll", false);

      const isSkillBlind = (skillId) => {
        if (!isEnabled()) return false;
        if (blindAll()) return true;
        if (typeof skillId !== "string" || !skillId) return false;
        try { return !!game.settings.get(MOD, skillId); } catch { return false; }
      };

      const SELECT_VALUE = {
        [CONST.DICE_ROLL_MODES.PUBLIC]: "publicroll",
        [CONST.DICE_ROLL_MODES.GMROLL]:  "gmroll",
        [CONST.DICE_ROLL_MODES.BLIND]:   "blindroll",
        [CONST.DICE_ROLL_MODES.SELF]:    "selfroll"
      };

      
      const setRollConfigSelectBlind = (root) => {
            const el = root instanceof HTMLElement ? root : root?.[0];
            if (!(el instanceof HTMLElement)) return;

            const sel = el.querySelector('select[name="rollMode"]');
            console.log(
              `-------The value of sel: ---------- %c${sel}%c -------------------`,
              'color:#8B0088;font-weight:700;',
              'color:inherit;'
            );
            if (!sel) return;

            const desired = SELECT_VALUE[BLIND] || "blindroll";
            if (sel.value !== desired) {
              sel.value = desired;
              sel.dispatchEvent(new Event("change", { bubbles: true }));
            }

            sel.disabled = true;
            sel.style.opacity = '0.6';
            sel.style.cursor = 'not-allowed';


            const parent = sel.parentNode;
            if (!parent) return;


            let existing = parent.querySelector('p[data-blind-note="true"]');


            if (!existing) {
              existing = Array.from(parent.querySelectorAll('p'))
                .find(p => p.textContent?.trim() === 'This skill is configured for Blind GM Roll');
            }

            if (existing) {

              existing.style.cssText = 'color: #ff6b6b; font-size: 0.85em; margin: 0.25rem 0 0 0; font-style: italic;';
              return;
            }

            const note = document.createElement('p');
            note.setAttribute('data-blind-note', 'true');
            note.style.cssText = 'color: #ff6b6b; font-size: 0.85em; margin: 0.25rem 0 0 0; font-style: italic;';
            note.textContent = 'This skill is configured for Blind GM Roll';

            sel.insertAdjacentElement('afterend', note);
          };



      const forceBlind = (config, skillId) => {
        if (!isSkillBlind(skillId)) return;
        config.rollMode = BLIND;
        game.settings.set("core","rollMode","blindroll");
        if (config.dialog && typeof config.dialog === "object") config.dialog.rollMode = BLIND;

        Hooks.once("renderRollConfig", (_a, html) => setRollConfigSelectBlind(html));
        Hooks.once("renderDialog",     (_a, html) => setRollConfigSelectBlind(html));
        Hooks.once("renderApplicationV2", (app, el) => setRollConfigSelectBlind(el ?? app?.element));
      };

      Hooks.on("dnd5e.preRollSkillV2", (cfg) => {
        try {
          const key = cfg?.skill ?? cfg?.skillId ?? cfg?.abilitySkill ?? null;
          if (!key) return;
          forceBlind(cfg ?? {}, key);
        } catch (e) { console.warn("[BSR] preRollSkillV2", e); }
      });

      Hooks.on("dnd5e.preRollSkill", (...args) => {
        try {
          let skillId = null, config = null;
          for (const a of args) {
            if (!a) continue;
            if (typeof a === "string" && !skillId) { skillId = a; continue; }
            if (typeof a === "object") {
              if (!skillId) {
                if (typeof a.skill === "string") skillId = a.skill;
                else if (typeof a.skillId === "string") skillId = a.skillId;
                else if (typeof a.abilitySkill === "string") skillId = a.abilitySkill;
              }
              if (!config && ("rollMode" in a || "fastForward" in a || "configure" in a || a?.dialog)) config = a;
            }
          }
          if (!skillId) return;
          forceBlind(config ?? {}, skillId);
        } catch (e) { console.warn("[BSR] preRollSkill", e); }
      });

      Hooks.on("preCreateChatMessage", (_doc, data) => {
        try {
          if (!isEnabled()) return;
          const d5 = data?.flags?.dnd5e ?? {};
          const isDeath = d5?.roll?.type === "death" || d5?.type === "death" || d5?.rollType === "death";
          if (isDeath) return;

          const key =
            d5?.roll?.skillId ?? d5?.roll?.skill ?? d5?.roll?.context?.skill ??
            d5?.skillId ?? d5?.skill ?? d5?.context?.skill ?? null;

          if (!key || !isSkillBlind(key)) return;
          data.rollMode = BLIND; data.blind = true;
          data.whisper = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
          if (ChatMessage.applyRollMode) ChatMessage.applyRollMode(data, BLIND);
        } catch (e) { console.warn("[BSR] preCreateChatMessage (skills)", e); }
      });
    });
  })();
