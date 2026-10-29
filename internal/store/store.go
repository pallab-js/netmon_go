// Package store owns the SQLite database: schema, rollups, history queries, retention.
package store

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"netscope/internal/model"

	_ "modernc.org/sqlite"
)

const RetentionDays = 30

// DefaultPath follows XDG so the DB lives with the rest of the user's app data.
func DefaultPath() (string, error) {
	base := os.Getenv("XDG_DATA_HOME")
	if base == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		base = filepath.Join(home, ".local", "share")
	}
	dir := filepath.Join(base, "netscope")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return filepath.Join(dir, "netscope.db"), nil
}

type Store struct {
	db   *sql.DB
	path string
}

func Open(path string) (*Store, error) {
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)&_pragma=foreign_keys(ON)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// One connection keeps writes serialised; the app is a single writer anyway.
	db.SetMaxOpenConns(1)
	s := &Store{db: db, path: path}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) Path() string { return s.path }

var schema = []string{
	`CREATE TABLE IF NOT EXISTS meta (
		key   TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS interfaces (
		id         INTEGER PRIMARY KEY,
		name       TEXT NOT NULL UNIQUE,
		mac        TEXT,
		first_seen INTEGER NOT NULL,
		last_seen  INTEGER NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS traffic_10s (
		iface_id INTEGER NOT NULL REFERENCES interfaces(id),
		bucket   INTEGER NOT NULL,
		rx_bytes INTEGER NOT NULL,
		tx_bytes INTEGER NOT NULL,
		rx_rate  REAL NOT NULL,
		tx_rate  REAL NOT NULL,
		PRIMARY KEY (iface_id, bucket)
	) WITHOUT ROWID`,
	`CREATE TABLE IF NOT EXISTS latency_60s (
		target   TEXT NOT NULL,
		bucket   INTEGER NOT NULL,
		avg_ms   REAL,
		min_ms   REAL,
		max_ms   REAL,
		loss_pct REAL NOT NULL,
		PRIMARY KEY (target, bucket)
	) WITHOUT ROWID`,
	`CREATE TABLE IF NOT EXISTS devices (
		mac        TEXT PRIMARY KEY,
		ip         TEXT,
		hostname   TEXT,
		first_seen INTEGER NOT NULL,
		last_seen  INTEGER NOT NULL,
		online     INTEGER NOT NULL DEFAULT 1
	)`,
	`CREATE TABLE IF NOT EXISTS events (
		id      INTEGER PRIMARY KEY,
		ts      INTEGER NOT NULL,
		kind    TEXT NOT NULL,
		message TEXT NOT NULL
	)`,
	`CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts)`,
}

func (s *Store) migrate() error {
	for _, stmt := range schema {
		if _, err := s.db.Exec(stmt); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}
	_, err := s.db.Exec(`PRAGMA user_version = 1`)
	return err
}

// EnsureInterface returns the row id for an interface name, creating it on first use.
func (s *Store) EnsureInterface(name, mac string, now int64) (int64, error) {
	_, err := s.db.Exec(`INSERT INTO interfaces (name, mac, first_seen, last_seen)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(name) DO UPDATE SET last_seen = excluded.last_seen,
			mac = COALESCE(NULLIF(excluded.mac, ''), interfaces.mac)`, name, mac, now, now)
	if err != nil {
		return 0, err
	}
	var id int64
	err = s.db.QueryRow(`SELECT id FROM interfaces WHERE name = ?`, name).Scan(&id)
	return id, err
}

func (s *Store) FlushTraffic(ifaceID, bucket int64, rxBytes, txBytes uint64, rxRate, txRate float64) error {
	_, err := s.db.Exec(`INSERT INTO traffic_10s (iface_id, bucket, rx_bytes, tx_bytes, rx_rate, tx_rate)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(iface_id, bucket) DO UPDATE SET
			rx_bytes = rx_bytes + excluded.rx_bytes,
			tx_bytes = tx_bytes + excluded.tx_bytes,
			rx_rate  = excluded.rx_rate,
			tx_rate  = excluded.tx_rate`,
		ifaceID, bucket, int64(rxBytes), int64(txBytes), rxRate, txRate)
	return err
}

func (s *Store) FlushLatency(target string, bucket int64, avg, min, max, loss float64) error {
	_, err := s.db.Exec(`INSERT INTO latency_60s (target, bucket, avg_ms, min_ms, max_ms, loss_pct)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(target, bucket) DO UPDATE SET
			avg_ms = excluded.avg_ms, min_ms = excluded.min_ms,
			max_ms = excluded.max_ms, loss_pct = excluded.loss_pct`,
		target, bucket, avg, min, max, loss)
	return err
}

func (s *Store) UpsertDevices(devs []model.Device) error {
	if len(devs) == 0 {
		return nil
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	stmt, err := tx.Prepare(`INSERT INTO devices (mac, ip, hostname, first_seen, last_seen, online)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(mac) DO UPDATE SET
			ip = excluded.ip,
			hostname = COALESCE(NULLIF(excluded.hostname, ''), devices.hostname),
			last_seen = excluded.last_seen,
			online = excluded.online`)
	if err != nil {
		return err
	}
	defer stmt.Close()
	for _, d := range devs {
		if _, err := stmt.Exec(d.MAC, d.IP, d.Hostname, d.FirstSeen, d.LastSeen, boolInt(d.Online)); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) Devices() ([]model.Device, error) {
	rows, err := s.db.Query(`SELECT mac, COALESCE(ip,''), COALESCE(hostname,''), first_seen, last_seen, online
		FROM devices ORDER BY online DESC, last_seen DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]model.Device, 0, 32)
	for rows.Next() {
		var d model.Device
		var online int
		if err := rows.Scan(&d.MAC, &d.IP, &d.Hostname, &d.FirstSeen, &d.LastSeen, &online); err != nil {
			return nil, err
		}
		d.Online = online == 1
		out = append(out, d)
	}
	return out, rows.Err()
}

func (s *Store) Traffic(ifaceID, from, to, step int64) ([]model.TrafficRow, error) {
	if step < 10 {
		step = 10
	}
	rows, err := s.db.Query(`SELECT (bucket / ?3) * ?3 AS b, AVG(rx_rate), AVG(tx_rate)
		FROM traffic_10s
		WHERE iface_id = ?1 AND bucket >= ?2 AND bucket < ?4
		GROUP BY b ORDER BY b`, ifaceID, from, step, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]model.TrafficRow, 0, 512)
	for rows.Next() {
		var r model.TrafficRow
		if err := rows.Scan(&r.T, &r.Rx, &r.Tx); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) Latency(target string, from, to, step int64) ([]model.LatencyRow, error) {
	if step < 60 {
		step = 60
	}
	rows, err := s.db.Query(`SELECT (bucket / ?3) * ?3 AS b, AVG(avg_ms), MAX(max_ms), AVG(loss_pct)
		FROM latency_60s
		WHERE target = ?1 AND bucket >= ?2 AND bucket < ?4
		GROUP BY b ORDER BY b`, target, from, step, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]model.LatencyRow, 0, 512)
	for rows.Next() {
		var r model.LatencyRow
		var avg, max sql.NullFloat64
		if err := rows.Scan(&r.T, &avg, &max, &r.Loss); err != nil {
			return nil, err
		}
		r.Avg, r.Max = avg.Float64, max.Float64
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) InsertEvent(kind, message string) error {
	_, err := s.db.Exec(`INSERT INTO events (ts, kind, message) VALUES (?, ?, ?)`, now(), kind, message)
	return err
}

func (s *Store) Events(limit int) ([]model.Event, error) {
	rows, err := s.db.Query(`SELECT ts, kind, message FROM events ORDER BY ts DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]model.Event, 0, limit)
	for rows.Next() {
		var e model.Event
		if err := rows.Scan(&e.T, &e.Kind, &e.Message); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// Prune enforces retention. Raw traffic/latency: 30 days, events: 90 days, offline devices: 90 days.
func (s *Store) Prune() error {
	nowTs := now()
	stmts := []struct {
		q    string
		args []any
	}{
		{`DELETE FROM traffic_10s WHERE bucket < ?`, []any{nowTs - RetentionDays*86400}},
		{`DELETE FROM latency_60s WHERE bucket < ?`, []any{nowTs - RetentionDays*86400}},
		{`DELETE FROM events WHERE ts < ?`, []any{nowTs - 90*86400}},
		{`DELETE FROM devices WHERE online = 0 AND last_seen < ?`, []any{nowTs - 90*86400}},
	}
	for _, st := range stmts {
		if _, err := s.db.Exec(st.q, st.args...); err != nil {
			return err
		}
	}
	_, err := s.db.Exec(`PRAGMA wal_checkpoint(TRUNCATE)`)
	return err
}

func (s *Store) Clear() error {
	for _, q := range []string{`DELETE FROM traffic_10s`, `DELETE FROM latency_60s`, `DELETE FROM events`, `DELETE FROM devices`} {
		if _, err := s.db.Exec(q); err != nil {
			return err
		}
	}
	_, err := s.db.Exec(`PRAGMA wal_checkpoint(TRUNCATE)`)
	return err
}

func (s *Store) Size() int64 {
	fi, err := os.Stat(s.path)
	if err != nil {
		return 0
	}
	return fi.Size()
}

func (s *Store) GetMeta(key, fallback string) string {
	var v string
	if err := s.db.QueryRow(`SELECT value FROM meta WHERE key = ?`, key).Scan(&v); err != nil {
		return fallback
	}
	return v
}

func (s *Store) SetMeta(key, value string) error {
	_, err := s.db.Exec(`INSERT INTO meta (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value)
	return err
}

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func now() int64 { return time.Now().Unix() }
