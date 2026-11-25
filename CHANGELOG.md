# Changelog

All notable changes to Calm room are recorded here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates: dd/mm/yyyy.

## [Unreleased]

## [1.0.0] — 25/11/2026

### Added
- **Ember**: a fire whose size is a pure function of the days since it was last tended — exponential,
  monotonic, never rising on its own, never reaching zero. Tending restores it to full.
- No streak, no lock, no penalty and no lost state, asserted rather than promised: the view carries
  `lock: false`, `penalty: false`, `lostAnything: false`, and the tend button is never disabled.
- A tend with no interaction is refused and the app says the fire was not tended.
- **Horizon**: a landscape generated from a seed, so the same seed is the same place. Four named
  palettes, a seed field, and no goal, score or ending.
- A palette that does not parse is refused with the value shown, and the previous scene stays on
  screen. A saved room with no palette falls back to the named default, never to a random one.
- **Garden**: sand you can rake and stones you can place. Nothing is counted.
- Corruption handling: an unreadable room is reported and offered for export, and the fire is NOT
  quietly relit at full strength — that would erase the only consequence the app exists to create.
- A failed save says the fire's history will not survive, and the fire is never shown as tended when
  the write failed.
- PWA shell, CI (62 engine assertions + 24 in jsdom + page smoke), and the app-builder pipeline
  pinned to the canonical SHA for the EXE/APK/Linux release.

### Not built
- Sound: a fire could have a crackle, and there is none.
