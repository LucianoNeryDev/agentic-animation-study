# ADR 0003: Cover 2D with the existing routes plus Grease Pencil

- Status: accepted
- Date: 2026-10-20

## Context

After the four routes were chosen, the question was whether 2D animation needed its own framework. Motion Canvas already covers vector 2D and Godot covers 2D games. Candidates for the rest were Synfig (text format, headless renderer, but a stable release from May 2024 and overlap with Motion Canvas), editor-driven tools (Spine, Rive, Moho, OpenToonz, Toon Boom), Manim and Remotion (overlap), and Blender's Grease Pencil.

## Decision

No new framework. 2D is chosen by look: clean vector → Motion Canvas; game feel → Godot 2D; hand-drawn → Blender Grease Pencil, as a section of the Blender route.

## Consequences

- One shared stick-figure fight was made in all three to confirm the split.
- The Blender route documents the Grease Pencil API for Blender 5.x, which differs from the pre-4.3 API that models tend to write (notably, fills come from `stroke.fill_id`).
- Pixel art remains uncovered; Aseprite with Lua is the candidate if it is ever needed.
