// Enemy kinds, their stats and their behaviour. Seven kinds plus the boss:
//   cinder    — chases the player, the basic melee threat
//   spitter   — keeps its distance and lobs globs
//   wisp      — fast, telegraphs, then dashes through the player
//   splitter  — splits into two emberlings when killed
//   brute     — slow, armoured, hits hard
//   lancer    — telegraphs a charge line, then lances through the player
//   emberling — the splitter's children: small, quick, fragile
//   ash titan — the wave-10 boss: radial bursts, summons, and in its second
//               phase a twin spiral barrage under two-fifths health
// Every enemy is a plain object; update functions live here, damage and death
// in world.js. Health and speed scale with the wave (see waves.js).

import { clamp, dist2, angleTo, range } from './random.js';

export const ENEMY_TYPES = {
  cinder:    { hp: 30,  speed: 95,  radius: 15, damage: 12, score: 50,  color: '#ff5a4e' },
  emberling: { hp: 12,  speed: 165, radius: 9,  damage: 7,  score: 25,  color: '#ff8a5c' },
  spitter:   { hp: 42,  speed: 70,  radius: 14, damage: 10, score: 90,  color: '#c86bff' },
  wisp:      { hp: 24,  speed: 120, radius: 12, damage: 9,  score: 80,  color: '#5fe8ff' },
  splitter:  { hp: 55,  speed: 80,  radius: 18, damage: 14, score: 120, color: '#9dff5f' },
  brute:     { hp: 160, speed: 48,  radius: 26, damage: 22, score: 200, color: '#ff9a3d' },
  lancer:    { hp: 46,  speed: 108, radius: 13, damage: 16, score: 110, color: '#7a5cff' },
  boss:      { hp: 2400, speed: 55, radius: 52, damage: 28, score: 5000, color: '#ff2e63' },
};

export function spawnEnemy(world, type, x, y) {
  const def = ENEMY_TYPES[type];
  const hpScale = 1 + (world.wave - 1) * 0.16;
  const spScale = 1 + (world.wave - 1) * 0.03;
  const enemy = {
    type,
    x, y,
    vx: 0, vy: 0,
    hp: def.hp * hpScale,
    maxHp: def.hp * hpScale,
    speed: def.speed * spScale,
    radius: def.radius,
    damage: def.damage,
    score: def.score,
    color: def.color,
    flash: 0, // white hit-flash timer
    t: 0, // behaviour clock
    state: 'chase',
    stateT: 0,
    angle: 0,
    shootCd: range(world.rng, 1.2, 2.4),
    burst: 0, // boss radial-burst counter
    summonCd: 6,
    phase: 1,
    spiralT: 0, // boss phase-two spiral clock
    spiralA: 0, // boss spiral arm angle
  };
  world.enemies.push(enemy);
  world.fx.ring(x, y, def.color, def.radius + 14);
  return enemy;
}

// Pick a spawn point on the arena edge, away from the player.
export function edgeSpawn(world) {
  const { ARENA } = world;
  const side = Math.floor(world.rng() * 4);
  let x, y;
  if (side === 0) { x = range(world.rng, ARENA.x, ARENA.x + ARENA.w); y = ARENA.y + 12; }
  else if (side === 1) { x = range(world.rng, ARENA.x, ARENA.x + ARENA.w); y = ARENA.y + ARENA.h - 12; }
  else if (side === 2) { x = ARENA.x + 12; y = range(world.rng, ARENA.y, ARENA.y + ARENA.h); }
  else { x = ARENA.x + ARENA.w - 12; y = range(world.rng, ARENA.y, ARENA.y + ARENA.h); }
  // Keep spawns off the player so nothing appears on top of them.
  if (dist2(x, y, world.player.x, world.player.y) < 220 * 220) {
    x = ARENA.x + ARENA.w - (x - ARENA.x);
    y = ARENA.y + ARENA.h - (y - ARENA.y);
  }
  return { x, y };
}

function steer(enemy, tx, ty, speed, dt) {
  const a = angleTo(enemy.x, enemy.y, tx, ty);
  enemy.vx = Math.cos(a) * speed;
  enemy.vy = Math.sin(a) * speed;
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.angle = a;
}

export function updateEnemy(world, e, dt) {
  const p = world.player;
  const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
  e.t += dt;
  e.stateT += dt;
  if (e.flash > 0) e.flash -= dt;

  switch (e.type) {
    case 'cinder':
    case 'emberling':
    case 'splitter':
    case 'brute': {
      // Straight chase, with a little wobble so packs don't stack perfectly.
      const wobble = Math.sin(e.t * 2.1 + e.x * 0.01) * 0.35;
      const a = angleTo(e.x, e.y, p.x, p.y) + wobble;
      e.x += Math.cos(a) * e.speed * dt;
      e.y += Math.sin(a) * e.speed * dt;
      e.angle = a;
      break;
    }
    case 'spitter': {
      // Hold a ring around the player and lob a glob every couple of seconds.
      const want = 260;
      const a = angleTo(e.x, e.y, p.x, p.y);
      const radial = d > want + 30 ? 1 : d < want - 30 ? -1 : 0;
      e.x += Math.cos(a) * e.speed * radial * dt;
      e.y += Math.sin(a) * e.speed * radial * dt;
      // Slow strafe so the player can't just stand still.
      e.x += Math.cos(a + Math.PI / 2) * e.speed * 0.45 * dt * Math.sin(e.t * 0.8);
      e.y += Math.sin(a + Math.PI / 2) * e.speed * 0.45 * dt * Math.sin(e.t * 0.8);
      e.angle = a;
      e.shootCd -= dt;
      if (e.shootCd <= 0 && d < 520) {
        e.shootCd = range(world.rng, 2.0, 2.8);
        world.spawnEnemyBullet(e.x, e.y, a, 190, 8, e.color);
        world.audio.enemyShoot();
      }
      break;
    }
    case 'wisp': {
      // Telegraph (glow + slow drift) then dash through the player's position.
      if (e.state === 'chase') {
        steer(e, p.x, p.y, e.speed, dt);
        if (e.stateT > 1.6 && d < 340) {
          e.state = 'aim';
          e.stateT = 0;
          e.angle = angleTo(e.x, e.y, p.x, p.y);
        }
      } else if (e.state === 'aim') {
        e.x += Math.cos(e.angle) * 12 * dt;
        e.y += Math.sin(e.angle) * 12 * dt;
        if (e.stateT > 0.55) {
          e.state = 'dash';
          e.stateT = 0;
          world.audio.dash();
        }
      } else {
        e.x += Math.cos(e.angle) * 520 * dt;
        e.y += Math.sin(e.angle) * 520 * dt;
        if (e.stateT > 0.42) {
          e.state = 'chase';
          e.stateT = 0;
        }
      }
      break;
    }
    case 'lancer': {
      // Approach, telegraph a charge line, then lance through the player's
      // position. The aim tracks early and locks late — the locked line is
      // the player's cue to move — and a spent lancer recovers slowly,
      // which is the price of a missed charge.
      if (e.state === 'chase') {
        steer(e, p.x, p.y, e.speed, dt);
        if (e.stateT > 1.1 && d < 430) {
          e.state = 'aim';
          e.stateT = 0;
          e.angle = angleTo(e.x, e.y, p.x, p.y);
        }
      } else if (e.state === 'aim') {
        if (e.stateT < 0.38) e.angle = angleTo(e.x, e.y, p.x, p.y);
        if (e.stateT > 0.7) {
          e.state = 'charge';
          e.stateT = 0;
          world.audio.dash();
        }
      } else if (e.state === 'charge') {
        e.x += Math.cos(e.angle) * 640 * dt;
        e.y += Math.sin(e.angle) * 640 * dt;
        if (e.stateT > 0.55) {
          e.state = 'recover';
          e.stateT = 0;
        }
      } else {
        steer(e, p.x, p.y, e.speed * 0.3, dt);
        if (e.stateT > 0.7) {
          e.state = 'chase';
          e.stateT = 0;
        }
      }
      break;
    }
    case 'boss': {
      // The Ash Titan: slow chase, radial bursts, and cinder summons.
      // Under half health it enrages: faster bursts, faster chase.
      if (e.hp < e.maxHp * 0.5 && e.phase === 1) {
        e.phase = 2;
        e.speed *= 1.5;
        world.audio.bossRoar();
        world.fx.burst(e.x, e.y, e.color, 40);
        world.banner('THE ASH TITAN ENRAGES', '#ff2e63');
      }
      steer(e, p.x, p.y, e.speed, dt);
      e.shootCd -= dt;
      if (e.shootCd <= 0) {
        e.shootCd = e.phase === 2 ? 1.7 : 2.4;
        const n = e.phase === 2 ? 14 : 10;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + e.t;
          world.spawnEnemyBullet(e.x, e.y, a, 150, 12, e.color);
        }
        world.audio.enemyShoot();
        world.fx.ring(e.x, e.y, e.color, e.radius + 26);
      }
      e.summonCd -= dt;
      if (e.summonCd <= 0 && world.enemies.length < 26) {
        e.summonCd = e.phase === 2 ? 6 : 9;
        for (let i = 0; i < 3; i++) {
          const s = edgeSpawn(world);
          spawnEnemy(world, 'cinder', s.x, s.y);
        }
        world.banner('THE TITAN CALLS ITS KIND', '#ff9a3d');
      }
      // Phase two's second voice: below two-fifths health the Titan weaves
      // a twin spiral over its bursts — slower orbs, but no gap to stand in.
      if (e.phase === 2 && e.hp < e.maxHp * 0.4) {
        e.spiralT -= dt;
        if (e.spiralT <= 0) {
          e.spiralT = 0.13;
          e.spiralA += 0.45;
          for (const arm of [0, Math.PI]) {
            world.spawnEnemyBullet(e.x, e.y, e.spiralA + arm, 118, 10, '#ff7a2f');
          }
        }
      }
      break;
    }
  }

  // Stay inside the arena.
  e.x = clamp(e.x, world.ARENA.x + e.radius, world.ARENA.x + world.ARENA.w - e.radius);
  e.y = clamp(e.y, world.ARENA.y + e.radius, world.ARENA.y + world.ARENA.h - e.radius);
}
