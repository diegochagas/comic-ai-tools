#!/usr/bin/env python3
"""Rotate every image of a folder clockwise by N degrees (default 90).

The originals are never touched: the rotated copies go to
~/Downloads/<folder name> rotated <degrees>/ (or $COMIC_OUTPUT_DIR/..., or
--output <dir>), same file names.

Usage: rotate_images.py <folder> [degrees] [--output DIR]
"""
import argparse
import os
import sys
from pathlib import Path

from PIL import Image

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tiff", ".webp"}


def output_root() -> Path:
    return Path(os.environ.get("COMIC_OUTPUT_DIR") or Path.home() / "Downloads").expanduser()


def rotate_images(folder: Path, degrees: int, output: Path) -> None:
    if not folder.is_dir():
        print(f"Error: '{folder}' is not a valid directory.")
        sys.exit(1)
    if output.resolve() == folder.resolve():
        print("Error: --output is the source folder; the originals are never overwritten.")
        sys.exit(1)

    images = sorted(f for f in folder.iterdir() if f.suffix.lower() in IMAGE_EXTENSIONS)
    if not images:
        print("No images found in the folder.")
        return

    output.mkdir(parents=True, exist_ok=True)
    for image_path in images:
        with Image.open(image_path) as img:
            img.rotate(-degrees, expand=True).save(output / image_path.name)
        print(f"Rotated: {image_path.name}")

    print(f"\nDone. {len(images)} image(s) rotated {degrees} degrees -> {output}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder")
    ap.add_argument("degrees", type=int, nargs="?", default=90)
    ap.add_argument("--output", help="destination folder (default: ~/Downloads/<folder name> rotated <degrees>)")
    a = ap.parse_args()
    src = Path(a.folder).expanduser().resolve()
    dst = Path(a.output).expanduser() if a.output else output_root() / f"{src.name} rotated {a.degrees}"
    rotate_images(src, a.degrees, dst)
