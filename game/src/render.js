// All drawing: the arena, every entity, the HUD, and the four screens
// (title, upgrade draft, game over, victory). render.js never changes state —
// it only reads the world and paints one frame of it.

import { VIEW_W, VIEW_H, ARENA, WAVES_TOTAL, PALETTE, PLAYER } from './config.js';
import { clamp } from './random.js';
import { UPGRADES } from './upgrades.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, size, color, align = 'center', font = 'bold', alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${font} ${size}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function bar(ctx, x, y, w, h, frac, fill, bg = 'rgba(255,255,255,0.12)') {
  ctx.fillStyle = bg;
  rr(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = fill;
    rr(ctx, x, y, w * clamp(frac, 0, 1), h, h / 2);
    ctx.fill();
  }
}

export function drawWorld(ctx, world) {
  const off = world.fx.offset();
  ctx.save();
  ctx.translate(off.x, off.y);

  drawBackground(ctx, world);
  drawPickups(ctx, world);
  for (const e of world.enemies) drawEnemy(ctx, world, e);
  drawBullets(ctx, world);
  // The Warden stands at his post on the title screen too: the attract arena
  // circles him while the menu waits.
  drawPlayer(ctx, world);
  drawFX(ctx, world);

  ctx.restore();

  // The HUD and screens sit outside the shake transform.
  if (world.phase !== 'title') drawHUD(ctx, world);
  if (world.bannerT > 0 && world.phase === 'playing') {
    const a = clamp(world.bannerT / 0.6, 0, 1);
    text(ctx, world.bannerText, VIEW_W / 2, 150, 40, world.bannerColor, 'center', 'bold', a);
  }
  if (world.fx.flash > 0) {
    const g = ctx.createRadialGradient(
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.28, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75,
    );
    g.addColorStop(0, 'rgba(255,60,40,0)');
    g.addColorStop(1, `rgba(255,60,40,${0.45 * world.fx.flash})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  if (world.phase === 'title') drawTitle(ctx, world);
  else if (world.phase === 'upgrade') drawUpgrade(ctx, world);
  else if (world.phase === 'over') drawEndScreen(ctx, world, false);
  else if (world.phase === 'victory') drawEndScreen(ctx, world, true);
  if (world.paused && world.phase === 'playing') {
    ctx.fillStyle = 'rgba(4, 6, 12, 0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, 'PAUSED', VIEW_W / 2, VIEW_H / 2 - 10, 54, PALETTE.text);
    text(ctx, 'Press P to resume', VIEW_W / 2, VIEW_H / 2 + 42, 18, PALETTE.textDim);
  }
  if (world.phase === 'playing' && !world.paused) drawCrosshair(ctx, world);
}

function drawBackground(ctx, world) {
  const g = ctx.createRadialGradient(
    VIEW_W / 2, VIEW_H / 2, 80, VIEW_W / 2, VIEW_H / 2, 760,
  );
  g.addColorStop(0, PALETTE.bg1);
  g.addColorStop(1, PALETTE.bg0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Faint grid across the arena floor.
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = ARENA.x; x <= ARENA.x + ARENA.w; x += 48) {
    ctx.moveTo(x, ARENA.y);
    ctx.lineTo(x, ARENA.y + ARENA.h);
  }
  for (let y = ARENA.y; y <= ARENA.y + ARENA.h; y += 48) {
    ctx.moveTo(ARENA.x, y);
    ctx.lineTo(ARENA.x + ARENA.w, y);
  }
  ctx.stroke();

  // Corner braziers: the arena's own light sources, gently flickering.
  const flick = 0.75 + 0.25 * Math.sin(world.time * 3.1);
  for (const [bx, by] of [
    [ARENA.x + 26, ARENA.y + 26],
    [ARENA.x + ARENA.w - 26, ARENA.y + 26],
    [ARENA.x + 26, ARENA.y + ARENA.h - 26],
    [ARENA.x + ARENA.w - 26, ARENA.y + ARENA.h - 26],
  ]) {
    const bg = ctx.createRadialGradient(bx, by, 4, bx, by, 90 * flick);
    bg.addColorStop(0, 'rgba(255, 179, 71, 0.30)');
    bg.addColorStop(1, 'rgba(255, 179, 71, 0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(bx, by, 90 * flick, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(bx, by, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Arena edge.
  ctx.strokeStyle = PALETTE.arenaEdge;
  ctx.lineWidth = 3;
  ctx.strokeRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
}

function drawPickups(ctx, world) {
  for (const pk of world.pickups) {
    const colors = { heal: '#7dff8a', shield: '#5fe8ff', spread: '#ffd97a', bomb: '#ff5a4e' };
    const color = colors[pk.type];
    const blink = pk.life < 3 ? (Math.sin(pk.t * 14) > 0 ? 1 : 0.25) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pk.x, pk.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const glyphs = { heal: '+', shield: '◈', spread: '✦', bomb: '●' };
    text(ctx, glyphs[pk.type], pk.x, pk.y + 1, 14, '#10142a');
    ctx.restore();
  }
}

function drawEnemy(ctx, world, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const flash = e.flash > 0;
  const body = flash ? '#ffffff' : e.color;

  // A soft halo in the foe's own colour, so every kind reads at a glance
  // against the dark floor — and a white bloom on the hit-flash frame.
  ctx.globalAlpha = flash ? 0.4 : 0.15;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, e.radius * 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (e.type === 'cinder' || e.type === 'emberling') {
    // Spiked ember: a jagged little sun.
    ctx.fillStyle = body;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + e.t * 1.5;
      const r = i % 2 === 0 ? e.radius + 4 : e.radius - 3;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2a0e08';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'spitter') {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d0b2e';
    ctx.beginPath();
    ctx.arc(Math.cos(e.angle) * 5, Math.sin(e.angle) * 5, e.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = body;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (e.type === 'wisp') {
    // Telegraph: a bright ring while aiming, a streak while dashing.
    if (e.state === 'aim') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 8 + Math.sin(e.t * 18) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#06222e';
    ctx.beginPath();
    ctx.arc(Math.cos(e.angle) * 4, Math.sin(e.angle) * 4, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'splitter') {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(-6, -4, e.radius * 0.62, 0, Math.PI * 2);
    ctx.arc(7, 5, e.radius * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#12250a';
    ctx.beginPath();
    ctx.arc(-6, -4, 4, 0, Math.PI * 2);
    ctx.arc(7, 5, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'brute') {
    // Armoured hexagon with a heavy core.
    ctx.fillStyle = body;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + e.t * 0.4;
      const px = Math.cos(a) * e.radius;
      const py = Math.sin(a) * e.radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3d1c05';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#fff3d0';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'boss') {
    // The Ash Titan: a huge burning crown of shards around a dark heart.
    ctx.fillStyle = body;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + e.t * 0.25;
      const r = i % 2 === 0 ? e.radius + 12 : e.radius - 8;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1c0510';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.arc(Math.cos(e.angle) * 12, Math.sin(e.angle) * 12, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Health bar for anything hurt (and always for the brute and boss).
  if ((e.hp < e.maxHp && e.type !== 'emberling') || e.type === 'brute' || e.type === 'boss') {
    const w = e.radius * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(-w / 2, -e.radius - 12, w, 5);
    ctx.fillStyle = '#ff5a4e';
    ctx.fillRect(-w / 2, -e.radius - 12, w * clamp(e.hp / e.maxHp, 0, 1), 5);
  }
  ctx.restore();
}

function drawBullets(ctx, world) {
  for (const b of world.bullets) {
    // A tracer streak behind the bolt and a hot core: a stream of fire reads
    // as motion even in a single still frame.
    ctx.strokeStyle = 'rgba(255, 179, 71, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const b of world.enemyBullets) {
    // A halo so incoming orbs are unmissable against the dark.
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawPlayer(ctx, world) {
  const p = world.player;
  ctx.save();
  ctx.translate(p.x, p.y);

  // Lantern glow that follows the Warden.
  const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, 130);
  glow.addColorStop(0, 'rgba(255, 179, 71, 0.28)');
  glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 130, 0, Math.PI * 2);
  ctx.fill();

  // Blink while invulnerable after a hit.
  if (p.invulnT > 0 && Math.floor(world.time * 18) % 2 === 0) ctx.globalAlpha = 0.35;

  // Dash trail.
  if (p.dashT > 0) {
    ctx.strokeStyle = 'rgba(255, 217, 122, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-p.dashDirX * 34, -p.dashDirY * 34);
    ctx.lineTo(0, 0);
    ctx.stroke();
  }

  // Cloak (rotates to face the aim) and hood.
  ctx.rotate(p.angle);
  ctx.fillStyle = '#2c3a5e';
  ctx.beginPath();
  ctx.moveTo(-14, -11);
  ctx.lineTo(10, 0);
  ctx.lineTo(-14, 11);
  ctx.closePath();
  ctx.fill();
  ctx.rotate(-p.angle);
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(0, 0, p.radius - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2c3a5e';
  ctx.beginPath();
  ctx.arc(0, 0, p.radius - 7, 0, Math.PI * 2);
  ctx.fill();
  // The lantern itself, held toward the aim.
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * (p.radius + 6), Math.sin(p.angle) * (p.radius + 6), 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff6d8';
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * (p.radius + 6), Math.sin(p.angle) * (p.radius + 6), 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Shield ring.
  if (p.shield > 0) {
    ctx.strokeStyle = 'rgba(95, 232, 255, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFX(ctx, world) {
  const fx = world.fx;
  for (const pt of fx.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const r of fx.rings) {
    ctx.globalAlpha = clamp(r.life / r.maxLife, 0, 1);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius * (1.6 - r.life / r.maxLife), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const t of fx.texts) {
    text(ctx, t.str, t.x, t.y, t.size, t.color, 'center', 'bold', clamp(t.life / t.maxLife, 0, 1));
  }
}

function drawHUD(ctx, world) {
  const p = world.player;
  // Top bar.
  ctx.fillStyle = 'rgba(7, 10, 20, 0.85)';
  ctx.fillRect(0, 0, VIEW_W, 64);
  ctx.strokeStyle = PALETTE.arenaEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 64);
  ctx.lineTo(VIEW_W, 64);
  ctx.stroke();

  text(ctx, 'EMBERWARD', 24, 24, 20, PALETTE.ember, 'left');
  text(ctx, 'hold the last light', 24, 46, 12, PALETTE.textDim, 'left');

  // Health.
  text(ctx, 'HP', 250, 32, 15, PALETTE.textDim, 'left');
  const hpFrac = p.hp / p.maxHp;
  bar(ctx, 285, 20, 220, 20, hpFrac, hpFrac > 0.35 ? PALETTE.hpGood : PALETTE.hpLow);
  text(ctx, `${Math.ceil(p.hp)} / ${p.maxHp}`, 395, 30, 13, '#10142a', 'center');
  if (p.shield > 0) text(ctx, `SHIELD ×${p.shield} (${Math.ceil(p.shieldT)}s)`, 520, 30, 13, '#5fe8ff', 'left');
  if (p.spreadT > 0) text(ctx, `SPREAD ${Math.ceil(p.spreadT)}s`, 520, 48, 13, '#ffd97a', 'left');

  // Score block.
  text(ctx, 'SCORE', 700, 20, 12, PALETTE.textDim, 'center');
  text(ctx, String(world.score), 700, 44, 24, PALETTE.text, 'center');
  text(ctx, `BEST ${world.best}`, 830, 32, 14, PALETTE.textDim, 'center');

  // Wave block.
  text(ctx, `WAVE ${world.wave} / ${WAVES_TOTAL}`, 990, 24, 17, PALETTE.text, 'center');
  const left = world.enemies.length + world.spawnQueue.length;
  text(ctx, left > 0 ? `${left} foes left` : 'wave clear!', 990, 46, 13, PALETTE.textDim, 'center');

  // Dash cooldown (bottom-left) and controls hint (bottom-right).
  const dashFrac = 1 - clamp(p.dashCd / (PLAYER.dashCooldown * p.dashCdMul), 0, 1);
  text(ctx, 'DASH [SPACE]', 24, VIEW_H - 26, 12, PALETTE.textDim, 'left');
  bar(ctx, 24, VIEW_H - 18, 120, 8, dashFrac, '#ffd97a');
  text(ctx, 'WASD move · mouse aim · hold click to fire · P pause · M mute', VIEW_W - 24, VIEW_H - 22, 12, PALETTE.textDim, 'right');

  // The blessings drafted so far (bottom-centre): the run's build at a glance.
  const owned = UPGRADES.filter((u) => (p.owned[u.id] ?? 0) > 0);
  if (owned.length > 0) {
    const label = owned.map((u) => `${u.icon}×${p.owned[u.id]}`).join('   ');
    text(ctx, label, VIEW_W / 2, VIEW_H - 22, 13, PALETTE.ember, 'center');
  }

  // Boss bar.
  if (world.bossRef) {
    const b = world.bossRef;
    text(ctx, 'THE ASH TITAN', VIEW_W / 2, 84, 16, '#ff2e63', 'center');
    bar(ctx, VIEW_W / 2 - 260, 98, 520, 12, b.hp / b.maxHp, '#ff2e63');
  }
}

// The lantern mark over the title: a ring, a cap and a living flame, drawn
// the way the Warden's own lantern is drawn in the arena.
function drawLanternEmblem(ctx, x, y, flicker) {
  ctx.save();
  ctx.translate(x, y);
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 54 * flicker);
  glow.addColorStop(0, 'rgba(255, 179, 71, 0.5)');
  glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 54 * flicker, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ember;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 21, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-9, -25);
  ctx.lineTo(9, -25);
  ctx.stroke();
  // The flame: a teardrop that leans with the flicker.
  ctx.fillStyle = PALETTE.emberHot;
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.quadraticCurveTo(9 * flicker, 2, 0, 12);
  ctx.quadraticCurveTo(-9 * flicker, 2, 0, -13);
  ctx.fill();
  ctx.fillStyle = '#fff6d8';
  ctx.beginPath();
  ctx.arc(0, 4, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTitle(ctx, world) {
  // A lighter veil than a plain menu's: the attract arena — the Warden at his
  // post, every foe kind circling him — stays readable behind the words.
  ctx.fillStyle = 'rgba(4, 6, 12, 0.52)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  drawLanternEmblem(ctx, VIEW_W / 2, 76, 0.8 + 0.2 * Math.sin(world.time * 2.2));
  text(ctx, 'EMBERWARD', VIEW_W / 2, 178, 92, PALETTE.ember);
  text(ctx, '— hold the last light —', VIEW_W / 2, 242, 24, PALETTE.textDim);
  text(
    ctx,
    'The night has swallowed the valley. You are the last Warden, and your lantern is the last light.',
    VIEW_W / 2, 298, 18, PALETTE.text,
  );
  text(
    ctx,
    'Survive 10 waves. Slay the Ash Titan. Choose your upgrades between waves.',
    VIEW_W / 2, 326, 18, PALETTE.text,
  );
  text(
    ctx,
    '10 WAVES  ·  SIX KINDS OF FOE  ·  A BLESSING DRAFTED EVERY WAVE  ·  ONE ASH TITAN',
    VIEW_W / 2, 366, 15, PALETTE.emberHot,
  );

  text(ctx, 'WASD / ARROWS — move      MOUSE — aim      HOLD CLICK — fire', VIEW_W / 2, 412, 17, PALETTE.text);
  text(ctx, 'SPACE — dash      P — pause      M — mute', VIEW_W / 2, 440, 17, PALETTE.text);

  // Pulsing start prompt.
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 3.4);
  text(ctx, 'CLICK OR PRESS ENTER TO BEGIN', VIEW_W / 2, 500, 26, '#ffd97a', 'center', 'bold', pulse);

  if (world.best > 0) {
    text(ctx, `BEST SCORE  ${world.best}`, VIEW_W / 2, 552, 18, PALETTE.textDim);
  }
  text(ctx, 'An original game · no network · sound on for the full experience', VIEW_W / 2, 668, 13, PALETTE.textDim);
}

function drawUpgrade(ctx, world) {
  ctx.fillStyle = 'rgba(4, 6, 12, 0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(ctx, `WAVE ${world.wave} CLEARED`, VIEW_W / 2, 120, 40, PALETTE.ember);
  text(ctx, 'Choose one blessing of the lantern  —  click a card or press 1 / 2 / 3', VIEW_W / 2, 168, 18, PALETTE.text);

  const cardW = 300;
  const cardH = 240;
  const gap = 36;
  const total = cardW * 3 + gap * 2;
  const x0 = (VIEW_W - total) / 2;
  const y0 = 220;
  world.choices.forEach((c, i) => {
    const x = x0 + i * (cardW + gap);
    const hover = world.hoverChoice === i;
    ctx.fillStyle = PALETTE.cardBg;
    rr(ctx, x, y0, cardW, cardH, 14);
    ctx.fill();
    ctx.strokeStyle = hover ? '#ffd97a' : PALETTE.cardEdge;
    ctx.lineWidth = hover ? 3 : 1.5;
    rr(ctx, x, y0, cardW, cardH, 14);
    ctx.stroke();
    text(ctx, c.icon, x + cardW / 2, y0 + 62, 52, PALETTE.ember);
    text(ctx, c.name, x + cardW / 2, y0 + 128, 22, PALETTE.text);
    text(ctx, c.desc, x + cardW / 2, y0 + 162, 16, PALETTE.textDim);
    const owned = world.player.owned[c.id] ?? 0;
    text(ctx, owned > 0 ? `owned ×${owned}` : 'new', x + cardW / 2, y0 + 196, 14, PALETTE.textDim);
    text(ctx, `[ ${i + 1} ]`, x + cardW / 2, y0 + 222, 14, PALETTE.textDim);
  });
  text(ctx, `Score ${world.score}  ·  Next: wave ${world.wave + 1}`, VIEW_W / 2, 520, 16, PALETTE.textDim);
}

function drawEndScreen(ctx, world, won) {
  const s = world.stats || { score: world.score, wave: world.wave, kills: world.kills, accuracy: 0, time: world.runTime };
  ctx.fillStyle = won ? 'rgba(10, 16, 6, 0.66)' : 'rgba(12, 6, 8, 0.66)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (won) {
    // Dawn breaking over the top of the frame behind the panel.
    const dawn = ctx.createRadialGradient(VIEW_W / 2, 60, 30, VIEW_W / 2, 60, 520);
    dawn.addColorStop(0, 'rgba(255, 217, 122, 0.20)');
    dawn.addColorStop(1, 'rgba(255, 217, 122, 0)');
    ctx.fillStyle = dawn;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  if (won) {
    text(ctx, 'THE DAWN RETURNS', VIEW_W / 2, 150, 64, '#ffd97a');
    text(ctx, 'The Ash Titan is ash. Your lantern lit the valley again.', VIEW_W / 2, 214, 20, PALETTE.text);
    // Three stars for a win.
    text(ctx, '★ ★ ★', VIEW_W / 2, 268, 40, '#ffd97a');
  } else {
    text(ctx, 'THE LIGHT GOES OUT', VIEW_W / 2, 150, 60, '#ff5a4e');
    text(ctx, 'The night takes the valley… but a Warden always rises again.', VIEW_W / 2, 212, 20, PALETTE.text);
  }

  const rows = [
    ['FINAL SCORE', String(s.score)],
    ['WAVE REACHED', `${s.wave} / ${WAVES_TOTAL}`],
    ['FOES SLAIN', String(s.kills)],
    ['ACCURACY', `${s.accuracy}%`],
    ['TIME', formatTime(s.time)],
    ['BEST SCORE', String(world.best)],
  ];
  let y = 320;
  for (const [label, value] of rows) {
    text(ctx, label, VIEW_W / 2 - 170, y, 18, PALETTE.textDim, 'left');
    text(ctx, value, VIEW_W / 2 + 170, y, 20, PALETTE.text, 'right');
    y += 38;
  }
  if (world.newBest) {
    text(ctx, '★ NEW BEST SCORE ★', VIEW_W / 2, y + 8, 20, '#ffd97a');
  }
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 3.4);
  text(ctx, 'PRESS R OR CLICK TO PLAY AGAIN', VIEW_W / 2, 620, 24, '#ffd97a', 'center', 'bold', pulse);
}

function drawCrosshair(ctx, world) {
  const m = world.lastMouse;
  if (!m) return;
  ctx.strokeStyle = 'rgba(255, 217, 122, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(m.x, m.y, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(m.x - 16, m.y);
  ctx.lineTo(m.x - 6, m.y);
  ctx.moveTo(m.x + 6, m.y);
  ctx.lineTo(m.x + 16, m.y);
  ctx.moveTo(m.x, m.y - 16);
  ctx.lineTo(m.x, m.y - 6);
  ctx.moveTo(m.x, m.y + 6);
  ctx.lineTo(m.x, m.y + 16);
  ctx.stroke();
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
