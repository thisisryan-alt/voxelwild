// Bundles the browser build into dist/: index.html (page + inlined main script + inlined worker source) and assets/.
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const minify = !process.argv.includes('--dev');
mkdirSync(join(dist, 'assets'), { recursive: true });

const bundle = async (entry, format) => {
  const r = await esbuild.build({ entryPoints: [join(root, entry)], bundle: true, format, minify, write: false, target: 'es2020', legalComments: 'none' });
  return r.outputFiles[0].text;
};
const worker = await bundle('src/worker.js', 'iife');
const main = await bundle('src/main.js', 'iife');
const esc = (s) => s.replace(/<\/script/gi, '<\/script');
let html = readFileSync(join(root, 'src/index.html'), 'utf8');
html = html.replace('/*__WORKER__*/', () => esc(worker)).replace('/*__MAIN__*/', () => esc(main));
writeFileSync(join(dist, 'index.html'), html);
for (const f of ['albedo.webp', 'normal.webp', 'mask.webp', 'props.json', 'props.bin', 'prop_normal.webp', 'prop_mask.webp']) copyFileSync(join(root, 'assets', f), join(dist, 'assets', f));
console.log(`dist/index.html ${(html.length / 1024).toFixed(0)} KB (worker ${(worker.length / 1024).toFixed(0)} KB, main ${(main.length / 1024).toFixed(0)} KB)`);
