// Package model holds the JSON types shared by the Go backend and the React UI.
package model

// TrafficPoint is one live throughput sample (bytes/sec).
type TrafficPoint struct {
	T  int64   `json:"t"` // unix seconds
	Rx float64 `json:"rx"`
	Tx float64 `json:"tx"`
}

// LatencyPoint is one live latency sample in milliseconds.
type LatencyPoint struct {
	T    int64   `json:"t"`
	Ms   float64 `json:"ms"`
	Loss float64 `json:"loss"`
}

type IfaceInfo struct {
	Name  string `json:"name"`
	IP    string `json:"ip"`
	MAC   string `json:"mac"`
	MTU   int    `json:"mtu"`
	Speed uint64 `json:"speed"` // bits/sec, 0 when unknown
}

type Conn struct {
	PID     int32  `json:"pid"`
	Process string `json:"process"`
	Proto   string `json:"proto"`
	Local   string `json:"local"`
	Remote  string `json:"remote"`
	State   string `json:"state"`
}

type Device struct {
	MAC       string `json:"mac"`
	IP        string `json:"ip"`
	Hostname  string `json:"hostname"`
	FirstSeen int64  `json:"firstSeen"`
	LastSeen  int64  `json:"lastSeen"`
	Online    bool   `json:"online"`
}

// Snapshot is pushed to the UI once per second.
type Snapshot struct {
	Iface         IfaceInfo      `json:"iface"`
	Ifaces        []string       `json:"ifaces"`
	RxRate        float64        `json:"rxRate"`
	TxRate        float64        `json:"txRate"`
	LatencyMs     float64        `json:"latencyMs"`
	LossPct       float64        `json:"lossPct"`
	Gateway       string         `json:"gateway"`
	Conns         int            `json:"conns"`
	DevicesOnline int            `json:"devicesOnline"`
	DevicesTotal  int            `json:"devicesTotal"`
	Paused        bool           `json:"paused"`
	LinkUp        bool           `json:"linkUp"`
	Traffic       []TrafficPoint `json:"traffic"`
	Latency       []LatencyPoint `json:"latency"`
	TopConns      []Conn         `json:"topConns"`
	UpdatedAt     int64          `json:"updatedAt"`
}

type TrafficRow struct {
	T  int64   `json:"t"`
	Rx float64 `json:"rx"`
	Tx float64 `json:"tx"`
}

type LatencyRow struct {
	T    int64   `json:"t"`
	Avg  float64 `json:"avg"`
	Max  float64 `json:"max"`
	Loss float64 `json:"loss"`
}

// History is a downsampled range read for the History view.
type History struct {
	From    int64        `json:"from"`
	To      int64        `json:"to"`
	Step    int64        `json:"step"`
	Traffic []TrafficRow `json:"traffic"`
	Latency []LatencyRow `json:"latency"`
	RxBytes float64      `json:"rxBytes"`
	TxBytes float64      `json:"txBytes"`
	PeakRx  float64      `json:"peakRx"`
	PeakTx  float64      `json:"peakTx"`
	AvgMs   float64      `json:"avgMs"`
	MaxLoss float64      `json:"maxLoss"`
}

type Event struct {
	T       int64  `json:"t"`
	Kind    string `json:"kind"`
	Message string `json:"message"`
}

type Alert struct {
	T       int64  `json:"t"`
	Kind    string `json:"kind"`
	Message string `json:"message"`
}

type ScanProgress struct {
	Done    int  `json:"done"`
	Total   int  `json:"total"`
	Running bool `json:"running"`
}

type Settings struct {
	Interface     string `json:"iface"`
	DataPath      string `json:"dataPath"`
	DBSize        int64  `json:"dbSize"`
	RetentionDays int    `json:"retentionDays"`
	Version       string `json:"version"`
}
