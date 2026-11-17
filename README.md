# EMBERWARD — Hold the Last Light

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/pattrap-motor/best-game-01-entry/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/pattrap-motor/best-game-01-entry/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Bounty: [Make the best game — make.fun/bounty/best-game-01](https://make.fun/bounty/best-game-01)

An original top-down arena shooter. The night has swallowed the valley; you
are the last Warden, and your lantern is the last light. Survive 10 waves of
cinders, spitters, wisps, splitters, brutes and lancers, then slay the Ash Titan.

- **WASD / arrows** move, **mouse** aims, **hold click** fires, **Space** dashes
- **P** pauses, **M** mutes, **R** restarts after a run ends
- Between waves, pick one of three lantern blessings (damage, fire rate,
  multishot, pierce, speed, health, dash, magnet, crit, bullet speed)
- Chain kills without a pause to raise your combo multiplier — up to ×8
  score — and watch the meter: let the chain lapse and the multiplier is gone
- Pickups: heal, shield, spread shot, bomb. Best score is kept locally.
- All art is drawn in code and all sound is synthesised with WebAudio.
  No network requests, no assets, no build step.

## Version 3

- **Combo multiplier**: kills chain into a score multiplier up to ×8, with a
  draining window, a HUD meter that heats through the palette as it climbs,
  gold score pops, and a best-combo line on the end screen.
- **A seventh foe, the Lancer**: it telegraphs its charge with a dashed line
  that burns red once locked, lances through the Warden, and recovers
  slowly — the price of a miss. It joins the waves from wave 4 on.
- **The Ash Titan's second phase deepens**: below two-fifths health it
  weaves a twin spiral barrage over its radial bursts, its bursts now
  telegraph with a swelling warning ring, and its health bar carries pips
  where the phases turn (and reads ENRAGED once it has).
- **The floor remembers**: fallen foes leave scorch marks that linger and
  fade, so a long fight writes its history on the arena.
- Earned weight: a breath of hit-stop on critical hits and heavy kills
  only, bigger gold numbers on crits.
- The fourth screenshot is now the blessing draft itself — the run's
  decision point, three cards up, the build so far in the HUD.

## Version 2

- The title screen is a live attract mode: the Warden stands at his post
  while every kind of foe drifts in and circles him, under a drawn lantern
  mark — what you see behind the menu is the game itself, idling.
- The action screenshot is now the wave-10 boss fight: the Ash Titan mid
  radial-burst, its summoned cinders closing in, the boss bar on screen.
- Bolts fly as tracer streaks and foe orbs wear halos, so a stream of fire
  reads even in a single frame; every foe kind glows in its own colour.
- The HUD now shows the blessings you have drafted, icon by icon, and the
  victory screen opens under a breaking dawn with fireworks.
- Wave shuffles draw from the run's seeded RNG, so a seed replays exactly.

## Play it

```sh
node serve.ts        # serves game/ on http://127.0.0.1:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored make.fun library.

## Screenshots

The four screenshots are deterministic renders of the game's own staged
scenes (`game/src/shots.js`), driven by `shots.json`:

| file | scene |
| --- | --- |
| `1-title.jpg` | title screen over the live attract arena |
| `2-play.jpg` | the wave-10 boss fight: the enraged Ash Titan in its spiral phase, a lancer's locked charge line, combo ×4 on the HUD |
| `3-victory.jpg` | victory screen with final stats |
| `4-draft.jpg` | the blessing draft between waves: three cards, the run's build in the HUD |
