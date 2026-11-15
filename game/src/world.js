// The world: one state object, advanced in fixed 1/60 s steps. Phases:
//   title    — attract screen, the arena idles behind it
//   playing  — the fight
//   upgrade  — draft choice between waves (game paused)
//   over     — game over, stats shown
//   victory  — the Titan is dead, run complete
// world.js owns the rules (movement, firing, collisions, waves, scoring);
// render.js only draws whatever state this holds.

import { ARENA, PLAYER, WAVES_TOTAL, WAVE, SCORE, DROPS } from './config.js';
import { clamp, dist2, angleTo, range } from './random.js';
import { FX } from './particles.js';
import { spawnEnemy, edgeSpawn, updateEnemy } from './enemies.js';
import { waveComp, spawnInterval, waveTitle } from './waves.js';
import { spawnPickup, applyPickup } from './pickups.js';
import { rollChoices } from './upgrades.js';
import { loadBest, saveBest } from './storage.js';

export function createWorld(seed, audio) {
  const rng = (() => {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  return {
    seed,
    rng,
    audio,
    ARENA,
    phase: 'title',
    time: 0,
    wave: 0,
    score: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    best: loadBest(),
    newBest: false,
    player: freshPlayer(),
    bullets: [],
    enemyBullets: [],
    enemies: [],
    pickups: [],
    fx: new FX(rng),
    spawnQueue: [],
    spawnTimer: 0,
    intermission: 0,
    bannerText: '',
    bannerColor: '#ffb347',
    bannerT: 0,
    choices: [],
    runTime: 0,
    stats: null,
    paused: false,
    bossRef: null,
    // Methods other modules call on the world (kept here so enemies.js and
    // pickups.js never need to import world.js back).
    banner(text, color) {
      this.bannerText = text;
      this.bannerColor = color || '#ffb347';
      this.bannerT = 2.6;
    },
    spawnEnemyBullet(x, y, angle, speed, damage, color) {
      this.enemyBullets.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage,
        radius: 7,
        color,
        life: 4,
      });
    },
    damageEnemy(e, amount, silent = false) {
      damageEnemy(this, e, amount, silent);
    },
  };
}

export function freshPlayer() {
  return {
    x: ARENA.x + ARENA.w / 2,
    y: ARENA.y + ARENA.h / 2,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    radius: PLAYER.radius,
    fireCd: 0,
    dashT: 0, // remaining dash time (while > 0 the player is dashing)
    dashCd: 0,
    dashDirX: 0, dashDirY: -1,
    invulnT: 0,
    shield: 0,
    shieldT: 0,
    spreadT: 0,
    // Upgrade-derived multipliers, applied by upgrades.js.
    damageMul: 1,
    fireRateMul: 1,
    speedMul: 1,
    dashCdMul: 1,
    pickupMul: 1,
    bulletSpeedMul: 1,
    multishot: 0,
    pierce: 0,
    crit: 0,
    owned: {},
  };
}

export function startGame(world) {
  world.player = freshPlayer();
  world.bullets = [];
  world.enemyBullets = [];
  world.enemies = [];
  world.pickups = [];
  world.score = 0;
  world.kills = 0;
  world.shotsFired = 0;
  world.shotsHit = 0;
  world.wave = 0;
  world.runTime = 0;
  world.newBest = false;
  world.stats = null;
  world.bossRef = null;
  world.phase = 'playing';
  nextWave(world);
}

export function nextWave(world) {
  world.wave += 1;
  world.spawnQueue = waveComp(world.wave);
  world.spawnTimer = 0.4;
  world.banner(waveTitle(world.wave), world.wave === WAVES_TOTAL ? '#ff2e63' : '#ffb347');
  if (world.wave === WAVES_TOTAL) world.audio.bossRoar();
  else world.audio.waveHorn();
}

// --- combat ---------------------------------------------------------------

export function fireBullet(world) {
  const p = world.player;
  const speed = PLAYER.bulletSpeed * p.bulletSpeedMul;
  const count = 1 + p.multishot + (p.spreadT > 0 ? 2 : 0);
  const spread = 0.14;
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * spread;
    const a = p.angle + off;
    world.bullets.push({
      x: p.x + Math.cos(a) * (p.radius + 8),
      y: p.y + Math.sin(a) * (p.radius + 8),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      damage: PLAYER.bulletDamage * p.damageMul,
      radius: PLAYER.bulletRadius,
      pierce: p.pierce,
      hitSet: new Set(),
      life: 1.1,
    });
  }
  world.shotsFired += 1;
  p.fireCd = PLAYER.fireInterval / p.fireRateMul;
  world.audio.shoot();
  world.fx.embers(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22, 1);
}

export function spawnEnemyBullet(world, x, y, angle, speed, damage, color) {
  world.spawnEnemyBullet(x, y, angle, speed, damage, color);
}

export function damageEnemy(world, e, amount, silent = false) {
  e.hp -= amount;
  e.flash = 0.09;
  if (!silent) {
    world.fx.text(e.x + range(world.rng, -8, 8), e.y - e.radius - 6, String(Math.round(amount)), '#ffd97a', 13);
  }
  if (e.hp <= 0) killEnemy(world, e);
}

export function killEnemy(world, e) {
  const idx = world.enemies.indexOf(e);
  if (idx === -1) return;
  world.enemies.splice(idx, 1);
  world.kills += 1;
  world.score += e.score;
  world.fx.burst(e.x, e.y, e.color, e.type === 'boss' ? 60 : e.type === 'brute' ? 26 : 14);
  world.fx.ring(e.x, e.y, e.color, e.radius + 10);
  world.fx.addShake(e.type === 'boss' ? 14 : e.type === 'brute' ? 6 : 2);
  if (e.type === 'boss') world.fx.stopTime(0.25);
  world.audio.explode(e.type === 'boss' || e.type === 'brute');

  if (e.type === 'splitter') {
    for (let i = 0; i < 2; i++) {
      spawnEnemy(world, 'emberling', e.x + range(world.rng, -20, 20), e.y + range(world.rng, -20, 20));
    }
  }
  if (e.type === 'boss') {
    world.bossRef = null;
    winRun(world);
    return;
  }

  // Drops, one roll per kill.
  const roll = world.rng();
  if (roll < DROPS.heal) spawnPickup(world, 'heal', e.x, e.y);
  else if (roll < DROPS.heal + DROPS.shield) spawnPickup(world, 'shield', e.x, e.y);
  else if (roll < DROPS.heal + DROPS.shield + DROPS.spread) spawnPickup(world, 'spread', e.x, e.y);
  else if (roll < DROPS.heal + DROPS.shield + DROPS.spread + DROPS.bomb) spawnPickup(world, 'bomb', e.x, e.y);
}

export function damagePlayer(world, amount) {
  const p = world.player;
  if (p.invulnT > 0 || p.dashT > 0 || world.phase !== 'playing') return;
  if (p.shield > 0) {
    p.shield -= 1;
    p.invulnT = PLAYER.invulnTime;
    world.fx.ring(p.x, p.y, '#5fe8ff', 34);
    world.audio.hit();
    return;
  }
  p.hp -= amount;
  p.invulnT = PLAYER.invulnTime;
  world.fx.hurtFlash();
  world.fx.addShake(7);
  world.fx.burst(p.x, p.y, '#ff5a4e', 10);
  world.audio.playerHurt();
  if (p.hp <= 0) {
    p.hp = 0;
    endRun(world, false);
  }
}

function finishStats(world) {
  const accuracy = world.shotsFired > 0
    ? Math.min(100, Math.round((world.shotsHit / world.shotsFired) * 100))
    : 0;
  world.stats = {
    score: world.score,
    wave: world.wave,
    kills: world.kills,
    accuracy,
    time: world.runTime,
  };
  if (world.score > world.best) {
    world.best = world.score;
    world.newBest = true;
    saveBest(world.score);
  }
}

export function endRun(world, won) {
  if (won) return; // victory goes through winRun
  finishStats(world);
  world.phase = 'over';
  world.audio.gameOver();
  world.fx.burst(world.player.x, world.player.y, '#ffb347', 50, 380);
}

export function winRun(world) {
  world.score += SCORE.boss; // boss bounty, on top of its kill score
  finishStats(world);
  world.phase = 'victory';
  world.audio.victory();
  world.fx.burst(world.player.x, world.player.y, '#ffd97a', 60, 420);
}

// --- per-step update --------------------------------------------------------

export function update(world, input, dt) {
  world.time += dt;
  if (world.bannerT > 0) world.bannerT -= dt;
  world.fx.update(dt);

  if (world.phase === 'title') {
    // Idle drift: a few embers wander the arena behind the title.
    if (world.enemies.length < 5 && world.rng() < dt * 0.5) {
      const s = edgeSpawn(world);
      spawnEnemy(world, 'cinder', s.x, s.y);
    }
    for (const e of world.enemies) updateEnemy(world, e, dt);
    return;
  }

  if (world.phase === 'upgrade' || world.phase === 'over' || world.phase === 'victory') {
    for (const e of world.enemies) updateEnemy(world, e, dt);
    return;
  }

  // --- playing ---
  if (world.paused) return;
  world.runTime += dt;
  const p = world.player;

  // Hit-stop freezes the world briefly after heavy impacts.
  if (world.fx.hitStop > 0) {
    world.fx.hitStop -= dt;
    return;
  }

  // Movement + dash.
  let mx = input.moveX;
  let my = input.moveY;
  const mag = Math.hypot(mx, my);
  if (mag > 0) { mx /= mag; my /= mag; }
  if (input.dashPressed && p.dashCd <= 0 && mag > 0) {
    p.dashT = PLAYER.dashTime;
    p.dashCd = PLAYER.dashCooldown * p.dashCdMul;
    p.dashDirX = mx;
    p.dashDirY = my;
    world.audio.dash();
    world.fx.ring(p.x, p.y, '#ffd97a', 26);
  }
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.x += p.dashDirX * PLAYER.dashSpeed * dt;
    p.y += p.dashDirY * PLAYER.dashSpeed * dt;
    world.fx.embers(p.x, p.y, 1);
  } else {
    const speed = PLAYER.speed * p.speedMul;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
  }
  p.x = clamp(p.x, ARENA.x + p.radius, ARENA.x + ARENA.w - p.radius);
  p.y = clamp(p.y, ARENA.y + p.radius, ARENA.y + ARENA.h - p.radius);
  p.angle = angleTo(p.x, p.y, input.mouse.x, input.mouse.y);
  if (p.dashCd > 0) p.dashCd -= dt;
  if (p.invulnT > 0) p.invulnT -= dt;
  if (p.shieldT > 0) { p.shieldT -= dt; if (p.shieldT <= 0) p.shield = 0; }
  if (p.spreadT > 0) p.spreadT -= dt;

  // Firing (hold to fire).
  p.fireCd -= dt;
  if (input.firing && p.fireCd <= 0) fireBullet(world);

  // Spawning.
  if (world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      world.spawnTimer = spawnInterval(world.wave);
      const type = world.spawnQueue.shift();
      const s = edgeSpawn(world);
      const e = spawnEnemy(world, type, s.x, s.y);
      if (type === 'boss') world.bossRef = e;
    }
  }

  // Enemies.
  for (const e of [...world.enemies]) updateEnemy(world, e, dt);

  // Player bullets vs enemies.
  for (const b of [...world.bullets]) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    for (const e of [...world.enemies]) {
      if (b.hitSet.has(e)) continue;
      const rr = e.radius + b.radius;
      if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
        b.hitSet.add(e);
        world.shotsHit += 1;
        let dmg = b.damage;
        let crit = false;
        if (world.rng() < p.crit) { dmg *= 2; crit = true; }
        damageEnemy(world, e, dmg);
        world.fx.burst(b.x, b.y, '#ffd97a', crit ? 8 : 4, 180);
        world.audio.hit();
        if (b.pierce > 0) {
          b.pierce -= 1;
        } else {
          b.life = 0;
          break;
        }
      }
    }
    if (b.life <= 0) world.bullets.splice(world.bullets.indexOf(b), 1);
  }
  world.bullets = world.bullets.filter(
    (b) => b.life > 0 && b.x > ARENA.x - 20 && b.x < ARENA.x + ARENA.w + 20 && b.y > ARENA.y - 20 && b.y < ARENA.y + ARENA.h + 20,
  );

  // Enemy bullets vs player.
  for (const b of [...world.enemyBullets]) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    const rr = p.radius + b.radius - 4;
    if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
      b.life = 0;
      damagePlayer(world, b.damage);
    }
    if (b.life <= 0) world.enemyBullets.splice(world.enemyBullets.indexOf(b), 1);
  }
  world.enemyBullets = world.enemyBullets.filter(
    (b) => b.life > 0 && b.x > ARENA.x - 30 && b.x < ARENA.x + ARENA.w + 30 && b.y > ARENA.y - 30 && b.y < ARENA.y + ARENA.h + 30,
  );

  // Touch damage.
  for (const e of world.enemies) {
    const rr = e.radius + p.radius - 4;
    if (dist2(e.x, e.y, p.x, p.y) < rr * rr) {
      damagePlayer(world, e.damage);
      // Push the enemy back a little so one touch isn't a chain of hits.
      const a = angleTo(p.x, p.y, e.x, e.y);
      e.x += Math.cos(a) * 26;
      e.y += Math.sin(a) * 26;
    }
  }

  // Pickups: drift, magnet, collect.
  const pickupR = PLAYER.pickupRadius * p.pickupMul;
  for (const pk of [...world.pickups]) {
    pk.t += dt;
    pk.life -= dt;
    pk.x += pk.vx * dt;
    pk.y += pk.vy * dt;
    pk.vx *= 0.96;
    pk.vy *= 0.96;
    const d2 = dist2(pk.x, pk.y, p.x, p.y);
    if (d2 < pickupR * pickupR) {
      const a = angleTo(pk.x, pk.y, p.x, p.y);
      pk.x += Math.cos(a) * 320 * dt;
      pk.y += Math.sin(a) * 320 * dt;
    }
    if (d2 < (p.radius + 12) * (p.radius + 12)) {
      applyPickup(world, pk);
      world.pickups.splice(world.pickups.indexOf(pk), 1);
    } else if (pk.life <= 0) {
      world.pickups.splice(world.pickups.indexOf(pk), 1);
    }
  }

  // Wave cleared: draft an upgrade, or finish the intermission.
  if (world.spawnQueue.length === 0 && world.enemies.length === 0) {
    if (world.wave >= WAVES_TOTAL) return; // victory already handled by boss death
    world.score += WAVE.scorePerWave * world.wave;
    if (world.wave < WAVES_TOTAL) {
      world.choices = rollChoices(world.rng, p.owned);
      world.phase = 'upgrade';
      world.audio.upgradePick();
    }
  }
}

// Apply a drafted upgrade (choice index 0..2) and start the next wave.
export function applyChoice(world, index) {
  const choice = world.choices[index];
  if (!choice) return;
  choice.apply(world.player);
  world.player.owned[choice.id] = (world.player.owned[choice.id] ?? 0) + 1;
  world.choices = [];
  world.phase = 'playing';
  world.audio.upgradePick();
  nextWave(world);
}
