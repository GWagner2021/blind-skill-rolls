// scripts/bsr-chat-hide.js

(function() {
    'use strict';

    //====================================================================================
    //The section prevents Invisible chat cards from pushing up the chat log
    //====================================================================================

    Hooks.once('ready', () => {
        const isGM = game.user.isGM;

        // Inject CSS
        const style = document.createElement('style');

        if (isGM) {
            style.textContent = `
                .chat-message.hidden_msg {
                    border: 2px solid rgba(255, 0, 0, 0.3) !important;
                    position: relative !important;
                }

                .chat-message.hidden_msg::before {
                    content: "🔒 Hidden from players";
                    position: absolute;
                    top: -2px;
                    left: -2px;
                    background: rgba(255, 0, 0, 0.8);
                    color: white;
                    padding: 2px 6px;
                    font-size: 10px;
                    font-weight: bold;
                    border-radius: 3px;
                    z-index: 10;
                }
            `;
        } else {
            style.textContent = `
                .chat-message.hidden_msg {
                    display: none !important;
                }
            `;
        }

        document.head.appendChild(style);

        if (!isGM) {
            Hooks.on('renderChatMessageHTML', (message, html) => {
                if (html && html.classList && html.classList.contains('hidden_msg')) {
                    html.style.setProperty('display', 'none', 'important');
                    html.style.setProperty('height', '0', 'important');
                    html.style.setProperty('margin', '0', 'important');
                    html.style.setProperty('padding', '0', 'important');
                    html.style.setProperty('border', '0', 'important');
                }
            });

            setTimeout(() => {
                const chatLog = document.querySelector('#chat-log');
                if (!chatLog) {
                    globalThis.dbgWarn?.("Chat Message Hider: Chat log not found");
                    return;
                }

                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1 && node.classList?.contains('chat-message')) {
                                if (node.classList.contains('hidden_msg')) {
                                    node.style.setProperty('display', 'none', 'important');
                                    node.style.setProperty('height', '0', 'important');
                                    node.style.setProperty('margin', '0', 'important');
                                    node.style.setProperty('padding', '0', 'important');
                                    node.style.setProperty('border', '0', 'important');
                                }
                            }
                        });
                    });
                });

                observer.observe(chatLog, {
                    childList: true,
                    subtree: false
                });

                chatLog.querySelectorAll('.chat-message.hidden_msg').forEach((element) => {
                    element.style.setProperty('display', 'none', 'important');
                    element.style.setProperty('height', '0', 'important');
                    element.style.setProperty('margin', '0', 'important');
                    element.style.setProperty('padding', '0', 'important');
                    element.style.setProperty('border', '0', 'important');
                });
            }, 500);
        }
    });
})();
(() => {
  "use strict";
  const MOD = "blind-skill-rolls";

  // ----- Logger -----
  const STY = "color:#8B0000;font-weight:700;";
  const tag = () => [`%c${MOD}%c`, STY, "color:inherit;"];
  const log  = (...a) => { try { console.log(...tag(), ...a); } catch {} };
  const warn = (...a) => { try { console.warn(...tag(), ...a); } catch {} };

  // ----- i18n -----
  const L  = (k, fb) => { try { const t = game?.i18n?.localize?.(k); return (t && t !== k) ? t : (fb ?? k); } catch { return fb ?? k; } };
  const LF = (k, d, fb) => {
    try { const t = game?.i18n?.format?.(k, d ?? {}); if (t && t !== k) return t; } catch {}
    if (fb && d) return fb.replace(/\{(\w+)\}/g, (_,x)=> d[x] ?? "");
    return fb ?? k;
  };

  const OPT_HIDE = () => { try { return game.settings.get(MOD, "hideForeignSecrets"); } catch { return true; } };
  const OPT_MUTE = () => { try { return game.settings.get(MOD, "muteForeignSecretSounds"); } catch { return true; } };

  // ----- Visibility -----
  const meId = () => game.user?.id ?? null;
  const whisperIds = (m) =>
    Array.isArray(m?.whisper) ? m.whisper
    : Array.isArray(m?.whisperRecipients) ? m.whisperRecipients.map(u=>u?.id ?? u?._id).filter(Boolean)
    : [];
  const isSecret = (m) => !!m?.blind || (Array.isArray(m?.whisper) && m.whisper.length>0);
  function isAddressedToMe(m){
    const me = meId(); if (!me) return false;
    if (!isSecret(m)) return true;
    // v13+ compatible: author.id → author → user (deprecated) → userId (legacy)
    const author = m?.author?.id ?? m?.author ?? m?.user ?? m?.userId;
    if (String(author)===String(me)) return true;
    return whisperIds(m).map(String).includes(String(me));
  }
  const shouldHideForMe = (m) => !game.user.isGM && OPT_HIDE() && isSecret(m) && !isAddressedToMe(m);

  // ----- CSS-Guard -----
  function ensureGlobalStyle(){
    if (document.getElementById("bsr-chat-css")) return;
    const css = `
      html[data-bsr-hide="1"] li.chat-message.whisper,
      html[data-bsr-hide="1"] li.chat-message.blind { display: none !important; }
      html[data-bsr-hide="1"] li.chat-message[data-bsr-visible="1"] { display: flex !important; }
    `.trim();
    const style = document.createElement("style");
    style.id = "bsr-chat-css"; style.textContent = css; document.head.appendChild(style);
  }
  function applyCssGuard(){
    if (!game?.user) return;
    const on = !game.user.isGM && OPT_HIDE();
    if (on) document.documentElement.setAttribute("data-bsr-hide","1");
    else    document.documentElement.removeAttribute("data-bsr-hide");
  }

  // ----- DOM sweep/observer -----
  const getSidebarRoot = () => {
    const el = ui?.chat?.element; const root = (el && el[0]) ? el[0] : null;
    return root?.querySelector?.("ol.chat-log") ?? root?.querySelector?.(".chat-log") ?? root ?? null;
  };
  function popoutLogs(){
    const out=[]; for (const w of Object.values(ui.windows ?? {})) {
      if (!w || w.constructor?.name!=="ChatPopout") continue;
      const cont = w.element?.find?.(".window-content")?.[0] ?? null;
      const log  = cont?.querySelector?.("ol.chat-log") ?? cont?.querySelector?.(".chat-log") ?? cont;
      if (log) out.push(log);
    } return out;
  }
  const allRoots = () => [ getSidebarRoot(), ...popoutLogs() ].filter(Boolean);

  function markVisibility(li, msg){
    try { shouldHideForMe(msg) ? li.removeAttribute("data-bsr-visible") : li.setAttribute("data-bsr-visible","1"); }
    catch {}
  }
  function sweepRoot(root){
    if (!root) return;
    for (const li of root.querySelectorAll("li.chat-message")){
      const id = li.dataset?.messageId;
      if (!id){ if (li.classList.contains("whisper")||li.classList.contains("blind")) li.removeAttribute("data-bsr-visible"); continue; }
      const msg = game.messages?.get?.(id);
      if (!msg){ if (li.classList.contains("whisper")||li.classList.contains("blind")) li.removeAttribute("data-bsr-visible"); continue; }
      markVisibility(li, msg);
    }
  }
  const sweepAllRoots = () => allRoots().forEach(sweepRoot);

  let sidebarObserver=null;
  function observeSidebar(){
    if (sidebarObserver) sidebarObserver.disconnect();
    const root = getSidebarRoot(); if (!root) return;
    sidebarObserver = new MutationObserver((muts)=>{
      for (const m of muts) for (const n of m.addedNodes){
        if (!(n instanceof HTMLElement)) continue;
        if (n.matches?.("li.chat-message")){
          const id=n.dataset?.messageId; const msg=id?game.messages?.get?.(id):null;
          msg?markVisibility(n,msg):n.removeAttribute("data-bsr-visible"); continue;
        }
        for (const li of (n.querySelectorAll?.("li.chat-message") ?? [])){
          const id=li.dataset?.messageId; const msg=id?game.messages?.get?.(id):null;
          msg?markVisibility(li,msg):li.removeAttribute("data-bsr-visible");
        }
      }
    });
    sidebarObserver.observe(root,{childList:true,subtree:true});
    sweepRoot(root); setTimeout(()=>sweepRoot(root),0); setTimeout(()=>sweepRoot(root),80);
  }

  const popoutObservers=new WeakMap();
  Hooks.on("renderChatPopout", (_app, html) => {
    if (game.user.isGM) return;
    const root=(html?.[0] ?? html); if (!root) return;
    const logEl=root.querySelector?.("ol.chat-log") ?? root.querySelector?.(".chat-log") ?? root;
    const prev = popoutObservers.get(logEl); if (prev) try { prev.disconnect(); } catch {}
    const obs=new MutationObserver((muts)=>{
      for (const m of muts) for (const n of m.addedNodes){
        if (!(n instanceof HTMLElement)) continue;
        if (n.matches?.("li.chat-message")){
          const id=n.dataset?.messageId; const msg=id?game.messages?.get?.(id):null;
          msg?markVisibility(n,msg):n.removeAttribute("data-bsr-visible"); continue;
        }
        for (const li of (n.querySelectorAll?.("li.chat-message") ?? [])){
          const id=li.dataset?.messageId; const msg=id?game.messages?.get?.(id):null;
          msg?markVisibility(li,msg):li.removeAttribute("data-bsr-visible");
        }
      }
    });
    obs.observe(logEl,{childList:true,subtree:true});
    popoutObservers.set(logEl,obs);
    sweepRoot(logEl); setTimeout(()=>sweepRoot(logEl),0); setTimeout(()=>sweepRoot(logEl),80);
  });

  Hooks.on("closeChatPopout", (_app, html) => {
    try {
      const root=(html?.[0] ?? html);
      const logEl=root?.querySelector?.("ol.chat-log") ?? root?.querySelector?.(".chat-log") ?? root;
      const obs=popoutObservers.get(logEl); if (obs) obs.disconnect(); popoutObservers.delete(logEl);
    } catch {}
  });

  Hooks.on("renderChatMessageHTML", (msg, el) => {
    try { if (!el) return; shouldHideForMe(msg) ? el.removeAttribute("data-bsr-visible") : el.setAttribute("data-bsr-visible","1"); }
    catch(e){ warn(game.i18n.localize("BLINDSKILLROLLS.Log.RCMHTMLMarkFailed"), e); }
  });
  Hooks.on("createChatMessage", ()=>{ try { sweepAllRoots(); setTimeout(sweepAllRoots,0); } catch {} });

  Hooks.on("updateSetting", (setting, _diff, _id) => {
    try {
      if (setting?.key === `${MOD}.hideForeignSecrets`) { applyCssGuard(); sweepAllRoots(); }
      if (setting?.key === `${MOD}.muteForeignSecretSounds`) { /* nothing to do */ }
    } catch {}
  });

  // ================== SOUND-SUPPRESSION ==================
  const PATCHED = { audio:false, sound:false, howl:false, html:false };
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  function resolveSrc(first, rest=[]){
    const cand=[]; const push=(v)=>{ if (!v) return;
      if (typeof v==="string"){cand.push(v); return;}
      if (typeof v==="object"){
        if (typeof v.src==="string") cand.push(v.src); else if (Array.isArray(v.src)&&v.src.length) cand.push(v.src[0]);
        if (typeof v.url==="string") cand.push(v.url);
        if (typeof v.path==="string") cand.push(v.path);
        if (typeof v.sound==="string") cand.push(v.sound);
      }
    };
    push(first); for (const a of rest) push(a); return cand.find(Boolean) || "";
  }
  const RX_DICE_CORE=/(^|\/)sounds\/dice\.wav(?:\?.*)?$/i;
  const RX_DICE_GENERIC=/(\/|^)sounds\/.*dice|(^|\/)dice\.(wav|mp3|ogg)|\bd(20|12|10|8|6|4)\b|roll/i;
  function shouldBlockSrc(src){
    if (game.user?.isGM) return false;
    if (!OPT_MUTE()) return false;
    const s=String(src||"");
    return RX_DICE_CORE.test(s) || RX_DICE_GENERIC.test(s);
  }

  const muteGate={active:false,until:0,prevMuted:null,timer:null};
  const nowTs=()=>now();
  function openMute(ms=3000){
    if (game.user.isGM || !OPT_MUTE()) return;
    const t=nowTs()+ms; muteGate.until=Math.max(muteGate.until,t);
    if (!muteGate.active){
      muteGate.active=true;
      try { if (globalThis.Howler){ muteGate.prevMuted=!!Howler._muted; Howler.mute(true); } } catch {}
    }
    scheduleMuteCheck();
  }
  function extendMute(ms=250){ if (!muteGate.active) return openMute(ms); muteGate.until=Math.max(muteGate.until, nowTs()+ms); scheduleMuteCheck(); }
  function scheduleMuteCheck(){ if (!muteGate.timer) muteGate.timer=setTimeout(checkMute,100); }
  function checkMute(){
    muteGate.timer=null; if (!muteGate.active) return;
    if (nowTs()<=muteGate.until) return scheduleMuteCheck();
    try { if (globalThis.Howler && muteGate.prevMuted!==null) Howler.mute(!!muteGate.prevMuted); } catch {}
    muteGate.active=false; muteGate.prevMuted=null; muteGate.until=0;
  }

  function patchAudioHelperPlay(){
    if (PATCHED.audio) return;
    try{
      const hasLW = !!globalThis.libWrapper && game.modules.get("lib-wrapper")?.active;
      const path  = "foundry.audio.AudioHelper.play";
      const handler = function(wrapped, arg0, ...args){
        const src=resolveSrc(arg0,args);
        if (shouldBlockSrc(src)) return null;
        if (!game.user.isGM && OPT_MUTE() && muteGate.active){ extendMute(200); return null; }
        return wrapped(arg0, ...args);
      };
      if (hasLW){
        libWrapper.register(MOD, path, handler, "MIXED");
        PATCHED.audio=true;
      } else if (foundry?.audio?.AudioHelper?.play){
        const AH = foundry.audio.AudioHelper;
        const _play = AH.play;
        AH.play = async function(arg0, ...args){
          const src=resolveSrc(arg0,args);
          if (shouldBlockSrc(src)) return null;
          if (!game.user.isGM && OPT_MUTE() && muteGate.active){ extendMute(200); return null; }
          return _play.call(this, arg0, ...args);
        };
        PATCHED.audio=true;
      }
    } catch(e){ warn(game.i18n.localize("BLINDSKILLROLLS.Log.AudioPatchFailed"), e); }
  }
  function patchFoundrySoundClass(){
    if (PATCHED.sound) return;
    try{
      if (!foundry?.audio?.Sound?.prototype?.play) return;
      const _play=foundry.audio.Sound.prototype.play;
      if (_play._bsrPatched){ PATCHED.sound=true; return; }
      foundry.audio.Sound.prototype.play=function(...args){
        try{
          const src=this?.src ?? this?.path ?? this?.url ?? this?.howl?._src ?? "";
          if (shouldBlockSrc(src)) return null;
          if (!game.user.isGM && OPT_MUTE() && muteGate.active){ extendMute(200); return null; }
        } catch {}
        return _play.apply(this,args);
      };
      foundry.audio.Sound.prototype.play._bsrPatched=true;
      PATCHED.sound=true;
    } catch(e){ warn(game.i18n.localize("BLINDSKILLROLLS.Log.SPPPatchFailed"), e); }
  }
  function patchHowlerPlay(){
    if (PATCHED.howl) return;
    try{
      if (globalThis.Howl?.prototype?.play){
        const _hplay=Howl.prototype.play;
        if (_hplay._bsrPatched){ PATCHED.howl=true; return; }
        Howl.prototype.play=function(...args){
          try{
            const src=Array.isArray(this._src) ? this._src[0] : this._src;
            if (shouldBlockSrc(src)) return this;
            if (!game.user.isGM && OPT_MUTE() && muteGate.active){ extendMute(200); return this; }
          } catch {}
          return _hplay.apply(this,args);
        };
        Howl.prototype.play._bsrPatched=true;
        PATCHED.howl=true;
      }
    } catch(e){ warn(game.i18n.localize("BLINDSKILLROLLS.Log.HowlerPatchFailed"), e); }
  }
  function patchHTMLAudioPlay(){
    if (PATCHED.html) return;
    try{
      const P=globalThis.HTMLMediaElement?.prototype; if (!P?.play) return;
      const _play=P.play;
      if (_play._bsrPatched){ PATCHED.html=true; return; }
      P.play=function(...args){
        try{
          const src=this?.currentSrc || this?.src || "";
          if (shouldBlockSrc(src)) return Promise.resolve();
          if (!game.user.isGM && OPT_MUTE() && muteGate.active){ extendMute(200); return Promise.resolve(); }
        } catch {}
        return _play.apply(this,args);
      };
      P.play._bsrPatched=true;
      PATCHED.html=true;
    } catch(e){ warn(game.i18n.localize("BLINDSKILLROLLS.Log.HTMLAPatchFailed"), e); }
  }
  function installAudioPatches(){
    patchAudioHelperPlay();
    patchFoundrySoundClass();
    patchHowlerPlay();
    patchHTMLAudioPlay();
  }

  // Gate-Trigger
  Hooks.on("preCreateChatMessage", (_doc, data)=>{
    try{
      if (game.user.isGM || !OPT_MUTE()) return;
      const secret=!!data?.blind || (Array.isArray(data?.whisper) && data.whisper.length>0);
      if (!secret) return;
      const me=meId();
      const author=String(data?.author?.id ?? data?.author ?? data?.user ?? data?.userId ?? "");
      const wh = Array.isArray(data?.whisper) ? data.whisper.map(String) : [];
      const toMe = (author===String(me)) || wh.includes(String(me));
      if (!toMe) openMute(3500);
    } catch {}
  });
  //Hooks.on("diceSoNiceRollStart", ()=>{ try{ if (!game.user.isGM && OPT_MUTE()) openMute(3500); } catch {} });
  Hooks.on("createChatMessage", (doc)=>{ try{
    if (game.user.isGM || !OPT_MUTE()) return;
    if (doc?.blind || (Array.isArray(doc?.whisper) && doc.whisper.length>0)){
      if (!isAddressedToMe(doc)) openMute(1800);
    }
  } catch {} });

  Hooks.once("ready", () => {
    ensureGlobalStyle();
    applyCssGuard();
    observeSidebar();

    const body = document.body;
    if (body) {
      const bodyObserver = new MutationObserver(() => { });
      bodyObserver.observe(body, { childList:true, subtree:true });
    }

    installAudioPatches();

    sweepAllRoots(); setTimeout(sweepAllRoots, 0); setTimeout(()=>sweepAllRoots(), 80);

    if (globalThis.BSR_DEBUG === true) {
      log(LF("BLINDSKILLROLLS.Log.ReadyText",
        { hide: String(OPT_HIDE()), mute: String(OPT_MUTE()) },
        `ready | hide=${OPT_HIDE()} | mute=${OPT_MUTE()}`
      ));
    }

    window.BSR_102.load_count += 1;
  });

  Hooks.on("renderChatLog", () => { applyCssGuard(); observeSidebar(); setTimeout(sweepAllRoots, 0); });

  function removeBlind(){
      const elements = document.querySelectorAll(".hidden_msg");
      elements.forEach(el => {
        el.remove();
      });
    }

    Hooks.on("renderChatMessageHTML", (message, html, data) => {

        if(!game.user.isGM){
          if(message.blind  && game.settings.get(MOD, "blindRollersChat") && message.flavor != "Death Saving Throw")  {html.classList.add("hidden_msg");}
          if(message.blind  && game.settings.get(MOD, "blindRollersDeathSaveChat") && message.flavor == "Death Saving Throw") {html.classList.add("hidden_msg");}
          removeBlind();

        }
      });
    Hooks.on("canvasPan", (...args) => {
      removeBlind();
    });
})();
window.BSR_102.load_count += 1;
BSR_102.load_complete();
