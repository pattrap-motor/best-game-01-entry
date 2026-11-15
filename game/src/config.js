// EMBERWARD — tuning constants. One place for every number the game balances on,
// so a tweak here retunes the whole game without touching the logic.

export const VIEW_W = 1280;
export const VIEW_H = 720;

// The arena the fight happens in (the canvas keeps a margin for the HUD frame).
export const ARENA = { x: 40, y: 84, w: 1200, h: 596 };

export const WAVES_TOTAL = 10;

// Fixed simulation step: the world advances in 1/60 s slices, rendering is decoupled.
export const STEP = 1 / 60;

// Player base stats. Upgrades multiply from these.
export const PLAYER = {
  radius: 16,
  speed: 265,
  maxHp: 100,
  fireInterval: 0.22, // seconds between ember bolts
  bulletSpeed: 560,
  bulletDamage: 22,
  bulletRadius: 5,
  dashSpeed: 780,
  dashTime: 0.16,
  dashCooldown: 2.2,
  pickupRadius: 70,
  invulnTime: 0.7, // brief grace after taking a hit
};

// How the waves escalate. Wave 10 is the boss; the table below is composed in waves.js.
export const WAVE = {
  intermission: 4.5, // seconds of calm (and the upgrade choice) before the next wave
  spawnInterval: 0.9, // seconds between spawns at wave 1; shrinks per wave
  spawnIntervalMin: 0.22,
  hpScale: 0.16, // +16% enemy health per wave after the first
  speedScale: 0.03, // +3% enemy speed per wave after the first
  scorePerWave: 250, // bonus for clearing a wave, times the wave number
};

export const SCORE = {
  cinder: 50,
  emberling: 25,
  spitter: 90,
  wisp: 80,
  splitter: 120,
  brute: 200,
  boss: 5000,
};

// Drop chances on an enemy's death (rolled once per kill).
export const DROPS = {
  heal: 0.055,
  shield: 0.04,
  spread: 0.035,
  bomb: 0.025,
};

// Palette: ember orange against deep blue-black night. Every draw call reads from here.
export const PALETTE = {
  bg0: '#070a14',
  bg1: '#0d1322',
  arenaEdge: '#2a3350',
  grid: 'rgba(120, 150, 220, 0.055)',
  ember: '#ffb347',
  emberHot: '#ffd97a',
  emberDeep: '#ff7a2f',
  cinder: '#ff5a4e',
  spitter: '#c86bff',
  wisp: '#5fe8ff',
  splitter: '#9dff5f',
  brute: '#ff9a3d',
  boss: '#ff2e63',
  player: '#ffe9b0',
  playerRing: '#ffb347',
  hpGood: '#7dff8a',
  hpLow: '#ff5a4e',
  text: '#f2ead8',
  textDim: '#9aa5c4',
  cardBg: 'rgba(16, 22, 42, 0.92)',
  cardEdge: '#ffb347',
};
