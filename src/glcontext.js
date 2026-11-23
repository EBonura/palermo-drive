// A lost GL context (a phone in the background, memory pressure) usually comes back within seconds and the game rebuilds what it needs (the handler in src/main.js).
// When it has not come back after 10 seconds with the page in view, the canvas is dead and nothing here can revive it, so this says so and offers a reload.
// It only watches: it never calls preventDefault and does nothing to the restore path. The card goes away by itself if the context does come back.
import { T } from './lang.js';

const WAIT_MS = 10000;

export function watchGlContext(canvas) {
  let lost = false, timer = 0, card = null;
  const hide = () => { clearTimeout(timer); timer = 0; if (card) { card.remove(); card = null; } };
  const show = () => {
    timer = 0;
    if (!lost || card || document.hidden) return;
    card = document.createElement('div');
    card.setAttribute('role', 'alert');
    card.style.cssText = 'position:fixed;left:50%;bottom:max(24px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:100000;display:flex;align-items:center;gap:12px;max-width:calc(100vw - 32px);padding:12px 16px;border-radius:10px;background:rgba(11,7,9,.92);border:1px solid #e8559a;color:#fff;font:600 14px/1.3 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.5)';
    const msg = document.createElement('span');
    msg.textContent = T('La grafica si è fermata. Ricarica la pagina per continuare.', 'The graphics stopped. Reload the page to keep playing.');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = T('Ricarica', 'Reload');
    btn.style.cssText = 'flex:none;padding:8px 14px;border:0;border-radius:8px;background:#e8559a;color:#fff;font:700 14px system-ui,sans-serif;cursor:pointer';
    btn.addEventListener('click', () => location.reload());
    card.append(msg, btn);
    document.body.appendChild(card);
  };
  const arm = () => { clearTimeout(timer); timer = setTimeout(show, WAIT_MS); };
  canvas.addEventListener('webglcontextlost', () => { lost = true; arm(); });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; hide(); });
  document.addEventListener('visibilitychange', () => { if (lost && !document.hidden && !card) arm(); });   // lost in the background: the wait starts when the player is back
}
