// Particles, floating combat text, expanding rings and screen shake.
// Everything is pooled in plain arrays and capped, so a busy fight never
// allocates without bound. A tiny hit-stop (time freeze) sells heavy impacts.

import { range } from './random.js';

const MAX_PARTICLES = 420;
const MAX_TEXTS = 40;

export class FX {
  constructor(rng) {
    this.rng = rng;
    this.particles = [];
    this.texts = [];
    this.rings = [];
    this.shake = 0;
    this.hitStop = 0;
    this.flash = 0; // full-screen damage vignette strength 0..1
  }

  burst(x, y, color, n = 14, speed = 260) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX_PARTICLES) return;
      const a = this.rng() * Math.PI * 2;
      const s = range(this.rng, speed * 0.3, speed);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: range(this.rng, 0.3, 0.7),
        maxLife: 0.7,
        size: range(this.rng, 2, 5),
        color,
        drag: 0.9,
      });
    }
  }

  embers(x, y, n = 3) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX_PARTICLES) return;
      this.particles.push({
        x: x + range(this.rng, -8, 8),
        y: y + range(this.rng, -8, 8),
        vx: range(this.rng, -14, 14),
        vy: range(this.rng, -46, -18),
        life: range(this.rng, 0.5, 1.1),
        maxLife: 1.1,
        size: range(this.rng, 1.5, 3),
        color: this.rng() < 0.5 ? '#ffb347' : '#ff7a2f',
        drag: 1,
      });
    }
  }

  ring(x, y, color, radius) {
    this.rings.push({ x, y, color, radius, life: 0.45, maxLife: 0.45 });
  }

  text(x, y, str, color = '#f2ead8', size = 15) {
    if (this.texts.length >= MAX_TEXTS) this.texts.shift();
    this.texts.push({ x, y, str, color, size, life: 0.9, maxLife: 0.9 });
  }

  addShake(amount) {
    this.shake = Math.min(16, this.shake + amount);
  }

  stopTime(seconds) {
    this.hitStop = Math.max(this.hitStop, seconds);
  }

  hurtFlash() {
    this.flash = 1;
  }

  update(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 34 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    this.shake = Math.max(0, this.shake - dt * 42);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
  }

  offset() {
    if (this.shake <= 0.2) return { x: 0, y: 0 };
    return {
      x: range(this.rng, -this.shake, this.shake),
      y: range(this.rng, -this.shake, this.shake),
    };
  }
}
