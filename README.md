# Blind Skill Rolls (Foundry VTT · dnd5e)

Automatically forces selected **DnD5e** skill checks and **Death Saves** into privacy-friendly roll modes (Blind / Private), with optional tools for chat privacy, NPC name masking and Dice So Nice ghost dice.

[![stable](https://img.shields.io/github/v/release/GWagner2021/blind-skill-rolls?label=stable&display_name=tag&sort=semver)](https://github.com/GWagner2021/blind-skill-rolls/releases/latest) ![downloads](https://img.shields.io/github/downloads/GWagner2021/blind-skill-rolls/total?label=downloads) ![license](https://img.shields.io/github/license/GWagner2021/blind-skill-rolls?label=license)

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
- **Russian (ru)**

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

## Support
Issues & feedback: https://github.com/GWagner2021/blind-skill-rolls/issues