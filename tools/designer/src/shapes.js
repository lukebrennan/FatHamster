/* Board outlines.
   Everything is a plain array of [x, y] points in a y-up space measured in "mm-ish" units,
   re-centred on the middle of the bounding box. The same outline feeds the 3D mesh,
   the flat canvas clip and the little silhouette tiles in the picker. */

const TAU = Math.PI * 2;

function arc(cx, cy, r, a0, a1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/* Rounded rectangle, counter-clockwise, optionally leaving a gap on the right edge (for a handle) */
function roundedRect(x0, y0, x1, y1, r, n) {
  r = Math.max(1, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
  return [].concat(
    arc(x1 - r, y1 - r, r, 0, Math.PI / 2, n),
    arc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, n),
    arc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, n),
    arc(x1 - r, y0 + r, r, Math.PI * 1.5, TAU, n)
  );
}

function clean(pts) {
  const out = [];
  pts.forEach((p) => {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05) out.push(p);
  });
  const f = out[0], l = out[out.length - 1];
  if (Math.hypot(f[0] - l[0], f[1] - l[1]) < 0.05) out.pop();
  return out;
}

function bboxOf(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pts.forEach((p) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/* Build a finished shape: shift everything so the bounding box is centred on the origin */
function finish(spec) {
  const outline = clean(spec.outline);
  const bb = bboxOf(outline);
  const dx = -(bb.x0 + bb.w / 2), dy = -(bb.y0 + bb.h / 2);
  const mv = (p) => [p[0] + dx, p[1] + dy];
  const shape = {
    id: spec.id,
    name: spec.name,
    outline: outline.map(mv),
    holes: (spec.holes || []).map((h) => clean(h).map(mv)),
    dishes: (spec.dishes || []).map((d) => [d[0] + dx, d[1] + dy, d[2]]),
    zone: { cx: spec.zone.cx + dx, cy: spec.zone.cy + dy, w: spec.zone.w, h: spec.zone.h },
    body: spec.body.type === 'circle'
      ? { type: 'circle', cx: spec.body.cx + dx, cy: spec.body.cy + dy, r: spec.body.r }
      : { type: 'rect', x0: spec.body.x0 + dx, y0: spec.body.y0 + dy, x1: spec.body.x1 + dx, y1: spec.body.y1 + dy, r: spec.body.r },
    thickness: spec.thickness || 22
  };
  shape.bbox = bboxOf(shape.outline);
  return shape;
}

function paddleHandleOutlineRound(R, handleLen, hw) {
  const a = Math.asin(hw / R);
  const xEnd = R + handleLen;
  return [].concat(
    arc(0, 0, R, a, TAU - a, 110),
    arc(xEnd - hw, 0, hw, -Math.PI / 2, Math.PI / 2, 16)
  );
}

function paddleHandleOutlineRect(x0, y0, x1, y1, r, handleLen, hw) {
  const xEnd = x1 + handleLen;
  const cy = (y0 + y1) / 2;
  r = Math.min(r, (y1 - y0) / 2);
  return [].concat(
    [[x1, cy + hw]],
    arc(x1 - r, y1 - r, r, 0, Math.PI / 2, 12),
    arc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, 12),
    arc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, 12),
    arc(x1 - r, y0 + r, r, Math.PI * 1.5, TAU, 12),
    [[x1, cy - hw]],
    arc(xEnd - hw, cy, hw, -Math.PI / 2, Math.PI / 2, 16)
  );
}

function makeRound() {
  const R = 165, handle = 150, hw = 28, xEnd = R + handle;
  return finish({
    id: 'round', name: 'Round paddle',
    outline: paddleHandleOutlineRound(R, handle, hw),
    holes: [arc(xEnd - hw, 0, 10, 0, TAU, 28)],
    zone: { cx: 0, cy: 0, w: R * 1.5, h: R * 1.15 },
    body: { type: 'circle', cx: 0, cy: 0, r: R }
  });
}

function makeLong() {
  const x0 = -230, x1 = 220, y0 = -85, y1 = 85, hw = 28, handle = 150;
  return finish({
    id: 'long', name: 'Long paddle',
    outline: paddleHandleOutlineRect(x0, y0, x1, y1, 26, handle, hw),
    holes: [arc(x1 + handle - hw, 0, 10, 0, TAU, 28)],
    zone: { cx: (x0 + x1) / 2, cy: 0, w: (x1 - x0) * 0.82, h: (y1 - y0) * 0.78 },
    body: { type: 'rect', x0, y0, x1, y1, r: 26 }
  });
}

function makeTapas() {
  const x0 = -260, x1 = 240, y0 = -66, y1 = 66, hw = 24, handle = 120;
  return finish({
    id: 'tapas', name: 'Tapas paddle',
    outline: paddleHandleOutlineRect(x0, y0, x1, y1, 22, handle, hw),
    holes: [arc(x1 + handle - hw, 0, 9, 0, TAU, 24)],
    dishes: [[-5, 0, 40], [93, 0, 40], [191, 0, 40]],
    zone: { cx: -158, cy: 0, w: 185, h: 100 },
    body: { type: 'rect', x0, y0, x1, y1, r: 22 }
  });
}

function makePlain() {
  const x0 = -285, x1 = 285, y0 = -105, y1 = 105;
  return finish({
    id: 'plain', name: 'Serving board',
    outline: roundedRect(x0, y0, x1, y1, 18, 12),
    zone: { cx: 0, cy: 0, w: (x1 - x0) * 0.84, h: (y1 - y0) * 0.72 },
    body: { type: 'rect', x0, y0, x1, y1, r: 18 }
  });
}

export const SHAPES = {
  round: makeRound(),
  long: makeLong(),
  tapas: makeTapas(),
  plain: makePlain()
};
export const SHAPE_ORDER = ['round', 'long', 'tapas', 'plain'];

/* Outline of the body only, pulled in by `inset` units (used for the engraved border) */
export function bodyInset(shape, inset) {
  const b = shape.body;
  if (b.type === 'circle') return arc(b.cx, b.cy, b.r - inset, 0, TAU, 120);
  return roundedRect(b.x0 + inset, b.y0 + inset, b.x1 - inset, b.y1 - inset, Math.max(6, b.r - inset), 10);
}

/* SVG path string for a silhouette tile (y flipped for screen space) */
export function silhouettePath(shape, pad) {
  const bb = shape.bbox;
  const s = (p) => (p[0] - bb.x0 + pad).toFixed(1) + ' ' + (bb.y1 - p[1] + pad).toFixed(1);
  let d = 'M' + shape.outline.map(s).join('L') + 'Z';
  shape.holes.forEach((h) => { d += 'M' + h.map(s).join('L') + 'Z'; });
  shape.dishes.forEach((c) => {
    const pts = arc(c[0], c[1], c[2], 0, TAU, 24);
    d += 'M' + pts.map(s).join('L') + 'Z';
  });
  return { d, w: bb.w + pad * 2, h: bb.h + pad * 2 };
}

export { TAU, arc };
