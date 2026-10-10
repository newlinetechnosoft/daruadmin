import { useState, useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getOpsBundleFn,
  updateComplaintFn,
} from '#/server/operations/operations.functions'
import type { Complaint } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/shared/page-header'
import { KpiCard } from '#/components/shared/kpi-card'
import { StatusBadge } from '#/components/shared/status-badge'
import {
  Users,
  Search,
  Download,
  Eye,
  MessageSquare,
  ShoppingBag,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '#/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  NativeSelect,
  NativeSelectOption,
} from '#/components/ui/native-select'
import { EmptyState } from '#/components/shared/empty-state'

export const Route = createFileRoute('/admin/customers')({
  loader: async () => {
    return getOpsBundleFn()
  },
  component: AdminCustomersPage,
})

function AdminCustomersPage() {
  const { ops, users } = Route.useLoaderData()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'directory' | 'complaints'>('directory')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  // Aggregate customer metrics from orders
  const customerList = useMemo(() => {
    return users
      .filter((u) => u.role !== 'admin')
      .map((u) => {
        const customerOrders = ops.orders.filter(
          (o) => o.customerId === u.id || o.customerEmail.toLowerCase() === u.email.toLowerCase()
        )
        const totalSpent = customerOrders.reduce((sum, o) => sum + o.total, 0)
        const totalOrders = customerOrders.length
        const lastOrder = customerOrders[0]?.createdAt || u.createdAt

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role || 'customer',
          createdAt: u.createdAt,
          totalSpent,
          totalOrders,
          lastOrder,
          orders: customerOrders,
        }
      })
  }, [users, ops.orders])

  const filteredCustomers = useMemo(() => {
    return customerList.filter((c) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    })
  }, [customerList, searchQuery])

  const filteredComplaints = useMemo(() => {
    return ops.complaints.filter((c) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        c.customerName.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        c.body.toLowerCase().includes(q)
      )
    })
  }, [ops.complaints, searchQuery])

  const totalCustomersCount = customerList.length
  const totalLtvSum = customerList.reduce((sum, c) => sum + c.totalSpent, 0)
  const openComplaintsCount = ops.complaints.filter((c) => c.status === 'open').length

  const handleUpdateComplaintStatus = async (
    id: string,
    status: 'open' | 'in_progress' | 'resolved'
  ) => {
    try {
      setIsUpdating(true)
      await updateComplaintFn({ data: { id, status } })
      toast.success(`Ticket marked as ${status.replace('_', ' ')}`)
      await router.invalidate()
      if (selectedComplaint && selectedComplaint.id === id) {
        setSelectedComplaint({ ...selectedComplaint, status })
      }
    } catch {
      toast.error('Failed to update complaint')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleExportCSV = () => {
    const headers = 'ID,Name,Email,Role,TotalOrders,TotalSpentNPR,LastOrderDate\n'
    const rows = filteredCustomers
      .map(
        (c) =>
          `"${c.id}","${c.name}","${c.email}","${c.role}",${c.totalOrders},${c.totalSpent},"${c.lastOrder}"`
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customers-directory-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('Customer directory exported to CSV')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Commerce"
        title="Customer CRM and support"
        description="View customer lifetime spend, order history, and handle customer service inquiries."
        actions={
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-8 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Export customers
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Registered customers"
          value={totalCustomersCount}
          note="Active customer profiles"
          icon={Users}
        />
        <KpiCard
          label="Cumulative customer LTV"
          value={formatNPR(totalLtvSum)}
          note="Gross customer spending"
          icon={ShoppingBag}
          tone="success"
        />
        <KpiCard
          label="Support complaints"
          value={openComplaintsCount}
          note="Unresolved customer issues"
          icon={MessageSquare}
          tone={openComplaintsCount > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
        <TabsList className="h-9">
          <TabsTrigger value="directory" className="gap-2 text-xs">
            <Users className="h-3.5 w-3.5" />
            <span>Customer directory ({customerList.length})</span>
          </TabsTrigger>
          <TabsTrigger value="complaints" className="gap-2 text-xs">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Support complaints ({ops.complaints.length})</span>
            {openComplaintsCount > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px] font-mono">
                {openComplaintsCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search Bar */}
      <div className="flex rounded-lg border border-border bg-card p-3">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={
              activeTab === 'directory'
                ? 'Search customers by name, email...'
                : 'Search complaints by subject, body, customer...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-9 text-xs"
          />
        </div>
      </div>

      {activeTab === 'directory' ? (
        /* Customer Directory Table */
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Customer name</TableHead>
                <TableHead className="text-xs">Email address</TableHead>
                <TableHead className="text-xs">Total orders</TableHead>
                <TableHead className="text-xs">Lifetime spend</TableHead>
                <TableHead className="text-xs">Joined date</TableHead>
                <TableHead className="text-right text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      title="No customer accounts found"
                      description="Try adjusting your search query."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((cust) => (
                  <TableRow key={cust.id}>
                    <TableCell>
                      <div className="font-medium text-xs text-foreground">{cust.name}</div>
                      <span className="font-mono text-[11px] text-muted-foreground">ID: {cust.id.slice(0, 10)}...</span>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{cust.email}</span>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-xs font-medium text-foreground">{cust.totalOrders}</span>
                      <span className="text-[11px] text-muted-foreground ml-1">orders</span>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                        {formatNPR(cust.totalSpent)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(cust.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCustomer(cust)}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <Eye className="h-3 w-3" />
                        View history
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Complaints Desk Table */
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date and ID</TableHead>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs">Subject</TableHead>
                <TableHead className="text-xs">Issue summary</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-right text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredComplaints.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      title="No support complaints recorded"
                      description="All customer issues are resolved."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredComplaints.map((comp) => (
                  <TableRow key={comp.id}>
                    <TableCell>
                      <span className="font-mono text-xs text-foreground block">{comp.id}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(comp.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="font-medium text-xs text-foreground">{comp.customerName}</div>
                      {comp.orderId && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          Ref: {comp.orderId}
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className="text-xs font-medium text-foreground">{comp.subject}</span>
                    </TableCell>

                    <TableCell>
                      <p className="truncate max-w-xs text-xs text-muted-foreground">{comp.body}</p>
                    </TableCell>

                    <TableCell>
                      <StatusBadge value={comp.status} />
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedComplaint(comp)}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <Eye className="h-3 w-3" />
                        Resolve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Customer Profile Dialog */}
      <Dialog open={Boolean(selectedCustomer)} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
        {selectedCustomer && (
          <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0">
            <DialogHeader className="p-4 border-b border-border">
              <DialogTitle className="text-sm font-semibold">{selectedCustomer.name}</DialogTitle>
              <DialogDescription className="font-mono text-xs">{selectedCustomer.email}</DialogDescription>
            </DialogHeader>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-muted/40 p-3 rounded-md border border-border">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Total spend</span>
                  <span className="font-mono text-sm font-bold text-foreground">
                    {formatNPR(selectedCustomer.totalSpent)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Total orders</span>
                  <span className="font-mono text-sm font-bold text-foreground">
                    {selectedCustomer.totalOrders} bookings
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-xs text-foreground mb-2">
                  Order history ({selectedCustomer.orders.length})
                </h4>
                {selectedCustomer.orders.length === 0 ? (
                  <p className="text-muted-foreground text-xs italic">No past orders placed yet.</p>
                ) : (
                  <div className="border border-border rounded-md overflow-hidden divide-y divide-border/60">
                    {selectedCustomer.orders.map((o: any) => (
                      <div key={o.id} className="p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <strong className="font-mono text-xs text-foreground block">{o.number}</strong>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(o.createdAt).toLocaleDateString()} · {o.items.length} items
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-medium text-foreground block">
                            {formatNPR(o.total)}
                          </span>
                          <StatusBadge value={o.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="p-3 border-t border-border bg-muted/20">
              <Button
                type="button"
                size="sm"
                onClick={() => setSelectedCustomer(null)}
                className="h-8 text-xs"
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Complaint Review Dialog */}
      <Dialog open={Boolean(selectedComplaint)} onOpenChange={(open) => !open && setSelectedComplaint(null)}>
        {selectedComplaint && (
          <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
            <DialogHeader className="p-4 border-b border-border">
              <DialogTitle className="text-sm font-semibold">
                Support ticket: {selectedComplaint.subject}
              </DialogTitle>
              <DialogDescription className="text-xs">From {selectedComplaint.customerName}</DialogDescription>
            </DialogHeader>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              <div className="p-3 bg-muted/40 rounded-md border border-border">
                <span className="text-[10px] font-medium text-muted-foreground block mb-1">
                  Customer message:
                </span>
                <p className="text-foreground leading-relaxed italic">"{selectedComplaint.body}"</p>
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-foreground">
                  Update resolution status:
                </span>
                <NativeSelect
                  value={selectedComplaint.status}
                  onChange={(e) =>
                    handleUpdateComplaintStatus(
                      selectedComplaint.id,
                      e.target.value as 'open' | 'in_progress' | 'resolved'
                    )
                  }
                  disabled={isUpdating}
                  size="sm"
                  className="w-full text-xs"
                >
                  <NativeSelectOption value="open">Open (Under review)</NativeSelectOption>
                  <NativeSelectOption value="in_progress">In progress (Agent contacted)</NativeSelectOption>
                  <NativeSelectOption value="resolved">Resolved and closed</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            <DialogFooter className="p-3 border-t border-border bg-muted/20">
              <Button
                type="button"
                size="sm"
                onClick={() => setSelectedComplaint(null)}
                className="h-8 text-xs"
              >
                Close ticket
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
