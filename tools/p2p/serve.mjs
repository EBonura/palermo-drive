// Serves a build (gzip for text like the real site) until stopped: node tools/p2p/serve.mjs --root dist
// Prints the port. Put a tunnel in front of it for phones, for example: cloudflared tunnel --url http://127.0.0.1:<port>
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../build/serve.mjs';
const i = process.argv.indexOf('--root'), root = path.resolve(i > 0 ? process.argv[i + 1] : 'dist');
const { port } = await startServer(root, '');
console.log('PORT', port, 'serving', root);
