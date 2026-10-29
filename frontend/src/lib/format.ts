const SI = ['b/s', 'Kb/s', 'Mb/s', 'Gb/s', 'Tb/s']
const BYTES = ['B', 'KB', 'MB', 'GB', 'TB']

// Input is bytes/sec; network rates read better in bits.
export function formatRate(bytesPerSec: number): string {
  if (!isFinite(bytesPerSec) || bytesPerSec <= 0) return '0 b/s'
  let v = bytesPerSec * 8
  let i = 0
  while (v >= 1000 && i < SI.length - 1) {
    v /= 1000
    i++
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${SI[i]}`
}

export function formatBytes(bytes: number): string {
  if (!isFinite(bytes) || bytes <= 0) return '0 B'
  let v = bytes
  let i = 0
  while (v >= 1000 && i < BYTES.length - 1) {
    v /= 1000
    i++
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${BYTES[i]}`
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  return String(n)
}

export function formatMs(ms: number): string {
  if (!isFinite(ms) || ms <= 0) return '—'
  return `${ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms`
}

export function formatLoss(loss: number): string {
  if (!isFinite(loss)) return '—'
  return `${Math.round(loss)}%`
}

export function formatSpeed(bitsPerSec: number): string {
  if (!bitsPerSec) return '—'
  const units = ['bit/s', 'Kb/s', 'Mb/s', 'Gb/s']
  let v = bitsPerSec
  let i = 0
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000
    i++
  }
  return `${Math.round(v)} ${units[i]}`
}

export function clock(tsSeconds: number): string {
  if (!tsSeconds) return '—'
  return new Date(tsSeconds * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function dateTime(tsSeconds: number): string {
  if (!tsSeconds) return '—'
  return new Date(tsSeconds * 1000).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ago(tsSeconds: number): string {
  if (!tsSeconds) return '—'
  const secs = Math.max(0, Math.round(Date.now() / 1000 - tsSeconds))
  if (secs < 10) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function shortMac(mac: string): string {
  if (!mac || mac.startsWith('ip-')) return '—'
  return mac
}
