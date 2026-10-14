/* 3D view (Three.js). The board is a real extruded mesh with bevelled edges,
   lit by a soft key light and a room reflection so the resin looks glossy.
   You turn it like a lazy Susan: drag sideways. It loads only when needed. */

import {
  WebGLRenderer, Scene, PerspectiveCamera, Mesh, Shape, Path, ExtrudeGeometry, MeshStandardMaterial,
  MeshBasicMaterial, PlaneGeometry, CanvasTexture, SRGBColorSpace, Vector2,
  DirectionalLight, HemisphereLight, PMREMGenerator, Raycaster, ACESFilmicToneMapping,
  Group, MathUtils, TOUCH
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const S = 0.01;                 // board units -> scene units
const POLAR = 0.56;             // how far the camera looks down (radians from straight above)
const FOV = 24;

function easeOutBack(t) { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

export function createView3D(host, opts) {
  opts = opts || {};
  const calm = !!opts.calm;

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const pr = Math.min(window.devicePixelRatio || 1, opts.maxPixelRatio || 2);
  renderer.setPixelRatio(pr);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  const canvas = renderer.domElement;
  canvas.className = 'bd-canvas bd-3d';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.touchAction = 'pan-y';   // vertical swipes still scroll the page
  host.appendChild(canvas);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.62;

  scene.add(new HemisphereLight(0xfff3df, 0xb79d7c, 0.55));
  const key = new DirectionalLight(0xfff1dc, 2.3);
  key.position.set(-3.6, 7.2, 4.6);
  scene.add(key);
  const fill = new DirectionalLight(0xdfe8ff, 0.5);
  fill.position.set(5, 3, -3);
  scene.add(fill);

  // soft shadow drawn from the board outline (no shadow map, so it looks the same on every GPU)
  const shCv = document.createElement('canvas'); shCv.width = 512; shCv.height = 512;
  const shTex = new CanvasTexture(shCv);
  const blob = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = -0.003;
  scene.add(blob);
  function paintShadow() {
    const bb = shape.bbox, pad = 0.5;
    const W = shCv.width, k = W / (bb.w * (1 + pad * 2)) , cx = W / 2, cy = W / 2;
    const g = shCv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, W);
    const off = W * 2;
    g.save();
    g.shadowColor = 'rgba(40,26,10,.45)'; g.shadowBlur = 26; g.shadowOffsetX = off; g.shadowOffsetY = 0;
    g.translate(-off, 0); g.fillStyle = '#000';
    g.beginPath();
    shape.outline.forEach((q, i) => (i ? g.lineTo(cx + q[0] * k, cy - q[1] * k) : g.moveTo(cx + q[0] * k, cy - q[1] * k)));
    g.closePath(); g.fill();
    g.restore();
    shTex.needsUpdate = true;
    const side = bb.w * (1 + pad * 2) * S;
    blob.scale.set(side, side, 1);
    blob.position.set(bb.w * S * 0.012, -0.003, -bb.w * S * 0.03);
  }

  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false; controls.enableZoom = false;
  controls.enableDamping = !calm; controls.dampingFactor = 0.09; controls.rotateSpeed = 0.9;
  controls.minPolarAngle = controls.maxPolarAngle = POLAR;
  controls.touches = { ONE: TOUCH.ROTATE };
  canvas.style.touchAction = 'pan-y';

  const pivot = new Group();
  scene.add(pivot);
  let mesh = null, material = null, shape = null;
  let tex = { color: null, bump: null, rough: null };
  let dist = 12, running = false, needs = true, sway = !calm, swayT = 0, tween = null, raf = 0;
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  let textBox = null, layerSize = { w: 1, h: 1 };

  function fit() {
    if (!shape) return;
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const bb = shape.bbox;
    const r = Math.hypot(bb.w, bb.h) * 0.5 * S;
    const vf = MathUtils.degToRad(FOV) / 2, hf = Math.atan(Math.tan(vf) * camera.aspect);
    // the whole board stays in frame whichever way it is turned
    dist = (r * 1.04) / Math.sin(Math.min(vf, hf) * 0.98);
    const az = controls.getAzimuthalAngle();
    camera.position.set(Math.sin(az) * Math.sin(POLAR) * dist, Math.cos(POLAR) * dist, Math.cos(az) * Math.sin(POLAR) * dist);
    controls.target.set(0, 0.06, 0);
    controls.update();
    needs = true;
  }

  function disposeMesh() {
    if (mesh) { pivot.remove(mesh); mesh.geometry.dispose(); mesh = null; }
  }

  function buildMesh() {
    disposeMesh();
    const pts = shape.outline.map((p) => new Vector2(p[0], p[1]));
    const sh = new Shape(pts);
    shape.holes.forEach((hp) => sh.holes.push(new Path(hp.map((p) => new Vector2(p[0], p[1])))));
    const bevel = 3;
    const geo = new ExtrudeGeometry(sh, { depth: shape.thickness, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 3, curveSegments: 1, steps: 1 });
    geo.translate(0, 0, bevel);
    const pos = geo.attributes.position, uv = geo.attributes.uv, bb = shape.bbox;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - bb.x0) / bb.w, (pos.getY(i) - bb.y0) / bb.h);
    uv.needsUpdate = true;
    mesh = new Mesh(geo, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(S);
    pivot.add(mesh);
    paintShadow();
  }

  function makeTex(canvasEl, isColor) {
    const t = new CanvasTexture(canvasEl);
    if (isColor) t.colorSpace = SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  function setLayers(layers, tb) {
    textBox = tb; layerSize = { w: layers.w, h: layers.h };
    const sameCanvases = tex.color && tex.color.image === layers.color;
    if (!sameCanvases) {
      ['color', 'bump', 'rough'].forEach((k) => tex[k] && tex[k].dispose());
      tex.color = makeTex(layers.color, true); tex.bump = makeTex(layers.bump, false); tex.rough = makeTex(layers.rough, false);
      if (material) material.dispose();
      material = new MeshStandardMaterial({ map: tex.color, bumpMap: tex.bump, bumpScale: 2.2, roughnessMap: tex.rough, roughness: 1, metalness: 0, envMapIntensity: 0.9 });
      if (mesh) mesh.material = material;
      else if (shape) { buildMesh(); fit(); }
    } else {
      tex.color.needsUpdate = tex.bump.needsUpdate = tex.rough.needsUpdate = true;
    }
    needs = true;
  }

  function setShape(sh, animate) {
    const changed = shape !== sh;
    shape = sh;
    if (!material) return;       // geometry is built once the first layers arrive
    buildMesh();
    fit();
    if (changed && animate && !calm) startTween();
  }

  function startTween() { if (calm) return; tween = { t0: performance.now(), dur: 460 }; needs = true; }

  function stepTween(now) {
    if (!tween) return false;
    const t = Math.min(1, (now - tween.t0) / tween.dur);
    const e = easeOutBack(t);
    const sc = 0.9 + 0.1 * e;
    pivot.scale.set(sc, sc, sc);
    pivot.rotation.y = (1 - e) * 0.35;
    if (t >= 1) { tween = null; pivot.scale.set(1, 1, 1); pivot.rotation.y = 0; }
    return true;
  }

  let userTouched = false;
  controls.addEventListener('start', () => { userTouched = true; sway = false; });
  function tick(now) {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    let changed = stepTween(now);
    if (sway && !userTouched) {
      swayT += 1 / 60;
      const az = Math.sin(swayT * 0.55) * 0.3;
      camera.position.set(Math.sin(az) * Math.sin(POLAR) * dist, Math.cos(POLAR) * dist, Math.cos(az) * Math.sin(POLAR) * dist);
      camera.lookAt(controls.target);
      changed = true;
    }
    if (!(sway && !userTouched) && controls.update()) changed = true;
    if (changed || needs) { needs = false; renderer.render(scene, camera); }
  }

  function start() { if (running) return; running = true; needs = true; raf = requestAnimationFrame(tick); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function render() { needs = true; if (!running) renderer.render(scene, camera); }

  function resetView() {
    userTouched = false; swayT = 0; sway = !calm;
    camera.position.set(0, Math.cos(POLAR) * dist, Math.sin(POLAR) * dist);
    controls.target.set(0, 0.06, 0);
    controls.update(); needs = true;
    if (!running) renderer.render(scene, camera);
  }

  function rotateBy(delta) {
    userTouched = true; sway = false;
    const az = controls.getAzimuthalAngle() + delta;
    camera.position.set(Math.sin(az) * Math.sin(POLAR) * dist, Math.cos(POLAR) * dist, Math.cos(az) * Math.sin(POLAR) * dist);
    controls.update(); needs = true;
  }

  /* pointer -> texture pixels, if the pointer is over the board's top face */
  function hit(clientX, clientY, pad) {
    if (!mesh) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(mesh, false);
    if (!hits.length || !hits[0].uv) return null;
    const h = hits[0];
    if (h.face && h.face.normal.z < 0.5) return { px: 0, py: 0, inside: false, onBoard: true };
    const px = h.uv.x * layerSize.w, py = (1 - h.uv.y) * layerSize.h;
    const p = pad || 0;
    const inside = !!textBox && px >= textBox.x - p && px <= textBox.x + textBox.w + p && py >= textBox.y - p && py <= textBox.y + textBox.h + p;
    return { px, py, inside, onBoard: true };
  }

  function setEnabled(v) { controls.enabled = v; }

  function dispose() {
    stop();
    disposeMesh();
    ['color', 'bump', 'rough'].forEach((k) => tex[k] && tex[k].dispose());
    if (material) material.dispose();
    envTex.dispose(); pmrem.dispose(); controls.dispose(); renderer.dispose();
    canvas.remove();
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); if (opts.onLost) opts.onLost(); });

  return {
    canvas, setShape, setLayers, resize: fit, start, stop, render, resetView, rotateBy, hit, setEnabled, dispose, pop: startTween,
    show() { if (canvas.hidden) { canvas.hidden = false; fit(); } start(); },
    hide() { canvas.hidden = true; stop(); },
    image() { renderer.render(scene, camera); return canvas; },
    onInteract(fn) { controls.addEventListener('start', fn); },
    debug() { return { scene, camera, renderer, mesh, material, shape, dist, running, info: renderer.info.render }; }
  };
}
