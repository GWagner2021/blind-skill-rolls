import { MOD } from "../../core/constants.js";
import { setDsnPendingMode } from "../../core/state/pending-dsn.js";
import { setPendingHiddenNpc } from "../../core/state/pending-hidden-npc.js";
import { dbgDebug, dbgWarn } from "../../debug/logger.js";
const MIDI_ID = "midi-qol";
function isMidiActive() {
    try {
        return game.modules?.get(MIDI_ID)?.active === true;
    }
    catch {
        return false;
    }
}
Hooks.on("preCreateChatMessage", (msg, data) => {
    try {
        if (!game.user?.isGM)
            return;
        if (!msg.blind)
            return;
        const existingFlags = msg.flags?.[MOD] ?? {};
        if (existingFlags.bsrBlind)
            return;
        const speaker = msg?.speaker ?? {};
        const sceneId = speaker.scene ?? null;
        const tokenId = speaker.token ?? null;
        if (!sceneId || !tokenId)
            return;
        let tokenDoc = null;
        try {
            tokenDoc = fromUuidSync(`Scene.${sceneId}.Token.${tokenId}`);
        }
        catch {
            return;
        }
        if (!tokenDoc?.hidden)
            return;
        const actor = tokenDoc?.actor ?? null;
        if (!actor || actor.type === "character")
            return;
        msg.updateSource({ [`flags.${MOD}.bsrBlind`]: true });
        setDsnPendingMode('blind');
        setPendingHiddenNpc();
        dbgDebug("midi-npc-fix | added bsrBlind flag + DSN pending mode for hidden NPC safety-net message");
    }
    catch (e) {
        dbgWarn("midi-npc-fix | preCreateChatMessage error", e);
    }
});
