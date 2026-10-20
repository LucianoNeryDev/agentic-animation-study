# Three.js showcase: Field

| Field | Value |
| --- | --- |
| Purpose | Show what the Three.js route is best at: real-time, code-generated 3D for the web, GPU instancing, post-processing, a scene that also runs live in a browser |
| Subject and action | A glowing orb drops onto a field of 14,400 cubes; a ripple spreads, waves build, then the cubes rise into the word "three.js" and a light sweeps across it |
| Dimension and look | 3D, stylized: deep-blue field, height-mapped colour (blue, teal, pink, gold), bloom, fog |
| Length | 7 s (420 frames) |
| Aspect, resolution, fps | 16:9, 1920×1080, 60 fps |
| Camera | Catmull-Rom path through six keys: wide, low over the waves, rising to a high front view of the word |
| Sound | Silent |
| Assets | None; the word is rasterised from a canvas at load |
| Deliverable | H.264 MP4, plus the live page (`npx vite`, open `/?live`, add `&orbit` to steer) |

Assumptions: silent; system DejaVu Sans Bold for the lettering.

## Beat sheet

| Time | What happens | Camera |
| --- | --- | --- |
| 0.0–0.45 s | The orb falls toward the centre of a flat field | Wide, slightly raised |
| 0.45–1.5 s | Splash: a ring ripple spreads out | Drifts right and in |
| 1.5–3.8 s | Travelling waves build; peaks turn pink | Swoops low over the waves |
| 3.8–5.2 s | Left to right, the waves flatten and the letters spring up (back-eased) | Rises to a high front view |
| 5.2–7.0 s | The word holds and shimmers; a white light sweep crosses it | Slow drift |

## Route and methods

- **Route: Three.js**, because the point is web-native procedural 3D: one `InstancedMesh`, a canvas-rasterised word, bloom through `EffectComposer`, and a page that also runs live.
- **Methods:** procedural (every cube height and colour is a function of `t`; see `heightAt` in `src/main.ts`); keyframed camera (Catmull-Rom through `CAMERA` in `src/beats.ts`).

## Render commands

```bash
npx vite --port 5173 &                                   # dev server
node capture.mjs --frames 60,180,300 --out previews      # stills
node capture.mjs --from 228 --to 275 --out previews      # range
node capture.mjs --out renders/frames                    # all 420 frames
ffmpeg -y -framerate 60 -i renders/frames/f_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart renders/field.mp4
```

Capture runs headless Chromium on the GPU (`--use-angle=vulkan --enable-gpu`).
