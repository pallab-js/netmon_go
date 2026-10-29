import { useEffect, useRef } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import type { ToastMsg } from '../lib/types'

const style = {
  info: { border: 'border-line', icon: Info, color: 'text-accent' },
  good: { border: 'border-good/40', icon: CheckCircle2, color: 'text-good' },
  warn: { border: 'border-warn/40', icon: AlertTriangle, color: 'text-warn' },
  error: { border: 'border-bad/40', icon: XCircle, color: 'text-bad' },
} as const

function Item({ toast, onDismiss }: { toast: ToastMsg; onDismiss: (id: number) => void }) {
  const s = style[toast.kind]
  const Icon = s.icon
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remainingRef = useRef(6000)
  const startRef = useRef(Date.now())

  const startTimer = () => {
    startRef.current = Date.now()
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onDismiss(toast.id), remainingRef.current)
  }

  const pauseTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
      remainingRef.current -= Date.now() - startRef.current
    }
  }

  useEffect(() => {
    startTimer()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id])

  return (
    <div
      className={`card ${s.border} flex w-80 items-start gap-3 bg-panel2 p-3 shadow-xl`}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      onFocus={pauseTimer}
      onBlur={startTimer}
      role="status"
      aria-live="polite"
    >
      <Icon size={16} className={`${s.color} mt-0.5 shrink-0`} />
      <p className="flex-1 text-xs leading-relaxed text-ink">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-muted transition-colors hover:text-ink"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function Toasts({ toasts, onDismiss }: { toasts: ToastMsg[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-50 flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Item toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  )
}
