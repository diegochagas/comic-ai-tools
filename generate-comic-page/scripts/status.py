#!/usr/bin/env python3
"""Show generation progress across all projects and issues.

Usage: python3 generate-comic-page/scripts/status.py [--project NAME|PATH]
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import list_projects, load_state, resolve_project

ap = argparse.ArgumentParser()
ap.add_argument("--project", "-p", default=None)
args = ap.parse_args()

for proj in ([args.project] if args.project else list_projects()):
    name, _cfg, pdir = resolve_project(proj)
    work = pdir / "work"
    if not work.exists():
        continue
    print(f"== {name} ({pdir}) ==")
    for issue_dir in sorted(work.iterdir()):
        state = load_state(pdir, issue_dir.name)
        if not state:
            continue
        counts: dict[str, int] = {}
        for page in state.values():
            counts[page["status"]] = counts.get(page["status"], 0) + 1
        approved = counts.get("approved", 0)
        summary = ", ".join(f"{k}: {v}" for k, v in sorted(counts.items()))
        print(f"  Issue {issue_dir.name}: {approved}/{len(state)} approved  ({summary})")
        for num, page in sorted(state.items()):
            if page["status"] in ("awaiting_review", "needs_review"):
                stage = f" [{page['stage']}]" if page.get("stage") else ""
                print(f"      page {num} {page['status'].upper()}{stage} — {page.get('notes', '')}")
