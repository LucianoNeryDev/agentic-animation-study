import {Circle, Grid, Line, Node, Rect, Txt, makeScene2D} from '@revideo/2d';
import {
  all, createRef, createSignal, delay, easeInOutCubic, easeOutBack, easeOutCubic,
  linear, makeRef, sequence, tween, waitFor,
} from '@revideo/core';
import {SECONDS_PER_FRAME as DATA} from '../data';

const FONT = 'Noto Sans';
const INK = '#f2f2f2', MUTED = '#8b93a7', GOLD = '#ffd34d', PINK = '#ff5d8f';
const STEPS = ['plan', 'block', 'look', 'polish', 'render'];
const NX = (i: number) => (i - 2) * 360;     // node centres
const HALF = 125;                            // half a node's width

// chart: log scale from 0.01 s to 100 s
const W = 1000, X0 = -330;
const logW = (v: number) => ((Math.log10(v) + 2) / 4) * W;
const valueOf = (w: number) => Math.pow(10, (w / W) * 4 - 2);
const fmt = (v: number) =>
  (v < 0.1 ? v.toFixed(3) : v < 1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : v.toFixed(0)) + ' s';

export default makeScene2D('loop', function* (view) {
  view.add(<Grid width={1920} height={1080} spacing={60} stroke={'#ffffff0b'} lineWidth={2} />);

  // ---------------------------------------------------------------- A: title
  const titleGroup = createRef<Node>();
  const title = createRef<Txt>();
  const underline = createRef<Line>();
  const roster = createRef<Node>();
  const names: Txt[] = [];
  view.add(
    <Node ref={titleGroup}>
      <Txt ref={title} text="Four engines, one loop" fontFamily={FONT} fontWeight={800} fontSize={112} fill={INK} y={-40} />
      <Line ref={underline} stroke={GOLD} lineWidth={10} lineCap="round" end={0} />
    </Node>,
  );
  view.add(
    <Node ref={roster} y={150}>
      {DATA.map((d, i) => (
        <Txt ref={makeRef(names, i)} text={d.route} fontFamily={FONT} fontWeight={700} fontSize={46}
          fill={d.color} x={(i - 1.5) * 390} y={30} opacity={0} />
      ))}
    </Node>,
  );

  // ---------------------------------------------------------------- B: the loop
  const diagram = createRef<Node>();
  const nodes: Rect[] = [];
  const labels: Txt[] = [];
  const arrows: Line[] = [];
  const ret = createRef<Line>();
  const fixLabel = createRef<Txt>();
  const dot = createRef<Circle>();
  view.add(
    <Node ref={diagram} y={10}>
      {STEPS.slice(0, -1).map((_, i) => (
        <Line ref={makeRef(arrows, i)} points={[[NX(i) + HALF + 14, 0], [NX(i + 1) - HALF - 14, 0]]}
          stroke={'#6b7699'} lineWidth={6} endArrow arrowSize={16} end={0} />
      ))}
      <Line ref={ret} points={[[0, 58], [0, 170], [-360, 170], [-360, 66]]} radius={36}
        stroke={PINK} lineWidth={6} endArrow arrowSize={18} end={0} />
      <Txt ref={fixLabel} text="fix" x={-180} y={214} fontFamily={FONT} fontWeight={700} fontSize={40} fill={PINK} opacity={0} />
      {STEPS.map((s, i) => (
        <Rect ref={makeRef(nodes, i)} x={NX(i)} width={HALF * 2} height={116} radius={26}
          fill={'#1b2030'} stroke={'#3a4260'} lineWidth={5} scale={0}>
          <Txt ref={makeRef(labels, i)} text={s} fontFamily={FONT} fontWeight={700} fontSize={46} fill={INK} />
        </Rect>
      ))}
      <Circle ref={dot} size={30} fill={GOLD} shadowBlur={30} shadowColor={GOLD} scale={0} />
    </Node>,
  );

  // ---------------------------------------------------------------- C: the chart
  const chart = createRef<Node>();
  const bars: Rect[] = [];
  const values: Txt[] = [];
  view.add(
    <Node ref={chart} y={110} opacity={0}>
      <Txt text="Seconds per 1080p frame" fontFamily={FONT} fontWeight={800} fontSize={64} fill={INK} y={-390} />
      <Txt text="as rendered for these four clips, on this machine (log scale)" fontFamily={FONT}
        fontSize={34} fill={MUTED} y={-325} />
      {[0.01, 0.1, 1, 10, 100].map((v) => (
        <Node x={X0 + logW(v)}>
          <Line points={[[0, -250], [0, 250]]} stroke={'#ffffff1c'} lineWidth={2} lineDash={[8, 10]} />
          <Txt text={`${v} s`} y={290} fontFamily={FONT} fontSize={30} fill={MUTED} />
        </Node>
      ))}
      {DATA.map((d, i) => (
        <Node y={-180 + i * 120}>
          <Txt text={d.route} x={X0 - 40} y={-16} offset={[1, 0]} fontFamily={FONT} fontWeight={700} fontSize={44} fill={d.color} />
          <Txt text={d.how} x={X0 - 40} y={28} offset={[1, 0]} fontFamily={FONT} fontSize={28} fill={MUTED} />
          <Rect ref={makeRef(bars, i)} x={X0} offset={[-1, 0]} width={0} height={70} radius={12} fill={d.color} />
          <Txt ref={makeRef(values, i)} x={() => X0 + bars[i].width() + 24} offset={[-1, 0]}
            text={fmt(0.01)} fontFamily={FONT} fontWeight={700} fontSize={40} fill={INK} opacity={0} />
        </Node>
      ))}
    </Node>,
  );

  // ================================================================ timeline
  // A (0–2.0 s): type the title from the left edge, underline it, roll call
  const full = title().text();
  const w = title().width();
  title().offset([-1, 0]).x(-w / 2).text('');
  underline().points([[-w / 2, 50], [w / 2, 50]]);
  yield* title().text(full, 0.9, linear);
  yield* all(
    underline().end(1, 0.45, easeInOutCubic),
    sequence(0.1, ...names.map((n) => all(n.opacity(1, 0.3), n.y(0, 0.4, easeOutCubic)))),
  );
  yield* waitFor(0.4);

  // B (2.0–6.5 s): the loop, with a token passing through it
  yield* all(
    titleGroup().position([0, -390], 0.7, easeInOutCubic),
    titleGroup().scale(0.55, 0.7, easeInOutCubic),
    roster().opacity(0, 0.4),
    delay(0.2, sequence(0.08, ...nodes.map((n) => n.scale(1, 0.4, easeOutBack)))),
  );
  yield* sequence(0.08, ...arrows.map((a) => a.end(1, 0.25, easeOutCubic)));

  function* pulse(i: number, color = GOLD) {
    yield* all(nodes[i].stroke(color, 0.12), nodes[i].scale(1.1, 0.1).to(1, 0.22, easeOutBack));
  }
  function* hop(from: number, to: number) {
    dot().position([NX(from) + HALF, 0]);
    yield* dot().scale(1, 0.06);
    yield* dot().x(NX(to) - HALF, 0.2, easeInOutCubic);
    yield* dot().scale(0, 0.06);
    yield pulse(to);                         // runs alongside the next hop
  }
  yield pulse(0);
  yield* waitFor(0.1);
  yield* hop(0, 1);
  yield* hop(1, 2);
  yield* all(ret().end(1, 0.35, easeInOutCubic), delay(0.15, fixLabel().opacity(1, 0.25)));
  const along = createSignal(0);
  dot().position(() => ret().getPointAtPercentage(along()).position);
  yield* dot().scale(1, 0.06);
  yield* along(1, 0.45, easeInOutCubic);
  yield* dot().scale(0, 0.06);
  yield pulse(1, PINK);
  yield* hop(1, 2);
  yield* hop(2, 3);
  yield* hop(3, 4);
  yield* all(nodes[4].fill(GOLD, 0.25), labels[4].fill('#14161c', 0.25), nodes[4].stroke(GOLD, 0.25));
  yield* waitFor(0.35);

  // C (6.5–10 s): what each route costs per frame
  yield* all(
    diagram().y(-120, 0.4, easeInOutCubic),
    diagram().opacity(0, 0.35),
    titleGroup().opacity(0, 0.35),
  );
  yield* all(chart().opacity(1, 0.45), chart().y(45, 0.5, easeOutCubic));
  // bars grow in log space; each label counts up with its bar
  yield* sequence(0.18, ...bars.map((b, i) => all(
    values[i].opacity(1, 0.3),
    tween(1.0, (u) => {
      b.width(logW(DATA[i].value) * easeOutCubic(u));
      values[i].text(fmt(valueOf(b.width())));
    }),
  )));
  yield* waitFor(1.6);
});
