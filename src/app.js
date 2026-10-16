import * as M from './model.js';
import { seedState } from './seed.js';
import { renderMapBody, renderMap, renderHtmlPage, rowColor } from './render-map.js';
import { VIEW } from './floorplan.js';
import { load, save } from './storage.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const svg = $('#map');

// Baseline = the committed data/mapping.json if present, otherwise the
// built-in rough guess. `tag` identifies its exact content.
async function fetchBaseline() {
  try {
    const res = await fetch('data/mapping.json', { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      return { tag: `file:${text.length}:${hash(text)}`, state: M.fromMapping(JSON.parse(text)) };
    }
  } catch (err) {
    console.error('data/mapping.json unreadable; using the starting guess', err);
  }
  return { tag: 'seed', state: seedState() };
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

const base = await fetchBaseline();
let state = load(base.tag) ?? base.state;
const undoStack = [];
let selectedId = null;
let flashId = null;
let addMode = false;
let targetRowId = null; // row new bulbs go into; null = nearest row
let pendingNum = null; // number picked from the chips, waiting for a bulb tap
let drag = null; // { id, x, y } while dragging a bulb
let sheetFor = null;
let view = { ...VIEW };

// ---------- state ----------

function commit(next) {
  undoStack.push(state);
  if (undoStack.length > 200) undoStack.shift();
  state = next;
  save(state, base.tag);
  if (selectedId && !M.findBulb(state, selectedId)) selectedId = null;
  if (targetRowId && !state.rows.some((r) => r.id === targetRowId)) targetRowId = null;
  render();
}

function undo() {
  if (!undoStack.length) return;
  state = undoStack.pop();
  save(state, base.tag);
  if (selectedId && !M.findBulb(state, selectedId)) selectedId = null;
  render();
}

function assign(bulbId, num) {
  let result;
  try {
    result = M.setNumber(state, bulbId, num);
  } catch (err) {
    toast(err.message);
    return false;
  }
  commit(result.state);
  if (result.displaced) {
    flash(result.displaced);
    toast(`#${num} moved here. Its old bulb is now blank (flashing).`);
  }
  return true;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2800);
}

function flash(id) {
  flashId = id;
  render();
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => {
    flashId = null;
    render();
  }, 3000);
}

function select(id) {
  selectedId = id;
  render();
  if (id) $('#numInput').focus({ preventScroll: true });
}

// ---------- render ----------

function render() {
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  const shown = drag ? M.moveBulb(state, drag.id, drag.x, drag.y) : state;
  svg.innerHTML = renderMapBody(shown, { selectedId, flashId });

  const n = M.assignedCount(state);
  $('#count').textContent = `${n}/${M.MAX}`;
  $('#count').classList.toggle('done', n === M.MAX);
  $('#undo').disabled = !undoStack.length;

  const target = state.rows.find((r) => r.id === targetRowId);
  $('#addBtn').classList.toggle('on', addMode);
  $('#addBtn').textContent = addMode ? `Adding → ${target ? target.label : 'nearest row'}` : 'Add bulb';

  renderTodo();
  renderSheet();
  if ($('#rowsDlg').open) renderRows();
}

function renderTodo() {
  const list = M.unassigned(state);
  $('#todoLabel').textContent = list.length ? `Unassigned (${list.length}):` : `All ${M.MAX} assigned ✓`;
  $('#chips').innerHTML = list.map((n) => `<button class="chip${n === pendingNum ? ' on' : ''}" data-n="${n}">${n}</button>`).join('');
}

function renderSheet() {
  const hit = selectedId && M.findBulb(state, selectedId);
  if (!hit) {
    $('#sheet').hidden = true;
    sheetFor = null;
    return;
  }
  $('#sheet').hidden = false;
  const ri = state.rows.indexOf(hit.row);
  $('#sheetTitle').innerHTML = `<span class="swatch" style="background:${rowColor(ri)}"></span>${esc(hit.row.label)} · bulb ${hit.index + 1} of ${hit.row.bulbs.length}`;
  $('#rowSelect').innerHTML = state.rows.map((r) => `<option value="${r.id}"${r === hit.row ? ' selected' : ''}>${esc(r.label)}</option>`).join('');
  if (sheetFor !== selectedId) {
    sheetFor = selectedId;
    $('#numInput').value = hit.bulb.num ?? '';
  }
}

function renderRows() {
  $('#rowsList').innerHTML = state.rows
    .map((r, i) => `<li data-id="${r.id}"><span class="swatch" style="background:${rowColor(i)}"></span>`
      + `<input value="${esc(r.label)}" data-act="rename" aria-label="Row name">`
      + `<span class="cnt">${r.bulbs.length}</span>`
      + `<button data-act="up" title="Move up">↑</button><button data-act="down" title="Move down">↓</button>`
      + `<button data-act="rev" title="Reverse bulb order">⇄</button><button data-act="add" title="Add bulbs to this row">+</button>`
      + `<button data-act="del" class="danger" title="Delete row">✕</button></li>`)
    .join('');
}

// ---------- map gestures: tap, drag selected bulb, pan, pinch / wheel zoom ----------

function clientToMap(v, cx, cy) {
  const r = svg.getBoundingClientRect();
  return { x: v.x + ((cx - r.left) * v.w) / r.width, y: v.y + ((cy - r.top) * v.h) / r.height };
}

// Keeps the viewBox aspect equal to the element's, so pixels map linearly.
function fit() {
  const r = svg.getBoundingClientRect();
  const aspect = r.height / r.width;
  let w = VIEW.w;
  let h = w * aspect;
  if (h < VIEW.h) {
    h = VIEW.h;
    w = h / aspect;
  }
  view = { x: VIEW.x + (VIEW.w - w) / 2, y: VIEW.y + (VIEW.h - h) / 2, w, h };
}

function zoomTo(base, anchorMap, cx, cy, w) {
  const r = svg.getBoundingClientRect();
  w = Math.min(Math.max(w, 120), VIEW.w * 3);
  const h = (w * r.height) / r.width;
  view = { x: anchorMap.x - ((cx - r.left) * w) / r.width, y: anchorMap.y - ((cy - r.top) * h) / r.height, w, h };
}

const pointers = new Map();
let gesture = null;

svg.addEventListener('pointerdown', (e) => {
  svg.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    gesture = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), anchor: clientToMap(view, mid.x, mid.y), w0: view.w };
    drag = null;
    return;
  }
  const g = e.target.closest('.lm-bulb');
  gesture = { kind: 'tap', x0: e.clientX, y0: e.clientY, bulbId: g?.dataset.id ?? null, view0: { ...view } };
});

svg.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!gesture) return;
  if (gesture.kind === 'pinch') {
    if (pointers.size < 2) return;
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    zoomTo(view, gesture.anchor, (a.x + b.x) / 2, (a.y + b.y) / 2, (gesture.w0 * gesture.d0) / d);
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    return;
  }
  const dx = e.clientX - gesture.x0;
  const dy = e.clientY - gesture.y0;
  if (gesture.kind === 'tap') {
    if (Math.hypot(dx, dy) < 6) return;
    gesture.kind = gesture.bulbId && gesture.bulbId === selectedId ? 'drag' : 'pan';
  }
  if (gesture.kind === 'pan') {
    const v = gesture.view0;
    const scale = v.w / svg.getBoundingClientRect().width;
    view = { ...v, x: v.x - dx * scale, y: v.y - dy * scale };
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  } else if (gesture.kind === 'drag') {
    const p = clientToMap(view, e.clientX, e.clientY);
    drag = { id: gesture.bulbId, x: p.x, y: p.y };
    render();
  }
});

function endPointer(e) {
  if (!pointers.delete(e.pointerId)) return;
  const g = gesture;
  if (!g) return;
  if (g.kind === 'pinch') {
    if (pointers.size === 0) gesture = null;
    return;
  }
  gesture = null;
  if (e.type === 'pointercancel') {
    drag = null;
    render();
    return;
  }
  if (g.kind === 'drag' && drag) {
    const d = drag;
    drag = null;
    commit(M.moveBulb(state, d.id, d.x, d.y));
  } else if (g.kind === 'tap') {
    onTap(g.bulbId, clientToMap(view, e.clientX, e.clientY));
  }
}
svg.addEventListener('pointerup', endPointer);
svg.addEventListener('pointercancel', endPointer);

svg.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomTo(view, clientToMap(view, e.clientX, e.clientY), e.clientX, e.clientY, view.w * Math.exp(e.deltaY * 0.0015));
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
}, { passive: false });

function onTap(bulbId, p) {
  if (bulbId) {
    if (pendingNum !== null) {
      const n = pendingNum;
      pendingNum = null;
      assign(bulbId, n);
      return;
    }
    select(bulbId);
    return;
  }
  if (!addMode) {
    select(null);
    return;
  }
  let s = state;
  let rowId = targetRowId ?? M.nearestRowId(s, p);
  if (!rowId) {
    const r = M.addRow(s, `Row ${s.rows.length + 1}`);
    s = r.state;
    rowId = r.rowId;
  }
  const added = M.addBulb(s, rowId, p.x, p.y);
  commit(added.state);
  select(added.bulbId);
}

// ---------- controls ----------

$('#undo').addEventListener('click', undo);
$('#fitBtn').addEventListener('click', () => {
  fit();
  render();
});
$('#addBtn').addEventListener('click', () => {
  addMode = !addMode;
  if (!addMode) targetRowId = null;
  else toast('Tap empty floor to add a bulb');
  render();
});

$('#chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const n = Number(chip.dataset.n);
  if (selectedId) {
    if (assign(selectedId, n)) select(null);
    return;
  }
  pendingNum = pendingNum === n ? null : n;
  if (pendingNum !== null) toast(`Now tap the bulb that is #${n}`);
  render();
});

$('#numForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const raw = $('#numInput').value.trim();
  const num = raw === '' ? null : Number(raw);
  if (assign(selectedId, num)) {
    $('#numInput').blur();
    select(null);
  }
});
$('#clearNum').addEventListener('click', () => {
  if (assign(selectedId, null)) $('#numInput').value = '';
});
$('#sheetClose').addEventListener('click', () => select(null));
$('#rowSelect').addEventListener('change', (e) => commit(M.moveBulbToRow(state, selectedId, e.target.value)));
$('#orderPrev').addEventListener('click', () => commit(M.moveInRow(state, selectedId, -1)));
$('#orderNext').addEventListener('click', () => commit(M.moveInRow(state, selectedId, 1)));
$('#delBulb').addEventListener('click', () => commit(M.deleteBulb(state, selectedId)));

// Rows dialog
$('#rowsBtn').addEventListener('click', () => {
  renderRows();
  $('#rowsDlg').showModal();
});
$('#rowsClose').addEventListener('click', () => $('#rowsDlg').close());
$('#newRow').addEventListener('click', () => {
  const r = M.addRow(state, `Row ${state.rows.length + 1}`);
  commit(r.state);
  targetRowId = r.rowId;
  addMode = true;
  $('#rowsDlg').close();
  render();
  toast('Tap the map to add bulbs to the new row');
});
$('#rowsList').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.closest('li').dataset.id;
  const row = state.rows.find((r) => r.id === id);
  switch (btn.dataset.act) {
    case 'up': commit(M.moveRow(state, id, -1)); break;
    case 'down': commit(M.moveRow(state, id, 1)); break;
    case 'rev': commit(M.reverseRow(state, id)); break;
    case 'add':
      targetRowId = id;
      addMode = true;
      $('#rowsDlg').close();
      render();
      toast(`Tap the map to add bulbs to ${row.label}`);
      break;
    case 'del':
      if (row.bulbs.length && !confirm(`Delete "${row.label}" and its ${row.bulbs.length} bulbs?`)) return;
      commit(M.deleteRow(state, id));
      break;
  }
});
$('#rowsList').addEventListener('change', (e) => {
  if (e.target.dataset.act !== 'rename') return;
  const label = e.target.value.trim();
  if (label) commit(M.renameRow(state, e.target.closest('li').dataset.id, label));
});

// Export / import dialog
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const mappingJson = () => JSON.stringify(M.toMapping(state), null, 2);

function importText(text) {
  let next;
  try {
    next = M.fromMapping(JSON.parse(text));
  } catch (err) {
    toast(`Import failed: ${err.message}`);
    return;
  }
  selectedId = null;
  commit(next);
  $('#fileDlg').close();
  toast('Imported');
}

$('#fileBtn').addEventListener('click', () => $('#fileDlg').showModal());
$('#fileClose').addEventListener('click', () => $('#fileDlg').close());
$('#dlJson').addEventListener('click', () => download('mapping.json', mappingJson(), 'application/json'));
$('#dlSvg').addEventListener('click', () => download('map.svg', renderMap(state), 'image/svg+xml'));
$('#dlHtml').addEventListener('click', () => download('map.html', renderHtmlPage(state), 'text/html'));
$('#copyJson').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(mappingJson());
    toast('Copied');
  } catch {
    $('#importText').value = mappingJson();
    $('#importText').select();
    toast('Clipboard blocked: JSON is in the text box, copy it manually');
  }
});
$('#importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) importText(await file.text());
  e.target.value = '';
});
$('#importPaste').addEventListener('click', () => importText($('#importText').value));
$('#resetSeed').addEventListener('click', async () => {
  if (!confirm('Discard this browser\'s edits and reload data/mapping.json (or the starting guess)? Undo can bring them back.')) return;
  selectedId = null;
  commit((await fetchBaseline()).state);
  $('#fileDlg').close();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.querySelector('dialog[open]')) select(null);
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault();
    undo();
  }
});

window.addEventListener('resize', () => {
  const r = svg.getBoundingClientRect();
  const h = (view.w * r.height) / r.width;
  view = { ...view, y: view.y + (view.h - h) / 2, h };
  render();
});

fit();
render();
