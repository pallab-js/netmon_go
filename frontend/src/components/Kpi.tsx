import type { ReactNode } from 'react'
import { Spark } from './Chart'

type Props = {
  label: string
  value: string
  sub?: ReactNode
  color: string
  values?: number[]
}

export function Kpi({ label, value, sub, color, values }: Props) {
  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      </div>
      <div className="text-[26px] leading-none font-semibold tracking-tight">{value}</div>
      {sub ? <div className="text-xs text-muted">{sub}</div> : null}
      <div className="mt-auto pt-1">{values ? <Spark values={values} color={color} /> : null}</div>
    </div>
  )
}
