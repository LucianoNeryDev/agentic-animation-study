import {Circle, Line, makeScene2D, Txt} from '@revideo/2d';
import {all, createRef, easeOutBack, waitFor} from '@revideo/core';

export default makeScene2D('intro', function* (view) {
  const ball = createRef<Circle>();
  const line = createRef<Line>();
  view.add(<Line ref={line} points={[[-240, 100], [240, 100]]} stroke="#555" lineWidth={6} end={0} />);
  view.add(<Circle ref={ball} size={80} fill="#e6a700" x={-240} />);
  view.add(<Txt text="smoke" fill="#eee" fontSize={48} y={-110} />);
  yield* line().end(1, 0.3);
  yield* ball().x(240, 0.6, easeOutBack);
  yield* all(ball().scale(1.4, 0.2), ball().fill('#ff4d4d', 0.2));
  yield* waitFor(0.5);
});
