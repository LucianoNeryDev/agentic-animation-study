// The shared choreography (../fight.json, copied in as src/fight.json) and a
// port of fight.py's sampler, so every route evaluates identical poses.
import data from './fight.json';

export type V = [number, number];
export type Joints = Record<string, V>;
type Pose = {y: number; torso: number; hf: V; hb: V; ff: V; fb: V};
type Key = {t: number; pose: string; x: number; ease: string; y?: number; rot?: number};
export type FightEvent = {t: number; type: string; by?: string; on?: string; limb?: string;
  until?: number; power?: number; stop?: number};

export const FIGHT = data as unknown as {
  duration: number; bones: Record<string, number>; poses: Record<string, Pose>;
  view: {px_per_unit: number; ground_below_center_px: number; pan: [number, number][]};
  fighters: Record<string, {facing: number; color: string; keys: Key[]}>;
  events: FightEvent[];
};

function ease(kind: string, u: number) {
  if (kind === 'linear') return u;
  if (kind === 'in') return u * u;
  if (kind === 'out') return 1 - (1 - u) * (1 - u);
  if (kind === 'hold') return 0;
  return u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2;
}

function resolve(k: Key) {
  const p = FIGHT.poses[k.pose];
  return {x: k.x, y: k.y ?? p.y, rot: k.rot ?? 0, torso: p.torso, hf: p.hf, hb: p.hb, ff: p.ff, fb: p.fb};
}
type S = ReturnType<typeof resolve>;

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerpV = (a: V, b: V, u: number): V => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];

function sample(name: string, t: number): S {
  const keys = FIGHT.fighters[name].keys;
  if (t <= keys[0].t) return resolve(keys[0]);
  for (let i = 0; i + 1 < keys.length; i++) {
    const k0 = keys[i], k1 = keys[i + 1];
    if (t < k1.t) {
      const u = ease(k1.ease, (t - k0.t) / (k1.t - k0.t));
      const a = resolve(k0), b = resolve(k1);
      return {x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), rot: lerp(a.rot, b.rot, u), torso: lerp(a.torso, b.torso, u),
        hf: lerpV(a.hf, b.hf, u), hb: lerpV(a.hb, b.hb, u), ff: lerpV(a.ff, b.ff, u), fb: lerpV(a.fb, b.fb, u)};
    }
  }
  return resolve(keys[keys.length - 1]);
}

function ik(base: V, target: V, l1: number, l2: number, bend: number): [V, V] {
  const dx = target[0] - base[0], dy = target[1] - base[1];
  const d = Math.min(Math.max(Math.hypot(dx, dy), 1e-4), l1 + l2 - 1e-4);
  const a = Math.atan2(dy, dx);
  const c = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const j = a + bend * Math.acos(c);
  return [[base[0] + l1 * Math.cos(j), base[1] + l1 * Math.sin(j)], [base[0] + d * Math.cos(a), base[1] + d * Math.sin(a)]];
}

const cache = new Map<string, Joints>();

/** World-space joints at time t (cached: every shape asks for the same pose). */
export function skeleton(name: string, t: number): Joints {
  const id = `${name}@${t.toFixed(5)}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const b = FIGHT.bones, s = sample(name, t), facing = FIGHT.fighters[name].facing;
  const tr = (s.torso * Math.PI) / 180;
  const up: V = [Math.sin(tr), Math.cos(tr)];
  const neck: V = [up[0] * b.torso, up[1] * b.torso];
  const pts: Joints = {hip: [0, 0], neck, head: [neck[0] + up[0] * b.neck, neck[1] + up[1] * b.neck]};
  for (const side of ['f', 'b']) {
    const hand: V = [neck[0] + (s as any)['h' + side][0], neck[1] + (s as any)['h' + side][1]];
    [pts['elbow_' + side], pts['hand_' + side]] = ik(neck, hand, b.upper_arm, b.forearm, -1);
    [pts['knee_' + side], pts['foot_' + side]] = ik([0, 0], (s as any)['f' + side], b.thigh, b.shin, 1);
  }
  const r = (s.rot * Math.PI) / 180, cr = Math.cos(r), sr = Math.sin(r);
  const out: Joints = {};
  for (const [k, [px, py]] of Object.entries(pts)) {
    out[k] = [s.x + facing * (px * cr - py * sr), s.y + (px * sr + py * cr)];
  }
  if (cache.size > 4000) cache.clear();
  cache.set(id, out);
  return out;
}

/** Polylines to draw, back limbs first. */
export function strokes(j: Joints): [string, V[]][] {
  return [
    ['back', [j.neck, j.elbow_b, j.hand_b]],
    ['back', [j.hip, j.knee_b, j.foot_b]],
    ['body', [j.hip, j.neck]],
    ['front', [j.hip, j.knee_f, j.foot_f]],
    ['front', [j.neck, j.elbow_f, j.hand_f]],
  ];
}

export const LIMB: Record<string, string> = {hf: 'hand_f', hb: 'hand_b', ff: 'foot_f', fb: 'foot_b'};

/** World units to scene pixels: world x = 0 at pixel 0, ground at GY, y down.
 *  The camera pan is applied by a parent node shifted by -camX(t) * PX. */
const {px_per_unit: PX, ground_below_center_px: GY} = FIGHT.view;
export const toPx = (p: V): [number, number] => [p[0] * PX, GY - p[1] * PX];
export {PX, GY};

/** The shared camera pan: world x at the frame centre, eased in-out between keys. */
export function camX(t: number): number {
  const pan = (FIGHT.view as any).pan as [number, number][];
  if (t <= pan[0][0]) return pan[0][1];
  for (let i = 0; i + 1 < pan.length; i++) {
    const [t0, x0] = pan[i], [t1, x1] = pan[i + 1];
    if (t < t1) return x0 + (x1 - x0) * ease('inout', (t - t0) / (t1 - t0));
  }
  return pan[pan.length - 1][1];
}
