# Godot showcase: Arena

| Field | Value |
| --- | --- |
| Purpose | Show what the Godot route is best at: game feel, combat timing, many interacting physics bodies, real-time effects |
| Subject and action | A hero in a ring of 36 slimes: three dash strikes, then a leap and a ground slam that blasts every slime outward |
| Dimension and look | 3D, stylized game look: dark arena with a glowing grid, bloom, fog, emissive sword and sparks |
| Length | 6.8 s of game time plus 21 hit-stop frames = 429 frames (7.15 s) |
| Aspect, resolution, fps | 16:9, 1920×1080, 60 fps (game feel) |
| Camera | High three-quarter game camera, slow orbit, push-in after the slam, trauma-based screen shake |
| Sound | Silent |
| Assets | None, built from primitives in code |
| Deliverable | H.264 MP4 |

Assumptions: silent; slimes stay solid (kinematic) until hit, so only hits send them flying.

## Beat sheet (game time; hit-stop frames freeze it)

| Time | What happens | Camera |
| --- | --- | --- |
| 0.0–1.0 s | Slimes drop in one by one, sweeping around the ring; hero idles in the centre | Wide, high three-quarter view |
| 1.0–1.8 s | Slimes hop inward and close the ring | Slow orbit |
| 1.8–3.0 s | Three dash strikes at 2.0, 2.4 and 2.8 s: anticipation, dash, slash, 4-frame hit-stop, knockback, sparks, combo +1 | Look-at eases toward the hero, small shakes |
| 3.0–3.6 s | Crouch, leap to the centre, hang, slam down | Follows up and down |
| 3.6 s | Slam: 9-frame hit-stop, white flash, shockwave, every slime launched, dust ring, combo counts to 36 | Big shake |
| 3.6–5.6 s | Slimes tumble, bounce off the walls and each other; hero rises | Push-in |
| 5.6–6.8 s | Hero turns to camera; "36 HITS" holds | Hold |

## Route and methods

- **Route: Godot**, because the point is game feel: hit-stop through `Engine.time_scale`, physics knockback, GPU particles and glow, all recorded deterministically with Movie Maker.
- **Methods:** procedural motion (the beat sheet as frame-exact events in `main.gd`; hero and slime moves are functions of game time); **physics** (RigidBody3D slimes, frozen until hit, 120 Hz ticks); **particles** (fixed-seed GPUParticles3D sparks and dust).

## Render commands

```bash
# headless Linux: run each godot command under xvfb-run -a (Movie Maker needs a real renderer)
godot --path . --write-movie previews/f.png --fixed-fps 60 --quit-after 429          # full preview
godot --path . --write-movie renders/frames/f.png --fixed-fps 60 --quit-after 429    # final frames
ffmpeg -y -framerate 60 -start_number 0 -i renders/frames/f%08d.png -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart renders/arena.mp4
```
