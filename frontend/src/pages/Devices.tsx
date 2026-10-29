import { Radar } from 'lucide-react'
import type { Device, ScanProgress, ToastKind } from '../lib/types'
import { ago, dateTime, shortMac } from '../lib/format'

type Props = {
  devices: Device[]
  scan: ScanProgress
  onScan: () => void
  onToast: (kind: ToastKind, message: string) => void
}

export function Devices({ devices, scan, onScan }: Props) {
  const online = devices.filter((d) => d.online).length
  const pct = scan.total > 0 ? Math.round((scan.done / scan.total) * 100) : 0

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-wrap items-center gap-4 p-4">
        <div>
          <h2 className="text-[13px] font-medium">
            {online} online <span className="text-muted">/ {devices.length} known</span>
          </h2>
          <p className="text-[11px] text-muted">
            ARP neighbours plus an ICMP sweep of your local subnet, every 5 minutes
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {scan.running ? (
            <div className="flex w-40 items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-muted">{pct}%</span>
            </div>
          ) : null}
          <button
            onClick={onScan}
            disabled={scan.running}
            className="flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-[11px] text-accent transition-colors hover:bg-accent/15 disabled:opacity-40"
          >
            <Radar size={12} className={scan.running ? 'animate-spin' : ''} />
            {scan.running ? 'Scanning…' : 'Scan now'}
          </button>
        </div>
      </section>

      <section className="card overflow-hidden">
        {devices.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-1 text-xs text-muted">
            <span>No devices discovered yet.</span>
            <span>The first sweep runs a few seconds after launch.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Host</th>
                  <th className="px-3 py-2 font-medium">IP</th>
                  <th className="px-3 py-2 font-medium">MAC</th>
                  <th className="px-3 py-2 font-medium">First seen</th>
                  <th className="px-4 py-2 text-right font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.mac} className="border-b border-line/40 last:border-0 hover:bg-panel2/60">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${d.online ? 'bg-good' : 'bg-muted/50'}`} />
                        <span className={d.online ? 'text-good' : 'text-muted'}>{d.online ? 'online' : 'offline'}</span>
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 font-medium">{d.hostname || '—'}</td>
                    <td className="px-3 py-2 text-muted">{d.ip || '—'}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted">{shortMac(d.mac)}</td>
                    <td className="px-3 py-2 text-muted">{d.firstSeen ? dateTime(d.firstSeen) : '—'}</td>
                    <td className="px-4 py-2 text-right text-muted">{d.lastSeen ? ago(d.lastSeen) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[11px] leading-relaxed text-muted/80">
        Discovery is read-only: the neighbour table is read and each address gets one ICMP echo. Hostnames come from
        reverse DNS when available. Large subnets are capped to the local /24 so a scan stays under a few seconds.
      </p>
    </div>
  )
}
