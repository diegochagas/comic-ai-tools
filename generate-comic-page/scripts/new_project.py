#!/usr/bin/env python3
"""Start a new comic project from _template.

Creates <projects root>/<name>/ (projects root = ~/Downloads, or
$COMIC_PROJECTS_DIR) with project.json, PROJECT.md, an empty charmap.json and
the scripts_src/, refs/model-sheets/, refs/style/ folders.

Usage: new_project.py <name> [--title "Display Name"]
"""
import argparse
import json
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import TEMPLATE, projects_root

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("name", help="folder name, e.g. megaman-x4")
ap.add_argument("--title", help="display name of the comic")
a = ap.parse_args()

if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*", a.name):
    sys.exit("Project name: lowercase letters, digits, '-', '_' or '.' only")
pdir = projects_root() / a.name
if pdir.exists():
    sys.exit(f"{pdir} already exists")

shutil.copytree(TEMPLATE, pdir)
for sub in ("scripts_src", "refs/model-sheets", "refs/style"):
    (pdir / sub).mkdir(parents=True, exist_ok=True)
if a.title:
    cfg_path = pdir / "project.json"
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    cfg["display_name"] = a.title
    cfg_path.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Created {pdir}\nNext: fill project.json + PROJECT.md, put the page scripts in scripts_src/, "
      f"import the model sheets (import_refs.py -p {a.name} <folder>), then split_scripts.py -p {a.name}")
