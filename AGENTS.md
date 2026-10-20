# Agent notes

- This repo documents a study of code-driven ("agentic") animation. `README.md` is the entry point; `docs/` holds the detailed write-up; `docs/adr/` the accepted decisions.
- `skill/animation/` is a snapshot of the `/animation` agent skill as it stood at the end of the study. Treat it as reference: edits to the live skill happen elsewhere, and this copy is refreshed deliberately.
- Each folder in `projects/` is a self-contained animation project with a `BRIEF.md` (brief, beat sheet, route, methods, render commands). Follow that file to rebuild it; generated output (`previews/`, `renders/`, `.blend`, `bake.json`) is ignored.
- Finished videos live in `media/`; documentation images in `docs/images/`. Keep both reasonably small: H.264 at CRF 18–20 for video, JPEG at quality 3 for images.
- Every claim in `docs/` should rest on something that was run: a render, a measurement, a frame that was looked at. Keep it that way.
