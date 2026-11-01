// Production build for Palermo Drive: node tools/build/build.mjs  (or: cd tools/build && npm run build)
//
// Reads the unmodified source tree (index.html, src/, assets/, the baked data files) and writes dist/:
//   - one minified, tree-shaken ES module bundle (src/ + three.js + the addons actually imported), hashed name
//   - index.html with the CSS inlined, the import map and the data <script> tags removed
//   - the baked data converted to compact binary blobs (see codec.mjs) unless --data=raw
//   - the other runtime assets copied (tooling and source-only files skipped)
// The development tree and its import map / dev server are never touched.
//
// Flags: --data=bin|raw (default bin)   --no-prune (keep every context building)   --simplify=0.06 (metres, 0 = off)   --out=dist   --minify=false (readable bundle for profiling)   --src=<project dir>
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildDataBlobs } from './data.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const flag = (k, d) => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.includes('=') ? a.split('=')[1] : true) : d; };
const ROOT = path.resolve(flag('src', path.resolve(HERE, '../..')));   // --src=<dir> builds another checkout of the project
const DATA_MODE = flag('data', 'bin');
const OUT = path.resolve(ROOT, flag('out', 'dist'));
const hash = buf => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
const kb = n => (n / 1024).toFixed(1) + ' KB';

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'js'), { recursive: true });

// ---------- 1. data ----------
let dataBlobs = [], hasTiles = false;   // blobs are decoded (runtime/loader.js) before the game modules run
if (DATA_MODE === 'bin') {
  const simp = flag('simplify', '0.06');
  ({ blobs: dataBlobs, tiles: hasTiles } = await buildDataBlobs({ ROOT, OUT, hash, prune: !flag('no-prune', false), simplify: +simp, log: console.log }));
}

// ---------- 2. JS bundle ----------
// The entry imports the data loader first (top-level await), then main.js, so window.PALERMO_DATA & co exist
// before core.js reads them. In raw mode the classic <script> data files are kept instead.
const entrySrc = DATA_MODE === 'bin'
  ? `import ${JSON.stringify('pd-boot-data')};\nimport ${JSON.stringify(path.join(ROOT, 'src/main.js'))};\n`
  : `import ${JSON.stringify(path.join(ROOT, 'src/main.js'))};\n`;

const plugin = {
  name: 'pd',
  setup(b) {
    b.onResolve({ filter: /^pd-boot-data$/ }, () => ({ path: 'pd-boot-data', namespace: 'pd' }));
    b.onLoad({ filter: /.*/, namespace: 'pd' }, () => ({
      contents: `import { loadBlobs } from ${JSON.stringify(path.join(HERE, 'runtime/loader.js'))};\n` +
        `await loadBlobs(new URL('../', import.meta.url).href, ${JSON.stringify(dataBlobs)}, { tiles: ${hasTiles} });\n`,
      resolveDir: ROOT, loader: 'js',
    }));
    // Baked data that modules import as ES modules (assets/traffic/bus-routes.js) comes out of the decoded blobs.
    b.onResolve({ filter: /bus-routes\.js$/ }, a => DATA_MODE === 'bin' ? { path: path.resolve(a.resolveDir, a.path), namespace: 'pd-bus' } : null);
    b.onLoad({ filter: /.*/, namespace: 'pd-bus' }, () => ({ contents: 'const B = window.PD_BUS_ROUTES; export const BUS_ROUTES = B.BUS_ROUTES, BUS_STOPS = B.BUS_STOPS;', loader: 'js' }));
  },
};

const t0 = Date.now();
const res = await esbuild.build({
  stdin: { contents: entrySrc, resolveDir: ROOT, sourcefile: 'entry.js' },
  bundle: true, format: 'esm', platform: 'browser', target: ['chrome90', 'safari15', 'firefox90'],
  minify: flag('minify', 'true') !== 'false', treeShaking: true, legalComments: 'external', charset: 'utf8',
  nodePaths: [...(flag('nodes', '') ? [path.resolve(flag('nodes', ''))] : []), path.join(HERE, 'node_modules')],   // --nodes=<dir>: try another three.js version
  define: { __PD_PROD__: 'true' }, entryNames: 'app', outdir: path.join(OUT, 'js'), metafile: true, write: false, logLevel: 'warning',
  plugins: [plugin],
});
let appJs = null;
for (const f of res.outputFiles) {
  if (f.path.endsWith('.js')) appJs = f;
  else fs.writeFileSync(path.join(OUT, 'js', path.basename(f.path)), f.contents);
}
const appName = `app.${hash(appJs.contents)}.js`;
fs.writeFileSync(path.join(OUT, 'js', appName), appJs.contents);
if (flag('meta', false)) fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(res.metafile));
console.log(`bundle ${appName}: ${kb(appJs.contents.length)} raw, ${kb(zlib.gzipSync(appJs.contents, { level: 9 }).length)} gzip (${Date.now() - t0} ms)`);

// ---------- 3. CSS (inlined into index.html) ----------
const cssEntry = `@import ${JSON.stringify(path.join(ROOT, 'src/mobile.css'))};\n@import ${JSON.stringify(path.join(ROOT, 'src/ui.css'))};\n`;
const cssRes = await esbuild.build({
  stdin: { contents: cssEntry, resolveDir: ROOT, loader: 'css' }, bundle: true, minify: true, write: false, logLevel: 'warning',
  outdir: OUT, loader: { '.woff2': 'file' }, assetNames: 'assets/ui/fonts/[name]-[hash]', target: ['chrome90', 'safari15'],
});
let css = '';
for (const f of cssRes.outputFiles) {
  if (f.path.endsWith('.css')) css = f.text;
  else { fs.mkdirSync(path.dirname(f.path), { recursive: true }); fs.writeFileSync(f.path, f.contents); }
}

// ---------- 4. index.html ----------
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const mustReplace = (re, to, what) => { if (!re.test(html)) throw new Error('index.html changed: cannot find ' + what + ' (update tools/build/build.mjs)'); html = html.replace(re, to); };
html = html.replace(/<link rel="stylesheet" href="src\/(mobile|ui)\.css">\s*/g, '');
mustReplace(/<\/style>/, `</style>\n<style>${css}</style>`, 'the inline <style> block');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');
if (DATA_MODE === 'bin') html = html.replace(/<script src="(palermo|props|context)-data\.js"><\/script>\s*/g, '');
mustReplace(/<script type="module" src="src\/main\.js"><\/script>/, '', 'the main.js module script');
const fontPre = [...css.matchAll(/url\("?([^)"]*(?:mr-dafoe|racing-sans-one)[^)"]*\.woff2)"?\)/g)].map(m => `<link rel="preload" as="font" type="font/woff2" crossorigin href="${m[1].replace(/^\.\//, '')}">`); // title fonts: fetch them with the HTML, not after the CSS is parsed
const preloads = [...fontPre, `<link rel="modulepreload" href="js/${appName}">`, ...dataBlobs.filter(b => !b.late).map(b => `<link rel="preload" as="fetch" crossorigin href="${b.file}">`)];
html = html.replace('<link rel="manifest"', preloads.join('\n') + '\n<link rel="manifest"');
html = html.replace('</body>', `<script type="module" src="js/${appName}"></script>\n</body>`);
// minify the inline splash script
html = html.replace(/<script>([\s\S]*?)<\/script>/, (m, code) => `<script>${esbuild.transformSync(code, { minify: true }).code.trim()}</script>`);
html = html.replace(/\n\s*\n+/g, '\n');
// release id (src/version.js): the page carries it, version.json says what is live; any change to the page, the bundle or the data names changes it
const version = hash(Buffer.from(html));
mustReplace(/<head>/, `<head>\n<meta name="pd-version" content="${version}">`, 'the <head> tag');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, 'version.json'), JSON.stringify({ v: version }));

// ---------- 5. static files ----------
const SKIP_DIR = new Set(['cover-src', '_test', 'node_modules']);
const SKIP_FILE = /(\.(md|cjs|mjs|sh|html|py|js)$|^cover-portrait\.png$|^contact-sheet)/;   // .js under assets/ is bundled, not served
function copyTree(src, dst) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) copyTree(s, d); }
    else if (!SKIP_FILE.test(e.name) || e.name === 'CREDITS.md') { fs.mkdirSync(dst, { recursive: true }); fs.copyFileSync(s, d); }
  }
}
copyTree(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));
// Facade photos (assets/facades/photo): jpg -> webp (about a third smaller), map.json follows. Decoded by the game with Image.decode().
{
  const dir = path.join(OUT, 'assets/facades/photo'), mapFile = path.join(dir, 'map.json');
  if (fs.existsSync(mapFile)) {
    const { default: sharp } = await import('sharp');
    let before = 0, after = 0, mapText = fs.readFileSync(mapFile, 'utf8');
    for (const f of fs.readdirSync(dir).filter(f => /\.(jpe?g|png)$/i.test(f))) {
      const src = path.join(dir, f), out = f.replace(/\.(jpe?g|png)$/i, '.webp');
      const buf = await sharp(src).webp({ quality: 78, effort: 5 }).toBuffer();
      before += fs.statSync(src).size; after += buf.length;
      fs.writeFileSync(path.join(dir, out), buf); fs.rmSync(src);
      mapText = mapText.split(f).join(out);
    }
    fs.writeFileSync(mapFile, mapText);
    fs.rmSync(path.join(dir, 'sources.json'), { force: true });
    console.log(`facade photos: ${kb(before)} -> ${kb(after)} (webp)`);
  }
}
fs.copyFileSync(path.join(ROOT, 'manifest.webmanifest'), path.join(OUT, 'manifest.webmanifest'));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
if (DATA_MODE === 'raw') for (const f of ['palermo-data.js', 'props-data.js', 'context-data.js']) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));

// ---------- report ----------
let total = 0, totalGz = 0, n = 0;
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { const b = fs.readFileSync(p); n++; total += b.length; totalGz += /\.(js|css|json|html|bin|svg|md|webmanifest)$/.test(p) ? zlib.gzipSync(b, { level: 6 }).length : b.length; } } })(OUT);
console.log(`dist: ${n} files, ${kb(total)} raw, ~${kb(totalGz)} on the wire (gzip 6 for text types), data=${DATA_MODE}`);
