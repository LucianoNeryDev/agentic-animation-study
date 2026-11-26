# Roadmap

Where the study could go next. None of this is scheduled.

- **HyperFrames at 1.0.** Re-measure render speed and whether its MP4 output becomes byte-exact; test `render --docker` for reproducible renders.
- **Sound through HyperFrames.** Its audio clips and loudness tools could carry the ElevenLabs voice, effects and music in the HyperFrames route.
- **Child skills.** Specialised skills that extend `/animation` through its slots, for example a stick-fight series or product explainers, each with a starter project that already passes its route's smoke test.
- **Sound.** Voice, sound effects and music generated with the ElevenLabs API and timed to the beat sheet, then muxed in the render step.
- **Shared-choreography tooling.** Turn the bake approach from the Warrior vs Dragon study (`choreo.py` → `bake.json`) into a small reusable library: rigs, keyframe tracks, hit-stop time, chain simulation, and per-route drawing helpers.
- **Faster Godot recording.** Movie Maker spends most of its time writing 1080p PNGs; test the OGV writer, or a custom `MovieWriter` that pipes raw frames to ffmpeg.
- **A pixel-art route.** If pixel art is ever needed, evaluate Aseprite with Lua scripting as a separate route.
- **StykAnimate.** Revisit if it gains a command line or headless export; it is the strongest dedicated stick-figure tool but cannot be driven by an agent today.
