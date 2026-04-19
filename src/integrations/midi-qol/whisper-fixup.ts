
import { MOD } from "../../core/constants.js";
import { dbgDebug, dbgWarn } from "../../debug/logger.js";

const MIDI_ID = "midi-qol";
function isMidiActive(): boolean {
  try { return game.modules?.get(MIDI_ID)?.active === true; } catch { return false; }
}

const OPT_HIDE = (): boolean => {
  try { return game.settings.get(MOD, "hideForeignSecrets") as boolean; } catch { return true; }
};

Hooks.once("ready", () => {
  if (!isMidiActive()) return;

  Hooks.on("preCreateChatMessage", (msg: any) => {
    try {
      const flags = msg.flags?.[MOD];
      if (!flags) return;

      if (!flags.bsrPrivate) return;
      if (OPT_HIDE()) return;

      const whisper = msg.whisper;
      if (!Array.isArray(whisper) || whisper.length === 0) return;

      msg.updateSource({ whisper: [], blind: false });
      dbgDebug("midi-whisper-fix | re-cleared whisper on bsrPrivate message (MidiQOL override detected)");
    } catch (e) {
      dbgWarn("midi-whisper-fix | preCreateChatMessage error", e);
    }
  });

  dbgDebug("midi-whisper-fix | late preCreateChatMessage registered");
});
