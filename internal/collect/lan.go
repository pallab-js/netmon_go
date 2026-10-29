package collect

import (
	"bufio"
	"context"
	"net"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"netscope/internal/model"
)

type LAN struct {
	mu    sync.Mutex
	cache map[string]cacheEntry
}

type cacheEntry struct {
	host string
	at   time.Time
}

func NewLAN() *LAN { return &LAN{cache: map[string]cacheEntry{}} }

// ARP reads the kernel neighbour table; read-only and instant.
func ARP(iface string) []model.Device {
	f, err := os.Open("/proc/net/arp")
	if err != nil {
		return nil
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Scan() // header
	out := make([]model.Device, 0, 16)
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) < 6 {
			continue
		}
		ip, hw, flags, dev := fields[0], fields[3], fields[2], fields[5]
		if iface != "" && dev != iface {
			continue
		}
		if flags == "0x0" || hw == "00:00:00:00:00:00" {
			continue
		}
		out = append(out, model.Device{MAC: strings.ToLower(hw), IP: ip, Online: true})
	}
	return out
}

// Sweep pings every host with a bounded worker pool and reports progress.
func Sweep(hosts []string, concurrency int, progress func(done, total int)) map[string]Probe {
	if concurrency < 1 {
		concurrency = 32
	}
	var mu sync.Mutex
	results := make(map[string]Probe, len(hosts))
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	var done atomic.Int32

	for _, h := range hosts {
		wg.Add(1)
		sem <- struct{}{}
		go func(host string) {
			defer wg.Done()
			defer func() { <-sem }()
			p := ProbeLatency(host, 600*time.Millisecond)
			mu.Lock()
			results[host] = p
			mu.Unlock()
			if progress != nil {
				progress(int(done.Add(1)), len(hosts))
			}
		}(h)
	}
	wg.Wait()
	return results
}

// Lookup resolves a hostname with a hard 300 ms budget, cached for a day.
func (l *LAN) Lookup(ip string) string {
	l.mu.Lock()
	if e, ok := l.cache[ip]; ok && time.Since(e.at) < 24*time.Hour {
		l.mu.Unlock()
		return e.host
	}
	l.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()
	names, err := net.DefaultResolver.LookupAddr(ctx, ip)
	host := ""
	if err == nil && len(names) > 0 {
		host = strings.TrimSuffix(names[0], ".")
	}

	l.mu.Lock()
	l.cache[ip] = cacheEntry{host: host, at: time.Now()}
	l.mu.Unlock()
	return host
}
