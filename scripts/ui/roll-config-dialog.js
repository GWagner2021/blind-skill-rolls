import { BLIND, GMROLL } from "../core/constants.js";
function applyModeSelect(root, mode, noteAttr, noteKey, noteFallback, noteClass) {
    if (!(root instanceof HTMLElement))
        return;
    const sel = root.querySelector('select[name="rollMode"]');
    if (!sel)
        return;
    if (sel.value !== mode)
        sel.value = mode;
    sel.disabled = true;
    sel.classList.add("bsr-rollmode--locked");
    const parent = sel.parentNode;
    if (!parent)
        return;
    const NOTE_TEXT = (game.i18n?.has?.(noteKey) ? game.i18n.localize(noteKey) : noteFallback);
    let existing = parent.querySelector(`p[${noteAttr}="true"]`);
    if (!existing) {
        existing = Array.from(parent.querySelectorAll("p"))
            .find((p) => { const t = p.textContent?.trim(); return t === NOTE_TEXT || t === noteFallback; });
    }
    if (existing) {
        existing.className = noteClass;
        return;
    }
    const note = document.createElement("p");
    note.setAttribute(noteAttr, "true");
    note.className = noteClass;
    note.textContent = NOTE_TEXT;
    sel.insertAdjacentElement("afterend", note);
}
export const setRollConfigSelectBlind = (root, noteKey, noteFallback) => applyModeSelect(root, BLIND, "data-blind-note", noteKey, noteFallback, "bsr-rollmode-note bsr-rollmode-note--blind");
export const setRollConfigSelectPrivate = (root, noteKey, noteFallback) => applyModeSelect(root, GMROLL, "data-private-note", noteKey, noteFallback, "bsr-rollmode-note bsr-rollmode-note--private");
