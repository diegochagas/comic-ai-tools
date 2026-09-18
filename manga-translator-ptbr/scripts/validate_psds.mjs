#!/usr/bin/env node
// Batch sanity check of every PSD in a folder, for the end of a run (verify
// the batch, not just each page): readable, has the "Original" + "Copy"
// raster layers, has the expected number of "Text N" layers, and no text
// layer is empty. Expected count per <stem>, first match wins:
//   <dir>/final/<stem>_blocks.json  (text_blocks)   - Mode B folder path
//   <dir>/tr/<stem>.json            (texts keys)    - Mode B, before assembling
//   <dir>/detect/<stem>_detect.json (text_blocks)   - placeholder mode
// Without --placeholder any "Lorem ipsum" left in a box is reported (a
// translation pass missed it); with it, placeholder text is what we expect.
//
// Usage: node validate_psds.mjs <dir-with-psds> [--placeholder]
import * as fs from 'fs';
import * as path from 'path';
import { readPsd } from 'ag-psd';

const outDir = process.argv[2];
const PLACEHOLDER = process.argv.includes('--placeholder');
if (!outDir) { console.error('Usage: node validate_psds.mjs <dir-with-psds> [--placeholder]'); process.exit(1); }

function expectedFor(stem) {
  const cands = [
    [path.join(outDir, 'final', `${stem}_blocks.json`), (j) => (j.text_blocks || []).length],
    [path.join(outDir, 'tr', `${stem}.json`), (j) => Object.keys(j.texts || {}).length],
    [path.join(outDir, 'detect', `${stem}_detect.json`), (j) => (j.text_blocks || []).length],
  ];
  for (const [p, f] of cands) if (fs.existsSync(p)) return f(JSON.parse(fs.readFileSync(p, 'utf8')));
  return null;
}

const stems = fs.readdirSync(outDir).filter((f) => f.toLowerCase().endsWith('.psd')).map((f) => f.slice(0, -4)).sort();
const bad = [];
for (const stem of stems) {
  try {
    const psd = readPsd(fs.readFileSync(path.join(outDir, `${stem}.psd`)), { useRawData: true, skipCompositeImageData: true, skipThumbnail: true });
    const names = psd.children.map((l) => l.name);
    const hasOriginal = names.includes('Original');
    const hasCopy = names.includes('Copy');
    const textLayers = psd.children.filter((l) => l.text);
    const empty = textLayers.filter((l) => !l.text.text || !l.text.text.trim()).length;
    const lorem = textLayers.filter((l) => /Lorem ipsum/.test(l.text.text || '')).length;
    const expected = expectedFor(stem);
    const countOk = expected === null || textLayers.length === expected;
    const loremOk = PLACEHOLDER || lorem === 0;
    if (!hasOriginal || !hasCopy || !countOk || empty > 0 || !loremOk) {
      bad.push(`${stem}: original=${hasOriginal} copy=${hasCopy} text=${textLayers.length}/${expected ?? '?'} empty=${empty} lorem=${lorem}`);
    }
  } catch (e) {
    bad.push(`${stem}: READ ERROR ${e.message}`);
  }
}
console.log(`checked ${stems.length} PSDs`);
if (bad.length) { console.log(`${bad.length} PROBLEM(S):`); bad.forEach((b) => console.log(' - ' + b)); process.exit(2); }
console.log('all good');
