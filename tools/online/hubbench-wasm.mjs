// Runs the relay hub's CPU benchmark (relay-worker/hubbench, bin `bench`) as WebAssembly in Node's V8, the engine Workers run on: the same code the relay ships, without the Worker glue.
//   cd relay-worker/hubbench && CARGO_TARGET_DIR=<outside the repo> cargo build --release --target wasm32-wasip1 --bin bench
//   node tools/online/hubbench-wasm.mjs <that target>/wasm32-wasip1/release/bench.wasm [-- --reps 15 --events 4000]
import fs from 'node:fs';
import { WASI } from 'node:wasi';
const file = process.argv[2], extra = process.argv.includes('--') ? process.argv.slice(process.argv.indexOf('--') + 1) : [];
if (!file) { console.error('usage: hubbench-wasm.mjs bench.wasm [-- bench args]'); process.exit(2); }
const wasi = new WASI({ version: 'preview1', args: ['bench', ...extra], env: {} });
const mod = await WebAssembly.compile(fs.readFileSync(file));
const inst = await WebAssembly.instantiate(mod, wasi.getImportObject());
wasi.start(inst);
