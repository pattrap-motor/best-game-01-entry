// Deterministic screenshot scenes. Each scene builds a real world through the
// same createWorld/update/render path the game itself uses, drives it with a
// seeded RNG and a fixed number of simulated steps, then draws one frame.
// Nothing here is a mock: the title, the fight, the victory and the defeat the
// screenshots show are the game's own screens, staged with fixed inputs.
//
//   ?shot=title&seed=7    the title over a live arena
//   ?shot=play&seed=7     mid-fight on wave 4, HUD visible
//   ?shot=victory&seed=7  the victory screen with final stats
//   ?shot=over&seed=7     the game-over screen with final stats
// The renderer sets window.__shotReady once the scene has been drawn.

import { STEP } from './config.js';
import { createWorld, startGame, update, applyChoice, fireBullet } from './world.js';
import { spawnEnemy } from './enemies.js';
import { spawnPickup } from './pickups.js';
import { drawWorld } from './render.js';

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
    // Let the attract arena idle for a while so embers are wandering.
    for (let i = 0; i < 60 * 6; i++) update(world, scriptedInput(world, i), STEP);
    drawWorld(ctx, world);
  } else if (scene === 'play') {
    startGame(world);
    stageFight(world, 26);
    // The staged fight may have ended in a draft or a death; make sure the
    // frame shows live combat.
    if (world.phase === 'upgrade') applyChoice(world, 0);
    if (world.phase === 'over' || world.phase === 'victory') {
      startGame(world);
      stageFight(world, 12);
      if (world.phase === 'upgrade') applyChoice(world, 0);
    }
    // Re-stage a dense, readable fight around the centre of the arena: the
    // Warden in the middle, one of each foe kind closing in, bolts in the air.
    world.player.x = 640;
    world.player.y = 380;
    world.player.hp = world.player.maxHp;
    world.bullets = [];
    world.enemyBullets = [];
    world.enemies = [];
    world.fx.particles = [];
    world.fx.texts = [];
    world.fx.rings = [];
    const spots = [
      [830, 230, 'spitter'],
      [910, 430, 'brute'],
      [420, 210, 'wisp'],
      [310, 490, 'splitter'],
      [770, 170, 'cinder'],
      [470, 540, 'cinder'],
      [950, 280, 'spitter'],
    ];
    for (const [x, y, type] of spots) spawnEnemy(world, type, x, y);
    world.player.angle = Math.atan2(230 - 380, 830 - 640);
    fireBullet(world);
    world.player.angle = Math.atan2(430 - 380, 910 - 640);
    fireBullet(world);
    world.player.angle = Math.atan2(230 - 380, 830 - 640);
    world.fx.burst(700, 300, '#ffd97a', 12, 220);
    spawnPickup(world, 'heal', 520, 470);
    world.lastMouse = { x: 830, y: 230 };
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
    world.stats = { score: 18740, wave: 10, kills: 214, accuracy: 71, time: 742 };
    world.best = 18740;
    world.newBest = true;
    world.phase = 'victory';
    world.fx.burst(world.player.x, world.player.y, '#ffd97a', 40, 380);
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
    world.stats = { score: 8430, wave: 7, kills: 96, accuracy: 64, time: 388 };
    world.best = 8430;
    world.newBest = false;
    world.phase = 'over';
    world.player.hp = 0;
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
