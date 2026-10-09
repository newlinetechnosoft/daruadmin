import { useState, useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getOpsBundleFn,
  updateComplaintFn,
} from '#/server/operations/operations.functions'
import type { Complaint } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/admin/page-header'
import { KpiCard } from '#/components/admin/kpi-card'
import { StatusBadge } from '#/components/admin/status-badge'
import {
  pageClass,
  cardClass,
  tableWrap,
  thClass,
  tdClass,
  btnPrimary,
  btnSecondary,
  btnGhost,
  inputClass,
  selectClass,
} from '#/components/admin/styles'
import {
  Users,
  Search,
  Filter,
  Download,
  Eye,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Clock,
  Mail,
  Phone,
  ShoppingBag,
  X,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'

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
    <div className={pageClass}>
      <PageHeader
        kicker="Commerce"
        title="Customer CRM & Support"
        description="View customer lifetime spend, order history, and handle customer service inquiries."
        actions={
          <button type="button" onClick={handleExportCSV} className={btnSecondary}>
            <Download className="h-4 w-4" />
            Export Customers
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Registered Customers"
          value={totalCustomersCount}
          note="Active customer profiles"
          icon={Users}
        />
        <KpiCard
          label="Cumulative Customer LTV"
          value={formatNPR(totalLtvSum)}
          note="Gross customer spending"
          icon={ShoppingBag}
          tone="success"
        />
        <KpiCard
          label="Support Complaints"
          value={openComplaintsCount}
          note="Unresolved customer issues"
          icon={MessageSquare}
          tone={openComplaintsCount > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('directory')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 cursor-pointer transition ${
            activeTab === 'directory'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Customer Directory ({customerList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('complaints')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 cursor-pointer transition ${
            activeTab === 'complaints'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Support Complaints ({ops.complaints.length})</span>
          {openComplaintsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              {openComplaintsCount}
            </span>
          )}
        </button>
      </div>

      {/* Search Input */}
      <div className={`${cardClass} p-4`}>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeTab === 'directory'
                ? 'Search customers by name, email...'
                : 'Search complaints by subject, body, customer...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>

      {activeTab === 'directory' ? (
        /* Customer Directory Table */
        <div className={tableWrap}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className={thClass}>Customer Name</th>
                  <th className={thClass}>Email Address</th>
                  <th className={thClass}>Total Orders</th>
                  <th className={thClass}>Lifetime Spend</th>
                  <th className={thClass}>Joined Date</th>
                  <th className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                      No customer accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-slate-50/70 transition">
                      <td className={tdClass}>
                        <div className="font-semibold text-slate-900">{cust.name}</div>
                        <span className="text-xs text-slate-400 font-mono">ID: {cust.id}</span>
                      </td>

                      <td className={tdClass}>
                        <div className="text-slate-600 font-mono text-xs">{cust.email}</div>
                      </td>

                      <td className={tdClass}>
                        <span className="font-bold text-slate-800">{cust.totalOrders}</span>
                        <span className="text-xs text-slate-400 ml-1">orders</span>
                      </td>

                      <td className={tdClass}>
                        <span className="font-mono font-bold text-slate-900">
                          {formatNPR(cust.totalSpent)}
                        </span>
                      </td>

                      <td className={tdClass}>
                        <span className="text-xs text-slate-500">
                          {new Date(cust.createdAt).toLocaleDateString()}
                        </span>
                      </td>

                      <td className={`${tdClass} text-right`}>
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(cust)}
                          className={btnSecondary}
                          style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View History
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Complaints Desk Table */
        <div className={tableWrap}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className={thClass}>Date & ID</th>
                  <th className={thClass}>Customer</th>
                  <th className={thClass}>Subject</th>
                  <th className={thClass}>Issue Summary</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                      No support complaints recorded.
                    </td>
                  </tr>
                ) : (
                  filteredComplaints.map((comp) => (
                    <tr key={comp.id} className="hover:bg-slate-50/70 transition">
                      <td className={tdClass}>
                        <span className="font-mono text-xs text-slate-500 block">{comp.id}</span>
                        <span className="text-xs text-slate-400">
                          {new Date(comp.createdAt).toLocaleDateString()}
                        </span>
                      </td>

                      <td className={tdClass}>
                        <div className="font-semibold text-slate-900">{comp.customerName}</div>
                        {comp.orderId && (
                          <span className="text-xs text-blue-600 font-mono">
                            Ref: {comp.orderId}
                          </span>
                        )}
                      </td>

                      <td className={tdClass}>
                        <span className="font-semibold text-slate-800">{comp.subject}</span>
                      </td>

                      <td className={tdClass}>
                        <p className="text-xs text-slate-600 truncate max-w-xs">{comp.body}</p>
                      </td>

                      <td className={tdClass}>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-0.5 rounded ${
                            comp.status === 'resolved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : comp.status === 'in_progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {comp.status.replace('_', ' ')}
                        </span>
                      </td>

                      <td className={`${tdClass} text-right`}>
                        <button
                          type="button"
                          onClick={() => setSelectedComplaint(comp)}
                          className={btnSecondary}
                          style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Resolve
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Profile Drawer */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedCustomer.name}</h3>
                <p className="text-xs text-slate-500 font-mono">{selectedCustomer.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Spend</span>
                  <span className="text-base font-bold text-slate-900 font-mono">
                    {formatNPR(selectedCustomer.totalSpent)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Orders</span>
                  <span className="text-base font-bold text-blue-600">
                    {selectedCustomer.totalOrders} bookings
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">
                  Order History ({selectedCustomer.orders.length})
                </h4>
                {selectedCustomer.orders.length === 0 ? (
                  <p className="text-slate-400 italic">No past orders placed yet.</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {selectedCustomer.orders.map((o: any) => (
                      <div key={o.id} className="p-3 flex items-center justify-between">
                        <div>
                          <strong className="font-mono text-slate-900 block">{o.number}</strong>
                          <span className="text-[11px] text-slate-500">
                            {new Date(o.createdAt).toLocaleDateString()} &bull; {o.items.length} items
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-900 block">
                            {formatNPR(o.total)}
                          </span>
                          <StatusBadge status={o.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className={btnPrimary}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complaint Review Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Support Ticket: {selectedComplaint.subject}
                </h3>
                <p className="text-xs text-slate-500">From {selectedComplaint.customerName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedComplaint(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Customer Message:
                </span>
                <p className="text-slate-700 leading-relaxed italic">"{selectedComplaint.body}"</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Update Resolution Status:
                </label>
                <select
                  value={selectedComplaint.status}
                  onChange={(e) =>
                    handleUpdateComplaintStatus(
                      selectedComplaint.id,
                      e.target.value as 'open' | 'in_progress' | 'resolved'
                    )
                  }
                  disabled={isUpdating}
                  className={selectClass}
                >
                  <option value="open">Open (Under Review)</option>
                  <option value="in_progress">In Progress (Agent Contacted)</option>
                  <option value="resolved">Resolved & Closed</option>
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedComplaint(null)}
                className={btnPrimary}
              >
                Close Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
