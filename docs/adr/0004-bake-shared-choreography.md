# ADR 0004: Bake shared choreography to per-frame shapes

- Status: accepted
- Date: 2026-10-20

## Context

When one animation must play in several routes, the 2D study kept the choreography as data (poses, keys, events) and ported a sampler with IK to Python, TypeScript and GDScript. That keeps the versions in sync, but the pose maths is written once per engine, any change must be made in every port, and in Godot the GDScript sampling dominated the recording time.

## Decision

For shared choreography, evaluate everything once in Python and write each frame's final shapes to JSON: camera, joints, outlines, polygons, simulated chains, effect anchors, game values and events. Routes only draw.

## Consequences

- Rigs, simulation (cloth, plume), hit-stop time and camera shake live in one place; the engines contain no animation logic, and the versions match pose for pose.
- A quick PIL preview from the same data lets the choreography be blocked and fixed before any engine runs.
- The bake is large (about 5 MB for 20 s at 60 fps) and generated, so it is not committed.
- Effects that are a route's strength (Godot particles and glow, Motion Canvas typography) stay in the route, anchored to baked positions and events.
