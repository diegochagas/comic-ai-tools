#!/usr/bin/env python3
"""Recreate the EXIF-free `source_for_psd` PNG a detect json points to, if it
is missing (they are big and safe to delete between pipeline stages).

Usage: python ensure_upright.py <detect_or_merged_or_blocks.json> [...]

Rotates the original scan exactly like detect_blocks.py --apply-exif did
(cv2.imread honouring the EXIF orientation), so the pixel grid matches the
boxes. A json whose source_for_psd is the source itself is a no-op.
"""
import json
import os
import sys

import cv2

for p in sys.argv[1:]:
    d = json.load(open(p))
    dst = d.get("source_for_psd")
    if not dst or dst == d["source"] or os.path.exists(dst):
        continue
    img = cv2.imread(d["source"], cv2.IMREAD_COLOR)   # EXIF applied
    if img is None:
        print(f"FAIL {p}: cannot read {d['source']}"); continue
    if [img.shape[1], img.shape[0]] != d["size"]:
        print(f"FAIL {p}: rotated size {img.shape[1]}x{img.shape[0]} != json size {d['size']}"); continue
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    cv2.imwrite(dst, img, [cv2.IMWRITE_PNG_COMPRESSION, 1])
    print(f"{os.path.basename(dst)} recreated")
