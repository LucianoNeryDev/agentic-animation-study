# HyperFrames route: the stick fight as a sports-broadcast replay

| Field | Value |
| --- | --- |
| Purpose | Fourth route of the 2D study: the same 4.5 s stick fight as [`../BRIEF.md`](../BRIEF.md), in a look that shows what HTML and CSS are good at |
| Subject and action | Identical choreography: Blue's jab lands on Red's block; Red's kick whiffs over Blue's duck; Blue's uppercut launches Red, who lands, bounces and slides; K.O. |
| Dimension and look | 2D. A live sports-broadcast replay: "REPLAY" stinger, scoreboard bug, lower-third name straps, kinetic captions for the calls, a "SUPER SLO-MO" tag over the hit-stops, a telestrator that draws on the uppercut, arena lighting from CSS gradients and blend modes. Fighters stay blue and red stick figures |
| Length | 4.5 s (270 frames) |
| Aspect, resolution, fps | 16:9, 1920×1080, 60 fps |
| Camera | The shared eased pan (`VIEW.pan` in `fight.py`), plus the Motion Canvas route's seeded shake on hits and a 1 → 1.14 replay zoom on the uppercut, centred on the fist |
| Sound | Silent |
| Assets | Noto Sans Bold, Noto Sans Condensed Bold, Black and Black Italic, Noto Sans Display ExtraCondensed Black Italic (SIL OFL, `assets/fonts/`); GSAP 3.15.0 from npm |
| Deliverable | H.264 MP4, yuv420p (HyperFrames renders it directly) |

## Route and methods

- **Route: HyperFrames 0.9.98.** One `index.html`, one paused GSAP timeline on `window.__timelines["main"]`, seeked frame by frame in headless Chrome.
- **Same poses as the other routes.** `fight.js` is `../fight.json` wrapped as a global; `sampler.js` is a line-for-line JavaScript port of `fight.py`'s sampler (eases, key interpolation, two-bone IK, camera pan). `node verify-sampler.cjs` loads both files the way the page does and compares every joint of both fighters and the camera on all 270 frames against `fight.py`: the largest difference is 1e-15.
- **The fight layer is a pure function of time.** One tween on a plain object (`clock.t`, 0 → 4.5 s, linear) calls `draw(t)`, which writes the SVG polylines, heads, shadows, trails, impact rings, dust, the pan, the parallax layers, the clock and the strike counter. Shake is seeded by frame number; crowd flashes and the telestrator's wobble come from a seeded PRNG.
- **Broadcast graphics are HTML and CSS,** animated by GSAP tweens on the same timeline: the scoreboard bug is a flex row with tabular numerals (the clock runs down in real time and stops on the K.O.); the straps wipe in with `clip-path: inset()`; captions are split into letter spans that drop in with a stagger, and their highlight boxes wipe in behind them; "UPPERCUT!" and "K.O." use `background-clip: text` gradients.
- **Telestrator** strokes are SVG paths in world space (so they stay on the action while the camera pans), drawn on by tweening `stroke-dashoffset`, with a pen dot riding the tip via `getPointAtLength`. The loop circles the fist and chin at the moment of contact; the arc is traced from Red's hip path in the sampler, so it leads him to an X where he lands.
- **Arena lighting:** stacked CSS gradients for wall, crowd and mat; spotlight cones and a light pool composited with `mix-blend-mode: screen`; a multiply vignette; a screen-blended radial flash on the uppercut. The wall, LED board and far ropes are parallax layers at 0.35, 0.6 and 0.85 of the pan.

## Beat sheet

| Time | What happens | Graphics |
| --- | --- | --- |
| 0.00–0.50 s | Both in guard | "REPLAY" stinger covers the first frames, then its three bands wipe off; bug and REPLAY tag slide in; name straps wipe in at 0.32 s |
| 0.68–0.94 s | Blue winds back and lunges; jab on the block at 0.84 s; hit-stop to 0.94 s | "JAB — BLOCKED"; SUPER SLO-MO tag over the hit-stop |
| 0.94–1.62 s | Red pushed back, steps in with a high kick at 1.47 s; Blue ducks | Straps wipe out at 1.16 s; "KICK — DUCKED" |
| 1.62–2.02 s | Blue loads and uppercuts at 1.86 s; hit-stop to 2.02 s | Flash, replay zoom, "UPPERCUT!", SLO-MO tag, Blue's strike count 14 → 15, telestrator loop round the contact |
| 2.02–3.30 s | Red flies, lands at 2.82 s, bounces and slides; dust | Telestrator arc leads Red to an X on the mat; marks fade before the K.O. |
| 3.12–4.50 s | K.O.; Blue's victory pose and hop; Red twitches | "K.O." slams in, the bug's clock freezes at 1:05 and turns gold, crowd camera flashes, "BLUE WINS BY K.O." strap from 3.52 s |

## Commands

```bash
python3 ../fight.py json                         # run in .. after any change to fight.py
node -e "const f=require('fs');f.writeFileSync('fight.js','// Generated from ../fight.json; do not edit.\nwindow.FIGHT = '+f.readFileSync('../fight.json','utf8').trim()+';\n')"
node verify-sampler.cjs                          # parity with fight.py on all 270 frames (also catches a stale fight.js)
npm ci
export HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1
npx hyperframes check                            # lint, runtime, layout, motion, contrast
npx hyperframes snapshot --at 0.6,0.86,1.47,1.9,2.5,2.9,3.3,4.4
npx hyperframes render --quiet -w 1 --start 1.5 --end 2.5 -o previews/draft.mp4
npx hyperframes render --quiet -w 1 -o renders/fight-hyperframes.mp4
```

`fight.js` (10 KB) is committed, so the page opens without a build step.

## Measured

On the [test machine](../../../README.md#test-machine) while other agents' renders shared the CPU and disk (load average 13–20, disk I/O pressure 6–54 %), so these are upper bounds, not the route's quiet-machine cost.

| Run | Wall time | Frames |
| --- | --- | --- |
| Final MP4, `-w 1` | 149 s (an earlier run of the same scene: 182 s) | 270 at 60 fps, 4.500 s, H.264 yuv420p |
| PNG sequence, whole clip | 199 s | 270 |
| PNG sequence, 1.5–2.5 s | 80–204 s per run (six runs) | 60 |

- **Pose parity:** `node verify-sampler.cjs` → max |JS − Python| = 1e-15 over 270 frames, both fighters, 13 joints each, plus the camera pan. Blue's front hand at 1.86 s is (0.859992, 1.541583) in both; Red's head at 2.40 s is (2.638059, 1.966454) in both.
- **Determinism:** two `--format png-sequence` renders of 1.5–2.5 s (60 frames) are **not** byte-identical: 7–11 frames differ across three pairs. Every difference sits inside the box of one kinetic-caption letter while it animates (a few hundred pixels, up to 56–242 levels at anti-aliased edges, invisible side by side), plus one or two frames with ≤ 2-level noise. The same range with the captions hidden (`.call { display: none }`) was byte-identical on all 60 frames. Swapping the captions' blurred shadows for hard ones, and `gsap.config({ force3D: false })`, did not remove it.
- `hyperframes check`: 0 errors. Remaining warnings are deliberate: craft `line_unread` (a 4.5 s replay holds straps and calls for 0.2–0.9 s), `text_below_floor` for the bug's 20 px "RD 3", arena layers wider than the canvas for shake and parallax, contrast on the stinger while its bands cross, and the single-file size.

## Fixed after looking

| Problem | Cause, measured | Fix |
| --- | --- | --- |
| "UPPERCUT!" rendered as a dark smudge with one gold letter | `background-clip: text` on the word did not reach letter spans that carry their own transforms | Gradient and clip moved onto each letter span |
| "BLOCKED" fully visible for a frame, then its letters dropped in again | Letter tweens used `immediateRender: false`, so letters later in the stagger showed their natural state before their start | Letters and highlight box start in their "before" state |
| "KIC" ghosted behind "UPPERCUT!" on frame 112 | The kick caption's exit ended at 1.88 s, after the uppercut call began at 1.86 s | Kick caption leaves 0.18 s before the hit |
| Telestrator arrow ended 0.95 units above Red's landing | The arc was the hip path lifted by a constant 0.95 | Lift eases from 0.95 to 0.4 along the path, so the arrow points at the X |
| A navy wedge of the stinger still covered the right edge at 0.5 s | Bands slid 75 % of a 170 % wide skewed panel, short of the frame | Bands travel 110 % and the stinger hides at 0.52 s |
| K.O. slab cropped the letters while it wiped in | The text sat inside the clipped slab | Slab is its own element scaled in behind the text |
| Uppercut flash washed out the whole centre | Peak 0.85 opacity, 80 % radius | 0.6 peak with a squared fade, 60 % radius |
| `hyperframes check` errors: straps "start hidden" with no reveal in the tween's destination (cold-seek), template-literal `querySelector`, LED board and mat logo flagged as occluded or low-contrast text | Straps hidden with `autoAlpha` and revealed only in from-vars; texture text treated as reading text | Straps start clipped instead of hidden; plain string selectors; `data-layout-ignore` on texture text |
| LED board text competed with the fighters' legs | Board text at 0.8 opacity | 0.45 |
