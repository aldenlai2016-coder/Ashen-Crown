// Production build of the current deliverable (phase 0.1: the knight gallery) as ONE self-contained HTML file:
//
//   npm run build   → release/ashen-crown.html   (three.js + the code inlined; this is what goes to the Artifact)
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const release = join(root, 'release');
mkdirSync(release, { recursive: true });

const out = await esbuild.build({
  entryPoints: ['src/tools/knightGallery.js'],
  bundle: true, minify: true, format: 'esm', target: 'es2020', write: false,
  define: { __DEV__: 'false' }, legalComments: 'none', logLevel: 'warning',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync(join(root, 'public', 'knight.html'), 'utf8')
  .replace('<title>Knight Gallery</title>', '<title>Ashen Crown</title>')
  .replace('<script type="module" src="build/knightGallery.js"></script>', () => `<script type="module">${js}</script>`);
writeFileSync(join(release, 'ashen-crown.html'), html);
console.log(`✓ release/ashen-crown.html  ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
