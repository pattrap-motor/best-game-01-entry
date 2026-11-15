// Best score and settings, kept in localStorage. Nothing here ever touches the
// network; a fresh browser simply starts with no best score.

const BEST_KEY = 'emberward.best.v1';
const MUTED_KEY = 'emberward.muted.v1';

export function loadBest() {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const n = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveBest(score) {
  try {
    localStorage.setItem(BEST_KEY, String(Math.floor(score)));
  } catch {
    // Storage may be unavailable (private mode, sandbox); the game plays on.
  }
}

export function loadMuted() {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMuted(muted) {
  try {
    localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch {
    // Ignore; mute is a session preference then.
  }
}
