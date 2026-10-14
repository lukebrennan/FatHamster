/* Bundles the designer (src/) and Three.js into js/designer/ for the site.
   Run:  cd tools/designer && npm install && npm run build */
import { build } from 'esbuild';
import { rmSync, statSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const out = new URL('../../js/designer/', import.meta.url).pathname;
rmSync(out, { recursive: true, force: true });

await build({
  entryPoints: ['src/designer.js'],
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir: out,
  chunkNames: 'chunks/[name]-[hash]',
  minify: true,
  target: ['es2019'],
  legalComments: 'none',
  logLevel: 'warning'
});

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}
walk(out).forEach((f) => {
  const raw = statSync(f).size, gz = gzipSync(readFileSync(f)).length;
  console.log(f.replace(out, 'js/designer/').padEnd(52), (raw / 1024).toFixed(0).padStart(5) + ' KB   gzip ' + (gz / 1024).toFixed(0).padStart(4) + ' KB');
});
