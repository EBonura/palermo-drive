// A little money for the chaos: a person knocked over or a car sent flying pays a few cents (amounts and the gap in src/economy.js). The police send 'pd-chaos' for each (src/police.js),
// already thinned there; at most one reward every HIT_GAP seconds on top, so a crowd cannot be farmed (and every hit raises the police and gang heat).
import { HIT, HIT_GAP } from './economy.js';

export function createHitPay({ garage, onPay }) {
  let last = -1e9;
  addEventListener('pd-chaos', e => {
    const pay = HIT[e.detail && e.detail.kind];
    if (!pay) return;
    const now = performance.now() / 1000;
    if (now - last < HIT_GAP) return;
    last = now; garage.credit(pay); onPay?.(pay);   // the wallet shows a small "+0,25 €" (src/wallet-hud.js)
  });
}
