import { Link2, Network, WifiOff } from 'lucide-react'
import { Kpi } from '../components/Kpi'
import { TimeChart } from '../components/Chart'
import type { Device, Page, Snapshot } from '../lib/types'
import { formatLoss, formatMs, formatRate, formatSpeed, ago, shortMac } from '../lib/format'

function Empty({ text }: { text: string }) {
  return <div className="flex h-40 items-center justify-center text-xs text-muted">{text}</div>
}

export function Overview({ snap, devices, onPage }: { snap: Snapshot | null; devices: Device[]; onPage?: (p: Page) => void }) {
  const traffic = snap?.traffic ?? []
  const latency = snap?.latency ?? []
  const conns = snap?.topConns ?? []
  const online = devices.filter((d) => d.online).slice(0, 5)
  const onlineMore = Math.max(0, devices.filter((d) => d.online).length - 5)

  const trafficData = [traffic.map((p) => p.t), traffic.map((p) => p.rx), traffic.map((p) => p.tx)]
  const latencyData = [latency.map((p) => p.t), latency.map((p) => p.ms)]

  return (
    <div className="flex flex-col gap-4">
      {snap?.linkUp === false ? (
        <div className="flex items-center gap-2 rounded-lg border border-bad/40 bg-bad/10 px-4 py-2 text-xs text-bad">
          <WifiOff size={14} />
          <span className="font-medium">Link is down</span>
          <span className="text-bad/80">— sampling paused until it returns</span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi
          label="Download"
          value={formatRate(snap?.rxRate ?? 0)}
          sub="current inbound rate"
          color="#38bdf8"
          values={traffic.map((p) => p.rx)}
        />
        <Kpi
          label="Upload"
          value={formatRate(snap?.txRate ?? 0)}
          sub="current outbound rate"
          color="#a78bfa"
          values={traffic.map((p) => p.tx)}
        />
        <Kpi
          label="Latency"
          value={formatMs(snap?.latencyMs ?? 0)}
          sub={`internet · ${formatLoss(snap?.lossPct ?? 0)} loss`}
          color="#2dd4bf"
          values={latency.map((p) => p.ms)}
        />
        <Kpi
          label="Devices online"
          value={`${snap?.devicesOnline ?? 0}/${snap?.devicesTotal ?? 0}`}
          sub={`gateway ${snap?.gateway || '—'}`}
          color="#f59e0b"
        />
      </div>

      <section className="card">
        <div className="flex flex-wrap items-center gap-4 px-4 pt-3.5 pb-1">
          <div>
            <h2 className="text-[13px] font-medium">Throughput</h2>
            <p className="text-[11px] text-muted">last 3 minutes · 1 s samples</p>
          </div>
          <div className="ml-auto flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-3 rounded-full bg-down" />
              <span className="text-muted">down</span>
              <span className="font-medium text-ink">{formatRate(snap?.rxRate ?? 0)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-3 rounded-full bg-up" />
              <span className="text-muted">up</span>
              <span className="font-medium text-ink">{formatRate(snap?.txRate ?? 0)}</span>
            </span>
          </div>
        </div>
        {traffic.length > 1 ? (
          <div className="px-2 pb-2">
            <TimeChart
              data={trafficData}
              height={230}
              yFormat={formatRate}
              series={[
                { label: 'down', color: '#38bdf8', fill: 'rgba(56,189,248,0.12)' },
                { label: 'up', color: '#a78bfa', fill: 'rgba(167,139,250,0.10)' },
              ]}
            />
          </div>
        ) : (
          <Empty text={snap ? 'Waiting for the first samples…' : 'Connecting to the monitor…'} />
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
            <div>
              <h2 className="text-[13px] font-medium">Latency &amp; loss</h2>
              <p className="text-[11px] text-muted">ICMP to 1.1.1.1 · every 2 s</p>
            </div>
            <div className="text-right text-[11px]">
              <div className="text-sm font-medium text-ink">{formatMs(snap?.latencyMs ?? 0)}</div>
              <div className="text-muted">{formatLoss(snap?.lossPct ?? 0)} loss</div>
            </div>
          </div>
          {latency.length > 1 ? (
            <div className="px-2 pb-2">
              <TimeChart
                data={latencyData}
                height={160}
                yFormat={(v) => `${Math.round(v)} ms`}
                series={[{ label: 'latency', color: '#2dd4bf', fill: 'rgba(45,212,191,0.10)' }]}
              />
            </div>
          ) : (
            <Empty text="Measuring latency…" />
          )}
        </section>

        <section className="card p-4">
          <h2 className="text-[13px] font-medium">Link</h2>
          <p className="mb-3 text-[11px] text-muted">{snap?.iface.name || 'no interface selected'}</p>
          <dl className="space-y-2 text-[11px]">
            {[
              ['Status', snap?.linkUp === false ? 'down' : 'up'],
              ['IPv4', snap?.iface.ip || '—'],
              ['MAC', snap?.iface.mac || '—'],
              ['MTU', snap?.iface.mtu ? String(snap.iface.mtu) : '—'],
              ['Speed', formatSpeed(snap?.iface.speed ?? 0)],
              ['Gateway', snap?.gateway || '—'],
              ['Sockets', String(snap?.conns ?? 0)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 border-b border-line/60 pb-1.5 last:border-0">
                <dt className="text-muted">{k}</dt>
                <dd className="truncate font-medium text-ink/90">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="card">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
            <h2 className="text-[13px] font-medium">Top connections</h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted">{snap?.conns ?? 0} open</span>
              {onPage ? (
                <button onClick={() => onPage('connections')} className="text-[11px] text-accent hover:underline">
                  View all →
                </button>
              ) : null}
            </div>
          </div>
          {conns.length === 0 ? (
            <Empty text="No active connections" />
          ) : (
            <table className="w-full text-left text-[11px]">
              <thead className="text-muted">
                <tr className="border-y border-line/70">
                  <th className="px-4 py-1.5 font-medium">Process</th>
                  <th className="px-2 py-1.5 font-medium">Remote</th>
                  <th className="px-2 py-1.5 font-medium">State</th>
                  <th className="px-4 py-1.5 text-right font-medium">Proto</th>
                </tr>
              </thead>
              <tbody>
                {conns.slice(0, 6).map((c, i) => (
                  <tr key={`${c.proto}-${c.local}-${c.remote}-${i}`} className="border-b border-line/40 last:border-0">
                    <td className="max-w-[130px] truncate px-4 py-1.5">
                      <span className="flex items-center gap-1.5">
                        <Link2 size={11} className="shrink-0 text-muted" />
                        {c.process || 'unknown'}
                      </span>
                    </td>
                    <td className="max-w-[150px] truncate px-2 py-1.5 text-muted">{c.remote || '—'}</td>
                    <td className="px-2 py-1.5">{c.state === 'ESTABLISHED' ? 'open' : c.state.toLowerCase()}</td>
                    <td className="px-4 py-1.5 text-right text-muted uppercase">{c.proto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
            <h2 className="text-[13px] font-medium">Devices online</h2>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <Network size={11} /> {snap?.devicesOnline ?? 0} of {snap?.devicesTotal ?? 0}
              </span>
              {onPage ? (
                <button onClick={() => onPage('devices')} className="text-[11px] text-accent hover:underline">
                  View all →
                </button>
              ) : null}
            </div>
          </div>
          {online.length === 0 ? (
            <Empty text="No devices discovered yet" />
          ) : (
            <ul className="text-[11px]">
              {online.map((d) => (
                <li key={d.mac} className="flex items-center gap-3 border-b border-line/40 px-4 py-2 last:border-0">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-good" />
                  <span className="min-w-0 flex-1 truncate font-medium">{d.hostname || d.ip || 'unknown'}</span>
                  <span className="text-muted">{d.ip}</span>
                  <span className="hidden font-mono text-[10px] text-muted/70 sm:inline">{shortMac(d.mac)}</span>
                  <span className="w-16 text-right text-muted/70">{ago(d.lastSeen)}</span>
                </li>
              ))}
              {onlineMore > 0 ? (
                <li className="px-4 py-1.5 text-center text-[10px] text-muted">+{onlineMore} more online</li>
              ) : null}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
