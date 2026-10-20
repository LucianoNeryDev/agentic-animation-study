# Route: Three.js

A Three.js scene in a Vite project. It renders as a web page and is recorded frame by frame through Playwright. The page runs on a **frame clock** you control instead of `requestAnimationFrame`, so frame N always looks the same, however long it takes to render.

## Tools

```bash
node --version           # Node 20+
npx playwright --version # browser automation; see the playwright-cli skill
ffmpeg -version
```

Everything else installs into the project with npm.

## Project layout

```
<slug>/
  BRIEF.md
  package.json  index.html  vite.config.ts
  src/main.ts       # scene setup plus renderFrame(); live playback only when ?live
  src/beats.ts      # the beat sheet as data (times in seconds)
  capture.mjs       # Playwright: opens the page, renders and saves frames
  public/assets/    # glTF models, textures, HDRIs
  previews/  renders/frames/
```

Create it with `npm create vite@latest <slug> -- --template vanilla-ts --no-interactive`, delete the template's `counter.ts`, `style.css` and `assets/`, then `npm i three`, `npm i -D @types/three playwright` and `npx playwright install chromium` (each Playwright version needs its own browser build). Import addons from `three/addons/...` (for example `three/addons/loaders/GLTFLoader.js`).

## The frame clock

`main.ts` exposes one function and does all of its animation inside it:

```ts
const FPS = 30;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(WIDTH, HEIGHT);

async function renderFrame(frame: number) {
  const t = frame / FPS;
  mixer?.setTime(t);              // imported clips
  updateScene(t);                 // keyframes, procedural motion, camera: all as functions of t
  renderer.render(scene, camera);
}
(window as any).renderFrame = renderFrame;
(window as any).ready = loadAssets();   // a promise that resolves when every asset has loaded
```

Everything that moves is a function of `t`. Simulations step at a fixed `dt = 1 / FPS` (more substeps if needed) from frame 0, so jumping to frame N replays steps 0…N, or loads a cached state. Random values come from a seeded generator.

`capture.mjs` launches Chromium at the brief's resolution, opens the dev server (`npx vite --port 5173`) or the built page (`npx vite build && npx vite preview`), awaits `window.ready`, then for each frame calls `renderFrame(i)` and saves the canvas, either with `canvas.toDataURL('image/png')` decoded in Node or with `page.locator('canvas').screenshot()`. Arguments: frame range and output folder.

## Render commands

```bash
node capture.mjs --from 48 --to 48 --out previews       # one still
node capture.mjs --from 40 --to 64 --out previews       # range for a contact sheet
node capture.mjs --out renders/frames                   # every frame
```

Name frames `f_0000.png`, numbered by frame index, so SKILL.md's ffmpeg commands work unchanged.

By default headless Chromium renders WebGL in software (SwiftShader): exact, fine for simple scenes, slow for heavy ones; launch it with `--enable-unsafe-swiftshader` so the context always starts. On a machine with a GPU, launch with `--use-angle=vulkan --enable-gpu` instead; it stays headless. Confirm which one ran by logging `UNMASKED_RENDERER_WEBGL` from the `WEBGL_debug_renderer_info` extension.

**Smoke test:** a spinning cube driven by `t`, captured at frames 0 and 15, giving two different images.

## Doing the methods

- **Keyframes:** a `THREE.AnimationClip` built from `VectorKeyframeTrack`/`QuaternionKeyframeTrack` with times from `beats.ts`, played by an `AnimationMixer`. Alternatively, interpolate between beat values with your own easing functions in `updateScene(t)`.
- **Characters and clips:** load glTF with `GLTFLoader`; each clip in `gltf.animations` plays through `mixer.clipAction(clip)`. Blend with `action.weight` and `crossFadeTo`, and set weights as functions of `t` too.
- **IK:** `CCDIKSolver` from `three/addons/animation/CCDIKSolver.js`, for skinned meshes with an IK chain.
- **Physics:** a deterministic engine stepped at a fixed `dt` (Rapier through `@dimforge/rapier3d-compat` is a common choice).
- **Camera:** a `PerspectiveCamera` whose position and look-at target are curves of `t` (a `CatmullRomCurve3` for dolly paths).
- **Look:** `MeshStandardMaterial`/`MeshPhysicalMaterial` with an HDRI environment (`HDRLoader` + `PMREMGenerator`; `HDRLoader` replaced `RGBELoader` in r180), plus post-processing through `EffectComposer` (bloom, DOF) when the brief wants it.

When the deliverable is the web page itself, keep `renderFrame` and add a live mode that calls it from `renderer.setAnimationLoop`. The capture path then keeps producing the same frames for checking.
