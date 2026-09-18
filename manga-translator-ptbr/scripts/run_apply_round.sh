#!/bin/bash
# Applies translations/<stem>.json onto psd/<stem>.psd via set_text_layers.mjs,
# for every stem that has a translation file but hasn't been applied yet.
# Usage: IMG_DIR=<images> [OUT_DIR=<images>/psd] ./run_apply_round.sh   (re-run until ALL_DONE)
cd "$(dirname "$0")"   # manga-translator-ptbr/scripts
IMG_DIR=${IMG_DIR:?set IMG_DIR=<folder with the page images>}
OUT_DIR=${OUT_DIR:-$IMG_DIR/psd}
TR_DIR=$OUT_DIR/translations
HAVE=$(ls "$TR_DIR"/*.json 2>/dev/null | xargs -n1 basename | sed 's/\.json$//' | sort)
DONE=$(ls "$OUT_DIR"/*.applied 2>/dev/null | xargs -n1 basename | sed 's/\.applied$//' | sort)
REMAIN=$(comm -23 <(echo "$HAVE") <(echo "$DONE"))
N=$(echo -n "$REMAIN" | grep -c . || true)
echo "remaining before this round: $N"
if [ "$N" -eq 0 ]; then echo "ALL_DONE"; exit 0; fi
for stem in $REMAIN; do
  node ./set_text_layers.mjs "$OUT_DIR/$stem.psd" "$TR_DIR/$stem.json" && touch "$OUT_DIR/$stem.applied"
done
