import {Circle, Line, Node, Rect, Txt, makeScene2D} from '@revideo/2d';
import {createSignal, easeOutBack, easeOutCubic, linear} from '@revideo/core';
import {FIGHT, FightEvent, LIMB, PX, camX, skeleton, strokes, toPx} from '../fight';

const FONT = 'Noto Sans';
const COLOR: Record<string, {front: string; back: string}> = {
  blue: {front: '#4f8cff', back: '#2f5bbf'},
  red: {front: '#ff5a5f', back: '#b8363c'},
};
const GOLD = '#ffd23f', FLOOR = '#3a3e66', MUTED = '#5b6085';
const FPS = 60;

const clamp01 = (u: number) => Math.max(0, Math.min(1, u));
const window01 = (t: number, t0: number, len: number) => (t < t0 || t > t0 + len ? -1 : (t - t0) / len);
const limbAt = (by: string, limb: string, t: number) => skeleton(by, t)[LIMB[limb]];

const HITS = FIGHT.events.filter(e => e.type === 'hit');
const TRAILS = FIGHT.events.filter(e => e.type === 'trail');
const DUSTS = FIGHT.events.filter(e => e.type === 'dust');
const KO = FIGHT.events.find(e => e.type === 'ko')!;

/** Camera shake in pixels: decays over 0.4 s after each hit; seeded by frame, so renders repeat. */
function shake(t: number): [number, number] {
  let a = 0;
  for (const e of HITS) {
    const u = window01(t, e.t, 0.4);
    if (u >= 0) a = Math.max(a, 0.09 * e.power! * PX * (1 - u));
  }
  const f = Math.round(t * FPS);
  const n = (k: number) => Math.sin(f * 12.9898 + k * 78.233) * 43758.5453 % 1;
  return [a * n(1), a * n(2)];
}

/** Camera punch-in on the big hit: 1 → 1.12 during the hit-stop, then eases back.
 *  `at` is the hit point on screen, so the zoom stays centred on it while the camera pans. */
function punch(t: number): {scale: number; at: [number, number]} {
  const e = HITS.find(h => h.power! >= 1)!;
  const w = toPx(limbAt(e.by!, e.limb!, e.t));
  const at: [number, number] = [w[0] - camX(t) * PX, w[1]];
  const inU = window01(t, e.t, 0.06), outU = window01(t, e.t + e.stop!, 0.5);
  let k = 0;
  if (inU >= 0) k = easeOutCubic(inU);
  else if (t > e.t && outU < 0 && t < e.t + e.stop!) k = 1;
  else if (outU >= 0) k = 1 - easeOutCubic(outU);
  return {scale: 1 + 0.12 * k, at};
}

function Fighter({name, t}: {name: string; t: () => number}) {
  const c = COLOR[name];
  return (
    <Node>
      {/* ground shadow shrinks as the body rises */}
      <Circle fill="#000" opacity={0.28}
        position={() => [toPx([skeleton(name, t()).hip[0], 0])[0], toPx([0, 0])[1] + 6]}
        width={() => 2 * PX * Math.max(0.25, 0.75 - 0.25 * Math.max(0, skeleton(name, t()).hip[1] - 0.4))}
        height={30} />
      {[0, 1, 2, 3, 4].map(i => (
        <Line lineCap="round" lineJoin="round"
          stroke={() => (strokes(skeleton(name, t()))[i][0] === 'back' ? c.back : c.front)}
          lineWidth={() => (strokes(skeleton(name, t()))[i][0] === 'back' ? 15 : 19)}
          points={() => strokes(skeleton(name, t()))[i][1].map(toPx)} />
      ))}
      <Circle fill={c.front} size={2 * FIGHT.bones.head * PX}
        position={() => toPx(skeleton(name, t()).head)} />
    </Node>
  );
}

function Trail({e, t}: {e: FightEvent; t: () => number}) {
  const color = COLOR[e.by!].front;
  const pts = () => {
    const now = t();
    if (now < e.t || now > e.until! + 0.08) return [[0, 0], [0, 0]] as [number, number][];
    const end = Math.min(now, e.until!);
    return Array.from({length: 9}, (_, k) => toPx(limbAt(e.by!, e.limb!, Math.max(e.t, end - k * 0.018))));
  };
  const fade = () => (t() < e.t ? 0 : 1 - clamp01((t() - e.until!) / 0.08));
  return (
    <Node>
      <Line points={pts} stroke={color} lineWidth={34} lineCap="round" lineJoin="round" opacity={() => 0.22 * fade()} />
      <Line points={pts} stroke="#ffffff" lineWidth={8} lineCap="round" lineJoin="round" opacity={() => 0.55 * fade()} />
    </Node>
  );
}

function Impact({e, t}: {e: FightEvent; t: () => number}) {
  const p = e.power!, c = toPx(limbAt(e.by!, e.limb!, e.t)), N = 12;
  const u = () => window01(t(), e.t, 0.36);
  return (
    <Node position={c}>
      <Circle fill={GOLD} size={() => (u() < 0 ? 0 : 105 * p * easeOutBack(clamp01(u() * 3)))}
        opacity={() => (u() < 0 ? 0 : 1 - clamp01((u() - 0.3) / 0.4))} />
      <Circle stroke="#ffffff" lineWidth={() => 16 * (1 - u())} size={() => (u() < 0 ? 0 : 2 * 300 * p * easeOutCubic(u()))}
        opacity={() => (u() < 0 ? 0 : 1 - u())} />
      {Array.from({length: N}, (_, i) => {
        const a = (i / N) * Math.PI * 2 + 0.2;
        const r0 = () => 120 * p + 160 * p * easeOutCubic(u()), r1 = () => r0() + 120 * p * (1 - u());
        return (
          <Line stroke="#ffffff" lineWidth={10} lineCap="round" opacity={() => (u() < 0 ? 0 : 1)}
            points={() => [[r0() * Math.cos(a), r0() * Math.sin(a)], [r1() * Math.cos(a), r1() * Math.sin(a)]]} />
        );
      })}
    </Node>
  );
}

function Dust({e, t}: {e: FightEvent; t: () => number}) {
  const x = toPx([skeleton(e.on!, e.t).hip[0], 0])[0], gy = toPx([0, 0])[1];
  const u = () => window01(t(), e.t, 0.45);
  return (
    <Node>
      {Array.from({length: 6}, (_, i) => {
        const side = i % 2 ? -1 : 1, k = 1 + Math.floor(i / 2);
        return (
          <Circle fill={FLOOR} opacity={() => (u() < 0 ? 0 : 0.9 * (1 - u()))}
            size={() => (u() < 0 ? 0 : (26 + 14 * k) * e.power! * (0.5 + easeOutCubic(u())))}
            position={() => [x + side * (60 + 70 * k * easeOutCubic(clamp01(u()))) * e.power!, gy - 18 - 22 * k * easeOutCubic(clamp01(u()))]} />
        );
      })}
    </Node>
  );
}

/** A beat timeline along the bottom: the explainer-style layer Motion Canvas is built for. */
function Timeline({t}: {t: () => number}) {
  const X0 = -760, X1 = 760, Y = 470;
  const xAt = (s: number) => X0 + (X1 - X0) * (s / FIGHT.duration);
  const beats: [string, number][] = [['JAB', HITS[0].t], ['KICK', 1.47], ['UPPERCUT', HITS[1].t], ['K.O.', KO.t]];
  return (
    <Node>
      <Line points={[[X0, Y], [X1, Y]]} stroke={MUTED} lineWidth={4} lineCap="round" />
      <Line points={() => [[X0, Y], [xAt(t()), Y]]} stroke="#ffffff" lineWidth={4} lineCap="round" />
      {beats.map(([label, s]) => (
        <Node position={[xAt(s), Y]}>
          <Circle size={() => (t() >= s ? 22 : 14)} fill={() => (t() >= s ? GOLD : MUTED)} />
          <Txt text={label} y={-34} fontFamily={FONT} fontWeight={800} fontSize={24} letterSpacing={2}
            fill={() => (t() >= s ? '#ffffff' : MUTED)} />
        </Node>
      ))}
      <Circle position={() => [xAt(t()), Y]} size={16} fill="#ffffff" />
    </Node>
  );
}

export default makeScene2D('fight', function* (view) {
  const T = createSignal(0);
  const t = () => T();
  const gy = toPx([0, 0])[1];
  const hitFlash = HITS.find(h => h.power! >= 1)!;

  view.add(
    <>
      <Node
        scale={() => punch(t()).scale}
        position={() => {
          const {scale, at} = punch(t()), [sx, sy] = shake(t());
          return [-at[0] * (scale - 1) + sx, -at[1] * (scale - 1) + sy];
        }}>
        <Node x={() => -camX(t()) * PX}>
          <Rect width={5000} height={800} y={gy + 400} fill="#101225" />
          <Line points={[[-2500, gy], [2500, gy]]} stroke={FLOOR} lineWidth={6} />
          {DUSTS.map(e => <Dust e={e} t={t} />)}
          {TRAILS.map(e => <Trail e={e} t={t} />)}
          <Fighter name="red" t={t} />
          <Fighter name="blue" t={t} />
          {HITS.map(e => <Impact e={e} t={t} />)}
        </Node>
      </Node>
      <Rect width={1920} height={1080} fill="#ffffff"
        opacity={() => {
          const u = window01(t(), hitFlash.t, 0.08);
          return u < 0 ? 0 : 0.5 * (1 - u);
        }} />
      <Txt text="FIGHT!" fontFamily={FONT} fontWeight={900} fontSize={170} fill={GOLD} y={-300} letterSpacing={8}
        scale={() => 1 + 0.6 * (1 - easeOutCubic(clamp01((t() - 0.05) / 0.16)))}
        opacity={() => (t() < 0.05 ? 0 : 1 - clamp01((t() - 0.48) / 0.12))} />
      <Node x={0.25 * PX} y={-280}
        scale={() => (t() < KO.t ? 0 : easeOutBack(clamp01((t() - KO.t) / 0.35)))}
        rotation={() => -6 + 6 * easeOutCubic(clamp01((t() - KO.t) / 0.5))}>
        <Txt text="K.O." fontFamily={FONT} fontWeight={900} fontSize={230} fill={GOLD} x={10} y={10} letterSpacing={10} />
        <Txt text="K.O." fontFamily={FONT} fontWeight={900} fontSize={230} fill="#ffffff" letterSpacing={10} />
      </Node>
      <Timeline t={t} />
    </>,
  );

  yield* T(FIGHT.duration, FIGHT.duration, linear);
});
