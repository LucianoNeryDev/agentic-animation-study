#!/bin/bash
# Usage: grid.sh <pattern-with-%d-width-spec e.g. previews/f%08d.png> <out.png> <cols> <frame>...
# Tiles the listed frames into one labelled grid.
pat=$1; out=$2; cols=$3; shift 3
inputs=(); filt=""; i=0; layout=()
for f in "$@"; do
  inputs+=(-i "$(printf "$pat" "$f")")
  filt+="[$i]scale=640:-1,drawtext=text='$f':x=8:y=8:fontsize=28:fontcolor=yellow:box=1:boxcolor=black@0.6[v$i];"
  i=$((i+1))
done
n=$i; maps=""
for ((k=0;k<n;k++)); do
  c=$((k%cols)); r=$((k/cols))
  layout+=("$((c*640))_$((r*360))"); maps+="[v$k]"
done
IFS='|'; lay="${layout[*]}"; unset IFS
ffmpeg -v error -y "${inputs[@]}" -filter_complex "${filt}${maps}xstack=inputs=$n:layout=$lay:fill=white" -frames:v 1 -update 1 "$out"
