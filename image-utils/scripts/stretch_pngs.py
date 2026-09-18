#!/usr/bin/env python3
"""Stretch every PNG of a folder to exactly WIDTH x HEIGHT (aspect ratio NOT kept).

The results go to ~/Downloads/<folder name> <W>x<H>/ (or $COMIC_OUTPUT_DIR/...,
or --output <dir>), same file names; the originals are never touched.

Usage: stretch_pngs.py <folder> <width> <height> [--output DIR]
"""
import argparse
import os
from pathlib import Path

from PIL import Image


def output_root() -> Path:
    return Path(os.environ.get("COMIC_OUTPUT_DIR") or Path.home() / "Downloads").expanduser()


parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument("folder", help="Path to the folder containing PNG images")
parser.add_argument("width", type=int, help="Target width in pixels")
parser.add_argument("height", type=int, help="Target height in pixels")
parser.add_argument("--output", help="destination folder (default: ~/Downloads/<folder name> <W>x<H>)")
args = parser.parse_args()

input_folder = Path(args.folder).expanduser().resolve()
if not input_folder.is_dir():
    raise FileNotFoundError(f"Folder not found: {input_folder}")

output_folder = (Path(args.output).expanduser() if args.output
                 else output_root() / f"{input_folder.name} {args.width}x{args.height}")
if output_folder.resolve() == input_folder:
    raise SystemExit("--output is the source folder; the originals are never overwritten.")
output_folder.mkdir(parents=True, exist_ok=True)

count = 0
for image_path in sorted(input_folder.glob("*.png")):
    with Image.open(image_path) as img:
        img.resize((args.width, args.height), Image.Resampling.LANCZOS).save(output_folder / image_path.name)
    count += 1

print(f"Done! {count} resized PNG file(s) saved to: {output_folder}")
