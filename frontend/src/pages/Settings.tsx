import { useEffect, useState } from 'react'
import { FolderOpen, Trash2 } from 'lucide-react'
import { ClearHistory, GetSettings, OpenDataFolder } from '../../wailsjs/go/main/App'
import type { Settings, Snapshot, ToastKind } from '../lib/types'
import { formatBytes, formatSpeed } from '../lib/format'

type Props = { snap: Snapshot | null; onToast: (kind: ToastKind, message: string) => void }

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-line/60 py-1.5 last:border-0">
      <span className="text-muted">{k}</span>
      <span className={`max-w-[70%] text-right break-all text-ink/90 ${mono ? 'font-mono text-[10px]' : ''}`}>{v}</span>
    </div>
  )
}

export function SettingsPage({ snap, onToast }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null)

  const refresh = () => GetSettings().then(setSettings).catch(() => undefined)

  useEffect(() => {
    void refresh()
  }, [])

  const clear = async () => {
    if (!window.confirm('Delete all recorded traffic, latency, device and event history? This cannot be undone.')) return
    try {
      await ClearHistory()
      onToast('good', 'History cleared')
      void refresh()
    } catch (err) {
      onToast('error', `Could not clear history: ${String(err)}`)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section className="card p-4 text-[11px]">
        <h2 className="mb-1 text-[13px] font-medium">Interface</h2>
        <p className="mb-3 text-muted">Switch the monitored interface from the header.</p>
        <Row k="Name" v={snap?.iface.name || '—'} />
        <Row k="IPv4" v={snap?.iface.ip || '—'} />
        <Row k="MAC" v={snap?.iface.mac || '—'} />
        <Row k="MTU" v={snap?.iface.mtu ? String(snap.iface.mtu) : '—'} />
        <Row k="Link speed" v={formatSpeed(snap?.iface.speed ?? 0)} />
        <Row k="Gateway" v={snap?.gateway || '—'} />
      </section>

      <section className="card p-4 text-[11px]">
        <h2 className="mb-1 text-[13px] font-medium">Storage</h2>
        <p className="mb-3 text-muted">SQLite in WAL mode, written every 10 seconds.</p>
        <Row k="Database" v={settings?.dataPath || '—'} mono />
        <Row k="Size" v={formatBytes(settings?.dbSize ?? 0)} />
        <Row k="Retention" v={`${settings?.retentionDays ?? 30} days of traffic and latency`} />
        <Row k="Live buffer" v="3 minutes at 1 Hz (memory only)" />
        <Row k="Events" v="kept for 90 days" />
      </section>

      <section className="card p-4">
        <h2 className="mb-1 text-[13px] font-medium">Maintenance</h2>
        <p className="mb-4 text-[11px] text-muted">Export CSV from the History view.</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void OpenDataFolder()}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-2.5 py-1.5 text-[11px] text-muted transition-colors hover:text-ink"
          >
            <FolderOpen size={12} /> Open data folder
          </button>
          <button
            onClick={() => void clear()}
            className="flex items-center gap-1.5 rounded-lg border border-bad/40 bg-bad/10 px-2.5 py-1.5 text-[11px] text-bad transition-colors hover:bg-bad/15"
          >
            <Trash2 size={12} /> Clear history
          </button>
        </div>
      </section>

      <section className="card p-4 text-[11px]">
        <h2 className="mb-1 text-[13px] font-medium">About</h2>
        <p className="mb-3 text-muted">Everything stays on this machine.</p>
        <Row k="Version" v={settings?.version || '0.1.0'} />
        <Row k="Stack" v="Go · Wails v2 · React · SQLite" />
        <Row k="Sampling" v="1 s counters · 2 s latency · 2 s sockets · 60 s ARP" />
        <Row k="Permissions" v="Runs unprivileged; no per-process bandwidth" />
        <Row k="Network use" v="ICMP probes and reverse DNS only" />
      </section>
    </div>
  )
}
