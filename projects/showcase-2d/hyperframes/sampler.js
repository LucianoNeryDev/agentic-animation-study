// A plain-JavaScript port of fight.py's sampler (as in ../motion-canvas/src/fight.ts),
// so this route evaluates the same pose on the same frame as the other three.
// Browser: load after fight.js (which sets window.FIGHT); exposes window.Fight.
// verify-sampler.cjs runs this same file in a Node vm with a stub window for the parity check.
(function (root) {
  function make(FIGHT) {
    const ease = (kind, u) => {
      if (kind === "linear") return u;
      if (kind === "in") return u * u;
      if (kind === "out") return 1 - (1 - u) * (1 - u);
      if (kind === "hold") return 0;
      return u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2;
    };
    const resolve = (k) => {
      const p = FIGHT.poses[k.pose];
      return { x: k.x, y: k.y ?? p.y, rot: k.rot ?? 0, torso: p.torso, hf: p.hf, hb: p.hb, ff: p.ff, fb: p.fb };
    };
    const lerp = (a, b, u) => a + (b - a) * u;
    const lerpV = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];

    function sample(name, t) {
      const keys = FIGHT.fighters[name].keys;
      if (t <= keys[0].t) return resolve(keys[0]);
      for (let i = 0; i + 1 < keys.length; i++) {
        const k0 = keys[i], k1 = keys[i + 1];
        if (t < k1.t) {
          const u = ease(k1.ease, (t - k0.t) / (k1.t - k0.t));
          const a = resolve(k0), b = resolve(k1);
          return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), rot: lerp(a.rot, b.rot, u), torso: lerp(a.torso, b.torso, u),
            hf: lerpV(a.hf, b.hf, u), hb: lerpV(a.hb, b.hb, u), ff: lerpV(a.ff, b.ff, u), fb: lerpV(a.fb, b.fb, u) };
        }
      }
      return resolve(keys[keys.length - 1]);
    }

    function ik(base, target, l1, l2, bend) {
      const dx = target[0] - base[0], dy = target[1] - base[1];
      const d = Math.min(Math.max(Math.hypot(dx, dy), 1e-4), l1 + l2 - 1e-4);
      const a = Math.atan2(dy, dx);
      const c = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
      const j = a + bend * Math.acos(c);
      return [[base[0] + l1 * Math.cos(j), base[1] + l1 * Math.sin(j)], [base[0] + d * Math.cos(a), base[1] + d * Math.sin(a)]];
    }

    /** World-space joints at time t: hip, neck, head (centre), elbows, hands, knees, feet. */
    function skeleton(name, t) {
      const b = FIGHT.bones, s = sample(name, t), facing = FIGHT.fighters[name].facing;
      const tr = (s.torso * Math.PI) / 180;
      const up = [Math.sin(tr), Math.cos(tr)];
      const neck = [up[0] * b.torso, up[1] * b.torso];
      const pts = { hip: [0, 0], neck, head: [neck[0] + up[0] * b.neck, neck[1] + up[1] * b.neck] };
      for (const side of ["f", "b"]) {
        const h = s["h" + side];
        [pts["elbow_" + side], pts["hand_" + side]] = ik(neck, [neck[0] + h[0], neck[1] + h[1]], b.upper_arm, b.forearm, -1);
        [pts["knee_" + side], pts["foot_" + side]] = ik([0, 0], s["f" + side], b.thigh, b.shin, 1);
      }
      const r = (s.rot * Math.PI) / 180, cr = Math.cos(r), sr = Math.sin(r);
      const out = {};
      for (const k in pts) {
        const [px, py] = pts[k];
        out[k] = [s.x + facing * (px * cr - py * sr), s.y + (px * sr + py * cr)];
      }
      return out;
    }

    /** Polylines to draw, back limbs first: [part, points]. */
    const strokes = (j) => [
      ["back", [j.neck, j.elbow_b, j.hand_b]],
      ["back", [j.hip, j.knee_b, j.foot_b]],
      ["body", [j.hip, j.neck]],
      ["front", [j.hip, j.knee_f, j.foot_f]],
      ["front", [j.neck, j.elbow_f, j.hand_f]],
    ];

    /** The shared camera pan: world x at the frame centre, eased in-out between keys. */
    function camX(t) {
      const pan = FIGHT.view.pan;
      if (t <= pan[0][0]) return pan[0][1];
      for (let i = 0; i + 1 < pan.length; i++) {
        const [t0, x0] = pan[i], [t1, x1] = pan[i + 1];
        if (t < t1) return x0 + (x1 - x0) * ease("inout", (t - t0) / (t1 - t0));
      }
      return pan[pan.length - 1][1];
    }

    const LIMB = { hf: "hand_f", hb: "hand_b", ff: "foot_f", fb: "foot_b" };
    return { FIGHT, ease, sample, skeleton, strokes, camX, LIMB };
  }

  root.Fight = make(root.FIGHT);
})(window);
