// Static server used by the perf tools: gzip like GitHub Pages (text types only), per-request byte accounting.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export async function startServer(ROOT, CDN) {
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav',
  '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.webmanifest': 'application/manifest+json', '.md': 'text/markdown', '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm' };
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.glb', '.webmanifest', '.md', '.bin', '.txt']);

  const stats = { requests: 0, bytes: 0, rawBytes: 0, files: [] };
const gzCache = new Map();
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]), base = ROOT;
  const cdn = u.match(/^\/__cdn\/npm\/[^/]+@[^/]+\/(.*)$/);
  if (cdn) { base = CDN; u = '/' + cdn[1]; }
  if (u.endsWith('/')) u += 'index.html';
  const file = path.join(base, u);
  if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); stats.requests++; stats.files.push([u, 0, 404]); return; }
  const ext = path.extname(file).toLowerCase();
  let body = fs.readFileSync(file), enc = null;
  const raw = body.length;
  if (COMPRESSIBLE.has(ext) && /gzip/.test(req.headers['accept-encoding'] || '')) {
    const key = file + ':' + fs.statSync(file).mtimeMs;
    if (!gzCache.has(key)) gzCache.set(key, zlib.gzipSync(body, { level: 6 }));
    body = gzCache.get(key); enc = 'gzip';
  }
  const h = { 'content-type': MIME[ext] || 'application/octet-stream', 'content-length': body.length, 'cache-control': 'no-store', 'access-control-allow-origin': '*' };
  if (enc) h['content-encoding'] = enc;
  res.writeHead(200, h); res.end(body);
  stats.requests++; stats.bytes += body.length; stats.rawBytes += raw; stats.files.push([u, body.length, raw]);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, stats, port: server.address().port };
}

