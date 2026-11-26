# 7. Gotchas

Every trap hit during the study, with the fix that worked. Versions: Blender 5.2.2, Godot 4.7.2, three r186, Revideo 0.11.0, HyperFrames 0.9.98 (GSAP 3.15.0), Playwright 1.64.1, ffmpeg 7.1.5, npm 11.

## Blender

- **`Action.fcurves` is gone (5.0+).** F-curves live in a channelbag per action slot: `bpy_extras.anim_utils.action_get_channelbag_for_slot(obj.animation_data.action, obj.animation_data.action_slot)`. Insert keys with `keyframe_insert()` as before.
- **Engine names.** `BLENDER_EEVEE`, `CYCLES`, `BLENDER_WORKBENCH`. `BLENDER_EEVEE_NEXT` no longer exists, and reading the engine enum from RNA only lists EEVEE because the others come from add-ons.
- **`transform_apply(scale=True)` also applies location and rotation** unless you pass `location=False, rotation=False`. It moved every block's origin to the world centre and broke the physics in the Collapse scene.
- **GPU Cycles from the command line** needs preferences code: set `compute_device_type`, call `get_devices()`, enable the devices, set `scene.cycles.device = 'GPU'`, all passed with `-P` before `-o`/`-a`.
- **Cycles cost.** About 40 s per 1080p frame at 40 samples with OIDN and motion blur on a GTX 745; adding the CPU device did not help.
- **EEVEE's first render compiles shaders** (about 30 s even for a trivial scene).
- **Encode with ffmpeg rather than Blender's video output**, so a crash mid-render keeps the frames already written.
- **Grease Pencil (4.3+ API).** Fills come from a non-zero `stroke.fill_id`; the material's `show_fill`/`show_stroke` don't switch them. Call `drawing.tag_positions_changed()` after moving points. Code for the old API fails.

## Godot

- **`--headless` records nothing** in Movie Maker mode: it uses a dummy renderer. Use a display or `xvfb-run -a`; Vulkan still runs on the GPU through Xvfb.
- **Hit-stop with `Engine.time_scale = 0` stops `_physics_process`.** Count the scene timeline in `_process` (frames keep being drawn and recorded).
- **Movie Maker numbering** is 8 digits from 0 (`f00000000.png`), with audio in `f.wav`. Quit with `--quit-after N` or `get_tree().quit()`; Ctrl+C leaves broken AVI/WAV files.
- **Late-start previews:** pass `-- --from=N`, read `OS.get_cmdline_user_args()`, and `custom_step()`/`seek()` to frame N; the first recorded frame then matches a full run exactly.
- **`hdr_2d` blends in linear light.** A white overlay at alpha 0.08 looked about 30 % bright. Scale overlay alphas down and measure them.
- **The widest glow levels spread a bright spot into a full-screen haze.** Disable levels 4–6 with `env.set_glow_level(level, 0.0)`.
- **`draw_colored_polygon` fails on degenerate or self-intersecting polygons** and logs an error per failure, which also slows recording. Draw area-checked triangles, and split quads into two triangles.
- **Vertical parallax on background layers moved the horizon** and hid the sky. Use `scroll_scale = Vector2(k, 1.0)` for a ground-anchored scene.
- **GDScript name clashes.** A function named `ease` (a built-in) produced "argument 1 should be float" errors at its call sites. Variables inferred with `:=` from Dictionary values need explicit types. Avoid shadowing `floor`, `name`.
- **`GPUParticles2D`** needs `particle_flag_disable_z = true`, a texture (a radial `GradientTexture2D` gives soft dots), `fixed_fps`, and `use_fixed_seed` for repeatable recordings; fire one-shots with `restart()` on the event frame.
- **Recording speed** is dominated by PNG writing at 1080p: about 0.25 s per frame here.

## Three.js and Playwright

- **Use a frame clock.** Every motion is a function of `t = frame / fps`; simulations step at a fixed `dt` from frame 0; random values come from a seeded generator. `requestAnimationFrame` timing is not reproducible.
- **`preserveDrawingBuffer: true`** on the renderer, so the canvas can be read back after rendering.
- **Each Playwright version needs its own browser:** `npx playwright install chromium`.
- **GPU in headless Chromium:** `--use-angle=vulkan --enable-gpu`. The default is SwiftShader (exact, slow); add `--enable-unsafe-swiftshader` if the context fails to start.
- **`RGBELoader` is deprecated (r180);** use `HDRLoader`.

## Motion Canvas (Revideo)

- **Motion Canvas renders only from its editor** and hasn't released on npm since 3.17.2 (December 2024). Revideo's `renderVideo()` renders headless.
- **`npm init @revideo@latest` is interactive** and sends a telemetry event; copy `examples/default` out of the `@revideo/create` package instead.
- **npm 11 install scripts:** approve `@ffmpeg-installer/linux-x64 @ffprobe-installer/linux-x64 esbuild puppeteer`, deny `@revideo/telemetry`, then `npm rebuild`.
- **CommonJS template:** wrap top-level `await` in a function in `render.ts`.
- **`DISABLE_TELEMETRY=true`** on every render.
- **A `Txt` whose text is computed from a function** errors during rendering ("scene is not available in the current context"): changing text creates nodes. Set the text inside a `tween()` instead; fill, position, scale and opacity as functions are fine.
- **Rendered video runs one or two frames long**, whatever `range` says (the range end is inclusive). Trim without re-encoding: `ffmpeg -i full.mp4 -frames:v N -c copy out.mp4`.
- **Coordinates** are pixels with the origin at the canvas centre; visible space is ±width/2 and ±height/2. Leave room for overshooting easings.
- **Revideo has no `Camera` node** (Motion Canvas does). Wrap the scene in a `Node` and animate its position and scale.
- **Large JSON imports work:** the 5 MB `bake.json` imports directly through Vite.

## HyperFrames

- **`hyperframes init` changes more than the project.** It prompts, offers to install HeyGen's agent skills, writes `AGENTS.md` and `CLAUDE.md`, loads GSAP from a CDN and pins `npx --yes` in its scripts. Write `package.json`, `hyperframes.json` and `meta.json` by hand, with `hyperframes` and `gsap` as pinned dev dependencies.
- **Telemetry is on by default:** `HYPERFRAMES_NO_TELEMETRY=1` (or `DO_NOT_TRACK=1`) on every command.
- **One render per user account at a time.** Others queue silently, so a wall-clock time can include minutes of waiting; HyperFrames' own "rendered in" line leaves the wait out.
- **About 12 s of startup per command** (CLI, pre-render lint, Chrome launch). A 1-second preview takes about 20 s; `snapshot` is the cheap way to look.
- **PNG sequences are RGBA without the page background.** Paint the background on the composition root, not `body`. Their files are numbered from `frame_000001` whatever `--start` is.
- **MP4 frames are not byte-identical between runs.** The MP4 path captures JPEGs through Chrome's BeginFrame and drifts by a few levels around moving anti-aliased edges; compare PNG sequences instead. Animated per-letter captions drifted even as PNGs (invisible); the same range without them was byte-identical.
- **GSAP fixes an SVG element's transform origin when it is set.** Move it later by `cx`/`x` attributes and a `scale` pivots around the old spot: in the smoke test the ball grew 168 px off-screen. Scale by `r` or `width`, or move with GSAP's `x`/`y`.
- **Measure text inside the update that uses it.** A frame can be seeked before a font has loaded, so a width measured once at load can be stale.
- **Give later elements an explicit start state.** A render that starts mid-clip seeks straight there; `check` flags elements hidden only in a tween's from-values, and measuring the DOM (`getBoundingClientRect`) inside an `onUpdate`.
- **`background-clip: text` on a word does not reach letter spans with their own transforms.** Put the gradient on each letter.
- **Footage must live inside the project** (a symlink works; `../` fails `check`), every clip is decoded to JPEG frames before capture even for a short range, and an active clip's opacity is forced to 1, so fade its wrapper.
- **A symlinked `node_modules` is not served:** GSAP returns 404 and the render fails. Install per project.
- **Chrome's software canvas:** drawing a scaled image costs about ten times an unscaled one; draw scenery as paths or cache it at its final size.
- **`check` enforces craft rules,** such as reading time per caption (about 0.5 s + 0.3 s a word, 2 s for a closing line), a 28 px text floor and contrast. They are warnings; keep the ones the brief justifies.

## ffmpeg and the Look step

- **Writing one image** needs `-frames:v 1 -update 1`.
- **Frame numbers on contact sheets:** `drawtext=text='%{eif\:n+<first>\:d}'` before `tile`, so each tile carries its real frame number.
- **Measure, don't guess.** When a frame looked wrong (a grey haze, fire hitting the ground), measuring pixel brightness or computing geometry from the baked data found the cause in one step.
