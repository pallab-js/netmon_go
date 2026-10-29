package capture

import (
	"os"
	"sync"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
	"github.com/google/gopacket/pcapgo"
)

// PacketSummary is the packet summary struct for capture output
type PacketSummary struct {
	T      int64  `json:"t"`
	Proto  string `json:"proto"`
	Src    string `json:"src"`
	Dst    string `json:"dst"`
	Length int    `json:"length"`
	Info   string `json:"info"`
}

// Packet is alias for PacketSummary for compatibility
type Packet = PacketSummary

type Capturer struct {
	iface    string
	handle   *pcap.Handle
	out      chan PacketSummary
	stop     chan struct{}
	mu       sync.RWMutex
	running  bool
	pcapFile *pcapgo.Writer
	pcapName string
}

func New(iface string) *Capturer {
	return &Capturer{
		iface: iface,
		out:   make(chan PacketSummary, 4096),
		stop:  make(chan struct{}),
	}
}

func (c *Capturer) Packets() <-chan PacketSummary { return c.out }

func (c *Capturer) Start(filter string) error {
	return c.StartWithFilter(filter)
}

// StartWithFilter starts capture with BPF filter
func (c *Capturer) StartWithFilter(filter string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.running {
		return nil
	}

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
	c.running = true

	go c.captureLoop(h)
	return nil
}

func (c *Capturer) captureLoop(h *pcap.Handle) {
	src := gopacket.NewPacketSource(h, h.LinkType())
	for {
		select {
		case <-c.stop:
			return
		case p, ok := <-src.Packets():
			if !ok {
				return
			}
			np := PacketSummary{T: time.Now().Unix(), Length: len(p.Data())}
			if c.pcapFile != nil {
				_ = c.pcapFile.WritePacket(p.Metadata().CaptureInfo, p.Data())
			}
			if l := p.NetworkLayer(); l != nil {
				np.Src = l.NetworkFlow().Src().String()
				np.Dst = l.NetworkFlow().Dst().String()
				if t := p.TransportLayer(); t != nil {
					switch t.LayerType() {
					case layers.LayerTypeTCP:
						np.Proto = "TCP"
						if tcp, ok := t.(*layers.TCP); ok {
							np.Info = tcp.SrcPort.String() + " → " + tcp.DstPort.String()
						}
					case layers.LayerTypeUDP:
						np.Proto = "UDP"
						if udp, ok := t.(*layers.UDP); ok {
							np.Info = udp.SrcPort.String() + " → " + udp.DstPort.String()
						}
					case layers.LayerTypeICMPv4:
						np.Proto = "ICMP"
					case layers.LayerTypeICMPv6:
						np.Proto = "ICMPv6"
					default:
						np.Proto = t.LayerType().String()
					}
				} else {
					np.Proto = l.LayerType().String()
				}
			} else if l := p.LinkLayer(); l != nil {
				np.Proto = l.LayerType().String()
			}
			select {
			case c.out <- np:
			default:
			}
		}
	}
}

func (c *Capturer) Stop() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.running && c.handle == nil {
		return
	}
	select {
	case <-c.stop:
	default:
		close(c.stop)
	}
	if c.handle != nil {
		c.handle.Close()
		c.handle = nil
	}
	if c.pcapFile != nil {
		c.pcapFile = nil
	}
	if c.pcapName != "" {
		// keep file for later retrieval if needed; caller can remove
		c.pcapName = ""
	}
	c.running = false
}

// StartPersistentPCAP starts writing packets to a pcap file
func (c *Capturer) StartPersistentPCAP(path string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	w := pcapgo.NewWriter(f)
	if err := w.WriteFileHeader(65536, layers.LinkTypeEthernet); err != nil {
		f.Close()
		return err
	}
	c.mu.Lock()
	c.pcapFile = w
	c.pcapName = path
	c.mu.Unlock()
	return nil
}
