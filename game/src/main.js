// Boot and the main loop. The canvas is letterboxed to the 1280x720 logical
// view, the simulation advances in fixed 1/60 s steps, and rendering follows.
// URL modes:
//   ?shot=<scene>&seed=<n>  render one deterministic scene, set __shotReady
//   (no mode)               the playable game
// The state machine (title / playing / upgrade / over / victory) lives in
// world.js; this file only wires input, audio and the per-frame transitions.

import { VIEW_W, VIEW_H, STEP } from './config.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { createWorld, startGame, update, applyChoice } from './world.js';
import { drawWorld } from './render.js';
import { renderShot } from './shots.js';
import { loadMuted, saveMuted } from './storage.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const shotScene = params.get('shot');
const shotSeed = Number.parseInt(params.get('seed') ?? '7', 10) || 7;

// Letterbox: scale the 1280x720 view to the window, keep the aspect.
let scale = 1;
let offsetX = 0;
let offsetY = 0;
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  scale = Math.min(w / VIEW_W, h / VIEW_H);
  offsetX = (w - VIEW_W * scale) / 2;
  offsetY = (h - VIEW_H * scale) / 2;
  canvas.width = Math.round(VIEW_W * scale);
  canvas.height = Math.round(VIEW_H * scale);
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
}
window.addEventListener('resize', resize);
resize();

function toArena(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / scale,
    y: (clientY - rect.top) / scale,
  };
}

const audio = new AudioEngine();
audio.setMuted(loadMuted());
const input = new Input(canvas, toArena);

// --- screenshot mode: one deterministic frame, then stop -------------------
if (shotScene) {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  canvas.style.width = `${VIEW_W}px`;
  canvas.style.height = `${VIEW_H}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  renderShot(ctx, shotScene, shotSeed);
  // Nothing else to do: the scene is drawn and __shotReady is set.
} else {
  // --- the playable game --------------------------------------------------
  const world = createWorld((Math.random() * 0xffffffff) >>> 0, audio);
  world.lastMouse = { x: VIEW_W / 2, y: VIEW_H / 2 - 100 };

  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });

  let acc = 0;
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;

    // Mute toggle works on every screen.
    if (input.wasPressed('KeyM')) {
      audio.setMuted(!audio.muted);
      saveMuted(audio.muted);
    }

    if (world.phase === 'title') {
      if (input.mouse.clicked || input.wasPressed('Enter')) {
        audio.unlock();
        audio.uiClick();
        startGame(world);
      }
    } else if (world.phase === 'playing') {
      if (input.wasPressed('KeyP')) world.paused = !world.paused;
      if (!world.paused) {
        world.lastMouse = { x: input.mouse.x, y: input.mouse.y };
        while (acc >= STEP) {
          update(world, input, STEP);
          acc -= STEP;
          if (world.phase !== 'playing') { acc = 0; break; }
        }
      } else {
        acc = 0;
      }
    } else if (world.phase === 'upgrade') {
      // Click a card, or press 1 / 2 / 3.
      const choice = pickUpgradeChoice(world, input);
      if (choice !== -1) {
        audio.uiClick();
        applyChoice(world, choice);
      }
    } else if (world.phase === 'over' || world.phase === 'victory') {
      if (input.wasPressed('KeyR') || input.mouse.clicked || input.wasPressed('Enter')) {
        audio.uiClick();
        startGame(world);
      }
    }

    // Hover state for the upgrade cards (purely visual).
    world.hoverChoice = world.phase === 'upgrade' ? hoverChoiceIndex(world, input) : -1;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawWorld(ctx, world);
    input.endFrame();
    requestAnimationFrame(frame);
  }

  // Debug / test handle: the play-test reads the live state through this.
  window.__ember = {
    get phase() { return world.phase; },
    get score() { return world.score; },
    get wave() { return world.wave; },
    get kills() { return world.kills; },
    get hp() { return world.player.hp; },
    get enemies() { return world.enemies.length; },
    get choices() { return world.choices.length; },
    get player() { return { x: world.player.x, y: world.player.y }; },
    get foes() { return world.enemies.map((e) => ({ x: e.x, y: e.y, type: e.type })); },
    start: () => startGame(world),
  };

  requestAnimationFrame(frame);
}

// Which upgrade card (if any) the pointer or a number key picks.
function pickUpgradeChoice(world, input) {
  if (input.wasPressed('Digit1')) return 0;
  if (input.wasPressed('Digit2')) return 1;
  if (input.wasPressed('Digit3')) return 2;
  if (!input.mouse.clicked) return -1;
  const idx = hoverChoiceIndex(world, input);
  return idx;
}

function hoverChoiceIndex(world, input) {
  if (!world.choices || world.choices.length === 0) return -1;
  const cardW = 300;
  const cardH = 240;
  const gap = 36;
  const total = cardW * world.choices.length + gap * (world.choices.length - 1);
  const x0 = (VIEW_W - total) / 2;
  const y0 = 220;
  const m = input.mouse;
  for (let i = 0; i < world.choices.length; i++) {
    const x = x0 + i * (cardW + gap);
    if (m.x >= x && m.x <= x + cardW && m.y >= y0 && m.y <= y0 + cardH) return i;
  }
  return -1;
}
