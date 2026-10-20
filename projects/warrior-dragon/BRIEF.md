# Warrior vs Dragon

| Field | Value |
| --- | --- |
| Purpose | A short 2D action clip, made twice from the same choreography to show the Godot 2D and Motion Canvas routes |
| Subject and action | A stick-figure warrior (helmet with plume, sword, round shield, cape) faces a dragon that lands, roars and breathes fire; the warrior blocks, slashes, is knocked down, dodges a fire blast and finishes the dragon with a plunging strike |
| Dimension and look | 2D. Godot: game look (HUD with health and boss bars, particles, glow, parallax dusk landscape). Motion Canvas: flat vector illustration with title cards |
| Length | 20 s (1200 frames) |
| Aspect, resolution, fps | 16:9, 1920×1080, 60 fps |
| Camera | Baked camera path shared by both versions: follows the action, shakes on impacts, zooms in on the finishing blow and the victory |
| Sound | Silent (assumption) |
| Assets | None; everything is built from primitives |
| Deliverable | Two H.264 MP4s plus a side-by-side comparison |

Assumptions: silent; 60 fps for both; dusk setting; the warrior wins.

## Route and methods

- **Godot 2D** for the game-feel version and **Motion Canvas (Revideo)** for the vector version, as asked.
- **Choreography baked to data:** `choreo.py` holds poses, timed keys, events and the camera, evaluates them, and writes every frame's shapes to `bake.json`. Both routes only draw those shapes, so they match frame for frame.
- **Methods:** keyframed poses with two-bone IK (warrior limbs, dragon legs); procedural rigs (dragon spine, tail, neck curve, wings from a spread and flap value); Verlet simulation for the cape and plume (secondary motion); hit-stop as frozen action time; seeded camera shake; particles for fire, sparks, dust and embers in each route.

## Beat sheet

| Time | What happens | Camera |
| --- | --- | --- |
| 0.0–2.4 s | Dusk. The warrior walks in from the left, cape blowing, and stops in guard | Follows the warrior |
| 2.4–3.2 s | A shadow sweeps the ground; the warrior looks up and raises the shield | Starts widening right |
| 3.2–4.3 s | The dragon drops in, wings beating, and lands hard: dust, heavy shake | Wide on both |
| 4.3–5.5 s | Roar: the dragon rears, wings spread, jaw open; shockwave; the warrior braces, cape blown back | Shake |
| 5.5–7.6 s | Fire breath on the shield; the warrior is pushed back under it | Wide |
| 7.6–8.1 s | Fire ends; smoke; the warrior crouches (anticipation) | |
| 8.1–9.7 s | The dragon rears its head to strike; the warrior charges, leaps under it and slashes the exposed neck; hit-stop; the head recoils | Follows the leap |
| 9.7–11.0 s | Claw swipe; the warrior backflips over it | |
| 11.0–13.0 s | Bite lunge into the shield; the warrior is knocked back, rolls and gets up | Shake |
| 13.0–14.6 s | The dragon rears and blasts fire; the warrior sprints and knee-slides under the stream, pops up and slashes its chest | Pans with the sprint |
| 14.6–16.6 s | The dragon staggers and its head drops; the warrior crouches, leaps high and plunges the sword into its head; long hit-stop and flash | Zoom punch |
| 16.6–18.6 s | The dragon collapses: head to the ground, wings fall, dust | Shake |
| 18.7–20.0 s | Victory pose, sword raised; "VICTORY" | Slow push in on the warrior |

## Files and render commands

- `choreo.py`: poses, keys, events, camera and wind; the warrior and dragon rigs; the cape and plume simulation; the bake. `python3 choreo.py preview <seconds>...` draws a quick PIL sheet for tuning before any engine runs.
- `bake.json`: every frame's shapes, camera, health values and events (5.3 MB). Godot reads it through a symlink; Motion Canvas imports a copy in `src/`.
- `godot/main.gd`: the game version. `motion-canvas/src/scenes/fight.tsx`: the illustration version.

```bash
python3 choreo.py bake && cp bake.json motion-canvas/src/
# Godot (about 5 min on the test machine; most of it is PNG writing; prefix with xvfb-run -a when headless)
cd godot && godot --path . --write-movie renders/frames/f.png --fixed-fps 60 --quit-after 1200 \
  && ffmpeg -y -framerate 60 -start_number 0 -i renders/frames/f%08d.png -c:v libx264 -pix_fmt yuv420p -crf 18 \
     -movflags +faststart renders/warrior-dragon-godot.mp4
# Motion Canvas (about 50 s)
cd motion-canvas && DISABLE_TELEMETRY=true npx tsx src/render.ts --out renders/full.mp4 \
  && ffmpeg -y -i renders/full.mp4 -frames:v 1200 -c copy renders/warrior-dragon-motion-canvas.mp4
```

## Fixes made after looking at frames

- Fire breath aimed at the ground: raised the head and aimed it at the shield; the blast stream now clears the sliding warrior by about 0.4 units.
- The leap into the neck slash ran into the dragon's head: the dragon now rears its head to strike, exposing the neck.
- Wings stood up like sails when hurt or fallen: they now droop, and lie on the ground once the dragon falls.
- Godot: degenerate and twisted polygons failed to triangulate (2,592 errors); everything is drawn as checked triangles now. The vertical parallax hid the sky; the sun was moved behind the dragon.
- Motion Canvas: flames died before the shield; name tags covered the action.
- The hit-stops pushed the victory into the last frames; the victory beat now starts at 18.7 s.
