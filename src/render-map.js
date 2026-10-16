// Pure renderer: state -> SVG / HTML strings. The editor uses it for live
// display; gen-map.mjs and the app's export buttons use it for output files.

import { ROOMS, COLUMNS, COLUMN_SIZE, AREAS, VIEW, WIDTH, HEIGHT } from './floorplan.js';

export const PALETTE = [
  '#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ff922b',
  '#38d9a9', '#f783ac', '#a9e34b', '#748ffc', '#e599f7', '#66d9e8',
];
export const rowColor = (i) => PALETTE[i % PALETTE.length];

const BG = '#14121f';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const f = (n) => Math.round(n * 10) / 10;

const STYLE = `
.lm-bg{fill:${BG}}
.lm-wall{fill:none;stroke:#a7a2c3;stroke-width:3}
.lm-win{stroke:#6fb7ff;stroke-width:3;stroke-dasharray:10 6}
.lm-room{fill:#1c1930;stroke:#5f5a78;stroke-width:1.5}
.lm-core{fill:#262139;stroke:#5f5a78;stroke-width:1.5}
.lm-col{fill:#6b6590}
.lm-room-label{fill:#a19bbf;font:600 13px system-ui,sans-serif;text-anchor:middle}
.lm-area-label{fill:#6e6990;font:italic 600 15px system-ui,sans-serif;text-anchor:middle}
.lm-row-line{fill:none;stroke-width:3;stroke-opacity:.45;stroke-linejoin:round}
.lm-row-label{font:700 10px system-ui,sans-serif;text-anchor:middle}
.lm-bulb{cursor:pointer}
.lm-hit{fill:transparent}
.lm-dot{stroke-width:2.5}
.lm-empty .lm-dot{stroke-dasharray:4 3}
.lm-num{font:800 13px system-ui,sans-serif;text-anchor:middle;dominant-baseline:central;fill:#111}
.lm-ring{fill:none;stroke:#fff;stroke-width:3}
.lm-flash .lm-ring{stroke:#ff4d4d;stroke-width:4;animation:lm-pulse .5s infinite}
@keyframes lm-pulse{50%{stroke-opacity:.15}}
`;

export function renderFloor() {
  let s = `<rect class="lm-bg" x="${VIEW.x}" y="${VIEW.y}" width="${VIEW.w}" height="${VIEW.h}"/>`;
  for (const r of ROOMS) {
    s += `<rect class="lm-${r.kind}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`;
  }
  s += `<rect class="lm-wall" x="0" y="0" width="${WIDTH}" height="${HEIGHT}"/>`;
  s += `<line class="lm-win" x1="0" y1="${HEIGHT}" x2="${WIDTH}" y2="${HEIGHT}"/>`;
  s += `<line class="lm-win" x1="0" y1="0" x2="0" y2="${HEIGHT}"/>`;
  for (const c of COLUMNS) {
    const h = COLUMN_SIZE / 2;
    s += `<rect class="lm-col" x="${c.x - h}" y="${c.y - h}" width="${COLUMN_SIZE}" height="${COLUMN_SIZE}"/>`;
  }
  for (const r of ROOMS) {
    if (!r.name) continue;
    // Room names sit along the top edge so they don't collide with bulbs.
    s += `<text class="lm-room-label" x="${r.x + r.w / 2}" y="${r.y + 16}">${esc(r.name)}</text>`;
  }
  for (const a of AREAS) s += `<text class="lm-area-label" x="${a.x}" y="${a.y}">${esc(a.name)}</text>`;
  return s;
}

// Bulb a row's label sits above: the middle bulb for rows that run sideways
// (keeps the label off neighbors at either end), the first bulb otherwise.
export function labelAnchor(bulbs) {
  const xs = bulbs.map((b) => b.x);
  const ys = bulbs.map((b) => b.y);
  const wide = Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys);
  return wide ? bulbs[Math.floor((bulbs.length - 1) / 2)] : bulbs[0];
}

export function renderMapBody(state, { selectedId = null, flashId = null, rowLabels = true } = {}) {
  let s = `<style>${STYLE}</style>${renderFloor()}`;
  state.rows.forEach((row, i) => {
    if (row.bulbs.length < 2) return;
    const pts = row.bulbs.map((b) => `${f(b.x)},${f(b.y)}`).join(' ');
    s += `<polyline class="lm-row-line" stroke="${rowColor(i)}" points="${pts}"/>`;
  });
  state.rows.forEach((row, i) => {
    const color = rowColor(i);
    // Rows named after their room or area are already labeled by it.
    if (rowLabels && row.bulbs.length && ![...ROOMS, ...AREAS].some((r) => r.name === row.label)) {
      const b = labelAnchor(row.bulbs);
      s += `<text class="lm-row-label" fill="${color}" x="${f(b.x)}" y="${f(b.y - 19)}">${esc(row.label)}</text>`;
    }
    for (const b of row.bulbs) {
      const empty = b.num === null;
      const cls = ['lm-bulb', empty && 'lm-empty', b.id === selectedId && 'lm-sel', b.id === flashId && 'lm-flash'].filter(Boolean).join(' ');
      const ring = b.id === selectedId || b.id === flashId ? '<circle class="lm-ring" r="18"/>' : '';
      s += `<g class="${cls}" data-id="${esc(b.id)}" transform="translate(${f(b.x)} ${f(b.y)})">`
        + `<circle class="lm-hit" r="22"/>`
        + `<circle class="lm-dot" r="13" fill="${empty ? BG : color}" stroke="${color}"/>${ring}`
        + `<text class="lm-num"${empty ? ` fill="${color}"` : ''}>${empty ? '?' : b.num}</text></g>`;
    }
  });
  return s;
}

export function renderMap(state, opts = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}">${renderMapBody(state, opts)}</svg>`;
}

// Self-contained page: the map plus a table of each row's numbers in order.
export function renderHtmlPage(state, title = 'Arclight light map') {
  const rows = state.rows
    .map((r, i) => `<tr><td><i style="background:${rowColor(i)}"></i>${esc(r.label)}</td><td>${r.bulbs.map((b) => b.num ?? '?').join(' · ')}</td></tr>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>`
    + `<style>body{margin:0;background:#0e0c17;color:#e8e6f2;font:15px system-ui,sans-serif}h1{font-size:18px;margin:12px}`
    + `.map{overflow-x:auto}.map svg{display:block;min-width:900px;width:100%}`
    + `table{border-collapse:collapse;margin:12px}th,td{padding:5px 10px;border-bottom:1px solid #2a2540;text-align:left}`
    + `i{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:8px}</style></head>`
    + `<body><h1>${esc(title)}</h1><div class="map">${renderMap(state)}</div>`
    + `<table><tr><th>Row</th><th>Light numbers, in row order</th></tr>${rows}</table></body></html>`;
}
