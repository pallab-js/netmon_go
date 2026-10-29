import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  Activity,
  Cable,
  ChevronDown,
  History,
  Network,
  Pause,
  Play,
  Radar,
  Settings,
  X,
} from 'lucide-react'
import type { Page, Snapshot } from '../lib/types'
import { clock } from '../lib/format'

const NAV = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'history', label: 'History', icon: History },
  { id: 'devices', label: 'Devices', icon: Network },
  { id: 'connections', label: 'Connections', icon: Cable },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const

const TITLES: Record<Page, { title: string; sub: string }> = {
  overview: { title: 'Overview', sub: 'Live link health, throughput and latency' },
  history: { title: 'History', sub: 'Rolled-up traffic, latency and packet loss' },
  devices: { title: 'Devices', sub: 'Hosts discovered on your local network' },
  connections: { title: 'Connections', sub: 'Active sockets belonging to your user' },
  settings: { title: 'Settings', sub: 'Storage, retention and interface' },
}

type Props = {
  page: Page
  onPage: (p: Page) => void
  snap: Snapshot | null
  paused: boolean
  scanning: boolean
  onPause: () => void
  onIface: (name: string) => void
  status: string
  children: ReactNode
}

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-4 py-5 text-left transition-opacity hover:opacity-80"
      aria-label="Go to overview"
    >
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <rect x="0.5" y="0.5" width="25" height="25" rx="7" fill="#0f2b2a" stroke="#2dd4bf" strokeOpacity="0.5" />
        <path
          d="M6 15.5h3l2-6 3 10 2.5-7 1.5 3H21"
          fill="none"
          stroke="#2dd4bf"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight">NetScope</div>
        <div className="text-[10px] tracking-wide text-muted uppercase">network monitor</div>
      </div>
    </button>
  )
}

export function Layout({ page, onPage, snap, paused, scanning, onPause, onIface, status, children }: Props) {
  const [statusDismissed, setStatusDismissed] = useState(false)
  const live = !paused && snap?.linkUp !== false && Boolean(snap)
  const pill = !snap
    ? { text: 'Connecting', cls: 'text-muted', dot: 'bg-muted' }
    : paused
      ? { text: 'Paused', cls: 'text-warn', dot: 'bg-warn' }
      : !snap.linkUp
        ? { text: 'Link down', cls: 'text-bad', dot: 'bg-bad' }
        : { text: 'Live', cls: 'text-accent', dot: 'bg-accent' }

  const ifaces = snap?.ifaces && snap.ifaces.length > 0 ? snap.ifaces : []
  const hasIface = Boolean(snap?.iface.name)

  return (
    <div className="flex h-full w-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-panel">
        <Brand onClick={() => onPage('overview')} />

        <nav className="flex flex-col gap-0.5 px-2" aria-label="Main">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = page === id
            return (
              <button
                key={id}
                onClick={() => onPage(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                  active
                    ? 'bg-accent/10 font-medium text-accent'
                    : 'text-muted hover:bg-panel2 hover:text-ink'
                }`}
              >
                <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                {label}
                {id === 'devices' && snap && snap.devicesOnline > 0 ? (
                  <span className="ml-auto text-[10px] text-muted">{snap.devicesOnline}</span>
                ) : null}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto space-y-2 border-t border-line p-4 text-[11px] text-muted">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${pill.dot} ${live ? 'animate-pulse' : ''}`} />
            <span className="text-ink">{pill.text}</span>
            {scanning ? (
              <span className="ml-auto flex items-center gap-1 text-accent">
                <Radar size={12} className="animate-spin" /> scan
              </span>
            ) : null}
          </div>
          <div className="flex justify-between gap-2">
            <span>Gateway</span>
            <span className="text-ink/80">{snap?.gateway || '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Updated</span>
            <span className="text-ink/80">{paused ? 'Paused' : clock(snap?.updatedAt ?? 0)}</span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel/60 px-6 backdrop-blur">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight">{TITLES[page].title}</h1>
            <p className="truncate text-[11px] text-muted">{TITLES[page].sub}</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <select
                value={hasIface ? snap?.iface.name : ''}
                onChange={(e) => onIface(e.target.value)}
                aria-label="Interface"
                disabled={!hasIface && ifaces.length === 0}
                className="appearance-none rounded-lg border border-line bg-panel2 py-1.5 pr-7 pl-2.5 text-xs text-ink outline-none focus:border-accent/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {ifaces.length === 0 ? (
                  <option value="">{hasIface ? snap?.iface.name : 'No interfaces'}</option>
                ) : (
                  ifaces.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-muted" />
            </div>

            <button
              onClick={onPause}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-panel2 px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-ink"
            >
              {paused ? <Play size={13} /> : <Pause size={13} />}
              {paused ? 'Resume' : 'Pause'}
            </button>

            <span
              className={`flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] ${pill.cls}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
              {pill.text}
            </span>
          </div>
        </header>

        {status && !statusDismissed ? (
          <div className="flex items-center gap-3 border-b border-bad/30 bg-bad/10 px-6 py-2 text-xs text-bad">
            <span className="flex-1">{status}</span>
            <button
              onClick={() => setStatusDismissed(true)}
              className="text-bad/70 transition-colors hover:text-bad"
              aria-label="Dismiss status"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</main>
      </div>
    </div>
  )
}
