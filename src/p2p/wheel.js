// The talk wheel: a radial menu (like a weapon wheel) over the middle of the screen. The first ring is the categories; picking one swaps the ring for
// its phrases, the middle circle goes back (or closes, from the first ring). It is plain SVG with no pointer-capturing backdrop, so the driving
// controls stay usable while it is open. Everything shown is text set with textContent; nothing here is built from received data.
//   const wheel = createWheel({ categories: [{ label, icon, items: [{ label, onPick: () => bool, tag? }] }], onClose });
//   wheel.open() / close() / toggle() / isOpen; digits 1-8 pick on the keyboard (wired by the owner of the page).
const NS = 'http://www.w3.org/2000/svg', VB = 520, C = VB / 2, R_OUT = 250, R_IN = 78, R_TXT = 164;
const PINK = '#e8559a';
const el = (name, attrs, text) => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; };

function wedgePath(a0, a1) {   // an annular sector, angles in radians clockwise from 12 o'clock
  const p = (r, a) => [C + r * Math.sin(a), C - r * Math.cos(a)], big = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(R_OUT, a0), [x1, y1] = p(R_OUT, a1), [x2, y2] = p(R_IN, a1), [x3, y3] = p(R_IN, a0);
  return `M${x0} ${y0}A${R_OUT} ${R_OUT} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${R_IN} ${R_IN} 0 ${big} 0 ${x3} ${y3}Z`;
}
function wrap(text, max = 12) {   // at most 3 short lines, broken at spaces
  const words = String(text).split(' '), lines = [];
  for (const w of words) { const l = lines[lines.length - 1]; if (l !== undefined && (l + ' ' + w).length <= max) lines[lines.length - 1] = l + ' ' + w; else lines.push(w); }
  return lines.slice(0, 3);
}

export function createWheel({ categories: initial, backLabel = () => 'indietro', closeLabel = () => 'chiudi', onClose = () => {} }) {
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;z-index:35;left:50%;top:50%;transform:translate(-50%,-50%);width:min(88vh,88vw,600px);height:min(88vh,88vw,600px);display:none;pointer-events:none;touch-action:none;user-select:none;-webkit-user-select:none';
  const svg = el('svg', { viewBox: `0 0 ${VB} ${VB}`, width: '100%', height: '100%', role: 'menu' });
  svg.style.cssText = 'display:block;pointer-events:none;font-family:system-ui,-apple-system,sans-serif;font-weight:700;overflow:visible';
  root.appendChild(svg); document.body.appendChild(root);
  let categories = initial || [], level = null, shown = false;   // level: null = categories, else the category

  function draw() {
    svg.textContent = '';
    const list = level ? level.items : categories, n = list.length, step = 2 * Math.PI / n, gap = 0.018;
    list.forEach((it, i) => {
      const a0 = i * step - step / 2 + gap, a1 = (i + 1) * step - step / 2 - gap, mid = i * step, g = el('g', { role: 'menuitem', 'aria-label': it.label });
      g.style.cssText = 'pointer-events:auto;cursor:pointer';
      const path = el('path', { d: wedgePath(a0, a1), fill: 'rgba(13,7,9,.9)', stroke: PINK, 'stroke-width': 3, 'stroke-linejoin': 'round' });
      g.appendChild(path);
      const tx = C + R_TXT * Math.sin(mid), ty = C - R_TXT * Math.cos(mid);
      if (!level) {   // a category: its icon big, its name below
        g.appendChild(el('text', { x: tx, y: ty - 8, 'text-anchor': 'middle', 'font-size': 46 }, it.icon || ''));
        wrap(it.label, 13).forEach((s, k) => g.appendChild(el('text', { x: tx, y: ty + 28 + k * 21, 'text-anchor': 'middle', 'font-size': 19, fill: '#fff' }, s)));
      } else {
        const lines = wrap(it.label), y0 = ty - (lines.length - 1) * 11 + 6;
        lines.forEach((s, k) => g.appendChild(el('text', { x: tx, y: y0 + k * 22, 'text-anchor': 'middle', 'font-size': 20, fill: '#fff' }, s)));
        if (it.tag) g.appendChild(el('text', { x: tx, y: y0 + lines.length * 22 + 2, 'text-anchor': 'middle', 'font-size': 15, fill: '#ffb3d4' }, it.tag));
      }
      g.appendChild(el('text', { x: C + (R_OUT - 20) * Math.sin(mid), y: C - (R_OUT - 20) * Math.cos(mid) + 6, 'text-anchor': 'middle', 'font-size': 15, fill: '#ffb3d4' }, String(i + 1)));   // the digit key
      g.addEventListener('pointerenter', () => { path.setAttribute('fill', PINK); });
      g.addEventListener('pointerleave', () => { path.setAttribute('fill', 'rgba(13,7,9,.9)'); });
      g.addEventListener('click', e => { e.stopPropagation(); pick(i); });
      svg.appendChild(g);
    });
    const mid = el('g', { role: 'button', 'aria-label': level ? backLabel() : closeLabel() });
    mid.style.cssText = 'pointer-events:auto;cursor:pointer';
    mid.appendChild(el('circle', { cx: C, cy: C, r: R_IN - 12, fill: 'rgba(13,7,9,.94)', stroke: PINK, 'stroke-width': 3 }));
    mid.appendChild(el('text', { x: C, y: C + 7, 'text-anchor': 'middle', 'font-size': 20, fill: '#fff' }, level ? '‹ ' + backLabel() : '✕'));
    mid.addEventListener('click', e => { e.stopPropagation(); back(); });
    svg.appendChild(mid);
  }
  function pick(i) {
    if (!level) { level = categories[i]; if (!level) return; draw(); return; }
    const it = level.items[i]; if (!it) return;
    if (it.onPick() !== false) close();
  }
  function back() { if (level) { level = null; draw(); } else close(); }
  function open() { if (shown) return; shown = true; level = null; root.style.display = 'block'; draw(); }
  function close() { if (!shown) return; shown = false; level = null; root.style.display = 'none'; svg.textContent = ''; onClose(); }
  return {
    open, close, back, pick, get isOpen() { return shown; }, get level() { return level; },
    toggle() { shown ? close() : open(); },
    setCategories(c) { categories = c; if (shown) { level = null; draw(); } },
  };
}
