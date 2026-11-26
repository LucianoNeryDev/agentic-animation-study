# ADR 0005: HyperFrames as a fifth route

- Status: accepted
- Date: 2026-11-26
- Amends: [ADR 0001](0001-four-routes.md), [ADR 0003](0003-2d-without-a-new-framework.md)

## Context

HyperFrames (HeyGen, Apache-2.0) renders HTML, CSS, SVG, canvas, `<video>` footage and a paused GSAP timeline to video by seeking each frame in headless Chrome. It appeared after the four routes were chosen and grew quickly (first commit March 2026, about 90,000 GitHub stars by November), so it went through every round of the study: the smoke test, an entry in the route showcase, a beat-for-beat port of the Motion Canvas showcase, the shared 2D stick fight and Warrior vs Dragon from the same baked choreography ([docs/09](../09-hyperframes.md)).

Findings:

- It meets all four requirements: plain-text scenes, a headless render, frames that are a pure function of time, and single-frame renders (`snapshot`). Its own `check` (lint, runtime errors, layout, motion, contrast) caught real bugs before rendering, including one in the route guide's first example.
- It does what the other routes don't: real HTML and CSS layout and type, UI, footage played frame-accurately inside the composition, CSS effects such as `backdrop-filter` and blend modes, and captions.
- It costs more per frame than Revideo (2–2.5 times on the same scenes, more with footage and blurs) plus about 12 s of fixed startup per command.
- Frames match to the eye on every run, but not always byte for byte: MP4 captures drift by a few levels around moving anti-aliased edges, and PNG sequences of animated per-letter captions did too. Revideo's and Godot's outputs are byte-identical.
- It is pre-1.0 and changes fast, ships with telemetry on, and sits inside a commercial product (cloud renders, paid templates).

## Decision

Add HyperFrames to the `/animation` skill as a fifth route, for web-native 2D video: product and UI videos, kinetic type and captions, footage edits, broadcast-style overlays, and explainers where layout and type matter more than drawn motion.

Motion Canvas stays the route for programmed 2D drawing (diagrams, data, flat and stick-figure characters) and for anything that must reproduce byte for byte. For 2D the look still decides: clean vector drawing → Motion Canvas; web UI, type, captions or footage → HyperFrames; game feel → Godot 2D; hand-drawn → Grease Pencil.

## Consequences

- `skill/animation/routes/hyperframes.md` holds the route: a hand-written project instead of `hyperframes init`, a pinned local CLI and GSAP, bundled fonts, telemetry off, seek-safe patterns, and its smoke test.
- The route's Look step uses `hyperframes snapshot`; byte-level comparisons use PNG sequences, not MP4s.
- The version is pinned per project. Revisit render speed and the byte-exactness of its MP4 path when HyperFrames reaches 1.0.
