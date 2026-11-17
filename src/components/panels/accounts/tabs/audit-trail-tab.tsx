import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { formatNPR } from '#/lib/money'
import {
  Activity,
  Clock,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'

export function AuditTrailTab() {
  const [activeSubTab, setActiveSubTab] = useState<
    'activity' | 'approvals' | 'reversals' | 'exports'
  >('activity')

  // Search & filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Queries
  const { data: auditLogsData, refetch: refetchLogs } = useSuspenseQuery(
    adminQueries.financialAuditLogs({
      action: actionFilter === 'all' ? undefined : actionFilter,
      search: searchTerm.trim() || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      limit: 100,
    }),
  )

  const { data: approvalLogs = [], refetch: refetchApprovals } = useSuspenseQuery(
    adminQueries.voucherApprovalLogs(100),
  )

  const { data: reversals = [], refetch: refetchReversals } = useSuspenseQuery(
    adminQueries.reversalAuditHistory(),
  )

  const { data: exportLogs = [], refetch: refetchExports } = useSuspenseQuery(
    adminQueries.exportAuditLogs(),
  )

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
        return <Badge className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400">Create</Badge>
      case 'approve':
        return <Badge className="bg-blue-600/10 text-blue-700 dark:text-blue-400">Approve</Badge>
      case 'reject':
        return <Badge className="bg-red-600/10 text-red-700 dark:text-red-400">Reject</Badge>
      case 'reverse':
        return <Badge className="bg-amber-600/10 text-amber-700 dark:text-amber-400">Reverse</Badge>
      case 'close':
        return <Badge className="bg-purple-600/10 text-purple-700 dark:text-purple-400">Close</Badge>
      case 'export':
        return <Badge className="bg-cyan-600/10 text-cyan-700 dark:text-cyan-400">Export</Badge>
      default:
        return <Badge variant="outline">{action}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-2.5">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Financial Audit Trail & Compliance Center
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Immutable user activity tracking, maker-checker authorization histories, reversal trails, and report export logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchLogs()
              refetchApprovals()
              refetchReversals()
              refetchExports()
            }}
          >
            <Clock className="h-4 w-4 mr-1.5" />
            Refresh Trail
          </Button>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <Tabs
        value={activeSubTab}
        onValueChange={(v) => setActiveSubTab(v as any)}
        className="w-full"
      >
        <TabsList className="grid grid-cols-4 max-w-xl">
          <TabsTrigger value="activity" className="text-xs">
            <Activity className="h-3.5 w-3.5 mr-1.5" />
            Activity Log
          </TabsTrigger>
          <TabsTrigger value="approvals" className="text-xs">
            <UserCheck className="h-3.5 w-3.5 mr-1.5" />
            Voucher Approvals
          </TabsTrigger>
          <TabsTrigger value="reversals" className="text-xs">
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reversal History
          </TabsTrigger>
          <TabsTrigger value="exports" className="text-xs">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export Logs
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab 1: General Financial Activity Log */}
      {activeSubTab === 'activity' && (
        <Card className="border-border shadow-xs">
          <CardHeader className="py-3 px-4 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Accounting User Action Trail ({auditLogsData.totalCount} entries)
              </CardTitle>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search user or detail..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 text-xs pl-8 w-44 sm:w-56"
                  />
                </div>

                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs shadow-xs"
                >
                  <option value="all">All Actions</option>
                  <option value="create">Create</option>
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                  <option value="reverse">Reverse</option>
                  <option value="close">Close</option>
                  <option value="export">Export</option>
                </select>

                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-8 text-xs w-32"
                  placeholder="From"
                />
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-8 text-xs w-32"
                  placeholder="To"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {auditLogsData.items.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No financial audit logs matching current filter parameters.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Timestamp</TableHead>
                    <TableHead className="w-32">Actor</TableHead>
                    <TableHead className="w-24">Action</TableHead>
                    <TableHead>Event Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogsData.items.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.createdAt.slice(0, 19).replace('T', ' ')}
                      </TableCell>
                      <TableCell className="font-medium text-xs text-foreground">
                        {log.actor}
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell className="text-xs text-foreground">
                        {log.detail}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Voucher Maker-Checker Approvals */}
      {activeSubTab === 'approvals' && (
        <Card className="border-border shadow-xs">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" />
              Maker-Checker Authorization Trail ({approvalLogs.length} entries)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {approvalLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No voucher approval logs recorded yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Voucher No</TableHead>
                    <TableHead className="w-20">Type</TableHead>
                    <TableHead>Narration</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Submitted At</TableHead>
                    <TableHead>Approved By</TableHead>
                    <TableHead>Approved At</TableHead>
                    <TableHead className="w-24 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvalLogs.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {item.voucherNo || item.id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {item.voucherType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-foreground max-w-xs truncate">
                        {item.narration}
                      </TableCell>
                      <TableCell className="text-xs text-right font-semibold font-mono">
                        {formatNPR(item.totalAmount)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.submittedBy || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {item.submittedAt ? item.submittedAt.slice(0, 16).replace('T', ' ') : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-emerald-600 font-medium">
                        {item.approvedBy || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {item.approvedAt ? item.approvedAt.slice(0, 16).replace('T', ' ') : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={item.postingStatus === 'submitted' ? 'default' : 'secondary'}
                          className={`text-[10px] ${
                            item.postingStatus === 'submitted'
                              ? 'bg-emerald-600/10 text-emerald-700'
                              : 'bg-amber-600/10 text-amber-700'
                          }`}
                        >
                          {item.postingStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Reversal Audit History */}
      {activeSubTab === 'reversals' && (
        <Card className="border-border shadow-xs">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-amber-600" />
              Voucher Reversal Audit Trail ({reversals.length} pairs)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {reversals.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No reversal vouchers recorded. All posted entries remain unreversibly active.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Original Voucher</TableHead>
                    <TableHead>Original Date</TableHead>
                    <TableHead>Original Amount</TableHead>
                    <TableHead>Reversal Voucher</TableHead>
                    <TableHead>Reversal Date</TableHead>
                    <TableHead>Reversal Narration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reversals.map((pair, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        {pair.original.voucherNo || pair.original.id}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {pair.original.postingDate.slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-xs font-semibold font-mono">
                        {formatNPR(pair.original.totalAmount)}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-amber-600">
                        {pair.reversal.voucherNo || pair.reversal.id}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {pair.reversal.postingDate.slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-xs text-foreground max-w-sm truncate">
                        {pair.reversal.narration}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Export Audit Logs */}
      {activeSubTab === 'exports' && (
        <Card className="border-border shadow-xs">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Download className="h-4 w-4 text-cyan-600" />
              Financial Report Export Trail ({exportLogs.length} events)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {exportLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No financial export logs recorded yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">Export Timestamp</TableHead>
                    <TableHead className="w-36">Exported By</TableHead>
                    <TableHead>Report & Format Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exportLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.createdAt.slice(0, 19).replace('T', ' ')}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">
                        {log.actor}
                      </TableCell>
                      <TableCell className="text-xs text-foreground flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-cyan-600 shrink-0" />
                        {log.detail}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
