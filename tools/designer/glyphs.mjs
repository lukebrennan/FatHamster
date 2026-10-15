/* Turns the lettering fonts into plain outline data (data/glyphs.json, copied into js/designer by the build) so the Easel
   export can write words as shapes. Run: npm run glyphs */
import fs from 'node:fs';
import * as fontkit from 'fontkit';

const dir = new URL('../../assets/fonts/', import.meta.url);
const FILES = {
  classic: 'bitter-latin-400-italic.woff2',
  bold: 'alfa-slab-one-latin-400-normal.woff2',
  clean: 'bitter-latin-600-normal.woff2',
  script: 'dancing-script-latin-700-normal.woff2',
  elegant: 'playfair-display-latin-600-italic.woff2'
};
const chars = [];
for (let c = 32; c < 127; c++) chars.push(c);
chars.push(0xa3, 0xb0);
for (let c = 0xc0; c <= 0xff; c++) chars.push(c);

const round = (d) => d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(parseFloat(n))));
const out = {};
for (const [id, file] of Object.entries(FILES)) {
  const f = fontkit.openSync(new URL(file, dir).pathname);
  const g = {};
  chars.forEach((cp) => {
    const ch = String.fromCodePoint(cp);
    if (!f.hasGlyphForCodePoint(cp)) return;
    const glyph = f.glyphForCodePoint(cp);
    g[ch] = [Math.round(glyph.advanceWidth), round(glyph.path.toSVG())];
  });
  out[id] = { upm: f.unitsPerEm, g };
}
const dest = new URL('./data/glyphs.json', import.meta.url);
fs.writeFileSync(dest, JSON.stringify(out));
console.log('glyphs.json', (fs.statSync(dest).size / 1024).toFixed(0) + ' KB');
