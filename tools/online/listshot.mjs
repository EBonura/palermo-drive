// The multiplayer capsule closed and open (the Online list inside it), on a desktop window and on a phone: screenshots to --out.
//   tools/release/withbrowser.sh node tools/online/listshot.mjs --root <dist built with --test-relay> [--out dir]
import { start, player, sleep, arg } from './lib.mjs';
const out = arg('out', '/private/tmp/claude-501');
const h = await start();
try {
  for (const phone of [false, true]) {
    const R = await h.newRelay(), s = phone ? 'phone' : 'desktop';
    const A = await player(h, { name: 'Anna', x: -300, z: 250, size: [1100, 620], phone, relay: R });
    const B = await player(h, { name: 'Bob', x: -296, z: 258, phone, relay: R });
    const C = await player(h, { name: 'Carmelo', x: 1500, z: -900, phone, relay: R });
    await A.page.waitForFunction(() => window.__p2p.remotes.size > 0, { timeout: 90000, polling: 500 }); await sleep(1500);
    await A.page.screenshot({ path: `${out}/list-${s}-1-closed.png` });
    await A.page.evaluate(() => document.querySelector('.mpx-cap').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }))); await sleep(900);
    await A.page.screenshot({ path: `${out}/list-${s}-2-open.png` });
    console.log(s, await A.page.evaluate(() => document.querySelector('.mpx').innerText), A.errs);
    await A.page.close(); await B.page.close(); await C.page.close();
  }
} finally { await h.close(); }
