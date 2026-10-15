/* Builds an SVG cutting file of the current design for CNC software such as Easel.
   Units are millimetres. Words are written as outlines (no fonts needed) and each job
   sits in its own coloured group: red = cut out, black = engrave, blue = border line,
   green = resin pocket, orange = dishes. */

import { bodyInset } from './shapes.js';
import { ICONS, RESINS, resinPolygon } from './textures.js';

const r2 = (n) => Math.round(n * 100) / 100;

function poly(pts, close) {
  return 'M' + pts.map((p) => r2(p[0]) + ' ' + r2(p[1])).join('L') + (close === false ? '' : 'Z');
}

/* Sutherland-Hodgman: trim a polygon to a convex clip polygon (both counter-clockwise) */
function clip(subject, clipPoly) {
  let out = subject;
  for (let i = 0; i < clipPoly.length && out.length; i++) {
    const a = clipPoly[i], b = clipPoly[(i + 1) % clipPoly.length];
    const inside = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
    const cross = (p, q) => {
      const dx = q[0] - p[0], dy = q[1] - p[1], ex = b[0] - a[0], ey = b[1] - a[1];
      const t = (ex * (a[1] - p[1]) - ey * (a[0] - p[0])) / (ex * dy - ey * dx || 1e-9);
      return [p[0] + dx * t, p[1] + dy * t];
    };
    const input = out; out = [];
    input.forEach((cur, j) => {
      const prev = input[(j + input.length - 1) % input.length];
      if (inside(cur)) { if (!inside(prev)) out.push(cross(prev, cur)); out.push(cur); }
      else if (inside(prev)) out.push(cross(prev, cur));
    });
  }
  return out;
}

function glyphPath(d, s, ox, oy) {
  return d.replace(/([MLQC])([^MLQCZ]*)/g, (m, cmd, args) => {
    const n = args.trim().split(/[\s,]+/).map(Number), o = [];
    for (let i = 0; i < n.length; i += 2) o.push(r2(n[i] * s + ox) + ' ' + r2(oy - n[i + 1] * s));
    return cmd + o.join(' ');
  });
}

function textPaths(line, k, fonts) {
  const f = fonts[line.font];
  if (!f) return '';
  const s = line.size / k / f.upm, spacing = (line.spacing || 0) / k;
  const chars = Array.from(line.text);
  const adv = chars.map((ch) => (f.g[ch] ? f.g[ch][0] : f.upm * 0.3) * s);
  const width = adv.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = line.x / k - width / 2;
  const y = line.y / k;
  let d = '';
  chars.forEach((ch, i) => { if (f.g[ch] && f.g[ch][1]) d += glyphPath(f.g[ch][1], s, x, y); x += adv[i] + spacing; });
  return d;
}

export function buildEasel(state, shape, lay, k, fonts) {
  const bb = shape.bbox;
  const P = (p) => [p[0] - bb.x0, bb.y1 - p[1]];
  const outline = shape.outline.map(P);
  let cut = poly(outline);
  shape.holes.forEach((h) => { cut += poly(h.map(P)); });

  let words = '';
  (lay.lines || []).forEach((l) => { words += textPaths(l, k, fonts); });

  let icon = '';
  if (lay.icon && ICONS[state.icon] && ICONS[state.icon].d) {
    const ic = lay.icon, sz = ic.size / k, sc = sz / 24;
    icon = '<path transform="translate(' + r2(ic.x / k - sz / 2) + ' ' + r2(ic.y / k - sz / 2) + ') scale(' + r2(sc * 1000) / 1000 + ')" d="' + ICONS[state.icon].d + '"/>';
  }

  let border = '';
  if (state.border) border = '<path d="' + poly(bodyInset(shape, 15).map(P)) + poly(bodyInset(shape, 23).map(P)) + '"/>';

  let resin = '';
  if (state.resin !== 'none') {
    const clipPoly = bodyInset(shape, 3).map(P);
    // the clip polygon is drawn y-down, so it runs clockwise on screen; flip it for the maths
    const band = clip(resinPolygon(shape).map(P), clipPoly.slice().reverse());
    if (band.length > 2) resin = '<path d="' + poly(band) + '"/>';
  }

  let dishes = '';
  shape.dishes.forEach((c) => { const p = P([c[0], c[1]]); dishes += '<circle cx="' + r2(p[0]) + '" cy="' + r2(p[1]) + '" r="' + c[2] + '"/>'; });

  const W = r2(bb.w), H = r2(bb.h);
  const note = shape.name + ', ' + state.wood + (state.resin !== 'none' ? ', ' + RESINS[state.resin].name.toLowerCase() + ' resin' : '');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + 'mm" height="' + H + 'mm" viewBox="0 0 ' + W + ' ' + H + '">\n' +
    '<title>The Fat Hamster Wood Shop: ' + note + '</title>\n' +
    '<!-- Units are mm and sizes are a starting point. Red: cut out. Black: engrave. Blue: border line. Green: resin pocket. Orange: dishes. -->\n' +
    '<g id="cut-outline" fill="none" stroke="#e11d1d" stroke-width="0.3" fill-rule="evenodd"><path d="' + cut + '"/></g>\n' +
    '<g id="engrave-words" fill="#000000" stroke="none"><path d="' + words + '"/></g>\n' +
    (icon ? '<g id="engrave-icon" fill="#000000" stroke="none">' + icon + '</g>\n' : '') +
    (border ? '<g id="border-line" fill="none" stroke="#1d4ed8" stroke-width="0.3">' + border + '</g>\n' : '') +
    (resin ? '<g id="resin-pocket" fill="none" stroke="#15803d" stroke-width="0.3">' + resin + '</g>\n' : '') +
    (dishes ? '<g id="dishes" fill="none" stroke="#b45309" stroke-width="0.3">' + dishes + '</g>\n' : '') +
    '</svg>\n';
}
