#!/usr/bin/env node
// Usage: node gen-map.mjs [mapping.json] [outDir]
// Writes <outDir>/map.svg and <outDir>/map.html from an exported mapping.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fromMapping, unassigned } from './src/model.js';
import { renderMap, renderHtmlPage } from './src/render-map.js';

const [input = 'data/mapping.json', outDir = 'dist'] = process.argv.slice(2);

let state;
try {
  state = fromMapping(JSON.parse(readFileSync(input, 'utf8')));
} catch (err) {
  console.error(`Cannot read ${input}: ${err.message}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'map.svg'), renderMap(state));
writeFileSync(join(outDir, 'map.html'), renderHtmlPage(state));

const missing = unassigned(state);
console.log(`Wrote ${join(outDir, 'map.svg')} and ${join(outDir, 'map.html')}`);
if (missing.length) console.log(`Unassigned numbers (${missing.length}): ${missing.join(', ')}`);
