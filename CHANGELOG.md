# Changelog

## 1.1.0 — 2026-11-26

- HyperFrames added as a fifth route ([ADR 0005](docs/adr/0005-hyperframes-fifth-route.md)): a route guide in the skill, chosen for web-native 2D video.
- HyperFrames taken through every round: smoke test, a showcase scene ("Reel"), the shared 2D stick fight (as a TV sports replay), Warrior vs Dragon (as a shadow-puppet storybook), and a beat-for-beat port of the Motion Canvas showcase raced against Revideo ([docs/09](docs/09-hyperframes.md)).
- New side-by-side videos: all four 2D routes in one grid, all three Warrior vs Dragon versions, and the Loop in Motion Canvas and HyperFrames.
- [docs/10](docs/10-compare.md) links every video of the study by round and route.

## 1.0.0 — 2026-10-20

First publication of the study.

- Framework research and selection: Blender, Godot, Three.js and Motion Canvas (rendered with Revideo) kept; ten other tools assessed and rejected, with reasons.
- The `/animation` base skill: brief → route → block → look → polish → render, four route guides, a methods and craft reference, and a slot contract for child skills.
- Toolchain installs and smoke tests for every route, with the fixes they forced into the route guides.
- Four-route showcase: one scene per framework, chosen to show what each does best.
- 2D study: Motion Canvas, Godot 2D and Blender Grease Pencil compared on one shared stick-figure fight.
- Warrior vs Dragon: a 20-second fight rendered in Godot 2D and Motion Canvas from one baked choreography.
- A collected list of gotchas, verified on Blender 5.2.2, Godot 4.7.2, three r186 and Revideo 0.11.0.
