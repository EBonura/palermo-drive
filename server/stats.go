package main

// Anonymous player analytics and the relay's own free-tier accounting.
//
// Clients send a tiny HTTP ping (POST /ping, text/plain, no preflight): "<random id>,<s|b|e>[,<active seconds>]".
// s = session start, b = beat (every ~3 minutes of active play), e = session end (sendBeacon on page hide).
// The random id never leaves the relay in readable form: only the first 6 bytes of its SHA-256 are kept, in a set per
// day and per month (for "unique players"). No IP address and no name is stored anywhere; IPs are only used in memory
// for a rate limit.
//
// Usage accounting follows Cloud Run request-based billing: instance time is billed while at least one request
// (an open WebSocket is a request) is being processed. We count every second with an open WebSocket, plus 0.1 s per HTTP
// request (billing rounds up to 100 ms) and a few seconds per cold start, plus requests and egress bytes. When
// the month's usage reaches capPct of the free tier the relay stops accepting WebSockets (clients keep pinging and play
// single-player) and at the hard stop it disconnects everybody, until the (UTC) month rolls over.

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	sessionTTL   = 4 * time.Minute // a session with no ping for this long is no longer "online"
	maxSessions  = 20000
	maxSetIDs    = 50000 // per day or month set; beyond this uniques stop growing (a Firestore document is limited to 1 MiB)
	maxBeatSecs  = 200   // credit per beat; clients send one every ~180 s
	pingBusySec  = 0.1   // Cloud Run rounds request time up to 100 ms
	coldStartSec = 3.0
	keepDays     = 120
	keepMonths   = 36

	// Cloud Run free tier, request-based billing, https://cloud.google.com/run/pricing
	freeVCPUSec = 180000.0
	freeGiBSec  = 360000.0
	freeReqs    = 2000000.0
)

type Agg struct {
	Players    int     `json:"p"`
	Sessions   int     `json:"s"`
	Minutes    float64 `json:"m"`
	PeakOnline int     `json:"o"`
	PeakConn   int     `json:"c"`
}

type Usage struct {
	BusySec  float64 `json:"busy"`
	Requests int64   `json:"req"`
	EgressB  int64   `json:"egress"`
	WSOpened int64   `json:"ws"`
	Refused  int64   `json:"refused"`
}

type persisted struct {
	Days    map[string]*Agg   `json:"days"`
	Months  map[string]*Agg   `json:"months"`
	Usage   map[string]*Usage `json:"usage"`
	Total   Agg               `json:"total"` // players = not tracked
	Started string            `json:"since"`
}

type session struct {
	last  time.Time
	start time.Time
	mp    bool // wants multiplayer (has a name and is not playing offline)
}

type statsCfg struct {
	key        string
	cpu        float64 // vCPUs of the Cloud Run instance
	memGiB     float64
	capPct     float64 // stop accepting WebSockets at this share of the free tier
	hardPct    float64 // disconnect everybody at this share
	vm         bool    // running on a VM, not Cloud Run: only the egress allowance is accounted
	egressFree int64   // free egress bytes per month (1 GiB, North America only), 0 = do not account for it
}

type bucket struct {
	tokens float64
	t      time.Time
}

type Stats struct {
	mu    sync.Mutex
	store Store
	cfg   statsCfg
	p     persisted

	dayKey, monthKey string
	daySet, monthSet map[string]struct{}
	sessions         map[string]*session
	connected        int
	dirty, dayDirty  bool
	monthDirty       bool
	lastTick         time.Time
	lastFlush        time.Time
	lastLogLine      string
	ipHits           map[string]*bucket
	ipNew            map[string]int
	ipDay            string
	refusing         bool
	pending          map[string][]byte // id sets of a finished day or month, written at the next flush
	start            time.Time
}

func NewStats(store Store, cfg statsCfg) *Stats {
	now := time.Now().UTC()
	s := &Stats{store: store, cfg: cfg, sessions: map[string]*session{}, ipHits: map[string]*bucket{}, ipNew: map[string]int{}, pending: map[string][]byte{}, start: now, lastTick: now, lastFlush: now}
	s.p = persisted{Days: map[string]*Agg{}, Months: map[string]*Agg{}, Usage: map[string]*Usage{}, Started: now.Format("2006-01-02")}
	if b, err := store.Get("state"); err != nil {
		log.Printf("stats: load failed: %v (starting empty)", err)
	} else if b != nil {
		var p persisted
		if json.Unmarshal(b, &p) == nil {
			if p.Days == nil {
				p.Days = map[string]*Agg{}
			}
			if p.Months == nil {
				p.Months = map[string]*Agg{}
			}
			if p.Usage == nil {
				p.Usage = map[string]*Usage{}
			}
			s.p = p
		}
	}
	s.dayKey, s.monthKey = now.Format("2006-01-02"), now.Format("2006-01")
	s.daySet = s.loadSet("ids-d-" + s.dayKey)
	s.monthSet = s.loadSet("ids-m-" + s.monthKey)
	s.usage(now).BusySec += coldStartSec
	s.dirty = true
	return s
}

func (s *Stats) loadSet(name string) map[string]struct{} {
	m := map[string]struct{}{}
	b, err := s.store.Get(name)
	if err != nil {
		log.Printf("stats: load %s: %v", name, err)
		return m
	}
	for i := 0; i+12 <= len(b); i += 12 {
		m[string(b[i:i+12])] = struct{}{}
	}
	return m
}

func encodeSet(m map[string]struct{}) []byte {
	ks := make([]string, 0, len(m))
	for k := range m {
		ks = append(ks, k)
	}
	sort.Strings(ks)
	return []byte(strings.Join(ks, ""))
}

func (s *Stats) usage(now time.Time) *Usage {
	k := now.Format("2006-01")
	u := s.p.Usage[k]
	if u == nil {
		u = &Usage{}
		s.p.Usage[k] = u
	}
	return u
}

func agg(m map[string]*Agg, k string) *Agg {
	a := m[k]
	if a == nil {
		a = &Agg{}
		m[k] = a
	}
	return a
}

// rollover switches to a new day or month (caller holds mu); the finished sets are queued for the next flush.
func (s *Stats) rollover(now time.Time) {
	if d := now.Format("2006-01-02"); d != s.dayKey {
		s.pending["ids-d-"+s.dayKey] = encodeSet(s.daySet)
		s.dayKey, s.daySet = d, map[string]struct{}{}
		s.ipNew = map[string]int{}
		s.dirty = true
		if m := now.Format("2006-01"); m != s.monthKey {
			s.pending["ids-m-"+s.monthKey] = encodeSet(s.monthSet)
			s.monthKey, s.monthSet = m, map[string]struct{}{}
			s.refusing = false
		}
		cut := now.AddDate(0, 0, -keepDays).Format("2006-01-02")
		for k := range s.p.Days {
			if k < cut {
				delete(s.p.Days, k)
			}
		}
		cutM := now.AddDate(0, -keepMonths, 0).Format("2006-01")
		for k := range s.p.Months {
			if k < cutM {
				delete(s.p.Months, k)
			}
		}
		for k := range s.p.Usage {
			if k < cutM {
				delete(s.p.Usage, k)
			}
		}
	}
}

func (s *Stats) online(now time.Time) int {
	n := 0
	for _, x := range s.sessions {
		if now.Sub(x.last) < sessionTTL {
			n++
		}
	}
	return n
}

// onlineMP counts the sessions that would join the relay: multiplayer is only worth an open WebSocket when two or more of them overlap.
func (s *Stats) onlineMP(now time.Time) int {
	n := 0
	for _, x := range s.sessions {
		if x.mp && now.Sub(x.last) < sessionTTL {
			n++
		}
	}
	return n
}

func (s *Stats) bumpPeaks(now time.Time) {
	o := s.online(now)
	for _, a := range []*Agg{agg(s.p.Days, s.dayKey), agg(s.p.Months, s.monthKey), &s.p.Total} {
		if o > a.PeakOnline {
			a.PeakOnline = o
			s.dirty = true
		}
	}
}

func idKey(id string) string {
	h := sha256.Sum256([]byte(id))
	return hex.EncodeToString(h[:6])
}

func validID(id string) bool {
	if len(id) < 16 || len(id) > 40 {
		return false
	}
	for _, c := range id {
		if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f') {
			return false
		}
	}
	return true
}

// ping records one client ping. Returns the number of multiplayer-willing sessions online, or -1 when rejected.
func (s *Stats) ping(ip, id, ev string, secs float64, wantsMP bool) int {
	if !validID(id) {
		return -1
	}
	now := time.Now().UTC()
	k := idKey(id)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.rollover(now)
	// per IP: 30 pings per minute and at most 40 new ids per day (in memory only)
	b := s.ipHits[ip]
	if b == nil {
		if len(s.ipHits) > 50000 {
			return -1
		}
		b = &bucket{tokens: 30, t: now}
		s.ipHits[ip] = b
	}
	b.tokens = min(30, b.tokens+now.Sub(b.t).Seconds()*0.5)
	b.t = now
	if b.tokens < 1 {
		return -1
	}
	b.tokens--

	ss := s.sessions[k]
	if ss != nil && now.Sub(ss.last) > sessionTTL {
		ss = nil
	}
	credit := func() {
		if secs <= 0 {
			return
		}
		if secs > maxBeatSecs {
			secs = maxBeatSecs
		}
		if ss != nil { // never credit more than the wall time since the last ping (plus slack)
			if w := now.Sub(ss.last).Seconds() + 20; secs > w {
				secs = w
			}
		}
		m := secs / 60
		agg(s.p.Days, s.dayKey).Minutes += m
		agg(s.p.Months, s.monthKey).Minutes += m
		s.p.Total.Minutes += m
		s.dirty = true
	}
	startSession := func() {
		if len(s.sessions) >= maxSessions {
			return
		}
		ss = &session{start: now, last: now}
		s.sessions[k] = ss
		agg(s.p.Days, s.dayKey).Sessions++
		agg(s.p.Months, s.monthKey).Sessions++
		s.p.Total.Sessions++
		if _, ok := s.daySet[k]; !ok && len(s.daySet) < maxSetIDs {
			if s.ipNew[ip] >= 40 {
				return
			}
			s.ipNew[ip]++
			s.daySet[k] = struct{}{}
			agg(s.p.Days, s.dayKey).Players = len(s.daySet)
			s.dayDirty = true
		}
		if _, ok := s.monthSet[k]; !ok && len(s.monthSet) < maxSetIDs {
			s.monthSet[k] = struct{}{}
			agg(s.p.Months, s.monthKey).Players = len(s.monthSet)
			s.monthDirty = true
		}
		s.dirty = true
	}
	switch ev {
	case "s":
		if ss == nil || now.Sub(ss.last) > time.Minute { // a quick reload is the same session
			startSession()
		}
	case "b":
		if ss == nil {
			startSession()
		}
		credit()
	case "e":
		credit()
		delete(s.sessions, k)
		s.dirty = true
		return s.onlineMP(now)
	default:
		return -1
	}
	if ss != nil {
		ss.last, ss.mp = now, wantsMP
	}
	s.bumpPeaks(now)
	return s.onlineMP(now)
}

// ---------- usage accounting and caps ----------

func (s *Stats) addRequest() {
	s.mu.Lock()
	u := s.usage(time.Now().UTC())
	u.Requests++
	u.BusySec += pingBusySec
	s.dirty = true
	s.mu.Unlock()
}

func (s *Stats) addEgress(n int) {
	s.mu.Lock()
	s.usage(time.Now().UTC()).EgressB += int64(n)
	s.dirty = true
	s.mu.Unlock()
}

func (s *Stats) wsOpen() {
	s.mu.Lock()
	s.connected++
	s.usage(time.Now().UTC()).WSOpened++
	for _, a := range []*Agg{agg(s.p.Days, s.dayKey), agg(s.p.Months, s.monthKey), &s.p.Total} {
		if s.connected > a.PeakConn {
			a.PeakConn = s.connected
		}
	}
	s.dirty = true
	s.mu.Unlock()
}

func (s *Stats) wsClose() {
	s.mu.Lock()
	if s.connected > 0 {
		s.connected--
	}
	s.mu.Unlock()
}

func (s *Stats) connectedNow() int { s.mu.Lock(); defer s.mu.Unlock(); return s.connected }

func (s *Stats) capSeconds() float64 {
	return min(freeVCPUSec/s.cfg.cpu, freeGiBSec/s.cfg.memGiB)
}

// share returns the largest fraction of any free-tier dimension used this month.
func (s *Stats) share(u *Usage) (frac float64, which string) {
	cands := []struct {
		f float64
		n string
	}{}
	if !s.cfg.vm {
		cands = append(cands, struct {
			f float64
			n string
		}{u.BusySec / s.capSeconds(), "instance time"}, struct {
			f float64
			n string
		}{float64(u.Requests) / freeReqs, "requests"})
	}
	if s.cfg.egressFree > 0 {
		cands = append(cands, struct {
			f float64
			n string
		}{float64(u.EgressB) / float64(s.cfg.egressFree), "egress"})
	}
	for _, c := range cands {
		if c.f > frac {
			frac, which = c.f, c.n
		}
	}
	return
}

// allowWS reports whether new WebSocket connections are accepted.
func (s *Stats) allowWS() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	f, _ := s.share(s.usage(time.Now().UTC()))
	ok := f < s.cfg.capPct
	if !ok {
		s.usage(time.Now().UTC()).Refused++
		s.dirty = true
	}
	s.refusing = !ok
	return ok
}

func (s *Stats) mpAvailable() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	f, _ := s.share(s.usage(time.Now().UTC()))
	return f < s.cfg.capPct
}

// tick runs once a second: accounts open-connection time, rolls the day over, flushes at most once a minute.
// It returns true when the hard stop is reached and every connection must be closed.
func (s *Stats) tick(now time.Time) (hardStop bool) {
	now = now.UTC()
	s.mu.Lock()
	defer s.mu.Unlock()
	dt := now.Sub(s.lastTick).Seconds()
	s.lastTick = now
	if dt > 5 {
		dt = 5
	}
	s.rollover(now)
	u := s.usage(now)
	if s.connected > 0 {
		u.BusySec += dt
		s.dirty = true
	}
	if now.Second() == 0 || now.Sub(s.lastFlush) >= time.Minute {
		for k, x := range s.sessions {
			if now.Sub(x.last) > sessionTTL {
				delete(s.sessions, k)
			}
		}
		for k, b := range s.ipHits {
			if now.Sub(b.t) > 5*time.Minute {
				delete(s.ipHits, k)
			}
		}
	}
	if now.Sub(s.lastFlush) >= time.Minute {
		s.flushLocked(now)
	}
	f, _ := s.share(u)
	return s.connected > 0 && f >= s.cfg.hardPct
}

// flushLocked persists changed blobs. It temporarily releases the lock while talking to the store.
func (s *Stats) flushLocked(now time.Time) {
	s.lastFlush = now
	if !s.dirty && !s.dayDirty && !s.monthDirty && len(s.pending) == 0 {
		return
	}
	blobs := s.pending
	s.pending = map[string][]byte{}
	if s.dirty {
		b, _ := json.Marshal(s.p)
		blobs["state"] = b
	}
	if s.dayDirty {
		blobs["ids-d-"+s.dayKey] = encodeSet(s.daySet)
	}
	if s.monthDirty {
		blobs["ids-m-"+s.monthKey] = encodeSet(s.monthSet)
	}
	u := s.usage(now)
	f, which := s.share(u)
	line := fmt.Sprintf("usage busy=%.0fs req=%d egress=%dB share=%.1f%% (%s) online=%d conns=%d", u.BusySec, u.Requests, u.EgressB, f*100, which, s.online(now), s.connected)
	s.dirty, s.dayDirty, s.monthDirty = false, false, false
	s.mu.Unlock()
	failed := false
	for n, b := range blobs {
		if err := s.store.Put(n, b); err != nil {
			failed = true
			log.Printf("stats: save %s failed: %v", n, err)
		}
	}
	if line != s.lastLogLine { // at most one summary line a minute, and none when nothing changed
		s.lastLogLine = line
		log.Print(line)
	}
	s.mu.Lock()
	if failed {
		s.dirty, s.dayDirty, s.monthDirty = true, true, true
		for n, b := range blobs {
			if _, ok := s.pending[n]; !ok && strings.HasPrefix(n, "ids-") && n != "ids-d-"+s.dayKey && n != "ids-m-"+s.monthKey {
				s.pending[n] = b
			}
		}
	}
}

// Flush is called on shutdown.
func (s *Stats) Flush() {
	s.mu.Lock()
	s.dirty = true
	s.flushLocked(time.Now().UTC())
	s.mu.Unlock()
}

// ---------- HTTP ----------

func cors(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Max-Age", "86400")
}

func (s *Stats) servePing(w http.ResponseWriter, r *http.Request) {
	cors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "post only", http.StatusMethodNotAllowed)
		return
	}
	b, _ := io.ReadAll(http.MaxBytesReader(w, r.Body, 128))
	parts := strings.Split(strings.TrimSpace(string(b)), ",")
	if len(parts) < 2 {
		http.Error(w, "bad", http.StatusBadRequest)
		return
	}
	secs := 0.0
	if len(parts) > 2 {
		secs, _ = strconv.ParseFloat(parts[2], 64)
	}
	on := s.ping(clientIP(r), parts[0], parts[1], secs, len(parts) > 3 && parts[3] == "1")
	if on < 0 {
		http.Error(w, "no", http.StatusTooManyRequests)
		return
	}
	body := fmt.Sprintf(`{"mp":0,"on":%d}`, on)
	if s.mpAvailable() {
		body = fmt.Sprintf(`{"mp":1,"on":%d}`, on)
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write([]byte(body))
	s.addEgress(len(body) + 250) // rough: response headers
}

type statsOut struct {
	Now struct {
		Online    int `json:"onlinePlayers"`
		Connected int `json:"multiplayerConnections"`
	} `json:"now"`
	Today   map[string]any   `json:"today"`
	Month   map[string]any   `json:"month"`
	AllTime map[string]any   `json:"allTime"`
	Usage   map[string]any   `json:"freeTierUsage"`
	Days    []map[string]any `json:"days"`
	Months  []map[string]any `json:"months"`
}

func row(k string, a *Agg) map[string]any {
	avgS, avgP := 0.0, 0.0
	if a.Sessions > 0 {
		avgS = a.Minutes / float64(a.Sessions)
	}
	if a.Players > 0 {
		avgP = a.Minutes / float64(a.Players)
	}
	return map[string]any{"period": k, "uniquePlayers": a.Players, "sessions": a.Sessions, "playMinutes": round1(a.Minutes),
		"avgMinutesPerSession": round1(avgS), "avgMinutesPerPlayer": round1(avgP), "peakOnline": a.PeakOnline, "peakMultiplayer": a.PeakConn}
}

func round1(f float64) float64 { return float64(int(f*10+0.5)) / 10 }

func (s *Stats) snapshot() statsOut {
	now := time.Now().UTC()
	s.mu.Lock()
	defer s.mu.Unlock()
	s.rollover(now)
	var o statsOut
	o.Now.Online, o.Now.Connected = s.online(now), s.connected
	o.Today = row(s.dayKey, agg(s.p.Days, s.dayKey))
	o.Month = row(s.monthKey, agg(s.p.Months, s.monthKey))
	t := s.p.Total
	o.AllTime = row("all time (since "+s.p.Started+")", &t)
	delete(o.AllTime, "uniquePlayers")
	delete(o.AllTime, "avgMinutesPerPlayer")
	u := s.usage(now)
	f, which := s.share(u)
	o.Usage = map[string]any{
		"month": s.monthKey, "instanceSeconds": round1(u.BusySec), "instanceHours": round1(u.BusySec / 3600),
		"requests": u.Requests, "egressMiB": round1(float64(u.EgressB) / 1048576), "websocketsOpened": u.WSOpened, "websocketsRefused": u.Refused,
		"capSharePercent": round1(f * 100), "limitingFactor": which, "multiplayerOpen": f < s.cfg.capPct,
		"stopNewConnectionsAtPercent": s.cfg.capPct * 100, "hardStopAtPercent": s.cfg.hardPct * 100,
		"instanceHoursAtCap": round1(s.capSeconds() * s.cfg.capPct / 3600),
	}
	days := make([]string, 0, len(s.p.Days))
	for k := range s.p.Days {
		days = append(days, k)
	}
	sort.Sort(sort.Reverse(sort.StringSlice(days)))
	for i, k := range days {
		if i >= 45 {
			break
		}
		o.Days = append(o.Days, row(k, s.p.Days[k]))
	}
	months := make([]string, 0, len(s.p.Months))
	for k := range s.p.Months {
		months = append(months, k)
	}
	sort.Sort(sort.Reverse(sort.StringSlice(months)))
	for _, k := range months {
		o.Months = append(o.Months, row(k, s.p.Months[k]))
	}
	return o
}

func (s *Stats) serveStats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("X-Robots-Tag", "noindex")
	k := r.URL.Query().Get("key")
	if s.cfg.key == "" || subtle.ConstantTimeCompare([]byte(k), []byte(s.cfg.key)) != 1 {
		http.NotFound(w, r)
		return
	}
	o := s.snapshot()
	if r.URL.Query().Get("format") == "json" || !strings.Contains(r.Header.Get("Accept"), "text/html") {
		w.Header().Set("Content-Type", "application/json")
		enc := json.NewEncoder(w)
		enc.SetIndent("", "  ")
		_ = enc.Encode(o)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	e := html.EscapeString
	var b strings.Builder
	b.WriteString(`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content=noindex><title>Palermo Drive stats</title>
<style>body{font:15px/1.4 system-ui,sans-serif;background:#0d0709;color:#fff;margin:0;padding:16px;max-width:900px}h1{color:#ff6fae;margin:0 0 12px}h2{color:#ff6fae;font-size:15px;margin:22px 0 6px}
.k{display:flex;flex-wrap:wrap;gap:10px}.c{background:#1b1115;border:1.5px solid #e8559a;border-radius:10px;padding:10px 14px;min-width:120px}.c b{display:block;font-size:26px}.c span{opacity:.7;font-size:12px}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:4px 8px;border-bottom:1px solid #3a2a31;text-align:right}th:first-child,td:first-child{text-align:left}th{color:#ff6fae}</style><h1>Palermo Drive</h1>`)
	card := func(v any, l string) { fmt.Fprintf(&b, `<div class=c><b>%v</b><span>%s</span></div>`, v, e(l)) }
	b.WriteString(`<div class=k>`)
	card(o.Now.Online, "playing now (ping in the last 4 min)")
	card(o.Now.Connected, "in multiplayer now")
	card(o.Today["uniquePlayers"], "players today")
	card(o.Month["uniquePlayers"], "players this month")
	card(o.Month["sessions"], "sessions this month")
	card(o.Month["playMinutes"], "play minutes this month")
	card(o.Month["avgMinutesPerSession"], "avg min / session (month)")
	card(o.Month["peakOnline"], "peak online (month)")
	b.WriteString(`</div><h2>Free tier use this month</h2><div class=k>`)
	card(fmt.Sprintf("%v%%", o.Usage["capSharePercent"]), "of the safe cap ("+fmt.Sprint(o.Usage["limitingFactor"])+")")
	card(o.Usage["instanceHours"], fmt.Sprintf("instance hours (cap %v h)", o.Usage["instanceHoursAtCap"]))
	card(o.Usage["requests"], "requests")
	card(o.Usage["egressMiB"], "egress MiB")
	card(o.Usage["multiplayerOpen"], "multiplayer open")
	b.WriteString(`</div>`)
	table := func(title string, rows []map[string]any) {
		fmt.Fprintf(&b, `<h2>%s</h2><table><tr><th></th><th>players</th><th>sessions</th><th>minutes</th><th>min/session</th><th>min/player</th><th>peak online</th><th>peak mp</th></tr>`, e(title))
		for _, r := range rows {
			fmt.Fprintf(&b, `<tr><td>%s</td><td>%v</td><td>%v</td><td>%v</td><td>%v</td><td>%v</td><td>%v</td><td>%v</td></tr>`, e(fmt.Sprint(r["period"])), r["uniquePlayers"], r["sessions"], r["playMinutes"], r["avgMinutesPerSession"], r["avgMinutesPerPlayer"], r["peakOnline"], r["peakMultiplayer"])
		}
		b.WriteString(`</table>`)
	}
	table("Months", o.Months)
	table("Days (UTC)", o.Days)
	fmt.Fprintf(&b, `<h2>All time</h2><p>%v sessions, %v play minutes, %v min/session, peak online %v</p>`, o.AllTime["sessions"], o.AllTime["playMinutes"], o.AllTime["avgMinutesPerSession"], o.AllTime["peakOnline"])
	_, _ = w.Write([]byte(b.String()))
}
