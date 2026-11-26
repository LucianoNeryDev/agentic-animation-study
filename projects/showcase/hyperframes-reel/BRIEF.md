# HyperFrames showcase: Reel

| Field | Value |
| --- | --- |
| Purpose | Show what the HyperFrames route is best at: real HTML/CSS layout and typography, UI, real footage playing inside it, and kinetic captions |
| Subject and action | A launch-style reel for this study: a CSS-built browser window scrolls to a grid of cards that play the study's own renders; a cursor clicks the Three.js card, which grows to full frame while it keeps playing; word-by-word captions; an end card |
| Dimension and look | 2D web UI on a dark ground: Noto Sans and Noto Sans Mono (bundled in `assets/fonts/`), a teal-gold-pink gradient for accents |
| Length | 9.0 s (540 frames) |
| Aspect, resolution, fps | 16:9, 1920×1080, 60 fps |
| Camera | None: the motion is the page's (scroll, FLIP expand, shrink) |
| Sound | Silent |
| Assets | Six 4 s card excerpts in `assets/footage/` (640×360, cut from `media/`); `assets/footage/field-full.mp4` is a symlink to `media/showcase-threejs-field.mp4`; fonts (SIL OFL); GSAP from npm |
| Deliverable | H.264 MP4 (HyperFrames renders it directly), remuxed with `+faststart` to `media/showcase-hyperframes-reel.mp4` |

Assumptions: silent; the address bar shows the repository as `LucianoNeryDev/agentic-animation-study` with no host, since the page is a mock-up, not a forge's UI; "Five engines" counts HyperFrames itself, which the page names in its eyebrow line.

## Beat sheet

| Time | What happens |
| --- | --- |
| 0.0–0.7 s | The browser window rises in (tabs, address bar, page with the hero and the top of the grid); the cards already play |
| 0.4–1.9 s | Caption "Five engines." word by word in a frosted pill |
| 0.85–2.0 s | The page scrolls 383 px to the full 3×2 grid; the scrollbar thumb follows |
| 2.0–3.1 s | Caption "One loop." (gradient "loop."); the cursor curves in from the bottom right and stops on the Three.js card |
| 2.85 s | Hover: the card lifts 8 px and gets a teal ring |
| 3.1 s | Click: the cursor dips, a ripple rings out |
| 3.18–3.98 s | FLIP: the full-size player takes over on the same source frame and grows from the card's box to the frame; the browser recedes and dims |
| 3.95–6.0 s | Full-frame footage (the word "three.js" forms, the light sweep passes); HUD counts frames with `mix-blend-mode: difference`; caption "Every frame checked by an agent." |
| 5.9–6.35 s | The footage shrinks to a rounded tile and fades |
| 6.3–7.0 s | End card: "Agentic Animation Study" in gradient text wipes in, a gradient rule draws, "HTML · CSS · GSAP → MP4" drops in token by token |
| 7.0–9.0 s | Hold |

## Route and methods

- **Route: HyperFrames 0.9.98**, one `index.html` with a paused GSAP 3.15 timeline on `window.__timelines["main"]`, because the point is web-native video: CSS grid layout, real type, UI chrome, `<video>` footage and CSS text effects.
- **Footage.** Each card holds a muted, timed `<video class="clip">` (`data-start`, `data-duration`, `data-media-start`); the wrapper is untimed and its opacity is the timeline's (HyperFrames forces `opacity: 1` on active clips). At render HyperFrames pre-decodes every clip with FFmpeg into frames for its window and shows the frame for each timeline time.
- **FLIP with a shared element.** The clicked card and the full-size player are two clips of the same render, aligned in time (`card-field.mp4` starts at source 0.2 s; the player uses `data-media-start` 3.3 at `data-start` 3.1), so at the swap both show the same source frame. The player then runs First → Last as `translate() scale()` with `transform-origin: 0 0`, from the card's box to the frame; its corner radius is divided by the scale so it stays 15 px on screen.
- **Seek-safe geometry.** The card's box is measured once at build time, before any transform exists (rows and heights are fixed, so fonts don't move it). Each frame, the timeline's `onUpdate` applies the browser's scale and offset, the page scroll and the hover lift to it from GSAP's own values (`gsap.getProperty`); no frame measures the DOM.
- **Captions.** One frosted pill per group (`backdrop-filter: blur(22px) saturate(160%)`), words blurring in (`filter: blur(14px)` → 0, `yPercent` 70 → 0) one by one, `background-clip: text` gradient on the key word, a hard `visibility: hidden` after each exit.

## Render commands

```bash
npm ci
export HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1
npx hyperframes check                                     # 0 errors
npx hyperframes snapshot --at 0.7,1.2,2.3,3.05,3.13,3.55,4.1,4.9,6.1,6.4,8.98
npx hyperframes render --quiet -w 1 --start 3.0 --end 4.3 -o previews/flip.mp4   # click and FLIP
npx hyperframes render --quiet -w 1 -o renders/reel.mp4   # final
ffmpeg -y -i renders/reel.mp4 -c copy -movflags +faststart ../../../media/showcase-hyperframes-reel.mp4
```

The card excerpts were cut frame-exactly from `media/` (example for the Three.js card, source frames 12–251):

```bash
ffmpeg -i ../../../media/showcase-threejs-field.mp4 -vf "trim=start_frame=12:end_frame=252,setpts=PTS-STARTPTS,scale=640:360:flags=lanczos" \
  -an -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -g 60 -movflags +faststart assets/footage/card-field.mp4
```

Card offsets into their sources: Collapse 0.625 s, Arena 0.5 s, Loop 2.5 s, Warrior vs dragon 4.5 s, Field 0.2 s, 2D fight 0.5 s.

## Measured

All on the test machine with other agents' renders sharing the disk; HyperFrames runs one render per user at a time, so later runs also queued behind them.

| Run | Wall clock | Capture stage | Per frame (wall) |
| --- | --- | --- | --- |
| First full render (extraction cache warm) | 89.9 s | 76.7 s | 0.166 s |
| Second full render | 129.4 s | 114.8 s | 0.240 s |
| Delivered render (I/O pressure 57–70 %; part of it queued behind another project's render) | 506.1 s | 290.9 s | — |

- **Footage extraction.** Before capture HyperFrames decodes all seven clips into JPEG frames (1,654 frames, 121 MB; the 1080p player alone is 222 frames, ≈ 80 MB) in a cache under `$TMPDIR/hyperframes-extract-cache-<uid>`. Cold: 8.2 s. Warm: 2.3–6.6 s. It extracts every clip even for a 0.5 s range render. Cutting the six card excerpts beforehand took 24 s.
- **Frame accuracy.** Each output frame of the Three.js footage was compared (PSNR) with source frames n+12−3 … n+12+3: all 112 full-frame frames (240–351) and 15 card frames (121–135) matched source frame n+12 best (full frame: 31–36 dB against ≤ 31.5 dB for the neighbours). The card-to-player swap (frames 190 → 191) shows no jump in position or content.
- **Determinism.** Rendering 3.2–4.2 s (60 frames: the FLIP, footage and a caption) twice with `--format png-sequence` gave byte-identical PNGs (sha256).
- **`check`:** 0 errors. Three craft warnings kept on purpose: the hero lines leave after about 1.5 s because the page scrolls, and card labels are under the 28 px type floor because the UI is shown at its real size.

## Fixed after looking

- **Outside path refused.** `src="../../../media/…"` failed lint (`invalid_parent_traversal_in_asset_path`) and 404ed at runtime. A symlink inside `assets/footage/` works and avoids a 13 MB copy.
- **Measuring in a callback.** Lint warned that `getBoundingClientRect` in `onUpdate` depends on seek order. The card's box is now measured once at build time and transformed from GSAP values.
- **Black frame at the swap.** Frame 191 showed the player's empty background: the player clip started at 3.2 s, after the swap at 3.18 s. It now starts at 3.1 s.
- **Tab title wrapped** onto two lines in a 300 px tab: 340 px and `nowrap`.
- **End title over the shrinking tile** for about 0.3 s: the shrink now starts at 5.9 s and the tile is gone by 6.35 s. That left a 3-frame empty gap before the title, so the title now starts at 6.3 s.
- **Tiny arrow** in "GSAP → MP4": Noto Sans Mono has no "→" and the fallback glyph was small and low. It is an inline SVG now.
- **Lint and contrast:** a `letterSpacing` tween (snaps to whole pixels) was removed; tab "×" and "+" were raised from 3.9:1 to above 4.5:1; frame 0 was empty, so the window now starts at 35 % opacity; the closing line was on screen under 2 s, so the film grew from 8.5 s to 9.0 s.
