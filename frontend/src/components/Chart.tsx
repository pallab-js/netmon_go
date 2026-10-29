import { useEffect, useRef } from 'react'
import uPlot from 'uplot'

export type SeriesDef = {
  label: string
  color: string
  fill?: string
  width?: number
}

type Props = {
  data: Array<number[]> | [number[], ...(number[] | null)[]]
  series: SeriesDef[]
  height?: number
  yFormat?: (v: number) => string
  zeroBased?: boolean
  showLegend?: boolean
  // Fixed x window (unix seconds); defaults to the data extent.
  domain?: [number, number]
}

// Axes are drawn on canvas, so these mirror the CSS theme tokens.
const AXIS = '#8b9bb4'
const GRID = '#1f2a37'

export function TimeChart({ data, series, height = 220, yFormat, zeroBased = true, showLegend = false, domain }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<uPlot | null>(null)
  const formatRef = useRef(yFormat)
  formatRef.current = yFormat
  const dataRef = useRef(data)
  dataRef.current = data
  const domainRef = useRef(domain)
  domainRef.current = domain

  const xRange = (): [number, number] => {
    if (domainRef.current) return domainRef.current
    const xs = dataRef.current[0] as number[]
    if (!xs || xs.length === 0) return [0, 60]
    const lo = xs[0]
    const hi = xs[xs.length - 1]
    return hi > lo ? [lo, hi] : [lo - 30, lo + 30]
  }

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const opts: uPlot.Options = {
      width: host.clientWidth || 600,
      height,
      padding: [8, 12, 0, 0],
      legend: { show: showLegend, live: true },
      cursor: { x: true, y: false, points: { size: 6 } },
      scales: {
        x: { time: true, range: xRange },
        y: {
          range: (_u, _min, max) => [0, max <= 0 ? 1 : max * 1.08],
        },
      },
      axes: [
        {
          stroke: AXIS,
          grid: { stroke: GRID, width: 1 },
          ticks: { stroke: GRID, width: 1, size: 4 },
          font: '11px Inter, system-ui, sans-serif',
          size: 26,
          // Wide ticks keep multi-day ranges on day labels instead of 12-hour repeats.
          space: 100,
        },
        {
          stroke: AXIS,
          grid: { stroke: GRID, width: 1 },
          ticks: { stroke: GRID, width: 1, size: 4 },
          font: '11px Inter, system-ui, sans-serif',
          size: 58,
          values: (_u, splits) =>
            zeroBased ? splits.map((v) => (formatRef.current ? formatRef.current(v) : String(v))) : splits.map(String),
        },
      ],
      series: [
        {},
        ...series.map((s) => ({
          label: s.label,
          stroke: s.color,
          fill: s.fill ?? s.color + '1f',
          width: s.width ?? 2,
          points: { show: false },
        })),
      ],
    }
    const chart = new uPlot(opts, data as uPlot.AlignedData, host)
    chartRef.current = chart

    const ro = new ResizeObserver(() => {
      if (hostRef.current && chartRef.current) {
        chartRef.current.setSize({ width: hostRef.current.clientWidth, height })
      }
    })
    ro.observe(host)
    return () => {
      ro.disconnect()
      chart.destroy()
      chartRef.current = null
    }
    // Series/shape are fixed per chart instance; live updates go through setData.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, showLegend, zeroBased])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    // A lone sample draws nothing without points, which reads as an empty chart.
    // uPlot stores this option as a function, so assign one rather than a boolean.
    const single = ((data[0] as number[])?.length ?? 0) === 1
    for (let i = 1; i < chart.series.length; i++) {
      const pts = chart.series[i]?.points
      if (pts) pts.show = () => single
    }
    chart.setData(data as uPlot.AlignedData)
    const [lo, hi] = xRange()
    chart.setScale('x', { min: lo, max: hi })
  }, [data, series, domain])

  return <div ref={hostRef} className="w-full" />
}

type SparkProps = {
  values: number[]
  color: string
  height?: number
}

export function Spark({ values, color, height = 28 }: SparkProps) {
  const n = values.length
  const max = Math.max(1, ...values)
  const points =
    n < 2
      ? `0,${height} 100,${height}`
      : values
          .map((v, i) => `${(i / (n - 1)) * 100},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`)
          .join(' ')
  const id = `sg-${color.replace('#', '')}`
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-7 w-full" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} 100,${height}`} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
