# Animation methods and craft

Reference for step 2 (choosing methods) and steps 4–6 (applying craft). Each route file explains how to carry out these methods in its framework.

## Methods

Most animations mix several. Pick one for each element of the beat sheet:

| Method | Use it for | Cost |
| --- | --- | --- |
| **Keyframed** (pose-to-pose) | Acting, choreography, anything that must hit exact poses at exact times | Most authoring work; full control |
| **Procedural** (functions of time: easing, oscillators, noise, springs) | Loops, idle motion, crowds, generative motion graphics, secondary motion | Cheap to vary; harder to direct to an exact pose |
| **Physics simulation** (rigid body, cloth, soft body, ragdoll) | Falling, collapsing, debris, cloth, reactions to hits | Needs a fixed timestep to stay deterministic; tune, then bake |
| **IK** (inverse kinematics) | Planting feet and hands, reaching, aiming | Needs a rig; animate the IK targets rather than each joint |
| **Imported clips** (mocap, Mixamo-style libraries) | Realistic human locomotion and common actions | Needs a matching rig, or retargeting; blend clips, and keyframe on top to fix contacts |
| **Particles** | Sparks, smoke, dust, magic, impact bursts | Seed the random generator so every render matches |

**Shared choreography.** When the same motion must play in more than one route (a comparison, a 2D and a 3D cut), keep it as data in one file: poses, timed keys with an easing per segment, effect events and the camera path, plus a reference sampler. Each route ports only the sampler, so every version hits the same pose on the same frame.

## Timing and spacing

- **Timing** is how many frames an action takes. **Spacing** is how far the subject moves between frames. Easing shapes the spacing, so ease into and out of every pose unless the motion is mechanical.
- Use **holds** so a pose can be read: about 6–12 frames at 24 fps on a key pose, longer for text (roughly 1 s per 3 words, at least 1.5 s).
- Use **anticipation** before a big action: a short movement the opposite way. Keep it smaller and faster for snappy motion.
- After a stop, add **follow-through and overlap**: hair, cloth, tails and limbs settle a few frames after the body does.
- Move along **arcs**: natural motion follows curves, and only mechanical motion travels in straight lines.
- Show weight through **squash and stretch** in stylized work, and through the timing of acceleration and settling in realistic work.

## Staging and camera

- **Silhouette**: a pose should be readable as a solid black shape. Turn limbs and props away from the body until it is.
- Make one thing the focus at a time; contrast, motion and framing all point to it.
- **Shot sizes**: wide to establish, medium for action, close-up for reaction. Keep the camera on one side of the action (the 180° rule) across cuts.
- Cut on action: end one shot mid-motion and continue it in the next.
- Move the camera with intent and ease it like any other motion. A camera that is always drifting reads as noise.

## Action and combat

- Each strike runs **anticipation → strike → impact → recovery**. The strike itself is fast (2–4 frames at 24 fps); the anticipation and recovery give it weight.
- **Hit-stop**: freeze both fighters for 2–6 frames on impact. Add a **screen shake** that decays over about 0.2–0.4 s, and an impact effect (flash frame, spark burst, smear).
- **Smear frames**: stretch a fast-moving limb, or show it more than once, across a frame or two.
- Alternate who has the initiative so the exchange reads as a conversation, and place a clear beat at every change.
- Keep the fighters' silhouettes apart at contact; overlapping shapes make a hit unreadable.

## Frame rate

24 fps for film-like work, 30 for web video, 60 for UI and game-feel motion. Fix the frame rate in the brief before keying, because frame counts in the beat sheet depend on it.
