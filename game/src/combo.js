// The kill-chain combo: the run's second engine. Every kill inside the
// window keeps the chain alive; every few links the score multiplier steps
// up, to a cap of eightfold. Let the timer drain and the chain — and the
// multiplier — is gone. The draft builds the Warden between waves; the
// chain pays for greed inside them. Only world.js changes this state;
// render.js reads it to draw the meter and the pops.

import { COMBO } from './config.js';

export function createCombo() {
  return { chain: 0, mult: 1, timer: 0, best: 0, bestMult: 1 };
}

// Register one kill against the chain. Returns what the kill pays — its
// base score times the multiplier in force — and whether the multiplier
// just rose, so the caller can celebrate the step.
export function registerKill(combo, baseScore) {
  combo.chain += 1;
  combo.timer = COMBO.window;
  const mult = Math.min(
    COMBO.maxMult,
    1 + Math.floor(combo.chain / COMBO.killsPerTier),
  );
  const tierUp = mult > combo.mult;
  combo.mult = mult;
  if (combo.chain > combo.best) combo.best = combo.chain;
  if (mult > combo.bestMult) combo.bestMult = mult;
  return { gained: baseScore * mult, tierUp };
}

// Age the chain: when the window runs out, the chain and its multiplier reset.
export function updateCombo(combo, dt) {
  if (combo.timer <= 0) return;
  combo.timer -= dt;
  if (combo.timer <= 0) {
    combo.timer = 0;
    combo.chain = 0;
    combo.mult = 1;
  }
}

// The chain heats up as it climbs: pale gold, ember, deep ember, titan pink.
export function comboColor(mult) {
  if (mult >= 7) return '#ff2e63';
  if (mult >= 5) return '#ff7a2f';
  if (mult >= 3) return '#ffb347';
  return '#ffd97a';
}
