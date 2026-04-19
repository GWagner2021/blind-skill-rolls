import { MOD, DEFAULT_BLIND_CARD_COLOR, DEFAULT_PRIVATE_CARD_COLOR } from "../core/constants.js";

const STYLE_ID: string = "bsr-chat-card-colors";

function isEnabled(): boolean {
  try { return !!game.settings.get(MOD, "bsrCustomCardColorsEnabled"); }
  catch { return false; }
}

function getColor(key: string, fallback: string): string {
  try { return (game.settings.get(MOD, key) as string) || fallback; }
  catch { return fallback; }
}

function applyCardColorStyle(): void {
  const el = document.getElementById(STYLE_ID);

  if (!isEnabled()) {
    if (el) el.textContent = "";
    return;
  }

  const blind    = getColor("bsrBlindCardColor",   DEFAULT_BLIND_CARD_COLOR);
  const private_ = getColor("bsrPrivateCardColor", DEFAULT_PRIVATE_CARD_COLOR);

  let styleEl: HTMLElement | null = el;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    .chat-message.whisper { background-color: ${private_} !important; background-image: none !important; }
    .chat-message.blind   { background-color: ${blind}   !important; background-image: none !important; }
    .chat-message.whisper::before,
    .chat-message.blind::before {
      background: none !important;
      mix-blend-mode: normal !important;
      filter: none !important;
    }
  `.trim();
}

Hooks.once("ready", () => {
  applyCardColorStyle();
});

Hooks.on("clientSettingChanged", (key: string) => {
  if (
    key === `${MOD}.bsrCustomCardColorsEnabled` ||
    key === `${MOD}.bsrBlindCardColor` ||
    key === `${MOD}.bsrPrivateCardColor`
  ) {
    applyCardColorStyle();
  }
});
