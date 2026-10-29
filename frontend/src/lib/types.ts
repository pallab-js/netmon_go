export type TrafficPoint = { t: number; rx: number; tx: number }
export type LatencyPoint = { t: number; ms: number; loss: number }
export type IfaceInfo = { name: string; ip: string; mac: string; mtu: number; speed: number }
export type Conn = {
  pid: number
  process: string
  proto: string
  local: string
  remote: string
  state: string
}
export type Device = {
  mac: string
  ip: string
  hostname: string
  firstSeen: number
  lastSeen: number
  online: boolean
}
export type Snapshot = {
  iface: IfaceInfo
  ifaces: string[]
  rxRate: number
  txRate: number
  latencyMs: number
  lossPct: number
  gateway: string
  conns: number
  devicesOnline: number
  devicesTotal: number
  paused: boolean
  linkUp: boolean
  traffic: TrafficPoint[]
  latency: LatencyPoint[]
  topConns: Conn[]
  updatedAt: number
}
export type TrafficRow = { t: number; rx: number; tx: number }
export type LatencyRow = { t: number; avg: number; max: number; loss: number }
export type History = {
  from: number
  to: number
  step: number
  traffic: TrafficRow[]
  latency: LatencyRow[]
  rxBytes: number
  txBytes: number
  peakRx: number
  peakTx: number
  avgMs: number
  maxLoss: number
}
export type Alert = { t: number; kind: string; message: string }
export type EventRow = { t: number; kind: string; message: string }
export type ScanProgress = { done: number; total: number; running: boolean }
export type Settings = {
  iface: string
  dataPath: string
  dbSize: number
  retentionDays: number
  version: string
}
export type ToastKind = 'info' | 'warn' | 'error' | 'good'
export type ToastMsg = { id: number; kind: ToastKind; message: string }
export type Page = 'overview' | 'history' | 'devices' | 'connections' | 'settings'
