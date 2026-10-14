/* Wood grain and surface decoration.
   Grain is drawn once per timber from SVG turbulence filters (fast, native).
   compose() then paints three canvases that both views use:
     color  - what the board looks like
     bump   - heights (engraving, dishes, resin sit lower than the wood)
     rough  - shininess (resin is glossy, wood is satin, burnt text is dull) */

import { bodyInset, TAU } from './shapes.js';

export const WOODS = {
  oak:    { name: 'Oak',    base: [188, 140, 74],  dark: [104, 62, 24],  light: [216, 176, 112], streak: .62, pores: .62, rings: .58, seed: 3 },
  walnut: { name: 'Walnut', base: [104, 72, 48],   dark: [30, 15, 6],    light: [138, 100, 70],  streak: .6,  pores: .3,  rings: .55, seed: 11 },
  ash:    { name: 'Ash',    base: [221, 200, 160], dark: [150, 118, 72], light: [242, 228, 194], streak: .5,  pores: .42, rings: .45, seed: 7 },
  cherry: { name: 'Cherry', base: [166, 88, 58],   dark: [84, 32, 16],   light: [204, 124, 88],  streak: .52, pores: .14, rings: .55, seed: 21 }
};
export const WOOD_ORDER = ['oak', 'walnut', 'ash', 'cherry'];

export const FONTS = {
  classic: { name: 'Classic', family: 'Bitter', style: 'italic', weight: 400, k: .5 },
  bold:    { name: 'Bold',    family: 'Alfa Slab One', style: 'normal', weight: 400, k: .64 },
  clean:   { name: 'Clean',   family: 'Bitter', style: 'normal', weight: 600, k: .56 },
  script:  { name: 'Script',  family: 'Dancing Script', style: 'normal', weight: 700, k: .42 },
  elegant: { name: 'Elegant', family: 'Playfair Display', style: 'italic', weight: 600, k: .46 }
};
export const FONT_ORDER = ['classic', 'bold', 'clean', 'script', 'elegant'];

export const RESINS = {
  none:     { name: 'None' },
  ocean:    { name: 'Ocean',    a: '#0b5f94', b: '#59c4e6', hi: '#d4f6ff' },
  forest:   { name: 'Forest',   a: '#0c5a3d', b: '#5fc98e', hi: '#d6ffe6' },
  amber:    { name: 'Amber',    a: '#c9740f', b: '#ffcf70', hi: '#fff0c4' },
  midnight: { name: 'Midnight', a: '#0c1233', b: '#4658c8', hi: '#c9d2ff' },
  rose:     { name: 'Rose',     a: '#9c2552', b: '#ff9bb8', hi: '#ffe0ea' }
};
export const RESIN_ORDER = ['none', 'ocean', 'forest', 'amber', 'midnight', 'rose'];

export const ICONS = {
  none: { name: 'None' },
  heart: { name: 'Heart', d: 'M12 21C5 16.5 3 12.6 3 9.4 3 6.6 5.1 4.5 7.7 4.5c1.7 0 3.3.9 4.3 2.4 1-1.5 2.6-2.4 4.3-2.4C18.9 4.5 21 6.6 21 9.4c0 3.2-2 7.1-9 11.6z' },
  star:  { name: 'Star',  d: 'M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.5l-6 3.4 1.3-6.7-5-4.7 6.8-.8z' },
  leaf:  { name: 'Leaf',  d: 'M20.5 3.5C11 3.5 4.5 8.5 4.5 15.5c0 1.6.4 3 1 4l2.3-2.3c-.2-.5-.3-1.100-.3-1.700 0-4.700 5.200-8.500 12.100-10.200-5.200 3.200-8 6.500-8.800 11.200l1.700.5c.8-4 3-6.900 7.200-9.500.3 3-.5 6.200-3 8.800 2.800-.9 5.300-4.800 5.300-13z' }
};
export const ICON_ORDER = ['none', 'heart', 'star', 'leaf'];

export function fontSpec(id, px) {
  const f = FONTS[id];
  return f.style + ' ' + f.weight + ' ' + Math.round(px) + 'px "' + f.family + '", Georgia, serif';
}

/* make sure the font file for a lettering style is ready before it is drawn on a canvas */
export function ensureFont(id) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return document.fonts.load(fontSpec(id, 40), 'Abc & 2026').catch(() => {});
}

/* ---------- grain ---------- */

const rgb = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a === undefined ? 1 : a) + ')';
const n3 = (v) => (v / 255).toFixed(3);

function layerSvg(id, freq, octaves, seed, k, c, color, opacity) {
  return '<filter id="' + id + '" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
    '<feTurbulence type="fractalNoise" baseFrequency="' + freq + '" numOctaves="' + octaves + '" seed="' + seed + '"/>' +
    '<feColorMatrix type="matrix" values="0 0 0 0 ' + n3(color[0]) + ' 0 0 0 0 ' + n3(color[1]) + ' 0 0 0 0 ' + n3(color[2]) + ' 0 0 0 ' + k + ' ' + c + '"/></filter>' +
    '<rect width="100%" height="100%" filter="url(#' + id + ')" opacity="' + opacity + '"/>';
}

function grainSvg(w, h, wood) {
  const s = wood.seed;
  // frequencies are low along the board and high across it, so the grain runs lengthways
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' +
    layerSvg('lt', '0.0024 0.030', 2, s + 5, 3.2, -0.9, wood.light, 0.9) +
    layerSvg('rg', '0.0032 0.082', 3, s, -2.8, 1.75, wood.dark, (0.62 * wood.rings).toFixed(2)) +
    layerSvg('st', '0.0016 0.46', 4, s + 2, -3.4, 2.0, wood.dark, (0.7 * wood.streak).toFixed(2)) +
    layerSvg('pr', '0.07 0.82', 1, s + 9, 7, -3.6, wood.dark, (0.8 * wood.pores).toFixed(2)) +
    '</svg>';
}

function loadSvg(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

const grainCache = new Map();
export function getGrain(woodId, w, h) {
  const key = woodId + '|' + w + 'x' + h;
  if (grainCache.has(key)) return grainCache.get(key);
  const wood = WOODS[woodId];
  const p = loadSvg(grainSvg(w, h, wood)).then((img) => {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const cx = cv.getContext('2d');
    cx.fillStyle = rgb(wood.base);
    cx.fillRect(0, 0, w, h);
    cx.drawImage(img, 0, 0, w, h);
    return cv;
  });
  grainCache.set(key, p);
  // keep memory sensible on phones: remember only the most recent few
  if (grainCache.size > 6) grainCache.delete(grainCache.keys().next().value);
  return p;
}

/* ---------- surface layers ---------- */

export function createLayers(w, h) {
  const mk = (cw, ch) => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; return c; };
  const color = mk(w, h), bump = mk(w, h), rough = mk(Math.round(w / 2), Math.round(h / 2));
  return { w, h, color, bump, rough, cc: color.getContext('2d'), bc: bump.getContext('2d'), rc: rough.getContext('2d') };
}

function polyPath(ctx, pts, X, Y) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))));
  ctx.closePath();
}

function resinBand(shape, k, X, Y, seed) {
  const b = shape.body;
  const x0 = b.type === 'circle' ? b.cx - b.r : b.x0, x1 = b.type === 'circle' ? b.cx + b.r : b.x1;
  const y0 = b.type === 'circle' ? b.cy - b.r : b.y0, y1 = b.type === 'circle' ? b.cy + b.r : b.y1;
  const bh = y1 - y0;
  const yc = b.type === 'circle' ? b.cy - b.r * 0.46 : y0 + bh * 0.25;
  const T = b.type === 'circle' ? b.r * 0.24 : bh * 0.22;
  const A = bh * 0.055;
  const N = 90, top = [], bot = [];
  const span = x1 - x0 + 60;
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = x0 - 30 + t * span;
    const wob = Math.sin(t * TAU * 1.15 + seed) * A + Math.sin(t * TAU * 2.3 + seed * 1.7) * A * 0.35;
    const thick = T * (0.78 + 0.22 * Math.sin(t * TAU * 1.6 + seed * 0.6));
    top.push([X(x), Y(yc + wob + thick / 2)]);
    bot.push([X(x), Y(yc + wob + 0.5 * Math.sin(t * TAU * 1.9 + 1) * A * 0.4 - thick / 2)]);
  }
  const path = new Path2D();
  top.forEach((p, i) => (i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])));
  for (let i = bot.length - 1; i >= 0; i--) path.lineTo(bot[i][0], bot[i][1]);
  path.closePath();
  return { path, top, bot, x0: X(x0), x1: X(x1) };
}

/* ---- text layout ---- */
function measure(ctx, text, fontId, px, spacing) {
  ctx.font = fontSpec(fontId, px);
  if (!spacing) return ctx.measureText(text).width;
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return w - spacing;
}

function layoutText(ctx, state, shape, k, X, Y, lines) {
  const z = shape.zone, bb = shape.bbox;
  const W = bb.w * k, H = bb.h * k;
  const zw = z.w * k, zh = z.h * k;
  let cx = X(z.cx) + state.ox * W;
  let cy = Y(z.cy) - state.oy * H;
  if (state.resin !== 'none' && shape.id !== 'tapas') cy -= zh * 0.13;
  const hasIcon = state.icon !== 'none';
  const sz = state.size;
  const out = { lines: [], icon: null, box: null };
  const t1 = lines[0], t2 = lines[1].toUpperCase();
  const f = state.font;
  const maxW = Math.min(zw * sz, W * 0.92);
  let s1 = zh * 0.36 * sz, s2 = zh * 0.125 * sz;
  if (t1) { const w100 = measure(ctx, t1, f, 100, 0); s1 = Math.min(s1, (maxW * 100) / Math.max(w100, 1)); }
  let sp2 = s2 * 0.2;
  if (t2) { const w2 = measure(ctx, t2, 'clean', 100, 20); s2 = Math.min(s2, (maxW * 100) / Math.max(w2, 1)); sp2 = s2 * 0.2; }
  const iconSize = hasIcon ? zh * 0.19 * Math.min(sz, 1.2) : 0;
  let blockH = (t1 ? s1 * 0.8 : 0) + (t1 && t2 ? s1 * 0.38 : 0) + (t2 ? s2 * 0.8 : 0) + (hasIcon ? iconSize + s1 * 0.25 : 0);
  let y = cy - blockH / 2;
  if (hasIcon) { out.icon = { x: cx, y: y + iconSize / 2, size: iconSize }; y += iconSize + s1 * 0.25; }
  let top = hasIcon ? y - iconSize - s1 * 0.25 : y, bottom = y;
  if (t1) { out.lines.push({ text: t1, font: f, size: s1, x: cx, y: y + s1 * 0.62, spacing: 0, align: 'center' }); y += s1 * 0.8 + (t2 ? s1 * 0.38 : 0); bottom = y; }
  if (t2) { out.lines.push({ text: t2, font: 'clean', size: s2, x: cx, y: y + s2 * 0.62, spacing: sp2, align: 'center' }); bottom = y + s2 * 0.8; }
  let maxLine = 0;
  out.lines.forEach((l) => { maxLine = Math.max(maxLine, measure(ctx, l.text, l.font, l.size, l.spacing)); });
  const bw = Math.max(maxLine, out.icon ? out.icon.size : 0) + 24;
  if (out.lines.length || out.icon) out.box = { x: cx - bw / 2, y: (out.icon ? top : out.lines[0].y - out.lines[0].size * 0.75) - 12, w: bw, h: bottom - (out.icon ? top : out.lines[0].y - out.lines[0].size * 0.75) + 24 };
  return out;
}

function drawLine(ctx, l) {
  ctx.font = fontSpec(l.font, l.size);
  ctx.textBaseline = 'alphabetic';
  if (!l.spacing) { ctx.textAlign = 'center'; ctx.fillText(l.text, l.x, l.y); return; }
  ctx.textAlign = 'left';
  let w = 0;
  for (const ch of l.text) w += ctx.measureText(ch).width + l.spacing;
  w -= l.spacing;
  let x = l.x - w / 2;
  for (const ch of l.text) { ctx.fillText(ch, x, l.y); x += ctx.measureText(ch).width + l.spacing; }
}

/* Paint one decorative mark into all three layers in the chosen finish */
function stamp(L, finish, k, drawFn) {
  const { cc, bc, rc } = L;
  if (finish === 'burn') {
    cc.save();
    cc.shadowColor = 'rgba(70,26,4,.7)'; cc.shadowBlur = 7 * k * 0.5;
    cc.fillStyle = cc.strokeStyle = 'rgba(22,10,3,.95)';
    drawFn(cc);
    cc.restore();
    bc.save(); bc.shadowColor = '#000'; bc.shadowBlur = 3 * k * 0.5; bc.fillStyle = bc.strokeStyle = 'rgb(88,88,88)'; drawFn(bc); bc.restore();
  } else {
    cc.save(); cc.translate(1.3 * k * 0.5, 1.7 * k * 0.5);
    cc.fillStyle = cc.strokeStyle = 'rgba(255,238,205,.42)'; drawFn(cc); cc.restore();
    cc.save(); cc.fillStyle = cc.strokeStyle = 'rgba(24,10,3,.74)'; drawFn(cc); cc.restore();
    bc.save(); bc.shadowColor = '#000'; bc.shadowBlur = 3.5 * k * 0.5; bc.fillStyle = bc.strokeStyle = 'rgb(18,18,18)'; drawFn(bc); bc.restore();
  }
  // roughness layer is half size
  rc.save(); rc.scale(0.5, 0.5);
  rc.fillStyle = rc.strokeStyle = finish === 'burn' ? 'rgb(236,236,236)' : 'rgb(215,215,215)';
  drawFn(rc);
  rc.restore();
}

export function compose(L, state, shape, grain, shown) {
  const W = L.w, H = L.h, bb = shape.bbox, k = W / bb.w;
  const X = (x) => (x - bb.x0) * k, Y = (y) => (bb.y1 - y) * k;
  const { cc, bc, rc } = L;

  // base: wood
  cc.globalCompositeOperation = 'source-over';
  cc.drawImage(grain, 0, 0, W, H);

  // bump base = a toned-down copy of the grain brightness around mid grey
  bc.globalAlpha = 1; bc.globalCompositeOperation = 'source-over';
  bc.fillStyle = '#8c8c8c'; bc.fillRect(0, 0, W, H);
  bc.globalCompositeOperation = 'luminosity'; bc.drawImage(grain, 0, 0, W, H);
  bc.globalCompositeOperation = 'source-over'; bc.globalAlpha = 0.5; bc.fillStyle = '#8c8c8c'; bc.fillRect(0, 0, W, H); bc.globalAlpha = 1;

  // roughness base: satin wood
  rc.setTransform(1, 0, 0, 1, 0, 0);
  rc.fillStyle = 'rgb(168,168,168)'; rc.fillRect(0, 0, rc.canvas.width, rc.canvas.height);

  // resin river
  if (state.resin !== 'none') {
    const rs = RESINS[state.resin];
    const band = resinBand(shape, k, X, Y, 1.3 + shape.bbox.w * 0.001);
    cc.save();
    const g = cc.createLinearGradient(band.x0, 0, band.x1, 0);
    g.addColorStop(0, rs.a); g.addColorStop(0.5, rs.b); g.addColorStop(1, rs.a);
    cc.fillStyle = g; cc.globalAlpha = 0.93; cc.fill(band.path);
    cc.globalAlpha = 1;
    cc.clip(band.path);
    // wood grain showing through the resin
    cc.globalCompositeOperation = 'multiply'; cc.globalAlpha = 0.2; cc.drawImage(grain, 0, 0, W, H);
    // swirl highlights
    cc.globalCompositeOperation = 'source-over'; cc.globalAlpha = 0.34; cc.strokeStyle = rs.hi; cc.lineCap = 'round';
    [0.28, 0.5, 0.72].forEach((f, i) => {
      cc.lineWidth = (2.6 - i * 0.6) * k * 0.5;
      cc.beginPath();
      band.top.forEach((p, j) => { const q = band.bot[j]; const y = p[1] + (q[1] - p[1]) * f + Math.sin(j * 0.31 + i * 2) * 3 * k * 0.5; j ? cc.lineTo(p[0], y) : cc.moveTo(p[0], y); });
      cc.stroke();
    });
    cc.restore();
    // resin lip
    cc.save(); cc.lineWidth = 1.8 * k * 0.5; cc.strokeStyle = 'rgba(0,0,0,.4)'; cc.stroke(band.path); cc.restore();
    // heights and gloss
    bc.save(); bc.fillStyle = 'rgb(92,92,92)'; bc.fill(band.path); bc.lineWidth = 2.4 * k * 0.5; bc.strokeStyle = 'rgb(40,40,40)'; bc.stroke(band.path); bc.restore();
    rc.save(); rc.scale(0.5, 0.5); rc.fillStyle = 'rgb(16,16,16)'; rc.fill(band.path); rc.restore();
  }

  // tapas dishes
  shape.dishes.forEach((d) => {
    const cx = X(d[0]), cy = Y(d[1]), r = d[2] * k;
    const g = cc.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    g.addColorStop(0, 'rgba(36,18,6,.12)'); g.addColorStop(0.85, 'rgba(36,18,6,.24)'); g.addColorStop(1, 'rgba(36,18,6,.42)');
    cc.save(); cc.beginPath(); cc.arc(cx, cy, r, 0, TAU); cc.fillStyle = g; cc.fill();
    cc.lineWidth = 2.4 * k * 0.5; cc.strokeStyle = 'rgba(24,11,3,.5)'; cc.stroke();
    cc.beginPath(); cc.arc(cx, cy, r - 3 * k * 0.5, 0.15, Math.PI * 0.62); cc.lineWidth = 2 * k * 0.5; cc.strokeStyle = 'rgba(255,238,205,.4)'; cc.stroke();
    cc.restore();
    const bg = bc.createRadialGradient(cx, cy, 0, cx, cy, r);
    bg.addColorStop(0, 'rgb(60,60,60)'); bg.addColorStop(0.8, 'rgb(66,66,66)'); bg.addColorStop(0.97, 'rgb(120,120,120)'); bg.addColorStop(1, 'rgb(140,140,140)');
    bc.save(); bc.beginPath(); bc.arc(cx, cy, r, 0, TAU); bc.fillStyle = bg; bc.fill(); bc.restore();
  });

  // border, icon, words
  const lay = layoutText(cc, state, shape, k, X, Y, [shown[0], shown[1]]);
  if (state.border) {
    const inset = bodyInset(shape, 15);
    stamp(L, state.finish, k, (ctx) => { ctx.lineWidth = 3.4 * k * 0.5; ctx.lineJoin = 'round'; polyPath(ctx, inset, X, Y); ctx.stroke(); });
    const inset2 = bodyInset(shape, 23);
    stamp(L, state.finish, k, (ctx) => { ctx.lineWidth = 1.5 * k * 0.5; ctx.lineJoin = 'round'; polyPath(ctx, inset2, X, Y); ctx.stroke(); });
  }
  if (lay.icon && ICONS[state.icon].d) {
    const ic = lay.icon, p2 = new Path2D(ICONS[state.icon].d), s = ic.size / 24;
    stamp(L, state.finish, k, (ctx) => { ctx.save(); ctx.translate(ic.x - 12 * s, ic.y - 12 * s); ctx.scale(s, s); ctx.fill(p2); ctx.restore(); });
  }
  lay.lines.forEach((l) => stamp(L, state.finish, k, (ctx) => drawLine(ctx, l)));

  return { textBox: lay.box, k };
}

/* a small wood swatch for the timber picker */
export async function woodThumb(woodId, w, h) {
  const g = await getGrain(woodId, w * 3, h * 3);
  const cv = document.createElement('canvas');
  cv.width = w * 2; cv.height = h * 2;
  cv.getContext('2d').drawImage(g, 0, 0, cv.width, cv.height);
  return cv;
}
