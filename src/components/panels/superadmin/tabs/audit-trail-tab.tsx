import { useState, useMemo } from 'react'
import {
  Download,
  Search,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { exportSuperAdminAuditLogsFn } from '#/server/superadmin/superadmin.functions'
import { downloadCsvFile } from '#/lib/csv-helper'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent } from '#/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { SectionHeader } from '../components/section-header'

interface AuditLogItem {
  id: string
  actor: string
  action: string
  module: string
  detail: string
  createdAt?: string | Date | null
}

interface AuditTrailTabProps {
  logs?: AuditLogItem[]
}

export function AuditTrailTab({ logs = [] }: AuditTrailTabProps) {
  const [auditSearch, setAuditSearch] = useState('')
  const [auditModuleFilter, setAuditModuleFilter] = useState('all')
  const [isExporting, setIsExporting] = useState(false)

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = auditSearch.toLowerCase().trim()
      const matchesSearch =
        !q ||
        log.actor.toLowerCase().includes(q) ||
        log.detail.toLowerCase().includes(q)

      const matchesModule =
        auditModuleFilter === 'all' ||
        log.module.toLowerCase() === auditModuleFilter.toLowerCase()

      return matchesSearch && matchesModule
    })
  }, [logs, auditSearch, auditModuleFilter])

  const handleExport = async () => {
    try {
      setIsExporting(true)
      const res = await exportSuperAdminAuditLogsFn()
      downloadCsvFile(res.filename, res.csv)
      toast.success(`Exported ${res.count} audit log records`)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export audit logs')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Live System Audit Trail"
        description="Chronological stream of configuration changes, role updates, and imports."
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            className="h-8 text-xs gap-1.5"
          >
            {isExporting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Export Audit CSV</span>
          </Button>
        }
      />

      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardContent className="p-4 space-y-3">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search audit events by actor or details..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={auditModuleFilter} onValueChange={setAuditModuleFilter}>
                <SelectTrigger className="text-xs h-8 w-[140px]">
                  <SelectValue placeholder="Module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  <SelectItem value="superadmin">Super Admin</SelectItem>
                  <SelectItem value="auth">Auth & Security</SelectItem>
                  <SelectItem value="catalog">Catalog</SelectItem>
                  <SelectItem value="orders">Orders</SelectItem>
                  <SelectItem value="dealers">Dealers</SelectItem>
                  <SelectItem value="settings">Settings</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="text-xs font-mono px-2 py-1 shrink-0">
                {filteredLogs.length} Events
              </Badge>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-xs font-bold py-2 w-[160px]">Timestamp</TableHead>
                  <TableHead className="text-xs font-bold py-2 w-[140px]">Actor</TableHead>
                  <TableHead className="text-xs font-bold py-2 w-[110px]">Module</TableHead>
                  <TableHead className="text-xs font-bold py-2 w-[90px]">Action</TableHead>
                  <TableHead className="text-xs font-bold py-2">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                      No audit events recorded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} className="text-xs hover:bg-muted/20">
                      <TableCell className="font-mono text-muted-foreground py-2 whitespace-nowrap">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground py-2">
                        {log.actor}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className="text-[10px] font-mono uppercase px-1 py-0">
                          {log.module}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="secondary"
                          className={
                            log.action === 'create'
                              ? 'text-emerald-500 bg-emerald-500/10 text-[10px] px-1 py-0'
                              : log.action === 'delete'
                                ? 'text-rose-500 bg-rose-500/10 text-[10px] px-1 py-0'
                                : 'text-cyan-500 bg-cyan-500/10 text-[10px] px-1 py-0'
                          }
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-[11px] py-2">
                        {log.detail}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
