package store

import (
	"path/filepath"
	"testing"
	"time"

	"netscope/internal/model"
)

func openTemp(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestTrafficRollupAndRetention(t *testing.T) {
	s := openTemp(t)
	id, err := s.EnsureInterface("eth0", "aa:bb:cc:dd:ee:ff", 1000)
	if err != nil {
		t.Fatalf("ensure iface: %v", err)
	}
	base := time.Now().Unix() / 20 * 20
	for i := int64(0); i < 4; i++ {
		if err := s.FlushTraffic(id, base+i*10, 1000, 500, 100, 50); err != nil {
			t.Fatalf("flush: %v", err)
		}
	}

	rows, err := s.Traffic(id, base, base+40, 20)
	if err != nil {
		t.Fatalf("traffic: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("rows = %d, want 2 (two 20s buckets)", len(rows))
	}
	if rows[0].Rx != 100 || rows[0].Tx != 50 {
		t.Fatalf("avg rates = %v/%v, want 100/50", rows[0].Rx, rows[0].Tx)
	}

	// A row older than the retention window disappears on prune.
	if err := s.FlushTraffic(id, base-31*86400, 1, 1, 1, 1); err != nil {
		t.Fatalf("flush old: %v", err)
	}
	if err := s.Prune(); err != nil {
		t.Fatalf("prune: %v", err)
	}
	rows, err = s.Traffic(id, base-31*86400-10, base+40, 10)
	if err != nil {
		t.Fatalf("traffic after prune: %v", err)
	}
	if len(rows) != 4 {
		t.Fatalf("rows after prune = %d, want 4 (old row deleted)", len(rows))
	}
	if rows[0].T < base {
		t.Fatalf("old row survived prune: %+v", rows[0])
	}
}

func TestLatencyAndDevices(t *testing.T) {
	s := openTemp(t)
	base := time.Now().Unix() / 60 * 60
	if err := s.FlushLatency("internet", base, 45, 40, 50, 0); err != nil {
		t.Fatalf("flush latency: %v", err)
	}
	rows, err := s.Latency("internet", base, base+60, 60)
	if err != nil {
		t.Fatalf("latency: %v", err)
	}
	if len(rows) != 1 || rows[0].Avg != 45 {
		t.Fatalf("latency rows = %+v, want one row with avg 45", rows)
	}

	dev := model.Device{MAC: "aa:bb", IP: "192.168.1.2", Hostname: "laptop", FirstSeen: 10, LastSeen: 20, Online: true}
	if err := s.UpsertDevices([]model.Device{dev}); err != nil {
		t.Fatalf("upsert: %v", err)
	}
	dev.Online = false
	dev.LastSeen = 30
	if err := s.UpsertDevices([]model.Device{dev}); err != nil {
		t.Fatalf("upsert offline: %v", err)
	}
	devs, err := s.Devices()
	if err != nil {
		t.Fatalf("devices: %v", err)
	}
	if len(devs) != 1 || devs[0].Online || devs[0].FirstSeen != 10 || devs[0].Hostname != "laptop" {
		t.Fatalf("devices = %+v", devs)
	}
}
