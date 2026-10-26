// Dev server: bundles the galleries on every request (esbuild serve mode) and serves public/ as the web root.
//
//   npm run dev            → http://localhost:5173/knight.html
//   PORT=8080 npm run dev
import * as esbuild from 'esbuild';

const port = Number(process.env.PORT || 5173);
const ctx = await esbuild.context({
  entryPoints: { knightGallery: 'src/tools/knightGallery.js' },
  bundle: true, format: 'esm', target: 'es2020', sourcemap: true,
  outdir: 'public/build', define: { __DEV__: 'true' }, logLevel: 'info',
});
await ctx.serve({ servedir: 'public', port });
console.log(`Ashen Crown dev server: http://localhost:${port}/knight.html`);
