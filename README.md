# EMBERWARD — Hold the Last Light

An original top-down arena shooter. The night has swallowed the valley; you
are the last Warden, and your lantern is the last light. Survive 10 waves of
embers, spitters, wisps, splitters and brutes, then slay the Ash Titan.

- **WASD / arrows** move, **mouse** aims, **hold click** fires, **Space** dashes
- **P** pauses, **M** mutes, **R** restarts after a run ends
- Between waves, pick one of three lantern blessings (damage, fire rate,
  multishot, pierce, speed, health, dash, magnet, crit, bullet speed)
- Pickups: heal, shield, spread shot, bomb. Best score is kept locally.
- All art is drawn in code and all sound is synthesised with WebAudio.
  No network requests, no assets, no build step.

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
| `2-play.jpg` | the wave-10 boss fight against the Ash Titan, HUD and boss bar visible |
| `3-victory.jpg` | victory screen with final stats |
| `4-over.jpg` | game-over screen with final stats |

[![Make the best game](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![Rank](https://make.fun/badge/best-game-01/pattrap-motor/best-game-01-entry/rank.svg)](https://make.fun/bounty/best-game-01)
[![Reward](https://make.fun/badge/best-game-01/pattrap-motor/best-game-01-entry/reward.svg)](https://make.fun/bounty/best-game-01)

Built for [Make the best game](https://make.fun/bounty/best-game-01) on make.fun.
