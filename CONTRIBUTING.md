# Contributing

This repository documents a study of code-driven ("agentic") animation. Fixes and improvements to the write-up, the projects and the tools are welcome.

## Where things live

- `README.md` is the entry point. `docs/` holds the detailed write-up, and `docs/adr/` the accepted decisions.
- `skill/animation/` is a snapshot of the `/animation` skill as it stood at the end of the study. Treat it as reference: edits to the live skill happen elsewhere, and this copy is refreshed deliberately, so avoid changing it in an unrelated pull request.
- Each folder in `projects/` is a self-contained animation project with a `BRIEF.md` (brief, beat sheet, route, methods, render commands). Follow that file to rebuild it.
- Finished videos live in `media/`, and documentation images in `docs/images/`.

## Generated output

Do not commit generated output: `previews/`, `renders/`, `.blend` files and `bake.json` are ignored. Rebuild them from the project's `BRIEF.md`; [docs/08](docs/08-reproduce.md) covers the tool setup.

## Media

Keep committed media reasonably small: H.264 at CRF 18-20 for video, JPEG at quality 3 for images.

## Documentation

Every claim in `docs/` should rest on something that was run: a render, a measurement, a frame that was looked at. If you change a claim, say what you ran to check it.

## Pull requests

Branch from `dev`, keep each pull request focused, and open it against `dev`.
