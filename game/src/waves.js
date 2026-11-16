// Wave composition: what spawns, in what order, on each of the 10 waves.
// Early waves teach one enemy kind at a time; later waves mix them, and wave 10
// is the Ash Titan with a cinder trickle. The spawn queue is consumed by world.js
// on a timer that tightens as the wave number grows. The shuffle draws from the
// world's seeded RNG, so a run (and a staged screenshot scene) is reproducible
// from its seed alone.

export function waveComp(wave, rng = Math.random) {
  const list = [];
  const add = (type, count) => {
    for (let i = 0; i < count; i++) list.push(type);
  };

  switch (wave) {
    case 1:
      add('cinder', 8);
      break;
    case 2:
      add('cinder', 10);
      add('spitter', 3);
      break;
    case 3:
      add('cinder', 12);
      add('wisp', 4);
      add('spitter', 3);
      break;
    case 4:
      add('cinder', 14);
      add('splitter', 3);
      add('spitter', 4);
      add('wisp', 4);
      break;
    case 5:
      add('cinder', 16);
      add('brute', 1);
      add('splitter', 4);
      add('wisp', 5);
      add('spitter', 4);
      break;
    case 6:
      add('cinder', 18);
      add('brute', 2);
      add('splitter', 5);
      add('wisp', 6);
      add('spitter', 5);
      break;
    case 7:
      add('cinder', 20);
      add('brute', 3);
      add('splitter', 6);
      add('wisp', 7);
      add('spitter', 6);
      break;
    case 8:
      add('cinder', 22);
      add('brute', 4);
      add('splitter', 7);
      add('wisp', 8);
      add('spitter', 7);
      break;
    case 9:
      add('cinder', 24);
      add('brute', 5);
      add('splitter', 8);
      add('wisp', 9);
      add('spitter', 8);
      break;
    case 10:
      // The boss arrives alone; its summons and a small trickle keep pressure on.
      add('boss', 1);
      add('cinder', 6);
      break;
    default:
      add('cinder', 8 + wave * 2);
      add('spitter', wave);
  }

  // Shuffle, but keep the boss first on wave 10 and never front-load brutes.
  const head = list[0] === 'boss' ? [list.shift()] : [];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return [...head, ...list];
}

// Seconds between spawns for this wave.
export function spawnInterval(wave) {
  return Math.max(0.22, 0.9 - (wave - 1) * 0.07);
}

// Human-readable wave title for the banner.
export function waveTitle(wave) {
  if (wave === 10) return 'FINAL WAVE — THE ASH TITAN';
  return `WAVE ${wave}`;
}
