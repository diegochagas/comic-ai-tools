#!/usr/bin/env bash
# japanese-ocr-translate setup (also run by <repo>/setup.sh): downloads the
# Japanese Tesseract language data into ./tessdata and checks for the
# tesseract binary. Python deps (pillow, deep-translator) come from the shared
# <repo>/venv. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")"

TESSDATA_DIR="tessdata"
TESSDATA_BASE_URL="https://github.com/tesseract-ocr/tessdata/raw/main"
TESSDATA_FILES="jpn.traineddata jpn_vert.traineddata"

mkdir -p "$TESSDATA_DIR"
for f in $TESSDATA_FILES; do
    if [ ! -f "$TESSDATA_DIR/$f" ]; then
        echo "Downloading Tesseract language data ($f, ~15 MB)..."
        curl -L --fail -o "$TESSDATA_DIR/$f" "$TESSDATA_BASE_URL/$f"
    fi
done
echo "tessdata ready: $TESSDATA_DIR"

if ! command -v tesseract >/dev/null 2>&1; then
    echo "WARNING: tesseract binary not found - install it to run transcribe_japanese_images.py."
    echo "  sudo apt install tesseract-ocr"
fi
