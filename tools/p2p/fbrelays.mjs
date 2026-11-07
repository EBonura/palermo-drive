// Which public relays take the relay fallback's traffic (src/p2p/fallback.js), checked the way the presence relays were: from this one address, as two phones on one hotspot would be.
// For each relay: one reader subscribes to a private topic; two writers, each with a throwaway key, publish ephemeral events of the fallback's kind at its normal rate (3 a second each) for
// --secs seconds; then one presence event (kind 30078) is stored and read back. Prints, per relay: events accepted, refused (and why), delivered to the reader, delivery time.
// It talks to public relays run by volunteers: a short run (default 30 s, about 180 small events per relay), and never in a loop.
//   node tools/p2p/fbrelays.mjs [--secs 30] [--relays a,b,c]   (host names; default: the pinned list and a few candidates)
import { schnorr } from '../../src/p2p/trystero.js';
import { RELAYS } from '../../src/p2p/relays.js';
import { FB_KIND } from '../../src/p2p/fallback.js';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SECS = +arg('secs', 30), RATE = 3;
const hosts = (arg('relays', '') || [...RELAYS.map(u => new URL(u).host), 'relay.damus.io', 'relay.primal.net', 'nostr.mom', 'offchain.pub', 'relay.nostr.net', 'nostr.oxtr.dev'].join(',')).split(',');
const hex = u => Buffer.from(u).toString('hex');
async function event(k, kind, tags, content) {
  const created = Math.floor(Date.now() / 1000), pubkey = hex(k.publicKey);
  const id = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([0, pubkey, created, kind, tags, content]))));
  return { id: hex(id), pubkey, created_at: created, kind, tags, content, sig: hex(await schnorr.signAsync(id, k.secretKey)) };
}
const open = url => new Promise(res => { const w = new WebSocket(url); const t = setTimeout(() => { try { w.close(); } catch (e) { /* gone */ } res(null); }, 8000); w.onopen = () => { clearTimeout(t); res(w); }; w.onerror = () => { clearTimeout(t); res(null); }; });
async function check(host) {
  const url = 'wss://' + host, topic = 'pd-fbcheck-' + Math.random().toString(36).slice(2, 10), r = { host, open: false, sent: 0, ok: 0, refused: 0, why: {}, delivered: 0, lat: [], presenceStored: null, notices: 0 };
  const rd = await open(url), w1 = await open(url), w2 = await open(url);
  if (!rd || !w1 || !w2) { [rd, w1, w2].forEach(w => w && w.close()); return r; }
  r.open = true;
  const sentAt = new Map();
  rd.onmessage = m => { let d; try { d = JSON.parse(m.data); } catch (e) { return; } if (d[0] === 'EVENT' && d[1] === 'rd' && sentAt.has(d[2].id)) { r.delivered++; r.lat.push(Date.now() - sentAt.get(d[2].id)); sentAt.delete(d[2].id); } else if (d[0] === 'NOTICE' || d[0] === 'CLOSED') r.notices++; };
  rd.send(JSON.stringify(['REQ', 'rd', { kinds: [FB_KIND], '#t': [topic], since: Math.floor(Date.now() / 1000) - 5 }]));
  const onOk = m => { let d; try { d = JSON.parse(m.data); } catch (e) { return; } if (d[0] === 'OK') { if (d[2]) r.ok++; else { r.refused++; const why = String(d[3] || '').slice(0, 60); r.why[why] = (r.why[why] || 0) + 1; } } else if (d[0] === 'NOTICE') { r.notices++; const why = 'NOTICE ' + String(d[1]).slice(0, 50); r.why[why] = (r.why[why] || 0) + 1; } };
  w1.onmessage = onOk; w2.onmessage = onOk;
  await new Promise(res => setTimeout(res, 1000));
  const keys = [schnorr.keygen(), schnorr.keygen()], end = Date.now() + SECS * 1000;
  let n = 0;
  while (Date.now() < end) {
    for (const [i, w] of [w1, w2].entries()) {
      const ev = await event(keys[i], FB_KIND, [['t', topic]], '1 check' + i + ' ' + Buffer.from(Uint8Array.from({ length: 13 }, (_, j) => (n + j) & 255)).toString('base64'));
      sentAt.set(ev.id, Date.now()); try { w.send(JSON.stringify(['EVENT', ev])); r.sent++; } catch (e) { /* closed */ }
    }
    n++; await new Promise(res => setTimeout(res, 1000 / RATE));
  }
  // the presence kind: stored and read back on a fresh subscription
  const pk = schnorr.keygen(), exp = Math.floor(Date.now() / 1000) + 120, pe = await event(pk, 30078, [['d', 'pd'], ['t', topic + '-p'], ['expiration', String(exp)]], '0,0,0');
  w1.send(JSON.stringify(['EVENT', pe])); await new Promise(res => setTimeout(res, 2000));
  r.presenceStored = await new Promise(res => { const t = setTimeout(() => res(false), 5000); rd.onmessage = m => { let d; try { d = JSON.parse(m.data); } catch (e) { return; } if (d[0] === 'EVENT' && d[1] === 'p' && d[2].id === pe.id) { clearTimeout(t); res(true); } else if (d[0] === 'EOSE' && d[1] === 'p') { clearTimeout(t); res(false); } }; rd.send(JSON.stringify(['REQ', 'p', { kinds: [30078], '#t': [topic + '-p'] }])); });
  await new Promise(res => setTimeout(res, 1500));
  [rd, w1, w2].forEach(w => { try { w.close(); } catch (e) { /* gone */ } });
  const s = r.lat.sort((a, b) => a - b); r.latMs = s.length ? { p50: s[s.length >> 1], p90: s[Math.floor(s.length * 0.9)], max: s[s.length - 1] } : null; delete r.lat;
  return r;
}
const out = await Promise.all(hosts.map(check));
for (const r of out) console.log(`${r.host.padEnd(28)} ${r.open ? `sent ${r.sent} ok ${r.ok} refused ${r.refused} delivered ${r.delivered} (${r.sent ? Math.round(100 * r.delivered / r.sent) : 0} %) latency ${JSON.stringify(r.latMs)} presence stored ${r.presenceStored} ${Object.keys(r.why).length ? JSON.stringify(r.why) : ''}` : 'did not open'}`);
process.exit(0);
