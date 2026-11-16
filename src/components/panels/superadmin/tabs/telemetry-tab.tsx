import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Activity,
  Trash2,
  LayoutDashboard,
  Cpu,
  Clock,
  Database,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { SectionHeader } from '../components/section-header'
import { KpiStrip } from '../components/kpi-strip'

interface TelemetryTabProps {
  telemetry?: {
    nodeVersion: string
    environment: string
    dbLatencyMs: number
    dbStatus: string
    uptimeSeconds: number
    memoryUsageMb: {
      heapUsed: number
      heapTotal: number
      rss: number
    }
  } | null
  overview?: {
    totalCustomers: number
    totalDealers: number
    totalRiders: number
    totalProducts: number
    totalVariants: number
  } | null
  totalUsersCount?: number
}

export function TelemetryTab({
  telemetry,
  overview,
}: TelemetryTabProps) {
  const queryClient = useQueryClient()

  const handlePurgeCache = () => {
    queryClient.clear()
    toast.success('QueryClient cache cleared successfully')
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Developer Telemetry & Diagnostics"
        description="Runtime system health, latency indicators, and sandbox controls."
        badge={
          <Badge variant="outline" className="text-xs font-mono border-emerald-500/40 text-emerald-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5 inline-block" />
            Active Runtime
          </Badge>
        }
      />

      {/* Runtime Metrics */}
      {telemetry && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl border border-border bg-card shadow-xs space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
              <Cpu className="h-3.5 w-3.5 text-primary" />
              <span>Node Runtime</span>
            </div>
            <p className="text-base font-bold font-mono text-foreground">
              {telemetry.nodeVersion}
            </p>
            <p className="text-[10px] text-muted-foreground capitalize">
              {telemetry.environment}
            </p>
          </div>

          <div className="p-3 rounded-xl border border-border bg-card shadow-xs space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
              <Database className="h-3.5 w-3.5 text-primary" />
              <span>Database Latency</span>
            </div>
            <p className="text-base font-bold font-mono text-emerald-500">
              {telemetry.dbLatencyMs} ms
            </p>
            <p className="text-[10px] text-muted-foreground">
              Status: {telemetry.dbStatus}
            </p>
          </div>

          <div className="p-3 rounded-xl border border-border bg-card shadow-xs space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>Process Uptime</span>
            </div>
            <p className="text-base font-bold font-mono text-foreground">
              {Math.floor(telemetry.uptimeSeconds / 3600)}h {Math.floor((telemetry.uptimeSeconds % 3600) / 60)}m
            </p>
            <p className="text-[10px] text-muted-foreground">
              Active server worker
            </p>
          </div>

          <div className="p-3 rounded-xl border border-border bg-card shadow-xs space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span>Memory Heap</span>
            </div>
            <p className="text-base font-bold font-mono text-foreground">
              {telemetry.memoryUsageMb.heapUsed} MB
            </p>
            <p className="text-[10px] text-muted-foreground">
              Total: {telemetry.memoryUsageMb.heapTotal} MB
            </p>
          </div>
        </div>
      )}

      {/* Diagnostics & Sandbox Card */}
      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span>Diagnostics & Quick Switch</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-border/70 bg-muted/10 space-y-2">
            <p className="text-xs font-semibold">Purge Query Cache</p>
            <p className="text-[11px] text-muted-foreground">
              Clears all cached TanStack queries and forces clean refetches.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePurgeCache}
              className="text-xs h-7 gap-1.5"
            >
              <Trash2 className="h-3 w-3" />
              <span>Purge Cache</span>
            </Button>
          </div>

          <div className="p-3 rounded-lg border border-border/70 bg-muted/10 space-y-2">
            <p className="text-xs font-semibold">Store Admin Operations</p>
            <p className="text-[11px] text-muted-foreground">
              Switch directly into the operational store manager interface.
            </p>
            <Button
              size="sm"
              variant="secondary"
              asChild
              className="text-xs h-7 gap-1.5"
            >
              <Link to="/admin/orders">
                <LayoutDashboard className="h-3 w-3" />
                <span>Open Store Admin</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Entity Manifest - reused via KpiStrip */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Database Quick Manifest
        </h3>
        <KpiStrip overview={overview} />
      </div>
    </div>
  )
}
