// The wallet on the street: the first part of the gauges pill (src/ui.css .hz-gauges), then the speed, with the nitro bar (and its overcharge bar) along the bottom. The money you hold, in euro and cents, always on while you drive.
// It redraws only when the wallet changes (src/garage.js onChange) and flashes green for a gain, red for a loss. Below zero (a debt, src/event-penna.js) it is red with a minus sign.
// pop(amount): a small "+0,25 €" rises from the wallet and fades (the hit rewards, src/hit-pay.js).
//   import { createWalletHud } from './wallet-hud.js';   const wallet = createWalletHud({ garage }); wallet.pop(0.25)
import { zone } from './hud.js';

const CSS = `
#pd-wallet { position: relative; flex: none; min-width: 4.6ch; text-align: right; font-size: 30px; font-weight: 800; line-height: 1; white-space: nowrap; font-variant-numeric: tabular-nums; color: #f5d27a; pointer-events: none; transition: color .15s; }   /* the same type as #speed (index.html); min-width: the pill does not jump as the number grows */
#pd-wallet .c { font-size: .62em; letter-spacing: 0; }   /* the cents, smaller, like the small digits on a price tag */
#pd-wallet small { font-size: 11px; font-weight: 600; margin-left: 3px; }
#pd-wallet.neg { color: #ff5a4a; }
#pd-wallet.up { color: #7be08a; }
#pd-wallet.down { color: #ff5a4a; }
html.touch #pd-wallet { font-size: 22px; }
html.touch #pd-wallet small { font-size: 9px; }
.pd-wpop { position: absolute; right: 0; bottom: 100%; margin-bottom: 4px; font: 700 15px/1 var(--pd-cond, 'Barlow Condensed', sans-serif); letter-spacing: .04em; color: #7be08a; white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0,0,0,.85); pointer-events: none; animation: pd-wpop 1.1s ease-out forwards; }
html.touch .pd-wpop { font-size: 12px; }
@keyframes pd-wpop { 0% { opacity: 0; transform: translateY(6px) scale(.8); } 15% { opacity: 1; transform: translateY(0) scale(1.08); } 30% { transform: translateY(-2px) scale(1); } 100% { opacity: 0; transform: translateY(-22px); } }
@keyframes pd-wpop-still { 0%, 70% { opacity: 1; } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .pd-wpop { animation-name: pd-wpop-still; } }
`;
const cents = v => { const n = Math.round(Math.abs(v) * 100); return [Math.floor(n / 100), String(n % 100).padStart(2, '0')]; };

export function createWalletHud({ garage }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const el = document.createElement('div'); el.id = 'pd-wallet'; el.className = 'hud'; el.setAttribute('aria-label', 'Wallet');
  const gauges = zone('gauges'); if (!gauges) return { pop() {} };
  gauges.prepend(el);
  const num = document.createElement('span'); el.appendChild(num);
  let shown = null, t = 0;
  const show = () => {
    const c = Math.round(garage.cash * 100) / 100;
    if (c === shown) return;
    const was = shown; shown = c;
    const [e, ct] = cents(c);
    num.innerHTML = (c < 0 ? '−' : '') + e + '<span class="c">,' + ct + '</span><small>€</small>';   // euro and cents, then the unit, like the speed next to it
    el.classList.toggle('neg', c < 0);
    if (was !== null) {
      el.classList.remove('up', 'down'); el.classList.add(c > was ? 'up' : 'down');
      clearTimeout(t); t = setTimeout(() => el.classList.remove('up', 'down'), 900);
    }
  };
  garage.onChange(show); show();
  return {
    pop(amount) {
      if (!(amount > 0)) return;
      const [e, ct] = cents(amount), p = document.createElement('span');
      p.className = 'pd-wpop'; p.textContent = `+${e},${ct} €`;
      p.addEventListener('animationend', () => p.remove(), { once: true });
      el.appendChild(p);
      while (el.querySelectorAll('.pd-wpop').length > 4) el.querySelector('.pd-wpop').remove();   // a burst of hits never piles up more than a few
    },
  };
}
