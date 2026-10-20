# Route: Godot

Godot 4 driven by GDScript, recorded with **Movie Maker mode**. Movie Maker gives every frame the same time step regardless of how fast the machine runs, so the output is deterministic and exact to the frame.

## Tools

```bash
godot --version          # Godot 4.x expected (4.7 current as of 2026-10)
ffmpeg -version
```

Missing Godot: download the Linux build (standard, not .NET, unless the brief needs C#) from https://godotengine.org/download/linux/, extract it into user space and link it onto `PATH` as `godot`.

Movie Maker needs a real renderer: `--headless` uses a dummy one that records nothing. On a machine with a display or GPU, run normally. With no display, wrap the command in `xvfb-run -a`, or set `DISPLAY` to a running Xvfb; Vulkan still renders on the GPU through it. On old or software-only GPUs, add `--rendering-method gl_compatibility`.

## Project layout

```
<slug>/
  BRIEF.md
  project.godot
  main.tscn  main.gd      # scene root; builds or loads the sequence
  sequence.gd             # the beat sheet as data plus the timeline that plays it
  assets/
  previews/  renders/frames/
```

`.tscn`, `.tres` and `.gd` are plain text, so write them directly. Keep the scene tree small in `.tscn` and build the rest in `_ready()`; code is easier to edit and to check than long serialized node trees.

Set these in `project.godot`:
- `display/window/size/viewport_width` and `viewport_height` to the brief's resolution, with `display/window/stretch/mode="canvas_items"`.
- `physics/common/physics_ticks_per_second` to a whole multiple of the fps, so physics steps line up with frames.
- Imported assets need an import pass before the first run: `godot --headless --path . --import`.

## Render commands

```bash
# still frames from a range: start the sequence at the range start (see below)
godot --path . --write-movie previews/f.png --fixed-fps 30 --quit-after 25 -- --from=48
# final frames (8-digit numbering: f00000000.png ...; audio goes to f.wav)
godot --path . --write-movie renders/frames/f.png --fixed-fps 30 --quit-after <total_frames>
```

Paths are relative to the project folder. `--quit-after N` stops after N frames, and `--fixed-fps` must match the brief. Read arguments after `--` with `OS.get_cmdline_user_args()`. Use them to start the sequence at a later frame, so a preview of a late beat does not have to record everything before it: advance tweens with `tween.custom_step(from / fps)` and animations with `animation_player.seek(from / fps, true)` in `_ready()`. The first recorded frame then matches frame `from` of a full recording exactly. Encode with ffmpeg using `-i renders/frames/f%08d.png` and `-start_number 0`, adding `-i renders/frames/f.wav` for sound. You can also write `out.avi` (MJPEG) or `out.ogv` (Theora) directly, but PNG frames give lossless quality and frames you can check.

End every run through `--quit-after` or `get_tree().quit()`. A run killed with Ctrl+C leaves broken AVI and WAV files.

**Smoke test:** a `main.gd` that moves a `ColorRect` (2D) or `MeshInstance3D` (3D) with a tween, recorded for 30 frames, then open frame 15.

## Doing the methods

- **Timeline:** drive the sequence from one clock: `frame = Engine.get_frames_drawn() - start_offset`, or accumulate `delta` (fixed under Movie Maker). Fire beat events (strike, hit-stop, shake, spawn effect) at their beat-sheet frames from a sorted event list. That is the beat sheet as code.
- **Keyframes:** build `Animation` resources in code (`add_track(Animation.TYPE_VALUE)`, `track_set_path(t, "Fighter:position")`, `track_insert_key(t, time, value)`), add them to an `AnimationLibrary` on an `AnimationPlayer`, then play them. Set `movie_quit_on_finish = true` when one non-looping `AnimationPlayer` defines the length.
- **Tweens:** `create_tween().tween_property(node, "position", target, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)`, for one-off moves and easing.
- **Skeletal characters:** import glTF with its animations, blend them in an `AnimationTree`, and use `SkeletonIK3D` or `LookAtModifier3D` (2D: `Skeleton2D` with modifications) for contacts.
- **Hit-stop:** set `Engine.time_scale = 0` for N frames, then restore it. Movie Maker keeps recording frames during the freeze. Shake by offsetting a `Camera2D`/`Camera3D` with decaying noise.
- **Physics and particles:** use `RigidBody` nodes and `GPUParticles` with fixed seeds (`seed`, `use_fixed_seed` on particles), so every recording matches.
- **2D:** `Polygon2D`/`Line2D` or a `Skeleton2D` rig for flat characters. For shapes computed every frame, connect a `Node2D`'s `draw` signal, draw with `draw_polyline`, `draw_circle` and `draw_colored_polygon` (add circles at the joints for round caps), and call `queue_redraw()` each frame. `Parallax2D` layers with `scroll_scale` follow the `Camera2D`; put the HUD on a `CanvasLayer`.
- **2D glow:** set `rendering/viewport/hdr_2d=true` and add a `WorldEnvironment` (`background_mode = BG_CANVAS`, `glow_enabled`); colours above 1.0 then bloom. Two traps:
  - With `hdr_2d`, colours blend in linear light, so translucent overlays look far stronger. A white flash at alpha 0.1 reads like 0.3, so scale overlay alphas down and measure them.
  - The widest glow levels spread one bright spot into a full-screen haze; `env.set_glow_level(level, 0.0)` for levels 4–6.
- **2D particles:** `GPUParticles2D` with `particle_flag_disable_z = true` in its `ParticleProcessMaterial`, a texture (a radial `GradientTexture2D` gives soft dots), `one_shot`, `fixed_fps`, and `use_fixed_seed`; fire it with `restart()` on the event frame.
- **GDScript names:** a function named like a built-in (`ease`, `floor`, ...) produces confusing parse errors at its call sites; give it a distinct name. A variable inferred with `:=` from a Dictionary value needs an explicit type.
