# 2D showcase: one stick fight, three routes

| Field | Value |
| --- | --- |
| Purpose | Compare the three 2D routes on the same animation: Blender Grease Pencil, Motion Canvas (Revideo) and Godot 2D |
| Subject and action | Blue and Red square off; Blue's jab lands on Red's block; Red's kick whiffs over Blue's duck; Blue's uppercut launches Red, who lands, bounces and slides; K.O. |
| Dimension and look | 2D stick figures. Grease Pencil: ink on paper, line boil, manga effects. Motion Canvas: flat vector motion graphics with a beat timeline. Godot: fighting-game HUD, neon parallax arena, particles and glow |
| Length | 4.5 s |
| Aspect, resolution, fps | 16:9, 1920×1080. Grease Pencil 24 fps drawn on twos; Motion Canvas and Godot 60 fps |
| Camera | Shared eased pan (`VIEW.pan` in `fight.py`) plus shake on hits; zoom punch on the uppercut in Motion Canvas and Godot |
| Sound | Silent |
| Deliverable | H.264 MP4 per route, plus `compare-2d.mp4` (2×2 grid) |

## How it is built

`fight.py` is the single source of the animation: bone lengths, named poses, timed keys with easing per segment (hit-stops are `hold` keys), effect events (`trail`, `hit`, `dust`, `ko`), the camera pan, and a reference sampler with two-bone IK. `python3 fight.py json` writes `fight.json`; each route ports the same sampler, so the poses match exactly. `python3 fight.py preview 0.84 1.86 ...` draws a quick PIL sheet for tuning poses before any route runs.

Methods: keyframed poses with IK for hands and feet, a sampled ballistic arc for Red's flight, procedural effects (trails from the limb's recent path, impact bursts, dust), seeded shake.

## Beat sheet

| Time | What happens | Camera |
| --- | --- | --- |
| 0.00–0.68 s | Both in guard, a small bob; "FIGHT!" (Motion Canvas, Godot) | Centred on the pair |
| 0.68–0.94 s | Blue winds back and lunges; the jab lands on Red's block at 0.84 s; hit-stop to 0.94 s | Small shake |
| 0.94–1.62 s | Red is pushed back, steps in with a high kick; Blue ducks under it | Starts panning right |
| 1.62–2.02 s | Blue loads and uppercuts at 1.86 s; hit-stop to 2.02 s | Big shake, flash, zoom punch |
| 2.02–3.30 s | Red flies, lands at 2.82 s, bounces and slides; dust | Pans with Red |
| 3.12–4.50 s | "K.O." at 3.12 s; Blue's victory pose and hop; Red twitches | Holds at x = 2.2 |

## Render commands

```bash
python3 fight.py json                                   # after any change to fight.py
# Grease Pencil (about 4 min, EEVEE)
cd grease-pencil && blender -b --python-exit-code 1 -P build.py \
  && blender -b scene.blend -o //renders/frames/f_#### -F PNG -a
# Motion Canvas (about 10 s); copy fight.json in first
cd motion-canvas && cp ../fight.json src/ && DISABLE_TELEMETRY=true npx tsx src/render.ts --out renders/full.mp4 \
  && ffmpeg -y -i renders/full.mp4 -frames:v 270 -c copy renders/fight-motion-canvas.mp4
# Godot (about 1 min)
cd godot && cp ../fight.json . && godot --path . --write-movie renders/frames/f.png --fixed-fps 60 --quit-after 270
```

## Measured

| Route | Render time | Frames |
| --- | --- | --- |
| Grease Pencil | 253 s (2.3 s per frame, EEVEE on the GTX 745) | 108 at 24 fps |
| Motion Canvas | 8 s | 270 at 60 fps |
| Godot 2D | 58 s (most of it GDScript sampling the poses) | 270 at 60 fps, two recordings byte-identical |
