# 1. Framework selection

The study started from one question: which animation frameworks can an AI coding agent drive end to end, so that a base `/animation` skill can pick one and deliver a finished video without a person clicking through an editor?

## What an agent needs from a framework

An agent works through text and a shell. A framework is only useful to it if it offers all four of these:

1. **Plain-text scenes.** The scene is code or a text file the agent can write and diff, not a binary project edited through a GUI.
2. **A headless render.** One command renders frames or video with no window to click.
3. **Deterministic frames.** Frame N looks the same on every run, however long it takes to render. Without this, a fix can't be checked against the frame it was meant to fix.
4. **Single-frame renders.** The agent can render one frame, or a short range, and open the image. This is how it sees the animation (see [the Look step](02-animation-skill.md#the-look-step)).

Features, image quality and community size come after these four. A beautiful tool that only exports through its GUI is a hand-off tool, not an agent route.

## Candidates

The starting list was Blender, Godot, Three.js, Babylon.js, Panda3D, Bevy, Motion Canvas, Glaxnimate, StykAnimate and Stykz. Research added Revideo, Remotion and Manim (as Motion Canvas alternatives) and, for 2D, Synfig, Spine, Rive, Moho, OpenToonz, Toon Boom and Aseprite. HyperFrames was tested later, in November 2026 ([docs/09](09-hyperframes.md)).

| Framework | Language | Verdict | Why |
| --- | --- | --- | --- |
| **Blender** | Python (`bpy`) | **Kept** | Strongest 3D image quality. `blender -b -P script.py` builds and renders headless; the whole scene can be generated from a script. Large install and an API that changes between major versions (see [gotchas](07-gotchas.md#blender)). |
| **Godot** | GDScript / C# | **Kept** | Best for action and game feel. Scenes are text (`.tscn`), and Movie Maker mode records with a fixed time step, so output is exact to the frame. Needs a real renderer: a display or Xvfb, not `--headless`. |
| **Three.js** | JS / TS | **Kept** | Best for 3D on the web, and the library models know best. Rendering happens in a browser, so the route adds a frame clock and Playwright capture to make it deterministic. |
| **Motion Canvas** | TypeScript | **Kept, rendered with Revideo** | Best for programmed 2D: generator-based timelines read like a beat sheet. Its last npm release is 3.17.2 (December 2024) and it renders only through its browser editor, so the route renders through Revideo, a maintained MIT fork with a headless `renderVideo()` ([ADR 0002](adr/0002-revideo-renders-motion-canvas.md)). |
| Babylon.js | JS / TS | Rejected | Capable (Havok physics, inspector, GUI), but it overlaps Three.js, which models know better. Same browser-capture problem. |
| Panda3D | Python / C++ | Rejected | Scriptable and can render offscreen, but its renderer is dated, its community small, and models know it poorly. Blender covers Python-driven 3D better. |
| Bevy | Rust | Rejected | Clean ECS and full control of timing, but it is pre-1.0 with breaking API changes each release, so generated code goes stale; Rust compile times also slow the edit, render, check loop. |
| Glaxnimate | Python | Rejected | A KDE vector animator with a Python module and Lottie/SVG export. Useful for app and web animation assets, but niche, thinly documented, and the PyPI package looked old (0.5.4, September 2023). |
| Stykz | GUI | Rejected | Freeware stick-figure animator modelled on Pivot, unmaintained since about 2011, with no scripting and a proprietary file format. |
| StykAnimate | GUI (Electron + WebGPU) | Rejected for now | See below. |
| HyperFrames | HTML / CSS / JS (GSAP) | **Tested, recommended as a fifth route** | Meets all four requirements and ships its own checking tools (`check`, `snapshot` contact sheets). About twice Revideo's render cost here, and its MP4 output is reproducible to the eye but not byte for byte. Apache-2.0, very active, pre-1.0. Not in the skill until an ADR records the decision ([docs/09](09-hyperframes.md)). |
| Remotion | React | Not chosen | Excellent headless CLI, but a company licence is required once a company passes a few people, and it overlaps Motion Canvas. |
| Manim | Python | Not chosen | CLI-first and strong for maths animation; overlaps Motion Canvas for general 2D. |
| Synfig | XML / CLI | Not chosen | Open source with a text format and a renderer that runs without a display, but the stable release was still 1.4.5 (May 2024) with 1.5.x only as previews, and it overlaps Motion Canvas. |
| Spine, Rive, Moho, OpenToonz, Toon Boom | Editors | Not chosen | Authoring happens in their editors; Spine also needs a paid licence. |
| Aseprite | Lua | Deferred | The tool to evaluate if pixel art is ever wanted ([roadmap](../ROADMAP.md)). |

## StykAnimate, in detail

StykAnimate first looked like it might not exist: searches only returned Stykz. It turned out to be a real, young project:

- A free, open-source (GPL-3.0) stick-figure studio for Windows, Linux and the browser. It is a modern successor to Pivot and opens Pivot (`.piv`, `.stk`) and Stick Nodes projects.
- Repository created 2026-09-09; version 1.2.5 released 2026-10-01; actively pushed.
- Features suited to stick fights: IK posing, stretchy and 3D-depth figures, a figure builder, a Pivot-style frame strip plus a layered timeline with easing, motion paths, onion skins, camera follow, particle effects (explosions, auras, beams, smoke) and drawing brushes.
- Exports MP4, WebM with transparency, GIF, APNG, and PNG/JPEG/SVG sequences.

Reading the source settled it:

- **No command line, scripting API or headless export.** The desktop app's command-line arguments only open files; every export goes through the export dialog.
- **Only the container format is documented.** `.styk` is a documented header around compressed JSON plus binary sections, and the repo's Python module can write that wrapper. The JSON inside, which holds figures, poses and keys, has no published schema and changes with a fast-moving project.

That left three ways to include it: a hand-off route (the agent writes a Pivot file, a person finishes and exports in StykAnimate), browser automation of its web app (fragile), or contributing a headless export upstream. It was dropped from the skill, and the [roadmap](../ROADMAP.md) notes revisiting it if it gains a headless render. Fully automatic stick fights went through Motion Canvas, Godot 2D and Grease Pencil instead ([2D routes](05-2d-routes.md)).

## The result

Four routes, recorded in [ADR 0001](adr/0001-four-routes.md):

| Route | Pick it for |
| --- | --- |
| Blender | 3D video where image quality matters: characters, rigs, lighting, materials, physics sims, cinematic cameras |
| Godot | Action and game feel in 2D or 3D: combat choreography, many interacting entities, physics, procedural scenes |
| Three.js | 3D shown on the web or interactive in a browser, or quick stylised 3D renders |
| Motion Canvas | Programmed 2D video: motion graphics, explainers, diagrams, text and data, flat or stick-figure characters |
| Blender Grease Pencil | Hand-drawn 2D, added after the 2D study ([ADR 0003](adr/0003-2d-without-a-new-framework.md)) |
