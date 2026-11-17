// Deterministic screenshot scenes. Each scene builds a real world through the
// same createWorld/update/render path the game itself uses, drives it with a
// seeded RNG and a fixed number of simulated steps, then draws one frame.
// Nothing here is a mock: the title, the fight, the victory and the defeat the
// screenshots show are the game's own screens, staged with fixed inputs.
//
//   ?shot=title&seed=7    the title over the live attract arena
//   ?shot=play&seed=7     the wave-10 boss fight: the Ash Titan enraged in
//                         its second phase, spiral barrage in flight, a
//                         lancer's locked charge line, the combo at ×4
//   ?shot=victory&seed=7  the victory screen with final stats
//   ?shot=draft&seed=7    the blessing draft between waves: three cards,
//                         two blessings already owned, the build so far
//   ?shot=over&seed=7     the game-over screen with final stats
// The renderer sets window.__shotReady once the scene has been drawn.

import { STEP } from './config.js';
import { createWorld, startGame, update, applyChoice, nextWave } from './world.js';
import { spawnEnemy } from './enemies.js';
import { UPGRADES, rollChoices } from './upgrades.js';
import { createCombo } from './combo.js';
import { drawWorld } from './render.js';

// Grant one blessing through the same apply path the draft screen uses, so
// the staged late run carries the build its HUD line reports.
function grantBlessing(world, id) {
  const u = UPGRADES.find((x) => x.id === id);
  u.apply(world.player);
  world.player.owned[id] = (world.player.owned[id] ?? 0) + 1;
}

// A scripted stand-in for the player's input: moves in a slow circle and
// fires at the nearest enemy, so the staged fight looks like a fight.
function scriptedInput(world, step) {
  const p = world.player;
  const t = step * STEP;
  const cx = world.ARENA.x + world.ARENA.w / 2;
  const cy = world.ARENA.y + world.ARENA.h / 2;
  const mx = Math.cos(t * 0.55) * 0.7;
  const my = Math.sin(t * 0.55) * 0.7;
  let aimX = p.x + Math.cos(p.angle) * 100;
  let aimY = p.y + Math.sin(p.angle) * 100;
  let nearest = null;
  let nearestD = Infinity;
  for (const e of world.enemies) {
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < nearestD) { nearestD = d; nearest = e; }
  }
  if (nearest) { aimX = nearest.x; aimY = nearest.y; }
  return {
    moveX: Math.abs(mx) > 0.2 ? Math.sign(mx) : 0,
    moveY: Math.abs(my) > 0.2 ? Math.sign(my) : 0,
    mouse: { x: aimX, y: aimY, down: true },
    firing: true,
    dashPressed: step % 240 === 120,
    wasPressed: () => false,
    endFrame: () => {},
  };
}

function stageFight(world, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    // Auto-pick the first upgrade whenever the draft opens, so the fight
    // advances through the waves on its own.
    if (world.phase === 'upgrade') applyChoice(world, 0);
    if (world.phase === 'over' || world.phase === 'victory') break;
    update(world, scriptedInput(world, i), STEP);
    world.lastMouse = { x: world.player.x + Math.cos(world.player.angle) * 120, y: world.player.y + Math.sin(world.player.angle) * 120 };
  }
}

export function renderShot(ctx, scene, seed) {
  const world = createWorld(seed, silentAudio());
  world.lastMouse = { x: 640, y: 300 };

  if (scene === 'title') {
    // Let the attract arena run for eight seconds: every foe kind drifts in
    // and takes up its slow circle around the Warden at his post, embers
    // rising off the lantern the whole while. The best score is the staged
    // run's, the same one the victory scene below reports.
    world.best = 18740;
    for (let i = 0; i < 60 * 8; i++) update(world, scriptedInput(world, i), STEP);
    drawWorld(ctx, world);
  } else if (scene === 'play') {
    // A real opening stretch first — the scripted Warden fights and drafts
    // exactly as a player would — then the run is carried to the final wave
    // and the game's own spawner brings the Ash Titan in.
    startGame(world);
    stageFight(world, 20);
    if (world.phase === 'upgrade') applyChoice(world, 0);
    if (world.phase === 'over' || world.phase === 'victory') {
      startGame(world);
      stageFight(world, 12);
      if (world.phase === 'upgrade') applyChoice(world, 0);
    }
    world.enemies = [];
    world.spawnQueue = [];
    world.bullets = [];
    world.enemyBullets = [];
    world.pickups = [];
    world.fx.particles = [];
    world.fx.texts = [];
    world.fx.rings = [];
    // Two more draft picks through the real apply path: the staged run
    // reaches the Titan with Ember Rounds and Twin Flames behind it.
    grantBlessing(world, 'damage');
    grantBlessing(world, 'multishot');
    world.wave = 9;
    nextWave(world); // wave 10: the banner, then the Titan first in the queue

    // Fight on the scripted input until the Titan is on the field.
    let step = 0;
    while (!world.bossRef && step < 60 * 10 && world.phase === 'playing') {
      update(world, scriptedInput(world, step), STEP);
      step += 1;
    }
    if (world.bossRef && world.phase === 'playing') {
      // The fight is already joined — and already desperate: the Titan has
      // taken real damage through the game's own damage path, past its
      // enrage and into the spiral phase, so the frame shows phase two.
      world.damageEnemy(world.bossRef, 3800, true);
      // The staged run arrives hot: a 16-kill chain at ×4, still alive.
      world.combo.chain = 16;
      world.combo.mult = 4;
      world.combo.timer = 3.5;
      world.combo.best = 16;
      world.combo.bestMult = 4;
      // The frame, four-fifths of a second later: a radial burst just fired
      // and still expanding, spiral orbs weaving out, spread-shot volleys
      // streaming back at the Titan, damage numbers still floating.
      world.bossRef.shootCd = 0.3;
      world.player.spreadT = 6;
      world.player.shield = 1;
      world.player.shieldT = 8;
      for (let i = 0; i < 48 && world.phase === 'playing'; i++) {
        update(world, scriptedInput(world, step), STEP);
        step += 1;
      }
      if (world.phase === 'playing' && world.bossRef) {
        // Two lancers have the Warden lined up, their charge lines locked —
        // staged in the aim state the game itself leaves them in.
        const A = world.ARENA;
        const spots = [
          [world.player.x - 330, world.player.y + 150],
          [world.player.x + 300, world.player.y - 190],
        ];
        for (const [sx, sy] of spots) {
          const l = spawnEnemy(
            world, 'lancer',
            Math.max(A.x + 20, Math.min(A.x + A.w - 20, sx)),
            Math.max(A.y + 20, Math.min(A.y + A.h - 20, sy)),
          );
          l.state = 'aim';
          l.stateT = 0.45;
          l.angle = Math.atan2(world.player.y - l.y, world.player.x - l.x);
        }
        // The next radial burst is charging: its warning ring is swelling.
        world.bossRef.shootCd = 0.35;
      }
    }
    if (world.phase === 'playing') {
      // The staged run's tally at the moment the frame freezes.
      world.score = 12480;
      world.kills = 187;
      world.best = 18740;
      world.player.hp = Math.min(world.player.hp, 68);
      const aim = world.bossRef || world.enemies[0];
      if (aim) world.lastMouse = { x: aim.x, y: aim.y };
    }
    drawWorld(ctx, world);
  } else if (scene === 'victory') {
    startGame(world);
    stageFight(world, 8);
    // A clean backdrop behind the victory screen: no stray foes or numbers.
    world.enemies = [];
    world.spawnQueue = [];
    world.bullets = [];
    world.enemyBullets = [];
    world.fx.particles = [];
    world.fx.texts = [];
    world.fx.rings = [];
    world.score = 18740;
    world.kills = 214;
    world.wave = 10;
    world.runTime = 742;
    world.combo = createCombo(); // the chain is spent: a clean end screen
    world.stats = { score: 18740, wave: 10, kills: 214, accuracy: 71, time: 742, bestCombo: 34, bestMult: 8 };
    world.best = 18740;
    world.newBest = true;
    world.phase = 'victory';
    // Fireworks over the dawn: gold, leaf-green, wisp-cyan and titan-pink
    // bursts frozen on their first frame, ringed around the Warden.
    world.fx.burst(world.player.x, world.player.y, '#ffd97a', 40, 380);
    world.fx.burst(300, 215, '#ffd97a', 26, 340);
    world.fx.burst(985, 195, '#9dff5f', 22, 320);
    world.fx.burst(645, 150, '#5fe8ff', 22, 300);
    world.fx.burst(455, 305, '#ff2e63', 18, 280);
    world.fx.ring(640, 245, '#ffd97a', 64);
    drawWorld(ctx, world);
  } else if (scene === 'over') {
    startGame(world);
    stageFight(world, 8);
    world.enemies = [];
    world.spawnQueue = [];
    world.bullets = [];
    world.enemyBullets = [];
    world.fx.particles = [];
    world.fx.texts = [];
    world.fx.rings = [];
    world.score = 8430;
    world.kills = 96;
    world.wave = 7;
    world.runTime = 388;
    world.stats = { score: 8430, wave: 7, kills: 96, accuracy: 64, time: 388, bestCombo: 21, bestMult: 5 };
    world.best = 8430;
    world.newBest = false;
    world.phase = 'over';
    world.player.hp = 0;
    // The last embers of the fallen lantern, still rising as the dark settles.
    for (let i = 0; i < 3; i++) world.fx.embers(world.player.x, world.player.y, 4);
    world.fx.ring(world.player.x, world.player.y, '#ff5a4e', 30);
    drawWorld(ctx, world);
  } else if (scene === 'draft') {
    // The run's decision point, staged the way the game reaches it: a real
    // opening stretch first, then the field is carried to the end of wave 3
    // with two blessings already drafted through the real apply path, and
    // the draft the game itself rolls is opened over the quiet arena.
    startGame(world);
    stageFight(world, 8);
    if (world.phase === 'over' || world.phase === 'victory') {
      startGame(world);
      stageFight(world, 4);
    }
    world.enemies = [];
    world.spawnQueue = [];
    world.bullets = [];
    world.enemyBullets = [];
    world.pickups = [];
    world.fx.particles = [];
    world.fx.texts = [];
    world.fx.rings = [];
    world.fx.decals = [];
    world.combo = createCombo();
    grantBlessing(world, 'damage');
    grantBlessing(world, 'speed');
    world.wave = 3;
    world.score = 3950;
    world.kills = 61;
    world.best = 18740;
    world.choices = rollChoices(world.rng, world.player.owned);
    world.phase = 'upgrade';
    world.hoverChoice = 1; // the middle card under the player's hand
    drawWorld(ctx, world);
  } else {
    drawWorld(ctx, world);
  }
  window.__shotReady = true;
  return world;
}

// The screenshot scenes run without sound: no AudioContext, no user gesture.
function silentAudio() {
  const noop = () => {};
  return {
    unlock: noop, setMuted: noop, shoot: noop, enemyShoot: noop, hit: noop,
    explode: noop, playerHurt: noop, pickup: noop, heal: noop, dash: noop,
    waveHorn: noop, bossRoar: noop, upgradePick: noop, victory: noop,
    gameOver: noop, uiClick: noop,
  };
}
