// Would permessage-deflate (RFC 7692) help the relay's frames? Reads frames dumped by the crowd simulation (PD_DUMP=file relay-worker/hubbench/target/release/crowd ...: [len u16][bytes] of everything one player
// receives) and compresses each frame the way a WebSocket extension does: raw deflate of the message, ended with a sync flush whose 4 final bytes are not sent, with the compressor's window kept from one message
// to the next (context takeover, what Cloudflare and browsers negotiate unless told otherwise) or reset for every message (no_context_takeover). Prints the payload bytes before and after, and the CPU the compression cost.
//   node tools/online/deflate.mjs frames.bin
import fs from 'node:fs';
import zlib from 'node:zlib';
const b = fs.readFileSync(process.argv[2]), frames = [];
for (let o = 0; o + 2 <= b.length;) { const n = b.readUInt16LE(o); frames.push(b.subarray(o + 2, o + 2 + n)); o += 2 + n; }
const raw = frames.reduce((a, f) => a + f.length, 0);
function perMessage() {   // no_context_takeover: every message compressed alone
  let out = 0; const t0 = process.hrtime.bigint();
  for (const f of frames) { const c = zlib.deflateRawSync(f, { level: 6, finishFlush: zlib.constants.Z_SYNC_FLUSH }); out += c.length - 4; }
  return { out, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
}
// streaming (context takeover): one compressor, flush after every message
async function streaming() {
  const z = zlib.createDeflateRaw({ level: 6 }); let sizes = [], pending = 0; z.on('data', d => { pending += d.length; });
  const t0 = process.hrtime.bigint(); let out = 0;
  for (const f of frames) {
    pending = 0; z.write(f); await new Promise(r => z.flush(zlib.constants.Z_SYNC_FLUSH, r));
    out += Math.max(0, pending - 4);   // the sync flush's empty block (00 00 ff ff) is dropped by the extension
  }
  return { out, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
}
const noTk = perMessage(), tk = await streaming();
console.log(JSON.stringify({ frames: frames.length, mean_frame_bytes: +(raw / frames.length).toFixed(1), payload_bytes: raw, deflate_no_context_takeover: { bytes: noTk.out, ratio: +(noTk.out / raw).toFixed(3), cpu_us_per_frame: +(noTk.ms * 1000 / frames.length).toFixed(1) }, deflate_context_takeover: { bytes: tk.out, ratio: +(tk.out / raw).toFixed(3), cpu_us_per_frame: +(tk.ms * 1000 / frames.length).toFixed(1) } }));
