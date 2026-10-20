// Warrior vs Dragon, Motion Canvas (Revideo): draws the shapes baked by ../choreo.py
// as a flat vector illustration: paper-cut dusk, outlined shapes, comic impact
// bursts, flame-shape fire, letterbox and title cards. Every property is a
// function of one time signal, so a frame always shows the baked pose for its time.
import {Circle, Gradient, Line, Node, Rect, Txt, makeScene2D} from '@revideo/2d';
import {createSignal, easeOutBack, easeOutCubic, linear} from '@revideo/core';
import bake from '../bake.json';

type V = [number, number];
const B = bake as any;
const PX: number = B.px, FPS: number = B.fps, N: number = B.frames;
const EVENTS: any[] = B.events;
const FONT = 'Noto Sans';

const C = {
  ink: '#22101a', dragon: '#c0392b', dragonDark: '#7d1f1a', belly: '#f5b553', wing: '#8e2a2a', ivory: '#f6e7c8',
  eye: '#ffd23f', body: '#262b3b', armor: '#8a93a6', helm: '#c9d1de', plume: '#e2392f', cape: '#b8232b',
  wood: '#8a5a2b', rim: '#d9c49a', blade: '#eef3fa', gold: '#f2b33d', skin: '#f1c9a5',
};

const fi = (t: number) => Math.min(N - 1, Math.max(0, Math.round(t * FPS)));
const F = (t: number) => B.data[fi(t)];
const P = (p: number[]): V => [p[0] * PX, -p[1] * PX];
const PA = (a: number[][]) => a.map(P);
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));
const win = (t: number, t0: number, len: number) => (t < t0 || t > t0 + len ? -1 : (t - t0) / len);
const hash = (n: number, k: number) => {
  const x = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const NONE: V[] = [[0, 0], [0, 0]];

/** An outline baked as left side + reversed right side is already a closed polygon. */
const Shape = (props: {pts: () => V[]; fill: () => string; stroke?: string; lw?: number; opacity?: () => number}) => (
  <Line points={props.pts} closed fill={props.fill} stroke={props.stroke ?? C.ink} lineWidth={props.lw ?? 5}
    lineJoin="round" opacity={props.opacity ?? 1} />
);
const Stroke = (props: {pts: () => V[]; color: string; lw: number | (() => number); opacity?: () => number}) => (
  <Line points={props.pts} stroke={props.color} lineWidth={props.lw} lineCap="round" lineJoin="round" opacity={props.opacity ?? 1} />
);
/** A limb: a dark outline line under a coloured line. */
const Limb = (props: {pts: () => V[]; color: string; lw: number}) => (
  <Node>
    <Stroke pts={props.pts} color={C.ink} lw={props.lw + 8} />
    <Stroke pts={props.pts} color={props.color} lw={props.lw} />
  </Node>
);

export default makeScene2D('fight', function* (view) {
  const T = createSignal(0);
  const t = () => T();
  const f = () => F(t());
  const d = () => f().d;
  const w = () => f().w;
  const cam = () => f().cam as number[];
  const hitDragon = () => EVENTS.some(e => e.type === 'hit' && e.kind !== 'shield' && t() >= e.t && t() < e.t + 0.07);
  const hitWarrior = () => EVENTS.some(e => e.type === 'hit' && e.kind === 'shield' && t() >= e.t && t() < e.t + 0.07);
  const dc = (c: string) => () => (hitDragon() ? '#ffffff' : c);
  const wc = (c: string) => () => (hitWarrior() ? '#ffffff' : c);

  // parallax layer: x scrolls by `k` of the camera, vertical anchoring follows the ground
  const layer = (k: number) => ({
    scale: () => cam()[2],
    position: (): V => [-cam()[0] * PX * cam()[2] * k, cam()[1] * PX * cam()[2]],
  });
  const hill = (seed: number, base: number, amp: number, step: number): V[] => {
    const pts: V[] = [[-5200, 900]];
    for (let x = -5200; x <= 6200; x += step) {
      pts.push([x, -base - amp * (0.5 + 0.5 * Math.sin(x * 0.0017 + seed)) - 30 * hash(x, seed)]);
    }
    pts.push([6200, 900]);
    return pts;
  };

  // ---------------------------------------------------------------- dragon
  const wing = (side: 'far' | 'near', mem: string) => (
    <Node>
      <Shape pts={() => PA(d().wings[side].mem)} fill={dc(mem)} lw={4} />
      {[0, 1, 2, 3].map(i => <Stroke pts={() => PA(d().wings[side].bones[i])} color={C.ink} lw={side === 'near' ? 9 : 7} />)}
    </Node>
  );
  const legs = (near: boolean, color: string) => (
    <Node>
      {[0, 1, 2, 3].filter(i => (i >= 2) === near).map(i => (
        <Node>
          <Limb pts={() => PA(d().legs[i].pts)} color={color} lw={B.data[0].d.legs[i].w * PX} />
          {[0, 1, 2].map(k => <Stroke pts={() => PA(d().legs[i].claws[k])} color={C.ivory} lw={6} />)}
        </Node>
      ))}
    </Node>
  );
  const nSpikes = B.data[0].d.spikes.length;
  const Dragon = () => (
    <Node>
      {wing('far', '#5e1a1d')}
      {legs(false, '#8f2620')}
      <Shape pts={() => PA(d().body)} fill={dc(C.dragon)} lw={6} />
      <Shape pts={() => PA(d().belly)} fill={dc(C.belly)} stroke="#00000000" lw={0} />
      {Array.from({length: nSpikes}, (_, i) => <Shape pts={() => PA(d().spikes[i])} fill={dc(C.dragonDark)} lw={3} />)}
      <Shape pts={() => PA(d().jaw)} fill={dc(C.dragonDark)} lw={5} />
      <Shape pts={() => PA(d().skull)} fill={dc(C.dragon)} lw={5} />
      {[0, 1].map(i => <Stroke pts={() => PA(d().teeth[i])} color={C.ivory} lw={4} />)}
      {[0, 1].map(i => (
        <Node>
          <Stroke pts={() => PA(d().horns[i])} color={C.ink} lw={13} />
          <Stroke pts={() => PA(d().horns[i])} color={C.ivory} lw={7} />
        </Node>
      ))}
      <Circle position={() => P(d().eye)} size={() => (d().eye_open > 0.5 ? 20 : 0)} fill={C.eye} stroke={C.ink} lineWidth={3} />
      <Circle position={() => P(d().eye)} size={() => (d().eye_open > 0.5 ? 7 : 0)} fill={C.ink} />
      <Stroke pts={() => (d().eye_open > 0.5 ? NONE : [[P(d().eye)[0] - 10, P(d().eye)[1]], [P(d().eye)[0] + 10, P(d().eye)[1]]])} color={C.ink} lw={4} />
      {legs(true, C.dragon)}
      {wing('near', C.wing)}
    </Node>
  );

  // ---------------------------------------------------------------- warrior
  const cape = (): V[] => {
    const ch: V[] = PA(f().cape);
    const left: V[] = [], right: V[] = [];
    ch.forEach((p, i) => {
      const a = ch[Math.max(0, i - 1)], b = ch[Math.min(ch.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], ln = Math.hypot(dx, dy) || 1;
      const nx = -dy / ln, ny = dx / ln, wdt = 10 + 18 * (i / (ch.length - 1));
      left.push([p[0] + nx * wdt, p[1] + ny * wdt]);
      right.push([p[0] - nx * wdt, p[1] - ny * wdt]);
    });
    return [...left, ...right.reverse()];
  };
  const helmet = (): V[] => {
    const h = P(w().head), up = f().w_up, ang = Math.atan2(-up[1], up[0]);
    const pts: V[] = [];
    for (let k = 0; k <= 16; k++) {
      const a = ang - Math.PI * 0.56 + (Math.PI * 1.12 * k) / 16;
      pts.push([h[0] + Math.cos(a) * 0.2 * PX, h[1] + Math.sin(a) * 0.2 * PX]);
    }
    return pts;
  };
  const seg = (...names: string[]) => () => names.map(n => P(w()[n]));
  const Warrior = () => (
    <Node>
      <Shape pts={cape} fill={wc(C.cape)} lw={4} />
      <Limb pts={seg('hip', 'knee_b', 'foot_b')} color="#1a1e2b" lw={13} />
      <Limb pts={seg('hip', 'neck')} color={C.body} lw={18} />
      <Stroke pts={() => {
        const h = P(w().hip), n = P(w().neck);
        return [[h[0] + (n[0] - h[0]) * 0.25, h[1] + (n[1] - h[1]) * 0.25], [n[0] + (h[0] - n[0]) * 0.08, n[1] + (h[1] - n[1]) * 0.08]];
      }} color={C.armor} lw={22} />
      <Limb pts={seg('hip', 'knee_f', 'foot_f')} color={C.body} lw={14} />
      <Circle position={() => P(w().head)} size={0.34 * PX} fill={wc(C.skin)} stroke={C.ink} lineWidth={4} />
      <Shape pts={helmet} fill={wc(C.helm)} lw={4} />
      <Stroke pts={() => PA(f().plume)} color={C.ink} lw={14} />
      <Stroke pts={() => PA(f().plume)} color={C.plume} lw={8} />
      <Limb pts={seg('neck', 'elbow_b', 'hand_b')} color="#1a1e2b" lw={11} />
      <Node position={() => P(w().hand_b)}>
        <Circle size={0.56 * PX} fill={wc(C.rim)} stroke={C.ink} lineWidth={5} />
        <Circle size={0.47 * PX} fill={wc(C.wood)} />
        <Circle size={0.32 * PX} stroke="#5e3a17" lineWidth={4} />
        <Circle size={0.12 * PX} fill={C.rim} stroke={C.ink} lineWidth={3} />
      </Node>
      <Limb pts={seg('neck', 'elbow_f', 'hand_f')} color={C.body} lw={11} />
      <Stroke pts={seg('hand_f', 'tip')} color={C.ink} lw={14} />
      <Stroke pts={seg('hand_f', 'tip')} color={C.blade} lw={8} />
      <Stroke pts={seg('guard_a', 'guard_b')} color={C.ink} lw={12} />
      <Stroke pts={seg('guard_a', 'guard_b')} color={C.gold} lw={7} />
      <Stroke pts={seg('pommel', 'hand_f')} color="#4a2a12" lw={8} />
      <Circle position={() => P(w().pommel)} size={13} fill={C.gold} stroke={C.ink} lineWidth={3} />
    </Node>
  );

  // ---------------------------------------------------------------- fire: flame shapes from a fixed pool
  const RATE = 120, POOL = 90;
  const flame = (k: number) => {
    const state = () => {
      const now = t();
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
      if (!blast) {                                  // breath: stop at the shield and splash upward
        const sx = P(F(now).w.hand_b)[0] + 0.2 * PX;
        if (x < sx) {
          y -= (sx - x) * (0.8 + 0.8 * hash(j, 2));
          x = sx - (sx - x) * 0.25;
        }
      }
      return {x, y, u, r: (0.12 + 0.34 * u) * PX * (0.75 + 0.5 * hash(j, 3))};
    };
    return (
      <Circle position={() => { const s = state(); return s ? [s.x, s.y] : [0, 0]; }}
        size={() => { const s = state(); return s ? s.r * 2 : 0; }}
        fill={() => { const s = state(); const u = s ? s.u : 1; return u < 0.15 ? '#fff6c2' : u < 0.4 ? '#ffc23d' : u < 0.72 ? '#ff6a1f' : '#9c2f1d'; }}
        opacity={() => { const s = state(); return s ? 1 - s.u * s.u : 0; }} />
    );
  };
  const fireCore = () => {
    const src = d();
    if (src.fire < 0.05) return NONE;
    const m = P(src.mouth), a = (-src.fire_dir * Math.PI) / 180, L = 1.4 * PX * src.fire;
    return [m, [m[0] + Math.cos(a) * L, m[1] + Math.sin(a) * L]] as V[];
  };
  const smokePuff = (k: number) => {
    const s = () => {
      const now = t();
      const j = k + 14 * Math.floor((now * 9 - k) / 14);
      const te = j / 9, age = now - te, fa = F(te).a;
      const on = (fa > 7.45 && fa < 8.6) || (fa > 14.08 && fa < 15.1);
      if (!on || age < 0 || age > 1.5) return null;
      const m = P(F(te).d.mouth);
      return {x: m[0] + (hash(j, 4) - 0.5) * 40, y: m[1] - age * 70, u: age / 1.5};
    };
    return <Circle position={() => { const v = s(); return v ? [v.x, v.y] : [0, 0]; }} size={() => { const v = s(); return v ? 30 + 60 * v.u : 0; }}
      fill="#6d6070" opacity={() => { const v = s(); return v ? 0.55 * (1 - v.u) : 0; }} />;
  };

  // ---------------------------------------------------------------- effects
  const burst = (e: any) => {
    const c = P([e.x, e.y]), p = e.power;
    const u = () => win(t(), e.t, 0.34);
    const star = (): V[] => {
      const s = u() < 0 ? 0 : easeOutBack(clamp01(u() * 4)) * (1 - 0.3 * u());
      return Array.from({length: 24}, (_, i) => {
        const a = (i / 24) * Math.PI * 2 + 0.2, r = (i % 2 ? 0.28 : 0.62) * p * PX * s * (0.85 + 0.3 * hash(i, e.t));
        return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r] as V;
      });
    };
    return (
      <Node>
        <Shape pts={star} fill={() => (e.kind === 'shield' ? '#e8f1ff' : '#fff3b0')} lw={5} opacity={() => (u() < 0 ? 0 : 1 - clamp01((u() - 0.55) / 0.45))} />
        {Array.from({length: 10}, (_, i) => {
          const a = (i / 10) * Math.PI * 2 + 0.5;
          return <Stroke color="#ffffff" lw={8} opacity={() => (u() < 0 ? 0 : 1 - u())}
            pts={() => {
              const r0 = (0.7 + 1.0 * easeOutCubic(clamp01(u()))) * p * PX, r1 = r0 + 0.5 * p * PX * (1 - u());
              return [[c[0] + Math.cos(a) * r0, c[1] + Math.sin(a) * r0], [c[0] + Math.cos(a) * r1, c[1] + Math.sin(a) * r1]];
            }} />;
        })}
        <Txt text={e.kind === 'shield' ? 'BLOCK!' : e.power >= 1 ? 'CRITICAL!' : 'SLASH!'} fontFamily={FONT} fontWeight={900}
          fontSize={e.power >= 1 ? 76 : 56} fill={e.kind === 'shield' ? '#cfe2ff' : '#ffd23f'} stroke={C.ink} lineWidth={10} strokeFirst
          position={() => [c[0] + (e.power >= 1 ? 190 : 70), c[1] - (e.power >= 1 ? 190 : 120) - 60 * clamp01(win(t(), e.t, 0.9))]}
          rotation={-8} scale={() => { const v = win(t(), e.t, 0.9); return v < 0 ? 0 : easeOutBack(clamp01(v * 5)); }}
          opacity={() => { const v = win(t(), e.t, 0.9); return v < 0 ? 0 : 1 - clamp01((v - 0.7) / 0.3); }} />
      </Node>
    );
  };
  const dust = (e: any) => {
    const u = () => win(t(), e.t, 0.8);
    return (
      <Node>
        {Array.from({length: 8}, (_, i) => {
          const side = i % 2 ? -1 : 1, k = 1 + Math.floor(i / 2);
          return <Circle fill="#7a5a68" stroke={C.ink} lineWidth={3}
            opacity={() => (u() < 0 ? 0 : 0.85 * (1 - u()))}
            size={() => (u() < 0 ? 0 : (34 + 16 * k) * e.power * (0.6 + easeOutCubic(u())))}
            position={() => [e.x * PX + side * (40 + 70 * k * easeOutCubic(clamp01(u()))) * e.power, -16 - 26 * k * easeOutCubic(clamp01(u())) * e.power]} />;
        })}
      </Node>
    );
  };
  const roar = EVENTS.find(e => e.type === 'roar');
  const roarRings = [0, 1, 2].map(r => {
    const u = () => win(t(), roar.t + r * 0.16, 0.8);
    return <Circle position={() => P(d().mouth)} size={() => (u() < 0 ? 0 : 2 * (60 + 900 * easeOutCubic(u())))}
      stroke="#fff1d6" lineWidth={() => 14 * (1 - Math.max(0, u()))} opacity={() => (u() < 0 ? 0 : 0.8 * (1 - u()))} />;
  });
  const swordTrail = (): V[] => {
    if (!f().sword_trail) return NONE;
    const n = fi(t()), outer: V[] = [], inner: V[] = [];
    for (let k = 0; k < 8; k++) {
      const q = B.data[Math.max(0, n - k)].w;
      const tip = P(q.tip), h = P(q.hand_f);
      outer.push(tip);
      inner.push([h[0] + (tip[0] - h[0]) * 0.5, h[1] + (tip[1] - h[1]) * 0.5]);
    }
    return [...outer, ...inner.reverse()];
  };
  const clawTrail = (): V[] => {
    if (d().claw < 0.5) return NONE;
    const n = fi(t());
    return Array.from({length: 7}, (_, k) => P(B.data[Math.max(0, n - k)].d.claw_tip));
  };

  // ---------------------------------------------------------------- titles
  const tag = (t0: number, t1: number, title: string, sub: string, right: boolean) => {
    const inU = () => easeOutCubic(clamp01((t() - t0) / 0.45)), outU = () => clamp01((t() - t1) / 0.35);
    const x = right ? 960 - 90 : -960 + 90;
    const dir = right ? -1 : 1;
    return (
      <Node position={() => [x - dir * 60 * (1 - inU()), 418]} opacity={() => inU() * (1 - outU())}>
        <Rect x={0} y={-2} width={() => 380 * inU()} height={8} fill={C.gold} offset={[-dir, 0]} />
        <Txt text={title} fontFamily={FONT} fontWeight={900} fontSize={64} fill="#ffffff" stroke={C.ink} lineWidth={8} strokeFirst
          offset={[-dir, 1]} y={-12} />
        <Txt text={sub} fontFamily={FONT} fontWeight={700} fontSize={30} fill={C.gold} offset={[-dir, -1]} y={14} letterSpacing={4} />
      </Node>
    );
  };
  const victory = EVENTS.find(e => e.type === 'victory');
  const letters = 'VICTORY'.split('');

  view.add(
    <>
      <Rect width={1920} height={1080} fill={new Gradient({type: 'linear', from: [0, -540], to: [0, 540],
        stops: [{offset: 0, color: '#2b1d4a'}, {offset: 0.45, color: '#7a3b6e'}, {offset: 0.75, color: '#f2995e'}, {offset: 1, color: '#ffd28a'}]})} />
      <Node {...layer(0.04)}>
        <Circle x={700} y={-330} size={420} fill="#ffc773" opacity={0.25} />
        <Circle x={700} y={-330} size={300} fill="#ffc773" opacity={0.4} />
        <Circle x={700} y={-330} size={200} fill="#ffe3a3" />
      </Node>
      <Node {...layer(0.15)}><Line points={hill(1, 170, 160, 140)} closed fill="#8a3f66" /></Node>
      <Node {...layer(0.35)}><Line points={hill(2, 90, 110, 110)} closed fill="#5c2853" /></Node>
      <Node {...layer(0.6)}><Line points={hill(3, 30, 60, 90)} closed fill="#3a1a3d" /></Node>
      <Node scale={() => cam()[2]} position={() => [-cam()[0] * PX * cam()[2], cam()[1] * PX * cam()[2]]}>
        <Rect x={500} y={600} width={14000} height={1200} fill="#1f1024" />
        <Line points={[[-6500, 0], [7500, 0]]} stroke="#ff9a5c" lineWidth={5} />
        <Circle position={() => [d().shadow[0] * PX, 6]} width={() => d().shadow[1] * PX} height={28} fill="#00000066" />
        <Circle position={() => [w().hip[0] * PX, 5]} width={0.6 * PX} height={20} fill="#00000066" />
        <Dragon />
        <Warrior />
        <Shape pts={swordTrail} fill={() => '#ffffff'} stroke="#00000000" lw={0} opacity={() => 0.45} />
        <Stroke pts={clawTrail} color="#ffe0c8" lw={20} opacity={() => 0.6} />
        {Array.from({length: POOL}, (_, k) => flame(k))}
        <Stroke pts={fireCore} color="#fff6c2" lw={() => 30 + 6 * Math.sin(t() * 60)} />
        {Array.from({length: 14}, (_, k) => smokePuff(k))}
        {roarRings}
        {EVENTS.filter(e => e.type === 'dust').map(dust)}
        {EVENTS.filter(e => e.type === 'hit').map(burst)}
      </Node>
      <Rect width={1920} height={1080} fill="#ffffff"
        opacity={() => { const e = EVENTS.find(x => x.type === 'hit' && x.power >= 1); const u = win(t(), e.t, 0.12); return u < 0 ? 0 : 0.6 * (1 - u); }} />
      <Rect y={-540 + 35} width={1920} height={70} fill="#0b0508" />
      <Rect y={540 - 35} width={1920} height={70} fill="#0b0508" />
      {tag(0.5, 2.5, 'THE WARRIOR', 'SWORN BLADE OF THE VALE', false)}
      {tag(4.5, 6.2, 'ASHFANG', 'THE DRAGON OF THE PEAKS', true)}
      <Node y={-250}>
        {letters.map((ch, i) => {
          const u = () => clamp01((t() - victory.t - i * 0.06) / 0.35);
          return <Txt text={ch} fontFamily={FONT} fontWeight={900} fontSize={170} fill={C.gold} stroke={C.ink} lineWidth={14}
            strokeFirst x={(i - (letters.length - 1) / 2) * 128} scale={() => easeOutBack(u())} opacity={() => (u() > 0 ? 1 : 0)} />;
        })}
      </Node>
    </>,
  );

  yield* T((N - 1) / FPS, (N - 1) / FPS, linear);
});
