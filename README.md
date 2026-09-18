# comic-ai-tools

Diego's agent skills for making and working with comics and manga: an AI
comic studio (page scripts → AI-generated pages → `.cbz`), manga scans →
letter-ready or PT-BR-translated layered PSD/XCF files, a pattern-based
page downloader, and small CLI skills for comic archives, PDF/PSD
conversion, image batches and Japanese OCR.

> These skills are tailored to this machine (flatpak GIMP 3, a Higgsfield
> Plus subscription, Brazilian Portuguese as the target language). Treat them
> as examples and adapt rather than reuse verbatim.

## Layout

Flat, one directory per skill:

```
<skill>/SKILL.md      what the agent reads (workflow, how to pick flags from the request)
<skill>/README.md     human overview, only where the skill is big enough to need one
<skill>/scripts/      every script that skill runs (nothing lives outside its skill)
<skill>/setup.sh      that skill's own setup (models, tessdata, node_modules, tool checks), if it needs any
<skill>/examples/, _template/, sites/, models/, tessdata/   skill-owned assets (the last two are downloaded by setup.sh, not committed)
```

The only shared, machine-generated piece at the repo root is `venv/` (Python
deps for every skill), created by **`./setup.sh`**, which then runs every
`<skill>/setup.sh`. Everything else a skill needs lives inside it: `node_modules/` from its own
`package.json` (`manga-translator-ptbr`, `comic-downloader`),
`manga-translator-ptbr/models/`, `japanese-ocr-translate/tessdata/` (all
installed by `setup.sh`) and the comic projects in `gerar-paginas/projects/`
— all gitignored by the root `.gitignore`. All commands in the skills are
written relative to the repo root.

## Skills

| Skill | Scripts | What it does |
| --- | --- | --- |
| [`gerar-paginas`](gerar-paginas/) ([README](gerar-paginas/README.md)) | `split_scripts.py`, `status.py`, `make_lettering_guide.py`, `assemble_cbz.py`, `common.py`, `gen_page.py`, `batch_gen.sh`, `_template/` | AI comic studio: splits per-issue prompt scripts into page jobs, drives Higgsfield (`gpt_image_2_5`, ~2 credits/page) page by page with visual QC + reroll loop, writes the lettering guide, packs approved pages into `.cbz`. One project per `gerar-paginas/projects/<name>/` (currently `megaman-nam`). |
| [`manga-translator-ptbr`](manga-translator-ptbr/) ([README](manga-translator-ptbr/README.md)) | `detect_text.py`, `inpaint_lama.py`, `detect_blocks.py`, `merge_columns.py`, `overlay_tiles.py`, `block_sheets.py`, `page_views.py`, `assemble_translation.py`, `merge_translations.py`, `clean_blocks.py`, `ensure_upright.py`, `build_translated_psd.mjs`, `build_translated_xcf.py`, `gimp_xcf_job.py`, `verify_translated_psd.mjs`, `validate_psds.mjs`, `preview_psd_text.py`, `build_two_source_psd.mjs`, `list_layers.mjs`, `list_text_layers.mjs`, `export_layer.mjs`, `set_text_layers.mjs`, `add_and_fill_text_layers.mjs`, `scan_placeholders.mjs`, `annotate_text_boxes.py`, `run_letter_round.sh`, `run_detect_round.sh`, `run_build_round.sh`, `run_apply_round.sh`, `examples/` | Manga/doujinshi/art-book scans → layered PSDs (Photoshop text boxes) or XCFs (native GIMP text layers, via headless GIMP): `Original` + `Copy` with the text erased (solid fill on plain backgrounds, LaMa inpainting over art) + one editable Photoshop paragraph text box per block. Mode C leaves "Lorem ipsum" in CCWildWords for a human letterer, fully automatic. Mode B (any scan size, tiled detection for 7000×10000 pages with tiny print) has the agent review the boxes, merge Japanese columns into paragraphs and write the Brazilian Portuguese itself. Mode A fills the placeholder boxes of existing PSDs. ONNX detection + ag-psd; GIMP only for XCF output. |
| [`comic-downloader`](comic-downloader/) ([README](comic-downloader/README.md)) | `download.cjs`, `sites/<name>/download.config.json` | Downloads comic/magazine page images whose URLs follow a pattern (numbered pages, issues with dates, galleries, URL lists) from JSON site profiles; dry-run first, skips existing files. Bundled profile: Dorothee Magazine. |
| [`comic-archive`](comic-archive/) | `images_to_cbr.py`, `cbr_to_images.py` | Pack image folders into `.cbr`/`.cbz` (optional JPEG conversion, max height, quality) and unpack `.cbr`/`.cbz`/`.zip` archives (RAR via unrar/7z; `--first-only` for covers). The SKILL.md maps what the user asks for to the flags. |
| [`pdf-psd-convert`](pdf-psd-convert/) | `pdf_to_images.py`, `psd_to_jpg.py` | PDF pages → JPG at any DPI (one folder per PDF or one shared folder); `.psd`/`.psb` → JPG recursively, keeping folder structure, with matte color and an optional all-layers-visible render. |
| [`image-utils`](image-utils/) | `rotate_images.py`, `stretch_pngs.py` | Rotate every image in a folder in place by N degrees; stretch every PNG to exact W×H into `output/`. |
| [`japanese-ocr-translate`](japanese-ocr-translate/) | `transcribe_japanese_images.py`, `translate_japanese_texts_ptbr.py`, `tessdata/` | Tesseract OCR of a folder of Japanese scans into one block-per-page TXT, then Google-translate it to PT-BR keeping the blocks — a rough reading pass, not lettering. |

Each `SKILL.md` documents the scripts' flags and, for the CLI skills, a table
of "what the user says → which flags to pass".

## Consumers

Each harness's `skills/` directory in this repo is a real directory whose
entries are symlinks into the skill folders, so one edit reaches all of them:

| Harness | Skills directory | How it links |
| --- | --- | --- |
| Claude Code | `.claude/skills/` | per-skill symlinks → `../../<skill>` (own skills) and → `../../.agents/skills/higgsfield-*` (vendored) |
| Codex / shared | `.agents/skills/` | per-skill symlinks → `../../<skill>`, plus the vendored `higgsfield-*` skills as real directories |
| both | `CLAUDE.md`, `AGENTS.md` | `AGENTS.md` is a symlink to `CLAUDE.md`; the text is harness-neutral |

The skills are project-scoped: they load when an agent is started inside
this repo. To use them from anywhere, symlink the skill folders into the
global directories, the same way:

```sh
for s in gerar-paginas manga-translator-ptbr comic-downloader comic-archive pdf-psd-convert image-utils japanese-ocr-translate; do
  for h in ~/.claude/skills ~/.agents/skills ~/.codex/skills; do
    mkdir -p "$h" && ln -sfn ~/Projects/comic-ai-tools/$s "$h/$s"
  done
done
```

Harnesses read `SKILL.md` at startup, so restart a running agent to pick up
a newly added skill.

## External components

| Component | Source | Where it lives | Update procedure |
| --- | --- | --- | --- |
| `higgsfield-*` skills (brandkit, generate, marketplace-cards, product-photoshoot, soul-id, video-explainer, websites, youtube-thumbnail) | [higgsfield-ai/skills](https://github.com/higgsfield-ai/skills) via `npx skills add higgsfield-ai/skills` | `.agents/skills/higgsfield-*/` (real dirs, tracked in `skills-lock.json`), symlinked from `.claude/skills/` | `npx skills add higgsfield-ai/skills` again; never edit them here |
| Higgsfield CLI | npm `@higgsfield/cli` | global npm | `npm i -g @higgsfield/cli`, then `higgsfield auth login` |
| comic-text-detector model | [manga-image-translator release beta-0.3](https://github.com/zyddnys/manga-image-translator/releases/tag/beta-0.3) | `manga-translator-ptbr/models/comictextdetector.pt.onnx` | `manga-translator-ptbr/setup.sh` re-downloads if missing |
| LaMa inpainting model | [Carve/LaMa-ONNX](https://huggingface.co/Carve/LaMa-ONNX) | `manga-translator-ptbr/models/lama_fp32.onnx` | `manga-translator-ptbr/setup.sh` |
| Japanese Tesseract data | [tesseract-ocr/tessdata](https://github.com/tesseract-ocr/tessdata) | `japanese-ocr-translate/tessdata/` | `japanese-ocr-translate/setup.sh` |
| ag-psd, canvas, pngjs | npm (`manga-translator-ptbr/package.json`) | `manga-translator-ptbr/node_modules/` | `<skill>/setup.sh` (npm install) |
| axios | npm (`comic-downloader/package.json`) | `comic-downloader/node_modules/` | `<skill>/setup.sh` (npm install) |

## Setup

```bash
git clone <this repo> ~/Projects/comic-ai-tools
cd ~/Projects/comic-ai-tools
./setup.sh     # shared venv + python deps, then every <skill>/setup.sh (node_modules, ONNX models, tessdata, GIMP/tesseract checks)
```

System requirements, by skill:

- `manga-translator-ptbr`: Python 3.10+, Node.js + npm, ~300 MB for the
  two models (in the skill's `models/`). [flatpak GIMP 3](https://flathub.org/apps/org.gimp.GIMP) only
  for XCF output. The `CCWildWords-Regular` font on the machine that opens
  the files in Photoshop/GIMP.
- `comic-downloader`: Node.js only.
- `gerar-paginas`: the Higgsfield CLI logged in to a Higgsfield account
  (Plus plan, 1000 credits/month).
- `japanese-ocr-translate`: `tesseract` on `PATH` (`sudo apt install tesseract-ocr`).
- `comic-archive`: `unrar` or `7z` only for RAR-based `.cbr` files.

## Rules

`.gitignore` blocks `venv/`, every `node_modules/` and `package-lock.json`,
`manga-translator-ptbr/models/`, `japanese-ocr-translate/tessdata/`,
`gerar-paginas/projects/`, `comic-downloader/downloads/`, `tmp_worklists/`
and `__pycache__/`. Generated comics, scans, downloads, PSDs and per-job
scratch never go in the repo.

Output folders inside a syncing cloud drive (Nextcloud, Dropbox) can race a
fresh PSD write and revert it within seconds — verify a moment after
writing, or write to a local path first.
