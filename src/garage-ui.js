// The Garage screen: choose a vehicle, a paint scheme and the tamarro parts, with a slowly turning close view of it.
// Owned by the driving work; src/ui.js (the shell) mounts it into its 'garage' screen and forwards enter/leave, the camera and language changes.
// Money comes from fares ("Turisti affamati" credits src/garage.js). Browsing an unowned vehicle or part previews it on the model; buying
// it (when the wallet allows) makes it yours and equips it. Choices persist through src/garage.js.
import { garage, VEHICLES, LIVERIES, PARTS, partById, vehicleById } from './garage.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const wrapA = a => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
const eur = v => '€ ' + (Math.round(v * 2) / 2).toString().replace('.', ',');

const S = {
  title: ['Garage tamarro', 'Tamarro garage'],
  ride: ['Mezzo', 'Ride'], paint: ['Colore', 'Paint'], parts: ['Pezzi', 'Parts'],
  stock: ['Di serie', 'Stock'], mine: ['Tuo', 'Owned'],
  buy: ['Compra', 'Buy'], need: ['Servono altri', 'Need'],
  bought: ['Comprato!', 'Bought!'],
  earn: ['Guadagna euro con i Turisti affamati', 'Earn euros in Hungry tourists'],
  tryIt: ['Prova', 'Preview'],
  horn: ['Tieni premuto per suonare', 'Tap to honk'],
};

const CSS = `
.gx-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.gx-top .pd-h { font-size: clamp(22px, 5vh, 34px); white-space: nowrap; }
.gx-cash { font: 700 clamp(18px, 4vh, 26px)/1 var(--pd-cond); letter-spacing: .08em; color: var(--pd-amber); background: rgba(255,255,255,.08); padding: 5px 10px; border-radius: 3px; box-shadow: inset 0 0 0 2px rgba(245,169,201,.35); white-space: nowrap; }
.gx-tabs, .gx-cats { display: flex; gap: 4px; flex-wrap: wrap; }
.gx-tabs .pd-segb { flex: 1 1 0; }
.gx-cats .pd-segb { flex: 0 0 auto; min-height: clamp(30px, 6.6vh, 38px); padding: 0 12px; font-size: clamp(13px, 3vh, 17px); }
.gx-list { flex: 1 1 auto; min-height: 0; }
.gx-it { padding-right: 76px; }
.gx-it .pd-in { max-width: 100%; }
.gx-it .pd-l1 { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gx-tag { position: absolute; right: 14px; top: 50%; transform: translateY(-50%) skewX(11deg); font: 700 clamp(13px, 3vh, 18px)/1 var(--pd-cond); letter-spacing: .06em; color: var(--pd-amber); white-space: nowrap; }
.gx-it.pd-liv[style*="--sw"] .gx-tag { right: 44px; }
.gx-it[aria-pressed=true] .gx-tag { color: var(--pd-ink); }
.gx-it.gx-lock .gx-tag { color: #fff; opacity: .85; }
.gx-buy { min-height: clamp(34px, 7vh, 46px); display: flex; align-items: center; }
.gx-buy .pd-btn { min-height: clamp(38px, 8.4vh, 50px); }
.gx-hint { font: 600 clamp(12px, 2.7vh, 15px)/1.2 var(--pd-cond); letter-spacing: .1em; text-transform: uppercase; color: rgba(255,255,255,.7); }
.gx-hint b { color: var(--pd-amber); }
.gx-pop { color: var(--pd-amber); font: 700 clamp(15px, 3.4vh, 20px)/1 var(--pd-cond); letter-spacing: .1em; text-transform: uppercase; }
@media (max-height: 460px) {
  .pd-garage { gap: 5px; padding-top: 8px; padding-bottom: 8px; }
  .gx-tabs .pd-segb { min-height: 34px; font-size: 15px; }
  .gx-cats .pd-segb { min-height: 28px; font-size: 13px; padding: 0 8px; }
  .gx-list .pd-btn.sm { min-height: 38px; }
  .gx-list .pd-l2 { display: none; }
  .gx-it { padding-right: 62px; }
  .gx-buy { min-height: 32px; } .gx-buy .pd-btn { min-height: 34px; }
}
`;

// camera focus for the part being browsed: where to look from
const FOCUS = {
  rims: { mode: 'side', d: 3.1, h: 0.75, ly: 0.35 },
  spoiler: { mode: 'rear', d: 5.6, h: 1.9, ly: 0.9 }, exhaust: { mode: 'rear', d: 5.0, h: 1.0, ly: 0.45 }, sub: { mode: 'rear', d: 5.0, h: 1.2, ly: 0.6 },
  stickers: { mode: 'side', d: 5.6, h: 1.4, ly: 0.7 }, neon: { mode: 'orbit', d: 5.8, h: 0.9, ly: 0.2 },
};

export function setupGarageUI({ screen, button, vehicle, groundY, getLang }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const root = screen.querySelector('.gx-root');
  button.hidden = false;
  const Q = new URLSearchParams(location.search);   // test links: ?ui=garage&gtab=p&gcat=neon
  let tab = 'v', cat = 'spoiler', pending = null, popMsg = '', popT = 0, entered = false, camSec = 0;
  const cam = { a: 0, orbit: 0, d: 7, h: 2.7, ly: 0.7 };
  const tr = k => S[k][getLang() === 'it' ? 0 : 1], two = k => { const i = getLang() === 'it' ? 0 : 1; return [S[k][i], S[k][1 - i]]; };
  const nm = o => { const i = getLang() === 'it' ? 0 : 1, n = [o.name_it, o.name_en]; return [n[i], n[1 - i]]; };
  const kind = () => vehicle.car.kind || 'lapa';
  const partsFor = () => PARTS.filter(p => !(p.id === 'sub' && false));

  // ---- model of what is shown on the vehicle ----
  function previewLook() {
    const l = garage.look();
    if (pending && pending.k === 'v') { l.type = pending.id; l.livery = garage.liveryOf(pending.id); }
    if (pending && pending.k === 'p') { if (pending.id) l.parts[pending.part] = pending.id; else delete l.parts[pending.part]; }
    return l;
  }
  const showPending = () => { vehicle.preview(pending ? previewLook() : null); };

  // ---- rendering ----
  const priceTag = (owned, price) => owned ? '<span class="gx-tag">✓</span>' : `<span class="gx-tag">${eur(price)}</span>`;
  function item(key, names, sub, pressed, tagHTML, extra = '', lock = false) {
    return `<button class="pd-btn sm pd-liv gx-it${lock ? ' gx-lock' : ''}" data-nav data-gx="${esc(key)}" aria-pressed="${pressed}" type="button"${extra}><span class="pd-in"><span class="pd-l1">${esc(names[0])}</span>${sub === false ? '' : `<span class="pd-l2">${esc(sub != null ? sub : names[1])}</span>`}</span>${tagHTML}</button>`;
  }
  function listHTML() {
    if (tab === 'v') {
      const cur = pending && pending.k === 'v' ? pending.id : garage.type;
      return VEHICLES.map(v => { const own = garage.ownsVehicle(v.id), n = nm(v), s = getLang() === 'it' ? v.sub_it : v.sub_en; return item('v:' + v.id, n, s, cur === v.id, priceTag(own, v.price), '', !own); }).join('');
    }
    if (tab === 'c') {
      const cur = garage.liveryOf();
      return (LIVERIES[garage.type] || []).map(l => item('c:' + l.id, nm(l), null, cur === l.id, '', ` style="--sw:${esc(l.color)}"`)).join('');
    }
    const P = partById(cat), curOpt = pending && pending.k === 'p' && pending.part === cat ? pending.id : (garage.parts[cat] || '');
    const stock = item(`p:${cat}:`, two('stock'), false, curOpt === '', '<span class="gx-tag">✓</span>');
    return stock + P.opts.map(o => { const own = garage.ownsPart(cat, o.id); return item(`p:${cat}:${o.id}`, nm(o), null, curOpt === o.id, priceTag(own, o.price), o.color && o.id !== 'arcobaleno' ? ` style="--sw:${esc(o.color)}"` : '', !own); }).join('');
  }
  function buyHTML() {
    if (popT > 0 && !pending) return `<span class="gx-pop">${esc(popMsg)}</span>`;
    if (pending) {
      const price = pending.k === 'v' ? vehicleById(pending.id).price : garage.partPrice(pending.part, pending.id), need = price - garage.cash;
      if (need <= 0) return `<button class="pd-btn sm drive" data-nav data-gx="buy" type="button" style="width:100%"><span class="pd-in"><span class="pd-l1">${esc(tr('buy'))} · ${eur(price)}</span></span></button>`;
      return `<span class="gx-hint">${esc(tr('need'))} <b>${eur(need)}</b></span>`;
    }
    if (garage.cash < 10) return `<span class="gx-hint">${esc(tr('earn'))}</span>`;
    return '';
  }
  function render(keepFocus = true) {
    const act = document.activeElement, fk = keepFocus && act && root.contains(act) ? act.dataset.gx : null, sc = root.querySelector('.gx-list') ? root.querySelector('.gx-list').scrollTop : 0;
    const t = two('title'), tabBtn = (k, label) => `<button class="pd-segb" data-nav data-gx="tab:${k}" aria-pressed="${tab === k}" type="button"><span>${esc(label)}</span></button>`;
    root.innerHTML = `
      <div class="gx-top"><h2 class="pd-h"><span class="pd-l1">${esc(t[0])}</span></h2><div class="gx-cash">${eur(garage.cash)}</div></div>
      <div class="gx-tabs">${tabBtn('v', tr('ride'))}${tabBtn('c', tr('paint'))}${tabBtn('p', tr('parts'))}</div>
      ${tab === 'p' ? `<div class="gx-cats">${partsFor().map(p => `<button class="pd-segb" data-nav data-gx="cat:${p.id}" aria-pressed="${cat === p.id}" type="button"><span>${esc(getLang() === 'it' ? p.name_it : p.name_en)}</span></button>`).join('')}</div>` : ''}
      <div class="pd-stack pd-liveries gx-list">${listHTML()}</div>
      <div class="gx-buy">${buyHTML()}</div>`;
    const list = root.querySelector('.gx-list'); list.scrollTop = sc;
    if (fk) { const el = [...root.querySelectorAll('[data-gx]')].find(e => e.dataset.gx === fk); if (el) el.focus({ preventScroll: true }); }
  }

  // ---- actions ----
  function flash(msg) { popMsg = msg; popT = 1.6; }
  function equipVehicle(id) { pending = null; vehicle.preview(null); garage.setVehicle(id); }
  function equipPart(part, opt) { pending = null; vehicle.preview(null); garage.setPart(part, opt); }
  function click(e) {
    const b = e.target.closest && e.target.closest('[data-gx]'); if (!b) return;
    const [k, a, c] = b.dataset.gx.split(':');
    if (k === 'tab') { tab = a; pending = null; showPending(); }
    else if (k === 'cat') { cat = a; pending = null; showPending(); }
    else if (k === 'v') { if (garage.ownsVehicle(a)) equipVehicle(a); else { pending = { k: 'v', id: a }; showPending(); } }
    else if (k === 'c') { pending = null; vehicle.preview(null); garage.setLivery(a); }
    else if (k === 'p') {
      if (!c || garage.ownsPart(a, c)) equipPart(a, c); else { pending = { k: 'p', part: a, id: c }; showPending(); }
      if (a === 'horn' && c) vehicle.testHorn();
    } else if (k === 'buy' && pending) {
      const ok = pending.k === 'v' ? garage.buyVehicle(pending.id) : garage.buyPart(pending.part, pending.id);
      if (ok) { const p = pending; flash(tr('bought')); if (p.k === 'v') equipVehicle(p.id); else equipPart(p.part, p.id); }
    }
    render();
  }
  root.addEventListener('click', click);
  garage.onChange(() => { if (entered) render(); });   // a fare paid while the garage is open updates the wallet

  return {
    enter() { entered = true; tab = Q.get('gtab') || 'v'; if (Q.get('gcat') && partById(Q.get('gcat'))) cat = Q.get('gcat'); pending = null; popT = 0; vehicle.setShowcase(true); cam.a = vehicle.car.th + 2.4; cam.orbit = cam.a; render(false); },
    leave() { entered = false; pending = null; vehicle.preview(null); vehicle.setShowcase(false); },
    render() { if (entered) render(); },
    applyLang() { if (entered) render(); },
    tick(dt) { if (popT > 0) { popT -= dt; if (popT <= 0) render(); } },
    // camera for the title state: a slow orbit close to the vehicle, moving in on what you are browsing
    cam(c, sec) {
      const dt = clamp(sec - camSec, 0, 0.1); camSec = sec;
      if (c.fov !== 40) { c.fov = 40; c.updateProjectionMatrix(); }
      const car = vehicle.car, gy = groundY(car.x, car.z), k = car.kind === 'bike' ? 0.72 : car.kind === 'car' ? 1.18 : 1;
      const F = tab === 'p' && FOCUS[cat] ? FOCUS[cat] : { mode: 'orbit', d: 8.4, h: 3.0, ly: 0.75 };
      cam.orbit += dt * 0.32;
      const tgt = F.mode === 'rear' ? car.th + Math.PI + Math.sin(sec * 0.4) * 0.45 : F.mode === 'side' ? car.th + 1.25 + Math.sin(sec * 0.4) * 0.3 : cam.orbit;
      const e = 1 - Math.exp(-3 * dt);
      cam.a += wrapA(tgt - cam.a) * (F.mode === 'orbit' ? 1 : e); if (F.mode === 'orbit') cam.a = tgt;
      cam.d += (F.d * k - cam.d) * e; cam.h += (F.h * (k < 1 ? 0.8 : 1) - cam.h) * e; cam.ly += (F.ly * (k < 1 ? 1.1 : 1) - cam.ly) * e;
      c.position.set(car.x + Math.sin(cam.a) * cam.d, gy + cam.h + Math.sin(sec * 0.23) * 0.2, car.z + Math.cos(cam.a) * cam.d);
      c.lookAt(car.x, gy + cam.ly, car.z);
      c.translateX(0.36 * cam.d);   // the vehicle sits left of centre, the list on the right
    },
  };
}
