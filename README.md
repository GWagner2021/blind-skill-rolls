# Blind Skill Rolls (Foundry VTT · dnd5e)

[![stable](https://img.shields.io/github/v/release/GWagner2021/blind-skill-rolls.svg?label=stable&display_name=tag&sort=date&cacheSeconds=3600&_=20260302)](https://github.com/GWagner2021/blind-skill-rolls/releases/latest) ![downloads](https://img.shields.io/github/downloads/GWagner2021/blind-skill-rolls/total?label=downloads) ![license](https://img.shields.io/github/license/GWagner2021/blind-skill-rolls?label=license)

Automatically forces selected **DnD5e** skill checks and **Death Saves** into privacy-friendly roll modes (Blind / Private), with optional tools for chat privacy, NPC name masking and Dice So Nice ghost dice.
The module is designed to work **with and without MidiQOL**. When MidiQOL is present, its roll handling is respected; when it’s not, Blind Skill Rolls falls back to the core dnd5e roll workflow.

---

## Features

### 🎯 Blind Skill Rolls

Configure specific skills that should always be treated as **blind checks**:

- Per-skill switches to force **Blind GM Roll**.
- Quick controls: **All / None / Defaults**.
- When a configured blind skill is rolled as **Blind GM Roll**:
  - Roller sees **ghost dice** (Dice So Nice) instead of regular dice.
  - GM sees the full result.
  - Other players see **nothing**.

Optional:

- **Hide Blind Skill Rolls chats from the roller**  
  The roller only sees ghost dice, no chat card.  
  GM still sees the full chat message, other players see nothing.

When **MidiQOL** is installed, the blind skill list is kept in two-way sync with MidiQOL’s *“Which skill checks are rolled blind”* setting, so you only need to configure your blind skills in one place.

---

### 💀 Death Saves Visibility

Control how **Death Saves** are posted and who sees what:

- Modes for Death Saves:
  - **Public**
  - **Private GM Roll**
  - **Blind GM Roll**

Behaviour overview (example with Player 1 as the roller):

- **Death Save – Public**
  - P1: normal dice + chat card  
  - GM: normal dice + chat card  
  - Others: normal dice + chat card  

- **Death Save – Private Roll**
  - P1: normal dice + chat card  
  - GM: normal dice + chat card  
  - Others: **nothing**  

- **Death Save – Blind Roll**
  - P1: **ghost dice**  
  - GM: normal dice + chat card  
  - Others: **nothing**

---

### 🧱 NPC Masking

Optionally hide **NPC names** in chat for players and show a placeholder instead:

- Define a placeholder name (e.g. *Unknown*, *Mysterious Figure*).
- Players see the placeholder name instead of the real NPC name.
- GM can still see the real name and reveal it when appropriate.
- Masking is handled per token, so revealing one instance does not automatically reveal all tokens of the same actor.

Configuration:  
`Game Settings → Module Settings → Configure Chat Display`  
(Section: NPC Masking)

---

### 🎲 Dice So Nice Integration

- Uses **ghost dice** for blind skill rolls and blind Death Saves:
  - Roller sees “something rolled” without full information.
  - GM keeps full visibility.
  - Other players see no dice at all for rolls that should be hidden from them.

Dice So Nice is **optional**, but highly recommended to get the full ghost-dice effect.

---

### 💬 Chat Privacy Helpers

- **Hide foreign secret messages**  
  Hide secret / blind / whispered chat messages that are not addressed to a player.
- **Mute foreign dice sounds**  
  Mute Dice So Nice dice sounds for secret rolls that don’t belong to that player.
- Optional sanitizing of public GM rolls with trusted-user exceptions.

---

## Localization

Included languages:

- **English (en)**
- **Deutsch (de)**
- **Français (fr)**
- **Español (es)**
- **Italiano (it)**
- **Polski (pl)**
- **Russian (ru)** (Thanks to Heyone77)

Feel free to open PRs with improvements in `/lang/*.json`.

---

## Installation

**Manifest URL**
https://github.com/GWagner2021/blind-skill-rolls/releases/latest/download/module.json

**Requirements**
- Foundry VTT **v13+**
- Game system: **dnd5e**
- Module: **libWrapper**

---

## Compatibility with other modules

Blind Skill Rolls is designed to be as non-invasive as possible and to play nicely with other popular dnd5e modules.

Explicitly tested / supported:

- **MidiQOL**  
  - Blind Skill Rolls works with or without MidiQOL installed.  
  - When MidiQOL is present, the blind skill configuration is kept in sync with
    MidiQOL’s “Which skill checks are rolled blind” setting and blind
    behaviour is applied to MidiQOL-driven rolls as well.

- **Dice So Nice**  
  - Used to display **ghost dice** for blind rolls.  
  - The module ensures that only the correct recipients see dice animations:
    roller (ghost dice), GM (normal dice), other players (no dice).

- **Tidy5e Sheet**  
  - Death Saves respect the configured visibility mode (Public / Private / Blind)
    when using the Tidy5e character sheet.

In general, Blind Skill Rolls should be compatible with most modules that do not fully replace
the dnd5e roll/chat workflow. If you encounter conflicts with specific modules, feel free to
open an issue with details about your setup.

---

## Support
Issues & feedback: https://github.com/GWagner2021/blind-skill-rolls/issues
