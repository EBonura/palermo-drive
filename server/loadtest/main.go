// Load test for the relay: N simulated drivers wander around a square of the given size and send
// STATE at 10 Hz. Reports payload bytes per player-minute in each direction (WebSocket headers included,
// TCP/TLS excluded) and how many other players each client saw on average.
//
//	go run ./loadtest -url ws://localhost:8791/ws -n 32 -side 1000 -dur 30s
package main

import (
	"context"
	"flag"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"github.com/coder/websocket"
)

func main() {
	url := flag.String("url", "ws://localhost:8791/ws", "relay url")
	n := flag.Int("n", 32, "simulated clients")
	side := flag.Float64("side", 1000, "side of the square the drivers wander in, metres")
	dur := flag.Duration("dur", 30*time.Second, "test duration")
	rooms := flag.Int("rooms", 1, "spread clients over this many named rooms")
	flag.Parse()

	var rx, tx, rxMsgs, txMsgs, visSum, visN, okClients atomic.Int64
	var wg sync.WaitGroup
	ctx, cancel := context.WithTimeout(context.Background(), *dur+5*time.Second)
	defer cancel()
	stop := time.Now().Add(*dur)
	for i := 0; i < *n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			u := fmt.Sprintf("%s?room=lt%d", *url, i%*rooms)
			c, _, err := websocket.Dial(ctx, u, &websocket.DialOptions{HTTPHeader: map[string][]string{"Origin": {"http://localhost:8790"}}})
			if err != nil {
				fmt.Println("dial:", err)
				return
			}
			defer c.CloseNow()
			okClients.Add(1)
			c.SetReadLimit(2048)
			name := fmt.Sprintf("Bot%02d", i)
			info := append([]byte{0x01, byte(i % 3), byte(len(name))}, name...)
			_ = c.Write(ctx, websocket.MessageBinary, info)
			tx.Add(int64(len(info) + 6))
			go func() {
				for {
					_, d, err := c.Read(ctx)
					if err != nil {
						return
					}
					rx.Add(int64(len(d) + 2))
					rxMsgs.Add(1)
					if len(d) >= 2 && d[0] == 0x24 {
						visSum.Add(int64(d[1]))
						visN.Add(1)
					}
				}
			}()
			r := rand.New(rand.NewSource(int64(i) + 1))
			x, z := (r.Float64()-0.5)*(*side), (r.Float64()-0.5)*(*side)
			th, v := r.Float64()*2*math.Pi, 8+r.Float64()*8
			tk := time.NewTicker(100 * time.Millisecond)
			defer tk.Stop()
			var last [11]byte
			for range tk.C {
				if time.Now().After(stop) {
					return
				}
				th += (r.Float64() - 0.5) * 0.5
				x += math.Sin(th) * v * 0.1
				z += math.Cos(th) * v * 0.1
				h := *side / 2
				if x < -h || x > h || z < -h || z > h { // bounce back towards the centre
					th = math.Atan2(-x, -z)
				}
				xi, zi := int16(x*10), int16(z*10)
				m := [11]byte{0x02, byte(xi), byte(xi >> 8), byte(zi), byte(zi >> 8), byte(th / (2 * math.Pi) * 256), byte(int8(v * 2)), byte(int8(r.Intn(40) - 20)), byte(int8(r.Intn(20) - 10)), 0, 0}
				if m == last {
					continue
				}
				last = m
				if c.Write(ctx, websocket.MessageBinary, m[:]) != nil {
					return
				}
				tx.Add(int64(len(m) + 6))
				txMsgs.Add(1)
			}
		}(i)
	}
	wg.Wait()
	nc := int(okClients.Load())
	pm := float64(nc) * dur.Minutes()
	fmt.Printf("clients=%d side=%.0fm rooms=%d duration=%s\n", nc, *side, *rooms, *dur)
	fmt.Printf("server->client: %.0f B per player-minute (%.1f kB/min, %.0f msgs/min), avg other players per frame %.1f\n",
		float64(rx.Load())/pm, float64(rx.Load())/pm/1000, float64(rxMsgs.Load())/pm, float64(visSum.Load())/math.Max(1, float64(visN.Load())))
	fmt.Printf("client->server: %.0f B per player-minute (%.1f kB/min, %.0f msgs/min)\n", float64(tx.Load())/pm, float64(tx.Load())/pm/1000, float64(txMsgs.Load())/pm)
	fmt.Printf("server egress total: %.1f kB/s for %d clients\n", float64(rx.Load())/dur.Seconds()/1000, nc)
}
