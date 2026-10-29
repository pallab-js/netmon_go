package collect

import (
	"fmt"
	"net"
	"sort"
	"sync"

	gnet "github.com/shirou/gopsutil/v4/net"
	"github.com/shirou/gopsutil/v4/process"

	"netscope/internal/model"
)

var procNames = struct {
	sync.Mutex
	m map[int32]string
}{m: map[int32]string{}}

func procName(pid int32) string {
	if pid <= 0 {
		return ""
	}
	procNames.Lock()
	if n, ok := procNames.m[pid]; ok {
		procNames.Unlock()
		return n
	}
	procNames.Unlock()

	name := ""
	if p, err := process.NewProcess(pid); err == nil {
		if n, err := p.Name(); err == nil {
			name = n
		}
	}
	procNames.Lock()
	procNames.m[pid] = name
	procNames.Unlock()
	return name
}

func proto(family, typ uint32) string {
	base := "tcp"
	if typ == 2 { // SOCK_DGRAM
		base = "udp"
	}
	if family == 10 { // AF_INET6
		return base + "6"
	}
	return base
}

// Connections lists system sockets. Process names are only available for the
// current user's processes without root; others show as unknown.
func Connections(limit int) []model.Conn {
	stats, err := gnet.Connections("all")
	if err != nil {
		return nil
	}
	seen := make(map[string]struct{}, len(stats))
	out := make([]model.Conn, 0, limit)
	for _, c := range stats {
		p := proto(c.Family, c.Type)
		local := net.JoinHostPort(c.Laddr.IP, fmt.Sprint(c.Laddr.Port))
		remote := ""
		if c.Raddr.IP != "" {
			remote = net.JoinHostPort(c.Raddr.IP, fmt.Sprint(c.Raddr.Port))
		}
		key := p + "|" + local + "|" + remote
		if _, dup := seen[key]; dup {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, model.Conn{
			PID:     c.Pid,
			Process: procName(c.Pid),
			Proto:   p,
			Local:   local,
			Remote:  remote,
			State:   c.Status,
		})
	}

	rank := func(s string) int {
		switch s {
		case "ESTABLISHED":
			return 0
		case "SYN_SENT", "SYN_RECV":
			return 1
		case "LISTEN":
			return 2
		case "NONE":
			return 3
		default:
			return 4
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		ri, rj := rank(out[i].State), rank(out[j].State)
		if ri != rj {
			return ri < rj
		}
		return out[i].Remote > out[j].Remote
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}
