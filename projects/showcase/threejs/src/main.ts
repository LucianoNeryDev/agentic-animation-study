import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BEATS, CAMERA, DURATION, FPS } from './beats';

// "Field": 14,400 instanced cubes whose heights are functions of time. A drop
// makes a ripple, waves build, then the cubes rise into the word "three.js".

const WIDTH = 1920, HEIGHT = 1080;
const COLS = 160, ROWS = 90;
const COUNT = COLS * ROWS;
const LETTER_H = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(WIDTH, HEIGHT);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const BG = new THREE.Color('#04060f');
const scene = new THREE.Scene();
scene.background = BG;
scene.fog = new THREE.Fog(BG, 90, 210);
const camera = new THREE.PerspectiveCamera(40, WIDTH / HEIGHT, 0.5, 400);

scene.add(new THREE.HemisphereLight('#8fb4ff', '#0a0d1a', 0.9));
const sun = new THREE.DirectionalLight('#ffffff', 2.2);
sun.position.set(-40, 70, 35);
scene.add(sun);

// --- The field: one instanced mesh, one cube per cell, base at y = 0 -------
const geo = new THREE.BoxGeometry(0.86, 1, 0.86);
geo.translate(0, 0.5, 0);
const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1 });
mat.onBeforeCompile = (shader) => {
  // instance colours also glow, so bright (HDR) cubes feed the bloom
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance += vColor.rgb * 0.3;\n#endif',
  );
};
const field = new THREE.InstancedMesh(geo, mat, COUNT);
field.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
const xs = new Float32Array(COUNT), zs = new Float32Array(COUNT);
const black = new THREE.Color(0, 0, 0);
for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
  const k = j * COLS + i;
  xs[k] = i - (COLS - 1) / 2;
  zs[k] = j - (ROWS - 1) / 2;
  field.setColorAt(k, black);
}
field.instanceColor!.setUsage(THREE.DynamicDrawUsage);
scene.add(field);
// ground under the cubes, so the gaps between them are not see-through
const ground = new THREE.Mesh(new THREE.PlaneGeometry(COLS + 40, ROWS + 40), new THREE.MeshStandardMaterial({ color: '#0b1738', roughness: 0.9 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// --- The falling orb that starts the ripple --------------------------------
const orb = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 1.8) }));
const orbLight = new THREE.PointLight('#ffd9a0', 0, 0, 2);
scene.add(orb, orbLight);

// --- Post-processing --------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1);
composer.setSize(WIDTH, HEIGHT);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(WIDTH, HEIGHT), 0.6, 0.5, 0.9));
composer.addPass(new OutputPass());

// --- The word, rasterised onto the grid ------------------------------------
const mask = new Float32Array(COUNT);
function buildMask() {
  const S = 4;
  const c = document.createElement('canvas');
  c.width = COLS * S;
  c.height = ROWS * S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = Math.round(c.height * 0.62);
  const fit = () => (g.font = `bold ${size}px "DejaVu Sans", Arial, sans-serif`);
  fit();
  while (g.measureText('three.js').width > c.width * 0.66) { size -= 4; fit(); }
  g.fillText('three.js', c.width / 2, c.height / 2);
  const px = g.getImageData(0, 0, c.width, c.height).data;
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    let sum = 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) sum += px[((j * S + y) * c.width + i * S + x) * 4];
    mask[j * COLS + i] = sum / (S * S * 255);
  }
}

// --- Motion: everything is a function of t ---------------------------------
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, v: number) => { const u = clamp((v - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const easeOutBack = (u: number) => 1 + 2.7 * Math.pow(u - 1, 3) + 1.7 * Math.pow(u - 1, 2);

const PALETTE = [
  [0.0, new THREE.Color('#0b1738')],
  [0.3, new THREE.Color('#0f6fb0')],
  [0.55, new THREE.Color('#17d5d0')],
  [0.8, new THREE.Color('#ff3d8b')],
  [1.0, new THREE.Color('#ffd27a').multiplyScalar(1.15)],
] as const;
const tmpColor = new THREE.Color();
function ramp(v: number, out: THREE.Color) {
  v = clamp(v, 0, 1);
  for (let i = 1; i < PALETTE.length; i++) {
    if (v <= PALETTE[i][0]) {
      const [a, ca] = PALETTE[i - 1], [b, cb] = PALETTE[i];
      return out.copy(ca).lerp(cb, (v - a) / (b - a));
    }
  }
  return out.copy(PALETTE[PALETTE.length - 1][1]);
}

function heightAt(k: number, t: number) {
  const x = xs[k], z = zs[k], r = Math.hypot(x, z);
  let h = 0.15;
  const ts = t - BEATS.splash;
  if (ts > 0) {   // ripple from the splash
    const d = r - 26 * ts;
    h += 3.4 * Math.exp(-(d * d) / 20) * (0.6 + 0.4 * Math.cos(d * 0.9)) * Math.exp(-ts * 0.5) * smooth(0, 0.12, ts);
  }
  const amp = smooth(BEATS.swell, BEATS.swell + 1.0, t);
  if (amp > 0) {  // travelling waves
    const w = Math.sin(0.16 * x + 1.9 * t) * Math.cos(0.21 * z - 1.4 * t)
      + 0.7 * Math.sin(0.07 * (x + 1.6 * z) - 2.3 * t)
      + 0.45 * Math.sin(r * 0.25 - 3.0 * t);
    h += amp * Math.max(0, 1.7 + 1.45 * w);
  }
  // formation sweeps left to right; letters spring up, the rest settles flat
  const start = BEATS.form + 0.9 * (x / COLS + 0.5);
  const blend = smooth(start - 0.1, start + 0.35, t);
  if (blend > 0) {
    const rise = easeOutBack(clamp((t - start) / 0.6, 0, 1));
    const shimmer = mask[k] * 0.35 * Math.sin(0.5 * x - 5 * t) * smooth(BEATS.hold - 0.4, BEATS.hold, t);
    h = h * (1 - blend) + (0.15 + mask[k] * LETTER_H * rise + shimmer) * blend;
  }
  return h;
}

const m4 = new THREE.Matrix4();
const WHITE_HOT = new THREE.Color(1.7, 1.65, 1.5);
function updateField(t: number) {
  const sweepX = -100 + 200 * smooth(BEATS.hold, BEATS.end - 0.2, t);
  for (let k = 0; k < COUNT; k++) {
    const h = Math.max(0.05, heightAt(k, t));
    m4.makeScale(1, h, 1).setPosition(xs[k], 0, zs[k]);
    field.setMatrixAt(k, m4);
    ramp(h / (LETTER_H * 1.05), tmpColor);
    const band = Math.exp(-(((xs[k] - sweepX) / 5) ** 2)) * mask[k];
    if (band > 0.01) tmpColor.lerp(WHITE_HOT, band * 0.6);
    field.setColorAt(k, tmpColor);
  }
  field.instanceMatrix.needsUpdate = true;
  field.instanceColor!.needsUpdate = true;
}

function updateOrb(t: number) {
  const u = t / BEATS.splash;
  orb.visible = u < 1;
  orb.position.set(0, 0.9 + 24 * (1 - u * u), 0);
  orbLight.position.copy(orb.position).y += u < 1 ? 1.5 : 5;
  const after = t - BEATS.splash;
  orbLight.intensity = u < 1 ? 400 * u : 700 * Math.exp(-after * 6);
}

const catmull = (p0: number, p1: number, p2: number, p3: number, u: number) =>
  0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
const look = new THREE.Vector3();
function updateCamera(t: number) {
  const n = CAMERA.length;
  let i = 0;
  while (i < n - 2 && t >= CAMERA[i + 1][0]) i++;
  const k0 = CAMERA[Math.max(0, i - 1)], k1 = CAMERA[i], k2 = CAMERA[i + 1], k3 = CAMERA[Math.min(n - 1, i + 2)];
  const u = clamp((t - k1[0]) / (k2[0] - k1[0]), 0, 1);
  const at = (j: 1 | 2, a: number) => catmull(k0[j][a], k1[j][a], k2[j][a], k3[j][a], u);
  camera.position.set(at(1, 0), at(1, 1), at(1, 2));
  look.set(at(2, 0), at(2, 1), at(2, 2));
  camera.lookAt(look);
}

function updateScene(t: number) {
  updateField(t);
  updateOrb(t);
  updateCamera(t);
}

async function renderFrame(frame: number) {
  updateScene(frame / FPS);
  composer.render();
}
(window as any).renderFrame = renderFrame;
(window as any).ready = document.fonts.ready.then(buildMask);

// ?live plays the timeline in a loop; add &orbit to steer the camera yourself
const params = new URLSearchParams(location.search);
if (params.has('live')) {
  const controls = params.has('orbit') ? new OrbitControls(camera, renderer.domElement) : null;
  if (controls) { updateCamera(BEATS.hold); controls.target.copy(look); }
  const start = performance.now();
  (window as any).ready.then(() => renderer.setAnimationLoop(() => {
    const t = ((performance.now() - start) / 1000) % DURATION;
    updateField(t);
    updateOrb(t);
    if (controls) controls.update(); else updateCamera(t);
    composer.render();
  }));
} else {
  (window as any).ready.then(() => renderFrame(0));
}
