# Motion Canvas showcase: Four engines, one loop

| Field | Value |
| --- | --- |
| Purpose | Show what the Motion Canvas route is best at: programmed 2D motion graphics (typography, an animated diagram, a data chart), all driven from TypeScript |
| Subject and action | A typed title names the four routes; the skill's plan → block → look → polish → render loop builds itself and a token runs through it, looping back once through "fix"; a log-scale bar chart then shows what each route cost per frame for these clips |
| Dimension and look | 2D, flat, dark UI style: Noto Sans, route colours, faint grid |
| Length | 10.7 s (643 frames) |
| Aspect, resolution, fps | 16:9, 1920×1080, 60 fps |
| Camera | Static |
| Sound | Silent |
| Assets | None |
| Deliverable | H.264 MP4 (Revideo renders it directly) |

Assumptions: silent; the chart uses wall-clock seconds per frame measured while rendering the four showcase clips on this machine (GTX 745, i7-4790S), with the renders running concurrently, saving included.

## Beat sheet

| Time | What happens |
| --- | --- |
| 0.0–0.9 s | "Four engines, one loop" types on from the left |
| 0.9–2.0 s | Gold underline draws; the four route names rise in, each in its colour |
| 2.0–2.9 s | Title shrinks to the top; the five loop nodes pop in (back ease) |
| 2.9–3.4 s | Arrows draw between the nodes |
| 3.4–4.1 s | A gold token passes plan → block → look; each node pulses as it lands |
| 4.1–4.8 s | The pink "fix" arrow draws from look back to block; the token rides it |
| 4.8–5.9 s | Token runs block → look → polish → render; render fills gold |
| 5.9–6.8 s | Diagram lifts away; the chart fades in |
| 6.8–8.9 s | Bars grow in log space with values counting up, staggered |
| 8.9–10.7 s | Hold |

## Route and methods

- **Route: Motion Canvas (rendered with Revideo)**, because the point is programmed 2D video: text, diagrams and data as code, with exact timing.
- **Methods:** keyframed tweens (each `yield*` is a beat); procedural (the token rides the fix curve via `getPointAtPercentage`; chart values derive from bar widths).

## Render commands

```bash
export DISABLE_TELEMETRY=true
npx tsx src/render.ts --from 3.4 --to 6.0 --out previews/draft.mp4   # one section
npx tsx src/render.ts --out renders/loop.mp4                         # final
ffmpeg -y -i previews/draft.mp4 -start_number 0 previews/f_%04d.png  # frames for checking
```
