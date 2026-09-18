#!/usr/bin/env python3
"""Translator views of a merged page: the page cut into N vertical strips
(default 2 = left/right page of a spread), each rendered at --width px with
the numbered block boxes and a ruler in OVERLAY units (the 1-based block
numbers and the ruler coordinates are exactly what tr/<stem>.json uses:
`texts` keys and `add`/`box` rectangles in --overlay-width px).

Usage: python page_views.py <stem>_merged.json <out_dir> [--parts 2] [--width 1400]
                            [--overlay-width 1000]

Writes <out_dir>/<stem>_p1.jpg, _p2.jpg ...  Keep width <= 1400 so the Read
tool shows them unscaled and coordinates read off the ruler are exact.
"""
import argparse
import json
import os

import cv2

ap = argparse.ArgumentParser()
ap.add_argument("merged_json")
ap.add_argument("out_dir")
ap.add_argument("--parts", type=int, default=2)
ap.add_argument("--width", type=int, default=1400)
ap.add_argument("--overlay-width", type=int, default=1000)
a = ap.parse_args()

d = json.load(open(a.merged_json))
src = d.get("source_for_psd") if os.path.exists(d.get("source_for_psd") or "") else None
img = cv2.imread(src) if src else cv2.imread(d["source"], cv2.IMREAD_COLOR)   # EXIF applied, like --apply-exif
H, W = img.shape[:2]
assert [W, H] == d["size"], f"size mismatch {W}x{H} vs {d['size']}"
stem = os.path.basename(a.merged_json)[:-len("_merged.json")]
os.makedirs(a.out_dir, exist_ok=True)
ou = a.overlay_width / W      # page px -> overlay units
part_w = W / a.parts
for p in range(a.parts):
    x0 = int(p * part_w)
    x1 = int((p + 1) * part_w) if p < a.parts - 1 else W
    s = a.width / (x1 - x0)
    view = cv2.resize(img[:, x0:x1], (a.width, round(H * s)), interpolation=cv2.INTER_AREA)
    # ruler: every 25 overlay units
    step_page = 25 / ou
    k = 0
    while k * step_page < W:
        x = k * step_page
        if x0 <= x <= x1:
            vx = round((x - x0) * s)
            cv2.line(view, (vx, 0), (vx, 18 if k % 2 else 30), (0, 160, 0), 1)
            if k % 2 == 0:
                cv2.putText(view, str(k * 25), (vx + 2, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 140, 0), 1, cv2.LINE_AA)
        k += 1
    k = 0
    while k * step_page < H:
        vy = round(k * step_page * s)
        cv2.line(view, (0, vy), (18 if k % 2 else 30, vy), (0, 160, 0), 1)
        if k % 2 == 0:
            cv2.putText(view, str(k * 25), (32, vy + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 140, 0), 1, cv2.LINE_AA)
        k += 1
    for i, (bx, by, bw, bh) in enumerate(d["text_blocks"], 1):
        if bx + bw < x0 or bx > x1:
            continue
        p0 = (round((bx - x0) * s), round(by * s))
        p1 = (round((bx + bw - x0) * s), round((by + bh) * s))
        cv2.rectangle(view, p0, p1, (0, 0, 255), 2)
        label = str(i)
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
        lx, ly = p0[0], max(th + 4, p0[1] - 4)
        cv2.rectangle(view, (lx, ly - th - 4), (lx + tw + 6, ly + 2), (0, 0, 255), -1)
        cv2.putText(view, label, (lx + 3, ly - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
    out = os.path.join(a.out_dir, f"{stem}_p{p + 1}.jpg")
    cv2.imwrite(out, view, [cv2.IMWRITE_JPEG_QUALITY, 82])
    print(out)
