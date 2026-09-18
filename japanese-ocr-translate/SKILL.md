---
name: japanese-ocr-translate
description: OCR the Japanese text of every image in a folder (Tesseract, vertical + horizontal) into one block-organized TXT (one "## image.jpg" block per page), and machine-translate that TXT into Brazilian Portuguese (Google Translate via deep-translator) keeping the same blocks. Use when the user asks to "transcribe / OCR the Japanese pages", "get the text out of these scans", "translate this transcription", or wants a rough PT-BR reading of a Japanese novel/manga/doujinshi scan folder. Not for producing lettered PSDs (that is manga-translator-ptbr). Picks language mode (vertical vs horizontal), PSM, output file, and cache flags from the request.
---

# japanese-ocr-translate — Japanese scans → text → PT-BR

Two scripts in `japanese-ocr-translate/scripts/`, meant to be run one after
the other. Run them with the repo venv (`<repo>/venv/bin/python`, created by
`<repo>/setup.sh`). `<repo>` is the comic-skills checkout.

**Where results go:** `~/Downloads` (`COMIC_OUTPUT_DIR` replaces that root;
`--output <file.txt>` names an exact file when the user asks for one).
The source folder is never written to.

| Script | What it does | Needs |
| --- | --- | --- |
| `transcribe_japanese_images.py <folder>` | Tesseract OCR of every image in the folder (natural filename order) → `~/Downloads/<folder name>/japanese_transcription.txt`, one `## <image>` block per page, `---` between blocks; per-image cache next to the output | `tesseract` on PATH (`sudo apt install tesseract-ocr`), Pillow, Japanese traineddata in `japanese-ocr-translate/tessdata/` (downloaded by `japanese-ocr-translate/setup.sh`) |
| `translate_japanese_texts_ptbr.py <txt>` | translates each block of that TXT → `<stem>_pt_br.txt` beside it (it is already in `~/Downloads`; a TXT from elsewhere goes to `~/Downloads/<its folder name>/`), same block headings; per-block cache | `deep-translator`, internet access (Google Translate) |

Output block shape:

```
## 10-11.jpg

<text for that page>

---
```

## Choosing the flags

**OCR** (`transcribe_japanese_images.py <folder> [flags]`):

| The user says... | Flags |
| --- | --- |
| "transcribe / OCR these pages" (novel, manga, vertical text) | none — `--lang jpn_vert+jpn --psm 5`, images over 4000 px on the long side are downscaled first |
| "the text is horizontal", "it's a magazine / web page layout", vertical results are garbage | `--lang jpn --psm 6` |
| "one block of text per page", single column | `--psm 4` or `--psm 6`; try `5` first for vertical |
| names an output file | `--output <file.txt>` |
| "huge scans", OCR stalls or times out | lower `--max-side 3000`; raise `--ocr-timeout` (default 240 s) |
| "re-run from scratch", results look stale after replacing images | `--no-cache` |
| tesseract or the traineddata are somewhere else | `--tesseract <path>`, `--tessdata-dir <dir>` |

Tesseract is weak on handwritten and stylised text; expect to correct names
and SFX by reading the page yourself when it matters.

**Translate** (`translate_japanese_texts_ptbr.py <japanese.txt> [flags]`):

| The user says... | Flags |
| --- | --- |
| "translate it to Portuguese" | none — `ja → pt`, writes `<input_stem>_pt_br.txt` |
| names an output file | `--output <file.txt>` |
| a different source/target language | `--source <code> --target <code>` |
| "redo the translation", after editing the Japanese TXT | `--no-cache` (the cache is per block) |

The machine translation is a first pass for reading, not a lettering-quality
script: for translated Photoshop text boxes over the pages use the
`manga-translator-ptbr` skill, whose translation is done by the agent.

## Examples

```bash
<repo>/venv/bin/python japanese-ocr-translate/scripts/transcribe_japanese_images.py "/path/to/images"
<repo>/venv/bin/python japanese-ocr-translate/scripts/transcribe_japanese_images.py "/path/to/images" --lang jpn --psm 6 --output "/path/to/jp.txt"
<repo>/venv/bin/python japanese-ocr-translate/scripts/translate_japanese_texts_ptbr.py ~/Downloads/images/japanese_transcription.txt
```

## Report

Where the TXT files were written, how many blocks (pages) they contain, and
any page whose OCR came back empty or timed out (the script prints those).
