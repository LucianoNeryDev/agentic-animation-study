"""Warrior vs Dragon: choreography, rigs and bake.

Everything about the motion lives here. `python3 choreo.py bake` evaluates it at
60 fps and writes bake.json: per frame, the camera and every shape to draw (world
units, ground at y = 0, y up). The Godot and Motion Canvas versions only draw it.

  python3 choreo.py bake                  # write bake.json
  python3 choreo.py preview 3.5 9.2 ...   # PIL contact sheet of those times (seconds)

Keys are written in *action time*. Hit-stops freeze action time while real time
runs on, so both characters, the cape and the fire freeze together.
"""
import json, math, random, sys

FPS = 60
FRAMES = 1200                       # 20 s
PX = 200                            # pixels per world unit at zoom 1
GROUND_PX = 300                     # ground sits this far below the frame centre at the base camera height
STOPS = [(9.15, 0.12), (11.6, 0.10), (14.2, 0.10), (16.2, 0.22)]   # (action time, length) hit-stops


def action_time(t):
    acc = 0.0
    for a0, d in STOPS:
        start = a0 + acc
        if t < start:
            break
        if t < start + d:
            return a0, True
        acc += d
    return t - acc, False


def real_time(a):
    return a + sum(d for a0, d in STOPS if a0 < a)


# ------------------------------------------------------------------ keyframe sampler

def ease(kind, u):
    if kind == "linear":
        return u
    if kind == "in":
        return u * u
    if kind == "out":
        return 1 - (1 - u) * (1 - u)
    if kind == "hold":
        return 0.0
    if kind == "step":
        return 0.0 if u < 1 else 1.0
    return 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2


def lerp(a, b, u):
    if isinstance(a, list):
        return [lerp(x, y, u) for x, y in zip(a, b)]
    return a + (b - a) * u


class Track:
    """Keys: (t, pose name or None, ease, overrides). Missing fields carry forward."""

    def __init__(self, poses, defaults):
        self.poses, self.defaults, self.keys = poses, defaults, []

    def key(self, t, pose=None, ease_kind="inout", **kw):
        prev = self.keys[-1][1] if self.keys else dict(self.defaults)
        state = dict(prev)
        if pose:
            state.update(self.poses[pose])
        state.update(kw)
        self.keys.append((t, state, ease_kind))
        return self

    def at(self, t):
        ks = self.keys
        if t <= ks[0][0]:
            return dict(ks[0][1])
        for (t0, s0, _), (t1, s1, e) in zip(ks, ks[1:]):
            if t < t1:
                u = ease(e, (t - t0) / (t1 - t0))
                return {k: lerp(s0[k], s1[k], u) for k in s1}
        return dict(ks[-1][1])


def rot(p, deg):
    r = math.radians(deg)
    c, s = math.cos(r), math.sin(r)
    return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]


def add(a, b):
    return [a[0] + b[0], a[1] + b[1]]


def sub(a, b):
    return [a[0] - b[0], a[1] - b[1]]


def mul(a, k):
    return [a[0] * k, a[1] * k]


def dirv(deg):
    r = math.radians(deg)
    return [math.cos(r), math.sin(r)]


def ik(base, target, l1, l2, bend):
    dx, dy = target[0] - base[0], target[1] - base[1]
    d = min(max(math.hypot(dx, dy), 1e-4), l1 + l2 - 1e-4)
    a = math.atan2(dy, dx)
    c = max(-1.0, min(1.0, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
    j = a + bend * math.acos(c)
    return [base[0] + l1 * math.cos(j), base[1] + l1 * math.sin(j)], [base[0] + d * math.cos(a), base[1] + d * math.sin(a)]


# ------------------------------------------------------------------ warrior

WB = {"torso": 0.62, "neck": 0.22, "head": 0.17, "upper_arm": 0.33, "forearm": 0.31, "thigh": 0.43, "shin": 0.43}


def gp(y, torso, hf, hb, ffx, fbx, sw, lift_f=0.0, lift_b=0.0):
    """A grounded pose: feet targets on the ground (optionally lifted)."""
    return {"y": y, "torso": torso, "hf": hf, "hb": hb, "ff": [ffx, -y + lift_f], "fb": [fbx, -y + lift_b], "sw": sw}


def ap(torso, hf, hb, ff, fb, sw):
    """An airborne pose: feet relative to the hip; y comes from the key."""
    return {"torso": torso, "hf": hf, "hb": hb, "ff": ff, "fb": fb, "sw": sw}


WPOSES = {
    "walk_a":  gp(0.80, 6, [0.02, -0.46], [0.18, -0.40], 0.30, -0.30, -70),
    "walk_pa": gp(0.84, 6, [0.08, -0.46], [0.08, -0.42], 0.00, 0.02, -65, lift_b=0.16),
    "walk_b":  gp(0.80, 6, [0.16, -0.44], [-0.04, -0.42], -0.30, 0.30, -60),
    "walk_pb": gp(0.84, 6, [0.08, -0.46], [0.08, -0.42], 0.02, 0.00, -65, lift_f=0.16),
    "guard":   gp(0.78, 6, [0.32, -0.04], [0.26, -0.12], 0.30, -0.32, 55),
    "look_up": gp(0.80, -12, [0.12, -0.30], [0.24, 0.30], 0.26, -0.30, 25),
    "brace":   gp(0.68, 14, [-0.06, -0.30], [0.38, 0.04], 0.40, -0.46, -30),
    "block":   gp(0.64, 22, [-0.10, -0.26], [0.42, 0.02], 0.42, -0.52, -20),
    "crouch":  gp(0.55, 30, [-0.26, -0.12], [0.22, -0.20], 0.35, -0.46, 165),
    "run_a":   gp(0.74, 22, [-0.26, -0.22], [0.26, -0.14], 0.45, -0.42, 170, lift_b=0.22),
    "run_b":   gp(0.74, 22, [-0.22, -0.26], [0.24, -0.16], -0.42, 0.45, 170, lift_f=0.26),
    "sprint_a": gp(0.72, 32, [-0.30, -0.20], [0.30, -0.10], 0.55, -0.50, 175, lift_b=0.28),
    "sprint_b": gp(0.72, 32, [-0.26, -0.24], [0.28, -0.12], -0.50, 0.55, 175, lift_f=0.30),
    "leap":    ap(-8, [-0.28, 0.32], [0.26, -0.06], [0.26, -0.46], [-0.34, -0.66], 150),
    "slash":   ap(14, [0.56, -0.18], [-0.06, -0.20], [0.30, -0.56], [-0.30, -0.60], -5),
    "land":    gp(0.52, 26, [0.46, -0.34], [0.16, -0.24], 0.36, -0.44, -20),
    "tuck":    ap(10, [0.22, -0.30], [0.22, -0.24], [0.26, -0.34], [0.14, -0.40], -10),
    "knocked": ap(-25, [-0.30, 0.30], [-0.08, 0.34], [0.36, -0.64], [0.10, -0.70], 120),
    "kneel":   {"y": 0.47, "torso": 14, "hf": [0.22, -0.40], "hb": [0.22, -0.10], "ff": [0.30, -0.47], "fb": [-0.36, -0.40], "sw": 5},
    "slide":   {"y": 0.46, "torso": -42, "hf": [-0.26, -0.34], "hb": [0.20, 0.10], "ff": [0.58, -0.44], "fb": [-0.08, -0.30], "sw": -150},
    "upslash": gp(0.80, -6, [0.36, 0.46], [-0.06, -0.24], 0.34, -0.34, 72),
    "overhead": ap(-10, [0.04, 0.56], [-0.10, 0.20], [0.20, -0.50], [-0.20, -0.60], 100),
    "plunge":  ap(4, [0.20, -0.56], [-0.26, 0.10], [0.24, -0.50], [-0.26, -0.56], -90),
    "victory": gp(0.82, -4, [0.24, 0.62], [-0.16, -0.36], 0.24, -0.26, 85),
}

W = Track(WPOSES, {"x": -6.0, "rot": 0.0, **WPOSES["walk_a"]})


def walk(track, t0, t1, x0, x1, steps, kinds=("walk_a", "walk_pa", "walk_b", "walk_pb")):
    n = steps * 2
    for i in range(n + 1):
        u = i / n
        track.key(t0 + (t1 - t0) * u, kinds[i % 4], "linear", x=x0 + (x1 - x0) * u)


# 0.0-2.4 walk in, stop in guard
W.key(0.0, "walk_a", x=-6.0)
walk(W, 0.0, 2.2, -6.0, -2.6, 4)
W.key(2.45, "guard", "out", x=-2.6)
# 2.4-3.2 a shadow passes: look up, shield up
W.key(2.85, "look_up")
W.key(3.6, "look_up", "hold")
# landing and roar: brace
W.key(4.05, "brace", x=-2.65)
W.key(5.5, "brace", "hold")
# fire on the shield: pushed back
W.key(5.7, "block", x=-2.7)
W.key(7.4, "block", "linear", x=-3.25)
W.key(7.75, "guard", x=-3.25)
W.key(8.05, "crouch", x=-3.2)
# charge
W.key(8.25, "run_a", "out", x=-2.75)
W.key(8.4, "run_b", "linear", x=-2.15)
W.key(8.55, "run_a", "linear", x=-1.55)
W.key(8.7, "crouch", "linear", x=-1.05)
# leap and slash the neck
W.key(8.95, "leap", "out", x=-0.2, y=1.6)
W.key(9.15, "slash", "in", x=0.4, y=1.9)
W.key(9.35, "slash", "out", x=0.55, y=1.6)
W.key(9.62, "land", "in", x=0.6, rot=0.0)
W.key(9.95, "guard", x=0.55)
# claw swipe: backflip over it
W.key(10.12, "crouch", x=0.5)
W.key(10.3, "tuck", "out", x=0.0, y=1.30, rot=110)
W.key(10.47, "tuck", "linear", x=-0.65, y=1.95, rot=220)
W.key(10.66, "tuck", "linear", x=-1.35, y=1.35, rot=330)
W.key(10.82, "land", "in", x=-1.7, rot=360)
W.key(11.1, "block", x=-1.7, rot=360)
# bite into the shield: knocked back, roll, get up
W.key(11.6, "block", "hold", x=-1.7, rot=360)
W.key(11.78, "knocked", "out", x=-2.35, y=1.25, rot=380)
W.key(12.12, "knocked", "in", x=-3.45, y=0.45, rot=440)
W.key(12.3, "tuck", "linear", x=-3.8, y=0.38, rot=560)
W.key(12.55, "tuck", "linear", x=-4.15, y=0.40, rot=700)
W.key(12.72, "kneel", "out", x=-4.25, rot=720)
W.key(13.02, "sprint_a", x=-4.0, rot=720)
# sprint and knee-slide under the fire stream, pop up into a slash
W.key(13.17, "sprint_b", "linear", x=-3.45)
W.key(13.32, "sprint_a", "linear", x=-2.85)
W.key(13.45, "slide", "out", x=-2.2)
W.key(13.9, "slide", "linear", x=0.15)
W.key(14.05, "crouch", "out", x=0.45)
W.key(14.2, "upslash", "in", x=0.70)
W.key(14.45, "guard", x=0.55)
# step back, crouch, high leap with a front flip, plunge into the head
W.key(14.8, "guard", x=0.05)
W.key(15.02, "crouch", x=0.0)
W.key(15.3, "overhead", "out", x=0.25, y=2.6, rot=720)
W.key(15.6, "overhead", "linear", x=0.55, y=3.05, rot=630)
W.key(15.9, "overhead", "linear", x=0.8, y=2.75, rot=360 + 360 - 360)
W.key(16.2, "plunge", "in", x=1.0, y=1.95, rot=360)
W.key(16.35, "plunge", "out", x=0.85, y=2.15, rot=360)
W.key(16.65, "land", "in", x=0.2, rot=360)
W.key(17.15, "land", "hold", x=0.2, rot=360)
W.key(17.5, "guard", x=0.1, rot=360)
W.key(18.1, "victory", x=0.05, rot=360)
W.key(19.5, "victory", "hold", x=0.05, rot=360)


def warrior_skeleton(s):
    b = WB
    tr = math.radians(s["torso"])
    up = [math.sin(tr), math.cos(tr)]
    neck = mul(up, b["torso"])
    head = add(neck, mul(up, b["neck"]))
    pts = {"hip": [0.0, 0.0], "neck": neck, "head": head}
    for side in "fb":
        pts["elbow_" + side], pts["hand_" + side] = ik(neck, add(neck, s["h" + side]), b["upper_arm"], b["forearm"], -1)
        pts["knee_" + side], pts["foot_" + side] = ik([0, 0], s["f" + side], b["thigh"], b["shin"], 1)
    out = {}
    for k, p in pts.items():
        r = rot(p, s["rot"])
        out[k] = [s["x"] + r[0], s["y"] + r[1]]
    # sword: hilt in the front hand, angle in the body frame
    d = dirv(s["sw"] + s["rot"])
    h = out["hand_f"]
    out["pommel"] = add(h, mul(d, -0.12))
    out["tip"] = add(h, mul(d, 1.05))
    g = add(h, mul(d, 0.09))
    n = [-d[1], d[0]]
    out["guard_a"], out["guard_b"] = add(g, mul(n, 0.12)), add(g, mul(n, -0.12))
    out["up"] = rot(up, s["rot"])                  # body "up", for the helmet
    return out


# ------------------------------------------------------------------ dragon

DPOSES = {
    "fly":     {"pitch": -8, "nk": [1.2, 0.9], "ha": -10, "jaw": 8, "ws": 1.0, "fa": 38, "fl": 0, "tc": -20, "ta": 10,
                "fn": [0.5, None], "ff": [0.35, None], "bn": [0.2, None], "bf": [0.05, None]},
    "stand":   {"pitch": 0, "nk": [1.1, 1.2], "ha": 0, "jaw": 6, "ws": 0.15, "fa": 0, "fl": 0, "tc": 8, "ta": 6,
                "fn": [0.18, 0.0], "ff": [0.40, 0.0], "bn": [0.10, 0.0], "bf": [0.30, 0.0]},
    "roar":    {"pitch": 22, "nk": [0.6, 1.75], "ha": 38, "jaw": 58, "ws": 1.0, "fa": 6, "fl": 10, "tc": 30, "ta": 10,
                "fn": [0.55, 0.55], "ff": [0.75, 0.35], "bn": [0.20, 0.0], "bf": [0.40, 0.0]},
    "breathe": {"pitch": 0, "nk": [1.25, 0.90], "ha": -9, "jaw": 42, "ws": 0.45, "fa": 0, "fl": 5, "tc": 10, "ta": 6,
                "fn": [0.10, 0.0], "ff": [0.45, 0.0], "bn": [0.10, 0.0], "bf": [0.30, 0.0]},
    "recoil":  {"pitch": 10, "nk": [0.6, 1.6], "ha": 32, "jaw": 46, "ws": 0.6, "fa": 0, "fl": 15, "tc": 25, "ta": 8,
                "fn": [0.10, 0.0], "ff": [0.40, 0.0], "bn": [0.10, 0.0], "bf": [0.30, 0.0]},
    "rear":    {"pitch": 16, "nk": [0.7, 1.7], "ha": 26, "jaw": 20, "ws": 0.9, "fa": 0, "fl": 8, "tc": 20, "ta": 6,
                "fn": [0.40, 0.45], "ff": [0.55, 0.25], "bn": [0.15, 0.0], "bf": [0.35, 0.0]},
    "blast":   {"pitch": 4, "nk": [1.9, 0.58], "ha": -4, "jaw": 46, "ws": 0.6, "fa": 0, "fl": 25, "tc": 12, "ta": 6,
                "fn": [0.15, 0.0], "ff": [0.45, 0.0], "bn": [0.10, 0.0], "bf": [0.30, 0.0]},
    "stagger": {"pitch": -10, "nk": [1.3, -0.45], "ha": -32, "jaw": 50, "ws": 0.5, "fa": 0, "fl": 40, "tc": -5, "ta": 4,
                "fn": [0.30, 0.0], "ff": [0.55, 0.0], "bn": [0.05, 0.0], "bf": [0.25, 0.0]},
    "fallen":  {"pitch": -6, "nk": [1.45, -0.40], "ha": -14, "jaw": 24, "ws": 0.85, "fa": 0, "fl": 85, "tc": -14, "ta": 0,
                "fn": [0.55, 0.0], "ff": [0.75, 0.0], "bn": [-0.30, 0.0], "bf": [-0.10, 0.0]},
}
DEF = {"x": 6.5, "y": 7.5, "eye": 1.0, "fire": 0.0, "claw": 0.0}


def dpose(name, y=None):
    """Resolve feet heights: None means hanging (relative to the body), else ground y."""
    p = dict(DPOSES[name])
    for k in ("fn", "ff", "bn", "bf"):
        dx, fy = p[k]
        p[k] = [dx, -1.25 if fy is None else fy]
        p[k + "_hang"] = 1.0 if fy is None else 0.0
    return p


D = Track({k: dpose(k) for k in DPOSES}, {**DEF, **dpose("fly")})
D.key(0.0, "fly", x=6.5, y=7.5)
D.key(2.4, "fly", "linear", x=5.6, y=6.6)
D.key(3.95, "fly", "in", x=2.8, y=1.45)
D.key(4.05, "stand", "out", x=2.8, y=1.02)
D.key(4.35, "stand", x=2.8, y=1.25)
D.key(4.75, "roar", "out")
D.key(5.3, "roar", "hold")
D.key(5.62, "breathe", fire=0.0)
D.key(5.8, "breathe", "linear", fire=1.0, ha=-8)
D.key(6.5, "breathe", "linear", fire=1.0, ha=-11)
D.key(7.3, "breathe", "linear", fire=1.0, ha=-8)
D.key(7.5, "breathe", "linear", fire=0.0)
D.key(8.0, "stand")
D.key(8.6, "stand", nk=[0.75, 1.75], ha=25, jaw=22, pitch=4)       # head up to strike: neck exposed
D.key(9.15, "stand", "hold", nk=[0.75, 1.75], ha=25, jaw=22, pitch=4)
D.key(9.42, "recoil", "out")
D.key(9.9, "stand")
D.key(10.25, "stand", pitch=8, fn=[-0.05, 1.15], claw=0.0)            # claw raised
D.key(10.45, "stand", "in", pitch=2, fn=[1.30, 0.38], claw=1.0)       # swipe
D.key(10.62, "stand", "out", pitch=0, fn=[1.55, 0.04], claw=1.0)
D.key(11.0, "stand", fn=[0.18, 0.0], claw=0.0)
D.key(11.3, "stand", nk=[0.75, 1.5], ha=16, jaw=32, pitch=4)           # bite: draw back
D.key(11.6, "stand", "in", x=2.55, nk=[2.15, -0.12], ha=-8, jaw=8, pitch=-6)
D.key(11.75, "stand", "hold", x=2.55, nk=[2.15, -0.12], ha=-8, jaw=8, pitch=-6)
D.key(12.3, "stand", x=2.8)
D.key(13.25, "rear")
D.key(13.4, "blast", "out", fire=0.0)
D.key(13.5, "blast", "linear", fire=1.0)
D.key(13.95, "blast", "linear", fire=1.0, ha=-6)
D.key(14.08, "blast", "linear", fire=0.0)
D.key(14.2, "blast", "hold")
D.key(14.6, "stagger", "out", x=3.15)
D.key(15.2, "stagger", y=1.18, nk=[1.25, -0.40])
D.key(15.8, "stagger", y=1.22, nk=[1.32, -0.47])
D.key(16.2, "stagger", "hold", y=1.22, nk=[1.32, -0.47])
D.key(16.4, "stagger", "out", jaw=62, ha=-24)
D.key(17.3, "fallen", "in", y=0.58, eye=0.0)
D.key(17.55, "fallen", "out", y=0.62)
D.key(17.8, "fallen", y=0.58)
D.key(19.5, "fallen", "hold")

FACING = -1           # the dragon faces left
TAIL_N, TAIL_LEN = 12, 3.3
NECK_N = 10


def dragon(s, a):
    f = FACING

    def body(lp):          # pitched body-local point -> world
        r = rot(lp, s["pitch"])
        return [s["x"] + f * r[0], s["y"] + r[1]]

    def world(lp):         # unpitched local point (already relative to the root) -> world
        return [s["x"] + f * lp[0], s["y"] + lp[1]]

    def to_local(wp):
        return [(wp[0] - s["x"]) * f, wp[1] - s["y"]]

    hip_l, sh_l = rot([-1.05, 0.05], s["pitch"]), rot([1.0, 0.25], s["pitch"])
    # tail: from the hip backwards, curling and swaying
    tail = [hip_l]
    ang = 180 + s["pitch"] - 12
    p = hip_l
    seg = TAIL_LEN / TAIL_N
    for i in range(TAIL_N):
        ang += s["tc"] / TAIL_N - 0.0
        wave = s["ta"] * math.sin(2 * math.pi * 0.45 * a - i * 0.5) * (i / TAIL_N)
        d = dirv(ang + wave)
        p = [p[0] + d[0] * seg, max(-s["y"] + 0.06, p[1] + d[1] * seg)]
        tail.append(p)
    # body spine hip -> shoulder with a hump
    bodyc = []
    for i in range(7):
        u = i / 6
        c = [lerp(-1.05, 1.0, u), lerp(0.05, 0.25, u) + 0.22 * math.sin(math.pi * u)]
        bodyc.append(rot(c, s["pitch"]))
    # neck: cubic Bezier from the shoulder to the head base
    head_base = add(sh_l, rot(s["nk"], s["pitch"]))
    hd = dirv(s["ha"])
    p0, p1 = sh_l, add(sh_l, rot([0.35, 0.75], s["pitch"]))
    p2, p3 = sub(head_base, mul(hd, 0.6)), head_base
    neck = []
    for i in range(1, NECK_N + 1):
        u = i / NECK_N
        q = [(1 - u) ** 3 * p0[k] + 3 * (1 - u) ** 2 * u * p1[k] + 3 * (1 - u) * u * u * p2[k] + u ** 3 * p3[k] for k in range(2)]
        neck.append(q)
    spine_l = list(reversed(tail)) + bodyc[1:] + neck
    n_tail = len(tail)
    radii = ([0.04 + 0.32 * (i / (n_tail - 1)) ** 1.3 for i in range(n_tail)]
             + [0.48, 0.58, 0.64, 0.64, 0.60, 0.52]
             + [lerp(0.44, 0.19, (i + 1) / NECK_N) for i in range(NECK_N)])
    # outline from the centre line and the radius profile
    left, right, normals = [], [], []
    for i, c in enumerate(spine_l):
        a0, b0 = spine_l[max(0, i - 1)], spine_l[min(len(spine_l) - 1, i + 1)]
        t_ = sub(b0, a0)
        ln = math.hypot(*t_) or 1.0
        nrm = [-t_[1] / ln, t_[0] / ln]
        normals.append(nrm)
        left.append(add(c, mul(nrm, radii[i])))
        right.append(sub(c, mul(nrm, radii[i])))
    outline = [world(p) for p in left + list(reversed(right))]
    belly_idx = range(n_tail - 2, len(spine_l))
    belly = [world(sub(spine_l[i], mul(normals[i], radii[i] * 0.15))) for i in belly_idx] + \
            [world(sub(spine_l[i], mul(normals[i], radii[i] * 0.98))) for i in reversed(belly_idx)]
    spikes = []
    for i in range(3, len(spine_l) - 2, 2):
        c, nrm, r = spine_l[i], normals[i], radii[i]
        t_ = [nrm[1], -nrm[0]]
        h = 0.10 + 0.22 * r
        base = add(c, mul(nrm, r * 0.92))
        spikes.append([world(add(base, mul(t_, 0.09))), world(add(base, mul(nrm, h))), world(sub(base, mul(t_, 0.09)))])

    # head in its own frame (x along the head, y up), then into local, then world
    def head(p):
        return world(add(head_base, rot(p, s["ha"])))

    hinge = [0.15, -0.08]

    def jawp(p):
        return head(add(hinge, rot(sub(p, hinge), -s["jaw"])))

    skull = [head(p) for p in [[-0.12, -0.12], [-0.06, 0.20], [0.30, 0.27], [0.56, 0.21], [1.0, 0.11], [1.13, 0.03],
                               [1.06, -0.05], [0.55, -0.07], [0.15, -0.10]]]
    jaw = [jawp(p) for p in [[0.12, -0.07], [0.98, -0.06], [1.02, -0.11], [0.60, -0.21], [0.12, -0.20]]]
    teeth_up = [head(p) for p in [[0.95, -0.05], [0.88, -0.13], [0.80, -0.06], [0.72, -0.13], [0.64, -0.06], [0.56, -0.12], [0.50, -0.06]]]
    teeth_lo = [jawp(p) for p in [[0.92, -0.06], [0.86, 0.01], [0.78, -0.06], [0.70, 0.01], [0.62, -0.06]]]
    horns = [[head(p) for p in [[0.10, 0.20], [-0.22, 0.42], [-0.58, 0.46]]],
             [head(p) for p in [[0.02, 0.10], [-0.26, 0.20], [-0.48, 0.16]]]]
    eye = head([0.46, 0.12])
    mouth_l = add(head_base, rot(add(hinge, rot(sub([1.0, -0.06], hinge), -s["jaw"] / 2)), s["ha"]))
    mouth = world(mouth_l)
    fire_ang = s["ha"] - s["jaw"] * 0.15

    # wings
    def wing(scale, dang, spread):
        w0, w1 = rot([0.55, 0.62], s["pitch"]), rot([-0.70, 0.52], s["pitch"])
        flap = s["fl"] + s["fa"] * math.sin(2 * math.pi * 2.6 * a)
        A = lerp(168, 112, spread) + flap + s["pitch"] + dang
        elbow = add(w0, mul(dirv(A), 1.0 * scale))
        B = A + lerp(-168, 22, spread) + 0.6 * flap
        wrist = add(elbow, mul(dirv(B), 1.15 * scale))
        tips = []
        for k, ln in enumerate([1.75, 1.95, 1.6]):
            C = B + lerp(178 + 6 * k, 52 + 32 * k, spread)
            tips.append(add(wrist, mul(dirv(C), ln * scale * lerp(0.5, 1.0, spread))))
        mem = [w0, elbow, wrist, tips[0]]
        for k in range(2):
            mid = mul(add(tips[k], tips[k + 1]), 0.5)
            mem.append(lerp(mid, wrist, 0.22))
            mem.append(tips[k + 1])
        mem.append(w1)
        def wp(p):
            q = world(p)
            return [q[0], max(0.03, q[1])]
        return {"bones": [[wp(w0), wp(elbow), wp(wrist)]] + [[wp(wrist), wp(t)] for t in tips],
                "mem": [wp(p) for p in mem]}

    wings = {"far": wing(0.92, 9, s["ws"] * 0.95), "near": wing(1.0, 0, s["ws"])}

    # legs: front from the shoulder, back from the hip; foot targets are [dx forward, ground y]
    legs = []
    for key, base_l, l1, l2, bend, near, dxo in (("ff", add(sh_l, [-0.05, -0.22]), 0.72, 0.80, 1, False, 0.0),
                                                 ("bf", add(hip_l, [0.12, -0.25]), 0.78, 0.82, -1, False, 0.0),
                                                 ("fn", add(sh_l, [-0.15, -0.25]), 0.72, 0.80, 1, True, 0.0),
                                                 ("bn", add(hip_l, [0.0, -0.28]), 0.78, 0.82, -1, True, 0.0)):
        dx, gy = s[key]
        hang = s[key + "_hang"]
        tgt_ground = [base_l[0] + dx + dxo, gy - s["y"]]
        tgt_hang = add(base_l, [dx * 0.6, -1.25])
        tgt = lerp(tgt_ground, tgt_hang, hang)
        knee, foot = ik(base_l, tgt, l1, l2, bend)
        claws = [[world(foot), world(add(foot, mul(dirv(-10 + 25 * k), 0.22)))] for k in range(3)]
        legs.append({"near": near, "pts": [world(base_l), world(knee), world(foot)], "claws": claws,
                     "w": 0.30 if key[0] == "b" else 0.24})
    shadow = [s["x"], max(0.4, 3.0 - 0.25 * max(0.0, s["y"] - 1.25))]

    return {"body": outline, "belly": belly, "spikes": spikes, "skull": skull, "jaw": jaw,
            "teeth": [teeth_up, teeth_lo], "horns": horns, "eye": eye, "eye_open": s["eye"],
            "wings": wings, "legs": legs, "mouth": mouth, "fire_dir": 180 - fire_ang if f < 0 else fire_ang,
            "fire": s["fire"], "claw_tip": legs[2]["pts"][2], "claw": s["claw"], "shadow": shadow}


# ------------------------------------------------------------------ world: camera, wind, events

class Keys1D:
    def __init__(self, keys):
        self.keys = keys            # (t, value, ease)

    def at(self, t):
        ks = self.keys
        if t <= ks[0][0]:
            return ks[0][1]
        for (t0, v0, _), (t1, v1, e) in zip(ks, ks[1:]):
            if t < t1:
                return lerp(v0, v1, ease(e, (t - t0) / (t1 - t0)))
        return ks[-1][1]


# camera: [centre x, centre y, zoom] in action time
CAM = Keys1D([
    (0.0, [-4.6, 1.5, 1.0], "linear"), (2.3, [-2.2, 1.5, 1.0], "inout"), (3.6, [0.4, 1.8, 0.88], "inout"),
    (4.3, [0.5, 1.95, 0.84], "inout"), (5.4, [0.5, 1.95, 0.84], "inout"), (7.8, [0.2, 1.75, 0.9], "inout"), (8.8, [-0.2, 1.75, 0.95], "inout"), (9.6, [0.2, 1.65, 0.95], "inout"),
    (11.2, [-0.5, 1.6, 0.92], "inout"), (12.6, [-1.3, 1.6, 0.92], "inout"), (13.9, [0.3, 1.65, 0.92], "inout"),
    (15.3, [0.7, 1.9, 0.92], "inout"), (16.5, [0.9, 1.6, 0.95], "inout"), (17.9, [0.9, 1.6, 0.95], "inout"),
    (19.5, [-0.1, 1.45, 1.12], "inout"),
])
# wind on the cape (+x blows toward the dragon); roar and fire blow it back
WIND = Keys1D([(0.0, -0.8, "linear"), (4.6, -0.8, "linear"), (4.8, -6.0, "out"), (5.4, -2.0, "inout"),
               (5.8, -4.5, "inout"), (7.4, -4.5, "inout"), (7.8, -0.8, "inout"), (13.4, -0.8, "inout"),
               (13.6, -3.0, "inout"), (14.1, -0.8, "inout"), (18.5, -0.8, "inout"), (18.9, -2.5, "inout")])

HITS = [  # action time, kind, power
    (9.15, "slash", 0.7), (11.6, "shield", 0.6), (14.2, "slash", 0.8), (16.2, "plunge", 1.0)]


def hit_point(a, kind):
    w = warrior_skeleton({**W.at(a)})
    if kind == "shield":
        return w["hand_b"]
    if kind == "plunge":
        return lerp(w["hand_f"], w["tip"], 0.75)
    return lerp(w["hand_f"], w["tip"], 0.7)


def events():
    ev = []
    for a, kind, p in HITS:
        x, y = hit_point(a, kind)
        stop = next(d for a0, d in STOPS if a0 == a)
        ev.append({"t": round(real_time(a), 4), "type": "hit", "kind": kind, "x": round(x, 3), "y": round(y, 3),
                   "power": p, "stop": stop})
    for a, x, p in [(4.05, 2.8, 1.0), (9.62, 0.35, 0.35), (10.82, -1.7, 0.3), (12.12, -3.45, 0.5), (14.6, 3.0, 0.4),
                    (16.65, 0.2, 0.4), (17.3, 2.0, 1.0)]:
        ev.append({"t": round(real_time(a), 4), "type": "dust", "x": x, "power": p})
    ev.append({"t": round(real_time(4.75), 4), "type": "roar"})
    ev.append({"t": round(real_time(18.2), 4), "type": "victory"})
    return sorted(ev, key=lambda e: e["t"])


def shake_at(t, evs):
    amp = 0.0
    for e in evs:
        if e["type"] in ("hit", "dust", "roar"):
            p = {"hit": e.get("power", 0.5) * 0.12, "dust": e.get("power", 0.5) * 0.10, "roar": 0.07}[e["type"]]
            dur = 0.9 if e["type"] == "roar" else 0.45
            u = (t - e["t"]) / dur
            if 0 <= u <= 1:
                amp = max(amp, p * (1 - u) ** 2)
    return amp


# ------------------------------------------------------------------ simulation: cape and plume

class Chain:
    def __init__(self, n, seg):
        self.n, self.seg = n, seg
        self.p = None

    def step(self, anchor, dt, wind, phase, gravity=-9.0, drag=0.985):
        if self.p is None:
            self.p = [[anchor[0] - i * self.seg * 0.3, anchor[1] - i * self.seg] for i in range(self.n)]
            self.q = [list(v) for v in self.p]
        for i in range(1, self.n):
            v = sub(self.p[i], self.q[i])
            self.q[i] = list(self.p[i])
            flutter = 1.6 * math.sin(phase * 9.0 + i * 1.3) * (i / self.n)
            self.p[i] = add(self.p[i], add(mul(v, drag), mul([wind, gravity + flutter], dt * dt)))
        self.p[0] = list(anchor)
        self.q[0] = list(anchor)
        for _ in range(10):
            for i in range(self.n - 1):
                a_, b_ = self.p[i], self.p[i + 1]
                d = sub(b_, a_)
                ln = math.hypot(*d) or 1e-6
                corr = mul(d, (ln - self.seg) / ln)
                if i == 0:
                    self.p[i + 1] = sub(b_, corr)
                else:
                    self.p[i] = add(a_, mul(corr, 0.5))
                    self.p[i + 1] = sub(b_, mul(corr, 0.5))
            for i in range(1, self.n):
                if self.p[i][1] < 0.02:
                    self.p[i][1] = 0.02
        return [list(v) for v in self.p]


# ------------------------------------------------------------------ bake

def r3(v):
    if isinstance(v, list):
        return [r3(x) for x in v]
    if isinstance(v, dict):
        return {k: r3(x) for k, x in v.items()}
    if isinstance(v, float):
        return round(v, 3)
    return v


def bake():
    evs = events()
    cape, plume = Chain(9, 0.12), Chain(4, 0.07)
    frames = []
    rng = random.Random(7)
    last_a = None
    hp = {"warrior": 1.0, "dragon": 1.0}
    for fi in range(FRAMES):
        t = fi / FPS
        a, frozen = action_time(t)
        ws = W.at(a)
        w = warrior_skeleton(ws)
        d = dragon(D.at(a), a)
        # cape hangs from the shoulders, plume from the helmet top; frozen during hit-stops
        back = rot([-0.07, -0.02], ws["torso"] + ws["rot"])
        anchor = add(w["neck"], back)
        crest = add(w["head"], mul(w["up"], 0.2))
        if not frozen and a != last_a:
            for sub_i in range(2):
                ph = a + sub_i / (FPS * 2)
                cp = cape.step(anchor, 1 / (FPS * 2), WIND.at(a), ph)
                pl = plume.step(crest, 1 / (FPS * 2), WIND.at(a) * 1.2, ph, gravity=-4.0)
        else:
            cp = [list(v) for v in cape.p] if cape.p else cape.step(anchor, 1 / (FPS * 2), WIND.at(a), a)
            pl = [list(v) for v in plume.p] if plume.p else plume.step(crest, 1 / (FPS * 2), WIND.at(a), a)
        last_a = a
        cx, cy, z = CAM.at(a)
        amp = shake_at(t, evs)
        rng.seed(1000 + fi)
        cx += amp * rng.uniform(-1, 1)
        cy += amp * rng.uniform(-1, 1)
        punch = 0.0
        for e in evs:
            if e["type"] == "hit" and e["power"] >= 1.0:
                if e["t"] <= t < e["t"] + e["stop"]:
                    punch = min(1.0, (t - e["t"]) / 0.05)
                elif t >= e["t"] + e["stop"]:
                    punch = max(punch, (1 - min(1.0, (t - e["t"] - e["stop"]) / 0.5)) ** 2)
        if punch > 0:
            hit = next(e for e in evs if e["type"] == "hit" and e["power"] >= 1.0)
            k = 0.16 * punch
            cx, cy, z = lerp(cx, hit["x"], k * 2.5), lerp(cy, hit["y"], k * 2.5), z * (1 + k)
        for e in evs:
            if e["type"] == "hit" and t >= e["t"] and (e["t"] > t - 1 / FPS):
                if e["kind"] == "shield":
                    hp["warrior"] = 0.62
                else:
                    hp["dragon"] = {0.7: 0.68, 0.8: 0.36, 1.0: 0.0}[e["power"]]
        if a >= 5.8 and a < 7.4:
            hp["warrior"] = min(hp["warrior"], 1.0 - 0.06 * (a - 5.8) / 1.6)
        frames.append(r3({
            "a": a, "frozen": frozen, "cam": [cx, cy, z],
            "w": {k: v for k, v in w.items() if k != "up"}, "w_up": w["up"],
            "cape": cp, "plume": pl,
            "sword_trail": 1 if (8.95 <= a <= 9.3 or 14.02 <= a <= 14.3 or 15.95 <= a <= 16.25) else 0,
            "d": d, "hp": dict(hp),
        }))
    out = {"fps": FPS, "frames": FRAMES, "px": PX, "ground_px": GROUND_PX, "events": evs, "data": frames}
    with open("bake.json", "w") as fh:
        json.dump(out, fh, separators=(",", ":"))
    print("baked", FRAMES, "frames;", len(evs), "events")
    return out


# ------------------------------------------------------------------ preview (PIL)

def preview(times, data=None):
    from PIL import Image, ImageDraw
    if data is None:
        with open("bake.json") as fh:
            data = json.load(fh)
    Wd, Hd = 640, 360
    cols = 4
    sheet = Image.new("RGB", (Wd * cols, Hd * ((len(times) + cols - 1) // cols)), "white")
    for i, ts in enumerate(times):
        fi = min(FRAMES - 1, int(round(ts * FPS)))
        fr = data["data"][fi]
        im = Image.new("RGB", (Wd, Hd), (226, 214, 196))
        g = ImageDraw.Draw(im)
        cx, cy, z = fr["cam"]
        sc = PX * z * Wd / 1920

        def P(p):
            return (Wd / 2 + (p[0] - cx) * sc, Hd / 2 - (p[1] - cy) * sc)
        g.line([P([cx - 20, 0]), P([cx + 20, 0])], fill=(70, 60, 50), width=2)
        d = fr["d"]
        g.polygon([P(p) for p in d["wings"]["far"]["mem"]], fill=(120, 40, 40))
        for L in d["legs"]:
            if not L["near"]:
                g.line([P(p) for p in L["pts"]], fill=(90, 30, 30), width=max(1, int(L["w"] * sc)))
        g.polygon([P(p) for p in d["body"]], fill=(170, 50, 45))
        g.polygon([P(p) for p in d["belly"]], fill=(220, 170, 110))
        for sp in d["spikes"]:
            g.polygon([P(p) for p in sp], fill=(110, 30, 30))
        g.polygon([P(p) for p in d["jaw"]], fill=(150, 40, 40))
        g.polygon([P(p) for p in d["skull"]], fill=(170, 50, 45))
        for h in d["horns"]:
            g.line([P(p) for p in h], fill=(240, 230, 200), width=3)
        e = P(d["eye"])
        g.ellipse([e[0] - 3, e[1] - 3, e[0] + 3, e[1] + 3], fill=(255, 220, 0) if d["eye_open"] > 0.5 else (60, 0, 0))
        for L in d["legs"]:
            if L["near"]:
                g.line([P(p) for p in L["pts"]], fill=(190, 60, 55), width=max(1, int(L["w"] * sc)))
        g.polygon([P(p) for p in d["wings"]["near"]["mem"]], fill=(200, 70, 60))
        for b in d["wings"]["near"]["bones"]:
            g.line([P(p) for p in b], fill=(110, 30, 30), width=2)
        if d["fire"] > 0.05:
            m = d["mouth"]
            ang = math.radians(d["fire_dir"])
            g.line([P(m), P([m[0] + 3.5 * math.cos(ang), m[1] + 3.5 * math.sin(ang)])], fill=(255, 140, 0), width=int(10 * d["fire"]) + 1)
        w = fr["w"]
        g.line([P(p) for p in fr["cape"]], fill=(160, 20, 30), width=6)
        for a_, b_ in [("neck", "elbow_b"), ("elbow_b", "hand_b"), ("hip", "knee_b"), ("knee_b", "foot_b"), ("hip", "neck"),
                       ("hip", "knee_f"), ("knee_f", "foot_f"), ("neck", "elbow_f"), ("elbow_f", "hand_f")]:
            g.line([P(w[a_]), P(w[b_])], fill=(30, 30, 40), width=4)
        h = P(w["head"])
        r = 0.17 * sc
        g.ellipse([h[0] - r, h[1] - r, h[0] + r, h[1] + r], fill=(120, 125, 135))
        g.line([P(p) for p in fr["plume"]], fill=(200, 30, 30), width=3)
        g.line([P(w["pommel"]), P(w["tip"])], fill=(200, 200, 210), width=3)
        s_ = P(w["hand_b"])
        rs = 0.27 * sc
        g.ellipse([s_[0] - rs, s_[1] - rs, s_[0] + rs, s_[1] + rs], outline=(90, 60, 20), fill=(150, 100, 40), width=2)
        g.text((6, 4), f"{ts:.2f}s  a={fr['a']:.2f}", fill=(0, 0, 0))
        sheet.paste(im, ((i % cols) * Wd, (i // cols) * Hd))
    sheet.save("previews/choreo.png")
    print("wrote previews/choreo.png")


if __name__ == "__main__":
    if sys.argv[1] == "bake":
        bake()
    else:
        preview([float(x) for x in sys.argv[2:]])
