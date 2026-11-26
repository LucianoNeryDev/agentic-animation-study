# HyperFrames port: Four engines, one loop

| Field | Value |
| --- | --- |
| Purpose | Test HyperFrames as a candidate route by porting the Motion Canvas showcase scene to it, beat for beat, and comparing the two renders on the same machine |
| Subject and action | Identical to [`../motion-canvas/BRIEF.md`](../motion-canvas/BRIEF.md): typed title, roll call, the plan → block → look → polish → render loop with a token and one "fix" pass, then the seconds-per-frame chart |
| Dimension and look | 2D, flat, dark UI style: Noto Sans (bundled in `assets/fonts/`), route colours, faint grid |
| Length | 10.72 s (644 frames) |
| Aspect, resolution, fps | 16:9, 1920×1080, 60 fps |
| Camera | Static |
| Sound | Silent |
| Assets | Noto Sans Regular, Bold and ExtraBold (SIL OFL), GSAP from npm |
| Deliverable | H.264 MP4 (HyperFrames renders it directly) |

The chart keeps the original four values on purpose: this is a port for comparison, not a new chart. HyperFrames' own render cost is in [docs/09](../../../docs/09-hyperframes.md).

## Route and methods

- **Route: HyperFrames 0.9.98**: one HTML file with an inline SVG, animated by a paused GSAP 3.15 timeline registered on `window.__timelines["main"]`. HyperFrames seeks that timeline frame by frame in headless Chrome and encodes with FFmpeg.
- **Same coordinates as the original.** The SVG `viewBox` is `-960 -540 1920 1080`, so every position from `loop.tsx` copies across unchanged.
- **Same timing.** The Motion Canvas generator's beats were turned into absolute GSAP positions (comments in `index.html` give the checkpoints: 4.15, 4.55, 5.12, 6.08, 6.68, 7.08, 7.58 s). Eases map as `easeInOutCubic` → `power2.inOut` (Motion Canvas's default), `easeOutCubic` → `power2.out`, `easeOutBack` → `back.out(1.70158)`.
- **Seek-safe state.** Everything that Motion Canvas derives reactively (the typed title, arrow tips, the token riding the fix curve, bar labels counting up) is a GSAP tween on a plain object whose `onUpdate` writes the SVG. GSAP fires `onUpdate` on every seek, so any frame can be rendered alone.

## Commands

```bash
npm ci
export HYPERFRAMES_NO_TELEMETRY=1                           # telemetry is on by default
npx hyperframes check                                       # lint, runtime, layout, motion, contrast
npx hyperframes snapshot --at 0.5,1.7,3,4.85,6.4,9.5        # stills + contact sheet in .hyperframes/
npx hyperframes render --quiet -w 1 --start 3 --end 6 -o previews/draft.mp4   # one section
npx hyperframes render --quiet -w 1 -o renders/loop.mp4     # final
```
