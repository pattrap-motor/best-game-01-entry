// Pickups dropped by fallen enemies. They drift toward the player once inside
// the pickup radius (the magnet upgrade widens it) and apply on contact.
//   heal   — restores 20 health
//   shield — absorbs the next two hits (10 s)
//   spread — triple shot for 10 s
//   bomb   — damages every enemy on screen

import { range } from './random.js';

export const PICKUP_TYPES = {
  heal:   { color: '#7dff8a', label: '+20', life: 12 },
  shield: { color: '#5fe8ff', label: 'SHIELD', life: 12 },
  spread: { color: '#ffd97a', label: 'SPREAD', life: 12 },
  bomb:   { color: '#ff5a4e', label: 'BOMB', life: 12 },
};

export function spawnPickup(world, type, x, y) {
  world.pickups.push({
    type,
    x, y,
    vx: range(world.rng, -30, 30),
    vy: range(world.rng, -30, 30),
    life: PICKUP_TYPES[type].life,
    t: 0,
  });
}

export function applyPickup(world, pickup) {
  const p = world.player;
  const fx = world.fx;
  switch (pickup.type) {
    case 'heal':
      p.hp = Math.min(p.maxHp, p.hp + 20);
      fx.text(p.x, p.y - 26, '+20 HP', '#7dff8a', 16);
      world.audio.heal();
      break;
    case 'shield':
      p.shield = 2;
      p.shieldT = 10;
      fx.text(p.x, p.y - 26, 'SHIELD UP', '#5fe8ff', 16);
      world.audio.pickup();
      break;
    case 'spread':
      p.spreadT = 10;
      fx.text(p.x, p.y - 26, 'SPREAD SHOT!', '#ffd97a', 16);
      world.audio.pickup();
      break;
    case 'bomb':
      for (const e of [...world.enemies]) {
        world.damageEnemy(e, 120, true);
      }
      fx.burst(p.x, p.y, '#ffb347', 40, 420);
      fx.addShake(12);
      fx.stopTime(0.08);
      world.audio.explode(true);
      break;
  }
}
