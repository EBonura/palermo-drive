// Palermo Drive relay: a tiny in-memory WebSocket fan-out. No database, no persistence, one process.
// Run a single instance (Cloud Run max-instances=1) so every player shares the same state. See protocol.go.
package main

import (
	"context"
	"flag"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/coder/websocket"
)

type config struct {
	radius      float64       // metres within which players see each other
	tick        time.Duration // server send rate cap (one frame per receiver per tick)
	maxConns    int           // total connections across rooms
	perIP       int           // connections per client IP
	idleTimeout time.Duration // no message at all
	afkTimeout  time.Duration // no STATE message (stationary or paused client)
	maxSession  time.Duration // below Cloud Run's 60 minute request limit
	filter      bool
	origins     []string
}

const (
	closeIdle    websocket.StatusCode = 4001 // clients must not auto-reconnect until the player moves
	closeRefresh websocket.StatusCode = 4002 // session limit reached, reconnect straight away
	closeCap     websocket.StatusCode = 4003 // monthly free-tier cap reached: single player until the month rolls over
)

type player struct {
	id     uint8
	conn   *websocket.Conn
	out    chan []byte
	room   *room
	joined time.Time

	// guarded by hub.mu
	name     string
	livery   uint8
	infoVer  uint32
	hasInfo  bool
	st       [stateLen]byte
	x, z     float64 // metres
	hasPos   bool
	ver      uint32
	lastOut  time.Time
	lastInfo time.Time

	known    [maxPlayers]uint32 // infoVer of each sender that this receiver was told about (0 = not known)
	sentVer  [maxPlayers]uint32
	lastTick [maxPlayers]uint32

	// reader goroutine only
	tokens    float64
	tokenTime time.Time
	strikes   int
	dropped   atomic.Int32
	lastState atomic.Int64 // unix nanos
	closing   atomic.Bool
}

type room struct {
	key        string
	slots      [maxPlayers]*player
	count      int
	countDirty bool
	nextInfo   uint32
}

type hub struct {
	cfg   config
	st    *Stats
	mu    sync.Mutex
	rooms map[string]*room
	ips   map[string]int
	total atomic.Int64
}

func newHub(cfg config, st *Stats) *hub {
	return &hub{cfg: cfg, st: st, rooms: map[string]*room{}, ips: map[string]int{}}
}

func (p *player) send(msg []byte) {
	select {
	case p.out <- msg:
		p.lastOut = time.Now()
	default:
		if p.dropped.Add(1) > 200 { // a client that cannot keep up is not worth the memory
			p.kick(websocket.StatusPolicyViolation, "too slow")
		}
	}
}

func (p *player) kick(code websocket.StatusCode, reason string) {
	if p.closing.CompareAndSwap(false, true) {
		go func() { _ = p.conn.Close(code, reason) }()
	}
}

// ---------- room management (callers hold hub.mu) ----------

func (h *hub) join(base string, p *player) {
	for n := 1; ; n++ {
		key := base + "#" + itoa(n)
		r := h.rooms[key]
		if r == nil {
			r = &room{key: key, nextInfo: 1}
			h.rooms[key] = r
		}
		if r.count >= maxPlayers {
			continue
		}
		for i := range r.slots {
			if r.slots[i] == nil {
				p.id = uint8(i)
				p.room = r
				r.slots[i] = p
				r.count++
				r.countDirty = true
				return
			}
		}
	}
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [8]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}

func (h *hub) leave(p *player) {
	h.mu.Lock()
	defer h.mu.Unlock()
	r := p.room
	if r == nil || r.slots[p.id] != p {
		return
	}
	r.slots[p.id] = nil
	r.count--
	r.countDirty = true
	for _, o := range r.slots {
		if o != nil && o.known[p.id] != 0 {
			o.send([]byte{sRemove, p.id})
			o.known[p.id] = 0
			o.sentVer[p.id] = 0
		}
	}
	if r.count == 0 {
		delete(h.rooms, r.key)
	}
}

// ---------- tick: interest management and batched fan-out ----------

func (h *hub) tick(now time.Time, tickNo uint32) {
	enter2 := h.cfg.radius * h.cfg.radius
	leave2 := enter2 * 1.3 // hysteresis so a player at the edge doesn't flicker
	near2, mid2 := 150.0*150.0, 300.0*300.0
	h.mu.Lock()
	defer h.mu.Unlock()
	scratch := make([]byte, 0, 2+maxPlayers*(1+stateLen))
	for _, r := range h.rooms {
		for _, rc := range r.slots {
			if rc == nil {
				continue
			}
			if !rc.hasInfo {
				if now.Sub(rc.joined) > 10*time.Second {
					rc.kick(websocket.StatusPolicyViolation, "no info")
				}
				continue
			}
			scratch = append(scratch[:0], sStates, 0)
			n := 0
			if rc.hasPos {
				for _, s := range r.slots {
					if s == nil || s == rc || !s.hasInfo || !s.hasPos {
						continue
					}
					dx, dz := s.x-rc.x, s.z-rc.z
					d2 := dx*dx + dz*dz
					k := rc.known[s.id]
					lim := enter2
					if k != 0 {
						lim = leave2
					}
					if d2 > lim {
						if k != 0 {
							rc.send([]byte{sRemove, s.id})
							rc.known[s.id], rc.sentVer[s.id] = 0, 0
						}
						continue
					}
					if k != s.infoVer {
						rc.send(infoMsg(s))
						rc.known[s.id], rc.sentVer[s.id] = s.infoVer, 0
					}
					if s.ver == rc.sentVer[s.id] {
						continue
					}
					gap := uint32(1) // distant players are sent less often
					if d2 > mid2 {
						gap = 4
					} else if d2 > near2 {
						gap = 2
					}
					if rc.sentVer[s.id] != 0 && tickNo-rc.lastTick[s.id] < gap {
						continue
					}
					scratch = append(scratch, s.id)
					scratch = append(scratch, s.st[:]...)
					rc.sentVer[s.id], rc.lastTick[s.id] = s.ver, tickNo
					n++
				}
			}
			if n > 0 {
				scratch[1] = byte(n)
				rc.send(append([]byte(nil), scratch...))
			}
			if r.countDirty {
				rc.send([]byte{sCount, byte(r.count)})
			}
			if now.Sub(rc.lastOut) > 10*time.Second {
				rc.send([]byte{sBeat})
			}
		}
		r.countDirty = false
	}
}

func infoMsg(s *player) []byte {
	m := make([]byte, 0, 4+len(s.name))
	m = append(m, sInfo, s.id, s.livery, byte(len(s.name)))
	return append(m, s.name...)
}

// ---------- HTTP and WebSocket ----------

func clientIP(r *http.Request) string {
	// Behind Cloud Run the Google front end appends the real client address at the end of X-Forwarded-For.
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[len(parts)-1])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func cleanRoom(s string) string {
	var b []byte
	for _, c := range []byte(strings.ToLower(s)) {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_' {
			b = append(b, c)
		}
		if len(b) >= 16 {
			break
		}
	}
	if len(b) == 0 {
		return "main"
	}
	return string(b)
}

func (h *hub) serveWS(w http.ResponseWriter, r *http.Request) {
	if !h.st.allowWS() { // monthly free-tier cap: clients fall back to single player
		http.Error(w, "multiplayer paused", http.StatusServiceUnavailable)
		return
	}
	ip := clientIP(r)
	h.mu.Lock()
	if h.ips[ip] >= h.cfg.perIP || int(h.total.Load()) >= h.cfg.maxConns {
		h.mu.Unlock()
		http.Error(w, "busy", http.StatusTooManyRequests)
		return
	}
	h.ips[ip]++
	h.total.Add(1)
	h.mu.Unlock()
	defer func() {
		h.mu.Lock()
		if h.ips[ip]--; h.ips[ip] <= 0 {
			delete(h.ips, ip)
		}
		h.mu.Unlock()
		h.total.Add(-1)
	}()

	c, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: h.cfg.origins, CompressionMode: websocket.CompressionDisabled})
	if err != nil {
		return
	}
	c.SetReadLimit(80)
	ctx, cancel := context.WithTimeout(r.Context(), h.cfg.maxSession)
	defer cancel()

	p := &player{conn: c, out: make(chan []byte, 32), joined: time.Now(), tokens: 40, tokenTime: time.Now(), lastOut: time.Now()}
	p.lastState.Store(time.Now().UnixNano())
	h.mu.Lock()
	h.join(cleanRoom(r.URL.Query().Get("room")), p)
	h.mu.Unlock()
	h.st.wsOpen()
	defer func() { h.st.wsClose(); h.leave(p); _ = c.CloseNow() }()

	go func() { // writer
		for {
			select {
			case <-ctx.Done():
				return
			case m := <-p.out:
				wctx, wcancel := context.WithTimeout(ctx, 5*time.Second)
				err := c.Write(wctx, websocket.MessageBinary, m)
				wcancel()
				if err != nil {
					_ = c.CloseNow()
					return
				}
				h.st.addEgress(len(m) + 2 + 40) // payload, WebSocket header, rough TCP/TLS share
			}
		}
	}()
	p.out <- []byte{sWelcome, protoVersion, p.id, maxPlayers}

	for {
		rctx, rcancel := context.WithTimeout(ctx, h.cfg.idleTimeout)
		_, data, err := c.Read(rctx)
		rcancel()
		if err != nil {
			if ctx.Err() != nil && r.Context().Err() == nil { // our session limit, not the client's choice
				_ = c.Close(closeRefresh, "session limit")
			}
			return
		}
		now := time.Now()
		p.tokens += now.Sub(p.tokenTime).Seconds() * 25
		if p.tokens > 40 {
			p.tokens = 40
		}
		p.tokenTime = now
		if p.tokens < 1 {
			if p.strikes++; p.strikes > 300 {
				_ = c.Close(websocket.StatusPolicyViolation, "rate limit")
				return
			}
			continue
		}
		p.tokens--
		if len(data) == 0 {
			continue
		}
		switch data[0] {
		case cState:
			if len(data) != 1+stateLen {
				continue
			}
			x := float64(int16(uint16(data[1])|uint16(data[2])<<8)) / 10
			z := float64(int16(uint16(data[3])|uint16(data[4])<<8)) / 10
			p.lastState.Store(now.UnixNano())
			h.mu.Lock()
			copy(p.st[:], data[1:])
			p.x, p.z, p.hasPos = x, z, true
			p.ver++
			h.mu.Unlock()
		case cInfo:
			if len(data) < 3 || int(data[2]) != len(data)-3 {
				continue
			}
			name := cleanName(data[3:])
			if name == "" || (h.cfg.filter && isBlocked(name)) {
				name = "Ospite"
			}
			livery := data[1]
			if livery > maxLivery {
				livery = 0
			}
			h.mu.Lock()
			if p.hasInfo && now.Sub(p.lastInfo) < 2*time.Second { // name spam
				h.mu.Unlock()
				continue
			}
			if !p.hasInfo || p.name != name || p.livery != livery {
				p.name, p.livery = name, livery
				p.infoVer = p.room.nextInfo
				p.room.nextInfo++
				if !p.hasInfo {
					p.hasInfo = true
					p.room.countDirty = true
				}
			}
			p.lastInfo = now
			h.mu.Unlock()
		case cPing:
		default:
			if p.strikes++; p.strikes > 300 {
				_ = c.Close(websocket.StatusPolicyViolation, "bad message")
				return
			}
		}
		if time.Duration(now.UnixNano()-p.lastState.Load()) > h.cfg.afkTimeout {
			_ = c.Close(closeIdle, "idle")
			return
		}
	}
}

// closeAll disconnects every client (SIGTERM during a deploy, or the hard usage cap).
func (h *hub) closeAll(code websocket.StatusCode, reason string) {
	h.mu.Lock()
	var ps []*player
	for _, r := range h.rooms {
		for _, p := range r.slots {
			if p != nil {
				ps = append(ps, p)
			}
		}
	}
	h.mu.Unlock()
	for _, p := range ps {
		p.kick(code, reason)
	}
}

func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func envF(k string, d float64) float64 {
	if v, err := strconv.ParseFloat(os.Getenv(k), 64); err == nil {
		return v
	}
	return d
}

func main() {
	cfg := config{}
	addr := flag.String("addr", ":"+env("PORT", "8080"), "listen address (Cloud Run sets PORT)")
	flag.Float64Var(&cfg.radius, "radius", 400, "interest radius in metres")
	flag.DurationVar(&cfg.tick, "tick", 100*time.Millisecond, "server send interval")
	flag.IntVar(&cfg.maxConns, "max-conns", 256, "total connection cap")
	flag.IntVar(&cfg.perIP, "per-ip", 6, "connections per client IP")
	flag.DurationVar(&cfg.idleTimeout, "idle-timeout", 45*time.Second, "close a connection that sends nothing for this long")
	flag.DurationVar(&cfg.afkTimeout, "afk-timeout", 3*time.Minute, "close a connection that sends no position for this long")
	flag.DurationVar(&cfg.maxSession, "max-session", 55*time.Minute, "close sessions before Cloud Run's 60 minute request limit")
	origins := flag.String("origins", env("ALLOWED_ORIGINS", "ebonura.github.io,localhost:*,127.0.0.1:*"), "comma separated allowed Origin hosts (patterns)")
	filter := flag.Bool("filter", env("NAME_FILTER", "on") != "off", "small name block list")
	dataDir := flag.String("data", env("DATA_DIR", ""), "persist stats in this directory (local runs, VM); on Cloud Run Firestore is used")
	var sc statsCfg
	flag.StringVar(&sc.key, "stats-key", os.Getenv("STATS_KEY"), "secret for GET /stats?key=... (empty disables /stats)")
	flag.Float64Var(&sc.cpu, "cpu", envF("CPU", 1), "vCPUs of the Cloud Run instance (free tier accounting)")
	flag.Float64Var(&sc.memGiB, "mem-gib", envF("MEM_GIB", 0.5), "memory of the instance in GiB (free tier accounting)")
	capPct := flag.Float64("cap-pct", envF("CAP_PCT", 70), "stop accepting WebSockets at this percent of the monthly free tier")
	hardPct := flag.Float64("hard-pct", envF("HARD_PCT", 85), "disconnect everybody at this percent")
	egressMiB := flag.Float64("egress-free-mib", envF("EGRESS_FREE_MIB", 1024), "free egress per month in MiB (1024 in North American regions; 0 = ignore)")
	flag.Parse()
	cfg.filter = *filter
	cfg.origins = strings.Split(*origins, ",")
	sc.capPct, sc.hardPct, sc.egressFree = *capPct/100, *hardPct/100, int64(*egressMiB*1048576)

	var store Store = &memStore{}
	switch {
	case *dataDir != "":
		store = fileStore{*dataDir}
	case os.Getenv("K_SERVICE") != "": // running on Cloud Run
		fs, err := newFirestoreStore()
		if err != nil {
			log.Printf("firestore unavailable, stats will not persist: %v", err)
		} else {
			store = fs
		}
	}
	st := NewStats(store, sc)
	h := newHub(cfg, st)
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", h.serveWS)
	mux.HandleFunc("/ping", st.servePing)
	mux.HandleFunc("/stats", st.serveStats)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("ok")) })
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte("Palermo Drive relay\n"))
	})
	counted := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { st.addRequest(); mux.ServeHTTP(w, r) })
	srv := &http.Server{Addr: *addr, Handler: counted, ReadHeaderTimeout: 10 * time.Second}

	go func() {
		t := time.NewTicker(cfg.tick)
		defer t.Stop()
		var n uint32
		for now := range t.C {
			n++
			h.tick(now, n)
		}
	}()
	go func() { // usage accounting, stats flush (at most once a minute) and the hard usage cap
		t := time.NewTicker(time.Second)
		defer t.Stop()
		for now := range t.C {
			if st.tick(now) {
				h.closeAll(closeCap, "cap")
			}
		}
	}()

	done := make(chan struct{})
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGTERM, syscall.SIGINT)
		<-sig
		log.Println("shutting down")
		h.closeAll(websocket.StatusGoingAway, "restart")
		st.Flush()
		time.Sleep(500 * time.Millisecond)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(ctx)
		close(done)
	}()
	log.Printf("palermo-drive relay listening on %s (radius %.0f m, tick %s)", *addr, cfg.radius, cfg.tick)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
	<-done
}
