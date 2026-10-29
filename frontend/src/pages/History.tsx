import { useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { ExportCSV, GetHistory, ListEvents } from '../../wailsjs/go/main/App'
import type { EventRow, History, ToastKind } from '../lib/types'
import { dateTime, formatBytes, formatLoss, formatMs, formatRate } from '../lib/format'
import { TimeChart } from '../components/Chart'
import { Kpi } from '../components/Kpi'

const RANGES = [
  { id: '1h', label: '1 h', secs: 3600 },
  { id: '24h', label: '24 h', secs: 86400 },
  { id: '7d', label: '7 d', secs: 7 * 86400 },
  { id: '30d', label: '30 d', secs: 30 * 86400 },
] as const

type RangeId = (typeof RANGES)[number]['id']

type Props = { onToast: (kind: ToastKind, message: string) => void }

const eventTone: Record<string, string> = {
  net_down: 'text-bad',
  link_down: 'text-bad',
  net_up: 'text-good',
  link_up: 'text-good',
  device_new: 'text-accent',
}

export function HistoryPage({ onToast }: Props) {
  const [range, setRange] = useState<RangeId>('24h')
  const [hist, setHist] = useState<History | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(false)

  const secs = RANGES.find((r) => r.id === range)?.secs ?? 86400

  const load = async () => {
    setLoading(true)
    try {
      const to = Math.floor(Date.now() / 1000)
      const [h, e] = await Promise.all([GetHistory(to - secs, to), ListEvents(20)])
      setHist(h)
      setEvents(e ?? [])
    } catch (err) {
      onToast('error', `Could not load history: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  const exportCSV = async () => {
    if (!hist) return
    try {
      const path = await ExportCSV(hist.from, hist.to)
      if (path) onToast('good', `Exported to ${path}`)
    } catch (err) {
      onToast('error', `Export failed: ${String(err)}`)
    }
  }

  const traffic = hist?.traffic ?? []
  const latency = hist?.latency ?? []
  const trafficData = [traffic.map((p) => p.t), traffic.map((p) => p.rx), traffic.map((p) => p.tx)]
  const latencyData = [latency.map((p) => p.t), latency.map((p) => p.avg)]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-line bg-panel p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${
                range === r.id ? 'bg-accent/15 font-medium text-accent' : 'text-muted hover:text-ink'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[11px] text-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
        <button
          onClick={() => void exportCSV()}
          disabled={!hist || traffic.length === 0}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-[11px] text-accent transition-colors hover:bg-accent/15 disabled:opacity-40"
        >
          <Download size={12} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Downloaded" value={formatBytes(hist?.rxBytes ?? 0)} sub={`over the last ${range}`} color="#38bdf8" />
        <Kpi label="Uploaded" value={formatBytes(hist?.txBytes ?? 0)} sub="approximate, from 10 s buckets" color="#a78bfa" />
        <Kpi label="Peak rate" value={formatRate(hist?.peakRx ?? 0)} sub={`up peak ${formatRate(hist?.peakTx ?? 0)}`} color="#2dd4bf" />
        <Kpi
          label="Latency avg"
          value={formatMs(hist?.avgMs ?? 0)}
          sub={`max loss ${formatLoss(hist?.maxLoss ?? 0)}`}
          color="#f59e0b"
        />
      </div>

      <section className="card">
        <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
          <div>
            <h2 className="text-[13px] font-medium">Throughput history</h2>
            <p className="text-[11px] text-muted">
              {hist ? `${hist.step >= 3600 ? `${hist.step / 3600} h` : `${hist.step} s`} buckets · ${dateTime(hist.from)} → ${dateTime(hist.to)}` : 'loading…'}
            </p>
          </div>
        </div>
        {traffic.length > 0 ? (
          <div className="px-2 pb-2">
            <TimeChart
              data={trafficData}
              height={260}
              yFormat={formatRate}
              domain={hist ? [hist.from, hist.to] : undefined}
              series={[
                { label: 'down', color: '#38bdf8', fill: 'rgba(56,189,248,0.12)' },
                { label: 'up', color: '#a78bfa', fill: 'rgba(167,139,250,0.10)' },
              ]}
            />
          </div>
        ) : (
          <div className="flex h-52 flex-col items-center justify-center gap-1 text-xs text-muted">
            <span>No samples in this range yet.</span>
            <span>History is written every 10 seconds while the app runs.</span>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
            <div>
              <h2 className="text-[13px] font-medium">Latency history</h2>
              <p className="text-[11px] text-muted">minute averages to 1.1.1.1</p>
            </div>
            <span className="text-[11px] text-muted">avg {formatMs(hist?.avgMs ?? 0)}</span>
          </div>
          {latency.length > 0 ? (
            <div className="px-2 pb-2">
              <TimeChart
                data={latencyData}
                height={170}
                yFormat={(v) => `${Math.round(v)} ms`}
                domain={hist ? [hist.from, hist.to] : undefined}
                series={[{ label: 'latency', color: '#2dd4bf', fill: 'rgba(45,212,191,0.10)' }]}
              />
            </div>
          ) : (
            <div className="flex h-44 items-center justify-center text-xs text-muted">No latency samples yet.</div>
          )}
        </section>

        <section className="card">
          <div className="px-4 pt-3.5 pb-2">
            <h2 className="text-[13px] font-medium">Recent events</h2>
            <p className="text-[11px] text-muted">link changes and new devices</p>
          </div>
          {events.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-xs text-muted">Nothing logged yet.</div>
          ) : (
            <ul className="max-h-[210px] overflow-y-auto pb-2">
              {events.map((e, i) => (
                <li key={`${e.t}-${i}`} className="flex items-start gap-2 px-4 py-1.5 text-[11px]">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${e.kind === 'device_new' ? 'bg-accent' : e.kind.includes('down') ? 'bg-bad' : 'bg-good'}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block leading-snug ${eventTone[e.kind] ?? 'text-ink/90'}`}>{e.message}</span>
                    <span className="text-[10px] text-muted/70">{dateTime(e.t)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
