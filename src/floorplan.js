// Hand-traced from the Exit Stair A egress sign (IMG_1456), then stretched
// taller so the lights have room. The building rectangle is 1000 x 520 units,
// x along the long axis. Exit Stair A is on the top wall, the windows are
// along the bottom and left walls, and the fire escape is outside the
// bottom-right corner. Geometry is approximate.

export const FLOORPLAN_ID = 'recurse-floor-v1';

export const WIDTH = 1000;
export const HEIGHT = 520;

// Default viewport, with room around the building for the fire escape and labels.
export const VIEW = { x: -20, y: -30, w: 1090, h: 580 };

// kind: 'room' = named space with lights, 'core' = stairs / elevators / services.
export const ROOMS = [
  { name: 'Turing', kind: 'room', x: 0, y: 0, w: 120, h: 266 },
  { name: 'Hopper', kind: 'room', x: 0, y: 266, w: 140, h: 254 },
  { name: 'Sammet', kind: 'room', x: 141, y: 386, w: 151, h: 134 },
  { name: '', kind: 'room', x: 253, y: 208, w: 87, h: 172 },
  { name: 'Elevators', kind: 'core', x: 122, y: 8, w: 150, h: 65 },
  { name: 'Stair A', kind: 'core', x: 311, y: 7, w: 123, h: 65 },
  { name: 'Janitor', kind: 'core', x: 400, y: 78, w: 110, h: 112 },
  { name: 'WC', kind: 'core', x: 517, y: 7, w: 100, h: 183 },
  { name: 'WC', kind: 'core', x: 617, y: 7, w: 100, h: 183 },
  { name: '', kind: 'core', x: 717, y: 7, w: 28, h: 183 },
  { name: 'Couches', kind: 'room', x: 790, y: 266, w: 195, h: 241 },
  { name: 'Fire esc.', kind: 'core', x: 985, y: 393, w: 57, h: 127 },
];

// Structural columns (centers). They stand on the Row 14 line, in the gaps
// between its light groups.
export const COLUMNS = [
  { x: 480, y: 227.5 },
  { x: 655, y: 227.5 },
  { x: 820, y: 227.5 },
];
export const COLUMN_SIZE = 19;

// Open areas named in the walkthrough narration (label positions only).
export const AREAS = [
  { name: 'Elevator lobby', x: 283, y: 146 },
  { name: 'Main area', x: 600, y: 312 },
];
