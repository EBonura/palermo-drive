// Why online play is not there, and what the player is told (docs/ONLINE.md, "When online is not available").
// A browser cannot read why a WebSocket upgrade failed, so after a failed connect the page asks the relay's GET /status once (the answer is made in relay-worker/src/status.rs).
// What can be known: 'full' and 'budget' (the relay says so, or closes with 1013 / 1008 "daily allowance used"), 'quota' (the relay's own object answers that its free daily limit is used up).
// What cannot: if the relay does not answer /status either (Cloudflare answers for a Worker over ITS daily limit, with an error page the browser will not let a page read), it is 'unreach': not available,
// no reason claimed.
//   const reach = createReach({ url, onChange });   reach.failed({ code, reason }) after a socket failed (asks /status at most once at a time);   reach.opened();   reach.reset();   reach.state: null | 'full' | 'budget' | 'quota' | 'unreach'
//   const v = describe(state, lang, now) -> { tone, pill, msg, toast, recovered }
const ASK_MS = 5000;        // how long /status may take before it counts as unreadable
const REASK_MS = 900000;    // a daily reason (quota, budget) is asked about again after this long, in case it was a wrong guess; otherwise it stands until a socket opens
const DAILY = { quota: 1, budget: 1 };

// ---------- the words ----------
// PALERMITAN: the owner's own spelling, drafts to be corrected by him, one constant per line. {time} is the local time of 00:00 UTC, as HH:MM.
const IT_PILL_FULL = 'Online chinu';
const IT_PILL_DONE = 'Online finutu pi oggi';
const IT_PILL_OFF = 'Online un funziona';
const IT_FULL = 'Ora siemu truappu online. Riprovu iu tra picca, tu intantu ioca.';
const IT_DONE = 'Pi oggi l’online finìu: u server è aggratis e i gettoni finieru. Tuinna doppu i {time}. Intantu ioca sulu.';
const IT_OFF = 'L’online ora un funziona. Riprovu iu, tu intantu ioca.';
const IT_BACK = 'L’online tuinnàu!';
const IT_CARD = 'L’online camina supra un server aggratis: quannu i gettoni ri oggi finiscinu, si ioca suli finu a notti.';
// not in the owner's list: composed from his words for the case where only THIS player's address has used its share (the pill is the same as for the day being over)
const IT_BUDGET = 'Pi oggi i to’ gettoni finieru. Tuinna doppu i {time}. Intantu ioca sulu.';
// ENGLISH
const EN_PILL_FULL = 'Online full';
const EN_PILL_DONE = 'Online done for today';
const EN_PILL_OFF = 'Online unavailable';
const EN_FULL = 'The online city is full right now. Try again in a bit, and keep driving solo in the meantime.';
const EN_DONE = 'Online play is finished for today: the free server has used up its daily allowance. It comes back after {time}. Solo play carries on.';
const EN_OFF = 'Online play is not available right now. The game keeps trying, and solo play carries on.';
const EN_BACK = 'Online is back!';
const EN_CARD = 'Online play runs on a free server with a daily limit: when the day’s allowance runs out, it is solo play until night.';
const EN_BUDGET = 'You have used your share of online play for today. It comes back after {time}. Solo play carries on.';

export const TEXT = {
  it: { full: IT_PILL_FULL, done: IT_PILL_DONE, off: IT_PILL_OFF, fullMsg: IT_FULL, doneMsg: IT_DONE, offMsg: IT_OFF, back: IT_BACK, card: IT_CARD, budgetMsg: IT_BUDGET },
  en: { full: EN_PILL_FULL, done: EN_PILL_DONE, off: EN_PILL_OFF, fullMsg: EN_FULL, doneMsg: EN_DONE, offMsg: EN_OFF, back: EN_BACK, card: EN_CARD, budgetMsg: EN_BUDGET },
};

// 00:00 UTC after `now` (ms), as HH:MM on the player's own clock. tz is for the tests; the page leaves it out and gets the player's time zone.
export function resetTime(now, lang, tz) {
  const d = new Date(now), next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  try { return new Date(next).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'it-IT', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }); }
  catch (e) { return '00:00 UTC'; }
}

// what to show for a state: tone is the colour (a class of the pill), pill the few words, msg the sentence for the panel and the toast
export function describe(state, lang, now = Date.now(), tz) {
  const t = TEXT[lang === 'en' ? 'en' : 'it'], time = () => resetTime(now, lang, tz);
  switch (state) {
    case 'full': return { tone: 'full', pill: t.full, msg: t.fullMsg };
    case 'quota': return { tone: 'done', pill: t.done, msg: t.doneMsg.replace('{time}', time()) };
    case 'budget': return { tone: 'done', pill: t.done, msg: t.budgetMsg.replace('{time}', time()) };
    case 'unreach': return { tone: 'off', pill: t.off, msg: t.offMsg };
    default: return null;
  }
}

// wss://host/r -> https://host/status
export function statusUrl(relayUrl) {
  try { const u = new URL(relayUrl); u.protocol = u.protocol === 'ws:' ? 'http:' : 'https:'; u.pathname = '/status'; u.search = ''; return u.href; } catch (e) { return ''; }
}

// the answer of /status as one of 'ok', 'full', 'budget', 'quota', 'unreach'; null when it could not be read at all
export function readStatus(j) {
  if (!j || typeof j !== 'object' || typeof j.ok !== 'boolean') return null;
  if (j.ok) return 'ok';
  return j.why === 'full' || j.why === 'budget' || j.why === 'quota' ? j.why : 'unreach';
}

export function createReach({ url, onChange = () => {}, fetchImpl = globalThis.fetch && globalThis.fetch.bind(globalThis), now = () => performance.now(), setTimer = setTimeout, clearTimer = clearTimeout }) {
  const endpoint = statusUrl(url);
  let state = null, asking = false, askedAt = -1e9, gen = 0, asks = 0;
  const set = s => { if (s !== state) { state = s; onChange(s); } };
  async function ask(g) {
    asking = true; asks++; askedAt = now();
    let r = null, timer = null;
    try {
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      if (ctl) timer = setTimer(() => ctl.abort(), ASK_MS);
      const res = await fetchImpl(endpoint, { mode: 'cors', credentials: 'omit', signal: ctl ? ctl.signal : undefined });
      r = readStatus(await res.json());
    } catch (e) { r = null; }   // a failed or opaque fetch (Cloudflare's own error page has no CORS headers), a timeout, or something that is not JSON
    clearTimer(timer); asking = false;
    if (g !== gen) return;   // the socket opened or the player went solo while we waited
    set(r === null ? 'unreach' : r === 'ok' ? null : r);   // the relay answers and has room: the failure was a passing one, nothing to say (the next ones will say it if they repeat)
  }
  return {
    get state() { return state; }, get asks() { return asks; },
    // a socket failed (it never opened, or it opened and was closed). The relay's own close codes say why when it can; otherwise ask /status, once at a time
    failed(info = {}) {
      if (info.code === 1008 && /allowance/.test(info.reason || '')) { set('budget'); return; }
      if (info.code === 1013) { set('full'); return; }
      if (!endpoint || !fetchImpl || asking) return;
      if (DAILY[state] && now() - askedAt < REASK_MS) return;   // already known, and it lasts until midnight UTC
      ask(gen);
    },
    opened() { gen++; set(null); },
    reset() { gen++; set(null); },
  };
}
