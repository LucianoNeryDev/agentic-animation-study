# ADR 0001: Four routes for agent-driven animation

- Status: accepted
- Date: 2026-10-20

## Context

An AI coding agent needs a framework it can drive without a GUI: plain-text scenes, a headless render, deterministic frames, and single-frame renders it can inspect. Ten candidates were assessed (Blender, Godot, Three.js, Babylon.js, Panda3D, Bevy, Motion Canvas, Glaxnimate, StykAnimate, Stykz), plus alternatives found on the way (Revideo, Remotion, Manim, Synfig and several editor-driven 2D tools).

## Decision

The `/animation` skill offers four routes, chosen by what the deliverable needs:

- **Blender** for 3D video where image quality matters;
- **Godot** for action and game feel in 2D or 3D;
- **Three.js** for 3D on the web or interactive in a browser;
- **Motion Canvas** for programmed 2D video.

## Consequences

- Each route has a guide that was tested by running it, not only written from documentation.
- Babylon.js (overlaps Three.js), Panda3D (dated, little model knowledge), Bevy (pre-1.0 API churn, slow compiles), Glaxnimate (niche), Stykz (GUI only, unmaintained) and StykAnimate (no headless export) are out; StykAnimate is to be revisited if it gains a headless render.
- The routes cover overlapping ground on purpose: the skill picks by output, and breaks ties by existing project, installed tools, then loop speed.
