package main

import (
	"context"
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"netscope/internal/hub"
	"netscope/internal/model"
	"netscope/internal/store"
)

const version = "0.1.0"

// App is the Wails binding surface. The frontend only talks to these methods.
type App struct {
	ctx    context.Context
	st     *store.Store
	hub    *hub.Hub
	status string
}

func NewApp() *App { return &App{} }

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	log.SetFlags(log.Ltime)

	path, err := store.DefaultPath()
	if err != nil {
		a.status = "Cannot resolve data directory: " + err.Error()
		log.Print(a.status)
		return
	}
	st, err := store.Open(path)
	if err != nil {
		a.status = "Cannot open database: " + err.Error()
		log.Print(a.status)
		return
	}
	a.st = st
	a.hub = hub.New(st, func(event string, data ...any) {
		runtime.EventsEmit(a.ctx, event, data...)
	})
	a.hub.Start()
	if err := st.Prune(); err != nil {
		log.Printf("prune: %v", err)
	}
	log.Printf("netscope ready, data at %s", path)
}

func (a *App) shutdown(ctx context.Context) {
	if a.hub != nil {
		a.hub.Stop()
	}
	if a.st != nil {
		a.st.Close()
	}
}

func (a *App) GetStatus() string { return a.status }

func (a *App) GetSnapshot() model.Snapshot {
	if a.hub == nil {
		return model.Snapshot{}
	}
	return a.hub.Snapshot()
}

func (a *App) GetHistory(from, to int64) model.History {
	if a.hub == nil {
		return model.History{}
	}
	return a.hub.History(from, to)
}

func (a *App) ListDevices() []model.Device {
	if a.hub == nil {
		return nil
	}
	return a.hub.Devices()
}

func (a *App) ListConnections() []model.Conn {
	if a.hub == nil {
		return nil
	}
	return a.hub.Conns()
}

func (a *App) ListEvents(limit int) []model.Event {
	if a.hub == nil || limit <= 0 || limit > 500 {
		return nil
	}
	return a.hub.Events(limit)
}

func (a *App) ScanLAN() error {
	if a.hub == nil {
		return fmt.Errorf("monitor not ready")
	}
	if a.hub.Scanning() {
		return fmt.Errorf("a scan is already running")
	}
	a.hub.Scan()
	return nil
}

func (a *App) SetPaused(paused bool) {
	if a.hub != nil {
		a.hub.SetPaused(paused)
	}
}

func (a *App) SetInterface(name string) error {
	if a.hub == nil {
		return fmt.Errorf("monitor not ready")
	}
	return a.hub.SetInterface(name)
}

func (a *App) GetSettings() model.Settings {
	s := model.Settings{RetentionDays: store.RetentionDays, Version: version}
	if a.st != nil {
		s.DataPath = a.st.Path()
		s.DBSize = a.st.Size()
	}
	if a.hub != nil {
		s.Interface = a.hub.Snapshot().Iface.Name
	}
	return s
}

func (a *App) ClearHistory() error {
	if a.st == nil {
		return fmt.Errorf("database not ready")
	}
	return a.st.Clear()
}

func (a *App) OpenDataFolder() error {
	if a.st == nil {
		return fmt.Errorf("database not ready")
	}
	runtime.BrowserOpenURL(a.ctx, "file://"+filepath.Dir(a.st.Path()))
	return nil
}

// ExportCSV writes the selected range to a user-chosen file, merging traffic and latency rows.
func (a *App) ExportCSV(from, to int64) (string, error) {
	if a.hub == nil {
		return "", fmt.Errorf("monitor not ready")
	}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export history as CSV",
		DefaultFilename: "netscope-" + time.Now().Format("20060102-1504") + ".csv",
		Filters:         []runtime.FileFilter{{DisplayName: "CSV", Pattern: "*.csv"}},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}

	hist := a.hub.History(from, to)
	// Traffic and latency have different bucket sizes; a blank cell means "no sample
	// at this timestamp" rather than a real zero.
	type row struct {
		rx, tx, lat, loss float64
		hasTraffic        bool
		hasLatency        bool
	}
	rows := map[int64]*row{}
	get := func(ts int64) *row {
		r, ok := rows[ts]
		if !ok {
			r = &row{}
			rows[ts] = r
		}
		return r
	}
	for _, p := range hist.Traffic {
		r := get(p.T)
		r.rx, r.tx, r.hasTraffic = p.Rx, p.Tx, true
	}
	for _, p := range hist.Latency {
		r := get(p.T)
		r.lat, r.loss, r.hasLatency = p.Avg, p.Loss, true
	}
	keys := make([]int64, 0, len(rows))
	for ts := range rows {
		keys = append(keys, ts)
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })

	f, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	w := csv.NewWriter(f)
	_ = w.Write([]string{"time", "rx_bytes_per_sec", "tx_bytes_per_sec", "latency_ms", "loss_pct"})
	for _, ts := range keys {
		r := rows[ts]
		cell := func(v float64, ok bool, digits int) string {
			if !ok {
				return ""
			}
			return strconv.FormatFloat(v, 'f', digits, 64)
		}
		_ = w.Write([]string{
			time.Unix(ts, 0).Format(time.RFC3339),
			cell(r.rx, r.hasTraffic, 1),
			cell(r.tx, r.hasTraffic, 1),
			cell(r.lat, r.hasLatency, 2),
			cell(r.loss, r.hasLatency, 1),
		})
	}
	w.Flush()
	return path, w.Error()
}
