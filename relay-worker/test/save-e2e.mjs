// The cloud save routes against `wrangler dev` (docs/CLOUD-SAVE.md):  npx wrangler dev --port 8799 --ip 127.0.0.1 --var JURISDICTION:   then   node test/save-e2e.mjs [http://127.0.0.1:8799]
const BASE = process.argv[2] || process.env.RELAY || 'http://127.0.0.1:8799';
const ORIGIN = 'http://localhost:8123';
const KEY = Array.from({ length: 26 }, () => '0123456789ABCDEFGHJKMNPQRSTVWXYZ'[Math.floor(Math.random() * 32)]).join('');   // a fresh key each run: nothing left from an earlier one
const post = async (path, body, origin = ORIGIN) => { const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'text/plain', ...(origin ? { Origin: origin } : {}) }, body }); return { code: r.status, text: await r.text(), cors: r.headers.get('access-control-allow-origin') }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + extra)); };

let r = await post('/save/get', KEY); ok('nothing stored: 404', r.code === 404, r.code);
r = await post('/save', `${KEY}\n120\n{"v":1,"e":{"a":"b\\nc"}}`); ok('first write: 200', r.code === 200 && r.cors === ORIGIN, JSON.stringify(r));
r = await post('/save/get', KEY); const j = JSON.parse(r.text); ok('read back: the blob, the wallet, no driver', r.code === 200 && j.cash === 120 && j.blob === '{"v":1,"e":{"a":"b\\nc"}}' && j.driver === null, r.text);
r = await post('/save', `${KEY}\n130\n{}`); ok('a second write at once: 429', r.code === 429, r.code);
r = await post('/save/driver', `${KEY}\ndata:image/png;base64,iVBORw0KGgo=`); ok('driver picture: 200', r.code === 200, r.text);
r = await post('/save/driver', `${KEY}\ndata:image/png;base64,<script>`); ok('a driver that is not a PNG: 400', r.code === 400, r.code);
await sleep(4500);
r = await post('/save', `${KEY}\n900000\n{}`); ok('a made-up wallet: 409', r.code === 409, r.code);
r = await post('/save', `${KEY}\n10\nnot json`); ok('not a JSON object: 400', r.code === 400, r.code);
r = await post('/save', `${KEY}\n10\n{"x":"${'a'.repeat(100001)}"}`); ok('too big: 413', r.code === 413, r.code);
r = await post('/save', `${KEY}\n100\n{"v":1,"n":2}`); ok('spending is fine: 200', r.code === 200, r.text);
r = await post('/save/get', KEY); const j2 = JSON.parse(r.text); ok('the driver is still there after the blob changed', j2.driver === 'data:image/png;base64,iVBORw0KGgo=' && j2.cash === 100, r.text);
r = await post('/save/get', 'short'); ok('a bad key: 400', r.code === 400, r.code);
r = await post('/save/get', KEY, 'https://evil.example'); ok('a foreign origin: 403', r.code === 403, r.code);
r = await post('/save/get', KEY, null); ok('no origin: 403', r.code === 403, r.code);
r = await fetch(BASE + '/save', { headers: { Origin: ORIGIN } }); ok('GET: 405', r.status === 405, r.status);
const other = KEY.slice(1) + (KEY[0] === '0' ? '1' : '0');
r = await post('/save/get', other); ok('another key sees nothing: 404', r.code === 404, r.code);
r = await post('/save/delete', KEY); ok('delete: 200', r.code === 200, r.text);
r = await post('/save/get', KEY); ok('after delete: 404', r.code === 404, r.code);
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
