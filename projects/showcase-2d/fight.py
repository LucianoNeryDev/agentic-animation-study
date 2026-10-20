"""The stick-figure fight, as data plus a reference sampler.

Units: ground at y = 0, up is +y, a standing figure is about 1.8 tall.
Poses are in the fighter's own frame (facing right, origin at the hip):
  y      hip height
  torso  lean from vertical in degrees, + leans forward
  hf hb  front/back hand target, relative to the neck
  ff fb  front/back foot target, relative to the hip
Keys place a pose at a time: x (world), optional y and rot (whole-body
rotation about the hip, degrees, + tips backward), and the easing of the
segment that ends at this key.

  python3 fight.py json                 # write fight.json for the other routes
  python3 fight.py preview t1 t2 ...    # PIL contact sheet of those times
"""
import json, math, sys

FPS_HINT = 24
DURATION = 4.5
BONES = {"torso": 0.62, "neck": 0.22, "head": 0.17, "upper_arm": 0.33, "forearm": 0.31, "thigh": 0.43, "shin": 0.43}


def grounded(y, torso, hf, hb, ffx, fbx):
    return {"y": y, "torso": torso, "hf": hf, "hb": hb, "ff": [ffx, -y], "fb": [fbx, -y]}


POSES = {
    "guard":       grounded(0.78, 8, [0.34, 0.08], [0.20, -0.02], 0.32, -0.30),
    "guard_dip":   grounded(0.74, 10, [0.33, 0.04], [0.19, -0.05], 0.32, -0.30),
    "wind":        grounded(0.72, -8, [0.10, 0.06], [0.06, -0.06], 0.26, -0.38),
    "lunge":       grounded(0.68, 24, [0.63, 0.10], [-0.14, -0.16], 0.62, -0.64),
    "block":       grounded(0.76, -6, [0.16, 0.32], [0.22, 0.02], 0.30, -0.34),
    "recoil":      grounded(0.76, 2, [0.28, 0.10], [0.18, -0.02], 0.30, -0.32),
    "chamber":     {"y": 0.84, "torso": -12, "hf": [0.24, 0.10], "hb": [-0.18, -0.12], "ff": [0.30, -0.36], "fb": [-0.06, -0.84]},
    "kick":        {"y": 0.84, "torso": -28, "hf": [0.06, -0.24], "hb": [-0.32, 0.12], "ff": [0.60, 0.62], "fb": [-0.10, -0.84]},
    "kick_follow": {"y": 0.82, "torso": -14, "hf": [0.16, -0.10], "hb": [-0.24, 0.04], "ff": [0.40, -0.40], "fb": [-0.10, -0.82]},
    "duck":        grounded(0.40, 42, [0.30, 0.10], [0.20, 0.00], 0.40, -0.44),
    "load":        grounded(0.40, 44, [0.08, -0.34], [0.26, 0.08], 0.40, -0.44),
    "uppercut":    grounded(0.72, 14, [0.36, 0.22], [0.14, -0.08], 0.36, -0.30),
    "upper_high":  grounded(0.86, 0, [0.36, 0.50], [0.10, -0.12], 0.30, -0.24),
    "victory":     grounded(0.86, -2, [0.30, 0.55], [-0.14, -0.30], 0.16, -0.16),
    # airborne and lying: feet relative to the hip in the rotated body frame
    "launched":    {"y": 0, "torso": -10, "hf": [-0.30, 0.40], "hb": [0.10, 0.50], "ff": [0.30, -0.70], "fb": [-0.15, -0.80]},
    "tumble":      {"y": 0, "torso": -20, "hf": [-0.45, 0.20], "hb": [-0.10, 0.55], "ff": [0.45, -0.55], "fb": [0.10, -0.80]},
    "lying":       {"y": 0.17, "torso": 0, "hf": [-0.10, 0.55], "hb": [0.25, -0.35], "ff": [-0.12, -0.84], "fb": [0.05, -0.80]},
    "lying_twitch": {"y": 0.17, "torso": 0, "hf": [-0.10, 0.55], "hb": [0.25, -0.35], "ff": [0.20, -0.80], "fb": [0.05, -0.80]},
}


def key(t, pose, x, ease="inout", **kw):
    return {"t": round(t, 4), "pose": pose, "x": round(x, 4), "ease": ease, **kw}


BLUE = [
    key(0.00, "guard", -1.30),
    key(0.25, "guard_dip", -1.28),
    key(0.50, "guard", -1.30),
    key(0.68, "wind", -1.45),                 # anticipation
    key(0.84, "lunge", 0.10, "in"),           # jab lands on the block
    key(0.94, "lunge", 0.10, "hold"),         # hit-stop
    key(1.15, "recoil", -0.35, "out"),
    key(1.42, "duck", -0.35, "out"),          # ducks under the kick
    key(1.74, "load", -0.22),
    key(1.86, "uppercut", 0.35, "in"),        # uppercut lands
    key(2.02, "uppercut", 0.35, "hold"),      # hit-stop
    key(2.30, "upper_high", 0.42, "out"),
    key(2.70, "guard", 0.36),
    key(3.10, "victory", 0.36),
    key(3.22, "victory", 0.36, "out", y=0.97),  # little hop
    key(3.36, "victory", 0.36, "in"),
    key(4.50, "victory", 0.36),
]


def flight():
    """Red's launch: a ballistic arc sampled into linear keys, then bounce and slide."""
    t0, x0, y0, vx, vy, g = 2.02, 0.95, 0.76, 2.4, 5.0, 14.0
    keys, t = [], t0 + 0.05
    while True:
        tau = t - t0
        y = y0 + vy * tau - 0.5 * g * tau * tau
        if y <= 0.30:
            break
        pose = "launched" if tau < 0.25 else "tumble" if tau < 0.6 else "lying"
        keys.append(key(t, pose, x0 + vx * tau, "linear", y=round(y, 4), rot=round(min(1.0, tau / 0.8) * 100, 2)))
        t += 0.05
    tau = (vy + math.sqrt(vy * vy - 2 * g * (0.30 - y0))) / g   # lands at y = 0.30
    land = t0 + tau
    keys.append(key(land, "lying", x0 + vx * tau, "linear", y=0.30, rot=100))
    keys.append(key(land + 0.10, "lying", x0 + vx * tau + 0.14, "out", y=0.38, rot=86))
    keys.append(key(land + 0.20, "lying", x0 + vx * tau + 0.24, "in", y=0.17, rot=90))
    keys.append(key(land + 0.48, "lying", x0 + vx * tau + 0.34, "out", y=0.17, rot=90))
    return keys, land


FLIGHT, LAND = flight()
RED = [
    key(0.00, "guard", 1.30),
    key(0.25, "guard_dip", 1.28),
    key(0.50, "guard", 1.30),
    key(0.70, "guard", 1.30),
    key(0.80, "block", 1.32, "out"),
    key(0.94, "block", 1.32, "hold"),
    key(1.15, "recoil", 1.55, "out"),         # pushed back by the jab
    key(1.32, "chamber", 1.10),               # steps in, knee up
    key(1.47, "kick", 0.90, "in"),            # kick whiffs over the duck
    key(1.62, "kick_follow", 0.95, "out"),
    key(1.86, "recoil", 0.95),
    key(2.02, "recoil", 0.95, "hold"),        # hit-stop
    *FLIGHT,
    key(3.90, "lying", FLIGHT[-1]["x"], "linear", y=0.17, rot=90),
    key(4.02, "lying_twitch", FLIGHT[-1]["x"], "out", y=0.17, rot=90),
    key(4.16, "lying", FLIGHT[-1]["x"], "in", y=0.17, rot=90),
    key(4.50, "lying", FLIGHT[-1]["x"], "linear", y=0.17, rot=90),
]

EVENTS = [
    {"t": 0.70, "type": "trail", "by": "blue", "limb": "hf", "until": 0.86},
    {"t": 0.84, "type": "hit", "by": "blue", "limb": "hf", "power": 0.45, "stop": 0.10},
    {"t": 1.36, "type": "trail", "by": "red", "limb": "ff", "until": 1.62},
    {"t": 1.76, "type": "trail", "by": "blue", "limb": "hf", "until": 1.88},
    {"t": 1.86, "type": "hit", "by": "blue", "limb": "hf", "power": 1.0, "stop": 0.16},
    {"t": round(LAND, 4), "type": "dust", "on": "red", "power": 1.0},
    {"t": round(LAND + 0.20, 4), "type": "dust", "on": "red", "power": 0.5},
    {"t": round(LAND + 0.30, 4), "type": "ko"},
]

# Shared framing for 1920x1080: pixels per unit, how far below the centre the
# ground line sits, and the camera pan: [t, world x at the frame centre] keys,
# eased in-out between them (sample with cam_x).
VIEW = {"px_per_unit": 260, "ground_below_center_px": 330,
        "pan": [[0.0, 0.0], [1.0, 0.0], [2.2, 1.3], [3.1, 2.2]]}

FIGHT = {
    "duration": DURATION, "fps_hint": FPS_HINT, "bones": BONES, "poses": POSES, "view": VIEW,
    "fighters": {
        "blue": {"facing": 1, "color": "#2563eb", "keys": BLUE},
        "red": {"facing": -1, "color": "#e23d3d", "keys": RED},
    },
    "events": EVENTS,
}

# ------------------------------------------------------------------ sampler


def ease(kind, u):
    if kind == "linear":
        return u
    if kind == "in":
        return u * u
    if kind == "out":
        return 1 - (1 - u) * (1 - u)
    if kind == "hold":
        return 0.0
    return 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2


def cam_x(t, view=None):
    pan = (view or VIEW)["pan"]
    if t <= pan[0][0]:
        return pan[0][1]
    for (t0, x0), (t1, x1) in zip(pan, pan[1:]):
        if t < t1:
            return x0 + (x1 - x0) * ease("inout", (t - t0) / (t1 - t0))
    return pan[-1][1]


def resolve(k, poses):
    p = poses[k["pose"]]
    return {"x": k["x"], "y": k.get("y", p["y"]), "rot": k.get("rot", 0.0), "torso": p["torso"],
            "hf": p["hf"], "hb": p["hb"], "ff": p["ff"], "fb": p["fb"]}


def lerp(a, b, u):
    if isinstance(a, list):
        return [lerp(x, y, u) for x, y in zip(a, b)]
    return a + (b - a) * u


def sample(fight, name, t):
    keys = fight["fighters"][name]["keys"]
    if t <= keys[0]["t"]:
        return resolve(keys[0], fight["poses"])
    for k0, k1 in zip(keys, keys[1:]):
        if t < k1["t"]:
            u = ease(k1["ease"], (t - k0["t"]) / (k1["t"] - k0["t"]))
            a, b = resolve(k0, fight["poses"]), resolve(k1, fight["poses"])
            return {f: lerp(a[f], b[f], u) for f in a}
    return resolve(keys[-1], fight["poses"])


def ik(base, target, l1, l2, bend):
    dx, dy = target[0] - base[0], target[1] - base[1]
    d = min(max(math.hypot(dx, dy), 1e-4), l1 + l2 - 1e-4)
    a = math.atan2(dy, dx)
    c = max(-1.0, min(1.0, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
    j = a + bend * math.acos(c)
    return [base[0] + l1 * math.cos(j), base[1] + l1 * math.sin(j)], [base[0] + d * math.cos(a), base[1] + d * math.sin(a)]


def skeleton(fight, name, t):
    """World-space joints: hip, neck, head (centre), elbows, hands, knees, feet."""
    b, s = fight["bones"], sample(fight, name, t)
    facing = fight["fighters"][name]["facing"]
    tr = math.radians(s["torso"])
    up = (math.sin(tr), math.cos(tr))
    neck = [up[0] * b["torso"], up[1] * b["torso"]]
    head = [neck[0] + up[0] * b["neck"], neck[1] + up[1] * b["neck"]]
    pts = {"hip": [0.0, 0.0], "neck": neck, "head": head}
    for side in "fb":
        hand = [neck[0] + s["h" + side][0], neck[1] + s["h" + side][1]]
        pts["elbow_" + side], pts["hand_" + side] = ik(neck, hand, b["upper_arm"], b["forearm"], -1)
        pts["knee_" + side], pts["foot_" + side] = ik([0, 0], s["f" + side], b["thigh"], b["shin"], 1)
    r = math.radians(s["rot"])
    cr, sr = math.cos(r), math.sin(r)
    out = {}
    for k, (px, py) in pts.items():
        rx, ry = px * cr - py * sr, px * sr + py * cr
        out[k] = [s["x"] + facing * rx, s["y"] + ry]
    return out


def strokes(j):
    """Polylines to draw, back limbs first: (part, points)."""
    return [
        ("back", [j["neck"], j["elbow_b"], j["hand_b"]]),
        ("back", [j["hip"], j["knee_b"], j["foot_b"]]),
        ("body", [j["hip"], j["neck"]]),
        ("front", [j["hip"], j["knee_f"], j["foot_f"]]),
        ("front", [j["neck"], j["elbow_f"], j["hand_f"]]),
    ]


def preview(times, out="preview.png"):
    from PIL import Image, ImageDraw
    W, H, S, GY = 480, 270, 52, 210
    sheet = Image.new("RGB", (W * 4, H * ((len(times) + 3) // 4)), "white")
    for i, t in enumerate(times):
        im = Image.new("RGB", (W, H), (242, 237, 227))
        d = ImageDraw.Draw(im)
        P = lambda p: (W / 2 + p[0] * S, GY - p[1] * S)
        d.line([(0, GY), (W, GY)], fill=(60, 60, 60), width=2)
        for name in ("red", "blue"):
            j = skeleton(FIGHT, name, t)
            col = (37, 99, 235) if name == "blue" else (226, 61, 61)
            for part, pl in strokes(j):
                d.line([P(p) for p in pl], fill=col, width=5, joint="curve")
            hx, hy = P(j["head"])
            r = FIGHT["bones"]["head"] * S
            d.ellipse([hx - r, hy - r, hx + r, hy + r], fill=col)
        d.text((6, 4), f"{t:.2f}s", fill=(0, 0, 0))
        sheet.paste(im, ((i % 4) * W, (i // 4) * H))
    sheet.save(out)


if __name__ == "__main__":
    if sys.argv[1] == "json":
        with open("fight.json", "w") as f:
            json.dump(FIGHT, f, indent=1)
        print("wrote fight.json; Red lands at", round(LAND, 3))
    else:
        preview([float(a) for a in sys.argv[2:]])
