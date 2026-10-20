# ADR 0002: Render the Motion Canvas route with Revideo

- Status: accepted
- Date: 2026-10-20

## Context

Motion Canvas's scene model (generator functions where each `yield*` plays a tween) is the best fit for programmed 2D video. But its last npm release is 3.17.2 (December 2024), and it renders only through the Render button of its browser editor, which an agent would have to drive through browser automation.

Revideo is an MIT-licensed fork with the same scene model, maintained (0.11.0 in July 2026), and a headless `renderVideo()` API that writes MP4 directly.

## Decision

The route keeps the name and the authoring model of Motion Canvas and renders with Revideo by default. Motion Canvas proper remains the fallback when a user wants its editor or brings an existing project.

## Consequences

- Imports come from `@revideo/*`, and `makeScene2D` takes a scene name first.
- The route documents Revideo's setup traps: an interactive creator, npm 11 install-script approvals, telemetry to disable, a CommonJS render script, and one or two extra frames to trim.
- Revideo lacks Motion Canvas's `Camera` node; cameras are a wrapping `Node`.
