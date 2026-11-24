// Production build with esbuild (Vite is not installable in this offline environment).
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const dev = process.argv.includes('--dev');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

const r = await build({
  entryPoints: { app: 'src/main.tsx' },
  bundle: true,
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  target: ['safari15', 'es2020'],
  platform: 'browser',
  format: 'iife',
  jsx: 'automatic',
  outdir: 'dist',
  define: { 'process.env.NODE_ENV': dev ? '"development"' : '"production"', global: 'globalThis' },
  logLevel: 'warning',
  metafile: true,
});

cpSync('public', 'dist', { recursive: true });
const hash = createHash('sha256').update(readFileSync('dist/app.js')).update(readFileSync('dist/app.css')).digest('hex').slice(0, 10);
for (const f of ['dist/index.html', 'dist/sw.js']) writeFileSync(f, readFileSync(f, 'utf8').replaceAll('__BUILD__', hash));

const size = (p) => statSync(p).size;
const files = readdirSync('dist', { recursive: true }).filter((f) => statSync('dist/' + f).isFile());
console.log(`build ${hash}: app.js ${(size('dist/app.js') / 1024).toFixed(0)} KB, app.css ${(size('dist/app.css') / 1024).toFixed(0)} KB, ${files.length} files`);
if (r.warnings.length) console.log(r.warnings.length, 'warnings');
