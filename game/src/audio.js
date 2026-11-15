// All sound is synthesised with WebAudio — no audio files, no network.
// A tiny synth: oscillators and filtered noise, shaped by gain envelopes.
// Music is a slow minor-key arpeggio loop scheduled a bar ahead, so it never
// stutters when the frame rate does. Everything is a no-op until the first
// user gesture creates the AudioContext (browsers require it), and until then
// the game is simply silent.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.nextNoteTime = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  // --- primitive voices -------------------------------------------------

  tone(freq, dur, type, vol, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise(dur, vol, filterFreq, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  // --- game effects ------------------------------------------------------

  shoot() {
    this.tone(740, 0.09, 'square', 0.1, 220);
  }

  enemyShoot() {
    this.tone(300, 0.14, 'sawtooth', 0.06, 140);
  }

  hit() {
    this.noise(0.06, 0.12, 2400);
    this.tone(190, 0.06, 'triangle', 0.1, 90);
  }

  explode(big = false) {
    this.noise(big ? 0.5 : 0.28, big ? 0.4 : 0.22, big ? 900 : 1400);
    this.tone(big ? 120 : 160, big ? 0.45 : 0.25, 'sine', 0.3, 40);
  }

  playerHurt() {
    this.tone(220, 0.22, 'sawtooth', 0.22, 55);
    this.noise(0.18, 0.18, 700);
  }

  pickup() {
    this.tone(660, 0.09, 'sine', 0.14, 990);
    this.tone(990, 0.12, 'sine', 0.12, 1320, 0.07);
  }

  heal() {
    this.tone(520, 0.12, 'sine', 0.14, 780);
    this.tone(780, 0.16, 'sine', 0.12, 1040, 0.1);
  }

  dash() {
    this.noise(0.12, 0.1, 3200);
  }

  waveHorn() {
    this.tone(196, 0.5, 'triangle', 0.16, 196);
    this.tone(294, 0.5, 'triangle', 0.12, 294, 0.05);
    this.tone(392, 0.6, 'triangle', 0.1, 392, 0.12);
  }

  bossRoar() {
    this.tone(90, 0.8, 'sawtooth', 0.25, 45);
    this.noise(0.7, 0.2, 500);
  }

  upgradePick() {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.14, f, i * 0.07));
  }

  victory() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.15, f, i * 0.11));
  }

  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.14, f * 0.94, i * 0.16));
  }

  uiClick() {
    this.tone(880, 0.05, 'sine', 0.1, 880);
  }

  // --- music --------------------------------------------------------------
  // A-minor arpeggio: A2 C3 E3 A3 / F2 A2 C3 F3 / C3 E3 G3 C4 / G2 B2 D3 G3,
  // one chord per bar, eighth notes at 96 bpm, plus a soft root pulse.

  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicStep = 0;
    const chords = [
      [110, 130.81, 164.81, 220],
      [87.31, 110, 130.81, 174.61],
      [130.81, 164.81, 196, 261.63],
      [98, 123.47, 146.83, 196],
    ];
    const eighth = 60 / 96 / 2;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.muted) return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.35) {
        const bar = Math.floor(this.musicStep / 8) % chords.length;
        const chord = chords[bar];
        const note = chord[this.musicStep % 4];
        const t = this.nextNoteTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = note * 2;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.5, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + eighth * 1.8);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(t);
        osc.stop(t + eighth * 2);
        if (this.musicStep % 8 === 0) {
          const bass = this.ctx.createOscillator();
          const bg = this.ctx.createGain();
          bass.type = 'sine';
          bass.frequency.value = chord[0];
          bg.gain.setValueAtTime(0, t);
          bg.gain.linearRampToValueAtTime(0.6, t + 0.05);
          bg.gain.exponentialRampToValueAtTime(0.001, t + eighth * 8);
          bass.connect(bg);
          bg.connect(this.musicGain);
          bass.start(t);
          bass.stop(t + eighth * 8);
        }
        this.musicStep += 1;
        this.nextNoteTime += eighth;
      }
    }, 90);
  }
}
