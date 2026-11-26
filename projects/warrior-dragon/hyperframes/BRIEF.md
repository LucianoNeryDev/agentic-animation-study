# HyperFrames route: Warrior vs Dragon as a shadow play

| Field | Value |
| --- | --- |
| Purpose | Third version of the Warrior vs Dragon study, drawn from the same baked choreography as the Godot and Motion Canvas versions ([`../BRIEF.md`](../BRIEF.md)), in a look that differs from both |
| Subject and action | Identical: the warrior walks in, Ashfang drops from the sky, roars and breathes fire on his shield; neck slash, backflip, bite and roll, knee-slide under the blast and chest cut, the plunge, the collapse, the victory pose |
| Dimension and look | 2D. Shadow-puppet theatre on a backlit paper screen, told as a storybook: a warm lamp with a slow seeded flicker, paper grain and panel seams, everything in the action as black silhouettes with cut-out details (shield perforations, belly scales, eye, joint rivets, the blade's fuller), translucent wing membranes, scenery as softer and paler shadows the further it sits from the screen, fire as orange light that brightens the screen behind the puppets, seeded embers, a velvet proscenium, and serif narration as real HTML text, one line per beat |
| Length | 20 s (1200 frames) |
| Aspect, resolution, fps | 16:9, 1920×1080, 60 fps |
| Camera | The baked camera (follow, shake, zoom punch, push-in), scaled to 93 % to fit the proscenium opening (1792×1008 at 64, 36) |
| Sound | Silent |
| Assets | Noto Serif Display Italic and SemiBold Italic (SIL OFL, `assets/fonts/`); GSAP 3.15.0 from npm |
| Deliverable | H.264 MP4, yuv420p, faststart (HyperFrames renders it directly) |

Assumptions: silent; the narration is new copy (eight lines), timed to the beat sheet and to HyperFrames' reading-time check.

## Route and methods

- **Route: HyperFrames 0.9.98.** `index.html` holds the layers, the captions and one paused GSAP timeline on `window.__timelines["main"]`; `play.js` is the drawer. HyperFrames seeks the timeline frame by frame in headless Chrome.
- **No animation logic.** `bake.js` is `../bake.json` wrapped as `window.BAKE`. One linear tween on a plain object (`proxy.t`, 0 → 20 s) calls `draw(t)`, which takes frame `round(t * 60)` and draws that frame's baked shapes, so the poses match the other two versions frame for frame. The camera maps exactly as in `../motion-canvas/src/scenes/fight.tsx` (px space, y down, zoom about the centre), then scales by 1792/1920 into the screen. The fire pool, smoke puffs, sword and claw trails are ported line for line from that drawer.
- **Everything else is a pure function of t with a fixed seed:** lamp flicker and sway (1D value noise over a `mulberry32` table), embers (70 seeded particles on looping paths), scenery (seeded jagged ruins, rubble and a recursive dead tree, built once as `Path2D`).
- **Canvas 2D in four layers.** `#stage` is the light: the lamp gradient (drawn once, shifted by whole pixels), a painted dusk sun, three scenery layers at parallax 0.15, 0.4 and 0.7 (paler and softer with distance; soft edges are translucent strokes clipped to the outside of each shape), the flicker, embers, and the light effects (fire glow and flames in `screen` mode so the orange survives the bright lamp; fire core, trails, roar rings, hit bursts and the victory swell in `lighter`). `#shadows` holds the floor, the two puppets and the dust and smoke. Each puppet is drawn on its own offscreen canvas so its cut-outs (`destination-out`) show the lamp, not the other puppet. `#soft` is a quarter-size copy of the shadows, scaled up by the compositor at 50 % opacity as the puppets' penumbra.
- **HTML and SVG on top:** the paper (`feTurbulence` grain, mottling and fibres plus two seams, `mix-blend-mode: multiply`), the proscenium (SVG built once: carved frame, velvet valance with gold fringe, tied-back curtains), and the captions (Noto Serif Display Italic with a gold drop letter, faded in and out by GSAP tweens on the same timeline).

## Beat sheet

| Time | What happens | Narration |
| --- | --- | --- |
| 0.0–2.4 s | The warrior walks in past the ruins and stops in guard | 0.10 s "At dusk, a lone warrior came to the ruins…" |
| 2.4–3.2 s | He looks up and raises the shield (the dragon's ground shadow is still off screen, as in the other versions) | |
| 3.2–4.3 s | Ashfang drops in, wings translucent against the lamp, and lands: dust, heavy shake | 2.80 s "…and Ashfang fell from the sky." |
| 4.3–5.5 s | Roar: rings of light ripple from the jaws | 4.80 s "It roared, and breathed fire on his shield." |
| 5.5–7.6 s | Fire breath on the shield: the screen behind them glows orange; the shield's holes show the light | |
| 7.6–8.1 s | Smoke; the warrior crouches | 7.70 s "He leapt, and cut its neck." |
| 8.1–9.7 s | Leap under the reared head; neck slash with a burst of light and a streak behind the blade; hit-stop | |
| 9.7–13.0 s | Backflip over the claw swipe; bite into the shield; roll and recovery | 9.75 s "Claw and fang came for him; he rose again." |
| 13.0–14.6 s | Blast; the knee-slide under the stream; chest cut | 13.00 s "He slid beneath the fire." |
| 14.6–16.6 s | The dragon staggers; leap, flip, plunge; the lamp flares | 14.80 s "Then he leapt high, and drove his sword home." |
| 16.6–18.6 s | Collapse, dust | 17.85 s "And the valley was free." (held to the end) |
| 18.7–20.0 s | Victory pose; the lamp swells behind the warrior | |

## Commands

```bash
cd .. && python3 choreo.py bake && node -e "const fs=require('fs');fs.writeFileSync('hyperframes/bake.js','window.BAKE='+fs.readFileSync('bake.json','utf8')+';\n')" && cd hyperframes
npm ci
export HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1
npx hyperframes check                                                  # lint, runtime, layout, motion, contrast
npx hyperframes snapshot --at 0,1.2,2.8,3.75,4.9,6.5,7.85,9.17,10.35,12,13.9,14.43,15.6,16.53,17.6,19.98
npx hyperframes render --quiet -w 1 --start 13 --end 15 -o previews/draft.mp4
npx hyperframes render --quiet -w 1 -o renders/warrior-dragon-hyperframes.mp4   # final
```

`bake.js` (5.3 MB) is generated and gitignored, like the other copies of `bake.json`.

## Fixes made after looking at frames

| Problem seen in frames | Cause, measured | Fix |
| --- | --- | --- |
| Horizontal scan lines across the whole screen (6.5 s) | The paper's fibre noise (`baseFrequency` 0.0015 × 0.32) multiplied in at a gain of 0.16 | Gain 0.06 |
| Fire was a cream-white blob, not orange light (6.5 s) | Additive `lighter` on a lamp already at about #f7c47c clips every channel to white | Fire glows in `screen` mode, darker lamp mid-tones, more saturated flame colours, stronger wide glow |
| Smoke and dust were hard grey balls (8.9, 9.17 s) | Solid translucent discs | Radial-gradient puffs with soft edges |
| A dead tree stood right behind the shield and the fire (6.5 s) | Near-layer tree at local x −420 lands mid-screen once the camera reaches x ≈ 0.4 | Moved to x −1320: seen only during the walk-in |
| The pale sun sat on the keep's tower like a lit window (1.2, 3.75 s) | Both near screen x 1500 | Sun moved to the upper left |
| A 60-frame range took 13.2 s of capture (220 ms a frame) | In-page profile: each scaled 4300 px scenery bitmap cost about 20 ms in Chrome's software canvas, the per-frame lamp gradient 19 ms | Vector `Path2D` scenery (12.9 ms for all three layers), cached lamp shifted by whole pixels, penumbra scaled by the compositor: `draw()` 174 → 32 ms; the final capture ran at 90 ms a frame |
| `check` flagged seven captions as too short to read | Its rule: about 0.5 s + 0.3 s a word, closing line at least 2 s | Fewer, shorter lines (eight); the last line starts at 17.85 s |

## Measured

Taken on the shared test machine while other agents were rendering (load average about 12 on four cores, I/O pressure about 20 %).

| | |
| --- | --- |
| Output (`ffprobe`) | H.264 High, yuv420p, 1920×1080, 60/1 fps, **1200 frames**, 20.000 s, `moov` before `mdat` (faststart), 24.4 MB |
| Full render, 1 worker | HyperFrames' own count: **2 min 12 s** (setup 23.1 s, capture 1 min 47.8 s with encoding during capture). Bash wall clock 579 s, of which about 7 min was spent queued behind two other renders: HyperFrames allows one render per user account |
| Determinism | Two `--format png-sequence` renders of 13–14 s: all 60 PNGs byte-identical (sha256), 60 distinct frames |
| `hyperframes check` | Passed, 0 errors. Warnings: `film_silent` (silent by brief) and `timeline_track_too_dense` (13 timed elements) |
