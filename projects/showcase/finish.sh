#!/bin/bash
# Final steps once Blender's frames are done: encode Blender, put its measured
# seconds-per-frame into the Motion Canvas chart, render the chart video, and
# check every deliverable with ffprobe.
set -euo pipefail
cd "$(dirname "$0")"

ffmpeg -v error -y -framerate 24 -start_number 1 -i blender/renders/frames/f_%04d.png \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart blender/renders/collapse.mp4

# mean render time per frame from Blender's log ("Time: MM:SS.ss")
mean=$(grep -oE 'Time: [0-9]+:[0-9.]+' blender/renders/render.log |
  awk -F'[ :]+' '{s += $2 * 60 + $3; n++} END {printf "%.1f", s / n}')
echo "blender mean ${mean} s/frame"
sed -i -E "s/(route: 'Blender', how: 'Cycles, 40 samples', color: '#f5792a', value: )[0-9.]+/\1${mean}/" motion-canvas/src/data.ts
grep Blender motion-canvas/src/data.ts

(cd motion-canvas && DISABLE_TELEMETRY=true npx tsx src/render.ts --out renders/loop.mp4 2>&1 | grep -iE 'error|Rendered')

for f in blender/renders/collapse.mp4 godot/renders/arena.mp4 threejs/renders/field.mp4 motion-canvas/renders/loop.mp4; do
  printf '%-34s ' "$f"
  ffprobe -v error -count_frames -select_streams v \
    -show_entries stream=width,height,r_frame_rate,nb_read_frames:format=duration -of compact=p=0:nk=0 "$f" | tr '\n' ' '
  echo
done
