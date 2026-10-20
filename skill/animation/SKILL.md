---
name: animation
description: "Animation with code: plan, build, check and render animated video or scenes in Blender, Godot, Three.js or Motion Canvas. Use when the user asks for an animation, animated video or motion graphics, and as the base that specialized animation skills extend."
argument-hint: "[what to animate, in as much detail as you have]"
---

# Animation

The base workflow for making animation with code. Used on its own, it turns a detailed request into a **brief**, then picks the **route** (framework), **workflow** and **methods** itself. A **child skill** extends this one by fixing some of those choices in advance (see [EXTENDING.md](EXTENDING.md)); when one is running, its fixed choices and extra rules win wherever they differ from this file.

The request is `$ARGUMENTS`, or else the conversation just before this invocation.

Every run follows one loop: **plan → block → look → polish → render**. _Look_ is the part that makes this work: you see your animation only through frames you render and open, so every claim about how it moves rests on an image you have looked at.

## 1. Brief

Fill each field from the request, from what it implies, or from the child skill's defaults:

| Field | Default when unstated |
| --- | --- |
| Purpose and where it is shown | Standalone video file |
| Subject and action | none: always needs an answer |
| Dimension and look (2D/3D, style, references) | inferred from subject |
| Length | the shortest that fits the action |
| Aspect, resolution, frame rate | 16:9, 1920×1080, 30 fps (24 for a filmic look, 60 for UI/game feel) |
| Camera | static, framing the action |
| Sound | silent |
| Assets supplied (models, rigs, images, fonts, clips) | none: build from primitives |
| Deliverable | H.264 MP4 |

Ask about missing fields only when the answer changes the route or the result, using `AskUserQuestion` (at most 4 questions, each with a recommended option). A request without a subject and action is too thin to start: ask for them. Fill every other gap with the default and list it as an assumption.

Then write the **beat sheet**: a timed list of beats (`start–end s | what happens | camera`) that covers the full length. It is the plan every later step checks against.

**Done when** every field has a value and the beat sheet covers the full length.

## 2. Route, workflow and methods

Skip the route choice when a child skill fixes one. Otherwise pick by what the deliverable needs:

| Route | Pick it for | Reference |
| --- | --- | --- |
| Blender | 3D video where image quality matters: characters, rigs, lighting, materials, physics sims, cinematic cameras | [routes/blender.md](routes/blender.md) |
| Godot | Action and game feel in 2D or 3D: combat choreography, many interacting entities, physics, procedural scenes, anything that may become a game | [routes/godot.md](routes/godot.md) |
| Three.js | 3D shown on the web or interactive in a browser, or quick stylized 3D renders | [routes/threejs.md](routes/threejs.md) |
| Motion Canvas | Programmed 2D video: motion graphics, explainers, diagrams, text and data, flat or stick-figure characters | [routes/motion-canvas.md](routes/motion-canvas.md) |
| Blender Grease Pencil | Hand-drawn 2D: ink or sketch lines, line boil, frame-by-frame drawing, 2D drawn into a 3D space | [routes/blender.md](routes/blender.md), Grease Pencil section |

For 2D, the look decides: clean vector graphics → Motion Canvas; game feel (HUD, particles, glow, physics) → Godot 2D; a hand-drawn look → Grease Pencil.

Break a tie in this order: the route an existing project already uses, a route whose tools are already installed, then the faster loop (Motion Canvas and Three.js iterate in seconds; Blender Cycles in minutes).

Choose the **methods** (keyframed, procedural, physics, IK, imported clips, particles) and the craft rules that apply from [METHODS.md](METHODS.md). Read the chosen route file in full.

**Done when** the route and methods are chosen, each with one line on why; step 3 records them in `BRIEF.md`.

## 3. Set up

1. Check the route's tools with the commands in its file. When one is missing, give the user its install command. Install into the project or user space yourself; ask before any system-wide install.
2. Create the project: where the repo's conventions say inside a repo, otherwise `./<slug>/`. It holds:
   - `BRIEF.md`: the brief, assumptions, beat sheet, route and methods
   - the route's source files
   - `previews/` for check frames, `renders/` for final output
3. Give the project one **render command** per kind of output (still frames, frame range, final). Every later step runs through these.

**Done when** the route's smoke test from its file renders one frame that you have opened.

## 4. Block

Build the scene and every beat with the motion roughed in: key poses and positions in place, timing correct to the beat sheet, camera framed, stepped or linear interpolation, placeholder materials and lights.

**Done when** each beat's key poses exist at their beat-sheet times.

## 5. Look

1. Render a still at the middle of every beat, plus the first and last frame, into `previews/`.
2. For each fast or complex action, render its consecutive frames and tile them into a contact sheet. Routes that render only video extract frames first, as their file shows.
   ```bash
   ffmpeg -y -framerate <fps> -start_number <first> -i previews/f_%04d.png -vf \
     "scale=320:-1,drawtext=text='%{eif\:n+<first>\:d}':x=6:y=6:fontsize=24:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=6x4:padding=6:color=white" \
     -frames:v 1 -update 1 previews/sheet_<beat>.png
   ```
   Each tile carries its frame number, so a problem can be traced to an exact frame.
3. Open every image and check it against the beat sheet: the action reads at a glance (silhouette, staging), nothing is cut off or intersects (overshooting easings included), spacing changes smoothly between frames (no pops or jitter), text is legible, and the camera shows what the beat is about.
4. Fix what fails, then render those images again.

**Done when** every beat has a preview you opened that matches its beat-sheet line, and the contact sheets show no pops. Report anything you could not fix.

## 6. Polish

Swap stepped keys for eased curves, add the secondary motion from [METHODS.md](METHODS.md) (overlap, follow-through, settle), then final materials, lighting and effects. If the brief asks for sound, generate voice, sound effects and music with the ElevenLabs API and time them to the beat sheet. Then run step 5 again.

**Done when** step 5's criterion holds on the polished version.

## 7. Render and deliver

1. Run the route's final render. When it produces frames rather than video, encode them (adjust the input pattern to the route's frame naming):
   ```bash
   ffmpeg -y -framerate <fps> -i renders/frames/f_%04d.png [-i audio.wav -c:a aac -shortest] \
     -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart renders/<slug>.mp4
   ```
   For transparency use ProRes 4444 (`-c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le`, `.mov`) or VP9 WebM (`-c:v libvpx-vp9 -pix_fmt yuva420p`).
2. Check the output with `ffprobe`: duration, frame rate, resolution and frame count match the brief.
3. Report the file path, duration, resolution and fps, the route and methods, the assumptions made, and the one command that renders it again.

**Done when** `ffprobe` agrees with the brief and the report is sent.
