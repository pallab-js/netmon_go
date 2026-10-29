package capture

import (
	"fmt"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/pcap"
)

type Packet struct {
	T       int64  `json:"t"`
	Proto   string `json:"proto"`
	Src     string `json:"src"`
	Dst     string `json:"dst"`
	Length  int    `json:"length"`
	Info    string `json:"info"`
}

type Capturer struct {
	iface  string
	handle *pcap.Handle
	out    chan Packet
	stop   chan struct{}
}

func New(iface string) *Capturer {
	return &Capturer{iface: iface, out: make(chan Packet, 1024), stop: make(chan struct{})}
}

func (c *Capturer) Packets() <-chan Packet { return c.out }

func (c *Capturer) Start(filter string) error {
	h, err := pcap.OpenLive(c.iface, 65536, true, pcap.BlockForever)
	if err != nil {
		return err
	}
	if filter != "" {
		if err := h.SetBPFFilter(filter); err != nil {
			h.Close()
			return err
		}
	}
	c.handle = h
	go func() {
		src := gopacket.NewPacketSource(h, h.LinkType())
		for {
			select {
			case <-c.stop:
				return
			case p, ok := <-src.Packets():
				if !ok {
					return
				}
				np := Packet{T: time.Now().Unix(), Length: len(p.Data())}
				if l := p.NetworkLayer(); l != nil {
					np.Src = l.NetworkFlow().Src().String()
					np.Dst = l.NetworkFlow().Dst().String()
					if t := p.TransportLayer(); t != nil {
						np.Proto = t.LayerType().String()
					} else {
						np.Proto = l.LayerType().String()
					}
				}
				select {
				case c.out <- np:
				default:
				}
			}
		}
	}()
	return nil
}

func (c *Capturer) Stop() {
	close(c.stop)
	if c.handle != nil {
		c.handle.Close()
	}
}

var _ = fmt.Sprintf
