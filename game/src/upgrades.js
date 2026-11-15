// The upgrade draft: after every cleared wave the player picks one of three.
// Each upgrade stacks (up to its cap) and changes how the run feels — damage and
// multishot for offence, speed and dash for movement, health and magnet for
// survival. The choice is the run's main decision point.

export const UPGRADES = [
  {
    id: 'damage',
    name: 'Ember Rounds',
    desc: '+25% bolt damage',
    icon: '✦',
    max: 5,
    apply(p) { p.damageMul *= 1.25; },
  },
  {
    id: 'firerate',
    name: 'Rapid Lantern',
    desc: '+20% fire rate',
    icon: '≋',
    max: 5,
    apply(p) { p.fireRateMul *= 1.2; },
  },
  {
    id: 'multishot',
    name: 'Twin Flames',
    desc: '+1 bolt per shot',
    icon: '❖',
    max: 3,
    apply(p) { p.multishot += 1; },
  },
  {
    id: 'pierce',
    name: 'Piercing Light',
    desc: 'Bolts pierce +1 enemy',
    icon: '➶',
    max: 3,
    apply(p) { p.pierce += 1; },
  },
  {
    id: 'speed',
    name: 'Swift Boots',
    desc: '+12% move speed',
    icon: '➤',
    max: 4,
    apply(p) { p.speedMul *= 1.12; },
  },
  {
    id: 'vitality',
    name: 'Lantern Heart',
    desc: '+25 max health, heal 25',
    icon: '♥',
    max: 5,
    apply(p) { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); },
  },
  {
    id: 'dash',
    name: 'Cinder Step',
    desc: 'Dash recharges 35% faster',
    icon: '↯',
    max: 3,
    apply(p) { p.dashCdMul *= 0.65; },
  },
  {
    id: 'magnet',
    name: 'Ember Magnet',
    desc: '+60% pickup radius',
    icon: '◎',
    max: 3,
    apply(p) { p.pickupMul *= 1.6; },
  },
  {
    id: 'crit',
    name: 'Kindled Edge',
    desc: '+10% critical chance (×2 damage)',
    icon: '✧',
    max: 4,
    apply(p) { p.crit += 0.1; },
  },
  {
    id: 'velocity',
    name: 'Long Burn',
    desc: '+25% bolt speed, +10% range',
    icon: '⟶',
    max: 3,
    apply(p) { p.bulletSpeedMul *= 1.25; },
  },
];

// Roll three distinct upgrades the player has not maxed out yet.
export function rollChoices(rng, owned) {
  const pool = UPGRADES.filter((u) => (owned[u.id] ?? 0) < u.max);
  const choices = [];
  while (choices.length < 3 && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    choices.push(pool.splice(i, 1)[0]);
  }
  return choices;
}
