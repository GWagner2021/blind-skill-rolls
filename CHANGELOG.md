## [Unreleased]
_TBD_


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
