import * as fs from 'fs';
import * as path from 'path';
import { readPsd } from 'ag-psd';

const outDir = process.argv[2];
const stems = fs.readdirSync(outDir).filter(f => f.endsWith('.psd')).map(f => f.slice(0, -4)).sort();
let bad = [];
for (const stem of stems) {
  try {
    const psd = readPsd(fs.readFileSync(path.join(outDir, `${stem}.psd`)), { useRawData: true, skipCompositeImageData: true, skipThumbnail: true });
    const names = psd.children.map(l => l.name);
    const hasOriginal = names.includes('Original');
    const hasCopy = names.includes('Copy');
    const textLayers = psd.children.filter(l => l.name && l.name.startsWith('Text '));
    const emptyTexts = textLayers.filter(l => !l.text || !l.text.text || !l.text.text.trim());
    const trPath = path.join(outDir, 'tr', `${stem}.json`);
    let expected = 0;
    if (fs.existsSync(trPath)) expected = Object.keys(JSON.parse(fs.readFileSync(trPath, 'utf8')).texts || {}).length;
    if (!hasOriginal || !hasCopy || textLayers.length !== expected || emptyTexts.length > 0) {
      bad.push(`${stem}: original=${hasOriginal} copy=${hasCopy} text=${textLayers.length}/${expected} empty=${emptyTexts.length}`);
    }
  } catch (e) {
    bad.push(`${stem}: READ ERROR ${e.message}`);
  }
}
console.log(`checked ${stems.length} PSDs`);
if (bad.length) {
  console.log(`${bad.length} PROBLEM(S):`);
  bad.forEach(b => console.log(' - ' + b));
} else {
  console.log('all good');
}
