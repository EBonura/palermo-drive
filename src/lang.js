// The language the game is shown in: one at a time, never two. 'it' is the Palermitan setting (its lines that are still plain Italian stay Italian there), 'en' is English.
// The player picks it in the main menu or the in-game options (src/ui.js calls setLang); it is saved with the other settings, and a ?lang=en|it link wins over the saved one.
// setLang() changes <html lang> and sends the window event 'pd-lang', so that what is already on screen (or built once) can write itself again.
//   getLang() -> 'it' | 'en'    li() -> 0 | 1, the index into an [italiano, english] pair    T(it, en) -> the one that is shown    one([it, en]) -> the same for a pair
// Modules that read document.documentElement.lang directly still agree with this: it is the same value.
const KEY = 'palermoDrive.settings.v1';
const ok = l => l === 'it' || l === 'en';

let cur = 'it';
try {
  const q = new URLSearchParams(location.search).get('lang');
  const saved = (JSON.parse(localStorage.getItem(KEY) || 'null') || {}).lang;
  cur = ok(q) ? q : ok(saved) ? saved : 'it';
} catch (e) { /* storage unavailable: Palermitan */ }
document.documentElement.lang = cur;

export const getLang = () => cur;
export const li = () => (cur === 'en' ? 1 : 0);
export const T = (it, en) => (cur === 'en' ? en : it);
export const one = pair => pair[li()];
export function setLang(l) {
  if (!ok(l) || l === cur) return;
  cur = l; document.documentElement.lang = l;
  dispatchEvent(new CustomEvent('pd-lang', { detail: l }));
}
export const onLang = fn => addEventListener('pd-lang', fn);
