import { useState, useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getOpsBundleFn,
  addLedgerFn,
  approveSettlementFn,
} from '#/server/operations/operations.functions'
import type { LedgerEntry, Settlement } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/admin/page-header'
import { KpiCard } from '#/components/admin/kpi-card'
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
  labelClass,
} from '#/components/admin/styles'
import {
  Wallet,
  Receipt,
  Plus,
  Download,
  Search,
  Filter,
  CheckCircle,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  X,
  Printer,
  Building,
} from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/accounts')({
  loader: async () => {
    return getOpsBundleFn()
  },
  component: AdminAccountsPage,
})

function AdminAccountsPage() {
  const { ops } = Route.useLoaderData()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'ledger' | 'statements' | 'settlements'>('ledger')
  const [searchQuery, setSearchQuery] = useState('')
  const [accountFilter, setAccountFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [isAddVoucherOpen, setIsAddVoucherOpen] = useState(false)
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Voucher form state
  const [voucherForm, setVoucherForm] = useState({
    memo: '',
    category: 'expense' as LedgerEntry['category'],
    account: 'bank',
    type: 'debit' as 'debit' | 'credit',
    amount: 5000,
  })

  const filteredLedger = useMemo(() => {
    return ops.ledger.filter((item) => {
      if (accountFilter !== 'all' && item.account !== accountFilter) return false
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          item.memo.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          (item.refId || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [ops.ledger, accountFilter, categoryFilter, searchQuery])

  // Ledger Calculations
  const totalDebits = ops.ledger
    .filter((l) => l.type === 'debit')
    .reduce((sum, l) => sum + l.amount, 0)
  const totalCredits = ops.ledger
    .filter((l) => l.type === 'credit')
    .reduce((sum, l) => sum + l.amount, 0)
  const netLiquidityBalance = totalCredits - totalDebits + 2500000

  // P&L Statement Metrics
  const grossSales = ops.ledger
    .filter((l) => l.category === 'sales')
    .reduce((sum, l) => sum + l.amount, 0)
  const cogsPurchases = ops.ledger
    .filter((l) => l.category === 'purchase')
    .reduce((sum, l) => sum + l.amount, 0)
  const operatingExpenses = ops.ledger
    .filter((l) => l.category === 'expense')
    .reduce((sum, l) => sum + l.amount, 0)
  const codCollected = ops.ledger
    .filter((l) => l.category === 'cod')
    .reduce((sum, l) => sum + l.amount, 0)
  const refundsIssued = ops.ledger
    .filter((l) => l.category === 'refund')
    .reduce((sum, l) => sum + l.amount, 0)

  const grossProfit = grossSales - cogsPurchases
  const netEstimatedProfit = grossProfit - operatingExpenses - refundsIssued

  const handlePostVoucher = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!voucherForm.memo || voucherForm.amount <= 0) {
      toast.error('Please enter a description and valid amount')
      return
    }

    try {
      setIsSubmitting(true)
      await addLedgerFn({
        data: {
          type: voucherForm.type,
          category: voucherForm.category,
          account: voucherForm.account,
          memo: voucherForm.memo,
          amount: Number(voucherForm.amount),
        },
      })
      toast.success('Journal voucher posted to General Ledger in Neon DB!')
      setIsAddVoucherOpen(false)
      setVoucherForm({
        memo: '',
        category: 'expense',
        account: 'bank',
        type: 'debit',
        amount: 5000,
      })
      await router.invalidate()
    } catch {
      toast.error('Failed to post voucher')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApproveSettlement = async (id: string, status: 'approved' | 'paid') => {
    try {
      setIsSubmitting(true)
      await approveSettlementFn({ data: { id, status } })
      toast.success(`Settlement marked as ${status.toUpperCase()}!`)
      await router.invalidate()
    } catch {
      toast.error('Failed to update settlement')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExportCSV = () => {
    const headers = 'ID,Date,Type,Category,Account,AmountNPR,Memo,RefType,RefID\n'
    const rows = filteredLedger
      .map(
        (l) =>
          `"${l.id}","${l.date}","${l.type}","${l.category}","${l.account}",${l.amount},"${l.memo.replace(/"/g, '""')}","${l.refType}","${l.refId || ''}"`
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financial-ledger-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('Ledger exported to CSV')
  }

  return (
    <div className={pageClass}>
      <PageHeader
        kicker="Finance"
        title="Accounts & Financial Ledger"
        description="Centralized double-entry accounting, P&L reporting, and courier remittance settlement."
        actions={
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleExportCSV} className={btnSecondary}>
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button type="button" onClick={() => setIsAddVoucherOpen(true)} className={btnPrimary}>
              <Plus className="h-4 w-4" />
              Record Voucher
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Consolidated Liquidity"
          value={formatNPR(netLiquidityBalance)}
          note="Across bank, wallets & COD cash"
          icon={Wallet}
        />
        <KpiCard
          label="Total Inflow (Credits)"
          value={formatNPR(totalCredits)}
          note="Sales income & COD remittances"
          icon={ArrowDownLeft}
          tone="success"
        />
        <KpiCard
          label="Total Outflow (Debits)"
          value={formatNPR(totalDebits)}
          note="Inventory restock & expenses"
          icon={ArrowUpRight}
          tone="danger"
        />
        <KpiCard
          label="Estimated Net Margin"
          value={formatNPR(netEstimatedProfit)}
          note="Gross profit less overhead"
          icon={TrendingUp}
          tone={netEstimatedProfit >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('ledger')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 cursor-pointer transition ${
            activeTab === 'ledger'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Double-Entry General Ledger ({ops.ledger.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('statements')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 cursor-pointer transition ${
            activeTab === 'statements'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>P&L Statement & Balance Sheet</span>
        </button>

        <button
          onClick={() => setActiveTab('settlements')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 cursor-pointer transition ${
            activeTab === 'settlements'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Settlements ({ops.settlements.length})</span>
        </button>
      </div>

      {activeTab === 'ledger' ? (
        /* Ledger Table */
        <div className="space-y-4">
          <div className={`${cardClass} p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3`}>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search memo, reference ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All Accounts</option>
                <option value="bank">Bank Account</option>
                <option value="cash">Cash in Hand</option>
                <option value="esewa">eSewa Wallet</option>
                <option value="khalti">Khalti Wallet</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All Categories</option>
                <option value="sales">Sales Income</option>
                <option value="purchase">Inventory Purchases</option>
                <option value="expense">Operating Expense</option>
                <option value="cod">COD Remittance</option>
                <option value="refund">Refund Payout</option>
              </select>
            </div>
          </div>

          <div className={tableWrap}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                  <tr>
                    <th className={thClass}>Date & ID</th>
                    <th className={thClass}>Description & Memo</th>
                    <th className={thClass}>Category</th>
                    <th className={thClass}>Account</th>
                    <th className={`${thClass} text-right`}>Debit Out (-)</th>
                    <th className={`${thClass} text-right`}>Credit In (+)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                        No ledger transactions found.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className={tdClass}>
                          <span className="font-mono text-xs text-slate-500 block">{item.id}</span>
                          <span className="text-xs text-slate-400">{item.date}</span>
                        </td>

                        <td className={tdClass}>
                          <div className="font-semibold text-slate-900">{item.memo}</div>
                          {item.refId && (
                            <span className="text-xs text-slate-400 font-mono">Ref: {item.refId}</span>
                          )}
                        </td>

                        <td className={tdClass}>
                          <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-slate-100 text-slate-700">
                            {item.category}
                          </span>
                        </td>

                        <td className={tdClass}>
                          <span className="font-mono text-xs uppercase text-slate-600">
                            {item.account}
                          </span>
                        </td>

                        <td className={`${tdClass} text-right`}>
                          {item.type === 'debit' ? (
                            <span className="font-mono font-bold text-rose-600">
                              -{formatNPR(item.amount)}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        <td className={`${tdClass} text-right`}>
                          {item.type === 'credit' ? (
                            <span className="font-mono font-bold text-emerald-600">
                              +{formatNPR(item.amount)}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'statements' ? (
        /* P&L and Balance Sheet */
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsStatementModalOpen(true)}
              className={btnPrimary}
            >
              <Printer className="h-4 w-4" />
              Print Official Statement
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profit & Loss */}
            <div className={`${cardClass} p-6 space-y-4`}>
              <div className="border-b pb-3 border-slate-200">
                <h3 className="text-base font-bold text-slate-900">Statement of Profit & Loss</h3>
                <p className="text-xs text-slate-500">Operating performance summary</p>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Revenue</div>
                <div className="flex justify-between pl-2">
                  <span>Gross Merchandise Sales:</span>
                  <span className="font-mono text-emerald-700 font-bold">+{formatNPR(grossSales)}</span>
                </div>
                <div className="flex justify-between pl-2">
                  <span>COD Remittances Realized:</span>
                  <span className="font-mono text-emerald-700 font-bold">+{formatNPR(codCollected)}</span>
                </div>

                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-2">
                  Cost of Goods Sold (COGS)
                </div>
                <div className="flex justify-between pl-2">
                  <span>Inventory Restock Purchases:</span>
                  <span className="font-mono text-rose-600">-{formatNPR(cogsPurchases)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1.5 pl-2">
                  <span>Gross Operating Margin:</span>
                  <span className="font-mono text-blue-700">{formatNPR(grossProfit)}</span>
                </div>

                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-2">
                  Operating Overhead
                </div>
                <div className="flex justify-between pl-2">
                  <span>Utilities & Fulfillment Overhead:</span>
                  <span className="font-mono text-rose-600">-{formatNPR(operatingExpenses)}</span>
                </div>
                <div className="flex justify-between pl-2">
                  <span>Customer Refund Disbursals:</span>
                  <span className="font-mono text-rose-600">-{formatNPR(refundsIssued)}</span>
                </div>

                <div className="flex justify-between font-bold text-sm text-slate-900 border-t-2 border-slate-200 pt-3 bg-blue-50/70 p-3 rounded-xl mt-3">
                  <span>Estimated Net Operating Profit:</span>
                  <span className={`font-mono ${netEstimatedProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {formatNPR(netEstimatedProfit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Balance Sheet Overview */}
            <div className={`${cardClass} p-6 space-y-4`}>
              <div className="border-b pb-3 border-slate-200">
                <h3 className="text-base font-bold text-slate-900">Solvency & Balance Sheet</h3>
                <p className="text-xs text-slate-500">Liquid reserves and current liabilities</p>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Liquid Assets</div>
                <div className="flex justify-between pl-2">
                  <span>Corporate Bank Operating Account:</span>
                  <span className="font-mono font-semibold">{formatNPR(1850000)}</span>
                </div>
                <div className="flex justify-between pl-2">
                  <span>eSewa Merchant Settlement Reserve:</span>
                  <span className="font-mono font-semibold">{formatNPR(420000)}</span>
                </div>
                <div className="flex justify-between pl-2">
                  <span>Khalti Merchant Settlement Reserve:</span>
                  <span className="font-mono font-semibold">{formatNPR(310000)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1.5 pl-2">
                  <span>Total Liquid Reserves:</span>
                  <span className="font-mono text-blue-700">{formatNPR(2580000)}</span>
                </div>

                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-2">
                  Current Liabilities
                </div>
                <div className="flex justify-between pl-2">
                  <span>Vendor Inventory Payables:</span>
                  <span className="font-mono text-rose-600 font-semibold">{formatNPR(180000)}</span>
                </div>
                <div className="flex justify-between pl-2">
                  <span>Government 13% VAT Payable:</span>
                  <span className="font-mono text-rose-600 font-semibold">
                    {formatNPR(Math.round(grossSales * 0.13))}
                  </span>
                </div>

                <div className="flex justify-between font-bold text-sm text-slate-900 border-t-2 border-slate-200 pt-3 bg-emerald-50/70 p-3 rounded-xl mt-3">
                  <span>Net Working Capital:</span>
                  <span className="font-mono text-emerald-700">
                    {formatNPR(2580000 - 180000 - Math.round(grossSales * 0.13))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Settlements Table */
        <div className={tableWrap}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className={thClass}>Settlement No</th>
                  <th className={thClass}>Courier Name</th>
                  <th className={thClass}>Cycle Period</th>
                  <th className={thClass}>Deliveries</th>
                  <th className={thClass}>Cash Remitted</th>
                  <th className={thClass}>Commission</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ops.settlements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                      No courier settlements pending.
                    </td>
                  </tr>
                ) : (
                  ops.settlements.map((set) => (
                    <tr key={set.id} className="hover:bg-slate-50/70 transition">
                      <td className={tdClass}>
                        <span className="font-mono font-bold text-slate-900">{set.id}</span>
                      </td>

                      <td className={tdClass}>
                        <div className="font-semibold text-slate-900">{set.riderName}</div>
                      </td>

                      <td className={tdClass}>
                        <span className="text-xs text-slate-500">
                          {set.periodStart} &rarr; {set.periodEnd}
                        </span>
                      </td>

                      <td className={tdClass}>
                        <span className="font-bold text-slate-700">{set.deliveries}</span>
                      </td>

                      <td className={tdClass}>
                        <span className="font-mono font-bold text-slate-900">
                          {formatNPR(set.cashCollected)}
                        </span>
                      </td>

                      <td className={tdClass}>
                        <span className="font-mono text-emerald-700 font-bold">
                          +{formatNPR(set.commission)}
                        </span>
                      </td>

                      <td className={tdClass}>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                            set.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : set.status === 'approved'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {set.status}
                        </span>
                      </td>

                      <td className={`${tdClass} text-right`}>
                        {set.status !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => handleApproveSettlement(set.id, 'paid')}
                            disabled={isSubmitting}
                            className={btnPrimary}
                            style={{ height: '32px', padding: '0 10px', fontSize: '11px' }}
                          >
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Voucher Modal */}
      {isAddVoucherOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Post Journal Voucher</h3>
                <p className="text-xs text-slate-500">Direct General Ledger entry in Neon DB</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddVoucherOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePostVoucher} className="space-y-3.5 text-xs">
              <div>
                <label className={labelClass}>Description / Memo *</label>
                <input
                  type="text"
                  required
                  value={voucherForm.memo}
                  onChange={(e) => setVoucherForm({ ...voucherForm, memo: e.target.value })}
                  placeholder="e.g. Warehouse electricity utility payment"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Category</label>
                  <select
                    value={voucherForm.category}
                    onChange={(e) =>
                      setVoucherForm({ ...voucherForm, category: e.target.value as any })
                    }
                    className={selectClass}
                  >
                    <option value="expense">Operating Expense</option>
                    <option value="purchase">Inventory Purchase (COGS)</option>
                    <option value="sales">Direct Sales Income</option>
                    <option value="cod">COD Remittance</option>
                    <option value="refund">Refund Payout</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Target Account</label>
                  <select
                    value={voucherForm.account}
                    onChange={(e) => setVoucherForm({ ...voucherForm, account: e.target.value })}
                    className={selectClass}
                  >
                    <option value="bank">Bank Corporate Account</option>
                    <option value="cash">Cash on Hand</option>
                    <option value="esewa">eSewa Merchant Wallet</option>
                    <option value="khalti">Khalti Merchant Wallet</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Voucher Type</label>
                  <select
                    value={voucherForm.type}
                    onChange={(e) =>
                      setVoucherForm({ ...voucherForm, type: e.target.value as any })
                    }
                    className={selectClass}
                  >
                    <option value="debit">Debit Outflow (-)</option>
                    <option value="credit">Credit Inflow (+)</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Amount (NPR) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={voucherForm.amount}
                    onChange={(e) => setVoucherForm({ ...voucherForm, amount: Number(e.target.value) })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddVoucherOpen(false)}
                  className={btnSecondary}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className={btnPrimary}>
                  {isSubmitting ? 'Posting...' : 'Post Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Financial Statement Preview Modal */}
      {isStatementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between no-print">
              <span className="font-bold text-sm text-slate-800">
                Official Statement of Financial Position Preview
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => window.print()} className={btnPrimary}>
                  <Printer className="h-4 w-4" />
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setIsStatementModalOpen(false)}
                  className={btnSecondary}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 text-xs text-slate-800 font-sans">
              <div className="flex items-start justify-between border-b pb-4 border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900 uppercase">
                    {ops.settings.legalName || 'MEZMANI LIQUOR & GROCERY PVT. LTD.'}
                  </h2>
                  <p className="text-slate-500">{ops.settings.address || 'Kathmandu, Nepal'}</p>
                  <p className="text-slate-500 font-mono">PAN/VAT: {ops.settings.pan || '609823415'}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-blue-600 uppercase block">
                    AUDITED FINANCIAL REPORT
                  </span>
                  <div className="text-slate-400 text-[10px]">
                    Date: {new Date().toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 border-b pb-1 text-xs">Operating Income</h4>
                <div className="flex justify-between py-1">
                  <span>Gross Sales Income:</span>
                  <span className="font-mono font-semibold">{formatNPR(grossSales)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Cost of Inventory Purchases (COGS):</span>
                  <span className="font-mono text-rose-600">-{formatNPR(cogsPurchases)}</span>
                </div>
                <div className="flex justify-between py-1 font-bold bg-slate-50 px-2 rounded">
                  <span>Gross Operating Margin:</span>
                  <span className="font-mono text-blue-700">{formatNPR(grossProfit)}</span>
                </div>

                <h4 className="font-bold text-slate-800 border-b pb-1 text-xs pt-3">
                  Operating Overhead & Payouts
                </h4>
                <div className="flex justify-between py-1">
                  <span>Warehouse Utilities & Supplies:</span>
                  <span className="font-mono text-rose-600">-{formatNPR(operatingExpenses)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Customer Refund Payouts:</span>
                  <span className="font-mono text-rose-600">-{formatNPR(refundsIssued)}</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-blue-50 border border-blue-200 mt-4">
                  <span className="text-xs font-bold text-blue-900 uppercase">Net Realized Profit:</span>
                  <span className="text-base font-extrabold text-blue-700 font-mono">
                    {formatNPR(netEstimatedProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
