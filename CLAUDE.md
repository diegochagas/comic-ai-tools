# comic-ai-tools

One skill per top-level folder (`<skill>/SKILL.md` + `<skill>/scripts/`),
harness-neutral: this file is read as `CLAUDE.md` (Claude Code) and, through
a symlink, as `AGENTS.md` (Codex). The README's table lists every skill and
its scripts; read a skill's `SKILL.md` before running any of its scripts.

Skills: `gerar-paginas` (AI comic studio), `manga-translator-ptbr` (scans →
letter-ready or PT-BR translated PSD/XCF files), `comic-downloader`
(pattern-based page downloads from JSON site profiles), `comic-archive`, `pdf-psd-convert`, `image-utils`, `japanese-ocr-translate`
(CLI wrappers that pick flags from the request). `.claude/skills/` and
`.agents/skills/` contain symlinks to those folders; the `higgsfield-*`
entries there are vendored third-party skills (`skills-lock.json`) — never
edit them.

## Shared pieces at the repo root

- Root `setup.sh` creates the shared `venv/` (Python deps for all skills)
  and then runs each `<skill>/setup.sh`, which create the rest of what is
  not committed inside the skills: `manga-translator-ptbr/node_modules/`
  (ag-psd, canvas, pngjs; its package.json is `"type": "module"`),
  `comic-downloader/node_modules/` (axios), `manga-translator-ptbr/models/`
  (comic-text-detector + LaMa ONNX) and `japanese-ocr-translate/tessdata/`.
  A skill that needs npm packages gets its own `package.json`; the root
  `.gitignore` already ignores any `node_modules/` and `package-lock.json`.
- All script paths in the skills are relative to the repo root; Python
  scripts expect `venv/bin/python`. Scripts find `venv/` (repo root, two
  levels up) and their skill's `projects/` / `models/` (one level up) from
  their own location, so run them from anywhere but don't move them out of
  `<skill>/scripts/`.
- `manga-translator-ptbr` has three modes (C placeholder, B translate, A
  fill) on one toolchain: `detect_text.py` / `inpaint_lama.py` are the
  detector + inpainter every mode uses; `build_translated_psd.mjs` writes
  PSDs and `build_translated_xcf.py` (headless flatpak GIMP, never with
  `-f`) writes XCFs from the same blocks JSON (`--placeholder` for mode C). The
  skill always runs its pipeline to the end and delivers PSDs; XCF only
  when the request explicitly asks for GIMP files.
- `gerar-paginas/projects/<name>/` (gitignored) holds each AI comic project:
  `project.json`, `PROJECT.md`, `charmap.json`, `scripts_src/`, `refs/`,
  `jobs/`, `work/`, `out/`. New projects start from `gerar-paginas/_template/`.

## gerar-paginas cost rules (apply to every project)

Real credit costs, verified 2026-09-09, Plus plan = 1000 credits/month:
- `gpt_image_2_5` at `quality low` / `resolution 2k` = 2 credits/gen
  (default) — bump `--quality` to `medium` (2.5) or `high` (5.5) only if a
  page keeps failing on text/detail fidelity. `nano_banana_flash` = 1.5
  (cheap layout-only reroll). NEVER `gpt_image_2` (the older model, 7
  credits) or video models. One issue ≈ 150 credits including rerolls.
- Max 3 generation attempts per page, then flag `needs_review` for Diego.
- Check `higgsfield account status` before each batch; warn under 100 credits.
- The agent is the orchestrator and QC reviewer; there is NO LLM API usage.
- Project-specific rules (language, continuity, special pages) live in each
  project's `PROJECT.md` — always read it before generating.

## Conventions

- Keep scripts inside their skill folder and document new ones in both the
  skill's `SKILL.md` and the README table.
- Don't commit generated content (scans, PSDs, renders, worklists); the
  `.gitignore` already covers the usual folders.
