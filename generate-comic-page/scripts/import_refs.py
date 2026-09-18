#!/usr/bin/env python3
"""Copy example images (character model sheets, or style pages) into a project.

Diego hands over a folder of examples the first time a comic is generated,
and more examples whenever a character keeps coming out wrong. This copies
every image into <project>/refs/model-sheets/ (or refs/style/ with --style):
file names are slugified, byte-identical files are skipped, a different file
with the same name gets a numeric suffix. Prints the files that are NEW —
the agent must then LOOK at each one and register it in charmap.json
(keywords, sheets, description).

Usage: import_refs.py -p <project> <folder-or-image> [more...] [--style]
"""
import argparse
import hashlib
import re
import shutil
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import IMAGE_EXTS, load_charmap, resolve_project


def slug(stem: str) -> str:
    s = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "ref"


def sha(path: Path) -> str:
    return hashlib.sha1(path.read_bytes()).hexdigest()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--project", "-p", default=None)
    ap.add_argument("sources", nargs="+")
    ap.add_argument("--style", action="store_true", help="import as style anchors (refs/style/)")
    a = ap.parse_args()

    _name, _cfg, pdir = resolve_project(a.project)
    dest = pdir / "refs" / ("style" if a.style else "model-sheets")
    dest.mkdir(parents=True, exist_ok=True)

    files: list[Path] = []
    for src in (Path(s).expanduser() for s in a.sources):
        if src.is_dir():
            files += sorted(f for f in src.rglob("*") if f.suffix.lower() in IMAGE_EXTS)
        elif src.is_file() and src.suffix.lower() in IMAGE_EXTS:
            files.append(src)
        else:
            sys.exit(f"Not a folder or image: {src}")
    if not files:
        sys.exit("No images found (png, jpg, jpeg, webp)")

    have = {sha(f): f.name for f in dest.iterdir() if f.is_file()}
    new: list[str] = []
    for f in files:
        digest = sha(f)
        if digest in have:
            print(f"skip (already imported as {have[digest]}): {f.name}")
            continue
        name, n = f"{slug(f.stem)}{f.suffix.lower()}", 1
        while (dest / name).exists():
            n += 1
            name = f"{slug(f.stem)}-{n}{f.suffix.lower()}"
        shutil.copy2(f, dest / name)
        have[digest] = name
        new.append(name)
        print(f"imported: {f.name} -> {dest / name}")

    if new and not a.style:
        mapped = {s for e in load_charmap(pdir).get("map", []) for s in e["sheets"]}
        todo = [n for n in new if n not in mapped]
        print(f"\n{len(todo)} sheet(s) not in charmap.json yet — look at each image, then add/extend its "
              f"entry in {pdir / 'charmap.json'} (keywords, sheets, description):")
        print("\n".join(f"  {dest / n}" for n in todo))


if __name__ == "__main__":
    main()
