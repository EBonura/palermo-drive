// Wraps the real src/p2p/trystero.js for the stress bots: (1) no STUN servers (a loopback test has no need of them and must not call public ones), (2) a trace of every
// state message sent and received (time, peer, sequence number) so that the harness can work out how long a position took from one page to another.
// Everything else is the real library. Date.now() is shared by all pages on the Mac, so a send time and a receive time from two pages can be subtracted.
import * as real from 'REAL_TRYSTERO';
export * from 'REAL_TRYSTERO';
const trace = window.__trace = { tx: [], rx: [], on: false, drain() { const o = { tx: this.tx, rx: this.rx }; this.tx = []; this.rx = []; return o; } };
const MAX = 400000;
// STATE on the game's own unreliable channel (src/p2p/p2p.js, FAST): traced too, keyed by the sender's 16 bit clock instead of the sequence number ('f' + time)
const joined = new Set(), chanPc = new WeakMap();
const peerOf = pc => { for (const r of joined) for (const [id, q] of Object.entries(r.getPeers())) if (q === pc) return id; return null; };
const mkChan = RTCPeerConnection.prototype.createDataChannel;
RTCPeerConnection.prototype.createDataChannel = function (label, opt) {
  const ch = mkChan.call(this, label, opt); if (label !== 'pd-state') return ch;
  const pc = this, send = ch.send.bind(ch);
  ch.send = b => { if (trace.on && trace.tx.length < MAX && b && b[0] === 10) { const to = peerOf(pc); if (to) trace.tx.push([Date.now(), to, 'f' + (b[1] | b[2] << 8)]); } return send(b); };
  ch.addEventListener('message', e => { const d = new Uint8Array(e.data); if (!trace.on || trace.rx.length >= MAX || d[0] !== 10 || d.length < 19) return; const from = peerOf(pc); if (!from) return;
    const lo = (d[3] | d[4] << 8 | d[5] << 16 | d[6] << 24) >>> 0, x = ((lo & 0xfffff) - 524288) / 20, z = ((lo >>> 20 | d[7] << 12) - 524288) / 20, me = window.bot && window.bot.car;
    trace.rx.push([Date.now(), from, 'f' + (d[1] | d[2] << 8), me ? Math.round(Math.hypot(x - me.x, z - me.z)) : -1]); });
  return ch;
};
export const strategies = {};
for (const k of Object.keys(real.strategies)) {
  const s = real.strategies[k];
  strategies[k] = {
    ...s,
    joinRoom(cfg, room, cb) {
      const r = s.joinRoom(location.search.includes('stun=1') ? cfg : { ...cfg, rtcConfig: { iceServers: [] } }, room, cb), mk = r.makeAction.bind(r);
      joined.add(r); const leave = r.leave.bind(r); r.leave = (...a) => { joined.delete(r); return leave(...a); };   // ?stun=1: keep the library's default STUN list (only for the one public-relay comparison)
      r.makeAction = name => {
        const a = mk(name); if (name !== 's') return a;
        return new Proxy(a, {
          get: (t, p) => p === 'send' ? (b, o) => { if (trace.on && trace.tx.length < MAX && o && typeof o.target === 'string' && b[0] === 2) trace.tx.push([Date.now(), o.target, b[1]]); return t.send(b, o); } : t[p],
          set: (t, p, v) => { t[p] = p === 'onMessage' ? (d, c) => { if (trace.on && trace.rx.length < MAX && d && d[0] === 2 && d.length >= 13) { const lo = (d[2] | d[3] << 8 | d[4] << 16 | d[5] << 24) >>> 0, x = ((lo & 0xfffff) - 524288) / 20, z = ((lo >>> 20 | d[6] << 12) - 524288) / 20, me = window.bot && window.bot.car; trace.rx.push([Date.now(), (c && c.peerId) || c, d[1], me ? Math.round(Math.hypot(x - me.x, z - me.z)) : -1]); } return v(d, c); } : v; return true; },
        });
      };
      return r;
    },
  };
}
