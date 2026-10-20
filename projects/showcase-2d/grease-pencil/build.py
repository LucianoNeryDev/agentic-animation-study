# Builds scene.blend: the stick fight drawn frame by frame in Grease Pencil.
# Run: blender -b --python-exit-code 1 -P build.py
import bpy, math, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import fight as F  # noqa: E402  shared choreography and sampler

FPS = 24
LAST = int(round(F.DURATION * FPS))      # frames 1..LAST, t = (frame - 1) / FPS
S = F.VIEW["px_per_unit"]                # framing shared with the other routes
CAM_Z = F.VIEW["ground_below_center_px"] / S   # the camera pans in x: F.cam_x(t)
PAPER = (0.95, 0.92, 0.86)
INK = {"blue": (0.10, 0.30, 0.80), "red": (0.80, 0.16, 0.14), "dark": (0.12, 0.11, 0.10), "spark": (0.96, 0.62, 0.08)}
EVENTS = F.EVENTS

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, LAST
scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 8
scene.view_settings.view_transform = "Standard"   # flat colours, no filmic curve

world = bpy.data.worlds.new("paper")
scene.world = world
if world.node_tree is None:
    world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (*[c ** 2.2 for c in PAPER], 1)

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.type = "ORTHO"
cam.data.ortho_scale = 1920 / S
cam.rotation_euler = (math.pi / 2, 0, 0)          # looks along +Y; x right, z up
scene.collection.objects.link(cam)
scene.camera = cam

gpd = bpy.data.grease_pencils.new("fight")
obj = bpy.data.objects.new("fight", gpd)
scene.collection.objects.link(obj)


def material(name, rgb, fill=None, alpha=1.0):
    # In 5.x a stroke is filled when its fill_id is non-zero; the material only gives the colours.
    m = bpy.data.materials.new(name)
    bpy.data.materials.create_gpencil_data(m)
    m.grease_pencil.color = (*[c ** 2.2 for c in rgb], 1)
    if fill is not None:
        m.grease_pencil.fill_color = (*[c ** 2.2 for c in fill], alpha)
    gpd.materials.append(m)
    return len(gpd.materials) - 1


MAT = {k: material(k, v) for k, v in INK.items()}
HEAD = {k: material(k + "_head", INK[k], fill=INK[k]) for k in ("blue", "red")}
STAR_FILL = material("star_fill", INK["spark"], fill=(1.0, 0.86, 0.25))
SHADOW = material("shadow", PAPER, fill=(0.55, 0.50, 0.44), alpha=0.35)

LAYERS = {}
for name in ("ground", "shadows", "fx_back", "fighters", "fx"):
    layer = gpd.layers.new(name)
    layer.use_lights = False
    LAYERS[name] = layer


# ---------------------------------------------------------------- drawing kit

class Pen:
    """Collects strokes for one drawing, then writes them in one go."""

    def __init__(self, seed):
        self.rng = random.Random(seed)
        self.items = []

    def wobble(self, amp):
        return self.rng.uniform(-amp, amp)

    def line(self, pts, mat, width=0.045, boil=0.010, steps=6, taper=True, cyclic=False, opacity=1.0, fill=False, outline=True):
        dense = []
        loop = pts + [pts[0]] if cyclic else pts
        for a, b in zip(loop, loop[1:]):
            for i in range(steps):
                u = i / steps
                dense.append([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u])
        if not cyclic:
            dense.append(list(pts[-1]))
        sx, sy = self.wobble(boil), self.wobble(boil)     # whole-stroke drift
        out, n = [], len(dense)
        for i, (x, y) in enumerate(dense):
            u = i / max(1, n - 1)
            r = width * (0.45 + 0.55 * math.sin(math.pi * u)) if taper else width
            out.append(((x + sx + self.wobble(boil * 0.5), y + sy + self.wobble(boil * 0.5)), r * self.rng.uniform(0.9, 1.1)))
        self.items.append((out, mat, cyclic, opacity, fill, outline))

    def circle(self, c, radius, mat, width=0.035, boil=0.010, n=18, opacity=1.0, fill=False):
        pts = [[c[0] + radius * math.cos(a), c[1] + radius * math.sin(a)] for a in (i / n * math.tau for i in range(n))]
        self.line(pts, mat, width, boil, steps=1, taper=False, cyclic=True, opacity=opacity, fill=fill)

    def write(self, layer, frame):
        d = layer.frames.new(frame).drawing
        if not self.items:
            return
        d.add_strokes([len(p) for p, *_ in self.items])
        for i, (st, (pts, mat, cyclic, opacity, fill, outline)) in enumerate(zip(d.strokes, self.items)):
            st.material_index = mat
            st.cyclic = cyclic
            if fill:
                st.fill_id = i + 1     # non-zero fill_id = filled shape
                st.hide_stroke = not outline
            for pt, ((x, y), r) in zip(st.points, pts):
                pt.position = (x, 0.0, y)
                pt.radius = r
                pt.opacity = opacity
        d.tag_positions_changed()      # rebuild caches (fill triangles) after moving points


def star(c, r_in, r_out, spikes, rng, rot=0.0):
    pts = []
    for i in range(spikes * 2):
        a = rot + i / (spikes * 2) * math.tau
        r = (r_out if i % 2 == 0 else r_in) * rng.uniform(0.8, 1.15)
        pts.append([c[0] + r * math.cos(a), c[1] + r * math.sin(a)])
    return pts


def ko_letters(pen, c, size, mat):
    """Hand-drawn "K.O.!" from strokes."""
    x, y, h = c[0] - 1.6 * size, c[1], size
    pen.line([[x, y - h / 2], [x, y + h / 2]], mat, 0.06, steps=4)
    pen.line([[x + 0.55 * h, y + h / 2], [x + 0.05 * h, y], [x + 0.6 * h, y - h / 2]], mat, 0.06, steps=4)
    pen.circle([x + 0.95 * h, y - h / 2 + 0.06], 0.05, mat, 0.04, n=8)
    pen.circle([x + 1.75 * h, y], 0.5 * h, mat, 0.06, n=22)
    pen.circle([x + 2.5 * h, y - h / 2 + 0.06], 0.05, mat, 0.04, n=8)
    pen.line([[x + 2.95 * h, y + h / 2], [x + 2.95 * h, y - h / 4]], mat, 0.06, steps=4)
    pen.circle([x + 2.95 * h, y - h / 2 + 0.06], 0.05, mat, 0.04, n=8)


# ---------------------------------------------------------------- ground (one drawing, held)

pen = Pen(1)
pen.line([[-4.2, 0.0], [6.4, 0.0]], MAT["dark"], 0.03, boil=0.02, steps=30, taper=False)
pen.line([[-3.9, -0.07], [-0.4, -0.06]], MAT["dark"], 0.012, boil=0.02, steps=12)
pen.line([[1.6, -0.08], [6.1, -0.07]], MAT["dark"], 0.012, boil=0.02, steps=12)
pen.write(LAYERS["ground"], 1)

# ---------------------------------------------------------------- fighters, on twos


def hand_at(name, limb, t):
    j = F.skeleton(F.FIGHT, name, t)
    return j[{"hf": "hand_f", "hb": "hand_b", "ff": "foot_f", "fb": "foot_b"}[limb]]


for f in range(1, LAST + 1, 2):
    t = (f - 1) / FPS
    pen, shadow = Pen(1000 + f), Pen(5000 + f)
    for name in ("red", "blue"):
        j = F.skeleton(F.FIGHT, name, t)
        for part, pts in F.strokes(j):
            pen.line(pts, MAT[name], 0.036 if part == "back" else 0.046)
        pen.circle(j["head"], F.BONES["head"], HEAD[name], fill=True)
        # ground shadow shrinks as the body rises
        h = max(0.0, j["hip"][1] - 0.4)
        w = max(0.25, 0.75 - 0.25 * h)
        ell = [[j["hip"][0] + w * math.cos(a), 0.02 + 0.07 * math.sin(a)] for a in (i / 16 * math.tau for i in range(16))]
        shadow.line(ell, SHADOW, 0.01, boil=0.006, steps=1, taper=False, cyclic=True, fill=True, outline=False)
    # smears: the striking limb's recent path as parallel speed lines
    for e in EVENTS:
        if e["type"] == "trail" and e["t"] <= t <= e["until"]:
            path = [hand_at(e["by"], e["limb"], t - k * 0.025) for k in range(6)]
            for off in (-0.05, 0.0, 0.05):
                pen.line([[p[0], p[1] + off] for p in path], MAT["dark"], 0.012, boil=0.006, steps=2)
    pen.write(LAYERS["fighters"], f)
    shadow.write(LAYERS["shadows"], f)

# ---------------------------------------------------------------- effects at event frames

fx_frames = {}   # frame -> (front pen, back pen)


def fx(frame):
    if frame not in fx_frames:
        fx_frames[frame] = (Pen(9000 + frame), Pen(9500 + frame))
    return fx_frames[frame]


shake = {}       # frame -> amplitude
for e in EVENTS:
    f0 = int(round(e["t"] * FPS)) + 1
    if e["type"] == "hit":
        c, p = hand_at(e["by"], e["limb"], e["t"]), e["power"]
        for k, f in enumerate(range(f0, f0 + 8, 2)):
            front, back = fx(f)
            grow = 1.0 + 0.45 * k
            rng = random.Random(f)
            back.line(star(c, 0.16 * p * grow, 0.42 * p * grow, 9, rng, rot=0.3 * k), STAR_FILL, 0.02, cyclic=True, steps=1, taper=False, fill=True)
            for i in range(10):
                a = i / 10 * math.tau + rng.uniform(-0.15, 0.15)
                r0, r1 = 0.30 * p * grow, (0.55 + 0.2 * rng.random()) * p * grow
                front.line([[c[0] + r0 * math.cos(a), c[1] + r0 * math.sin(a)], [c[0] + r1 * math.cos(a), c[1] + r1 * math.sin(a)]],
                           MAT["dark"], 0.022, steps=3)
            if p >= 1.0 and k < 2:   # manga focus lines across the frame
                for i in range(28):
                    a = i / 28 * math.tau + rng.uniform(-0.05, 0.05)
                    r0 = rng.uniform(1.6, 2.3)
                    front.line([[c[0] + r0 * math.cos(a), c[1] + r0 * math.sin(a)],
                                [c[0] + 6 * math.cos(a), c[1] + 6 * math.sin(a)]], MAT["dark"], 0.018, steps=2)
        for k in range(int(0.4 * FPS)):
            shake[f0 + k] = max(shake.get(f0 + k, 0), 0.09 * p * (1 - k / (0.4 * FPS)))
    elif e["type"] == "dust":
        x = F.skeleton(F.FIGHT, e["on"], e["t"])["hip"][0]
        for k, f in enumerate(range(f0, f0 + 8, 2)):
            front, _ = fx(f)
            rng = random.Random(f * 7)
            for i in range(5):
                side = -1 if i % 2 else 1
                cx = x + side * (0.25 + 0.22 * k + 0.1 * i) * e["power"]
                front.circle([cx, 0.08 + 0.05 * k + 0.03 * i], (0.06 + 0.03 * k) * e["power"], MAT["dark"], 0.012, n=9)
    elif e["type"] == "ko":
        for k, f in enumerate(range(f0, LAST + 1, 2)):
            front, _ = fx(f)
            size = 0.7 * min(1.0, 0.6 + 0.2 * k)
            ko_letters(front, [F.cam_x((f - 1) / FPS) + 0.25, 2.85], size, MAT["dark"])

ends = set()
for f in sorted(fx_frames):
    front, back = fx_frames[f]
    front.write(LAYERS["fx"], f)
    back.write(LAYERS["fx_back"], f)
    if f + 2 not in fx_frames:
        ends.add(f + 2)
for f in sorted(ends):
    if f <= LAST:
        Pen(0).write(LAYERS["fx"], f)        # empty drawings clear the effect
        Pen(0).write(LAYERS["fx_back"], f)

# keep "fx_back" behind the fighters
order = ["ground", "shadows", "fx_back", "fighters", "fx"]
print("LAYERS", [l.name for l in gpd.layers], "order wanted", order)

# ---------------------------------------------------------------- camera shake, on ones

rng = random.Random(3)
for f in range(1, LAST + 1):
    a = shake.get(f, 0.0)
    cam.location = (F.cam_x((f - 1) / FPS) + a * rng.uniform(-1, 1), -10.0, CAM_Z + a * rng.uniform(-1, 1))
    cam.keyframe_insert("location", frame=f)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "scene.blend"))
print("BUILT drawings", len(range(1, LAST + 1, 2)), "fx frames", len(fx_frames))
