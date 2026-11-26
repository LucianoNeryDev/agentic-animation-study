# 8. Reproducing the study

Every project in [`projects/`](../projects/) rebuilds from source. Generated output (`previews/`, `renders/`, `.blend`, `bake.json`, `node_modules/`) is not committed; the finished videos are in [`media/`](../media/).

## Tools

| Tool | Tested version | Used by |
| --- | --- | --- |
| Blender | 5.2.2 LTS | `smoke/blender`, `showcase/blender`, `showcase-2d/grease-pencil`, `grease-pencil-probes` |
| Godot (standard) | 4.7.2 | `*/godot` |
| Node.js | 20+ (tested 26.8.1); 22+ for HyperFrames | `*/motion-canvas`, `*/threejs`, `*/hyperframes*` |
| Python | 3.11+ (tested 3.13); Pillow for previews | `fight.py`, `choreo.py` |
| ffmpeg | 7.x | encoding and contact sheets everywhere |

Install Blender and Godot from their official downloads into user space and put them on `PATH` as `blender` and `godot`. On a headless Linux machine, run Godot under `xvfb-run -a`: Movie Maker needs a real renderer.

## Node projects (Motion Canvas via Revideo, Three.js, HyperFrames)

```bash
cd projects/<study>/<motion-canvas|threejs>
npm ci
# Revideo projects only: npm 11 holds back install scripts
npm install-scripts approve @ffmpeg-installer/linux-x64 @ffprobe-installer/linux-x64 esbuild puppeteer
npm install-scripts deny @revideo/telemetry
npm rebuild
# Three.js projects only
npx playwright install chromium
# HyperFrames projects: nothing more; the first render downloads its own Chrome. Turn telemetry off:
export HYPERFRAMES_NO_TELEMETRY=1
```

## Per project

Each project's `BRIEF.md` has its full command list. The short version:

| Project | Build and render |
| --- | --- |
| `smoke/blender` | `blender -b --python-exit-code 1 -P build.py && blender -b scene.blend -P gpu.py -o //renders/frames/f_#### -F PNG -a` |
| `smoke/godot` | `godot --path . --write-movie previews/f.png --fixed-fps 30 --quit-after 30` |
| `smoke/threejs` | `npx vite --port 5173 &` then `node capture.mjs --from 0 --to 29 --out previews` |
| `smoke/motion-canvas` | `DISABLE_TELEMETRY=true npx tsx src/render.ts --out previews/draft.mp4` |
| `smoke/hyperframes` | `npx hyperframes check && npx hyperframes render --quiet -w 1 -o renders/smoke.mp4` |
| `showcase/blender` | `blender -b --python-exit-code 1 -P build.py` (builds and bakes the simulation), then `blender -b scene.blend -P gpu.py -o //renders/frames/f_#### -F PNG -a` |
| `showcase/godot` | `godot --path . --write-movie renders/frames/f.png --fixed-fps 60 --quit-after 429` |
| `showcase/threejs` | `npx vite --port 5173 &` then `node capture.mjs --out renders/frames` |
| `showcase/motion-canvas` | `DISABLE_TELEMETRY=true npx tsx src/render.ts --out renders/loop.mp4`; `../finish.sh` re-measures Blender's cost into the chart |
| `showcase/hyperframes-reel` | `npx hyperframes render --quiet -w 1 -o renders/reel.mp4` |
| `showcase/hyperframes` (the Loop port) | `npx hyperframes render --quiet -w 1 -o renders/loop.mp4` |
| `showcase-2d` | `python3 fight.py json`, then see its `BRIEF.md` for Grease Pencil, Motion Canvas and Godot, and `hyperframes/BRIEF.md` (regenerate `fight.js`, run `node verify-sampler.cjs`, then render) |
| `warrior-dragon` | `python3 choreo.py bake && cp bake.json motion-canvas/src/ && cp bake.json godot/`, then render `godot/` and `motion-canvas/` per its `BRIEF.md`; for `hyperframes/`, wrap the bake as `bake.js` with the command in its `BRIEF.md` |

Encode frame sequences with:

```bash
ffmpeg -y -framerate <fps> -start_number <first> -i renders/frames/<pattern> \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart renders/<name>.mp4
```

## Checking frames

[`tools/grid.sh`](../tools/grid.sh) tiles chosen frames into one labelled sheet, which is how most images in these docs were made:

```bash
tools/grid.sh 'projects/warrior-dragon/godot/previews/f%08d.png' sheet.png 4 60 300 553 1010
```

## Determinism

Every route here produces the same frames on every run: Blender bakes its simulation; Godot's Movie Maker uses a fixed time step with fixed-seed particles (two Godot recordings compared byte-identical); Three.js renders from a frame clock; Motion Canvas renders from a time signal; HyperFrames seeks a paused timeline, so each frame is a function of its time; `choreo.py` seeds its shake and simulates the cloth at a fixed step.

Byte for byte is a stricter test. Godot recordings and Revideo renders matched exactly. HyperFrames PNG sequences matched exactly in the Loop port, the Reel and Warrior vs Dragon, but its MP4s, and the 2D fight's animated caption letters, differed by a few levels around moving edges: invisible, but enough to change a hash ([docs/09](09-hyperframes.md#determinism)).
