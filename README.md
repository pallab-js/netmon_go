# NetScope

A clean, minimal network monitor for the Linux desktop — live interface throughput, latency and packet-loss trend, LAN device discovery, and active connections. No root, no agents, no cloud. All data stays on your machine.

## Features

- **Live throughput** — rx/tx bytes/sec per interface (1 Hz, 3-minute rolling chart)
- **Latency & loss** — gateway + 1.1.1.1 probes (2 s), 60-second rollups, 30-day history
- **LAN discovery** — ARP + ICMP sweep of your active `/24`, online/offline device list
- **Connections** — active connections of your own processes (2 s refresh)
- **Packet capture** — live packet inspection with BPF filters, protocol coloring, and PCAP export
- **History** — SQLite (WAL), CSV export, 30-day retention
- **Alerts** — link down / net down / new device toasts (in-app only)

## Tech stack

Go 1.26 + Wails v2 · React 19 + TypeScript + Tailwind CSS 4 · uPlot · modernc.org/sqlite · gopsutil · pro-bing · gopacket

## Build

Ubuntu 26.04 ships only webkit2gtk-4.1, so **every build requires the `webkit2_41` tag**:

```bash
git clone https://github.com/pallab-js/netmon_go.git
cd netmon_go
make build        # wails build -tags webkit2_41
./build/bin/netscope
```

| Command | Purpose |
|---------|---------|
| `make dev` | Live dev mode (Vite HMR), needs `-tags webkit2_41` |
| `make build` | Production build with `-tags webkit2_41` |
| `make test` | Go unit tests |
| `make tidy` | `go mod tidy` |

For app-menu integration, install `netscope.desktop` to `~/.local/share/applications/`.

## Data

SQLite database at `~/.local/share/netscope/netscope.db` (XDG-compliant). WAL mode, 30-day retention. Nothing leaves your machine except ICMP probes and reverse-DNS lookups on your LAN.

## License

MIT — see [LICENSE](LICENSE).
