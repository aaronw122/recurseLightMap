import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/model.js';
import { seedState } from '../src/seed.js';
import { renderMap } from '../src/render-map.js';

const firstBulb = (s, r = 0, i = 0) => s.rows[r].bulbs[i].id;

test('seed guess has 55 unnumbered bulbs and passes import validation', () => {
  const s = seedState();
  const bulbs = s.rows.flatMap((r) => r.bulbs);
  assert.equal(bulbs.length, 55);
  assert.ok(bulbs.every((b) => b.num === null));
  assert.deepEqual(M.unassigned(s).length, 55);
});

test('setNumber moves a duplicate number and reports the displaced bulb', () => {
  const s0 = seedState();
  const a = firstBulb(s0, 0);
  const b = firstBulb(s0, 1);
  const { state: s1 } = M.setNumber(s0, a, 7);
  const { state: s2, displaced } = M.setNumber(s1, b, 7);
  assert.equal(displaced, a);
  assert.equal(M.findBulb(s2, a).bulb.num, null);
  assert.equal(M.findBulb(s2, b).bulb.num, 7);
  assert.equal(M.findBulb(s1, a).bulb.num, 7, 'input state not mutated');
});

test('setNumber rejects numbers outside 1–55 and non-integers', () => {
  const s = seedState();
  for (const n of [0, 56, 115, 1.5, -3, NaN]) {
    assert.throws(() => M.setNumber(s, firstBulb(s), n), RangeError);
  }
});

test('unassigned always equals 1..55 minus assigned numbers under random edits', () => {
  let seed = 42;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  let s = seedState();
  for (let step = 0; step < 500; step++) {
    const bulbs = s.rows.flatMap((r) => r.bulbs);
    const pick = bulbs[Math.floor(rand() * bulbs.length)];
    const op = rand();
    if (op < 0.6) s = M.setNumber(s, pick.id, rand() < 0.1 ? null : 1 + Math.floor(rand() * 55)).state;
    else if (op < 0.75) s = M.deleteBulb(s, pick.id);
    else if (op < 0.9) s = M.addBulb(s, s.rows[Math.floor(rand() * s.rows.length)].id, rand() * 1000, rand() * 400).state;
    else s = M.moveBulbToRow(s, pick.id, s.rows[Math.floor(rand() * s.rows.length)].id);

    const assigned = M.assignedNumbers(s);
    assert.equal(new Set(assigned).size, assigned.length, 'no duplicate numbers');
    const expected = [];
    for (let n = 1; n <= 55; n++) if (!assigned.includes(n)) expected.push(n);
    assert.deepEqual(M.unassigned(s), expected);
  }
});

test('addBulb inserts at the point in the row that keeps the path shortest', () => {
  let s = { rows: [{ id: 'r', label: 'R', bulbs: [{ id: 'a', x: 0, y: 0, num: null }, { id: 'b', x: 100, y: 0, num: null }] }] };
  s = M.addBulb(s, 'r', 50, 5).state;
  s = M.addBulb(s, 'r', 150, 0).state;
  assert.deepEqual(s.rows[0].bulbs.map((b) => b.x), [0, 50, 100, 150]);
});

test('nearestRowId picks the row whose line passes closest', () => {
  const s = seedState();
  const main2 = s.rows.find((r) => r.label === 'Main 2');
  assert.equal(M.nearestRowId(s, { x: 600, y: 320 }), main2.id);
});

test('export then import reproduces the identical mapping and map', () => {
  let s = seedState();
  s = M.setNumber(s, firstBulb(s, 4, 2), 31).state;
  s = M.moveBulb(s, firstBulb(s, 4, 2), 401.27, 180.04);
  s = M.addRow(s, 'Extra').state;
  s = M.renameRow(s, s.rows[0].id, 'Turing <office>');
  const exported = M.toMapping(s);
  const reimported = M.fromMapping(JSON.parse(JSON.stringify(exported)));
  assert.deepEqual(M.toMapping(reimported), exported);
  assert.equal(renderMap(reimported), renderMap(M.fromMapping(exported)));
});

test('import rejects duplicate numbers, out-of-range numbers, and foreign files', () => {
  const base = M.toMapping(seedState());
  const withNums = (a, b) => {
    const m = structuredClone(base);
    m.rows[0].bulbs[0].num = a;
    m.rows[0].bulbs[1].num = b;
    return m;
  };
  assert.throws(() => M.fromMapping(withNums(5, 5)), /used twice/);
  assert.throws(() => M.fromMapping(withNums(56, null)), /outside/);
  assert.throws(() => M.fromMapping({ ...base, kind: 'other' }), /Not a/);
  assert.throws(() => M.fromMapping({ ...base, schemaVersion: 2 }), /schemaVersion/);
});

test('moveInRow and reverseRow reorder bulbs within a row', () => {
  const s = seedState();
  const row = s.rows[1];
  const ids = row.bulbs.map((b) => b.id);
  const moved = M.moveInRow(s, ids[0], 1);
  assert.deepEqual(moved.rows[1].bulbs.map((b) => b.id), [ids[1], ids[0], ids[2]]);
  assert.deepEqual(M.moveInRow(s, ids[0], -1).rows[1].bulbs.map((b) => b.id), ids, 'clamped at start');
  assert.deepEqual(M.reverseRow(s, row.id).rows[1].bulbs.map((b) => b.id), [...ids].reverse());
});
