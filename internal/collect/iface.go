// Package collect gathers interface throughput, latency, connections and LAN devices.
package collect

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"
	"time"

	gnet "github.com/shirou/gopsutil/v4/net"

	"netscope/internal/model"
)

// 100 Gbit/s sanity clamp: anything above this is a counter glitch, not traffic.
const maxRate = 12.5e9

// Sample is one interface reading. RxBytes/TxBytes are deltas since the previous sample.
type Sample struct {
	Name    string
	Up      bool
	RxBytes uint64
	TxBytes uint64
	RxRate  float64
	TxRate  float64
}

type IfaceSampler struct {
	prevRx map[string]uint64
	prevTx map[string]uint64
	prevAt map[string]time.Time
}

func NewIfaceSampler() *IfaceSampler {
	return &IfaceSampler{
		prevRx: map[string]uint64{},
		prevTx: map[string]uint64{},
		prevAt: map[string]time.Time{},
	}
}

// Reset forgets previous counters so the next sample reports zero instead of a spike.
func (s *IfaceSampler) Reset() {
	s.prevRx = map[string]uint64{}
	s.prevTx = map[string]uint64{}
	s.prevAt = map[string]time.Time{}
}

func (s *IfaceSampler) Sample(name string) (Sample, error) {
	stats, err := gnet.IOCounters(true)
	if err != nil {
		return Sample{Name: name}, err
	}
	var cur *gnet.IOCountersStat
	for i := range stats {
		if stats[i].Name == name {
			cur = &stats[i]
			break
		}
	}
	if cur == nil {
		return Sample{Name: name}, nil
	}

	now := time.Now()
	first := false
	dt := 0.0
	if at, ok := s.prevAt[name]; ok {
		dt = now.Sub(at).Seconds()
	} else {
		first = true
	}
	rxDelta, rxRate := rate(s.prevRx[name], cur.BytesRecv, first, dt)
	txDelta, txRate := rate(s.prevTx[name], cur.BytesSent, first, dt)

	s.prevRx[name] = cur.BytesRecv
	s.prevTx[name] = cur.BytesSent
	s.prevAt[name] = now

	up := true
	if ni, err := net.InterfaceByName(name); err == nil {
		up = ni.Flags&net.FlagUp != 0
	}
	return Sample{Name: name, Up: up, RxBytes: rxDelta, TxBytes: txDelta, RxRate: rxRate, TxRate: txRate}, nil
}

// rate converts counter deltas to bytes/sec. A counter that went backwards means the
// NIC was reset, so the new value is the delta (never a negative burst).
func rate(prev, cur uint64, first bool, dt float64) (uint64, float64) {
	if first {
		return 0, 0
	}
	delta := cur - prev
	if cur < prev {
		delta = cur
	}
	if dt <= 0 {
		return delta, 0
	}
	bps := float64(delta) / dt
	if bps > maxRate {
		bps = maxRate
	}
	return delta, bps
}

// DefaultInterface reads the default route from /proc/net/route.
func DefaultInterface() string {
	f, err := os.Open("/proc/net/route")
	if err != nil {
		return ""
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Scan() // header
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) < 8 {
			continue
		}
		if fields[1] == "00000000" && fields[7] == "00000000" {
			return fields[0]
		}
	}
	return ""
}

// Gateway returns the default gateway IPv4 as a string.
func Gateway() string {
	f, err := os.Open("/proc/net/route")
	if err != nil {
		return ""
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Scan()
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) < 4 || fields[1] != "00000000" {
			continue
		}
		if ip := hexToIP(fields[2]); ip != "" {
			return ip
		}
	}
	return ""
}

func hexToIP(h string) string {
	if len(h) != 8 {
		return ""
	}
	v, err := strconv.ParseUint(h, 16, 32)
	if err != nil {
		return ""
	}
	return fmt.Sprintf("%d.%d.%d.%d", v&0xff, (v>>8)&0xff, (v>>16)&0xff, (v>>24)&0xff)
}

// Names lists interfaces worth showing: up and non-loopback.
func Names() []string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	out := make([]string, 0, 4)
	for _, ni := range ifaces {
		if ni.Flags&net.FlagLoopback != 0 || ni.Flags&net.FlagUp == 0 {
			continue
		}
		out = append(out, ni.Name)
	}
	return out
}

func Info(name string) model.IfaceInfo {
	info := model.IfaceInfo{Name: name}
	ni, err := net.InterfaceByName(name)
	if err != nil {
		return info
	}
	info.MTU = ni.MTU
	info.MAC = ni.HardwareAddr.String()
	addrs, _ := ni.Addrs()
	for _, a := range addrs {
		ip, _, err := net.ParseCIDR(a.String())
		if err != nil || ip.To4() == nil {
			continue
		}
		info.IP = ip.String()
		break
	}
	if b, err := os.ReadFile("/sys/class/net/" + name + "/speed"); err == nil {
		if mbps, err := strconv.ParseUint(strings.TrimSpace(string(b)), 10, 64); err == nil && mbps > 0 && mbps < 1_000_000 {
			info.Speed = mbps * 1_000_000
		}
	}
	return info
}

// IPv4 returns the first IPv4 address of the interface.
func IPv4(name string) string {
	ni, err := net.InterfaceByName(name)
	if err != nil {
		return ""
	}
	addrs, _ := ni.Addrs()
	for _, a := range addrs {
		ip, _, err := net.ParseCIDR(a.String())
		if err == nil && ip.To4() != nil {
			return ip.String()
		}
	}
	return ""
}

// SweepHosts returns up to 254 usable IPv4 addresses on the interface subnet.
// Larger subnets are capped so a scan stays quick; this is a local tool, not a scanner.
func SweepHosts(name string) []string {
	ni, err := net.InterfaceByName(name)
	if err != nil {
		return nil
	}
	addrs, _ := ni.Addrs()
	for _, a := range addrs {
		ip, ipnet, err := net.ParseCIDR(a.String())
		if err != nil || ip.To4() == nil {
			continue
		}
		ones, bits := ipnet.Mask.Size()
		if bits != 32 {
			continue
		}
		hostBits := 32 - ones
		if hostBits < 2 {
			return nil
		}
		if hostBits > 8 {
			hostBits = 8 // cap at a /24 worth of hosts
		}
		base := ip.Mask(ipnet.Mask).To4()
		size := 1 << hostBits
		out := make([]string, 0, size-2)
		start := uint32(base[0])<<24 | uint32(base[1])<<16 | uint32(base[2])<<8 | uint32(base[3])
		for i := 1; i < size-1; i++ {
			v := start + uint32(i)
			out = append(out, net.IPv4(byte(v>>24), byte(v>>16), byte(v>>8), byte(v)).String())
		}
		return out
	}
	return nil
}

// Hostname is this machine's name.
func Hostname() string {
	h, err := os.Hostname()
	if err != nil {
		return ""
	}
	return h
}
