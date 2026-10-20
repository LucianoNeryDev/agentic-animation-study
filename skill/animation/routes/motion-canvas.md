# Route: Motion Canvas

2D animation written as TypeScript generator functions: each `yield*` plays a tween, so the scene file reads like the beat sheet. Two ways to build and render it:

- **Revideo (default):** a maintained fork of Motion Canvas (MIT; 0.11.0 as of 2026-07) with a headless `renderVideo()` API. Scenes are written the same way; imports come from `@revideo/*`.
- **Motion Canvas proper:** use it when the user wants its browser editor or already has a Motion Canvas project. Its last npm release is 3.17.2 (2024-12), and rendering goes through the editor's Render button, so automate it with the playwright-cli skill.

Where the rest of this file says Motion Canvas, it means both.

## Tools

```bash
node --version     # Node 20+
ffmpeg -version    # for frame extraction and contact sheets
```

npm installs everything else into the project: a headless Chrome (through puppeteer) and Revideo's own ffmpeg.

## Project setup (Revideo)

`npm init @revideo@latest` only asks its questions interactively and sends a telemetry event, so copy its template instead:

```bash
d=$(mktemp -d) && (cd "$d" && npm pack @revideo/create@latest && tar xzf revideo-create-*.tgz)
cp -r "$d/package/examples/default" <slug> && rm -rf "$d"
cd <slug> && npm i && npm i -D tsx
# npm 11 holds back install scripts until approved; these four fetch binaries, telemetry stays off
npm install-scripts approve @ffmpeg-installer/linux-x64 @ffprobe-installer/linux-x64 esbuild puppeteer
npm install-scripts deny @revideo/telemetry
npm rebuild
```

Then shape it as:

```
<slug>/
  BRIEF.md
  src/project.tsx       # makeProject({scenes, settings}): size, fps, background
  src/scenes/*.tsx      # one scene per shot or section
  src/beats.ts          # the beat sheet as data (seconds)
  src/render.ts         # renderVideo() wrapper, below
  public/               # images, fonts, audio
  previews/  renders/
```

Set `settings.shared.size` (and `background`) and `settings.rendering.fps` in `project.tsx` to the brief's values. Run every render with `DISABLE_TELEMETRY=true` in the environment to turn off Revideo's anonymous render counting.

## Render commands

The template compiles to CommonJS, so `render.ts` keeps its `await` inside a function:

```ts
// Usage: npx tsx src/render.ts [--from s] [--to s] [--out dir/name.mp4]
import {renderVideo} from '@revideo/renderer';
import {parseArgs} from 'node:util';
import * as path from 'node:path';

const {values: a} = parseArgs({options: {
  from: {type: 'string'}, to: {type: 'string'}, out: {type: 'string', default: 'renders/video.mp4'},
}});

async function main() {
  const file = await renderVideo({
    projectFile: './src/project.tsx',
    settings: {
      outDir: path.dirname(a.out!),
      outFile: path.basename(a.out!) as `${string}.mp4`,
      projectSettings: a.from || a.to ? {range: [Number(a.from ?? 0), a.to ? Number(a.to) : Infinity]} : {},
      workers: 1,
      logProgress: true,
    },
  });
  console.log(`Rendered ${file}`);
}
main();
```

```bash
export DISABLE_TELEMETRY=true
npx tsx src/render.ts --from 0.9 --to 1.6 --out previews/draft.mp4   # a beat (range in seconds)
npx tsx src/render.ts --out renders/<slug>.mp4                       # final, already encoded
```

`renderVideo` writes video, not image sequences, so for SKILL.md step 5, extract frames from the draft:

```bash
ffmpeg -y -i previews/draft.mp4 -vf fps=<fps> -start_number 0 previews/f_%04d.png   # every frame
ffmpeg -y -ss 2.0 -i previews/draft.mp4 -frames:v 1 -update 1 previews/beat_strike.png   # one still
```

The final render is already MP4: skip SKILL.md step 7's encode and run its `ffprobe` check. The video can run one or two frames past the scene's length, whatever `range` says; trim it without re-encoding: `ffmpeg -i full.mp4 -frames:v <frames> -c copy <slug>.mp4`. For transparency, set `background: null` and render to `.webm` or `.mov`.

**Smoke test:** the example scene below, rendered in full, then frames extracted and tiled into a contact sheet. The first render takes about 20 s while Vite bundles dependencies.

## Writing scenes

Coordinates are pixels with the origin at the centre of the canvas, so everything visible lies within ±width/2 and ±height/2 of `settings.shared.size`. Leave room for easings that overshoot, such as `easeOutBack` and `easeOutElastic`.

```tsx
import {makeScene2D, Circle, Line, Txt} from '@revideo/2d';
import {all, createRef, easeOutBack, waitFor} from '@revideo/core';

// Sized for a 640×360 canvas
export default makeScene2D('intro', function* (view) {   // Motion Canvas: makeScene2D(function* (view) {...})
  const ball = createRef<Circle>();
  const line = createRef<Line>();
  view.add(<Line ref={line} points={[[-240, 100], [240, 100]]} stroke="#555" lineWidth={6} end={0} />);
  view.add(<Circle ref={ball} size={80} fill="#e6a700" x={-240} />);
  view.add(<Txt text="title" fill="#eee" fontSize={48} y={-110} />);
  yield* line().end(1, 0.3);                                // draw-on
  yield* ball().x(240, 0.6, easeOutBack);                   // property tween: (target, seconds, easing)
  yield* all(ball().scale(1.4, 0.2), ball().fill('#ff4d4d', 0.2));
  yield* waitFor(0.5);                                      // a hold
});
```

- **Sequencing:** `all()` runs tweens in parallel, `chain()` in order, `sequence(delay, ...)` staggered, `loop(n, fn)` repeated, `waitFor(s)` holds. Keep the time between yields equal to the beat-sheet durations; `waitUntil('event')` names a time for syncing with audio.
- **Motion:** signals let one value follow another (`x={() => other().x() + 50}`), which gives cheap overlap and follow-through. Easing functions come from core (`easeInOutCubic`, `easeOutBack`, `easeOutElastic`, `linear`).
- **Shapes and text:** `Rect`, `Circle`, `Polygon`, `Line` and `Spline` (with `points` and `end` for draw-on), `Path`, `SVG`, `Img`, `Video`, `Audio`, `Txt`, `Latex`, `Code`. `Layout` gives flexbox placement.
- **Stick figures and flat characters:** build a component with joint signals (shoulder, elbow, hip, knee angles). Draw limbs as `Line`s whose points are computed from those angles, then animate the angles. That is forward kinematics; add two-bone IK (law of cosines) in the component when hands or feet must land on a target.
- **Camera:** wrap the scene in a `Node` and animate its position, scale and rotation to pan, zoom and shake. Motion Canvas proper also has a `Camera` node; Revideo does not.
- **One time signal:** for data-driven motion (a choreography file, a simulation), make one signal `const T = createSignal(0)`, write every property as a function of `T()`, and play the scene with `yield* T(duration, duration, linear)`. JSON files import directly (`import data from './fight.json'`).
- **Inputs:** Revideo reads variables passed to `renderVideo({variables})` through `useScene().variables.get('name', default)()`, which turns one scene into a template for batch videos.
