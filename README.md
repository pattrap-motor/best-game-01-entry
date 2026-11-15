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
| `1-title.jpg` | title screen over the live arena |
| `2-play.jpg` | mid-fight on wave 4, HUD visible |
| `3-victory.jpg` | victory screen with final stats |
| `4-over.jpg` | game-over screen with final stats |
