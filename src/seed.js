// Starting guess of the lightbulb rows, built from the walkthrough video
// (IMG_1457) and its narration:
//   Turing: 2 lights. Hopper: 3. Sammet: 3. Elevator lobby: 5.
//   Kitchen: rows of 3, 3 and 4.
//   Couches: 3 track rows (photo IMG_1458). Track heads are
//   counted roughly at 4, 6 and 3.
//   Main area: not counted aloud. It is guessed as 3 runs of pendants on the
//   ceiling pipes, sized so the total comes to 55.
// Positions and rows are rough; fix them on site in the app.

import { fromMapping, KIND, SCHEMA_VERSION } from './model.js';
import { FLOORPLAN_ID } from './floorplan.js';

const line = (x0, y0, x1, y1, n) =>
  Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    return { num: null, x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
  });

export const SEED = {
  schemaVersion: SCHEMA_VERSION,
  kind: KIND,
  floorplan: FLOORPLAN_ID,
  rows: [
    { label: 'Turing', bulbs: line(60, 91, 60, 188, 2) },
    { label: 'Hopper', bulbs: line(70, 332, 70, 462, 3) },
    { label: 'Sammet', bulbs: line(180, 455, 252, 455, 3) },
    { label: 'Elevator lobby', bulbs: line(140, 156, 280, 156, 5) },
    { label: 'Main 1', bulbs: line(320, 228, 700, 228, 7) },
    { label: 'Main 2', bulbs: line(320, 332, 700, 332, 6) },
    { label: 'Main 3', bulbs: line(320, 429, 700, 429, 6) },
    { label: 'Kitchen 1', bulbs: line(790, 52, 790, 169, 3) },
    { label: 'Kitchen 2', bulbs: line(860, 52, 860, 169, 3) },
    { label: 'Kitchen 3', bulbs: line(935, 52, 935, 228, 4) },
    { label: 'Couches 1', bulbs: line(825, 364, 825, 481, 4) },
    { label: 'Couches 2', bulbs: line(890, 351, 890, 494, 6) },
    { label: 'Couches 3', bulbs: line(955, 371, 955, 462, 3) },
  ],
};

export const seedState = () => fromMapping(SEED);
