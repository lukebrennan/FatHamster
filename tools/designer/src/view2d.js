/* Flat, top-down view. Draws the shared colour layer clipped to the board outline,
   with a soft shadow, a little light across the surface and a lit rim. */

export function createView2D(host) {
  const canvas = document.createElement('canvas');
  canvas.className = 'bd-canvas bd-2d';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let shape = null, layers = null, textBox = null;
  let cw = 0, ch = 0, dpr = 1;
  let tr = { s: 1, cx: 0, cy: 0 };

  function resize() {
    const r = host.getBoundingClientRect();
    cw = Math.max(1, Math.round(r.width)); ch = Math.max(1, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    draw();
  }

  function pathFor(pts, s, cx, cy) {
    const p = new Path2D();
    pts.forEach((q, i) => (i ? p.lineTo(cx + q[0] * s, cy - q[1] * s) : p.moveTo(cx + q[0] * s, cy - q[1] * s)));
    p.closePath();
    return p;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    if (!shape || !layers) return;
    const bb = shape.bbox;
    const s = Math.min((cw * 0.8) / bb.w, (ch * 0.64) / bb.h);
    const cx = cw / 2, cy = ch / 2 - ch * 0.01;
    tr = { s, cx, cy };

    const all = new Path2D();
    all.addPath(pathFor(shape.outline, s, cx, cy));
    shape.holes.forEach((h) => all.addPath(pathFor(h, s, cx, cy)));

    // shadow
    ctx.save();
    ctx.shadowColor = 'rgba(39,31,21,.4)';
    ctx.shadowBlur = 30; ctx.shadowOffsetY = 16;
    ctx.fillStyle = '#000';
    ctx.fill(all, 'evenodd');
    ctx.restore();

    // board
    ctx.save();
    ctx.clip(all, 'evenodd');
    ctx.drawImage(layers.color, cx - (bb.w * s) / 2, cy - (bb.h * s) / 2, bb.w * s, bb.h * s);
    const g = ctx.createLinearGradient(cx - (bb.w * s) / 2, cy - (bb.h * s) / 2, cx + (bb.w * s) / 2, cy + (bb.h * s) / 2);
    g.addColorStop(0, 'rgba(255,255,255,.2)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.12)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    // lit rim: light from the top left
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.stroke(all);
    ctx.save(); ctx.translate(1.2, 1.4); ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(255,244,222,.5)'; ctx.stroke(pathFor(shape.outline, s, cx, cy)); ctx.restore();
    ctx.restore();

    // hanging hole rim
    shape.holes.forEach((h) => {
      ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(30,15,4,.55)'; ctx.stroke(pathFor(h, s, cx, cy)); ctx.restore();
    });
  }

  return {
    canvas,
    setShape(sh) { shape = sh; },
    setLayers(l, tb) { layers = l; textBox = tb; draw(); },
    resize,
    draw,
    show() { if (canvas.hidden) { canvas.hidden = false; resize(); } },
    hide() { canvas.hidden = true; },
    /* pointer position -> texture pixels, if it is over the words */
    hitText(clientX, clientY, pad) {
      if (!shape || !layers || !textBox) return null;
      const r = canvas.getBoundingClientRect();
      const wx = (clientX - r.left - tr.cx) / tr.s, wy = (tr.cy - (clientY - r.top)) / tr.s;
      const bb = shape.bbox, k = layers.w / bb.w;
      // the outline is centred on the origin, so the box spans -w/2..w/2 and -h/2..h/2
      const px = (wx - bb.x0) * k, py = (bb.y1 - wy) * k;
      const p = pad || 0;
      const inside = px >= textBox.x - p && px <= textBox.x + textBox.w + p && py >= textBox.y - p && py <= textBox.y + textBox.h + p;
      return { px, py, inside };
    },
    image() { return canvas; }
  };
}
