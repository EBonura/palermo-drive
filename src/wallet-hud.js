// The wallet on the street: one small capsule in the gauges row (next to the speed and the nitro bar) with the money you hold, always on while you drive.
// It redraws only when the wallet changes (src/garage.js onChange) and flashes green for a gain, red for a loss. Below zero (a debt, src/event-penna.js) it is red with a minus sign.
//   import { createWalletHud } from './wallet-hud.js';   createWalletHud({ garage })
import { zone } from './hud.js';

const CSS = `
#pd-wallet { flex: none; font: 700 clamp(14px, 3vh, 18px)/1 var(--pd-cond, 'Barlow Condensed', 'Arial Narrow', sans-serif); letter-spacing: .08em; color: #f5d27a; background: var(--capsule, rgba(13,7,10,.8));
  padding: 5px 10px; border-radius: 12px; white-space: nowrap; font-variant-numeric: tabular-nums; pointer-events: none; transition: color .15s; }
#pd-wallet.neg { color: #ff5a4a; }
#pd-wallet.up { color: #7be08a; }
#pd-wallet.down { color: #ff5a4a; }
html.touch #pd-wallet { font-size: 13px; padding: 4px 8px; }
`;

export function createWalletHud({ garage }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const el = document.createElement('div'); el.id = 'pd-wallet'; el.setAttribute('aria-label', 'Wallet');
  const gauges = zone('gauges'); if (!gauges) return;
  gauges.prepend(el);
  let shown = null, t = 0;
  const show = () => {
    const c = Math.round(garage.cash);
    if (c === shown) return;
    const was = shown; shown = c;
    el.textContent = (c < 0 ? '−€ ' : '€ ') + Math.abs(c);
    el.classList.toggle('neg', c < 0);
    if (was !== null) {
      el.classList.remove('up', 'down'); el.classList.add(c > was ? 'up' : 'down');
      clearTimeout(t); t = setTimeout(() => el.classList.remove('up', 'down'), 900);
    }
  };
  garage.onChange(show); show();
}
