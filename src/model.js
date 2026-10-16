// Pure state model. State = { rows: [{ id, label, bulbs: [{ id, x, y, num }] }] }.
// Array order is meaningful: rows are in order, and bulbs are in row order.
// Every mutation returns a new state; inputs are never modified.

import { FLOORPLAN_ID } from './floorplan.js';

export const MIN = 1;
export const MAX = 55;
export const SCHEMA_VERSION = 1;
export const KIND = 'recurse-arclight-light-map';

const clone = (s) => structuredClone(s);
const round1 = (n) => Math.round(n * 10) / 10;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

let idCounter = 0;
export const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${(idCounter++).toString(36)}`;

export const isValidNum = (n) => Number.isInteger(n) && n >= MIN && n <= MAX;

export function findBulb(state, bulbId) {
  for (const row of state.rows) {
    const index = row.bulbs.findIndex((b) => b.id === bulbId);
    if (index >= 0) return { row, bulb: row.bulbs[index], index };
  }
  return null;
}

function mustFindBulb(state, bulbId) {
  const hit = findBulb(state, bulbId);
  if (!hit) throw new Error(`Unknown bulb ${bulbId}`);
  return hit;
}

function mustFindRow(state, rowId) {
  const row = state.rows.find((r) => r.id === rowId);
  if (!row) throw new Error(`Unknown row ${rowId}`);
  return row;
}

export function assignedNumbers(state) {
  const out = [];
  for (const row of state.rows) for (const b of row.bulbs) if (b.num !== null) out.push(b.num);
  return out;
}

export const assignedCount = (state) => assignedNumbers(state).length;

export function unassigned(state) {
  const used = new Set(assignedNumbers(state));
  const out = [];
  for (let n = MIN; n <= MAX; n++) if (!used.has(n)) out.push(n);
  return out;
}

// Sets (or clears, with null) a bulb's number. A number already on another
// bulb moves to this one; the other bulb's id is returned as `displaced`.
export function setNumber(state, bulbId, num) {
  if (num !== null && !isValidNum(num)) throw new RangeError(`Light number must be a whole number ${MIN}–${MAX}`);
  const next = clone(state);
  const hit = mustFindBulb(next, bulbId);
  let displaced = null;
  if (num !== null) {
    for (const row of next.rows) {
      for (const b of row.bulbs) {
        if (b.num === num && b.id !== bulbId) {
          b.num = null;
          displaced = b.id;
        }
      }
    }
  }
  hit.bulb.num = num;
  return { state: next, displaced };
}

function segmentDistance(p, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

export function rowDistance(row, p) {
  const bs = row.bulbs;
  if (!bs.length) return Infinity;
  if (bs.length === 1) return dist(bs[0], p);
  let best = Infinity;
  for (let i = 1; i < bs.length; i++) best = Math.min(best, segmentDistance(p, bs[i - 1], bs[i]));
  return best;
}

export function nearestRowId(state, p) {
  let bestId = null;
  let best = Infinity;
  for (const row of state.rows) {
    const d = rowDistance(row, p);
    if (d < best) {
      best = d;
      bestId = row.id;
    }
  }
  return bestId;
}

// Index at which inserting p adds the least length to the row's path.
export function bestInsertIndex(bulbs, p) {
  let bestIndex = 0;
  let bestCost = Infinity;
  for (let i = 0; i <= bulbs.length; i++) {
    const a = bulbs[i - 1];
    const b = bulbs[i];
    let cost;
    if (a && b) cost = dist(a, p) + dist(p, b) - dist(a, b);
    else if (a || b) cost = dist(a ?? b, p);
    else cost = 0;
    if (cost < bestCost) {
      bestCost = cost;
      bestIndex = i;
    }
  }
  return bestIndex;
}

export function addBulb(state, rowId, x, y) {
  const next = clone(state);
  const row = mustFindRow(next, rowId);
  const bulb = { id: newId('b'), x: round1(x), y: round1(y), num: null };
  row.bulbs.splice(bestInsertIndex(row.bulbs, bulb), 0, bulb);
  return { state: next, bulbId: bulb.id };
}

export function deleteBulb(state, bulbId) {
  const next = clone(state);
  const hit = mustFindBulb(next, bulbId);
  hit.row.bulbs.splice(hit.index, 1);
  return next;
}

export function moveBulb(state, bulbId, x, y) {
  const next = clone(state);
  const { bulb } = mustFindBulb(next, bulbId);
  bulb.x = round1(x);
  bulb.y = round1(y);
  return next;
}

export function moveBulbToRow(state, bulbId, rowId) {
  const next = clone(state);
  const hit = mustFindBulb(next, bulbId);
  const target = mustFindRow(next, rowId);
  if (hit.row === target) return next;
  hit.row.bulbs.splice(hit.index, 1);
  target.bulbs.splice(bestInsertIndex(target.bulbs, hit.bulb), 0, hit.bulb);
  return next;
}

export function moveInRow(state, bulbId, delta) {
  const next = clone(state);
  const { row, index } = mustFindBulb(next, bulbId);
  const to = index + delta;
  if (to < 0 || to >= row.bulbs.length) return next;
  const [b] = row.bulbs.splice(index, 1);
  row.bulbs.splice(to, 0, b);
  return next;
}

export function reverseRow(state, rowId) {
  const next = clone(state);
  mustFindRow(next, rowId).bulbs.reverse();
  return next;
}

export function addRow(state, label) {
  const next = clone(state);
  const row = { id: newId('r'), label, bulbs: [] };
  next.rows.push(row);
  return { state: next, rowId: row.id };
}

export function deleteRow(state, rowId) {
  const next = clone(state);
  next.rows = next.rows.filter((r) => r.id !== rowId);
  return next;
}

export function renameRow(state, rowId, label) {
  const next = clone(state);
  mustFindRow(next, rowId).label = label;
  return next;
}

export function moveRow(state, rowId, delta) {
  const next = clone(state);
  const i = next.rows.findIndex((r) => r.id === rowId);
  const to = i + delta;
  if (i < 0 || to < 0 || to >= next.rows.length) return next;
  const [r] = next.rows.splice(i, 1);
  next.rows.splice(to, 0, r);
  return next;
}

// Portable export format. Ids are not exported; order carries the structure.
export function toMapping(state) {
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: KIND,
    floorplan: FLOORPLAN_ID,
    rows: state.rows.map((r, i) => ({
      row: i + 1,
      label: r.label,
      bulbs: r.bulbs.map((b) => ({ num: b.num, x: round1(b.x), y: round1(b.y) })),
    })),
    unassigned: unassigned(state),
  };
}

// Validates a mapping and builds state with deterministic ids.
export function fromMapping(m) {
  if (!m || typeof m !== 'object') throw new Error('Not a mapping object');
  if (m.kind !== KIND) throw new Error(`Not a ${KIND} file`);
  if (m.schemaVersion !== SCHEMA_VERSION) throw new Error(`Unsupported schemaVersion ${m.schemaVersion}`);
  if (!Array.isArray(m.rows)) throw new Error('Missing rows');
  const seen = new Set();
  const rows = m.rows.map((r, i) => {
    if (!r || !Array.isArray(r.bulbs)) throw new Error(`Row ${i + 1}: missing bulbs`);
    return {
      id: `r${i}`,
      label: String(r.label ?? `Row ${i + 1}`),
      bulbs: r.bulbs.map((b, j) => {
        const where = `Row ${i + 1} bulb ${j + 1}`;
        if (!Number.isFinite(b?.x) || !Number.isFinite(b?.y)) throw new Error(`${where}: bad position`);
        const num = b.num ?? null;
        if (num !== null) {
          if (!isValidNum(num)) throw new Error(`${where}: number ${num} is outside ${MIN}–${MAX}`);
          if (seen.has(num)) throw new Error(`Number ${num} is used twice`);
          seen.add(num);
        }
        return { id: `b${i}-${j}`, x: round1(b.x), y: round1(b.y), num };
      }),
    };
  });
  return { rows };
}
