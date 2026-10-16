import { toMapping, fromMapping } from './model.js';

const KEY = 'arclight-light-map:v1';

// Saved edits record which baseline (data/mapping.json content) they started
// from. When the committed file changes, it wins over older local edits; the
// old local copy is kept under a backup key.
export function load(baselineTag) {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw);
    if (saved.baseline !== baselineTag) {
      localStorage.setItem(`${KEY}:backup`, raw);
      return null;
    }
    return fromMapping(saved.mapping);
  } catch (err) {
    localStorage.setItem(`${KEY}:corrupt`, raw);
    console.error('Saved light map unreadable; using the baseline', err);
    return null;
  }
}

export function save(state, baselineTag) {
  localStorage.setItem(KEY, JSON.stringify({ baseline: baselineTag, mapping: toMapping(state) }));
}
