# Blender showcase: Collapse

| Field | Value |
| --- | --- |
| Purpose | Show what the Blender route is best at: physically based materials, lighting, a baked physics sim, a cinematic camera |
| Subject and action | A chrome ball rolls into a tower of ceramic and glass blocks; the tower collapses and settles |
| Dimension and look | 3D, photoreal studio: dark glossy floor, warm key, cool rim, shallow depth of field, motion blur |
| Length | 6 s (144 frames) |
| Aspect, resolution, fps | 16:9, 1920×1080, 24 fps (filmic) |
| Camera | One shot: slow low-angle orbit and push-in; focus follows the action |
| Sound | Silent |
| Assets | None, built from primitives |
| Deliverable | H.264 MP4 |

Assumptions: silent; one continuous shot; 24 fps for a filmic look.

## Beat sheet

| Time | Frames | What happens | Camera |
| --- | --- | --- | --- |
| 0.0–1.6 s | 1–38 | The tower stands; the chrome ball rolls in from the left | Low wide shot, slow push-in |
| 1.6–2.0 s | 39–48 | Impact: the ball punches out the bottom layers | Orbit continues to the right |
| 2.0–4.5 s | 49–108 | The tower falls; blocks tumble and the glass catches the light | Orbit, focus follows the debris |
| 4.5–6.0 s | 109–144 | Debris settles and the ball rolls to a stop; hold | Eases to a stop, focus on the ball |

## Route and methods

- **Route: Blender**, because the point is image quality: Cycles path tracing, glass, chrome, depth of field and motion blur.
- **Methods:** keyframed ball run-up (animated rigid body, released into the simulation before impact) and keyframed camera; **physics simulation** (Bullet rigid bodies, 10 substeps per frame, baked) for the collapse.

## Render commands

```bash
blender -b --python-exit-code 1 -P build.py                                             # build + bake
blender -b scene.blend -P gpu.py -o //previews/f_#### -F PNG -f 60                       # one still
blender -b scene.blend -P gpu.py -o //renders/frames/f_#### -F PNG -a                    # final frames
ffmpeg -y -framerate 24 -start_number 1 -i renders/frames/f_%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart renders/collapse.mp4
```
