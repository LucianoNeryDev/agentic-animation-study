# Builds scene.blend for "Collapse": a chrome ball rolls into a block tower.
# Run: blender -b --python-exit-code 1 -P build.py
import bpy, math, os, random
from bpy_extras import anim_utils
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 24
BEATS = {"start": 1, "release": 34, "impact": 39, "fall": 49, "settle": 109, "end": 144}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = BEATS["start"], BEATS["end"]
scene.render.resolution_x, scene.render.resolution_y = 1920, 1080


def set_interp(obj, interp):
    ad = obj.animation_data
    bag = anim_utils.action_get_channelbag_for_slot(ad.action, ad.action_slot)
    for fc in bag.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = interp


def material(name, color, rough, metal=0.0, transmission=0.0, coat=0.0, ior=1.45):
    m = bpy.data.materials.new(name)
    if m.node_tree is None:
        m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Transmission Weight"].default_value = transmission
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["IOR"].default_value = ior
    return m


def add_rigid(obj, kind, mass=1.0, shape="BOX", friction=0.6, bounce=0.1):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.rigidbody.object_add(type=kind)
    rb = obj.rigid_body
    rb.collision_shape, rb.friction, rb.restitution = shape, friction, bounce
    if kind == "ACTIVE":
        rb.mass = mass
    return rb


# --- Materials -------------------------------------------------------------
glaze = [
    material("cream", (0.80, 0.72, 0.58), 0.22, coat=0.6),
    material("terracotta", (0.62, 0.20, 0.10), 0.30, coat=0.4),
    material("teal", (0.04, 0.30, 0.33), 0.20, coat=0.7),
]
glass = material("glass", (0.92, 0.97, 1.0), 0.02, transmission=1.0, ior=1.5)
chrome = material("chrome", (0.92, 0.92, 0.94), 0.05, metal=1.0)

floor_mat = material("floor", (0.018, 0.018, 0.022), 0.3)
nt = floor_mat.node_tree
noise = nt.nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 6.0
remap = nt.nodes.new("ShaderNodeMapRange")
remap.inputs["To Min"].default_value, remap.inputs["To Max"].default_value = 0.12, 0.45
nt.links.new(noise.outputs["Fac"], remap.inputs["Value"])
nt.links.new(remap.outputs["Result"], nt.nodes["Principled BSDF"].inputs["Roughness"])

# --- World: dark studio gradient, so chrome has something to reflect ------
world = bpy.data.worlds.new("studio")
scene.world = world
if world.node_tree is None:
    world.use_nodes = True
wn = world.node_tree
coord = wn.nodes.new("ShaderNodeTexCoord")
sep = wn.nodes.new("ShaderNodeSeparateXYZ")
ramp = wn.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = 0.45, (0.002, 0.002, 0.003, 1)
ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = 0.75, (0.035, 0.04, 0.05, 1)
wn.links.new(coord.outputs["Generated"], sep.inputs["Vector"])
wn.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
wn.links.new(ramp.outputs["Color"], wn.nodes["Background"].inputs["Color"])

# --- Floor -----------------------------------------------------------------
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.25), scale=(200, 200, 0.5))
floor = bpy.context.object
floor.name = "floor"
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
floor.data.materials.append(floor_mat)
add_rigid(floor, "PASSIVE", friction=0.7)

# --- Tower: 8 Jenga-style layers of 3 blocks -------------------------------
L, W, H, GAP = 1.5, 0.5, 0.3, 0.008
rng = random.Random(7)
blocks = []
for layer in range(8):
    z = H * (layer + 0.5) + 0.0005 * layer
    for i in (-1, 0, 1):
        off = i * (W + GAP)
        if layer % 2 == 0:
            loc, dims = (0, off, z), (L, W, H)
        else:
            loc, dims = (off, 0, z), (W, L, H)
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc, scale=dims)
        b = bpy.context.object
        b.name = f"block_{layer}_{i + 1}"
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bev = b.modifiers.new("bevel", "BEVEL")
        bev.width, bev.segments = 0.018, 3
        bpy.ops.object.shade_smooth()
        b.data.materials.append(glass if rng.random() < 0.18 else rng.choice(glaze))
        add_rigid(b, "ACTIVE", mass=1.0, friction=0.55, bounce=0.08)
        blocks.append(b)

# --- Ball: animated run-up, released into the simulation before impact ----
R, SPEED = 0.6, 7.5 / FPS  # metres per frame
contact_x = -0.755 - R
bpy.ops.mesh.primitive_uv_sphere_add(radius=R, segments=64, ring_count=32, location=(0, 0, R))
ball = bpy.context.object
ball.name = "ball"
bpy.ops.object.shade_smooth()
ball.data.materials.append(chrome)
rb = add_rigid(ball, "ACTIVE", mass=25.0, shape="SPHERE", friction=0.4, bounce=0.05)
rb.linear_damping, rb.angular_damping = 0.3, 0.5
for f in (BEATS["start"], BEATS["release"]):
    x = contact_x - (BEATS["impact"] - f) * SPEED
    ball.location.x = x
    ball.rotation_euler.y = (x - contact_x) / R  # rolling without slipping
    ball.keyframe_insert("location", frame=f)
    ball.keyframe_insert("rotation_euler", frame=f)
set_interp(ball, "LINEAR")
for f, animated in ((BEATS["release"] - 1, True), (BEATS["release"], False)):
    ball.rigid_body.kinematic = animated
    ball.rigid_body.keyframe_insert("kinematic", frame=f)

rbw = scene.rigidbody_world
rbw.substeps_per_frame, rbw.solver_iterations = 10, 20
rbw.point_cache.frame_start, rbw.point_cache.frame_end = BEATS["start"], BEATS["end"]
bpy.ops.ptcache.bake_all(bake=True)

# --- Lights: warm key, cool rim, soft fill ---------------------------------
aim = bpy.data.objects.new("light_aim", None)
scene.collection.objects.link(aim)
aim.location = (0, 0, 0.8)
for name, loc, size, power, color in (
    ("key", (-4.5, -5.0, 6.0), 4.0, 1500, (1.0, 0.82, 0.66)),
    ("rim", (3.5, 7.0, 6.0), 3.0, 750, (0.62, 0.76, 1.0)),
    ("fill", (7.0, -3.5, 2.0), 6.0, 220, (1.0, 1.0, 1.0)),
):
    ld = bpy.data.lights.new(name, "AREA")
    ld.size, ld.energy, ld.color = size, power, color
    lo = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(lo)
    lo.location = loc
    c = lo.constraints.new("TRACK_TO")
    c.target, c.track_axis, c.up_axis = aim, "TRACK_NEGATIVE_Z", "UP_Y"
    lo.visible_glossy = name != "fill"  # keep the fill's softbox out of the glossy floor

# --- Camera: slow orbit and push-in; aim and focus follow the debris -------
# Sample the baked sim to find where the action is at each frame.
track = {}
for f in range(BEATS["start"], BEATS["end"] + 1):
    scene.frame_set(f)
    pts = [b.matrix_world.translation.copy() for b in blocks]
    centroid = sum(pts, Vector()) / len(pts)
    track[f] = (centroid, ball.matrix_world.translation.copy())
scene.frame_set(BEATS["start"])
print("BALL", {f: tuple(round(v, 2) for v in track[f][1]) for f in (30, 34, 36, 39, 44, 60, 100, 144)})
print("CENTROID", {f: tuple(round(v, 2) for v in track[f][0]) for f in (1, 60, 100, 144)})


def smooth(t):
    return t * t * (3 - 2 * t)


target = bpy.data.objects.new("cam_target", None)
scene.collection.objects.link(target)
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 35
cam_data.dof.use_dof = True
cam_data.dof.focus_object = target
cam_data.dof.aperture_fstop = 2.4
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
c = cam.constraints.new("TRACK_TO")
c.target, c.track_axis, c.up_axis = target, "TRACK_NEGATIVE_Z", "UP_Y"

tower_centre = Vector((-0.7, 0, 1.1))  # lead room for the ball entering left
span = BEATS["end"] - BEATS["start"]
for f in range(BEATS["start"], BEATS["end"] + 1, 6):
    s = smooth((f - BEATS["start"]) / span)
    theta = math.radians(-95 + 45 * s)
    r, h = 7.6 + 1.2 * s, 1.2 + 1.5 * s
    cam.location = (r * math.cos(theta), r * math.sin(theta), h)
    cam.keyframe_insert("location", frame=f)
    # average the action over nearby frames so the aim never jitters
    near = [track[g] for g in range(max(BEATS["start"], f - 8), min(BEATS["end"], f + 8) + 1)]
    centroid = sum((n[0] for n in near), Vector()) / len(near)
    ballpos = sum((n[1] for n in near), Vector()) / len(near)
    w = smooth(min(1.0, max(0.0, (f - BEATS["impact"] + 4) / 36)))
    action = centroid.lerp(ballpos, 0.35) + Vector((0, 0, 0.25))
    target.location = tower_centre.lerp(action, w)
    target.keyframe_insert("location", frame=f)

# --- Render settings -------------------------------------------------------
scene.render.engine = "CYCLES"
cy = scene.cycles
cy.samples, cy.adaptive_threshold, cy.use_denoising = 40, 0.02, True
cy.max_bounces, cy.glossy_bounces, cy.transmission_bounces = 10, 6, 12
cy.blur_glossy = 0.5
scene.render.use_persistent_data = True
scene.render.use_motion_blur, scene.render.motion_blur_shutter = True, 0.5
vs = scene.view_settings
vs.view_transform = "AgX"
for look in ("AgX - Medium High Contrast", "Medium High Contrast"):
    try:
        vs.look = look
        break
    except TypeError:
        pass
print("LOOK", vs.look)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "scene.blend"))
