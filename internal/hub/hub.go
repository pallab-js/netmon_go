// Package hub is the runtime core: sampling loops, live rings, alerts and persistence.
package hub

import (
	"fmt"
	"log"
	"sort"
	"strings"
	"sync"
	"time"

	"netscope/internal/collect"
	"netscope/internal/model"
	"netscope/internal/store"
)

const (
	trafficRing    = 180 // 3 minutes at 1 Hz
	latencyRing    = 120 // 4 minutes at 2 s
	maxConns       = 80
	internetTarget = "internet"
	gatewayTarget  = "gw"
)

type trafficBucket struct {
	id      int64
	rxBytes uint64
	txBytes uint64
	rxRate  float64
	txRate  float64
	n       int
}

type latencyBucket struct {
	id    int64
	sum   float64
	min   float64
	max   float64
	loss  float64
	ok    int
	total int
}

type latencyFlush struct {
	target string
	b      latencyBucket
}

type Hub struct {
	st   *store.Store
	emit func(event string, data ...any)

	mu       sync.RWMutex
	traffic  []model.TrafficPoint
	latency  []model.LatencyPoint
	conns    []model.Conn
	devices  map[string]model.Device
	iface    string
	ifaceID  int64
	info     model.IfaceInfo
	ifaces   []string
	gateway  string
	paused   bool
	linkUp   bool
	scanning bool
	latMs    float64
	lossPct  float64

	internetDown bool
	downStreak   int

	sampler *collect.IfaceSampler
	lan     *collect.LAN

	pendingTraffic trafficBucket
	pendingLatency map[string]*latencyBucket
	readyLatency   []latencyFlush

	stop chan struct{}
	done chan struct{}
}

func New(st *store.Store, emit func(event string, data ...any)) *Hub {
	iface := st.GetMeta("iface", "")
	if iface == "" {
		iface = collect.DefaultInterface()
	}
	if iface == "" {
		if names := collect.Names(); len(names) > 0 {
			iface = names[0]
		}
	}
	h := &Hub{
		st:             st,
		emit:           emit,
		traffic:        make([]model.TrafficPoint, 0, trafficRing),
		latency:        make([]model.LatencyPoint, 0, latencyRing),
		devices:        map[string]model.Device{},
		iface:          iface,
		info:           collect.Info(iface),
		ifaces:         collect.Names(),
		gateway:        collect.Gateway(),
		linkUp:         true,
		sampler:        collect.NewIfaceSampler(),
		lan:            collect.NewLAN(),
		pendingLatency: map[string]*latencyBucket{},
		stop:           make(chan struct{}),
		done:           make(chan struct{}),
	}
	if devs, err := st.Devices(); err == nil {
		for _, d := range devs {
			h.devices[d.MAC] = d
		}
	}
	if id, err := st.EnsureInterface(iface, h.info.MAC, time.Now().Unix()); err == nil {
		h.ifaceID = id
	}
	return h
}

func (h *Hub) Start() {
	h.sample()
	h.sampleConns()
	h.probeLatency()
	h.push()
	go h.refreshARP()
	go h.scanLAN()
	go h.run()
}

func (h *Hub) Stop() {
	close(h.stop)
	<-h.done
}

func (h *Hub) run() {
	tick := time.NewTicker(time.Second)
	latTick := time.NewTicker(2 * time.Second)
	connTick := time.NewTicker(2 * time.Second)
	flushTick := time.NewTicker(10 * time.Second)
	arpTick := time.NewTicker(time.Minute)
	sweepTick := time.NewTicker(5 * time.Minute)
	pruneTick := time.NewTicker(6 * time.Hour)
	defer tick.Stop()
	defer latTick.Stop()
	defer connTick.Stop()
	defer flushTick.Stop()
	defer arpTick.Stop()
	defer sweepTick.Stop()
	defer pruneTick.Stop()

	for {
		select {
		case <-h.stop:
			h.flush()
			close(h.done)
			return
		case <-tick.C:
			if !h.Paused() {
				h.sample()
			}
			h.push()
		case <-latTick.C:
			if !h.Paused() {
				h.probeLatency()
			}
		case <-connTick.C:
			if !h.Paused() {
				h.sampleConns()
			}
		case <-flushTick.C:
			h.flush()
		case <-arpTick.C:
			go h.refreshARP()
		case <-sweepTick.C:
			go h.scanLAN()
		case <-pruneTick.C:
			if err := h.st.Prune(); err != nil {
				log.Printf("prune: %v", err)
			}
		}
	}
}

func (h *Hub) sample() {
	h.mu.RLock()
	iface, ifaceID := h.iface, h.ifaceID
	h.mu.RUnlock()

	s, err := h.sampler.Sample(iface)
	if err != nil {
		log.Printf("iface sample: %v", err)
		return
	}
	now := time.Now().Unix()

	var finished *trafficBucket
	h.mu.Lock()
	if s.Name != h.iface {
		h.mu.Unlock()
		return
	}
	wasUp := h.linkUp
	h.linkUp = s.Up
	rx, tx := s.RxRate, s.TxRate
	if !s.Up {
		rx, tx = 0, 0
	}
	h.traffic = appendRing(h.traffic, model.TrafficPoint{T: now, Rx: rx, Tx: tx}, trafficRing)
	if s.Up {
		bucket := now / 10 * 10
		if h.pendingTraffic.n > 0 && h.pendingTraffic.id != bucket {
			prev := h.pendingTraffic
			finished = &prev
			h.pendingTraffic = trafficBucket{}
		}
		p := h.pendingTraffic
		p.id = bucket
		p.rxBytes += s.RxBytes
		p.txBytes += s.TxBytes
		p.rxRate, p.txRate = s.RxRate, s.TxRate
		p.n++
		h.pendingTraffic = p
	}
	h.mu.Unlock()

	if finished != nil {
		h.flushTraffic(ifaceID, *finished)
	}
	if wasUp && !s.Up {
		h.raise("link_down", "Network link is down")
	}
	if !wasUp && s.Up {
		h.raise("link_up", "Network link is back up")
	}
}

func (h *Hub) probeLatency() {
	gw := collect.Gateway()
	hosts := []string{gw, "1.1.1.1"}
	results := make([]collect.Probe, len(hosts))
	var wg sync.WaitGroup
	for i, host := range hosts {
		wg.Add(1)
		go func(i int, host string) {
			defer wg.Done()
			results[i] = collect.ProbeLatency(host, 900*time.Millisecond)
		}(i, host)
	}
	wg.Wait()

	net := results[1]
	now := time.Now().Unix()

	h.mu.Lock()
	h.gateway = gw
	h.latMs = net.Ms
	h.lossPct = net.Loss
	h.latency = appendRing(h.latency, model.LatencyPoint{T: now, Ms: net.Ms, Loss: net.Loss}, latencyRing)
	h.accumulateLatencyLocked(gatewayTarget, results[0], now)
	h.accumulateLatencyLocked(internetTarget, net, now)
	if net.OK {
		h.downStreak = 0
	} else {
		h.downStreak++
	}
	shouldDown := h.downStreak >= 2 && !h.internetDown
	shouldUp := net.OK && h.internetDown
	if shouldDown {
		h.internetDown = true
	}
	if shouldUp {
		h.internetDown = false
	}
	h.mu.Unlock()

	if shouldDown {
		h.raise("net_down", "Internet unreachable (100% packet loss)")
	}
	if shouldUp {
		h.raise("net_up", "Internet reachable again")
	}
}

func (h *Hub) accumulateLatencyLocked(target string, p collect.Probe, now int64) {
	if target == gatewayTarget && h.gateway == "" {
		return
	}
	bucketID := now / 60 * 60
	b, ok := h.pendingLatency[target]
	if !ok {
		b = &latencyBucket{id: bucketID}
		h.pendingLatency[target] = b
	}
	if b.total > 0 && b.id != bucketID {
		h.readyLatency = append(h.readyLatency, latencyFlush{target: target, b: *b})
		b = &latencyBucket{id: bucketID}
		h.pendingLatency[target] = b
	}
	b.total++
	b.loss += p.Loss
	if p.OK {
		b.sum += p.Ms
		b.ok++
		if b.ok == 1 || p.Ms < b.min {
			b.min = p.Ms
		}
		if p.Ms > b.max {
			b.max = p.Ms
		}
	}
}

func (h *Hub) sampleConns() {
	conns := collect.Connections(maxConns)
	h.mu.Lock()
	h.conns = conns
	h.mu.Unlock()
}

func (h *Hub) snapshot() model.Snapshot {
	h.mu.RLock()
	defer h.mu.RUnlock()
	snap := model.Snapshot{
		Iface:         h.info,
		Ifaces:        append([]string(nil), h.ifaces...),
		Paused:        h.paused,
		LinkUp:        h.linkUp,
		Gateway:       h.gateway,
		Conns:         len(h.conns),
		Traffic:       append([]model.TrafficPoint(nil), h.traffic...),
		Latency:       append([]model.LatencyPoint(nil), h.latency...),
		TopConns:      append([]model.Conn(nil), h.conns...),
		LatencyMs:     h.latMs,
		LossPct:       h.lossPct,
		UpdatedAt:     time.Now().Unix(),
		DevicesOnline: h.onlineCountLocked(),
		DevicesTotal:  len(h.devices),
	}
	if n := len(h.traffic); n > 0 {
		snap.RxRate = h.traffic[n-1].Rx
		snap.TxRate = h.traffic[n-1].Tx
	}
	return snap
}

func (h *Hub) push() { h.emitEvent("telemetry:tick", h.snapshot()) }

func (h *Hub) onlineCountLocked() int {
	n := 0
	for _, d := range h.devices {
		if d.Online {
			n++
		}
	}
	return n
}

func (h *Hub) flush() {
	h.mu.Lock()
	traffic := h.pendingTraffic
	h.pendingTraffic = trafficBucket{}
	ifaceID := h.ifaceID
	ready := h.readyLatency
	h.readyLatency = nil
	for target, b := range h.pendingLatency {
		if b.total > 0 {
			ready = append(ready, latencyFlush{target: target, b: *b})
		}
	}
	h.mu.Unlock()

	if traffic.n > 0 {
		h.flushTraffic(ifaceID, traffic)
	}
	for _, lf := range ready {
		h.flushLatency(lf.target, lf.b)
	}
}

func (h *Hub) flushTraffic(ifaceID int64, b trafficBucket) {
	if ifaceID == 0 || b.n == 0 {
		return
	}
	if err := h.st.FlushTraffic(ifaceID, b.id, b.rxBytes, b.txBytes, b.rxRate, b.txRate); err != nil {
		log.Printf("flush traffic: %v", err)
	}
}

func (h *Hub) flushLatency(target string, b latencyBucket) {
	if b.total == 0 {
		return
	}
	avg, min, max := 0.0, 0.0, 0.0
	if b.ok > 0 {
		avg, min, max = b.sum/float64(b.ok), b.min, b.max
	}
	if err := h.st.FlushLatency(target, b.id, avg, min, max, b.loss/float64(b.total)); err != nil {
		log.Printf("flush latency: %v", err)
	}
}

// refreshARP updates IP/MAC/last-seen without a sweep; cheap enough for 60 s.
func (h *Hub) refreshARP() {
	h.mu.RLock()
	iface := h.iface
	known := make(map[string]struct{}, len(h.devices))
	for k := range h.devices {
		known[k] = struct{}{}
	}
	h.mu.RUnlock()

	arp := collect.ARP(iface)
	names := map[string]string{}
	for _, d := range arp {
		key := strings.ToLower(d.MAC)
		if _, ok := known[key]; !ok {
			names[d.IP] = h.lan.Lookup(d.IP)
		}
	}

	now := time.Now().Unix()
	h.mu.Lock()
	changed := make([]model.Device, 0, len(arp))
	for _, d := range arp {
		key := strings.ToLower(d.MAC)
		old, ok := h.devices[key]
		if !ok {
			old = model.Device{MAC: key, FirstSeen: now, Hostname: names[d.IP]}
		}
		old.IP = d.IP
		old.LastSeen = now
		old.Online = true
		h.devices[key] = old
		changed = append(changed, old)
	}
	h.mu.Unlock()

	if len(changed) == 0 {
		return
	}
	if err := h.st.UpsertDevices(changed); err != nil {
		log.Printf("upsert arp: %v", err)
	}
	h.emitEvent("devices:update", h.Devices())
}

func (h *Hub) scanLAN() {
	h.mu.Lock()
	if h.scanning {
		h.mu.Unlock()
		return
	}
	h.scanning = true
	iface := h.iface
	h.mu.Unlock()

	defer func() {
		h.mu.Lock()
		h.scanning = false
		h.mu.Unlock()
		h.emitEvent("scan:progress", model.ScanProgress{Running: false})
	}()

	hosts := collect.SweepHosts(iface)
	h.emitEvent("scan:progress", model.ScanProgress{Done: 0, Total: len(hosts), Running: true})
	results := collect.Sweep(hosts, 32, func(done, total int) {
		if done%8 == 0 || done == total {
			h.emitEvent("scan:progress", model.ScanProgress{Done: done, Total: total, Running: true})
		}
	})

	now := time.Now().Unix()
	found := map[string]model.Device{}
	byIP := map[string]string{}
	for _, d := range collect.ARP(iface) {
		mac := strings.ToLower(d.MAC)
		byIP[d.IP] = mac
		found[mac] = model.Device{MAC: mac, IP: d.IP, Online: true}
	}
	for ip, p := range results {
		if !p.OK {
			continue
		}
		mac, ok := byIP[ip]
		if !ok || mac == "" {
			mac = "ip-" + ip
		}
		d := found[mac]
		d.MAC = mac
		d.IP = ip
		d.Online = true
		found[mac] = d
	}
	if info := collect.Info(iface); info.MAC != "" && info.IP != "" {
		key := strings.ToLower(info.MAC)
		found[key] = model.Device{MAC: key, IP: info.IP, Hostname: collect.Hostname(), Online: true}
	}

	// Reverse DNS is best-effort and capped so a scan stays fast.
	lookups := 0
	for key, d := range found {
		if d.IP == "" || d.Hostname != "" || lookups >= 16 {
			continue
		}
		if name := h.lan.Lookup(d.IP); name != "" {
			d.Hostname = name
			found[key] = d
		}
		lookups++
	}

	h.mu.Lock()
	old := h.devices
	next := make(map[string]model.Device, len(old)+len(found))
	for key, d := range old {
		d.Online = false
		next[key] = d
	}
	newDevices := make([]string, 0, 4)
	for key, d := range found {
		if prev, ok := old[key]; ok {
			d.FirstSeen = prev.FirstSeen
			if d.Hostname == "" {
				d.Hostname = prev.Hostname
			}
		} else {
			d.FirstSeen = now
			newDevices = append(newDevices, displayName(d))
		}
		d.LastSeen = now
		d.Online = true
		next[key] = d
	}
	h.devices = next
	list := h.devicesLocked()
	h.mu.Unlock()

	if err := h.st.UpsertDevices(list); err != nil {
		log.Printf("upsert devices: %v", err)
	}
	h.emitEvent("devices:update", list)
	if len(newDevices) > 0 {
		h.raise("device_new", fmt.Sprintf("New device on the network: %s", strings.Join(newDevices, ", ")))
	}
}

func displayName(d model.Device) string {
	if d.Hostname != "" {
		return d.Hostname
	}
	if d.IP != "" {
		return d.IP
	}
	return d.MAC
}

func (h *Hub) devicesLocked() []model.Device {
	out := make([]model.Device, 0, len(h.devices))
	for _, d := range h.devices {
		out = append(out, d)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Online != out[j].Online {
			return out[i].Online
		}
		return out[i].LastSeen > out[j].LastSeen
	})
	return out
}

func (h *Hub) raise(kind, msg string) {
	if err := h.st.InsertEvent(kind, msg); err != nil {
		log.Printf("event: %v", err)
	}
	h.emitEvent("alert", model.Alert{T: time.Now().Unix(), Kind: kind, Message: msg})
}

func (h *Hub) emitEvent(name string, data ...any) {
	if h.emit != nil {
		h.emit(name, data...)
	}
}

// --- public API used by the bound App ---

func (h *Hub) Snapshot() model.Snapshot { return h.snapshot() }

func (h *Hub) Paused() bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.paused
}

func (h *Hub) SetPaused(p bool) {
	h.mu.Lock()
	h.paused = p
	h.mu.Unlock()
	if !p {
		h.sampler.Reset()
	}
	h.push()
}

func (h *Hub) SetInterface(name string) error {
	if name == "" {
		return fmt.Errorf("interface name is empty")
	}
	info := collect.Info(name)
	if info.Name == "" {
		return fmt.Errorf("interface %q not found", name)
	}
	id, err := h.st.EnsureInterface(name, info.MAC, time.Now().Unix())
	if err != nil {
		return err
	}
	h.sampler.Reset()
	h.mu.Lock()
	h.iface = name
	h.ifaceID = id
	h.info = info
	h.ifaces = collect.Names()
	h.gateway = collect.Gateway()
	h.traffic = h.traffic[:0]
	h.pendingTraffic = trafficBucket{}
	h.mu.Unlock()
	_ = h.st.SetMeta("iface", name)
	h.push()
	go h.scanLAN()
	return nil
}

func (h *Hub) Devices() []model.Device {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.devicesLocked()
}

func (h *Hub) Conns() []model.Conn {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return append([]model.Conn(nil), h.conns...)
}

func (h *Hub) Scanning() bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.scanning
}

// Scan starts a LAN sweep in the background; a sweep already running is a no-op.
func (h *Hub) Scan() { go h.scanLAN() }

func (h *Hub) History(from, to int64) model.History {
	if to <= 0 {
		to = time.Now().Unix()
	}
	if from <= 0 || from >= to {
		from = to - 3600
	}
	step := int64(10)
	switch span := to - from; {
	case span > 7*86400:
		step = 3600
	case span > 6*3600:
		step = 600
	case span > 3600:
		step = 60
	}
	h.mu.RLock()
	ifaceID := h.ifaceID
	h.mu.RUnlock()

	hist := model.History{From: from, To: to, Step: step}
	traffic, err := h.st.Traffic(ifaceID, from, to, step)
	if err != nil {
		log.Printf("history traffic: %v", err)
	}
	lat, err := h.st.Latency(internetTarget, from, to, step)
	if err != nil {
		log.Printf("history latency: %v", err)
	}

	hist.Traffic = traffic
	hist.Latency = lat
	latSum, latCount := 0.0, 0
	for _, r := range traffic {
		hist.RxBytes += r.Rx * float64(step)
		hist.TxBytes += r.Tx * float64(step)
		if r.Rx > hist.PeakRx {
			hist.PeakRx = r.Rx
		}
		if r.Tx > hist.PeakTx {
			hist.PeakTx = r.Tx
		}
	}
	for _, r := range lat {
		if r.Avg > 0 {
			latSum += r.Avg
			latCount++
		}
		if r.Loss > hist.MaxLoss {
			hist.MaxLoss = r.Loss
		}
	}
	if latCount > 0 {
		hist.AvgMs = latSum / float64(latCount)
	}
	return hist
}

func (h *Hub) Events(limit int) []model.Event {
	evts, err := h.st.Events(limit)
	if err != nil {
		log.Printf("events: %v", err)
		return nil
	}
	return evts
}

func appendRing[T any](ring []T, v T, max int) []T {
	if len(ring) >= max {
		copy(ring, ring[1:])
		ring[len(ring)-1] = v
		return ring
	}
	return append(ring, v)
}
