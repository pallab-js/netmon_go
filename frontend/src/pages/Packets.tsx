import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import { GetPackets, SaveCapturePcap, StartCapture, StopCapture } from '../../wailsjs/go/main/App'
import { Search, X, Play, Square, Download, Eye } from 'lucide-react'
import type { Packet, Snapshot, ToastKind } from '../lib/types'

type Props = { snap: Snapshot | null; onToast: (kind: ToastKind, message: string) => void }

const protocolColor = (proto: string) => {
  const p = proto.toUpperCase()
  if (p.includes('TCP')) return 'text-blue-400'
  if (p.includes('UDP')) return 'text-green-400'
  if (p.includes('ICMP')) return 'text-yellow-400'
  if (p.includes('ARP')) return 'text-orange-400'
  if (p.includes('DNS')) return 'text-purple-400'
  return 'text-muted'
}

export function Packets({ snap, onToast }: Props) {
  const [packets, setPackets] = useState<Packet[]>([])
  const [filter, setFilter] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [displayFilter, setDisplayFilter] = useState('')
  const [selected, setSelected] = useState<Packet | null>(null)
  const seen = useRef<Set<string>>(new Set())

  const loadPackets = useCallback(() => {
    GetPackets(displayFilter, 500)
      .then((pkts) => {
        if (pkts) {
          setPackets(pkts)
        }
      })
      .catch((err) => onToast('error', String(err)))
  }, [displayFilter, onToast])

  useEffect(() => {
    loadPackets()
    const off = EventsOn('packet:tick', (p: Packet) => {
      const key = `${p.t}-${p.src}-${p.dst}-${p.length}-${p.proto}`
      if (seen.current.has(key)) return
      seen.current.add(key)
      if (seen.current.size > 10000) {
        seen.current = new Set(Array.from(seen.current).slice(-5000))
      }
      setPackets((prev) => {
        const next = [...prev, p]
        if (next.length > 1000) next.shift()
        return next
      })
    })
    return () => {
      off()
    }
  }, [loadPackets])

  const startCap = () => {
    StartCapture(filter)
      .then(() => {
        setCapturing(true)
        onToast('info', 'Packet capture started')
      })
      .catch((err) => onToast('error', String(err)))
  }

  const stopCap = () => {
    StopCapture()
      .then(() => {
        setCapturing(false)
        onToast('info', 'Packet capture stopped')
      })
      .catch((err) => onToast('error', String(err)))
  }

  const savePcap = () => {
    SaveCapturePcap()
      .then((path) => {
        if (path) onToast('good', `Saved to ${path}`)
      })
      .catch((err) => onToast('error', String(err)))
  }

  const rows = useMemo(() => {
    const q = displayFilter.trim().toLowerCase()
    if (!q) return packets
    return packets.filter((p) =>
      [p.proto, p.src, p.dst, p.info, String(p.length)].join(' ').toLowerCase().includes(q),
    )
  }, [packets, displayFilter])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="BPF filter (e.g., tcp port 80)"
          className="w-64 rounded-lg border border-line bg-panel py-1.5 px-3 text-xs text-ink outline-none placeholder:text-muted/60 focus:border-accent/60"
        />
        {!capturing ? (
          <button onClick={startCap} className="flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs hover:bg-panel">
            <Play size={12} /> Start
          </button>
        ) : (
          <button onClick={stopCap} className="flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs hover:bg-panel">
            <Square size={12} /> Stop
          </button>
        )}
        <button onClick={savePcap} className="flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs hover:bg-panel">
          <Download size={12} /> Save PCAP
        </button>
        <div className="ml-4 relative">
          <Search size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
          <input
            value={displayFilter}
            onChange={(e) => setDisplayFilter(e.target.value)}
            placeholder="Display filter..."
            className="w-48 rounded-lg border border-line bg-panel py-1.5 pr-8 pl-8 text-xs text-ink outline-none placeholder:text-muted/60 focus:border-accent/60"
          />
          {displayFilter ? (
            <button onClick={() => setDisplayFilter('')} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted">
              <X size={13} />
            </button>
          ) : null}
        </div>
        <span className="ml-auto text-[11px] text-muted">{rows.length} packets</span>
      </div>

      <section className="card overflow-hidden flex-1">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="text-muted sticky top-0 bg-panel">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Protocol</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Destination</th>
                <th className="px-3 py-2 font-medium">Length</th>
                <th className="px-4 py-2 font-medium">Info</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={`${p.t}-${i}`} className="border-b border-line/40 hover:bg-panel2/60 cursor-pointer" onClick={() => setSelected(p)}>
                  <td className="px-4 py-1 font-mono text-[10px]">{new Date(p.t * 1000).toLocaleTimeString()}</td>
                  <td className={`px-3 py-1 font-medium ${protocolColor(p.proto)}`}>{p.proto}</td>
                  <td className="px-3 py-1 font-mono text-[10px]">{p.src}</td>
                  <td className="px-3 py-1 font-mono text-[10px]">{p.dst}</td>
                  <td className="px-3 py-1 text-muted">{p.length}</td>
                  <td className="px-4 py-1 truncate max-w-[200px]">{p.info}</td>
                  <td className="px-2 py-1"><Eye size={12} className="text-muted" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelected(null)}>
          <div className="bg-panel border border-line rounded-lg p-4 max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Packet Details</h3>
              <button onClick={() => setSelected(null)}><X size={16} /></button>
            </div>
            <dl className="space-y-2 text-[11px]">
              <div className="flex justify-between"><dt className="text-muted">Time</dt><dd>{new Date(selected.t * 1000).toISOString()}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Protocol</dt><dd className={protocolColor(selected.proto)}>{selected.proto}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Source</dt><dd className="font-mono">{selected.src}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Destination</dt><dd className="font-mono">{selected.dst}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Length</dt><dd>{selected.length} bytes</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Info</dt><dd>{selected.info || '—'}</dd></div>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  )
}
