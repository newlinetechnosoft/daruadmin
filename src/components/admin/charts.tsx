import { useState } from 'react'
import { formatNPR } from '#/lib/money'

const PALETTE = ['#2563eb', '#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#64748b']

export function LineChart({
  data,
  valueKey = 'sales',
  money,
}: {
  data: { date: string; [k: string]: string | number }[]
  valueKey?: string
  money?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No trend data</p>
  }
  const values = data.map((d) => Number(d[valueKey] ?? 0))
  const max = Math.max(...values, 1)
  const w = 640
  const h = 220
  const pad = 28
  const points = values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(values.length - 1, 1)
    const y = h - pad - (v / max) * (h - pad * 2)
    return { x, y, v, label: data[i].date }
  })
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  const area = `${path} L ${points[points.length - 1].x} ${h - pad} L ${points[0].x} ${h - pad} Z`
  const tip = hover !== null ? points[hover] : null

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[220px] w-full" role="img">
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={pad}
            x2={w - pad}
            y1={pad + t * (h - pad * 2)}
            y2={pad + t * (h - pad * 2)}
            stroke="#e2e8f0"
            strokeDasharray="4 4"
          />
        ))}
        <path d={area} fill="url(#salesFill)" />
        <path d={path} fill="none" stroke="#2563eb" strokeWidth="2.5" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hover === i ? 5 : 3}
            fill="#2563eb"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      {tip && (
        <div className="pointer-events-none absolute top-2 right-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
          <div className="font-medium text-slate-500">{tip.label}</div>
          <div className="font-semibold text-slate-900">
            {money ? formatNPR(tip.v) : tip.v}
          </div>
        </div>
      )}
    </div>
  )
}

export function BarChart({
  data,
}: {
  data: { label: string; value: number }[]
}) {
  const [hover, setHover] = useState<number | null>(null)
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No data</p>
  }
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex h-[220px] items-end gap-2 px-1">
      {data.map((d, i) => (
        <div
          key={d.label}
          className="flex min-w-0 flex-1 flex-col items-center gap-2"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        >
          <div className="relative flex h-[170px] w-full items-end justify-center">
            {hover === i && (
              <span className="absolute -top-6 rounded bg-slate-900 px-2 py-0.5 text-[10px] text-white">
                {d.value}
              </span>
            )}
            <div
              className="w-full max-w-10 rounded-t-md bg-blue-600 transition-opacity hover:opacity-80"
              style={{ height: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span className="w-full truncate text-center text-[10px] capitalize text-slate-500">
            {d.label.replaceAll('_', ' ')}
          </span>
        </div>
      ))}
    </div>
  )
}

export function DoughnutChart({
  data,
}: {
  data: { label: string; value: number }[]
}) {
  const [hover, setHover] = useState<number | null>(null)
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  let acc = 0
  const size = 180
  const r = 62
  const c = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-44 w-44">
        <g transform={`translate(${size / 2} ${size / 2}) rotate(-90)`}>
          {data.map((d, i) => {
            const frac = d.value / total
            const dash = frac * c
            const gap = c - dash
            const offset = acc
            acc += dash
            return (
              <circle
                key={d.label}
                r={r}
                cx={0}
                cy={0}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={hover === i ? 22 : 18}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            )
          })}
        </g>
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          className="fill-slate-900 text-xl font-semibold"
        >
          {hover !== null ? data[hover].value : total}
        </text>
        <text
          x="50%"
          y="60%"
          textAnchor="middle"
          className="fill-slate-500 text-[10px]"
        >
          {hover !== null ? data[hover].label.replaceAll('_', ' ') : 'Total'}
        </text>
      </svg>
      <ul className="m-0 flex-1 list-none space-y-2 p-0">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 capitalize text-slate-600">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              {d.label.replaceAll('_', ' ')}
            </span>
            <span className="font-semibold tabular-nums text-slate-900">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
