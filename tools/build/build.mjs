// Production build for Palermo Drive: node tools/build/build.mjs  (or: cd tools/build && npm run build)
//
// Reads the unmodified source tree (index.html, src/, assets/, the baked data files) and writes dist/:
//   - one minified, tree-shaken ES module bundle (src/ + three.js + the addons actually imported), hashed name
//   - index.html with the CSS inlined, the import map and the data <script> tags removed
//   - the baked data converted to compact binary blobs (see codec.mjs) unless --data=raw
//   - the other runtime assets copied (tooling and source-only files skipped)
// The development tree and its import map / dev server are never touched.
//
// Flags: --data=bin|raw (default bin)   --no-prune (keep every context building)   --simplify=0.06 (metres, 0 = off)   --out=dist   --minify=false (readable bundle for profiling)   --p2p=false (leave out the peer to peer client)   --src=<project dir>
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildDataBlobs } from './data.mjs';
import { RELAYS } from '../../src/p2p/relays.js';
import { PLAYLOG_URL } from '../../src/playlog-url.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const flag = (k, d) => { const a = process.argv.find(x => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.includes('=') ? a.split('=')[1] : true) : d; };
const ROOT = path.resolve(flag('src', path.resolve(HERE, '../..')));   // --src=<dir> builds another checkout of the project
const DATA_MODE = flag('data', 'bin');
// the play log (src/playlog.js): the address in src/playlog-url.js, or --playlog=<url> for a local test build (which also lets it send from the test addresses and automated browsers)
const PLAYLOG = flag('playlog', '') || PLAYLOG_URL;
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

// The benchmark (?bench, src/bench.js) and the stutter recorder (?rec, src/rec.js) are files of their own next to the bundle: main.js imports each only for its link, so players never download them. They have no imports, so nothing is bundled twice.
const sideFiles = {};
for (const side of ['bench', 'rec']) {
  if (!fs.existsSync(path.join(ROOT, `src/${side}.js`))) continue;
  const code = esbuild.transformSync(fs.readFileSync(path.join(ROOT, `src/${side}.js`), 'utf8'), { minify: flag('minify', 'true') !== 'false', format: 'esm', target: ['chrome90', 'safari15', 'firefox90'], charset: 'utf8' }).code;
  sideFiles[side] = `${side}.${hash(Buffer.from(code))}.js`; fs.writeFileSync(path.join(OUT, 'js', sideFiles[side]), code);
}

const plugin = {
  name: 'pd',
  setup(b) {
    b.onResolve({ filter: /\/(bench|rec)\.js$/ }, a => a.kind === 'dynamic-import' && sideFiles[path.basename(a.path, '.js')] ? { path: './' + sideFiles[path.basename(a.path, '.js')], external: true } : null);
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

// TURN for the multiplayer (src/p2p/p2p.js): from the PD_TURN_URLS (comma separated), PD_TURN_USER and PD_TURN_PASS environment variables,
// the repository's Actions secrets on GitHub (.github/workflows/pages.yml). Unset locally: the build has no TURN.
const TURN = process.env.PD_TURN_URLS && process.env.PD_TURN_USER && process.env.PD_TURN_PASS
  ? [{ urls: process.env.PD_TURN_URLS.split(',').map(u => u.trim()).filter(Boolean), username: process.env.PD_TURN_USER, credential: process.env.PD_TURN_PASS }] : null;
const t0 = Date.now();
const res = await esbuild.build({
  stdin: { contents: entrySrc, resolveDir: ROOT, sourcefile: 'entry.js' },
  bundle: true, format: 'esm', platform: 'browser', target: ['chrome90', 'safari15', 'firefox90'],
  minify: flag('minify', 'true') !== 'false', treeShaking: true, legalComments: 'external', charset: 'utf8',
  nodePaths: [...(flag('nodes', '') ? [path.resolve(flag('nodes', ''))] : []), path.join(HERE, 'node_modules')],   // --nodes=<dir>: try another three.js version
  define: { __PD_PROD__: 'true', __PD_TURN__: JSON.stringify(TURN), __PD_P2P__: flag('p2p', true) ? 'true' : 'false', __PD_PLAYLOG_URL__: JSON.stringify(PLAYLOG), __PD_PLAYLOG_TEST__: flag('playlog', '') ? 'true' : 'false' }, entryNames: 'app', outdir: path.join(OUT, 'js'), metafile: true, write: false, logLevel: 'warning',
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
html = html.replace(/<link rel="preload" as="font"[^>]*>\s*/g, '');   // index.html preloads the first screen's fonts by their source names: the hashed ones below replace them
const fontPre = [...css.matchAll(/url\("?([^)"]*(?:mr-dafoe|racing-sans-one|barlow)[^)"]*\.woff2)"?\)/g)].map(m => `<link rel="preload" as="font" type="font/woff2" crossorigin href="${m[1].replace(/^\.\//, '')}">`); // title fonts and the Barlow faces of the loading tips: fetch them with the HTML, not after the CSS is parsed
const preloads = [...fontPre, `<link rel="modulepreload" href="js/${appName}">`, ...dataBlobs.filter(b => !b.late).map(b => `<link rel="preload" as="fetch" crossorigin href="${b.file}">`)];
html = html.replace('<link rel="manifest"', preloads.join('\n') + '\n<link rel="manifest"');
html = html.replace('</body>', `<script type="module" src="js/${appName}"></script>\n</body>`);
// the loading tips (src/loading-tips.js): a classic deferred script with no imports that runs before the bundle has arrived, so it is a small file of its own, minified, hashed
const tipsMin = esbuild.transformSync(fs.readFileSync(path.join(ROOT, 'src/loading-tips.js'), 'utf8'), { minify: true, target: ['chrome90', 'safari15'] }).code, tipsName = `tips.${hash(Buffer.from(tipsMin))}.js`;
fs.writeFileSync(path.join(OUT, 'js', tipsName), tipsMin);
mustReplace(/<script src="src\/loading-tips\.js" defer><\/script>/, `<script src="js/${tipsName}" defer></script>`, 'the loading tips script');
// minify the inline splash script
html = html.replace(/<script>([\s\S]*?)<\/script>/, (m, code) => `<script>${esbuild.transformSync(code, { minify: true }).code.trim()}</script>`);
html = html.replace(/\n\s*\n+/g, '\n');
// release id (src/version.js): the page carries it, version.json says what is live; any change to the page, the bundle or the data names changes it
const version = hash(Buffer.from(html));
// the version players see: VERSION at the repo root (major.minor, bumped by hand) plus the deploy number from GitHub Actions; "dev" for a local build
const versionName = `${fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim()}.${process.env.GITHUB_RUN_NUMBER || 'dev'}`;
mustReplace(/<head>/, `<head>\n<meta name="pd-version" content="${version}" data-name="${versionName}">`, 'the <head> tag');
// Content-Security-Policy as a <meta> (GitHub Pages cannot send headers): the published page runs only its own bundle (no inline script, no eval), takes images, audio and fonts from itself
// (plus data: and blob: pictures), and may talk to itself. Style is 'unsafe-inline' because the modules add their own <style> blocks.
// Checked on the built site: title, play, Garage, a race event and the credits raise no violation. The dev tree has no policy. If a new feature loads something from elsewhere, widen it here.
// The peer to peer client (docs/P2P-MULTIPLAYER.md) also needs the Nostr relays it pins in src/p2p/relays.js: exactly those hosts are allowed here.
// The play log (src/playlog.js) needs its one service host, the origin of PLAYLOG_URL (src/playlog-url.js): added only when that constant is set, so with it empty the policy allows no extra host.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'" + (flag('p2p', true) ? ' ' + RELAYS.join(' ') : '') + (PLAYLOG ? ' ' + new URL(PLAYLOG).origin : '') + "; object-src 'none'; base-uri 'self'; form-action 'none'; worker-src 'self'";
mustReplace(/<head>/, `<head>\n<meta http-equiv="Content-Security-Policy" content="${CSP}">\n<meta name="referrer" content="strict-origin-when-cross-origin">`, 'the <head> tag (policy)');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, 'version.json'), JSON.stringify({ v: version, name: versionName }));

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
fs.copyFileSync(path.join(ROOT, 'manifest.webmanifest'), path.join(OUT, 'manifest.webmanifest'));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
if (DATA_MODE === 'raw') for (const f of ['palermo-data.js', 'props-data.js', 'context-data.js']) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));

// ---------- report ----------
let total = 0, totalGz = 0, n = 0;
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { const b = fs.readFileSync(p); n++; total += b.length; totalGz += /\.(js|css|json|html|bin|svg|md|webmanifest)$/.test(p) ? zlib.gzipSync(b, { level: 6 }).length : b.length; } } })(OUT);
console.log(`dist: ${n} files, ${kb(total)} raw, ~${kb(totalGz)} on the wire (gzip 6 for text types), data=${DATA_MODE}`);
