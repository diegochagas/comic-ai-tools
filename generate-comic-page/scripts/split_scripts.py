#!/usr/bin/env python3
"""Split a project's per-issue prompt scripts into per-page job files.

Generic over projects: each project lives in ~/Downloads/<name>/ (or
$COMIC_PROJECTS_DIR/<name>/, or any folder passed to -p) with a project.json
describing its scripts, page-header pattern and reference rules.

Each job file (<project>/jobs/<issue>/page_NN.json) contains:
  - the full page prompt text (verbatim from the script)
  - the shared preamble of the issue (base style, model-sheet instructions)
  - which model sheets to attach (resolved via the project's charmap.json)
  - which style reference pages to attach
  - the page kind (cover / editorial / story)
  - a list of exact dialogue strings that must appear on the page (QC)

Also creates/refreshes work/<issue>/state.json (never overwrites page statuses
that already exist).

Usage: python3 generate-comic-page/scripts/split_scripts.py [--project NAME|PATH] [issues...]
"""
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import load_charmap, no_sheet_chars, page_kind, resolve_project, resolve_sheets

DIALOG_RE = re.compile(r"[\"“]([^\"”]{2,400})[\"”]")


def extract_dialogue(page_text: str) -> list[str]:
    out = []
    for m in DIALOG_RE.finditer(page_text):
        s = m.group(1).strip()
        if s and s not in out:
            out.append(s)
    return out


def style_refs_for(cfg: dict, kind: str) -> list[str]:
    rules = cfg.get("style_refs", {})
    if kind in rules:                      # "cover" / "editorial" specific anchors
        return rules[kind]
    return rules.get("default", [])


def split_issue(pdir: Path, cfg: dict, charmap: dict, issue: str) -> None:
    src = pdir / "scripts_src" / cfg["script_pattern"].format(issue=issue)
    if not src.exists():
        sys.exit(f"Script not found: {src}")
    text = src.read_text(encoding="utf-8")

    page_re = re.compile(
        cfg.get("page_header_regex", r"^=== PAGE (\d+)\s*[—-]\s*(.*?)\s*===\s*$"),
        re.MULTILINE,
    )
    matches = list(page_re.finditer(text))
    if not matches:
        sys.exit(f"No pages found in {src} (check page_header_regex in project.json)")

    preamble = text[: matches[0].start()].strip()

    jobs_dir = pdir / "jobs" / issue
    jobs_dir.mkdir(parents=True, exist_ok=True)
    work_dir = pdir / "work" / issue
    (work_dir / "gen").mkdir(parents=True, exist_ok=True)
    (work_dir / "approved").mkdir(parents=True, exist_ok=True)

    state_path = work_dir / "state.json"
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}

    for i, m in enumerate(matches):
        page_no = int(m.group(1))
        title = m.group(2) if (m.lastindex or 1) >= 2 else ""
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[m.start():end].strip().strip("-").strip()

        kind = page_kind(cfg, page_no, title)
        job = {
            "issue": issue,
            "page": page_no,
            "title": title,
            "kind": kind,
            "preamble": preamble,
            "prompt": body,
            "model_sheets": resolve_sheets(charmap, body),
            "no_sheet_characters": no_sheet_chars(charmap, body),
            "style_refs": style_refs_for(cfg, kind),
            "dialogue_exact": extract_dialogue(body),
            "aspect": cfg.get("aspect", "2:3"),
            "lettering": cfg.get("lettering", "ai"),
        }
        (jobs_dir / f"page_{page_no:02d}.json").write_text(
            json.dumps(job, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        key = f"{page_no:02d}"
        if key not in state:
            state[key] = {"status": "pending", "tries": 0, "title": title, "notes": ""}

    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[{pdir.name}] issue {issue}: {len(matches)} pages -> {jobs_dir}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", "-p", default=None)
    ap.add_argument("issues", nargs="*")
    args = ap.parse_args()

    name, cfg, pdir = resolve_project(args.project)
    charmap = load_charmap(pdir)
    for issue in (args.issues or [str(i) for i in cfg["issues"]]):
        split_issue(pdir, cfg, charmap, str(issue))
