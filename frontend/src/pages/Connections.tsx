import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { ListConnections } from '../../wailsjs/go/main/App'
import type { Conn, Snapshot, ToastKind } from '../lib/types'

const stateTone = (state: string) => {
  switch (state) {
    case 'ESTABLISHED':
      return 'border-good/40 text-good'
    case 'LISTEN':
      return 'border-accent/40 text-accent'
    case 'TIME_WAIT':
    case 'CLOSE_WAIT':
      return 'border-warn/40 text-warn'
    default:
      return 'border-line text-muted'
  }
}

type Props = { snap: Snapshot | null; onToast: (kind: ToastKind, message: string) => void }

export function Connections({ snap }: Props) {
  const [fallback, setFallback] = useState<Conn[]>([])
  const [filter, setFilter] = useState('')
  const [usingFallback, setUsingFallback] = useState(false)

  useEffect(() => {
    ListConnections()
      .then((c) => {
        setFallback(c ?? [])
        setUsingFallback(true)
      })
      .catch(() => {
        setFallback([])
        setUsingFallback(false)
      })
  }, [])

  const conns = snap?.topConns && snap.topConns.length > 0 ? snap.topConns : fallback
  const isUsingSnapshot = Boolean(snap?.topConns && snap.topConns.length > 0)

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return conns
    return conns.filter((c) =>
      [c.process, c.proto, c.local, c.remote, c.state, c.pid != null ? String(c.pid) : ''].join(' ').toLowerCase().includes(q),
    )
  }, [conns, filter])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter process, address, state…"
            className="w-72 rounded-lg border border-line bg-panel py-1.5 pr-8 pl-8 text-xs text-ink outline-none placeholder:text-muted/60 focus:border-accent/60"
          />
          {filter ? (
            <button
              onClick={() => setFilter('')}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted transition-colors hover:text-ink"
              aria-label="Clear filter"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
        <span className="text-[11px] text-muted">
          {rows.length} of {conns.length} sockets
          {!isUsingSnapshot && usingFallback ? <span className="ml-1.5 text-muted/60">(cached)</span> : null}
        </span>
        <span className="ml-auto text-[11px] text-muted">refreshes every 2 s</span>
      </div>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">Process</th>
                <th className="px-3 py-2 font-medium">PID</th>
                <th className="px-3 py-2 font-medium">Proto</th>
                <th className="px-3 py-2 font-medium">Local</th>
                <th className="px-3 py-2 font-medium">Remote</th>
                <th className="px-4 py-2 text-right font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-muted">
                    {conns.length === 0 ? 'No connections reported.' : 'Nothing matches the filter.'}
                  </td>
                </tr>
              ) : (
                rows.map((c, i) => (
                  <tr key={`${c.proto}-${c.local}-${c.remote}-${c.pid}-${i}`} className="border-b border-line/40 last:border-0 hover:bg-panel2/60">
                    <td className="max-w-[180px] truncate px-4 py-1.5 font-medium">{c.process || 'unknown'}</td>
                    <td className="px-3 py-1.5 text-muted">{c.pid != null ? c.pid : '—'}</td>
                    <td className="px-3 py-1.5 text-muted uppercase">{c.proto}</td>
                    <td className="max-w-[190px] truncate px-3 py-1.5 font-mono text-[10px] text-muted">{c.local}</td>
                    <td className="max-w-[190px] truncate px-3 py-1.5 font-mono text-[10px] text-muted">{c.remote || '—'}</td>
                    <td className="px-4 py-1.5 text-right">
                      <span className={`inline-block rounded-full border px-1.5 py-0.5 text-[10px] ${stateTone(c.state)}`}>
                        {c.state || 'NONE'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-muted/80">
        Without root the kernel only exposes process names for your own processes; other sockets show as{' '}
        <span className="text-muted">unknown</span>. Per-process bandwidth needs elevated privileges and is not part of
        this build.
      </p>
    </div>
  )
}
