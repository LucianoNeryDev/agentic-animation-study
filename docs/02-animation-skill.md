# 2. The `/animation` skill

The study's main product is an agent skill: a document an AI coding agent loads to make an animation. The full text is in [`skill/animation/`](../skill/animation/); this page explains its design.

## Two ways to use it

- **On its own.** The user describes the animation in some detail; the agent fills in a brief, then chooses the framework (route), the workflow and the animation methods itself.
- **As a base skill.** Specialised skills (a stick-fight series, product explainers, logo stings) extend it by fixing some of its decisions in advance, while reusing its workflow, checks and route guides.

## The loop

Every run follows one loop: **plan → block → look → polish → render**, written as seven steps, each ending on a checkable *done when* criterion.

| Step | What happens | Done when |
| --- | --- | --- |
| 1. Brief | Fill purpose, subject and action, 2D/3D and look, length, resolution and fps, camera, sound, assets and deliverable from the request; ask at most four questions, and only when the answer changes the route or the result. Then write a **beat sheet**: a timed list of `start–end | what happens | camera` | Every field has a value and the beat sheet covers the full length |
| 2. Route, workflow, methods | Pick the route from a table (or take the child skill's); pick methods (keyframed, procedural, physics, IK, imported clips, particles) from `METHODS.md` | Route and methods chosen, each with a reason |
| 3. Set up | Check the route's tools, create the project with a `BRIEF.md`, and give it one render command per kind of output | The route's smoke test renders one frame that was opened |
| 4. Block | Key poses at their beat-sheet times, camera framed, placeholder look | Every beat's key poses exist at their times |
| 5. Look | See below | Every beat has a preview that was opened and matches its line; contact sheets show no pops |
| 6. Polish | Eased curves, secondary motion, final materials and effects, sound if asked (ElevenLabs); then Look again | Step 5's criterion holds on the polished version |
| 7. Render and deliver | Final render, encode, `ffprobe` against the brief, report | `ffprobe` agrees with the brief |

## The Look step

An agent cannot watch a video. It sees an animation only through images it renders and opens, so the skill makes that explicit:

1. Render a still at the middle of every beat, plus the first and last frame.
2. For each fast or complex action, render the consecutive frames and tile them into a **contact sheet** with frame numbers burned in, so a problem can be traced to an exact frame:
   ```bash
   ffmpeg -y -framerate <fps> -start_number <first> -i previews/f_%04d.png -vf \
     "scale=320:-1,drawtext=text='%{eif\:n+<first>\:d}':x=6:y=6:fontsize=24:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=6x4:padding=6:color=white" \
     -frames:v 1 -update 1 previews/sheet_<beat>.png
   ```
3. Check each image against the beat sheet: the action reads at a glance, nothing is cut off or intersects (overshooting easings included), spacing changes smoothly, text is legible, the camera shows what the beat is about.
4. Fix what fails and render those images again.

Every showcase in this repo was corrected through this step. A few of the catches:

| Study | What the frames showed | Fix |
| --- | --- | --- |
| Motion Canvas smoke test | The ball only appeared mid-move: coordinates written for a 1920-wide canvas on a 640-wide one | Coordinates documented in the route guide; overshoot added to the checklist |
| 2D fight | Both fighters in the left half of the frame | A shared eased camera pan |
| Godot 2D fight | A grey haze over the whole screen for six frames after the uppercut | Measured the corner brightness frame by frame; traced to linear-light blending under HDR ([gotcha](07-gotchas.md#godot)) |
| Warrior vs Dragon | Fire breath hitting the ground at the warrior's feet | Measured the stream angle against the shield position; re-aimed |
| Warrior vs Dragon | The finishing title only completed on the last frame | Retimed the ending |

## Routes, methods and craft

- [`SKILL.md`](../skill/animation/SKILL.md) holds the loop and the route table.
- [`routes/`](../skill/animation/routes/) holds one guide per route: tools and install, project layout, render commands for stills, ranges and finals, a smoke test, and how to carry out each method in that framework. Each guide was checked by running it ([docs/03](03-toolchain-and-smoke-tests.md)).
- [`METHODS.md`](../skill/animation/METHODS.md) is the craft reference: when to use each method, timing and spacing (holds, anticipation, follow-through, arcs), staging and camera language, action and combat (anticipation → strike → impact → recovery, hit-stop, smears), frame rates, and shared choreography.

## Extending it: slots

A child skill points to the base and fills **slots**, named values that replace the base's open decisions. Where they differ, the child wins; the base's *done when* criteria still apply unless the child replaces a step. The contract is in [`EXTENDING.md`](../skill/animation/EXTENDING.md).

| Slot | What it fixes | Base step |
| --- | --- | --- |
| Route | One route, or a shorter list | 2 |
| Brief | Defaults, extra required fields, questions to always ask | 1 |
| Methods | Preferred methods and extra craft rules | 2, 4, 6 |
| Style | Palette, line weight, fonts, character designs, camera language | 4, 6 |
| Assets | Starter project, rigs, components, templates | 3 |
| Checks | Extra things to verify in every Look pass | 5 |
| Deliverable | Format, naming, destination, report | 7 |
| Steps | Steps to add, or a step's body to replace | any |

## Design notes

- **Written for agents.** The skill follows a "writing for agents" discipline: steps end on checkable criteria, reference material sits behind pointers so each run loads only what its branch needs (one route guide, not four), and rules are stated positively.
- **Model-invoked.** The skill keeps a one-line description so an agent can start it when asked for "an animation" without the slash command. The cost is that line sitting in every session's context.
- **Snapshot.** The copy in this repo is the state at the end of the study. The live skill sits in a private skills repository and may move on.
