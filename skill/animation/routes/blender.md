# Route: Blender

Blender driven from Python (`bpy`) and run headless. The scene is a script that builds the `.blend` file from nothing, or edits a supplied one, so every change can be repeated.

## Tools

```bash
blender --version        # Blender 5.x expected (5.2 LTS current as of 2026-10)
ffmpeg -version
```

Missing Blender: download the Linux tarball from https://www.blender.org/download/, extract it into user space (for example `~/opt/blender`) and link `blender` onto `PATH`. The script runs inside Blender's bundled Python, so install no system Python packages for it.

**API version.** The Python API changes between major versions; check https://docs.blender.org/api/<major.minor>/ for the installed version before you use a call you are unsure of. Two known breaks:
- From 5.0, `Action.fcurves` and `Action.groups` no longer exist. F-curves live in a channelbag per action slot. Insert keys with `keyframe_insert()`, and reach the curves through `anim_utils.action_get_channelbag_for_slot(obj.animation_data.action, obj.animation_data.action_slot)` (`from bpy_extras import anim_utils`).
- Render engines in 5.x are `BLENDER_EEVEE` (5.0 dropped the `BLENDER_EEVEE_NEXT` name), `CYCLES` and `BLENDER_WORKBENCH`.

## Project layout

```
<slug>/
  BRIEF.md
  build.py        # builds or updates the scene; deterministic, safe to re-run
  scene.blend     # written by build.py
  assets/         # supplied models, textures, HDRIs
  previews/  renders/frames/
```

`build.py` starts from `bpy.ops.wm.read_factory_settings(use_empty=True)`, or opens the supplied `.blend`, builds everything, then calls `bpy.ops.wm.save_as_mainfile(filepath=...)`. Put frame numbers in one table derived from the beat sheet (`BEATS = {"strike": 48, ...}`) and refer to frames only through it.

## Render commands

```bash
# build the scene; a Python error ends with a non-zero exit code
blender -b --python-exit-code 1 -P build.py
# single still (frame 48)
blender -b scene.blend -o //previews/f_#### -F PNG -f 48
# frame range, for contact sheets
blender -b scene.blend -o //previews/f_#### -F PNG -s 40 -e 64 -a
# final frames
blender -b scene.blend -o //renders/frames/f_#### -F PNG -a
```

`//` means "relative to the .blend file". Options apply in order, so `-o`, `-F`, `-s` and `-e` come before `-f`/`-a`. Encode frames with ffmpeg (SKILL.md step 7) rather than Blender's own video output: a crash mid-render then still leaves the frames already written.

**Smoke test:** a build script that adds a cube, a camera and a light, keyframes the cube's location at frames 1 and 24, and renders frame 12.

## Doing the methods

- **Keyframes:** set the property, then `obj.keyframe_insert(data_path="location", frame=f)`. For bones use `pose.bones[name].keyframe_insert("rotation_quaternion", frame=f)`, and set `rotation_mode` first. Set interpolation per key (`CONSTANT` for blocking, `BEZIER` for polish) through the channelbag's F-curves.
- **Rigs and characters:** import rigged models with `bpy.ops.import_scene.gltf(filepath=...)` or `bpy.ops.import_scene.fbx(filepath=...)`. Print the bone names before posing; pose with IK controllers when the rig has them. Building a character from primitives works for stylized or stick-figure looks (one object per limb, parented at the joints).
- **Imported clips:** each clip arrives as an Action. Layer and blend them in NLA tracks (`obj.animation_data.nla_tracks`), and keyframe corrections on a layer above.
- **Procedural:** compute values in Python for each frame and key them, or use drivers (`driver_add`) for motion that follows other values.
- **Physics:** set up rigid bodies or cloth, then bake (`bpy.ops.ptcache.bake_all(bake=True)`) before rendering, so every render uses the same simulation.
- **Camera:** a camera with a `TRACK_TO` constraint aimed at an Empty you animate; set the focal length per shot. Cut between shots with timeline markers bound to cameras (`marker.camera = cam`).
- **Lighting:** a three-point setup, or an HDRI world, for a fast good look. Match the look to the brief before tuning.

## Grease Pencil (2D)

Grease Pencil draws 2D strokes inside the Blender scene and renders them with EEVEE. Its Python API was rewritten in 4.3, and code written for the old API (`gpencil` frames with `strokes.new()`) fails on 5.x. These calls work on 5.2:

```python
gpd = bpy.data.grease_pencils.new("drawing")
obj = bpy.data.objects.new("drawing", gpd)
scene.collection.objects.link(obj)
layer = gpd.layers.new("ink")             # later layers draw on top of earlier ones
layer.use_lights = False                  # flat colour

m = bpy.data.materials.new("ink")
bpy.data.materials.create_gpencil_data(m)
m.grease_pencil.color = (r, g, b, 1)      # stroke colour, linear (sRGB value ** 2.2)
m.grease_pencil.fill_color = (r, g, b, a) # used by filled strokes
gpd.materials.append(m)

d = layer.frames.new(frame).drawing       # a drawing holds until the layer's next frame
d.add_strokes([len(pts) for pts in strokes])
for i, (st, pts) in enumerate(zip(d.strokes, strokes)):
    st.material_index = 0
    st.cyclic = closed
    st.fill_id = i + 1                    # non-zero fill_id makes a filled shape
    st.hide_stroke = False                # True for fill only
    for pt, (x, y, radius) in zip(st.points, pts):
        pt.position = (x, 0.0, y)         # draw in the XZ plane
        pt.radius = radius
        pt.opacity = 1.0
d.tag_positions_changed()                 # rebuild caches (fill triangles) after moving points
```

- **Fills:** on 5.x a stroke is filled when its `fill_id` is non-zero. The material's `show_fill` and `show_stroke` no longer switch it.
- **Clearing:** write an empty drawing on a frame to clear that layer from then on.
- **Camera:** an orthographic camera looking along +Y (`rotation_euler = (pi/2, 0, 0)`), with `ortho_scale = frame width in px / px per unit`. Set `view_settings.view_transform = "Standard"` so flat colours stay flat.
- **Hand-drawn look:** draw on twos (a new drawing every second frame at 24 fps). Give every drawing its own small random wobble per point and per stroke ("line boil"), and taper the radius toward stroke ends.
- **Cost:** about 2.3 s per 1080p frame for a two-figure fight with effects, EEVEE on a GTX 745.

## Speed

- Previews: EEVEE, or Cycles with low samples and denoising, at 50% resolution (`scene.render.resolution_percentage = 50`).
- Final: the engine the look needs. Put Cycles on the GPU with a small script passed before the render options (`blender -b scene.blend -P gpu.py -o ... -a`):
  ```python
  import bpy
  p = bpy.context.preferences.addons['cycles'].preferences
  p.compute_device_type = 'CUDA'          # or 'OPTIX' (NVIDIA RTX), 'HIP' (AMD), 'ONEAPI' (Intel)
  p.get_devices()
  for d in p.devices: d.use = (d.type == p.compute_device_type)
  s = bpy.context.scene
  s.render.engine, s.cycles.device = 'CYCLES', 'GPU'
  ```
  CPU Cycles works anywhere, only slower.
- EEVEE runs in background mode on the GPU. Its first render compiles shaders (about 30 s for a simple scene; about 9 s once cached). Without a usable GPU, use Cycles on CPU.
