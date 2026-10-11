import {
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { formatNPR } from '#/lib/money'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '#/components/ui/chart'

const CHART_COLORS = [
  'var(--chart-2)',
  'var(--chart-1)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

export function LineChart({
  data,
  valueKey = 'sales',
  money,
}: {
  data: { date: string; [k: string]: string | number }[]
  valueKey?: string
  money?: boolean
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
        No trend data
      </div>
    )
  }

  const chartConfig = {
    [valueKey]: {
      label: money ? 'Revenue' : 'Count',
      color: 'var(--chart-2)',
    },
  } satisfies ChartConfig

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full aspect-auto">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={11}
          stroke="var(--muted-foreground)"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={11}
          stroke="var(--muted-foreground)"
          tickFormatter={(v) => (money ? `Rs ${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}` : `${v}`)}
        />
        <ChartTooltip
          cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
          content={
            <ChartTooltipContent
              indicator="line"
              formatter={(value) => (
                <span className="font-mono font-medium text-foreground">
                  {money ? formatNPR(Number(value)) : String(value)}
                </span>
              )}
            />
          }
        />
        <Area
          type="monotone"
          dataKey={valueKey}
          stroke="var(--chart-2)"
          strokeWidth={2}
          fill="url(#areaGradient)"
        />
      </AreaChart>
    </ChartContainer>
  )
}

export function BarChart({
  data,
}: {
  data: { label: string; value: number }[]
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
        No data
      </div>
    )
  }

  const chartConfig = {
    value: {
      label: 'Orders',
      color: 'var(--chart-2)',
    },
  } satisfies ChartConfig

  const formattedData = data.map((d) => ({
    ...d,
    displayName: d.label.replaceAll('_', ' '),
  }))

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full aspect-auto">
      <RechartsBarChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />
        <XAxis
          dataKey="displayName"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={11}
          stroke="var(--muted-foreground)"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          fontSize={11}
          stroke="var(--muted-foreground)"
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          content={<ChartTooltipContent indicator="dot" />}
        />
        <Bar
          dataKey="value"
          fill="var(--chart-2)"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
      </RechartsBarChart>
    </ChartContainer>
  )
}

export function DoughnutChart({
  data,
}: {
  data: { label: string; value: number }[]
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
        No data
      </div>
    )
  }

  const chartConfig = Object.fromEntries(
    data.map((d, i) => [
      d.label,
      {
        label: d.label.replaceAll('_', ' '),
        color: CHART_COLORS[i % CHART_COLORS.length],
      },
    ])
  ) satisfies ChartConfig

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <ChartContainer config={chartConfig} className="h-[180px] w-[180px] shrink-0 aspect-square">
        <RechartsPieChart>
          <ChartTooltip
            content={<ChartTooltipContent hideLabel />}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={2}
            strokeWidth={1}
            stroke="var(--card)"
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Pie>
        </RechartsPieChart>
      </ChartContainer>
      <ul className="m-0 flex-1 list-none space-y-1.5 p-0">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 capitalize text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              {d.label.replaceAll('_', ' ')}
            </span>
            <span className="font-mono font-medium tabular-nums text-foreground">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
