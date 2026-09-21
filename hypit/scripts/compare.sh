#!/usr/bin/env bash
# Build a local side-by-side / stacked comparison of two videos.
#
# Orientation follows the source aspect ratio so the result stays uploadable:
#   portrait  (3:4, 9:16) -> left/right
#   landscape (4:3, 16:9) -> top/bottom
#
# This runs entirely in ffmpeg: no model call, no API usage, no cost.
#
# Usage: compare.sh <original> <result> <output> [label-original] [label-result]
set -euo pipefail

orig="${1:?original video required}"
result="${2:?result video required}"
out="${3:?output path required}"

for f in "$orig" "$result"; do
  [ -f "$f" ] || { echo "missing input: $f" >&2; exit 1; }
done

read -r ow oh < <(ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height -of csv=p=0 "$orig" | tr ',' ' ')

# Portrait frames stack horizontally; landscape frames stack vertically.
if [ "$ow" -lt "$oh" ]; then
  layout=hstack
  orientation="left/right"
else
  layout=vstack
  orientation="top/bottom"
fi

mkdir -p "$(dirname "$out")"

# Match the shorter of the two before combining: a provider may render a
# different duration than requested, and ffmpeg would otherwise stall on EOF.
odur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$orig")
rdur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$result")
dur=$(awk -v a="$odur" -v b="$rdur" 'BEGIN{printf "%.3f", (a<b?a:b)}')

ffmpeg -y -v error -t "$dur" -i "$orig" -t "$dur" -i "$result" \
  -filter_complex "[0:v]scale=${ow}:${oh},setsar=1[a];[1:v]scale=${ow}:${oh},setsar=1[b];[a][b]${layout}=inputs=2[out]" \
  -map "[out]" -map 1:a? -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k \
  -movflags +faststart "$out"

echo "comparison written: $out"
echo "  layout: $orientation (source ${ow}x${oh}, ${dur}s)"
