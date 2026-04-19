import { BLIND, GMROLL } from "../core/constants.js";

function applyModeSelect(
  root: HTMLElement | null | undefined,
  mode: string,
  noteAttr: string,
  noteKey: string,
  noteFallback: string,
  noteClass: string
): void {
  if (!(root instanceof HTMLElement)) return;

  const sel = root.querySelector('select[name="rollMode"]') as HTMLSelectElement | null;
  if (!sel) return;

  if (sel.value !== mode) sel.value = mode;
  sel.disabled = true;
  sel.classList.add("bsr-rollmode--locked");

  const parent = sel.parentNode as HTMLElement | null;
  if (!parent) return;

  const NOTE_TEXT: string = (game.i18n?.has?.(noteKey) ? game.i18n.localize(noteKey) : noteFallback);

  let existing: HTMLParagraphElement | null | undefined = parent.querySelector(`p[${noteAttr}="true"]`);
  if (!existing) {
    existing = Array.from(parent.querySelectorAll("p"))
      .find((p: HTMLParagraphElement) => { const t = p.textContent?.trim(); return t === NOTE_TEXT || t === noteFallback; });
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

export const setRollConfigSelectBlind = (root: HTMLElement | null | undefined, noteKey: string, noteFallback: string): void =>
  applyModeSelect(root, BLIND, "data-blind-note", noteKey, noteFallback, "bsr-rollmode-note bsr-rollmode-note--blind");

export const setRollConfigSelectPrivate = (root: HTMLElement | null | undefined, noteKey: string, noteFallback: string): void =>
  applyModeSelect(root, GMROLL, "data-private-note", noteKey, noteFallback, "bsr-rollmode-note bsr-rollmode-note--private");
