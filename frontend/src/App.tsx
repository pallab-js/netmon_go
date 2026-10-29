import { useCallback, useEffect, useRef, useState } from 'react'
import { EventsOn } from '../wailsjs/runtime/runtime'
import {
  GetSnapshot,
  GetStatus,
  ListDevices,
  ScanLAN,
  SetInterface,
  SetPaused,
} from '../wailsjs/go/main/App'
import { Layout } from './components/Layout'
import { Toasts } from './components/Toast'
import { Overview } from './pages/Overview'
import { HistoryPage } from './pages/History'
import { Devices } from './pages/Devices'
import { Connections } from './pages/Connections'
import { SettingsPage } from './pages/Settings'
import type { Alert, Device, Page, ScanProgress, Snapshot, ToastKind, ToastMsg } from './lib/types'

const alertTone = (kind: string): ToastKind => {
  if (kind.endsWith('_down')) return 'warn'
  if (kind.endsWith('_up')) return 'good'
  if (kind === 'device_new') return 'info'
  return 'info'
}

function App() {
  const [page, setPage] = useState<Page>('overview')
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [scan, setScan] = useState<ScanProgress>({ done: 0, total: 0, running: false })
  const [status, setStatus] = useState('')
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const nextId = useRef(1)

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++
    setToasts((list) => [...list.slice(-3), { id, kind, message }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    GetStatus()
      .then((s) => setStatus(s ?? ''))
      .catch((err) => notify('error', `Status check failed: ${String(err)}`))
    GetSnapshot()
      .then((s) => s && setSnap(s))
      .catch((err) => notify('error', `Could not load snapshot: ${String(err)}`))
    ListDevices()
      .then((d) => setDevices(d ?? []))
      .catch((err) => notify('error', `Could not load devices: ${String(err)}`))

    const offTick = EventsOn('telemetry:tick', (s: Snapshot) => setSnap(s))
    const offDevices = EventsOn('devices:update', (d: Device[]) => setDevices(d ?? []))
    const offScan = EventsOn('scan:progress', (p: ScanProgress) => {
      if (p) setScan(p)
    })
    const offAlert = EventsOn('alert', (a: Alert) => {
      if (a?.message) notify(alertTone(a.kind), a.message)
    })

    return () => {
      offTick()
      offDevices()
      offScan()
      offAlert()
    }
  }, [notify])

  const paused = snap?.paused ?? false

  const togglePause = () => {
    SetPaused(!paused).catch((err) => notify('error', `Could not change sampling: ${String(err)}`))
  }

  const changeInterface = (name: string) => {
    if (!name || name === snap?.iface.name) return
    SetInterface(name)
      .then(() => notify('info', `Monitoring ${name}`))
      .catch((err) => notify('error', `Could not switch interface: ${String(err)}`))
  }

  const scanNow = () => {
    ScanLAN().catch((err) => notify('warn', String(err)))
  }

  return (
    <>
      <Layout
        page={page}
        onPage={setPage}
        snap={snap}
        paused={paused}
        scanning={scan.running}
        onPause={togglePause}
        onIface={changeInterface}
        status={status}
      >
        {page === 'overview' ? <Overview snap={snap} devices={devices} onPage={setPage} /> : null}
        {page === 'history' ? <HistoryPage onToast={notify} /> : null}
        {page === 'devices' ? (
          <Devices devices={devices} scan={scan} onScan={scanNow} onToast={notify} />
        ) : null}
        {page === 'connections' ? <Connections snap={snap} onToast={notify} /> : null}
        {page === 'settings' ? <SettingsPage snap={snap} onToast={notify} /> : null}
      </Layout>
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </>
  )
}

export default App
