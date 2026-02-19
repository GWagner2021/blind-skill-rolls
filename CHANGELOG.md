## [Unreleased]
_TBD_

## [1.2.0] - 2026-02-19
### Added
- **NPC Masking 2.0**
  - NPC masking now works per **individual token** instead of per actor.
  - GM-only settings to define a placeholder name for hidden NPCs.

- **Theme & UX options**
  - Added **light** and **dark** themes for the Blind Skill Rolls configuration dialogs.
  - New setting to select the preferred theme for the BSR GUIs.
  - New setting to **enable/disable sync notifications** between Blind Skill Rolls and MidiQOL.

- **Full i18n coverage for settings UIs**
  - All user-facing labels and messages for:
    - **Chat / privacy configuration**
    - **Blind Skill Rolls configuration**
    - **Death Saves configuration**
  are now driven by the language files.

- **MidiQOL sync integration**
  - Two-way sync between BSR’s blind skill list and MidiQOL’s “which skill checks are rolled blind” setting.
  - On initialisation, **Blind Skill Rolls acts as the primary source of truth**:
    - MidiQOL adopts BSR’s blind skill list when both are active.
    - Optional fallback: if BSR is empty but MidiQOL has a list, BSR can import it once.

### Changed
- **ApplicationV2 migration**
  - Migrated all BSR configuration dialogs from the legacy Application V1 API to the **Application V2 API**:
  - Improves forward compatibility with newer Foundry core versions.

- **Startup & console output**
  - Cleaned up most internal debug logging.
  - On successful startup, the module now prints a single, clear message

### Fixed
- **Invisible chat cards**
  - Hidden/placeholder chat messages used for internal handling no longer take up vertical space or push the chat log upwards.

- **NPC masking & GM visibility**
  - NPC masking no longer affects **GM** as message author.
  - Fixed cases where GM rolls appeared anonymised to players when no token/actor was selected.

- **Tidy5e Death Saves**
  - Death save rolls now work correctly with the **Tidy5e** character sheet:
    - The death save die on the portrait / Tidy5e overlay triggers properly.
    - Behaviour respects BSR’s death-save privacy settings (public / private GM / blind GM).

- **Deprecated API usage**
  - Replaced usage of `ChatMessageMidi#user` with the newer `ChatMessageMidi#author` API to avoid deprecation warnings and prepare for future Foundry versions.

- **Player permissions during sync**
  - Fixed a permissions error where **non-GM** users would see:
    - `User X lacks permission to update Setting [...]`
  when the blind skill list was updated.
  - Sync updates for MidiQOL/BSR settings are now only performed from the GM side.


## [1.1.0] - 2026-01-18
### Changed
- **Unified Dice So Nice behaviour for blind/private rolls**  
  Ensured that, regardless of how the roll is triggered (core dnd5e roll, MidiQOL roll, or a roll intercepted and re-created as a blind GM roll by the module), **Dice So Nice** shows the correct dice to the correct recipients:
  - **Private Death Saves** (`DeathSavesMode = privateroll`):
    - Roller: normal dice + chat message  
    - GM: normal dice + chat message  
    - Other players: nothing  
  - **Blind Death Saves** (`DeathSavesMode = blindroll`):
    - Roller: ghost/partial dice view  
    - GM: normal dice + chat message  
    - Other players: nothing  
  - **Forced Blind Skills**:
    - Roller: ghost/partial dice view + limited chat (depending on settings)  
    - GM: normal dice + chat message  
    - Other players: nothing  

- **Compatibility with and without MidiQOL**  
  The above behaviour was explicitly aligned to work:
  - with **MidiQOL** installed and active,  
  - without **MidiQOL**,  
  - and also when **MidiQOL’s “Fast Forward Ability Rolls”** option is enabled.

### Added
- **Blind Death Saves message settings**  
  - New setting to allow **blind death save chat messages to be hidden from the roller**, while the GM still sees the full message and other players see nothing.
  - Corresponding GUI controls in the Death Saves configuration dialog.

- **Blind Skill Rolls message settings**  
  - New setting to allow **blind skill roll chat messages to be hidden from the roller**, matching the death save behaviour.
  - Corresponding GUI controls in the Blind Skill Rolls configuration dialog.

## [1.0.1] - 2025-10-11
### Added
- **Death Saves privacy & roll-mode**: Enforce roll mode via setting (`blindroll` / `gmroll` / `publicroll` / `selfroll`) and hide death-save UI for players when blind is active (chat tray & Portrait Panel).
- **Chat privacy**: Hide blind/whisper messages that aren’t addressed to the user (sidebar and popouts); optional muting of foreign dice sounds.
- **GM privacy**: Option to sanitize public GM rolls for non-GMs (strip formulas/tooltips), with an exception for trusted users (“Trusted users see details”).
- **NPC name masking & reveal**: Players see NPCs as **“Unknown”** by default; GMs can reveal/hide per token/actor (stored as flags) with live updates across chat.
- **Settings UI**: Dedicated sections for Chat/Privacy and Death Saves; multi-language strings (EN/DE/FR/ES/IT/PL).

### Changed
- Hardened skill roll detection against multiple dnd5e flag shapes (`flags.dnd5e.roll.skillId | skill | context.skill`).
- Unified console output styling (dark-red module prefix).

### Known limitations
- The “Hide NPC names by default” toggle is currently a placeholder; NPCs are masked for players unless revealed by a GM.


## [1.0.0] - 2025-09-30
### Added
- Initial release (Foundry v13 + dnd5e): automatically force selected skills to **Blind GM Roll**, with per-skill toggles and an optional “blind all skills by default”.
