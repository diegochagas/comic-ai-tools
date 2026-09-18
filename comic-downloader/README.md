# comic-downloader

A small Node.js image downloader driven by JSON site profiles, for comic and
magazine sites whose page images follow a URL pattern. The reusable script is
`scripts/download.cjs`; website-specific URL patterns, folders, item lists,
issue ranges and reference files live under `sites/<name>/`. The agent-facing
instructions (how to pick flags and write a profile from a URL pattern) are
in [SKILL.md](SKILL.md).

Formerly the standalone `automate-downloads` repo.

## Layout

```text
scripts/download.cjs                 the downloader (CommonJS)
package.json, setup.sh               axios (node_modules/ gitignored; setup.sh = npm install)
sites/
  dorothee/download.config.json      Dorothee Magazine profile (issues 484–539, pages 35–38)
  dorothee/reference/                saved page sources the profile was derived from
  example/download.config.json       starting point for a new website
```

## Run

From the repo root (`comic-downloader/setup.sh` once, or the root `./setup.sh`):

```bash
node comic-downloader/scripts/download.cjs --site dorothee --dry-run   # preview URLs and output paths
node comic-downloader/scripts/download.cjs --site dorothee             # download
node comic-downloader/scripts/download.cjs --config path/to/download.config.json
```

| Flag | Meaning |
| --- | --- |
| `-s`, `--site <name>` | use `sites/<name>/download.config.json` (default: `dorothee`) |
| `-c`, `--config <path>` | use a profile anywhere on disk (`outputDir` still resolves under `~/Downloads`) |
| `--dry-run` | print `url -> path` for every target, download nothing |
| `--overwrite` | replace existing files (default: skip them; `overwriteExisting: true` in the profile does the same) |

## Add another website

```bash
mkdir -p comic-downloader/sites/my-site
cp comic-downloader/sites/example/download.config.json comic-downloader/sites/my-site/download.config.json
```

Then edit the URL patterns and output folder. A profile can download:

Direct image URLs:

```json
{ "downloads": [ { "name": "direct-images",
    "urls": [ { "url": "https://example.com/media/header.jpg", "fileName": "header.jpg" } ] } ] }
```

Numbered image paths:

```json
{ "baseUrl": "https://example.com/assets", "pageNumberPadding": 2,
  "downloads": [ { "name": "gallery", "pages": { "from": 1, "to": 10 },
                   "urlPathTemplate": "gallery/image-{pagePadded}.jpg" } ] }
```

Grouped galleries, issues or collections:

```json
{ "baseUrl": "https://example.com/assets", "outputDir": "my-site",
  "itemFolderTemplate": "{slug}",
  "items": [ { "id": "summer", "slug": "summer-gallery" }, { "id": "winter", "slug": "winter-gallery" } ],
  "downloads": [ { "name": "gallery-pages", "pages": { "from": 1, "to": 5 },
                   "urlPathTemplate": "{slug}/image-{page}.jpg" } ] }
```

`outputDir` is a folder under `~/Downloads` (`COMIC_OUTPUT_DIR` replaces that
root): `"my-site"` writes into `~/Downloads/my-site/`. Omitted, it defaults to
the profile's folder name. An absolute path or one starting with `~/` is used
as is.

### Config fields

- `siteName`: readable name. `baseUrl`: prefix joined with `urlPathTemplate`.
- `outputDir`, `overwriteExisting`, `request.timeoutMs`.
- `variables`: site-level template values.
- `items`: arbitrary records (galleries, issues, products...). `itemRanges`:
  numbered ranges from `startItem` and `endItem`, `endDate` or `count`
  (`step`, `dateStepMonths`). `issueRanges` / `issues`: the same for
  magazine-style profiles, exposing `{issue}` values.
- `itemFolderTemplate`: folder per item. `monthNames`: localized month names
  for `{monthName}` / `{dateLabel}` (Dorothee uses French, giving folders like
  `484 - Janvier 2002`).
- `downloads[]`: `urlPathTemplate` (joined with `baseUrl`), `urlTemplate`
  (full URL), or `urls` (list); `pages` (number, list or `{from,to,step}`);
  `fileNameTemplate` / `fileName`; `outputSubdirTemplate`; `variables`;
  `pageNumberPadding`.

### Template values

`{siteName}` `{baseUrl}` · `{item}` `{itemId}` `{itemNumber}` `{itemPadded}`
· `{issue}` `{issueNumber}` `{issuePadded}` · `{date}` `{year}` `{month}`
`{day}` `{monthName}` `{dateLabel}` · `{page}` `{pagePadded}` ·
`{downloadName}` `{urlPath}` `{url}`, plus `variables` and item keys.
