import { clone, uid, clamp, bounds, constrain, makeElement, removeElement, duplicateElement } from './model.js';
import { sampleLayout } from './sample.js';
import { drawChart } from './charts.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const canvas = $('#canvas');
const state = { layout: clone(sampleLayout), name: 'Business overview', version: 1, csrf: '', mode: 'loading', selected: null, zoom: .7, fit: true, mobile: false, preview: false, dirty: false, undo: [], redo: [], editing: null, saving: false };
const symbols = { section: '▤', text: 'T', image: '▧', bar: '▥', line: '⌁' };
let toastTimer, drag, uploadTarget;
const selected = () => state.layout.elements.find(e => e.id === state.selected);
const snapshot = () => ({ layout: clone(state.layout), name: state.name });
function checkpoint(before = snapshot()) { state.undo.push(before); if (state.undo.length > 50) state.undo.shift(); state.redo = []; }
function dirty() { state.dirty = true; $('#save-status').textContent = '● Unsaved changes'; updateButtons(); }
function updateButtons() { $('#undo').disabled = !state.undo.length || state.preview; $('#redo').disabled = !state.redo.length || state.preview; $('#save').disabled = state.saving || state.mode === 'loading'; }
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => $('#toast').hidden = true, 5500); }
function change(fn) { if (state.preview) return; endEditing(); checkpoint(); fn(); dirty(); render(); }
function escape(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function select(id) { if (state.editing && state.editing !== id) endEditing(); state.selected = id; renderSelection(); renderProperties(); renderLayers(); }
function applyGeometry(node, element) { Object.assign(node.style, { left: element.x + 'px', top: element.y + 'px', width: element.width + 'px', height: element.height + 'px', background: element.background, color: element.color, borderRadius: element.radius + 'px', fontSize: element.fontSize + 'px' }); }
function renderElement(element) {
  const node = document.createElement('div');node.className = 'element';node.dataset.id = element.id;node.dataset.type = element.type;
  node.tabIndex = state.preview ? -1 : 0;node.setAttribute('aria-label', `${element.name}, ${element.type}. Use arrow keys to move.`);
  applyGeometry(node, element);
  if (element.type === 'text') {
    const body = document.createElement('div');body.className = 'element-body text-content';body.setAttribute('role', 'textbox');body.setAttribute('aria-label', element.name);body.setAttribute('aria-multiline', 'true');
    element.content.runs.forEach(run => {const span = document.createElement('span');span.textContent = run.text;span.style.fontWeight = run.bold ? '700' : '400';span.style.fontStyle = run.italic ? 'italic' : 'normal';body.append(span);});
    body.addEventListener('dblclick', () => startEditing(element.id));
    node.append(body);
  } else if (element.type === 'image') {
    const body = document.createElement('div');body.className = 'element-body';
    if (element.content.src) {const image = document.createElement('img');image.src = element.content.src;image.alt = element.content.alt;image.style.objectFit = element.content.fit;body.append(image);}
    else {body.innerHTML = '<div class="image-placeholder"><span>▧</span>Double-click to upload</div>';}
    node.append(body);node.addEventListener('dblclick', () => {if (!state.preview) pickImage(element.id);});
  } else if (['bar', 'line'].includes(element.type)) {
    const body = document.createElement('div');body.className = 'element-body';
    const title = document.createElement('div');title.className = 'chart-title';title.textContent = element.content.title;
    const subtitle = document.createElement('div');subtitle.className = 'chart-subtitle';subtitle.textContent = 'This year · Sample data';
    const chart = document.createElement('canvas');chart.className = 'chart-canvas';chart.setAttribute('role', 'img');chart.setAttribute('aria-label', element.content.title + ': ' + element.content.labels.map((label, i) => `${label} ${element.content.values[i]}`).join(', '));
    body.append(chart, title, subtitle);node.append(body);drawChart(chart, element);
  }
  node.addEventListener('pointerdown', event => onPointerDown(event, element));
  node.addEventListener('focus', () => {if (!state.preview && !drag) select(element.id);});
  return node;
}
function render() {
  canvas.replaceChildren();canvas.style.background = state.layout.background;canvas.style.width = state.layout.width + 'px';canvas.style.height = state.layout.height + 'px';
  const nodes = new Map();
  for (const element of state.layout.elements) {const node = renderElement(element);nodes.set(element.id, node);}
  for (const element of state.layout.elements) (nodes.get(element.parentId) || canvas).append(nodes.get(element.id));
  $('#dashboard-name').value = state.name;$('.breadcrumb strong').textContent = state.name;$('.canvas-label span').textContent = state.name.toUpperCase();
  $('#canvas-dimensions').textContent = `${state.layout.width} × ${state.layout.height}`;
  renderSelection();renderProperties();renderLayers();updateZoom();updateButtons();
}
function renderSelection() {
  $$('.selection-label,.resize-handle', canvas).forEach(node => node.remove());
  $$('.element', canvas).forEach(node => node.classList.toggle('selected', node.dataset.id === state.selected && !state.preview));
  const element = selected();$('#selection-status').textContent = element ? `${element.name} · ${Math.round(element.width)} × ${Math.round(element.height)}` : 'Click an element to get started';
  $('.inspector').classList.toggle('has-selection', Boolean(element));
  if (!element || state.preview) return;
  const node = $$('.element', canvas).find(node => node.dataset.id === element.id);
  if (!node) return;
  const label = document.createElement('div');label.className = 'selection-label';label.textContent = element.name;node.append(label);
  for (const dir of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {const handle = document.createElement('div');handle.className = 'resize-handle';handle.dataset.dir = dir;handle.setAttribute('aria-hidden', 'true');node.append(handle);}
}
function renderLayers() {
  $('#layer-count').textContent = state.layout.elements.length;
  const list = $('#layer-list');list.replaceChildren();
  const append = item => {const button = document.createElement('button');button.className = `layer-row ${item.parentId ? 'child' : ''} ${item.id === state.selected ? 'active' : ''}`;button.innerHTML = `<span>${symbols[item.type]}</span><span>${escape(item.name)}</span>`;button.addEventListener('click', () => select(item.id));list.append(button);};
  for (const item of state.layout.elements.filter(e => !e.parentId)) {append(item);state.layout.elements.filter(e => e.parentId === item.id).forEach(append);}
}
const field = (label, key, value, type = 'number', extra = '') => `<label>${label}<input data-prop="${key}" type="${type}" value="${escape(value)}" ${extra}></label>`;
const colorField = (label, key, value) => `<div class="color-row"><label>${label}</label><div class="color-label"><input type="color" aria-label="${label}" data-prop="${key}" value="${value}"><span>${value.toUpperCase()}</span></div></div>`;
function renderProperties() {
  const target = $('#properties');const e = selected();
  if (!e) {
    target.innerHTML = `<div class="selected-label"><span>▱</span><div><strong>Canvas</strong><small>Your dashboard’s foundation</small></div></div><div class="property-group"><h3>Dimensions</h3><div class="property-grid">${field('Width', 'canvas.width', state.layout.width, 'number', 'min="320" max="2400"')}${field('Height', 'canvas.height', state.layout.height, 'number', 'min="320" max="5000"')}</div><p class="hint">Elements scale to fit smaller preview widths.</p></div><div class="property-group"><h3>Appearance</h3>${colorField('Background', 'canvas.background', state.layout.background)}</div><div class="empty-state"><div class="empty-icon">⌖</div>Select something on the canvas.<br>Let’s make it your own.</div>`;
  } else {
    target.innerHTML = `<div class="selected-label"><span>${symbols[e.type]}</span><div><strong>${escape(e.type === 'section' ? 'Section' : e.type === 'text' ? 'Text block' : e.type === 'image' ? 'Image' : 'Chart')}</strong><small>Selected element</small></div></div><div class="property-group">${field('Layer name', 'name', e.name, 'text', 'maxlength="120"')}</div><div class="property-group"><h3>Layout</h3><div class="property-grid">${field('X position', 'x', Math.round(e.x), 'number', 'min="0"')}${field('Y position', 'y', Math.round(e.y), 'number', 'min="0"')}${field('Width', 'width', Math.round(e.width), 'number', 'min="100"')}${field('Height', 'height', Math.round(e.height), 'number', 'min="60"')}</div>${e.type !== 'section' ? `<label>Container<select data-prop="parentId"><option value="">Canvas</option>${state.layout.elements.filter(i => i.type === 'section').map(i => `<option value="${i.id}" ${i.id === e.parentId ? 'selected' : ''}>${escape(i.name)}</option>`).join('')}</select></label>` : '<p class="hint">Child blocks move with this section.</p>'}</div><div class="property-group"><h3>Appearance</h3>${colorField('Background', 'background', e.background)}${colorField('Text color', 'color', e.color)}${field('Corner radius', 'radius', e.radius, 'number', 'min="0" max="100"')}</div>`;
    if (e.type === 'text') target.innerHTML += `<div class="property-group"><h3>Typography</h3>${field('Font size', 'fontSize', e.fontSize, 'number', 'min="10" max="96"')}<div class="text-toolbar"><button data-format="bold" aria-label="Bold" title="Bold"><b>B</b></button><button data-format="italic" aria-label="Italic" title="Italic"><i>I</i></button></div><button class="button wide" id="edit-text">Edit text</button><p class="hint">Double-click text to write. Select words to format, or use B / I to format the whole block.</p></div>`;
    if (e.type === 'image') target.innerHTML += `<div class="property-group"><h3>Image</h3>${field('Image description', 'content.alt', e.content.alt, 'text', 'maxlength="500"')}<label>Image fit<select data-prop="content.fit"><option ${e.content.fit === 'cover' ? 'selected' : ''}>cover</option><option ${e.content.fit === 'contain' ? 'selected' : ''}>contain</option></select></label><button class="button wide" id="replace-image">↑ Upload image</button><p class="hint">PNG, JPEG, WebP or GIF. Up to 2 MB. Images are saved with your layout.</p></div>`;
    if (['bar', 'line'].includes(e.type)) target.innerHTML += `<div class="property-group"><h3>Chart data</h3>${field('Title', 'content.title', e.content.title, 'text', 'maxlength="120"')}<label>Chart type<select data-prop="type"><option value="bar" ${e.type === 'bar' ? 'selected' : ''}>Bar chart</option><option value="line" ${e.type === 'line' ? 'selected' : ''}>Line chart</option></select></label><label>Labels (comma-separated)<textarea id="chart-labels">${escape(e.content.labels.join(', '))}</textarea></label><label>Values (comma-separated)<textarea id="chart-values">${escape(e.content.values.join(', '))}</textarea></label><button class="button wide" id="apply-data">Apply data</button><button class="button wide" id="randomize">↻ Generate sample data</button>${colorField('Chart color', 'content.accent', e.content.accent)}</div>`;
    target.innerHTML += '<div class="property-group"><div class="property-grid"><button class="button" id="backward" title="Move backward within container">↓ Back</button><button class="button" id="forward" title="Move forward within container">↑ Front</button></div><button class="button wide" id="duplicate">▱ Duplicate</button><button class="button wide danger" id="delete">Delete element</button></div>';
  }
  $$('[data-prop]', target).forEach(input => input.addEventListener('change', () => updateProperty(input.dataset.prop, input.value)));
  $('#edit-text')?.addEventListener('click', () => startEditing(e.id));
  $$('.text-toolbar button', target).forEach(button => {button.addEventListener('pointerdown', event => event.preventDefault());button.addEventListener('click', () => formatText(button.dataset.format));});
  $('#replace-image')?.addEventListener('click', () => pickImage(e.id));
  $('#delete')?.addEventListener('click', deleteSelected);$('#duplicate')?.addEventListener('click', duplicateSelected);
  $('#forward')?.addEventListener('click', () => reorder(1));$('#backward')?.addEventListener('click', () => reorder(-1));
  $('#apply-data')?.addEventListener('click', () => {
    const labels = $('#chart-labels').value.split(',').map(s => s.trim());const raw = $('#chart-values').value.split(',').map(s => s.trim());const values = raw.map(Number);
    if (labels.length < 2 || labels.length > 24 || labels.length !== values.length || labels.some(s => !s || s.length > 30) || raw.some(s => !s) || values.some(n => !Number.isFinite(n) || n < 0 || n > 1000000)) return toast('Use 2–24 matching labels and numeric values from 0 to 1,000,000.');
    change(() => Object.assign(e.content, { labels, values }));
  });
  $('#randomize')?.addEventListener('click', () => change(() => {e.content.values = e.content.labels.map(() => 10 + Math.floor(Math.random() * 90));}));
}
function updateProperty(key, raw) {
  const e = selected();
  const numeric = ['x', 'y', 'width', 'height', 'radius', 'fontSize', 'canvas.width', 'canvas.height'].includes(key);
  let value = numeric ? Number(raw) : raw;
  if (numeric && (!raw.trim() || !Number.isFinite(value))) {toast('Enter a valid number.');renderProperties();return;}
  change(() => {
    if (key.startsWith('canvas.')) {
      const field = key.split('.')[1];if (field === 'width') value = clamp(value, 320, 2400);if (field === 'height') value = clamp(value, 320, 5000);
      state.layout[field] = value;state.layout.elements.filter(i => !i.parentId).forEach(i => constrain(state.layout, i));return;
    }
    if (!e) return;
    if (key === 'parentId') {e.parentId = value || null;e.x = 16;e.y = 16;}
    else if (key.startsWith('content.')) e.content[key.split('.')[1]] = value;
    else e[key] = key === 'radius' ? clamp(value, 0, 100) : key === 'fontSize' ? clamp(value, 10, 96) : value;
    constrain(state.layout, e);
  });
}
function onPointerDown(event, e) {
  if (state.preview || event.button !== 0) return;
  event.stopPropagation();
  const dir = event.target.dataset.dir;
  if (state.editing === e.id && event.target.closest('[contenteditable=true]') && !dir) return;
  endEditing();select(e.id);
  event.preventDefault();
  drag = { id: e.id, dir, startX: event.clientX, startY: event.clientY, original: clone(e), before: snapshot(), moved: false };
  canvas.setPointerCapture(event.pointerId);
}
canvas.addEventListener('pointermove', event => {
  if (!drag) return;
  const e = selected();if (!e) return;
  const dx = (event.clientX - drag.startX) / state.zoom, dy = (event.clientY - drag.startY) / state.zoom;
  if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
  drag.moved = true;const o = drag.original;const box = bounds(state.layout, e);
  if (!drag.dir) {e.x = clamp(Math.round(o.x + dx), 0, box.width - e.width);e.y = clamp(Math.round(o.y + dy), 0, box.height - e.height);}
  else {
    if (drag.dir.includes('e')) e.width = clamp(Math.round(o.width + dx), 100, box.width - o.x);
    if (drag.dir.includes('s')) e.height = clamp(Math.round(o.height + dy), 60, box.height - o.y);
    if (drag.dir.includes('w')) {e.x = clamp(Math.round(o.x + dx), 0, o.x + o.width - 100);e.width = o.width + o.x - e.x;}
    if (drag.dir.includes('n')) {e.y = clamp(Math.round(o.y + dy), 0, o.y + o.height - 60);e.height = o.height + o.y - e.y;}
    constrain(state.layout, e);
  }
  const node = $$('.element', canvas).find(n => n.dataset.id === e.id);applyGeometry(node, e);
  if (e.type === 'section') state.layout.elements.filter(i => i.parentId === e.id).forEach(child => {const n = $$('.element', node).find(n => n.dataset.id === child.id);applyGeometry(n, child);if ($('canvas', n)) drawChart($('canvas', n), child);});
  if ($('canvas', node) && e.type !== 'section') drawChart($('canvas', node), e);
});
function finishDrag(event) {
  if (!drag) return;
  if (drag.moved) {checkpoint(drag.before);dirty();}
  drag = null;if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);renderProperties();renderSelection();
}
canvas.addEventListener('pointerup', finishDrag);canvas.addEventListener('pointercancel', finishDrag);
canvas.addEventListener('pointerdown', event => {if (event.target === canvas && !state.preview) {endEditing();select(null);}});
function startEditing(id) {
  if (state.preview) return;
  endEditing();select(id);
  const node = $$('.element', canvas).find(n => n.dataset.id === id);const body = $('.text-content', node);
  if (!body) return;
  state.editing = id;body.contentEditable = 'true';body.dataset.before = JSON.stringify(snapshot());body.focus();
  const range = document.createRange();range.selectNodeContents(body);range.collapse(false);const selection = window.getSelection();selection.removeAllRanges();selection.addRange(range);
  body.onpaste = event => {event.preventDefault();document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));};
  body.ondrop = event => event.preventDefault();
  body.oninput = () => {const item = state.layout.elements.find(e => e.id === id);if (item) {item.content.runs = readRuns(body);dirty();}};
  body.onblur = () => {setTimeout(() => {if (state.editing === id && !body.contains(document.activeElement)) endEditing();}, 0);};
}
function readRuns(body) {
  const runs = [];
  const add = (text, bold, italic) => {if (!text) return;const last = runs.at(-1);if (last && last.bold === bold && last.italic === italic) last.text += text;else runs.push({ text, bold, italic });};
  const walk = (node, bold = false, italic = false) => {
    if (node.nodeType === Node.TEXT_NODE) return add(node.textContent, bold, italic);
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName === 'BR') return add('\n', bold, italic);
    const style = node.style;
    const b = style.fontWeight ? ['bold', '700', '800', '900'].includes(style.fontWeight) : bold || ['B', 'STRONG'].includes(node.tagName);
    const i = style.fontStyle ? style.fontStyle === 'italic' : italic || ['I', 'EM'].includes(node.tagName);
    if (['DIV', 'P'].includes(node.tagName) && runs.length && !runs.at(-1).text.endsWith('\n')) add('\n', b, i);
    node.childNodes.forEach(child => walk(child, b, i));
  };
  body.childNodes.forEach(node => walk(node));return runs.length ? runs : [{text: '', bold: false, italic: false}];
}
function endEditing() {
  if (!state.editing) return;
  const node = $$('.element', canvas).find(n => n.dataset.id === state.editing);const body = node && $('.text-content', node);
  state.editing = null;
  if (body) {body.contentEditable = 'false';const before = JSON.parse(body.dataset.before);if (JSON.stringify(before.layout) !== JSON.stringify(state.layout)) {checkpoint(before);dirty();}}
}
function formatText(format) {
  const e = selected();if (!e || e.type !== 'text') return;
  const selection = window.getSelection();const body = $$('.element', canvas).find(n => n.dataset.id === e.id)?.querySelector('.text-content');
  if (state.editing === e.id && selection.rangeCount && !selection.isCollapsed && body.contains(selection.anchorNode) && body.contains(selection.focusNode)) {
    document.execCommand(format, false);e.content.runs = readRuns(body);dirty();
  } else change(() => {const value = !e.content.runs.every(run => run[format]);e.content.runs.forEach(run => run[format] = value);});
}
function add(type) {
  if (state.layout.elements.length >= 150) return toast('This dashboard supports up to 150 elements.');
  change(() => {
    const parent = selected()?.type === 'section' && type !== 'section' ? state.selected : null;
    const item = makeElement(type, parent);
    if (!parent) {const offset = state.layout.elements.filter(e => !e.parentId).length % 6;item.x += offset * 24;item.y += offset * 32;}
    state.layout.elements.push(item);constrain(state.layout, item);state.selected = item.id;
  });
  if (type === 'image') pickImage(state.selected);
}
function pickImage(id) {uploadTarget = id;$('#image-upload').value = '';$('#image-upload').click();}
$('#image-upload').addEventListener('change', async event => {
  const file = event.target.files[0];if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 2 * 1024 * 1024) return toast('Choose a PNG, JPEG, WebP or GIF under 2 MB.');
  const id = uploadTarget;
  try {
    const src = await new Promise((resolve, reject) => {const reader = new FileReader();reader.onload = () => resolve(reader.result);reader.onerror = reject;reader.readAsDataURL(file);});
    const image = new Image();image.src = src;await image.decode();if (image.naturalWidth > 10000 || image.naturalHeight > 10000) throw new Error('Image dimensions must be at most 10,000 pixels.');
    const item = state.layout.elements.find(e => e.id === id);if (!item) return;
    change(() => {item.content.src = src;item.content.alt = file.name.slice(0, 500);});toast('Image added. Save to keep your changes.');
  } catch (error) {toast(error.message || 'This image could not be read.');}
});
function deleteSelected() {const e = selected();if (e) change(() => {removeElement(state.layout, e.id);state.selected = null;});}
function duplicateSelected() {const e = selected();if (!e) return;if (state.layout.elements.length + 1 + state.layout.elements.filter(i => i.parentId === e.id).length > 150) return toast('This dashboard supports up to 150 elements.');change(() => {state.selected = duplicateElement(state.layout, e.id).id;});}
function reorder(direction) {const e = selected();if (!e) return;change(() => {const peers = state.layout.elements.filter(i => i.parentId === e.parentId);const other = peers[peers.indexOf(e) + direction];if (other) {const a = state.layout.elements.indexOf(e), b = state.layout.elements.indexOf(other);[state.layout.elements[a], state.layout.elements[b]] = [state.layout.elements[b], state.layout.elements[a]];}});}
function history(direction) {
  endEditing();const source = state[direction];if (!source.length || state.preview) return;
  state[direction === 'undo' ? 'redo' : 'undo'].push(snapshot());const previous = source.pop();state.layout = previous.layout;state.name = previous.name;
  if (!selected()) state.selected = null;dirty();render();
}
function updateZoom() {
  const available = Math.max(100, $('#canvas-scroll').clientWidth - (window.innerWidth < 700 ? 28 : 72));
  if (state.fit) state.zoom = Math.min(1, Math.min(available, state.mobile ? 390 : Infinity) / state.layout.width);
  $('#canvas-stage').style.width = state.layout.width * state.zoom + 'px';$('#canvas-stage').style.height = state.layout.height * state.zoom + 24 + 'px';
  canvas.style.transform = `scale(${state.zoom})`;$('#zoom-fit').textContent = Math.round(state.zoom * 100) + '%';
}
async function save() {
  endEditing();if (state.saving) return;
  const payload = { ...snapshot(), version: state.version };
  if (new Blob([JSON.stringify(payload)]).size > 7 * 1024 * 1024) return toast('Dashboard exceeds 7 MB. Remove or reduce some images.');
  state.saving = true;updateButtons();$('#save-status').textContent = 'Saving…';
  try {
    if (state.mode === 'demo') localStorage.setItem('forma-demo-v1', JSON.stringify(payload));
    else {
      const response = await fetch('api/dashboard.php', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': state.csrf }, body: JSON.stringify(payload) });
      const result = await response.json();if (!response.ok) throw new Error(result.error || 'Could not save dashboard.');state.version = result.dashboard.version;
    }
    state.dirty = JSON.stringify(snapshot()) !== JSON.stringify({ layout: payload.layout, name: payload.name });
    $('#save-status').textContent = state.dirty ? '● Unsaved changes' : state.mode === 'demo' ? 'Saved in this browser' : '✓ All changes saved';
    toast(state.mode === 'demo' ? 'Saved in this browser only. Run the LAMP stack for MySQL persistence.' : 'Dashboard saved to MySQL.');
  } catch (error) {$('#save-status').textContent = 'Save failed · changes kept';toast(error.message || 'Save failed. Your changes are still on the canvas.');}
  finally {state.saving = false;updateButtons();}
}
async function load() {
  try {
    const response = await fetch('api/dashboard.php', {headers: {Accept: 'application/json'}});const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Database unavailable.');
    state.layout = result.dashboard.layout;state.name = result.dashboard.name;state.version = result.dashboard.version;state.csrf = result.csrfToken;state.mode = 'database';$('#save-status').textContent = '✓ All changes saved';$('#mode-label').textContent = 'Connected to MySQL';
  } catch {
    state.mode = 'demo';$('#mode-banner').hidden = false;$('#mode-label').textContent = 'Browser demo';$('#save-status').textContent = 'Demo · not connected to MySQL';
    try {const saved = JSON.parse(localStorage.getItem('forma-demo-v1'));if (saved?.layout?.elements && Array.isArray(saved.layout.elements)) {state.layout = saved.layout;state.name = saved.name;$('#save-status').textContent = 'Restored browser demo';}} catch {toast('Could not restore the browser demo. Showing sample data.');}
  }
  render();
}
$$('[data-add]').forEach(button => button.addEventListener('click', () => add(button.dataset.add)));
$$('[data-tab]').forEach(button => button.addEventListener('click', () => {const tab = button.dataset.tab;$$('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));$('#elements-panel').hidden = tab !== 'elements';$('#layers-panel').hidden = tab !== 'layers';}));
$('#search').addEventListener('input', event => {$$('[data-add]').forEach(b => b.hidden = !b.textContent.toLowerCase().includes(event.target.value.toLowerCase()));});
$('#undo').addEventListener('click', () => history('undo'));$('#redo').addEventListener('click', () => history('redo'));$('#save').addEventListener('click', save);
$('#dashboard-name').addEventListener('change', event => {const name = event.target.value.trim();if (!name) {event.target.value = state.name;return;}change(() => state.name = name);});
$('#preview').addEventListener('click', () => {endEditing();state.preview = !state.preview;document.body.classList.toggle('preview-mode', state.preview);$('#preview').innerHTML = state.preview ? '✎ <span>Back to editor</span>' : '▷ <span>Preview</span>';render();});
$('#zoom-in').addEventListener('click', () => {state.fit = false;state.zoom = clamp(state.zoom + .1, .1, 1.5);updateZoom();});$('#zoom-out').addEventListener('click', () => {state.fit = false;state.zoom = clamp(state.zoom - .1, .1, 1.5);updateZoom();});$('#zoom-fit').addEventListener('click', () => {state.fit = true;updateZoom();});
$$('[data-device]').forEach(button => button.addEventListener('click', () => {state.mobile = button.dataset.device === 'mobile';state.fit = true;$$('[data-device]').forEach(b => b.classList.toggle('active', b === button));updateZoom();}));
$('#help').addEventListener('click', () => $('#help-dialog').showModal());
$('#export').addEventListener('click', () => {endEditing();const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot(), null, 2)], {type: 'application/json'}));const a = document.createElement('a');a.href = url;a.download = 'forma-dashboard.json';a.click();setTimeout(() => URL.revokeObjectURL(url), 1000);toast('Layout exported as JSON.');});
window.addEventListener('resize', updateZoom);
new ResizeObserver(() => updateZoom()).observe($('#canvas-scroll'));
window.addEventListener('beforeunload', event => {if (state.dirty) {event.preventDefault();event.returnValue = '';}});
document.addEventListener('keydown', event => {
  const typing = event.target.matches('input,textarea,select,[contenteditable=true]') || event.target.closest('[contenteditable=true]');const mod = event.ctrlKey || event.metaKey;
  if (mod && event.key.toLowerCase() === 's') {event.preventDefault();save();return;}
  if (event.key === 'Escape') {endEditing();select(null);return;}
  if (typing || state.preview || $('#help-dialog').open) return;
  if (mod && event.key.toLowerCase() === 'z') {event.preventDefault();history(event.shiftKey ? 'redo' : 'undo');}
  if (mod && event.key.toLowerCase() === 'd') {event.preventDefault();duplicateSelected();}
  if (['Delete', 'Backspace'].includes(event.key) && selected()) {event.preventDefault();deleteSelected();}
  if (event.key === '/') {event.preventDefault();$('[data-tab=elements]').click();$('#search').focus();}
  if (event.key.startsWith('Arrow') && selected()) {event.preventDefault();const e = selected(), step = event.shiftKey ? 10 : 1;change(() => {if (event.key === 'ArrowLeft') e.x -= step;if (event.key === 'ArrowRight') e.x += step;if (event.key === 'ArrowUp') e.y -= step;if (event.key === 'ArrowDown') e.y += step;constrain(state.layout, e);});}
});
load();
