# Calm room

A fire that burns down on its own, a place you can return to, and sand you can rake. **Nothing here
scores you.**

- **Demo (the app itself):** https://drsamonline.github.io/app-calm-room/play/index.html
- **Landing page:** https://drsamonline.github.io/app-calm-room/
- **Release:** https://github.com/drsamonline/app-calm-room/releases/tag/app-latest
- **Plan row:** #13 of 37 in `drsamonline/forge` → `QUEUE/PLAN.json`
- **Specs absorbed:** `app-ember` (lead), `app-horizon`, `app-zen-garden`
- **Licence:** PolyForm Noncommercial 1.0.0
- **Sponsor:** [github.com/sponsors/drsamonline](https://github.com/sponsors/drsamonline) — free, offline, no account

## Status

| | |
|---|---|
| **Built** | Ember: size is a pure function of days since the last tend, monotonic, never rising, never zero; tending restores to full; no lock, penalty or lost state. Horizon: seeded landscape, four named palettes, palette refusals that keep the previous scene. Garden: rake and stones, counted by nothing. |
| **Release** | Windows EXE, Android APK and Linux binary, built from this source by `app-builder` in CI. |
| **Not built** | **Sound.** A fire could crackle and there is none; the app says so rather than implying a soundtrack that is not there. |
| **Untested** | How it feels over weeks — the decay curve is asserted mathematically, but whether a fire at 20% reads as "still here" or as "you failed" is a design question no assertion answers. That is the honest limit of this README. |

## The Ember spec's "done means", counted

> "A fire left untended for a simulated 7 days is smaller than one tended daily — the rendered size
> at day 7 is a lower value than at day 0, and the decline is monotonic across those 7 days, never
> rising on its own. Tending on day 7 restores it to at least its day-0 size. Leaving for 1 day
> drops it less than leaving for 7, and a long absence shows a smaller fire with no lock, penalty or
> lost state beyond its size."

| The spec says | The test |
|---|---|
| day 7 < day 0 | 1.000 → 0.198 on the curve, asserted |
| monotonic, never rising on its own | every day ≤ the day before, across all seven |
| tending on day 7 restores to ≥ day 0 | `tend()` returns 1.000, and the view agrees |
| 1 day drops it less than 7 | (1.000−0.725) < (1.000−0.198), asserted |
| no lock, penalty or lost state | `lock: false`, `penalty: false`, `lostAnything: false`; the fire never reaches zero; the tend button is never disabled |

## Three specs, one job

Ember *holds attention by decay*; Horizon *is a view you return to*; Zen Garden *has no goals*.
All three are the same job — **a place that asks nothing of you** — so one app, three rooms, one
store. None of them scores anything, and that is asserted rather than promised.

## What it will not do

- **Punish you for leaving.** No streak, no lock, no lost state — only a smaller fire.
- **Score anything.** No goal, no points, no ending.
- **Relight an unreadable fire at full strength.** That would erase the only consequence the app exists to create.
- **Count a tend that did not happen.**
- **Use a key or a network.**

## When things go wrong

| Case | Behaviour |
|---|---|
| **Bad input** | A tend with no interaction is refused. A palette that does not parse is refused with the value shown, and the previous scene stays. |
| **No network** | Nothing changes. |
| **Storage full or unavailable** | The history will not survive, said plainly; the fire is never shown as tended when the write failed. |
| **Corrupt saved state** | Reported and offered for export; the fire is **not** relit at full strength. |

## The curve, and why it is exponential

```
size(days) = 0.14 + 0.86 × exp(−days / 2.6)
```

Day 0 → 1.000 · day 1 → 0.725 · day 3 → 0.411 · day 7 → 0.198 · day 400 → 0.140.

Two decisions are baked into those numbers. The **floor of 0.14** means a fire never goes out: a
cold hearth reads as a punishment, and the spec forbids one. The **tau of 2.6 days** means a week
away costs about four fifths of the height — enough that tending it is the thing that makes it
bigger, not enough to feel like a debt.

## Tests

```bash
npm test                      # all three suites
node tests/self-tests.js      # engine — 62 assertions, including the done-means
node tests/ui-tests.js        # the page in jsdom — 24 assertions (needs the dev-only jsdom)
node tests/page-smoke.js      # every local src/href resolves, nothing off-origin
```

Mutation-tested six ways on 25/11/2026, each red: the fire rising on its own after day 3 (2
failures), a tend with no interaction counting (3), a corrupt room relit at full strength (3), a bad
palette going blank instead of being refused (4), a non-deterministic landscape (1), and a long
absence locking the fire (1). Restored, 62/62.

## Layout

```
docs/index.html            landing page
docs/play/index.html       the app — Ember, Horizon, Garden
docs/play/app.js           DOM wiring: the fire, the canvas drawing, the garden, the save guard
docs/play/calm-core.js     the engine — decay, palettes, seeded landscape, garden, storage
docs/play/web-kit.js       vendored kit (unmodified)
docs/play/export-kit.js    vendored kit (unmodified)
tests/self-tests.js        engine suite (62)
tests/ui-tests.js          page suite (24, jsdom)
tests/page-smoke.js        shape on disk
PAGES.json                 landing = docs/index.html, app = docs/play/index.html
```

## Where the spec was silent, and what was chosen

- **The fire never goes out.** A floor of 0.14 is the difference between "smaller" and "you failed".
- **Size is a function of time alone**, so it cannot rise on its own and it cannot be gamed by refreshing the page.
- **A palette that does not parse is refused rather than replaced**, because the scene changing shape under you is worse than a refusal.
- **The garden counts nothing** — not strokes, not stones. The moment it counted, it would have a goal.
- **No sound.** A crackle would need an asset, and a missing asset is a promise the app cannot keep.

## What is not built, and why

**Sound.** It would need an audio asset, and every asset is a thing that can fail to load in the
quietest moment. The fire is visual on purpose.

**Weather, seasons, or anything that changes on its own.** The landscape changes only when you change
the seed, because a view that moves without you is a screensaver, and the spec asked for a place.
