/* The board designer: state, steps, interactions. Loaded only when the section nears the screen. */

import { SHAPES, SHAPE_ORDER, silhouettePath } from './shapes.js';
import {
  boxFits,
  WOODS, WOOD_ORDER, FONTS, FONT_ORDER, RESINS, RESIN_ORDER, ICONS, ICON_ORDER,
  createLayers, compose, getGrain, ensureFont, woodThumb, layoutText
} from './textures.js';
import { createView2D } from './view2d.js';
import { buildEasel } from './easel.js';

const PH = ['Emma & James', 'Est. 2026'];
const MAXLEN = [26, 30];
const SAMPLE_NAMES = [['Sam & Alex', 'Est. 2026'], ['The Browns', 'Home sweet home'], ['Cheers!', ''], ['Mum & Dad', 'Thank you'], ['Olivia', '12.06.2027'], ['The Carters', 'Established 2024']];

const DEFAULT = { shape: 'round', wood: 'oak', font: 'classic', finish: 'engrave', resin: 'none', border: false, icon: 'none', a: '', b: '', ta: false, tb: false, size: 1, ox: 0, oy: 0 };
const clone = (o) => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- link encoding ---------- */
const b64u = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

function encode(st) {
  return b64u(JSON.stringify({ s: st.shape, w: st.wood, f: st.font, e: st.finish === 'burn' ? 1 : 0, r: st.resin, i: st.icon, d: st.border ? 1 : 0, a: st.a, b: st.b, z: +st.size.toFixed(2), x: +st.ox.toFixed(3), y: +st.oy.toFixed(3), t: (st.ta ? 1 : 0) | (st.tb ? 2 : 0) }));
}
function decode(str) {
  try {
    const o = JSON.parse(unb64u(str));
    const st = clone(DEFAULT);
    if (SHAPES[o.s]) st.shape = o.s;
    if (WOODS[o.w]) st.wood = o.w;
    if (FONTS[o.f]) st.font = o.f;
    if (RESINS[o.r]) st.resin = o.r;
    if (ICONS[o.i]) st.icon = o.i;
    st.finish = o.e ? 'burn' : 'engrave';
    st.border = !!o.d;
    st.a = String(o.a || '').slice(0, MAXLEN[0]); st.b = String(o.b || '').slice(0, MAXLEN[1]);
    st.ta = !!(o.t & 1); st.tb = !!(o.t & 2);
    st.size = clamp(+o.z || 1, 0.6, 1.5); st.ox = clamp(+o.x || 0, -0.45, 0.45); st.oy = clamp(+o.y || 0, -0.45, 0.45);
    return st;
  } catch (e) { return null; }
}

/* ---------- small icons ---------- */
const I = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.1"/><circle cx="15" cy="9" r="1.1"/><circle cx="9" cy="15" r="1.1"/><circle cx="15" cy="15" r="1.1"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>'
};
const svgI = (d, cls) => '<svg class="' + (cls || 'bd-i') + '" viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';

function template() {
  const tile = (name, value, inner, checked, label) =>
    '<label class="bd-tile"><input type="radio" name="' + name + '" value="' + value + '"' + (checked ? ' checked' : '') + '><span class="bd-tile-in">' + inner + '<b>' + label + '</b></span></label>';

  const shapeTiles = SHAPE_ORDER.map((id, i) => {
    const sp = silhouettePath(SHAPES[id], 14);
    return tile('bd-shape', id, '<svg class="bd-sil" viewBox="0 0 ' + sp.w.toFixed(0) + ' ' + sp.h.toFixed(0) + '" aria-hidden="true"><path d="' + sp.d + '" fill-rule="evenodd"/></svg>', i === 0, SHAPES[id].name);
  }).join('');
  const woodTiles = WOOD_ORDER.map((id, i) => tile('bd-wood', id, '<canvas class="bd-swatch" width="160" height="100" data-wood="' + id + '" aria-hidden="true"></canvas>', i === 0, WOODS[id].name)).join('');
  const fontTiles = FONT_ORDER.map((id, i) => {
    const f = FONTS[id];
    return tile('bd-font', id, '<span class="bd-aa" style="font-family:\'' + f.family + '\',Georgia,serif;font-style:' + f.style + ';font-weight:' + f.weight + '" aria-hidden="true">Aa</span>', i === 0, f.name);
  }).join('');
  const resinTiles = RESIN_ORDER.map((id, i) => {
    const r = RESINS[id];
    const inner = id === 'none' ? '<i class="bd-dot bd-none" aria-hidden="true"></i>' : '<i class="bd-dot" style="--a:' + r.c + ';--b:' + r.c + '" aria-hidden="true"></i>';
    return tile('bd-resin', id, inner, i === 0, r.name);
  }).join('');
  const iconTiles = ICON_ORDER.map((id, i) => {
    const inner = id === 'none' ? '<i class="bd-dot bd-none" aria-hidden="true"></i>' : '<svg class="bd-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONS[id].d + '"/></svg>';
    return tile('bd-icon', id, inner, i === 0, ICONS[id].name);
  }).join('');

  const steps = ['Shape', 'Timber', 'Words', 'Extras', 'Send'];
  return '' +
  '<div class="bd-stage">' +
    '<div class="bd-view" tabindex="0" role="img" aria-label="Preview of your board"></div>' +
    '<div class="bd-bar bd-bar-l" role="group" aria-label="View">' +
      '<button type="button" class="bd-seg" data-view="3d" aria-pressed="true">3D</button>' +
      '<button type="button" class="bd-seg" data-view="2d" aria-pressed="false">Flat</button>' +
    '</div>' +
    '<div class="bd-bar bd-bar-r" role="group" aria-label="Tools">' +
      '<button type="button" class="bd-ico" data-act="undo" aria-label="Undo" title="Undo" disabled>' + svgI(I.undo) + '</button>' +
      '<button type="button" class="bd-ico" data-act="redo" aria-label="Redo" title="Redo" disabled>' + svgI(I.redo) + '</button>' +
      '<button type="button" class="bd-ico bd-wide" data-act="surprise" title="Try a random design">' + svgI(I.dice) + '<span>Surprise me</span></button>' +
      '<button type="button" class="bd-ico bd-wide" data-act="reset" title="Start again">' + svgI(I.reset) + '<span>Start again</span></button>' +
    '</div>' +
    '<p class="bd-hint" hidden></p>' +
    '<div class="bd-busy" aria-hidden="true"><span></span></div>' +
  '</div>' +
  '<p class="bd-summary" aria-live="polite"></p>' +
  '<div class="bd-panel">' +
    '<div class="bd-steps" role="tablist" aria-label="Design steps">' +
      steps.map((s, i) => '<button type="button" role="tab" id="bd-tab-' + i + '" aria-controls="bd-pane-' + i + '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '"><b>' + (i + 1) + '</b><span>' + s + '</span></button>').join('') +
    '</div>' +
    '<div class="bd-panes">' +
      '<section class="bd-pane is-on" role="tabpanel" id="bd-pane-0" aria-labelledby="bd-tab-0"><fieldset><legend class="bd-q">Pick a shape</legend><div class="bd-tiles" style="--cols:4">' + shapeTiles + '</div></fieldset><p class="bd-tip">Every board is made by hand, so sizes can be tweaked. Pick the closest outline and tell Phil what you would change.</p></section>' +
      '<section class="bd-pane" role="tabpanel" id="bd-pane-1" aria-labelledby="bd-tab-1"><fieldset><legend class="bd-q">Pick a timber</legend><div class="bd-tiles" style="--cols:4">' + woodTiles + '</div></fieldset><p class="bd-tip">Previews only. Phil confirms the real timber with you.</p></section>' +
      '<section class="bd-pane" role="tabpanel" id="bd-pane-2" aria-labelledby="bd-tab-2">' +
        '<div class="bd-fields">' +
          '<div class="field"><label for="bd-a">Names or message</label><input id="bd-a" type="text" maxlength="' + MAXLEN[0] + '" placeholder="' + esc(PH[0]) + '" autocomplete="off" enterkeyhint="next"></div>' +
          '<div class="field"><label for="bd-b">Date or small line</label><input id="bd-b" type="text" maxlength="' + MAXLEN[1] + '" placeholder="' + esc(PH[1]) + '" autocomplete="off" enterkeyhint="done"></div>' +
        '</div>' +
        '<fieldset><legend class="bd-q">Lettering</legend><div class="bd-tiles bd-tiles-s" style="--cols:5">' + fontTiles + '</div></fieldset>' +
        '<div class="bd-row"><span class="bd-q">Finish</span><div class="bd-seg2" role="radiogroup" aria-label="Finish"><label><input type="radio" name="bd-finish" value="engrave" checked><span>Engraved</span></label><label><input type="radio" name="bd-finish" value="burn"><span>Burnt</span></label></div></div>' +
        '<details class="bd-adjust" open><summary>Size and position</summary><div class="bd-sliders">' +
          '<label class="bd-sl"><span>Size</span><input type="range" id="bd-size" min="0.6" max="1.5" step="0.02" value="1" aria-label="Text size"></label>' +
          '<label class="bd-sl"><span>Up / down</span><input type="range" id="bd-oy" min="-0.4" max="0.4" step="0.01" value="0" aria-label="Move words up or down"></label>' +
          '<label class="bd-sl"><span>Left / right</span><input type="range" id="bd-ox" min="-0.4" max="0.4" step="0.01" value="0" aria-label="Move words left or right"></label>' +
        '</div></details>' +
        '<p class="bd-tip bd-tip-mouse">Tip: you can drag the words straight on the board.</p>' +
      '</section>' +
      '<section class="bd-pane" role="tabpanel" id="bd-pane-3" aria-labelledby="bd-tab-3">' +
        '<fieldset><legend class="bd-q">Resin inlay</legend><div class="bd-tiles bd-tiles-s" style="--cols:6">' + resinTiles + '</div></fieldset>' +
        '<fieldset><legend class="bd-q">Little icon above the words</legend><div class="bd-tiles bd-tiles-s" style="--cols:4">' + iconTiles + '</div></fieldset>' +
        '<label class="bd-switch"><input type="checkbox" id="bd-border"><span class="bd-track" aria-hidden="true"></span><span>Engraved border</span></label>' +
      '</section>' +
      '<section class="bd-pane" role="tabpanel" id="bd-pane-4" aria-labelledby="bd-tab-4">' +
        '<p class="bd-q">Happy with it?</p>' +
        '<dl class="bd-recap"></dl>' +
        '<button type="button" class="btn bd-send" data-act="send">Send this design to Phil</button>' +
        '<div class="bd-more"><button type="button" class="bd-link" data-act="save">Save a picture</button><button type="button" class="bd-link" data-act="copy">Copy link to my design</button><button type="button" class="bd-link" data-act="easel">Download SVG for Easel</button></div>' +
        '<p class="bd-tip">A visual preview only. Phil confirms the timber, size and lettering with you before anything is cut.</p>' +
      '</section>' +
    '</div>' +
    '<div class="bd-nav"><button type="button" class="bd-back" data-act="back">Back</button><button type="button" class="btn bd-next" data-act="next">Next: Timber</button></div>' +
  '</div>' +
  '<div class="bd-toast" role="status" aria-live="polite"></div>';
}

/* ---------- main ---------- */
export function init(root) {
  const calm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const touchy = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const conn = navigator.connection || {};
  const lowPower = !!conn.saveData || ((navigator.hardwareConcurrency || 4) <= 2 && (navigator.deviceMemory || 4) <= 2);
  const TEXW = touchy || innerWidth < 700 ? 1100 : 1500;

  const poster = root.querySelector('.bd-poster');
  root.innerHTML = template();
  root.classList.add('is-live');
  root.dataset.bd = 'live';

  const $ = (s) => root.querySelector(s);
  const $$ = (s) => Array.prototype.slice.call(root.querySelectorAll(s));
  const stage = $('.bd-stage'), host = $('.bd-view'), hint = $('.bd-hint'), summary = $('.bd-summary'), toastEl = $('.bd-toast');
  if (poster) { poster.classList.add('bd-poster'); stage.insertBefore(poster, host); }

  /* state, history, link */
  let state = clone(DEFAULT);
  const fromLink = (location.search.match(/[?&]design=([^&#]+)/) || [])[1];
  if (fromLink) { const d = decode(fromLink); if (d) state = d; }
  const hist = { stack: [JSON.stringify(state)], i: 0 };
  let histTimer = 0, urlTimer = 0;
  const isDefault = () => JSON.stringify(state) === JSON.stringify(DEFAULT);

  const shownLines = () => [state.a || (state.ta ? '' : PH[0]), state.b || (state.tb ? '' : PH[1])];

  function describe() {
    const sh = SHAPES[state.shape];
    const bits = [WOODS[state.wood].name + ' ' + sh.name.toLowerCase(), FONTS[state.font].name.toLowerCase() + ' lettering, ' + (state.finish === 'burn' ? 'burnt' : 'engraved')];
    if (state.resin !== 'none') bits.push(RESINS[state.resin].name.toLowerCase() + ' resin inlay');
    if (state.icon !== 'none') bits.push(ICONS[state.icon].name.toLowerCase() + ' icon');
    if (state.border) bits.push('border');
    return bits;
  }
  function designUrl() {
    return location.origin + location.pathname + '?design=' + encode(state) + '#designer';
  }
  function syncUrl() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      try {
        const base = location.pathname + (isDefault() ? '' : '?design=' + encode(state)) + '#designer';
        history.replaceState(null, '', base);
      } catch (e) { /* ignore */ }
    }, 400);
  }

  /* ---------- rendering pipeline ---------- */
  let layers = null, lastBox = null, composing = false, pending = false, scheduled = 0;
  let mode = '3d', view2d = null, view3d = null, ready3d = false, can3d = false, shownOnce = false;
  let lastShapeId = null, lastWood = null;

  view2d = createView2D(host);
  view2d.canvas.hidden = true;

  async function recompose() {
    if (composing) { pending = true; return; }
    composing = true;
    try {
      do {
        pending = false;
        const shape = SHAPES[state.shape];
        await Promise.all([ensureFont(state.font), ensureFont('clean')]);
        const w = TEXW, h = Math.round((w * shape.bbox.h) / shape.bbox.w);
        if (!layers || layers.w !== w || layers.h !== h) layers = createLayers(w, h);
        const grain = await getGrain(state.wood, w, h);
        const res = compose(layers, state, shape, grain, shownLines());
        lastBox = res.textBox;
        const shapeChanged = lastShapeId !== null && lastShapeId !== state.shape;
        const woodChanged = lastWood !== null && lastWood !== state.wood;
        lastShapeId = state.shape; lastWood = state.wood;
        view2d.setShape(shape); view2d.setLayers(layers, lastBox);
        if (ready3d) {
          view3d.setShape(shape, shapeChanged);
          view3d.setLayers(layers, lastBox);
          if (woodChanged && !shapeChanged) view3d.pop();
          view3d.render();
        }
        reveal();
      } while (pending);
    } finally { composing = false; }
  }
  function schedule() { if (scheduled) return; scheduled = requestAnimationFrame(() => { scheduled = 0; recompose(); }); }

  /* show whichever view is ready; keep the poster until the first real frame */
  function reveal() {
    const want3d = mode === '3d' && can3d;
    if (want3d && !ready3d) {
      // still loading 3D: keep the poster if the design is untouched, otherwise show the flat view meanwhile
      if (!poster || !isDefault() || fromLink) { view2d.show(); stage.classList.add('is-ready'); }
      return;
    }
    if (want3d) { view2d.hide(); view3d.show(); } else { if (view3d) view3d.hide(); view2d.show(); }
    stage.classList.add('is-ready');
    stage.classList.toggle('is-3d', want3d);
    if (!shownOnce) { shownOnce = true; setHintFor(); }
    $$('.bd-seg').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === (want3d ? '3d' : '2d'))));
  }

  async function load3d() {
    if (view3d || !can3d) return;
    stage.classList.add('is-busy');
    try {
      const m = await import('./view3d.js');
      view3d = m.createView3D(host, { calm, maxPixelRatio: touchy ? 1.75 : 2, onLost: () => { can3d = false; ready3d = false; mode = '2d'; $('.bd-seg[data-view="3d"]').hidden = true; toast('3D view paused. Showing the flat view.'); reveal(); } });
      view3d.canvas.hidden = true;
      view3d.onInteract(() => { hideHint(); });
      ready3d = true;
      lastShapeId = null; lastWood = null;
      schedule();
    } catch (err) {
      can3d = false; ready3d = false; mode = '2d';
      $('.bd-seg[data-view="3d"]').hidden = true;
      reveal();
    } finally { stage.classList.remove('is-busy'); }
  }

  function webglOk() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }

  /* ---------- UI sync ---------- */
  function checkRadio(name, value) { const el = root.querySelector('input[name="' + name + '"][value="' + value + '"]'); if (el) el.checked = true; }
  function syncUI() {
    checkRadio('bd-shape', state.shape); checkRadio('bd-wood', state.wood); checkRadio('bd-font', state.font);
    checkRadio('bd-finish', state.finish); checkRadio('bd-resin', state.resin); checkRadio('bd-icon', state.icon);
    $('#bd-a').value = state.a; $('#bd-b').value = state.b;
    $('#bd-size').value = state.size; $('#bd-ox').value = state.ox; $('#bd-oy').value = state.oy;
    $('#bd-border').checked = state.border;
    refreshText();
  }
  function refreshText() {
    const bits = describe();
    summary.textContent = bits.join(' · ');
    const lines = shownLines();
    host.setAttribute('aria-label', 'Preview: ' + bits.join(', ') + (lines[0] ? '. Engraved with ' + lines[0] + (lines[1] ? ', ' + lines[1] : '') : ''));
    const recap = $('.bd-recap');
    const row = (k, v) => '<div><dt>' + k + '</dt><dd>' + esc(v) + '</dd></div>';
    recap.innerHTML = row('Shape', SHAPES[state.shape].name) + row('Timber', WOODS[state.wood].name) +
      row('Words', (lines[0] || 'None yet') + (lines[1] ? ' / ' + lines[1] : '')) +
      row('Finish', FONTS[state.font].name + ', ' + (state.finish === 'burn' ? 'burnt' : 'engraved')) +
      row('Extras', [state.resin !== 'none' ? RESINS[state.resin].name + ' resin' : '', state.icon !== 'none' ? ICONS[state.icon].name : '', state.border ? 'Border' : ''].filter(Boolean).join(', ') || 'None');
    $('[data-act="undo"]').disabled = hist.i === 0;
    $('[data-act="redo"]').disabled = hist.i >= hist.stack.length - 1;
  }

  function commit(now) {
    clearTimeout(histTimer);
    const doIt = () => {
      const s = JSON.stringify(state);
      if (s !== hist.stack[hist.i]) {
        hist.stack = hist.stack.slice(0, hist.i + 1); hist.stack.push(s);
        if (hist.stack.length > 60) hist.stack.shift();
        hist.i = hist.stack.length - 1;
      }
      refreshText(); syncUrl();
    };
    refreshText();
    if (now) doIt(); else histTimer = setTimeout(doIt, 500);
  }
  function changed(now) { refreshText(); schedule(); commit(now); }

  /* ---------- steps ---------- */
  const labels = ['Shape', 'Timber', 'Words', 'Extras', 'Send'];
  let step = 0;
  function goStep(i, focusTab) {
    const prev = step;
    step = clamp(i, 0, 4);
    const panesEl = $('.bd-panes');
    if (panesEl) panesEl.dataset.dir = step >= prev ? 'fwd' : 'back';
    $$('.bd-steps [role="tab"]').forEach((t, n) => { const on = n === step; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; t.classList.toggle('is-done', n < step); if (on && focusTab) t.focus(); });
    $$('.bd-pane').forEach((p, n) => p.classList.toggle('is-on', n === step));
    const back = $('[data-act="back"]'), next = $('[data-act="next"]');
    back.hidden = step === 0; next.hidden = step === 4;
    next.textContent = step < 4 ? 'Next: ' + labels[step + 1] : '';
    if (step === 1) paintSwatches();
    const on = $('.bd-pane.is-on'); if (on) on.scrollTop = 0;
    if (panesEl) panesEl.scrollTop = 0;
    moreCheck();
  }

  /* fade the bottom edge of the options when there is more to scroll to (phones) */
  function moreCheck() {
    const el = $('.bd-panes'); if (!el) return;
    el.classList.toggle('has-more', el.scrollHeight - el.clientHeight - el.scrollTop > 6);
  }

  let swatchesDone = false;
  function paintSwatches() {
    if (swatchesDone) return; swatchesDone = true;
    $$('.bd-swatch').forEach((cv) => {
      woodThumb(cv.dataset.wood, 160, 100).then((src) => { const c = cv.getContext('2d'); c.drawImage(src, 0, 0, cv.width, cv.height); cv.classList.add('is-done'); }).catch(() => {});
    });
  }

  /* ---------- toast, hint ---------- */
  const buzz = () => { try { if (navigator.vibrate) navigator.vibrate(8); } catch (err) { /* ignore */ } };
  let toastT = 0;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600); }
  let hintT = 0, hintGone = false;
  function setHintFor() {
    if (hintGone) return;
    const t = mode === '3d' && ready3d ? (touchy ? 'Swipe sideways to turn the board' : 'Drag to turn it · drag the words to move them') : (touchy ? '' : 'Drag the words to move them');
    if (!t) { hint.hidden = true; return; }
    hint.textContent = t; hint.hidden = false;
    clearTimeout(hintT); hintT = setTimeout(hideHint, 7000);
  }
  function hideHint() { hintGone = true; hint.hidden = true; }

  /* ---------- actions ---------- */
  function surprise() {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    state.shape = pick(SHAPE_ORDER); state.wood = pick(WOOD_ORDER); state.font = pick(FONT_ORDER);
    state.finish = Math.random() < 0.35 ? 'burn' : 'engrave';
    state.resin = Math.random() < 0.55 ? pick(RESIN_ORDER.slice(1)) : 'none';
    state.icon = Math.random() < 0.4 ? pick(ICON_ORDER.slice(1)) : 'none';
    state.border = Math.random() < 0.4;
    state.ox = 0; state.oy = 0; state.size = 1;
    if (!state.ta && !state.tb) { const n = pick(SAMPLE_NAMES); state.a = n[0]; state.b = n[1]; state.ta = true; state.tb = true; }
    syncUI(); changed(true);
    if (view3d && ready3d) view3d.pop();
  }
  function reset() {
    state = clone(DEFAULT); syncUI(); changed(true);
    if (view3d && ready3d) view3d.resetView();
    toast('Started again');
  }
  function applySnapshot(s) { state = JSON.parse(s); syncUI(); refreshText(); schedule(); syncUrl(); }
  function undo() { if (hist.i > 0) { hist.i--; applySnapshot(hist.stack[hist.i]); } }
  function redo() { if (hist.i < hist.stack.length - 1) { hist.i++; applySnapshot(hist.stack[hist.i]); } }

  function sendToPhil() {
    const lines = shownLines();
    const hadWords = !!(state.a || state.b);
    const parts = ['Board design: ' + describe().join(', ') + '.'];
    parts.push('Words: ' + (hadWords ? '"' + (state.a || '') + '"' + (state.b ? ' / "' + state.b + '"' : '') : 'to be decided') + '.');
    parts.push('See my design: ' + designUrl());
    parts.push('(Phil: open the link and press "Download SVG for Easel" for the cutting file.)');
    const msg = document.getElementById('f-message');
    const prior = msg && msg.value && !/^Board design:/.test(msg.value) ? '\n\n' + msg.value : '';
    if (msg) msg.value = parts.join('\n') + prior;
    const sel = document.getElementById('f-interest'); if (sel) sel.value = 'Cheeseboard or serving board';
    const c = document.getElementById('contact'); if (c) c.scrollIntoView({ behavior: calm ? 'auto' : 'smooth' });
    setTimeout(() => { const n = document.getElementById('f-name'); if (n) n.focus({ preventScroll: true }); }, 700);
    return lines;
  }

  function copyLink() {
    const url = designUrl();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => toast('Link copied. Anyone who opens it sees your design.'), () => toast(url));
    else toast(url);
  }

  /* cutting file for Easel and other CNC software: the design as an SVG in millimetres */
  let glyphsP = null;
  async function downloadEasel() {
    try {
      if (!glyphsP) glyphsP = fetch('/js/designer/glyphs.json?v=1').then((r) => { if (!r.ok) throw new Error('glyphs'); return r.json(); });
      await Promise.all([ensureFont(state.font), ensureFont('clean')]);
      const fonts = await glyphsP;
      const shape = SHAPES[state.shape], bb = shape.bbox, k = TEXW / bb.w;
      const X = (x) => (x - bb.x0) * k, Y = (y) => (bb.y1 - y) * k;
      const ctx = document.createElement('canvas').getContext('2d');
      const lay = layoutText(ctx, state, shape, k, X, Y, [state.a || '', state.b || '']);
      const svg = buildEasel(state, shape, lay, k, fonts);
      const name = 'fat-hamster-' + state.shape + '-' + ((state.a || 'design').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'design') + '.svg';
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast('SVG downloaded. Drag it into Easel.');
    } catch (err) { glyphsP = null; if (window.console) console.error(err); toast('Could not make the file here. Try again.'); }
  }

  function activeImage() {
    if (mode === '3d' && ready3d) { view3d.render(); return view3d.image(); }
    return view2d.image();
  }
  async function savePicture() {
    try { await Promise.all([ensureFont('bold'), ensureFont('clean')]); } catch (e) { /* carry on */ }
    const src = activeImage();
    const W = 1200, H = 900, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(W / 2, H * 0.42, 60, W / 2, H * 0.42, W * 0.7);
    g.addColorStop(0, '#fffdf6'); g.addColorStop(1, '#e9dec8'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const sw = src.width, sh = src.height, scale = Math.min(1080 / sw, 600 / sh);
    c.drawImage(src, (W - sw * scale) / 2, 150 + (600 - sh * scale) / 2, sw * scale, sh * scale);
    c.fillStyle = '#3b2f20'; c.textAlign = 'center';
    c.font = '400 40px "Alfa Slab One", Georgia, serif'; c.fillText('The Fat Hamster Wood Shop', W / 2, 92);
    c.font = '600 28px Bitter, Georgia, serif'; c.fillStyle = '#5a4a36';
    c.fillText(describe().slice(0, 2).join(' · '), W / 2, 790);
    c.font = '400 24px Bitter, Georgia, serif'; c.fillText(describe().slice(2).join(' · ') || 'Handmade in Prescot', W / 2, 828);
    c.fillStyle = '#86591f'; c.font = '600 22px Bitter, Georgia, serif'; c.fillText('fathamster.co.uk', W / 2, 866);
    cv.toBlob(async (blob) => {
      if (!blob) { toast('Could not make the picture'); return; }
      const file = new File([blob], 'my-fat-hamster-board.png', { type: 'image/png' });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'My board design' }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      toast('Picture saved');
    }, 'image/png');
  }

  /* ---------- events ---------- */
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.type === 'radio' || t.type === 'checkbox') buzz();
    if (t.name === 'bd-shape') { state.shape = t.value; state.ox = 0; state.oy = 0; changed(true); }
    else if (t.name === 'bd-wood') { state.wood = t.value; changed(true); }
    else if (t.name === 'bd-font') { state.font = t.value; changed(true); }
    else if (t.name === 'bd-finish') { state.finish = t.value; changed(true); }
    else if (t.name === 'bd-resin') { state.resin = t.value; changed(true); }
    else if (t.name === 'bd-icon') { state.icon = t.value; changed(true); }
    else if (t.id === 'bd-border') { state.border = t.checked; changed(true); }
  });
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'bd-a') { state.a = t.value; state.ta = true; changed(false); }
    else if (t.id === 'bd-b') { state.b = t.value; state.tb = true; changed(false); }
    else if (t.id === 'bd-size') { state.size = +t.value; changed(false); }
    else if (t.id === 'bd-ox') { state.ox = +t.value; changed(false); }
    else if (t.id === 'bd-oy') { state.oy = +t.value; changed(false); }
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act],[data-view]');
    if (!b) return;
    if (b.dataset.view) { setMode(b.dataset.view); return; }
    const a = b.dataset.act;
    if (a === 'undo') undo(); else if (a === 'redo') redo(); else if (a === 'surprise') surprise(); else if (a === 'reset') reset();
    else if (a === 'next') goStep(step + 1); else if (a === 'back') goStep(step - 1);
    else if (a === 'send') sendToPhil(); else if (a === 'save') savePicture(); else if (a === 'copy') copyLink(); else if (a === 'easel') downloadEasel();
  });
  $$('.bd-steps [role="tab"]').forEach((t, i) => {
    t.addEventListener('click', () => goStep(i));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goStep(step + 1, true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goStep(step - 1, true); }
      else if (e.key === 'Home') { e.preventDefault(); goStep(0, true); }
      else if (e.key === 'End') { e.preventDefault(); goStep(4, true); }
    });
  });
  root.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) { e.preventDefault(); undo(); }
    else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z')) && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) { e.preventDefault(); redo(); }
  });
  host.addEventListener('keydown', (e) => {
    if (mode === '3d' && ready3d && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); view3d.rotateBy(e.key === 'ArrowLeft' ? -0.2 : 0.2); hideHint(); }
  });
  host.addEventListener('dblclick', () => { if (mode === '3d' && ready3d) view3d.resetView(); });

  /* touch: tap the words to jump to the Words step */
  let tap = null;
  host.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') tap = { x: e.clientX, y: e.clientY, t: Date.now() }; });
  host.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch' || !tap) return;
    const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y), quick = Date.now() - tap.t < 400; tap = null;
    if (moved > 8 || !quick) return;
    const h = hitAt(e.clientX, e.clientY, 18);
    if (h && h.inside && step !== 2) { goStep(2); buzz(); }
  });
  host.addEventListener('pointercancel', () => { tap = null; });

  /* swipe the options panel sideways to move between steps */
  (function () {
    const panes = $('.bd-panes'); let s = null;
    panes.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || e.target.closest('input[type="range"], input[type="text"]')) { s = null; return; }
      s = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    panes.addEventListener('touchend', (e) => {
      if (!s) return;
      const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y; s = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) { goStep(step + (dx < 0 ? 1 : -1)); buzz(); }
    }, { passive: true });
  })();

  $('.bd-panes').addEventListener('scroll', moreCheck, { passive: true });
  window.addEventListener('resize', moreCheck);
  const adjustEl = $('.bd-adjust'); if (adjustEl) adjustEl.addEventListener('toggle', () => setTimeout(moreCheck, 0));

  /* the size and position sliders fold away on small screens */
  const adjust = $('.bd-adjust');
  if (adjust && window.matchMedia) {
    const mq = window.matchMedia('(min-width: 901px)');
    const sync = () => { adjust.open = mq.matches; };
    sync();
    if (mq.addEventListener) mq.addEventListener('change', sync);
  }

  /* drag the words straight on the board (mouse and pen; touch uses the sliders) */
  let drag = null;
  const hitAt = (x, y, pad) => (mode === '3d' && ready3d ? view3d.hit(x, y, pad) : view2d.hitText(x, y, pad));
  host.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    const h = hitAt(e.clientX, e.clientY, 14);
    if (!h || !h.inside) return;
    drag = { px: h.px, py: h.py, ox: state.ox, oy: state.oy, box: lastBox, moved: false, id: e.pointerId };
    if (mode === '3d' && ready3d) view3d.setEnabled(false);
    try { host.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    host.classList.add('is-dragging'); hideHint();
    e.preventDefault();
  }, true);
  host.addEventListener('pointermove', (e) => {
    if (drag && e.pointerId === drag.id) {
      const h = hitAt(e.clientX, e.clientY, 0);
      if (!h || h.px === undefined || (h.px === 0 && h.py === 0)) return;
      const bb = SHAPES[state.shape].bbox, k = layers.w / bb.w, H = bb.h * k, W = layers.w;
      let nx = clamp(drag.ox + (h.px - drag.px) / W, -0.45, 0.45), ny = clamp(drag.oy - (h.py - drag.py) / H, -0.45, 0.45);
      // keep the words on the wood: pull back until the text box fits on the board, clear of any resin
      const bx = drag.box;
      if (bx) {
        const tx = nx, ty = ny; let ok = false;
        for (let t = 1; t >= 0; t -= 0.1) {
          const dx = (tx - drag.ox) * t * W, dy = -(ty - drag.oy) * t * H;
          if (boxFits(SHAPES[state.shape], state, k, { x: bx.x + dx, y: bx.y + dy, w: bx.w, h: bx.h })) { nx = drag.ox + (tx - drag.ox) * t; ny = drag.oy + (ty - drag.oy) * t; ok = true; break; }
        }
        if (!ok) { nx = drag.ox; ny = drag.oy; }
      }
      if (Math.abs(nx - state.ox) > 0.0005 || Math.abs(ny - state.oy) > 0.0005) { drag.moved = true; state.ox = nx; state.oy = ny; $('#bd-ox').value = nx; $('#bd-oy').value = ny; changed(false); }
      return;
    }
    if (e.pointerType === 'touch') return;
    const h = hitAt(e.clientX, e.clientY, 14);
    host.classList.toggle('over-text', !!(h && h.inside));
  });
  const endDrag = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const wasClick = !drag.moved;
    drag = null; host.classList.remove('is-dragging');
    if (view3d && ready3d) view3d.setEnabled(true);
    if (wasClick) { goStep(2); const a = $('#bd-a'); if (a && !touchy) a.focus(); }
    else commit(true);
  };
  host.addEventListener('pointerup', endDrag);
  host.addEventListener('pointercancel', endDrag);

  function setMode(m) {
    if (m === '3d' && !can3d) return;
    mode = m;
    if (m === '3d' && !ready3d) { load3d().then(() => { schedule(); }); }
    reveal(); setHintFor();
    if (m === '2d' && view3d) view3d.stop();
    if (view3d && m === '3d' && ready3d) { view3d.resize(); }
  }

  /* layout and visibility */
  if (window.ResizeObserver) {
    new ResizeObserver(() => { view2d.resize(); if (view3d && ready3d && mode === '3d') view3d.resize(); }).observe(host);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => {
      const vis = en[0].isIntersecting;
      if (view3d && ready3d && mode === '3d') { if (vis) view3d.start(); else view3d.stop(); }
    }, { threshold: 0.01 }).observe(stage);
  }
  document.addEventListener('visibilitychange', () => { if (view3d && ready3d && mode === '3d') { document.hidden ? view3d.stop() : view3d.start(); } });

  /* go */
  can3d = webglOk();
  if (!can3d) { $('.bd-seg[data-view="3d"]').hidden = true; mode = '2d'; }
  else if (lowPower) mode = '2d';
  if (!touchy) root.classList.add('has-mouse');
  syncUI(); goStep(0); setTimeout(moreCheck, 400);
  if (fromLink && decode(fromLink)) { goStep(4); }
  recompose();
  if (can3d) load3d();
  // if 3D never shows up, do not leave people looking at the poster
  setTimeout(() => { if (!stage.classList.contains('is-ready')) { view2d.show(); stage.classList.add('is-ready'); } }, 7000);

  root.__bd = { get view3d() { return view3d; }, get state() { return state; }, get layers() { return layers; } };
  return { toast };
}
