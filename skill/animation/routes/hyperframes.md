# Route: HyperFrames

Video written as a web page: HTML and CSS for layout, type and UI, SVG or `<canvas>` for drawing, real `<video>` footage, and one paused GSAP timeline for time. HyperFrames (Apache-2.0, by HeyGen; 0.9.98 as of 2026-11) seeks that timeline to each frame in headless Chrome and encodes with FFmpeg. Pick it for web-native 2D video: product and UI videos, kinetic type and captions, footage edits, explainers, broadcast-style overlays.

## Tools

```bash
node --version     # Node 22+
ffmpeg -version    # HyperFrames uses the system FFmpeg
```

npm installs the CLI and GSAP into the project. The first render downloads its own `chrome-headless-shell` (about 300 MB, cached in `~/.cache/hyperframes`). `npx hyperframes doctor` lists what is missing.

## Project setup

`npx hyperframes init` asks questions, offers to install HeyGen's agent skills, writes `AGENTS.md` and `CLAUDE.md` into the project, loads GSAP from a CDN and pins `npx --yes hyperframes@<version>` in its npm scripts. Write the few files by hand instead, so the project renders offline from a pinned local install:

```bash
mkdir -p <slug>/assets/fonts && cd <slug>
cat > package.json <<'EOF'
{
  "name": "<slug>",
  "private": true,
  "type": "module",
  "devDependencies": { "gsap": "3.15.0", "hyperframes": "0.9.98" }
}
EOF
cat > hyperframes.json <<'EOF'
{ "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json", "paths": { "assets": "assets" }, "media": { "autoProxy": false } }
EOF
echo '{ "id": "<slug>", "name": "<title>" }' > meta.json
npm install
cp /usr/share/fonts/truetype/noto/NotoSans-{Regular,Bold}.ttf assets/fonts/   # or any font the look needs, with its licence
```

Layout:

```
<slug>/
  BRIEF.md
  package.json  hyperframes.json  meta.json
  index.html        # the composition: markup, styles, the timeline
  *.js              # optional plain scripts: drawing code, data as a global (window.DATA = ...)
  assets/fonts/  assets/footage/
  previews/  renders/          # .hyperframes/ holds check reports and snapshots
```

Set every command's environment first: **telemetry is on by default.**

```bash
export HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1
```

## Writing the composition

```html
<!doctype html>
<html lang="en"><head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=640, height=360" />
  <script src="node_modules/gsap/dist/gsap.min.js"></script>
  <style>
    @font-face { font-family: "Noto Sans"; src: url("assets/fonts/NotoSans-Bold.ttf"); }
    html, body { margin: 0; width: 640px; height: 360px; overflow: hidden; }
    #root { width: 100%; height: 100%; background: #202028; }   /* on the root: PNG frames drop the page's own background */
    svg { display: block; font-family: "Noto Sans", sans-serif; }
  </style>
</head><body>
  <div id="root" data-composition-id="main" data-start="0" data-duration="1.6"
       data-fps="30" data-width="640" data-height="360">
    <!-- viewBox centred on 0,0, like Motion Canvas; y points down -->
    <svg id="stage" class="clip" data-start="0" data-duration="1.6" data-track-index="0"
         width="640" height="360" viewBox="-320 -180 640 360">
      <line id="line" x1="-240" y1="100" x2="240" y2="100" stroke="#555" stroke-width="6" pathLength="1" stroke-dasharray="0 1" />
      <circle id="ball" cx="-240" cy="0" r="40" fill="#e6a700" />
      <text x="0" y="-110" fill="#eee" font-size="48" text-anchor="middle" dominant-baseline="central">smoke</text>
    </svg>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } });
    tl.to("#line", { attr: { "stroke-dasharray": "1 1" }, duration: 0.3 }, 0);          // draw-on
    tl.to("#ball", { attr: { cx: 240 }, duration: 0.6, ease: "back.out(1.70158)" }, 0.3);
    tl.to("#ball", { attr: { r: 56 }, fill: "#ff4d4d", duration: 0.2 }, 0.9);           // grow by radius, not scale
    tl.to({}, { duration: 0.5 }, 1.1);                                                  // a hold
    window.__timelines = window.__timelines || {};
    window.__timelines["main"] = tl;
    tl.seek(0);
  </script>
</body></html>
```

- **The contract.** The root element carries `data-composition-id`, `data-start`, `data-duration`, `data-fps`, `data-width`, `data-height`. Timed elements carry `class="clip"`, an `id`, `data-start`, `data-duration` and `data-track-index`. Register one **paused** root timeline on `window.__timelines`; child timelines added to it must not be paused, or they never advance.
- **Every frame is a function of time.** HyperFrames seeks in any order, and parallel workers each take a slice. No `Date.now()`, `Math.random()` (use a seeded PRNG), `requestAnimationFrame`, timers or network fetches. Anything computed (typed text, counters, a dot riding a path, a whole drawn frame) is a tween on a plain object whose `onUpdate` writes the DOM: GSAP fires `onUpdate` on every seek, so any frame renders alone.
- **Baked data.** For choreography baked per frame (as in the Warrior vs Dragon study), load it as a script that sets a global, and drive one tween over the whole length: `tl.to(p, {f: N - 1, duration: N / fps, ease: "none", onUpdate: () => draw(Math.round(p.f))}, 0)`. `<canvas>` 2D is fastest for many shapes; in Chrome's software renderer, drawing a scaled image costs about ten times an unscaled one, so draw scenery as paths or cache it at final size.
- **Motion Canvas habits translate directly.** A `viewBox` centred on 0,0 keeps Motion Canvas coordinates. Eases map as `easeInOutCubic` → `power2.inOut` (Motion Canvas's default), `easeOutCubic` → `power2.out`, `easeOutBack` → `back.out(1.70158)`, `linear` → `"none"`. A `yield*` sequence becomes absolute times on the timeline: write the checkpoints in comments.
- **Background on the root element.** PNG-sequence renders are RGBA and leave out the `html`/`body` background (the MP4 keeps it), so contact sheets come out on white. Paint the background on the composition root or a full-frame element inside it.
- **SVG transform origins are fixed when set.** GSAP works out `transformOrigin` from the element's box at the moment it is set; move the element later with `cx`/`x` attributes and a `scale` still pivots around the old spot. Scale things that move by their own attributes (`r`, `width`), or move them with GSAP's `x`/`y` instead of attributes, or nest them in a `<g>` that carries the position.
- **Text.** Bundle fonts with `@font-face`; system fonts make renders machine-dependent. Measure text inside the update that uses it, never once at load: a frame can be seeked before the font arrives.
- **Footage.** A video is a timed `<video class="clip" muted playsinline data-start data-duration data-media-start>`. The file must be inside the project (a symlink works); `../` paths fail `check`. HyperFrames forces an active clip's opacity to 1, so fade its wrapper. Before capture it decodes every clip into JPEG frames (cached under `$TMPDIR`), even for a short range render, so cut long sources down to the excerpts used.
- **Seek-safe reveals.** Give every element that appears later an explicit start state (`gsap.set` or an attribute), or a render that starts mid-clip shows it early. `check` flags most of these.

## Render commands

```bash
npx hyperframes check                                        # lint, runtime errors, layout overlap, motion, contrast: 0 errors before rendering
npx hyperframes snapshot --at 0.15,0.6,1.0,1.6               # PNG stills + contact-sheet.jpg in .hyperframes/artifacts/snapshots/<id>/
npx hyperframes render --quiet -w 1 --start 0.9 --end 1.6 -o previews/draft.mp4                     # a beat
npx hyperframes render --quiet -w 1 --start 0.9 --end 1.6 --format png-sequence -o previews/frames  # its frames
npx hyperframes render --quiet -w 1 -o renders/<slug>.mp4                                           # final, already encoded
```

- **Look step.** `snapshot` replaces SKILL.md step 5.1: one command, stills at the beat-sheet times plus a labelled contact sheet; open them. For step 5.2, render the range as a PNG sequence. Its files are numbered from `frame_000001` whatever `--start` is, so in SKILL.md's tile command read them with `-i previews/frames/frame_%06d.png -start_number 1` and keep the range's first frame number in the label (`%{eif\:n+<first>\:d}`).
- **Workers.** `-w 1` is the dependable setting on a small or disk-bound machine; extra workers each launch a Chrome. HyperFrames runs one render per user account at a time and queues the rest, so a wall-clock time can include waiting.
- **Cost.** Each command spends about 12 s starting up (CLI, pre-render lint, Chrome) before the first frame, and a 1080p frame costs about 50–90 ms of capture without footage, more with several video layers or blurs. Check with `snapshot`, preview with short ranges, render in full once.
- **Determinism.** Frames are seeked, so they match to the eye on every run. PNG sequences are usually byte-identical too (not with per-letter caption animation, whose edges drift invisibly); MP4 renders capture JPEGs through Chrome's BeginFrame path and can differ by a few levels around moving anti-aliased edges. Compare PNG sequences when a fix must be proved byte for byte. `render --docker` exists for strictly reproducible renders.
- The final render is already MP4 (`-q delivery` for a higher bitrate; `--format webm|mov` for alpha): skip SKILL.md step 7's encode, add `+faststart` with `ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4`, and run its `ffprobe` check.

**Smoke test:** the example above, saved as `index.html`: `check`, a `snapshot`, the full render (48 frames at 30 fps) and the 0.9–1.6 s range as PNGs tiled into a contact sheet.
