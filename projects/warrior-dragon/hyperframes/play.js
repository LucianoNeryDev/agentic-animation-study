// Draws ../bake.json (as window.BAKE) as a shadow-puppet play. No animation logic:
// frame = round(t * 60), then that frame's baked shapes are drawn. Everything that
// is not in the bake (lamp flicker, embers, flames) is a pure function of t with a
// fixed seed, so any frame renders alone and in any order.
const B = window.BAKE;
const PX = B.px, FPS = B.fps, N = B.frames, EVENTS = B.events, DUR = N / FPS;
const SW = 1792, SH = 1008, S = SW / 1920;  // baked framing is 1920x1080; the screen is 93 % of it
const INK = "#0d0705";

const fi = (t) => Math.min(N - 1, Math.max(0, Math.round(t * FPS)));
const F = (t) => B.data[fi(t)];
const P = (p) => [p[0] * PX, -p[1] * PX];
const clamp01 = (u) => Math.max(0, Math.min(1, u));
const win = (t, t0, len) => (t < t0 || t > t0 + len ? -1 : (t - t0) / len);
const hash = (n, k) => { const x = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const easeOutCubic = (u) => 1 - Math.pow(1 - u, 3);

// seeded PRNG and 1D value noise (lamp flicker, embers, scenery)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const NZ = (() => { const r = mulberry32(20261126); return Float64Array.from({ length: 1024 }, () => r()); })();
const noise = (x) => {
  const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
  const a = NZ[((i % 1024) + 1024) % 1024], b = NZ[(((i + 1) % 1024) + 1024) % 1024];
  return a + (b - a) * s;
};

const cv = document.getElementById("stage");
const ctx = cv.getContext("2d");
const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const silC = document.getElementById("shadows"), sil = silC.getContext("2d");
const dC = mk(SW, SH), dg = dC.getContext("2d");          // dragon puppet with its cut-outs
const wC = mk(SW, SH), wr = wC.getContext("2d");          // warrior puppet with its cut-outs
const softC = document.getElementById("soft"), soft = softC.getContext("2d");
// the lamp's radial gradient, drawn once; each frame only shifts it by whole pixels
const LAMP_PAD = 24;
const lampC = (() => {
  const c = mk(SW + 2 * LAMP_PAD, SH + 2 * LAMP_PAD), g = c.getContext("2d");
  g.setTransform(S, 0, 0, S, LAMP_PAD, LAMP_PAD);
  const gr = g.createRadialGradient(960, 440, 40, 960, 440, 1180);
  gr.addColorStop(0, "#ffdca0"); gr.addColorStop(0.18, "#eeae64"); gr.addColorStop(0.45, "#cb773e");
  gr.addColorStop(0.75, "#8c3c1c"); gr.addColorStop(1, "#2c0f06");
  g.fillStyle = gr; g.fillRect(-60, -60, 2040, 1200);
  return c;
})();

// camera: same mapping as the Motion Canvas drawer (px space, y down), scaled into the screen
const camT = (c, cam, k = 1) => {
  const z = cam[2];
  c.setTransform(S * z, 0, 0, S * z, S * (960 - cam[0] * PX * z * k), S * (540 + cam[1] * PX * z));
};
const screenT = (c) => c.setTransform(S, 0, 0, S, 0, 0);

// ---------------------------------------------------------------- path helpers (px space)
const pathPx = (c, pts, close) => {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  if (close) c.closePath();
};
const fillPx = (c, pts, lw) => { pathPx(c, pts, true); c.fill(); if (lw) { c.lineWidth = lw; c.stroke(); } };
const strokePx = (c, pts, lw) => { pathPx(c, pts, false); c.lineWidth = lw; c.stroke(); };
const fillW = (c, pts, lw) => fillPx(c, pts.map(P), lw);
const strokeW = (c, pts, lw) => strokePx(c, pts.map(P), lw);
const disc = (c, p, r) => { c.beginPath(); c.arc(p[0], p[1], r, 0, Math.PI * 2); c.fill(); };
const ink = (c) => { c.fillStyle = INK; c.strokeStyle = INK; c.lineCap = "round"; c.lineJoin = "round"; };

// ---------------------------------------------------------------- scenery, built once
// Layers further from the screen cast softer, paler shadows: that is the depth cue.
// Each layer is one Path2D (a union under the nonzero rule, so overlaps don't darken;
// windows and arches are wound the other way to cut holes). Drawn as vectors every
// frame: a scaled 4300 px bitmap cost ~20 ms per layer in software, a path fill ~1 ms.
const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a; };
const addPoly = (path, pts, hole = false) => {
  if ((area(pts) > 0) === hole) pts = pts.slice().reverse();
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
  path.closePath();
};
const archPts = (x, y, w, h) => {             // an arched opening: light comes through
  const r = w / 2, pts = [[x - r, y], [x - r, y - h + r]];
  for (let i = 1; i < 12; i++) { const a = Math.PI + (Math.PI * i) / 12; pts.push([x + Math.cos(a) * r, y - h + r + Math.sin(a) * r]); }
  pts.push([x + r, y - h + r], [x + r, y]);
  return pts;
};
const ellPts = (x, y, rx, ry, a0 = 0, a1 = Math.PI * 2, n = 14) =>
  Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [x + Math.cos(a) * rx, y + Math.sin(a) * ry]; });
const jagged = (rnd, x0, x1, y, amp) => {      // a broken top edge, left to right
  const pts = [];
  for (let x = x0; x <= x1; x += 14) pts.push([x, y - amp * rnd()]);
  pts.push([x1, y]);
  return pts;
};
const tower = (path, rnd, x, w, h, crenel) => {
  const pts = [[x, 40]];
  if (crenel) {
    for (let cx = x; cx < x + w - 1; cx += 28) pts.push([cx, -h], [cx + 16, -h], [cx + 16, -h + 20], [cx + 28, -h + 20]);
    pts.push([x + w, -h]);
  } else pts.push(...jagged(rnd, x, x + w, -h, h * 0.25));
  pts.push([x + w, 40]);
  addPoly(path, pts);
};
const ridge = (path, step, fn) => {
  const pts = [[-2600, 80]];
  for (let x = -2600; x <= 2400; x += step) pts.push([x, -fn(x)]);
  pts.push([2400, 80]);
  addPoly(path, pts);
};
const SCENERY = [
  { k: 0.15, color: "rgba(92, 38, 18, 0.30)", halo: [30, 18, 8], build: (path) =>          // far mountains
      ridge(path, 16, (x) => 250 + 120 * Math.sin(x * 0.0023 + 1) + 70 * Math.sin(x * 0.0061 + 2.3) + 30 * noise(x * 0.02 + 300)) },
  { k: 0.4, color: "rgba(58, 22, 10, 0.50)", halo: [10, 4], build: (path, rnd) => {        // the ruined keep
      ridge(path, 20, (x) => 46 + 34 * Math.sin(x * 0.004 + 0.5) + 10 * noise(x * 0.05));
      tower(path, rnd, 230, 150, 540, true); tower(path, rnd, 470, 96, 400, false);
      tower(path, rnd, 380, 90, 270, true);  tower(path, rnd, -1560, 120, 430, false);
      tower(path, rnd, 1300, 110, 330, false);
      addPoly(path, archPts(305, -300, 26, 70), true); addPoly(path, archPts(305, -430, 22, 54), true);
      addPoly(path, archPts(518, -250, 22, 60), true);
      addPoly(path, [[-980, 40], ...jagged(rnd, -980, -420, -250, 90), [-420, 40]]);   // a broken wall, three arches
      for (const ax of [-880, -700, -520]) addPoly(path, archPts(ax, 0, 90, 190), true);
      addPoly(path, [[1000, 40], [1000, -260], ...jagged(rnd, 1000, 1180, -300, 40), [1180, 40]]);   // a lone arch
      addPoly(path, archPts(1090, 0, 110, 210), true);
    } },
  { k: 0.7, color: "rgba(30, 10, 5, 0.78)", halo: [3], build: (path, rnd) => {            // columns, a dead tree, rubble
      const column = (x, h, broken) => {
        addPoly(path, [[x - 34, -24], [x + 34, -24], [x + 34, 6], [x - 34, 6]]);
        addPoly(path, [[x - 22, -20], [x - 22, -h], ...(broken ? jagged(rnd, x - 22, x + 22, -h, 40) : []), [x + 22, -h], [x + 22, -20]]);
        if (!broken) addPoly(path, [[x - 36, -h - 26], [x + 36, -h - 26], [x + 36, -h + 2], [x - 36, -h + 2]]);
      };
      column(-1650, 330, false); column(-1100, 190, true); column(780, 280, true); column(1480, 150, true);
      const branch = (x, y, a, len, w, depth) => {   // a gnarled dead tree: tapered quads plus round joints
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len, w2 = w * 0.66;
        const nx = -Math.sin(a), ny = Math.cos(a);
        addPoly(path, [[x + nx * w / 2, y + ny * w / 2], [x2 + nx * w2 / 2, y2 + ny * w2 / 2], [x2 - nx * w2 / 2, y2 - ny * w2 / 2], [x - nx * w / 2, y - ny * w / 2]]);
        addPoly(path, ellPts(x2, y2, w2 / 2, w2 / 2, 0, Math.PI * 2, 8));
        if (depth === 0) return;
        const n = depth > 2 ? 2 : 2 + (rnd() < 0.5 ? 1 : 0);
        for (let i = 0; i < n; i++) branch(x2, y2, a + (rnd() - 0.5) * 1.3, len * (0.62 + rnd() * 0.18), w2, depth - 1);
      };
      branch(1120, 10, -Math.PI / 2 - 0.12, 170, 30, 5);
      branch(-1320, 10, -Math.PI / 2 + 0.1, 120, 20, 4);
      for (let i = 0; i < 40; i++) {                   // rubble
        const x = -2300 + rnd() * 4300, r = 6 + rnd() * 16;
        addPoly(path, ellPts(x, 2, r * 1.5, r, Math.PI, Math.PI * 2, 10));
      }
    } },
].map((L) => { const path = new Path2D(); L.build(path, mulberry32(Math.round(L.k * 1000))); return { ...L, path }; });
const OUTSIDE = new Path2D(); OUTSIDE.rect(-20000, -20000, 40000, 40000);
const drawScenery = (c, cam) => {
  for (const L of SCENERY) {
    camT(c, cam, L.k);
    c.fillStyle = L.color; c.fill(L.path);
    // soft edge: a few translucent strokes, clipped to the outside of the shape
    c.save();
    const clip = new Path2D(OUTSIDE); clip.addPath(L.path);
    c.clip(clip, "evenodd");
    c.strokeStyle = L.color; c.globalAlpha = 0.33; c.lineJoin = "round";
    for (const w of L.halo) { c.lineWidth = w; c.stroke(L.path); }
    c.restore();
  }
};

// ground: a crisp black floor board with grass tufts (world layer, k = 1)
const TUFTS = (() => {
  const r = mulberry32(99), out = [];
  for (let x = -7000; x < 9000; x += 50 + r() * 110) {
    const blades = [];
    const n = 3 + Math.floor(r() * 3), h = 10 + r() * 22;
    for (let i = 0; i < n; i++) blades.push([(i - n / 2) * 5 + r() * 4, (r() - 0.5) * 0.9, h * (0.6 + r() * 0.5)]);
    out.push([x, blades]);
  }
  return out;
})();
const drawGround = (c) => {
  c.fillRect(-8000, 0, 17500, 1600);
  for (const [x, blades] of TUFTS) {
    for (const [dx, lean, h] of blades) {
      c.beginPath(); c.moveTo(x + dx - 3, 1); c.lineTo(x + dx + Math.sin(lean) * h, -Math.cos(lean) * h); c.lineTo(x + dx + 3, 1); c.fill();
    }
  }
};

// ---------------------------------------------------------------- the warrior puppet
const capePts = (f) => {
  const ch = f.cape.map(P), left = [], right = [];
  ch.forEach((p, i) => {
    const a = ch[Math.max(0, i - 1)], b = ch[Math.min(ch.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], ln = Math.hypot(dx, dy) || 1;
    const nx = -dy / ln, ny = dx / ln, wdt = 10 + 18 * (i / (ch.length - 1));
    left.push([p[0] + nx * wdt, p[1] + ny * wdt]);
    right.push([p[0] - nx * wdt, p[1] - ny * wdt]);
  });
  return [...left, ...right.reverse()];
};
const helmetPts = (f) => {
  const h = P(f.w.head), up = f.w_up, ang = Math.atan2(-up[1], up[0]), pts = [];
  for (let k = 0; k <= 16; k++) {
    const a = ang - Math.PI * 0.56 + (Math.PI * 1.12 * k) / 16;
    pts.push([h[0] + Math.cos(a) * 0.2 * PX, h[1] + Math.sin(a) * 0.2 * PX]);
  }
  return pts;
};
const cut = (c, fn) => { c.save(); c.globalCompositeOperation = "destination-out"; c.fillStyle = "#000"; c.strokeStyle = "#000"; fn(); c.restore(); };
const lerp2 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];

function drawWarrior(c, f) {
  const w = f.w, seg = (...n) => n.map((k) => P(w[k]));
  ink(c);
  fillPx(c, capePts(f), 4);
  strokePx(c, seg("hip", "knee_b", "foot_b"), 21);
  strokePx(c, seg("hip", "neck"), 26);
  strokePx(c, seg("hip", "knee_f", "foot_f"), 22);
  disc(c, P(w.head), 0.17 * PX + 2);
  fillPx(c, helmetPts(f), 4);
  strokeW(c, f.plume, 14);
  strokePx(c, seg("neck", "elbow_b", "hand_b"), 19);
  const sh = P(w.hand_b);
  disc(c, sh, 0.28 * PX + 2.5);
  // shield cut-outs: a ring of holes and the boss, punched before the sword arm goes on top
  cut(c, () => {
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; disc(c, [sh[0] + Math.cos(a) * 37, sh[1] + Math.sin(a) * 37], 4.5); }
    c.lineWidth = 3; c.beginPath(); c.arc(sh[0], sh[1], 17, 0, Math.PI * 2); c.stroke();
    // helmet visor slit and joint rivets of the back limbs
    const up = f.w_up, fw = [up[1], -up[0]], hd = w.head;
    const a = P([hd[0] + fw[0] * 0.05 + up[0] * 0.02, hd[1] + fw[1] * 0.05 + up[1] * 0.02]);
    const b = P([hd[0] + fw[0] * 0.16 + up[0] * 0.02, hd[1] + fw[1] * 0.16 + up[1] * 0.02]);
    c.lineCap = "round"; c.lineWidth = 5; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    disc(c, P(w.knee_f), 3.2); disc(c, P(w.hip), 3.2);
  });
  ink(c);
  strokePx(c, seg("neck", "elbow_f", "hand_f"), 19);
  strokePx(c, seg("hand_f", "tip"), 14);
  strokePx(c, seg("guard_a", "guard_b"), 12);
  strokePx(c, seg("pommel", "hand_f"), 8);
  disc(c, P(w.pommel), 8);
  cut(c, () => {                                   // the blade's fuller and the elbow rivet
    const g = P(lerp2(w.hand_f, w.tip, 0.16)), t = P(lerp2(w.hand_f, w.tip, 0.82));
    c.lineCap = "round"; c.lineWidth = 3.5; c.beginPath(); c.moveTo(g[0], g[1]); c.lineTo(t[0], t[1]); c.stroke();
    disc(c, P(w.elbow_f), 3);
  });
}

// ---------------------------------------------------------------- the dragon puppet
const MEMBRANE = 0.6;   // wing membranes: thin, slightly translucent leather
function wing(c, wg, bonesLw) {
  c.globalAlpha = MEMBRANE; fillW(c, wg.mem, 4); c.globalAlpha = 1;
  for (let i = 0; i < 4; i++) strokeW(c, wg.bones[i], bonesLw);
}
function legs(c, d, near) {
  for (let i = 0; i < 4; i++) {
    if ((i >= 2) !== near) continue;
    strokeW(c, d.legs[i].pts, B.data[0].d.legs[i].w * PX + 8);
    for (let k = 0; k < 3; k++) strokeW(c, d.legs[i].claws[k], 6);
  }
}
function drawDragon(c, d) {
  ink(c);
  wing(c, d.wings.far, 7);
  legs(c, d, false);
  fillW(c, d.body, 6);
  for (const sp of d.spikes) fillW(c, sp, 3);
  // belly scales: a row of cut-outs along the middle of the belly band
  const bl = d.belly.map(P), n = bl.length / 2;
  cut(c, () => {
    for (let i = 1; i < n - 1; i++) {
      const a = bl[i], b = bl[bl.length - 1 - i], m = lerp2(a, b, 0.5);
      const h = Math.hypot(a[0] - b[0], a[1] - b[1]) / 2;
      const r = Math.max(2.2, Math.min(6.5, h * 0.3));
      disc(c, m, r);
    }
  });
  ink(c);
  fillW(c, d.jaw, 5);
  fillW(c, d.skull, 5);
  for (let i = 0; i < 2; i++) strokeW(c, d.teeth[i], 4);
  for (let i = 0; i < 2; i++) strokeW(c, d.horns[i], 13);
  const e = P(d.eye);
  cut(c, () => {
    if (d.eye_open > 0.5) disc(c, e, 9.5);
    else { c.lineWidth = 3.5; c.lineCap = "round"; c.beginPath(); c.moveTo(e[0] - 10, e[1]); c.lineTo(e[0] + 10, e[1]); c.stroke(); }
  });
  ink(c);
  if (d.eye_open > 0.5) { c.beginPath(); c.ellipse(e[0], e[1], 2.6, 7.5, 0, 0, Math.PI * 2); c.fill(); }
  legs(c, d, true);
  cut(c, () => { for (let i = 2; i < 4; i++) disc(c, P(d.legs[i].pts[1]), 4); });   // knee rivets
  ink(c);
  wing(c, d.wings.near, 9);
}

// ---------------------------------------------------------------- light on the screen
const RATE = 120, POOL = 90;
function flameState(k, now) {                     // identical to the Motion Canvas drawer
  const j = k + POOL * Math.floor((now * RATE - k) / POOL);
  const te = j / RATE;
  if (te < 0) return null;
  const src = F(te).d;
  if (src.fire < 0.05) return null;
  const blast = F(te).a >= 9;
  const life = blast ? 0.62 : 0.36, speed = blast ? 8.0 : 9.8;
  const age = now - te;
  if (age < 0 || age > life) return null;
  const u = age / life;
  const ang = ((-src.fire_dir + (hash(j, 1) - 0.5) * 9) * Math.PI) / 180;
  const dist = speed * age * (1 - 0.3 * u) * PX;
  const m = P(src.mouth);
  let x = m[0] + Math.cos(ang) * dist, y = m[1] + Math.sin(ang) * dist - 0.6 * age * age * PX;
  if (!blast) {
    const sx = P(F(now).w.hand_b)[0] + 0.2 * PX;
    if (x < sx) { y -= (sx - x) * (0.8 + 0.8 * hash(j, 2)); x = sx - (sx - x) * 0.25; }
  }
  return { x, y, u, r: (0.12 + 0.34 * u) * PX * (0.75 + 0.5 * hash(j, 3)) };
}
const FLAME_RGB = (u) => (u < 0.12 ? [255, 236, 170] : u < 0.4 ? [255, 168, 40] : u < 0.72 ? [255, 96, 18] : [200, 52, 16]);
const glow = (c, x, y, r, rgb, a) => {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`);
  g.addColorStop(0.45, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a * 0.45})`);
  g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  c.fillStyle = g;
  c.fillRect(x - r, y - r, 2 * r, 2 * r);
};

// embers: screen space, seeded, drifting up through the lamp light
const EMBERS = (() => {
  const r = mulberry32(4242);
  return Array.from({ length: 70 }, () => ({ x: r() * 1920, period: 5 + r() * 7, phase: r(), sway: 20 + r() * 50, f: 0.3 + r() * 0.8, size: 1.6 + r() * 2.6, drift: (r() - 0.3) * 160 }));
})();

const ROAR = EVENTS.find((e) => e.type === "roar");
const VICTORY = EVENTS.find((e) => e.type === "victory");
const PLUNGE = EVENTS.find((e) => e.type === "hit" && e.power >= 1);
const HITS = EVENTS.filter((e) => e.type === "hit");
const DUSTS = EVENTS.filter((e) => e.type === "dust");

function drawLight(c, t, f) {
  const d = f.d, cam = f.cam;
  // the lamp: a warm radial backlight that breathes with a slow seeded flicker
  const flick = 0.6 * noise(t * 2.2) + 0.4 * noise(t * 9 + 50);
  const jx = Math.round((noise(t * 1.3 + 200) - 0.5) * 16), jy = Math.round((noise(t * 1.1 + 400) - 0.5) * 10);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "source-over";
  c.drawImage(lampC, jx - LAMP_PAD, jy - LAMP_PAD);
  // a low dusk sun painted on the screen, barely moving (k = 0.04)
  c.setTransform(S * cam[2], 0, 0, S * cam[2], S * (960 - cam[0] * PX * cam[2] * 0.04), S * (540 + cam[1] * PX * cam[2]));
  c.globalCompositeOperation = "lighter";
  glow(c, -420, -420, 260, [255, 236, 190], 0.30);
  c.globalCompositeOperation = "source-over";
  c.fillStyle = "rgba(255, 244, 214, 0.55)"; disc(c, [-420, -420], 92);
  // scenery shadows, far to near
  drawScenery(c, cam);
  // lamp flicker darkens the whole screen a little
  screenT(c);
  c.fillStyle = `rgba(40, 12, 2, ${0.05 + 0.13 * flick})`; c.fillRect(0, 0, 1920, 1080);

  c.globalCompositeOperation = "lighter";
  // embers rising through the light
  for (const e of EMBERS) {
    const u = (t / e.period + e.phase) % 1;
    const x = e.x + e.drift * u + Math.sin((t + e.phase * 10) * e.f * 2) * e.sway;
    const y = 1100 - u * 1200;
    const a = Math.sin(u * Math.PI) * (0.55 + 0.45 * noise(t * 6 + e.x));
    glow(c, x, y, e.size * 5, [255, 150, 60], 0.55 * a);
    c.fillStyle = `rgba(255, 220, 150, ${0.9 * a})`; disc(c, [x, y], e.size);
  }
  camT(c, cam);
  // fire: the stream lights up the screen behind the puppets ("screen" keeps the orange
  // from washing out to white on the bright lamp)
  c.globalCompositeOperation = "screen";
  if (d.fire > 0.05) {
    const m = P(d.mouth), a = (-d.fire_dir * Math.PI) / 180;
    const cx = m[0] + Math.cos(a) * 380, cy = m[1] + Math.sin(a) * 380;
    glow(c, cx, cy, 950 * d.fire, [255, 96, 16], 0.85 * d.fire);
    glow(c, m[0], m[1], 260, [255, 200, 120], 0.5 * d.fire);
  }
  for (let k = 0; k < POOL; k++) {
    const s = flameState(k, t);
    if (!s) continue;
    glow(c, s.x, s.y, s.r * 1.6, FLAME_RGB(s.u), 0.8 * (1 - s.u * s.u));
  }
  c.globalCompositeOperation = "lighter";
  if (d.fire > 0.05) {
    const m = P(d.mouth), a = (-d.fire_dir * Math.PI) / 180, L = 1.4 * PX * d.fire;
    const e = [m[0] + Math.cos(a) * L, m[1] + Math.sin(a) * L];
    c.lineCap = "round";
    c.strokeStyle = "rgba(255, 170, 60, 0.35)"; strokePx(c, [m, e], 70);
    c.strokeStyle = "rgba(255, 240, 190, 0.9)"; strokePx(c, [m, e], 22 + 5 * Math.sin(t * 60));
  }
  // sword trail: a streak of light following the blade (last eight baked frames)
  if (f.sword_trail) {
    const n = fi(t), outer = [], inner = [];
    for (let k = 0; k < 8; k++) {
      const q = B.data[Math.max(0, n - k)].w, tip = P(q.tip), h = P(q.hand_f);
      outer.push(tip); inner.push(lerp2(h, tip, 0.5));
    }
    c.fillStyle = "rgba(255, 240, 200, 0.55)"; fillPx(c, [...outer, ...inner.reverse()]);
  }
  if (d.claw >= 0.5) {
    const n = fi(t);
    c.strokeStyle = "rgba(255, 200, 150, 0.5)"; c.lineCap = "round";
    strokePx(c, Array.from({ length: 7 }, (_, k) => P(B.data[Math.max(0, n - k)].d.claw_tip)), 22);
  }
  // roar: rings of light ripple out from the jaws
  for (let r = 0; r < 3; r++) {
    const u = win(t, ROAR.t + r * 0.16, 0.8);
    if (u < 0) continue;
    const m = P(d.mouth);
    c.strokeStyle = `rgba(255, 236, 200, ${0.5 * (1 - u)})`;
    c.lineWidth = 16 * (1 - u); c.beginPath(); c.arc(m[0], m[1], 60 + 900 * easeOutCubic(u), 0, Math.PI * 2); c.stroke();
  }
  // hits: a burst of light behind the blow, with rays
  for (const e of HITS) {
    const u = win(t, e.t, 0.34);
    if (u < 0) continue;
    const p = P([e.x, e.y]), pw = e.power;
    const rgb = e.kind === "shield" ? [220, 235, 255] : [255, 236, 170];
    glow(c, p[0], p[1], (180 + 260 * easeOutCubic(u)) * pw, rgb, 0.9 * (1 - u));
    c.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.8 * (1 - u)})`; c.lineCap = "round";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.3, r0 = (0.5 + 1.1 * easeOutCubic(u)) * pw * PX, r1 = r0 + 0.7 * pw * PX * (1 - u);
      c.lineWidth = 10 * (1 - u) + 2;
      strokePx(c, [[p[0] + Math.cos(a) * r0, p[1] + Math.sin(a) * r0], [p[0] + Math.cos(a) * r1, p[1] + Math.sin(a) * r1]]);
    }
  }
  // victory: the lamp swells behind the warrior
  const vu = clamp01((t - VICTORY.t) / 1.1);
  if (vu > 0) {
    const h = P(f.w.head);
    glow(c, h[0], h[1], 760, [255, 214, 140], 0.6 * easeOutCubic(vu));
  }
  c.globalCompositeOperation = "source-over";
}

// ---------------------------------------------------------------- shadows
const puff = (c, x, y, r, a) => {                 // a soft-edged shadow: smoke or dust
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(13, 7, 5, ${a})`); g.addColorStop(0.5, `rgba(13, 7, 5, ${a * 0.7})`); g.addColorStop(1, "rgba(13, 7, 5, 0)");
  c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
};
function drawShadows(t, f) {
  const d = f.d, cam = f.cam;
  sil.setTransform(1, 0, 0, 1, 0, 0); sil.clearRect(0, 0, SW, SH);
  camT(sil, cam); ink(sil);
  drawGround(sil);
  // ground shadows
  sil.globalAlpha = 0.45;
  sil.beginPath(); sil.ellipse(d.shadow[0] * PX, 6, (d.shadow[1] * PX) / 2, 14, 0, 0, Math.PI * 2); sil.fill();
  sil.beginPath(); sil.ellipse(f.w.hip[0] * PX, 5, 0.3 * PX, 10, 0, 0, Math.PI * 2); sil.fill();
  sil.globalAlpha = 1;
  for (const [c, C, draw] of [[dg, dC, () => drawDragon(dg, d)], [wr, wC, () => drawWarrior(wr, f)]]) {
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, SW, SH);
    camT(c, cam); draw();
    sil.setTransform(1, 0, 0, 1, 0, 0); sil.drawImage(C, 0, 0);
  }
  camT(sil, cam); ink(sil);
  // smoke puffs and dust: thin, soft shadows
  for (let k = 0; k < 14; k++) {
    const j = k + 14 * Math.floor((t * 9 - k) / 14), te = j / 9, age = t - te, fa = F(te).a;
    const on = (fa > 7.45 && fa < 8.6) || (fa > 14.08 && fa < 15.1);
    if (!on || age < 0 || age > 1.5) continue;
    const m = P(F(te).d.mouth), u = age / 1.5;
    puff(sil, m[0] + (hash(j, 4) - 0.5) * 40, m[1] - age * 70, (30 + 60 * u) * 0.75, 0.5 * (1 - u));
  }
  for (const e of DUSTS) {
    const u = win(t, e.t, 0.8);
    if (u < 0) continue;
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? -1 : 1, k = 1 + Math.floor(i / 2), eu = easeOutCubic(clamp01(u));
      puff(sil, e.x * PX + side * (40 + 70 * k * eu) * e.power, -16 - 26 * k * eu * e.power, ((34 + 16 * k) * e.power * (0.6 + eu)) * 0.7, 0.7 * (1 - u));
    }
  }
  sil.globalAlpha = 1;
}

// ---------------------------------------------------------------- one frame
function draw(t) {
  const n = fi(t);
  const f = B.data[n], tt = n / FPS;   // draw exactly the baked frame's time
  drawLight(ctx, tt, f);
  drawShadows(tt, f);
  // penumbra: the puppets are not quite flat on the screen, so each shadow has a soft edge
  soft.setTransform(1, 0, 0, 1, 0, 0); soft.clearRect(0, 0, SW / 4, SH / 4);
  soft.drawImage(silC, 0, 0, SW / 4, SH / 4);
  // the plunge: the lamp flares over everything
  const u = win(tt, PLUNGE.t, 0.14);
  if (u >= 0) { sil.setTransform(1, 0, 0, 1, 0, 0); sil.fillStyle = `rgba(255, 246, 225, ${0.6 * (1 - u)})`; sil.fillRect(0, 0, SW, SH); }
}

// ---------------------------------------------------------------- proscenium, built once
(function buildFrame() {
  const NS = "http://www.w3.org/2000/svg", svg = document.getElementById("frame");
  const el = (tag, attrs, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
  const defs = el("defs", {});
  const wood = el("linearGradient", { id: "wood", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el("stop", { offset: 0, "stop-color": "#2a120a" }, wood); el("stop", { offset: 0.5, "stop-color": "#1a0905" }, wood); el("stop", { offset: 1, "stop-color": "#2a120a" }, wood);
  const vel = el("linearGradient", { id: "velvet", x1: 0, y1: 0, x2: 1, y2: 0, spreadMethod: "repeat", gradientUnits: "userSpaceOnUse" }, defs);
  vel.setAttribute("x2", 64);
  el("stop", { offset: 0, "stop-color": "#3d0b0b" }, vel); el("stop", { offset: 0.5, "stop-color": "#6a1612" }, vel); el("stop", { offset: 1, "stop-color": "#3d0b0b" }, vel);
  // frame around the opening
  el("path", { d: "M0 0H1920V1080H0Z M64 36V1044H1856V36Z", fill: "url(#wood)", "fill-rule": "evenodd" });
  el("rect", { x: 58, y: 30, width: 1804, height: 1020, fill: "none", stroke: "#b88a3e", "stroke-width": 4, rx: 3 });
  el("rect", { x: 48, y: 20, width: 1824, height: 1040, fill: "none", stroke: "#6b4a22", "stroke-width": 2, rx: 4 });
  // side curtains, tied back
  const curtain = (side) => {
    const x0 = side < 0 ? 64 : 1856, s = side < 0 ? 1 : -1;
    const d = `M${x0} 36 L${x0 + s * 150} 36 C${x0 + s * 120} 300 ${x0 + s * 40} 560 ${x0 + s * 34} 690
               C${x0 + s * 46} 820 ${x0 + s * 80} 960 ${x0 + s * 96} 1044 L${x0} 1044 Z`;
    el("path", { d, fill: "url(#velvet)", stroke: "#1a0504", "stroke-width": 3 });
    el("ellipse", { cx: x0 + s * 30, cy: 690, rx: 26, ry: 11, fill: "#b88a3e", stroke: "#4a2d10", "stroke-width": 2 });
  };
  curtain(-1); curtain(1);
  // the valance: velvet swags with a gold fringe
  let d = "M64 36 H1856 V70";
  const sw = 1792 / 9;
  for (let i = 8; i >= 0; i--) { const xa = 64 + (i + 1) * sw, xb = 64 + i * sw; d += ` L${xa} 70 Q${(xa + xb) / 2} 140 ${xb} 70`; }
  d += " Z";
  el("path", { d, fill: "url(#velvet)", stroke: "#1a0504", "stroke-width": 3 });
  const fr = el("g", { stroke: "#c9a052", "stroke-width": 5, fill: "none" });
  for (let i = 0; i < 9; i++) {
    const xa = 64 + i * sw, xb = xa + sw;
    el("path", { d: `M${xa} 74 Q${(xa + xb) / 2} 144 ${xb} 74` }, fr);
    el("circle", { cx: xa, cy: 82, r: 9, fill: "#c9a052", stroke: "none" });
  }
  el("circle", { cx: 1856, cy: 82, r: 9, fill: "#c9a052" });
  el("rect", { x: 40, y: 1044, width: 1840, height: 36, fill: "#1f0c06" });
  el("line", { x1: 40, y1: 1046, x2: 1880, y2: 1046, stroke: "#b88a3e", "stroke-width": 3 });
})();
