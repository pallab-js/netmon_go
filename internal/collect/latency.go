package collect

import (
	"io"
	"log"
	"time"

	probing "github.com/prometheus-community/pro-bing"
)

type Probe struct {
	Ms   float64
	Loss float64
	OK   bool
}

// ProbeLatency sends a single unprivileged ICMP echo (UDP mode, no root needed).
func ProbeLatency(host string, timeout time.Duration) Probe {
	if host == "" {
		return Probe{Loss: 100}
	}
	p := probing.New(host)
	p.SetPrivileged(false)
	p.SetLogger(probing.StdLogger{Logger: log.New(io.Discard, "", 0)})
	p.Count = 1
	p.Timeout = timeout

	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = p.Run()
	}()
	select {
	case <-done:
	case <-time.After(timeout + 500*time.Millisecond):
		p.Stop()
		<-done
	}

	st := p.Statistics()
	if st == nil || st.PacketsRecv == 0 {
		return Probe{Loss: 100}
	}
	return Probe{Ms: float64(st.AvgRtt.Microseconds()) / 1000, Loss: st.PacketLoss, OK: true}
}
