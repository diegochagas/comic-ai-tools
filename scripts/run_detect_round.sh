#!/usr/bin/env bash
# One time-boxed round of Mode-B detection + column merge over a folder.
# Re-run until it prints "ALL DONE" (each shell call is capped by the tool
# timeout, so this stops starting new pages after $BUDGET seconds).
#
#   SRC=<images dir> OUT=<out dir> UP=<upright png dir> [BUDGET=500] \
#   [COLW=300] [MINTILE=2048] scripts/run_detect_round.sh
set -u
cd "$(dirname "$0")/.."
BUDGET=${BUDGET:-500}; COLW=${COLW:-300}; MINTILE=${MINTILE:-2048}
start=$(date +%s); n=0
for img in "$SRC"/*.jpg "$SRC"/*.jpeg "$SRC"/*.png; do
  [ -e "$img" ] || continue
  stem=$(basename "${img%.*}")
  [ -e "$OUT/detect/${stem}_merged.json" ] && continue
  now=$(date +%s); (( now - start > BUDGET )) && { echo "BUDGET reached after $n pages"; exit 2; }
  python3 scripts/detect_blocks.py "$OUT" "$img" --apply-exif --upright-dir "$UP" --min-tile "$MINTILE" 2>&1 | grep -vE "Warn|setattr|return self" || echo "FAIL detect $stem"
  [ -e "$OUT/detect/${stem}_detect.json" ] && python3 scripts/merge_columns.py "$OUT/detect/${stem}_detect.json" --col-width "$COLW" 2>&1 | tail -1
  # the upright PNG is ~55 MB per 71 MP page: drop it now, ensure_upright.py recreates it at clean/build time
  [ "${KEEP_UP:-0}" = 1 ] || rm -f "$UP/${stem}_upright.png"
  n=$((n+1))
done
echo "ALL DONE"
