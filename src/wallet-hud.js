// The wallet on the street: the first part of the gauges capsule (src/ui.css .hz-gauges), then the speed and the nitro bar with the money you hold, always on while you drive.
// It redraws only when the wallet changes (src/garage.js onChange) and flashes green for a gain, red for a loss. Below zero (a debt, src/event-penna.js) it is red with a minus sign.
//   import { createWalletHud } from './wallet-hud.js';   createWalletHud({ garage })
import { zone } from './hud.js';

const CSS = `
#pd-wallet { flex: none; font-size: 30px; font-weight: 800; line-height: 1; white-space: nowrap; font-variant-numeric: tabular-nums; color: #f5d27a; pointer-events: none; transition: color .15s; }   /* the same type as #speed (index.html) */
#pd-wallet small { font-size: 11px; font-weight: 600; margin-left: 3px; }
#pd-wallet.neg { color: #ff5a4a; }
#pd-wallet.up { color: #7be08a; }
#pd-wallet.down { color: #ff5a4a; }
html.touch #pd-wallet { font-size: 22px; }
html.touch #pd-wallet small { font-size: 9px; }
`;

export function createWalletHud({ garage }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const el = document.createElement('div'); el.id = 'pd-wallet'; el.className = 'hud'; el.setAttribute('aria-label', 'Wallet');
  const gauges = zone('gauges'); if (!gauges) return;
  gauges.prepend(el);
  let shown = null, t = 0;
  const show = () => {
    const c = Math.round(garage.cash);
    if (c === shown) return;
    const was = shown; shown = c;
    el.innerHTML = (c < 0 ? '−' : '') + Math.abs(c) + '<small>€</small>';   // a number and its unit, like the speed next to it
    el.classList.toggle('neg', c < 0);
    if (was !== null) {
      el.classList.remove('up', 'down'); el.classList.add(c > was ? 'up' : 'down');
      clearTimeout(t); t = setTimeout(() => el.classList.remove('up', 'down'), 900);
    }
  };
  garage.onChange(show); show();
}
