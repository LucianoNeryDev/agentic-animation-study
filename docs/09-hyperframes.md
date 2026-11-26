# 9. HyperFrames

HyperFrames is HeyGen's open-source framework for turning HTML, CSS, JavaScript and seekable animations into video. It appeared after the original selection, so in November 2026 it went through every round the first four routes went through: the smoke test, a showcase scene built around its strengths, the shared 2D stick fight and Warrior vs Dragon from the same baked choreography. A beat-for-beat port of the Motion Canvas showcase was added as a head-to-head. It passed, and the `/animation` skill now has it as a fifth route ([ADR 0005](adr/0005-hyperframes-fifth-route.md), [route guide](../skill/animation/routes/hyperframes.md)).

## Every round

| Round | HyperFrames video | Compare with | Write-up |
| --- | --- | --- | --- |
| Smoke test: a ball, a line, a title | [contact sheet](images/smoke-hyperframes-sheet.jpg) | the other routes' sheets | [docs/03](03-toolchain-and-smoke-tests.md#hyperframes) |
| Showcase: "Reel", a browser page playing the study's own clips | [Reel](../media/showcase-hyperframes-reel.mp4) | [Collapse](../media/showcase-blender-collapse.mp4) · [Arena](../media/showcase-godot-arena.mp4) · [Field](../media/showcase-threejs-field.mp4) · [Loop](../media/showcase-motion-canvas-loop.mp4) | [docs/04](04-four-route-showcase.md#hyperframes-reel) |
| Head-to-head: the Motion Canvas "Loop" scene, rebuilt beat for beat | [Loop in HyperFrames](../media/showcase-hyperframes-loop.mp4) | [side by side with Motion Canvas](../media/showcase-loop-compare.mp4) | [below](#head-to-head-the-loop-scene) |
| 2D: the shared stick fight, as a TV sports replay | [2D fight](../media/2d-fight-hyperframes.mp4) | [all four 2D routes in one grid](../media/2d-fight-compare.mp4) | [docs/05](05-2d-routes.md) |
| Warrior vs Dragon, as a shadow-puppet storybook | [Warrior vs Dragon](../media/warrior-dragon-hyperframes.mp4) | [Godot, Motion Canvas and HyperFrames side by side](../media/warrior-dragon-compare.mp4) | [docs/06](06-warrior-vs-dragon.md) |

Every video of the study, by round and route, is in [docs/10](10-compare.md).

## What it is

| | |
| --- | --- |
| Version tested | `hyperframes` 0.9.98 (npm, 2026-11-26), GSAP 3.15.0, its bundled `chrome-headless-shell` 158, system FFmpeg 7.1 |
| Licence | Apache-2.0. No company licence, unlike Remotion |
| Activity | Repository created 2026-03-10, about 90,000 GitHub stars, releases most days. Still pre-1.0 |
| Scene format | One HTML file per composition. Timed elements carry `data-start` and `data-duration`; one paused GSAP timeline per composition is registered on `window.__timelines` |
| Render | `hyperframes render` seeks the timeline frame by frame in headless Chrome and encodes with FFmpeg. Also WebM and MOV with alpha, GIF, HLS and PNG sequences |
| Install | Node 22+, FFmpeg. About 145 MB of `node_modules` per project plus about 300 MB of cached Chrome |
| Around it | A desktop editor (HyperFrames Studio), cloud and AWS Lambda rendering, paid templates and media models (Pro), and agent skills installed with `npx skills add heygen-com/hyperframes`. The study used none of them: only the open-source CLI, without HeyGen's skills, so the test is what an agent does with this study's own route guide |

## The four requirements

| Requirement | Result |
| --- | --- |
| Plain-text scenes | **Yes.** HTML, SVG, canvas, CSS and GSAP: the web stack the models know best |
| Headless render | **Yes.** `npx hyperframes render` with no window. It downloads its own headless Chrome and falls back to software rendering when there is no usable GPU, as on the GTX 745 here |
| Deterministic frames | **To the eye, yes; byte for byte, mostly.** See [determinism](#determinism) |
| Single-frame renders | **Yes, and more.** `snapshot --at 1,3,5` writes PNGs and a numbered contact sheet; `render --start --end` renders a range |

It also ships the [Look step](02-animation-skill.md#the-look-step) as commands. `hyperframes check` runs lint, a runtime check in Chrome, layout overlap, motion, contrast and craft rules (such as reading time per caption) in one gate; `snapshot` builds the contact sheet. In this study `check` caught real problems before anything rendered: the route guide's own first example grew a ball 168 px off-screen, footage referenced from outside the project, elements that would have shown early in a render started mid-clip, DOM measurement inside a seek callback, and captions too short to read.

## Head-to-head: the Loop scene

[![Motion Canvas (Revideo) and HyperFrames, side by side](images/showcase-loop-compare.jpg)](../media/showcase-loop-compare.mp4)

*Side by side at 4.85 s: [video](../media/showcase-loop-compare.mp4). The HyperFrames render alone: [showcase-hyperframes-loop.mp4](../media/showcase-hyperframes-loop.mp4). Source and brief: [`projects/showcase/hyperframes/`](../projects/showcase/hyperframes/).*

The Motion Canvas showcase scene ("Four engines, one loop", 10.72 s at 60 fps) was rebuilt in HyperFrames with the same coordinates, the same beat times and matching eases, so the two renderers could be compared on identical content. The port is one 230-line `index.html`; the original `loop.tsx` is 164 lines. It passed `check` on its first run, and the first contact sheet already matched the beat sheet. The only slip, the diagram sitting 10 px high, showed up in the side-by-side video.

## Render cost

Wall clock on the [test machine](../README.md#test-machine) for full 1920×1080, 60 fps renders, each started from the command line, so startup is included. HyperFrames ran with one worker. The renders ran one after another, each started only once the disk was quiet (I/O pressure under 12 %), all with Node 26.

| Scene | Frames | Motion Canvas (Revideo) | HyperFrames | HyperFrames ÷ Revideo |
| --- | --- | --- | --- | --- |
| Loop (same scene in both) | 644 | 16.8–18.8 s (≈ 0.027 s per frame) | 33.1–43.6 s (≈ 0.05–0.07 s) | ≈ 2–2.3× |
| 2D stick fight | 270 | 13.3 s (≈ 0.049 s) | 32.7 s (≈ 0.12 s) | ≈ 2.5× |
| Warrior vs Dragon | 1200 | 44.3 s (≈ 0.037 s) | 107.7–113.5 s (≈ 0.09 s) | ≈ 2.5× |
| Reel (seven video layers, blurs) | 540 | | 100.1 s (≈ 0.19 s) | |

The ranges are separate runs. A first round with CI jobs holding about three CPU cores came out 1.3–2.8 times slower for both renderers (for example, Loop 29.5 s against 61.8 s); the table keeps the runs without them. The 2D fight and Warrior vs Dragon also have different looks in each route, so those rows compare routes, not renderers; only the Loop row is the same content in both.

- **A large fixed cost per command.** Each HyperFrames command spends about 12 s on CLI startup, the pre-render lint and Chrome launch before the first frame. Rendering one second of the Loop (60 frames) took 19.5 s, of which the pipeline itself was about 7 s (frame capture 4.8 s, so ≈ 80 ms per frame, and encoding 1.4 s). Revideo starts in about 4 s, so short previews are where the gap hurts the agent's loop most; `snapshot` is the cheap way to look.
- **Footage and blurs cost more.** The Reel plays seven video layers under `backdrop-filter` blurs; before capture HyperFrames decodes every clip to JPEG frames (1,654 frames, about 120 MB, 2–8 s).
- **Extra workers didn't help here.** Each worker launches a Chrome; on this four-core, HDD-bound machine `-w auto` was faster once and slower once on the Loop, so one worker is the dependable setting. HyperFrames also runs only one render per user account at a time and queues the rest.

## Determinism

HyperFrames seeks a paused timeline, so frame N depends only on N. Measured on two renders of the same range:

| Scene | PNG sequence | MP4 |
| --- | --- | --- |
| Smoke test | identical | identical |
| Loop port | identical (180 frames) | 351 of 644 frames differ, 62 dB PSNR on average, 54 dB at worst |
| Reel | identical (60 frames) | not compared |
| 2D fight | 7–11 of 60 frames differ, inside animated caption letters only; identical with the captions hidden | not compared |
| Warrior vs Dragon | identical (60 frames) | not compared |

- **The MP4 path** captures JPEGs through Chrome's BeginFrame; in the Loop, 12 of 60 JPEG captures differed between runs, all within a 16×15 px patch around the moving token, by at most 3 levels per channel. Removing the token's glow filter did not make it exact.
- **The 2D fight's captions** animate each letter with transforms and a clipped gradient fill; their anti-aliased edges differed between runs even as PNGs. Swapping blurred shadows for hard ones and turning off GSAP's `force3D` did not remove it.
- Revideo produced byte-identical frames on two renders, and two Godot recordings matched byte for byte.

So a fix can always be checked against the frame it was meant to fix, because the drift is invisible. A byte-level comparison, as used for Godot, works on HyperFrames PNG sequences, and not on scenes with per-letter caption animation. `render --docker` exists for strictly reproducible renders; it was not tested here.

## What each round showed

- **Smoke test.** The guide's setup, rerun word for word in an empty folder, rendered the same frames byte for byte. The test changed the guide four times: write the project by hand instead of `hyperframes init`, turn telemetry off, grow by radius instead of scale after an attribute move, and paint the background on the composition root because PNG sequences drop the page background ([docs/03](03-toolchain-and-smoke-tests.md#hyperframes)).
- **Reel.** What no other route offers: a real web page with real type, playing real footage frame-accurately inside it, with CSS effects (`backdrop-filter`, blend modes, gradient text) rendered correctly without a GPU.
- **2D fight.** The JavaScript port of the shared sampler matched `fight.py` to 1e-15 on every joint of every frame. HTML and CSS made the broadcast layer (scoreboard, straps, stinger, telestrator, captions) quick to build; per-letter caption animation is where byte-exactness broke.
- **Warrior vs Dragon.** A 5 MB bake loaded as a script, drawn on canvas layers with CSS blend modes and an SVG paper texture on top. Drawing cost was the bottleneck: Chrome's software canvas made scaled bitmaps about ten times slower than paths, and fixing that took drawing from 174 to 32 ms per frame.

## Verdict

HyperFrames joins the skill as a fifth route for web-native 2D video ([ADR 0005](adr/0005-hyperframes-fifth-route.md)):

| | Motion Canvas (Revideo) | HyperFrames |
| --- | --- | --- |
| What the agent writes | TypeScript generators, Motion Canvas's own node API | HTML, SVG, canvas, CSS and GSAP |
| Upstream | Motion Canvas unreleased since December 2024; the route depends on the Revideo fork | Very active, but pre-1.0 and changing fast |
| Render cost here | ≈ 0.027–0.049 s per frame, ≈ 4 s startup | ≈ 0.05–0.12 s per frame (0.19 with footage), ≈ 12 s startup per command: about 2–2.5 times Revideo |
| Byte-exact output | Yes | PNG sequences usually; MP4 no |
| Checking tools | The skill's own Look step | `check` and `snapshot` on top of the Look step |
| Footage, audio, captions | Supported, not used in this study | Built for it: frame-accurate footage, captions, audio tools |
| Strings attached | Revideo telemetry (opt-out) | Telemetry (opt-out), a HeyGen product around the open-source core |

For 2D the look decides: clean vector drawing → Motion Canvas; web UI, type, captions or footage → HyperFrames; game feel → Godot 2D; hand-drawn → Grease Pencil. Revisit render speed and the MP4 path's byte-exactness when HyperFrames reaches 1.0.
