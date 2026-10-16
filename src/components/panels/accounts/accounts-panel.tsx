import { useState, useMemo } from 'react'
import {
  getRouteApi,
  useNavigate,
  useRouter,
  Link,
} from '@tanstack/react-router'
import {
  addLedgerFn,
  approveSettlementFn,
} from '#/server/operations/operations.functions'
import type { LedgerEntry } from '#/server/operations/types'
import { formatNPR, toPaisa } from '#/lib/money'
import { PageHeader } from '#/components/shared/page-header'
import { KpiCard } from '#/components/shared/kpi-card'
import {
  Wallet,
  Receipt,
  Plus,
  Download,
  Search,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Printer,
  CreditCard,
  Store,
  ShoppingBag,
  Wine,
  UserCheck,
  Clock,
  Phone,
  BadgePercent,
  Truck,
  Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Badge } from '#/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Card, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { EmptyState } from '#/components/shared/empty-state'
import { Progress } from '#/components/ui/progress'

const routeApi = getRouteApi('/admin/accounts')

type SubAccountTab =
  | 'ledger'
  | 'transactions'
  | 'dealer-ledger'
  | 'sales-account'
  | 'salary-account'

export function AccountsPanel() {
  const { ops } = routeApi.useLoaderData()
  const search = routeApi.useSearch()
  const navigate = useNavigate()
  const router = useRouter()

  const activeTab: SubAccountTab = search.tab || 'ledger'

  const setActiveTab = (tab: SubAccountTab) => {
    navigate({
      to: '/admin/accounts',
      search: { tab },
    })
  }

  // General Ledger state
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Transactions state
  const [txSearch, setTxSearch] = useState('')
  const [txGatewayFilter, setTxGatewayFilter] = useState('all')
  const [txStatusFilter, setTxStatusFilter] = useState('all')

  // Dealer Ledger state
  const [selectedDealerId, setSelectedDealerId] = useState('all')
  const [dealerViewMode, setDealerViewMode] = useState<'items' | 'vouchers'>(
    'items',
  )
  const [dealerSearch, setDealerSearch] = useState('')

  // Sales Account state
  const [salesSearch, setSalesSearch] = useState('')
  const [salesPaymentFilter, setSalesPaymentFilter] = useState('all')
  const [salesStatusFilter, setSalesStatusFilter] = useState('all')

  // Modals state
  const [isAddVoucherOpen, setIsAddVoucherOpen] = useState(false)
  const [isDealerPayoutOpen, setIsDealerPayoutOpen] = useState(false)
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false)
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Voucher form state (amounts handled in NPR Rs. by user, converted to Paisa on submit)
  const [voucherForm, setVoucherForm] = useState({
    memo: '',
    category: 'expense' as LedgerEntry['category'],
    account: 'bank',
    type: 'debit' as 'debit' | 'credit',
    amountInRs: 500,
    refType: 'manual' as
      'order' | 'settlement' | 'manual' | 'refund' | 'dealer' | 'salary',
    refId: '',
  })

  // Dealer payout form
  const [dealerPayoutForm, setDealerPayoutForm] = useState({
    dealerId: '',
    dealerName: '',
    amountInRs: 0,
    account: 'bank',
    memo: '',
    ref: '',
  })

  // Salary disbursement form
  const [salaryForm, setSalaryForm] = useState({
    riderId: '',
    recipientName: '',
    amountInRs: 1500,
    account: 'bank',
    memo: 'Rider weekly performance commission disbursement',
  })

  // ----------------------------------------------------
  // DATA COMPUTATIONS
  // ----------------------------------------------------
  const rawLedger = ops.ledger
  const rawPayments = ops.payments
  const rawDealers = ops.dealers
  const rawOrders = ops.orders
  const rawSettlements = ops.settlements

  // 1. General Ledger calculations
  const filteredLedger = useMemo(() => {
    return rawLedger.filter((item) => {
      if (accountFilter !== 'all' && item.account !== accountFilter)
        return false
      if (categoryFilter !== 'all' && item.category !== categoryFilter)
        return false
      if (ledgerSearch.trim()) {
        const q = ledgerSearch.toLowerCase()
        return (
          item.memo.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          (item.refId || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [rawLedger, accountFilter, categoryFilter, ledgerSearch])

  const totalDebits = rawLedger
    .filter((l) => l.type === 'debit')
    .reduce((sum, l) => sum + l.amount, 0)
  const totalCredits = rawLedger
    .filter((l) => l.type === 'credit')
    .reduce((sum, l) => sum + l.amount, 0)
  const netLiquidityBalance = totalCredits - totalDebits

  const grossSales = rawLedger
    .filter((l) => l.category === 'sales')
    .reduce((sum, l) => sum + l.amount, 0)
  const cogsPurchases = rawLedger
    .filter((l) => l.category === 'purchase' || l.category === 'dealer_payment')
    .reduce((sum, l) => sum + l.amount, 0)
  const operatingExpenses = rawLedger
    .filter((l) => l.category === 'expense' || l.category === 'salary')
    .reduce((sum, l) => sum + l.amount, 0)
  const refundsIssued = rawLedger
    .filter((l) => l.category === 'refund')
    .reduce((sum, l) => sum + l.amount, 0)

  const grossProfit = grossSales - cogsPurchases
  const netEstimatedProfit = grossProfit - operatingExpenses - refundsIssued

  // 2. Transactions calculations
  const filteredTransactions = useMemo(() => {
    return rawPayments.filter((p) => {
      if (txGatewayFilter !== 'all' && p.gateway !== txGatewayFilter)
        return false
      if (txStatusFilter !== 'all' && p.status !== txStatusFilter) return false
      if (txSearch.trim()) {
        const q = txSearch.toLowerCase()
        return (
          p.reference.toLowerCase().includes(q) ||
          p.orderId.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [rawPayments, txGatewayFilter, txStatusFilter, txSearch])

  const totalTxVolume = rawPayments
    .filter((p) => p.status === 'success' || p.status === 'reconciled')
    .reduce((sum, p) => sum + p.amount, 0)

  const digitalVolume = rawPayments
    .filter(
      (p) =>
        p.gateway !== 'cod' &&
        (p.status === 'success' || p.status === 'reconciled'),
    )
    .reduce((sum, p) => sum + p.amount, 0)

  const codTxVolume = rawPayments
    .filter(
      (p) =>
        p.gateway === 'cod' &&
        (p.status === 'success' || p.status === 'reconciled'),
    )
    .reduce((sum, p) => sum + p.amount, 0)

  // 3. Dealer Ledger calculations
  const dealerProcurements = useMemo(() => {
    const list: Array<{
      orderId: string
      orderNumber: string
      orderDate: string
      itemId: string
      itemName: string
      catalogType: 'liquor' | 'grocery'
      qty: number
      unitPrice: number
      lineTotal: number
      dealerId: string
      dealerName: string
      dealerContact: string
      dealerPan: string
    }> = []

    for (const order of rawOrders) {
      const orderDate = order.events[0]?.at || ''
      for (const item of order.items) {
        if (item.dealerId) {
          const matchedDealer =
            rawDealers.find((d) => d.id === item.dealerId) || item.dealer
          list.push({
            orderId: order.id,
            orderNumber: order.number,
            orderDate,
            itemId: item.id,
            itemName: item.name,
            catalogType: item.catalogType,
            qty: item.qty,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            dealerId: item.dealerId,
            dealerName: matchedDealer?.name || 'Assigned Dealer',
            dealerContact: matchedDealer?.contact || '',
            dealerPan: matchedDealer?.pan || '',
          })
        }
      }
    }
    return list
  }, [rawOrders, rawDealers])

  const dealerVouchers = useMemo(() => {
    return rawLedger.filter(
      (l) =>
        l.category === 'dealer_payment' ||
        l.refType === 'dealer' ||
        (l.category === 'purchase' && l.refId?.startsWith('dlr_')),
    )
  }, [rawLedger])

  // Aggregate balance per dealer
  const dealerBalances = useMemo(() => {
    const map = new Map<
      string,
      {
        dealer: (typeof rawDealers)[number]
        totalProcured: number
        totalPaid: number
        itemCount: number
      }
    >()

    for (const d of rawDealers) {
      map.set(d.id, {
        dealer: d,
        totalProcured: 0,
        totalPaid: 0,
        itemCount: 0,
      })
    }

    for (const p of dealerProcurements) {
      const existing = map.get(p.dealerId)
      if (existing) {
        existing.totalProcured += p.lineTotal
        existing.itemCount += p.qty
      }
    }

    for (const v of dealerVouchers) {
      if (v.refId && map.has(v.refId)) {
        const existing = map.get(v.refId)!
        existing.totalPaid += v.amount
      }
    }

    return Array.from(map.values())
  }, [rawDealers, dealerProcurements, dealerVouchers])

  const filteredProcurements = useMemo(() => {
    return dealerProcurements.filter((p) => {
      if (selectedDealerId !== 'all' && p.dealerId !== selectedDealerId)
        return false
      if (dealerSearch.trim()) {
        const q = dealerSearch.toLowerCase()
        return (
          p.itemName.toLowerCase().includes(q) ||
          p.orderNumber.toLowerCase().includes(q) ||
          p.dealerName.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [dealerProcurements, selectedDealerId, dealerSearch])

  const filteredDealerVouchers = useMemo(() => {
    return dealerVouchers.filter((v) => {
      if (selectedDealerId !== 'all' && v.refId !== selectedDealerId)
        return false
      if (dealerSearch.trim()) {
        const q = dealerSearch.toLowerCase()
        return (
          v.memo.toLowerCase().includes(q) ||
          v.id.toLowerCase().includes(q) ||
          (v.refId || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [dealerVouchers, selectedDealerId, dealerSearch])

  const totalDealerProcured = dealerBalances.reduce(
    (sum, d) => sum + d.totalProcured,
    0,
  )
  const totalDealerPaid = dealerBalances.reduce(
    (sum, d) => sum + d.totalPaid,
    0,
  )
  const totalOutstandingDealerPayables = totalDealerProcured - totalDealerPaid

  // 4. Sales Account calculations
  const filteredSalesOrders = useMemo(() => {
    return rawOrders.filter((o) => {
      if (
        salesPaymentFilter !== 'all' &&
        o.paymentMethod !== salesPaymentFilter
      )
        return false
      if (salesStatusFilter !== 'all' && o.status !== salesStatusFilter)
        return false
      if (salesSearch.trim()) {
        const q = salesSearch.toLowerCase()
        return (
          o.number.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [rawOrders, salesPaymentFilter, salesStatusFilter, salesSearch])

  const orderGrossRevenue = rawOrders.reduce((sum, o) => sum + o.total, 0)
  const orderNetSales = rawOrders.reduce((sum, o) => sum + o.subtotal, 0)
  const orderDiscountsGiven = rawOrders.reduce((sum, o) => sum + o.discount, 0)
  const orderDeliveryFees = rawOrders.reduce(
    (sum, o) => sum + o.deliveryCharge,
    0,
  )

  let liquorRevenue = 0
  let groceryRevenue = 0
  for (const order of rawOrders) {
    for (const item of order.items) {
      if (item.catalogType === 'liquor') {
        liquorRevenue += item.lineTotal
      } else {
        groceryRevenue += item.lineTotal
      }
    }
  }

  // 5. Salary Account calculations
  const totalDeliveries = rawSettlements.reduce(
    (sum, s) => sum + s.deliveries,
    0,
  )
  const totalCommissionsEarned = rawSettlements.reduce(
    (sum, s) => sum + s.commission,
    0,
  )
  const pendingSettlementPayouts = rawSettlements
    .filter((s) => s.status !== 'paid')
    .reduce((sum, s) => sum + s.payout, 0)

  const salaryVouchers = useMemo(() => {
    return rawLedger.filter(
      (l) =>
        l.category === 'salary' ||
        l.category === 'settlement' ||
        l.account === 'rider_payable',
    )
  }, [rawLedger])

  // ----------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------
  const handlePostVoucher = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!voucherForm.memo || voucherForm.amountInRs <= 0) {
      toast.error('Please enter a description and valid amount in Rs.')
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
          amount: toPaisa(Number(voucherForm.amountInRs)),
          refType: voucherForm.refType,
          refId: voucherForm.refId || null,
        },
      })
      toast.success('Journal voucher posted to general ledger')
      setIsAddVoucherOpen(false)
      setVoucherForm({
        memo: '',
        category: 'expense',
        account: 'bank',
        type: 'debit',
        amountInRs: 500,
        refType: 'manual',
        refId: '',
      })
      await router.invalidate()
    } catch {
      toast.error('Failed to post voucher')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenDealerPayout = (
    dealer: (typeof rawDealers)[number],
    balance: number,
  ) => {
    setDealerPayoutForm({
      dealerId: dealer.id,
      dealerName: dealer.name,
      amountInRs: Math.max(0, Math.round(balance / 100)),
      account: 'bank',
      memo: `Procurement settlement payout to ${dealer.name}`,
      ref: `INV-DLR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    })
    setIsDealerPayoutOpen(true)
  }

  const handlePostDealerPayout = async (e: React.FormEvent) => {
    e.preventDefault()
    if (dealerPayoutForm.amountInRs <= 0) {
      toast.error('Please enter a valid disbursement amount')
      return
    }

    try {
      setIsSubmitting(true)
      await addLedgerFn({
        data: {
          type: 'debit',
          category: 'dealer_payment',
          account: dealerPayoutForm.account,
          memo: dealerPayoutForm.memo,
          amount: toPaisa(Number(dealerPayoutForm.amountInRs)),
          refType: 'dealer',
          refId: dealerPayoutForm.dealerId,
        },
      })
      toast.success(
        `Dealer payout of Rs. ${dealerPayoutForm.amountInRs} recorded successfully`,
      )
      setIsDealerPayoutOpen(false)
      await router.invalidate()
    } catch {
      toast.error('Failed to record dealer payout')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenSalaryDisbursement = (
    riderId?: string,
    riderName?: string,
  ) => {
    setSalaryForm({
      riderId: riderId || '',
      recipientName: riderName || '',
      amountInRs: 2500,
      account: 'bank',
      memo: riderName
        ? `Delivery payroll compensation: ${riderName}`
        : 'Rider & staff payroll disbursement',
    })
    setIsSalaryModalOpen(true)
  }

  const handlePostSalaryDisbursement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (salaryForm.amountInRs <= 0) {
      toast.error('Please enter a valid salary amount')
      return
    }

    try {
      setIsSubmitting(true)
      await addLedgerFn({
        data: {
          type: 'debit',
          category: 'salary',
          account: salaryForm.account,
          memo: salaryForm.memo,
          amount: toPaisa(Number(salaryForm.amountInRs)),
          refType: 'salary',
          refId: salaryForm.riderId || null,
        },
      })
      toast.success('Salary disbursement recorded in general ledger')
      setIsSalaryModalOpen(false)
      await router.invalidate()
    } catch {
      toast.error('Failed to record salary disbursement')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApproveSettlement = async (
    id: string,
    status: 'approved' | 'paid',
  ) => {
    try {
      setIsSubmitting(true)
      await approveSettlementFn({ data: { id, status } })
      toast.success(`Settlement marked as ${status}`)
      await router.invalidate()
    } catch {
      toast.error('Failed to update settlement')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExportCSV = () => {
    const headers =
      'ID,Date,Type,Category,Account,AmountNPR,Memo,RefType,RefID\n'
    const rows = filteredLedger
      .map(
        (l) =>
          `"${l.id}","${l.date}","${l.type}","${l.category}","${l.account}",${l.amount},"${l.memo.replace(/"/g, '""')}","${l.refType}","${l.refId || ''}"`,
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
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        kicker="Finance & Accounts"
        title="Accounts & Financial Ledger"
        description="Unified financial ecosystem: General Ledger, Payment Gateways, Dealer Payables, Sales Accounts, and Rider Payroll."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsStatementModalOpen(true)}
              className="h-8 gap-1.5 text-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Statement / P&L
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              size="sm"
              onClick={() => setIsAddVoucherOpen(true)}
              className="h-8 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Post voucher
            </Button>
          </div>
        }
      />

      {/* Systematic Sub-Accounts Navigation Tabs */}
      <div className="rounded-xl border border-border bg-card p-1 shadow-xs">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as SubAccountTab)}
        >
          <TabsList className="grid w-full grid-cols-2 h-auto gap-1 bg-muted/60 p-1 sm:grid-cols-5">
            <TabsTrigger
              value="ledger"
              className="flex items-center gap-2 py-2 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-xs"
            >
              <Receipt className="h-4 w-4 shrink-0 text-primary" />
              <div className="text-left leading-tight">
                <span className="block font-semibold">Ledger</span>
                <span className="text-[10px] text-muted-foreground hidden lg:block">
                  General Ledger ({rawLedger.length})
                </span>
              </div>
            </TabsTrigger>

            <TabsTrigger
              value="transactions"
              className="flex items-center gap-2 py-2 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-xs"
            >
              <CreditCard className="h-4 w-4 shrink-0 text-blue-500" />
              <div className="text-left leading-tight">
                <span className="block font-semibold">Transaction</span>
                <span className="text-[10px] text-muted-foreground hidden lg:block">
                  Gateways ({rawPayments.length})
                </span>
              </div>
            </TabsTrigger>

            <TabsTrigger
              value="dealer-ledger"
              className="flex items-center gap-2 py-2 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-xs"
            >
              <Store className="h-4 w-4 shrink-0 text-amber-500" />
              <div className="text-left leading-tight">
                <span className="block font-semibold">Dealer Ledger</span>
                <span className="text-[10px] text-muted-foreground hidden lg:block">
                  Supplier Payables ({rawDealers.length})
                </span>
              </div>
            </TabsTrigger>

            <TabsTrigger
              value="sales-account"
              className="flex items-center gap-2 py-2 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-xs"
            >
              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500" />
              <div className="text-left leading-tight">
                <span className="block font-semibold">Sales Account</span>
                <span className="text-[10px] text-muted-foreground hidden lg:block">
                  Revenue & Catalog
                </span>
              </div>
            </TabsTrigger>

            <TabsTrigger
              value="salary-account"
              className="flex items-center gap-2 py-2 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-xs"
            >
              <Coins className="h-4 w-4 shrink-0 text-purple-500" />
              <div className="text-left leading-tight">
                <span className="block font-semibold">Salary Account</span>
                <span className="text-[10px] text-muted-foreground hidden lg:block">
                  Rider Settlements ({rawSettlements.length})
                </span>
              </div>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ==================================================== */}
      {/* 1. SUB-ACCOUNT: GENERAL LEDGER                       */}
      {/* ==================================================== */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          {/* Sub-account Banner Heading */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-gradient-to-r from-card to-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    General Ledger Account
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    Double-Entry Chart of Accounts
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Official financial book of accounts: debit/credit journal
                  vouchers, liquidity balance, and balance sheet reconciliation.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsStatementModalOpen(true)}
                className="h-8 gap-1.5 text-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                View Statements
              </Button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Consolidated liquidity"
              value={formatNPR(netLiquidityBalance)}
              note="Across bank, wallets & COD cash"
              icon={Wallet}
            />
            <KpiCard
              label="Total credits (inflow)"
              value={formatNPR(totalCredits)}
              note="Sales revenue & cash receipts"
              icon={ArrowDownLeft}
              tone="success"
            />
            <KpiCard
              label="Total debits (outflow)"
              value={formatNPR(totalDebits)}
              note="Supplier restock, payroll & ops"
              icon={ArrowUpRight}
              tone="danger"
            />
            <KpiCard
              label="Estimated net margin"
              value={formatNPR(netEstimatedProfit)}
              note="Gross operating margin less overhead"
              icon={TrendingUp}
              tone={netEstimatedProfit >= 0 ? 'success' : 'danger'}
            />
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search memo, voucher ID, reference..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                className="h-8 pl-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                size="sm"
                className="h-8 text-xs"
              >
                <NativeSelectOption value="all">
                  All accounts
                </NativeSelectOption>
                <NativeSelectOption value="bank">
                  Bank account
                </NativeSelectOption>
                <NativeSelectOption value="cash">
                  Cash in hand (COD)
                </NativeSelectOption>
                <NativeSelectOption value="esewa">
                  eSewa wallet
                </NativeSelectOption>
                <NativeSelectOption value="khalti">
                  Khalti wallet
                </NativeSelectOption>
                <NativeSelectOption value="dealer_payable">
                  Dealer accounts payable
                </NativeSelectOption>
                <NativeSelectOption value="sales_revenue">
                  Sales revenue
                </NativeSelectOption>
                <NativeSelectOption value="rider_payable">
                  Rider compensation payable
                </NativeSelectOption>
              </NativeSelect>

              <NativeSelect
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                size="sm"
                className="h-8 text-xs"
              >
                <NativeSelectOption value="all">
                  All categories
                </NativeSelectOption>
                <NativeSelectOption value="sales">
                  Sales income
                </NativeSelectOption>
                <NativeSelectOption value="purchase">
                  Inventory purchases
                </NativeSelectOption>
                <NativeSelectOption value="dealer_payment">
                  Dealer supplier payout
                </NativeSelectOption>
                <NativeSelectOption value="salary">
                  Staff & rider payroll
                </NativeSelectOption>
                <NativeSelectOption value="expense">
                  Operating expense
                </NativeSelectOption>
                <NativeSelectOption value="cod">
                  COD remittance
                </NativeSelectOption>
                <NativeSelectOption value="refund">
                  Refund payout
                </NativeSelectOption>
              </NativeSelect>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date and ID</TableHead>
                  <TableHead className="text-xs">Description & memo</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs">Account</TableHead>
                  <TableHead className="text-right text-xs">
                    Debit out (-)
                  </TableHead>
                  <TableHead className="text-right text-xs">
                    Credit in (+)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLedger.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState
                        title="No ledger vouchers found"
                        description="Try adjusting your filters or search terms."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLedger.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className="font-mono text-xs text-foreground block">
                          {item.id}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {item.date}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium text-xs text-foreground">
                          {item.memo}
                        </div>
                        {item.refId && (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            Ref: {item.refId} ({item.refType})
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-normal capitalize"
                        >
                          {item.category.replace('_', ' ')}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-xs uppercase text-muted-foreground">
                          {item.account.replace('_', ' ')}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        {item.type === 'debit' ? (
                          <span className="font-mono text-xs font-semibold tabular-nums text-destructive">
                            -{formatNPR(item.amount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">-</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {item.type === 'credit' ? (
                          <span className="font-mono text-xs font-semibold tabular-nums text-success">
                            +{formatNPR(item.amount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. SUB-ACCOUNT: TRANSACTION                         */}
      {/* ==================================================== */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
          {/* Sub-account Banner Heading */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-gradient-to-r from-card to-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Transaction Account
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    Payment Gateways & Inflows
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Direct ledger of all customer payment transactions across
                  eSewa, Khalti, Fonepay, ConnectIPS, and Cash on Delivery
                  (COD).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="h-8 gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Export Transactions
              </Button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Settled payment volume"
              value={formatNPR(totalTxVolume)}
              note="Total successful gateway transactions"
              icon={CreditCard}
              tone="success"
            />
            <KpiCard
              label="Digital wallets volume"
              value={formatNPR(digitalVolume)}
              note="eSewa, Khalti, Fonepay & ConnectIPS"
              icon={Wallet}
            />
            <KpiCard
              label="COD collections"
              value={formatNPR(codTxVolume)}
              note="Cash on Delivery remittance"
              icon={Coins}
            />
            <KpiCard
              label="Total transactions"
              value={String(rawPayments.length)}
              note={`${rawPayments.filter((p) => p.status === 'success').length} verified successful`}
              icon={Receipt}
            />
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search transaction ID, reference, order ID..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="h-8 pl-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect
                value={txGatewayFilter}
                onChange={(e) => setTxGatewayFilter(e.target.value)}
                size="sm"
                className="h-8 text-xs"
              >
                <NativeSelectOption value="all">
                  All gateways
                </NativeSelectOption>
                <NativeSelectOption value="cod">
                  Cash on Delivery (COD)
                </NativeSelectOption>
                <NativeSelectOption value="esewa">eSewa</NativeSelectOption>
                <NativeSelectOption value="khalti">Khalti</NativeSelectOption>
                <NativeSelectOption value="fonepay">Fonepay</NativeSelectOption>
                <NativeSelectOption value="connectips">
                  ConnectIPS
                </NativeSelectOption>
              </NativeSelect>

              <NativeSelect
                value={txStatusFilter}
                onChange={(e) => setTxStatusFilter(e.target.value)}
                size="sm"
                className="h-8 text-xs"
              >
                <NativeSelectOption value="all">
                  All statuses
                </NativeSelectOption>
                <NativeSelectOption value="success">Success</NativeSelectOption>
                <NativeSelectOption value="initiated">
                  Initiated
                </NativeSelectOption>
                <NativeSelectOption value="failed">Failed</NativeSelectOption>
                <NativeSelectOption value="reconciled">
                  Reconciled
                </NativeSelectOption>
              </NativeSelect>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Txn ID & Date</TableHead>
                  <TableHead className="text-xs">Order ID</TableHead>
                  <TableHead className="text-xs">Gateway</TableHead>
                  <TableHead className="text-xs">Reference code</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-right text-xs">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState
                        title="No payment transactions found"
                        description="Try adjusting your filters or gateway search."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <span className="font-mono text-xs text-foreground block">
                          {tx.id}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {tx.createdAt
                            ? new Date(tx.createdAt).toLocaleString()
                            : '-'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Link
                          to="/admin/orders"
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {tx.orderId}
                        </Link>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-semibold uppercase"
                        >
                          {tx.gateway}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-xs text-foreground">
                          {tx.reference || '-'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            tx.status === 'success' ||
                            tx.status === 'reconciled'
                              ? 'success'
                              : tx.status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                          }
                          className="text-[10px] font-normal uppercase"
                        >
                          {tx.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                          {formatNPR(tx.amount)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. SUB-ACCOUNT: DEALER LEDGER ACCOUNT               */}
      {/* ==================================================== */}
      {activeTab === 'dealer-ledger' && (
        <div className="space-y-6">
          {/* Sub-account Banner Heading */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-gradient-to-r from-card to-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Dealer Ledger Account
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    Accounts Payable & Procurement
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tracks procurement costs for customer order items assigned to
                  specific dealers, accounts payable balances, and dealer
                  settlements.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/admin/dealers">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Manage Dealers
                </Button>
              </Link>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Active suppliers / dealers"
              value={String(rawDealers.filter((d) => d.isActive).length)}
              note="Registered partner merchants"
              icon={Store}
            />
            <KpiCard
              label="Total items procured"
              value={String(dealerProcurements.length)}
              note="Assigned from customer orders"
              icon={ShoppingBag}
            />
            <KpiCard
              label="Total procured inventory"
              value={formatNPR(totalDealerProcured)}
              note="Procured inventory value"
              icon={ArrowDownLeft}
              tone="default"
            />
            <KpiCard
              label="Outstanding dealer payables"
              value={formatNPR(totalOutstandingDealerPayables)}
              note="Balance to be disbursed to dealers"
              icon={Coins}
              tone={totalOutstandingDealerPayables > 0 ? 'warning' : 'success'}
            />
          </div>

          {/* Dealer Balance Summary Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Dealer Accounts & Payables Overview
              </h4>
              <span className="text-xs text-muted-foreground">
                Showing {dealerBalances.length} registered dealers
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {dealerBalances.map(({ dealer, totalProcured, totalPaid }) => {
                const balance = totalProcured - totalPaid
                const isSelected = selectedDealerId === dealer.id
                return (
                  <Card
                    key={dealer.id}
                    className={`p-4 transition-all ${isSelected ? 'border-primary ring-1 ring-primary/30' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {dealer.name}
                          </span>
                          {!dealer.isActive && (
                            <Badge variant="outline" className="text-[9px]">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {dealer.city} · PAN/VAT: {dealer.pan || 'N/A'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={isSelected ? 'default' : 'outline'}
                        onClick={() =>
                          setSelectedDealerId(isSelected ? 'all' : dealer.id)
                        }
                        className="h-6 px-2 text-[10px]"
                      >
                        {isSelected ? 'Selected' : 'Filter'}
                      </Button>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-muted/30 p-2 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">
                          Procured
                        </span>
                        <span className="font-mono font-medium text-foreground">
                          {formatNPR(totalProcured)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">
                          Paid
                        </span>
                        <span className="font-mono font-medium text-success">
                          {formatNPR(totalPaid)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">
                          Payable
                        </span>
                        <span
                          className={`font-mono font-bold ${balance > 0 ? 'text-amber-500' : 'text-muted-foreground'}`}
                        >
                          {formatNPR(balance)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{dealer.contact}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenDealerPayout(dealer, balance)}
                        className="h-6 px-2 text-[10px] gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Record Payout
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* View Mode Switcher and Filters */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={dealerViewMode === 'items' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDealerViewMode('items')}
                className="h-8 gap-1.5 text-xs"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                Procured Order Items ({filteredProcurements.length})
              </Button>
              <Button
                variant={dealerViewMode === 'vouchers' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDealerViewMode('vouchers')}
                className="h-8 gap-1.5 text-xs"
              >
                <Receipt className="h-3.5 w-3.5" />
                Dealer Payout Vouchers ({filteredDealerVouchers.length})
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search item, dealer or order..."
                  value={dealerSearch}
                  onChange={(e) => setDealerSearch(e.target.value)}
                  className="h-8 pl-9 text-xs"
                />
              </div>

              <NativeSelect
                value={selectedDealerId}
                onChange={(e) => setSelectedDealerId(e.target.value)}
                size="sm"
                className="h-8 text-xs"
              >
                <NativeSelectOption value="all">All dealers</NativeSelectOption>
                {rawDealers.map((d) => (
                  <NativeSelectOption key={d.id} value={d.id}>
                    {d.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>

          {/* Dealer Records Table */}
          {dealerViewMode === 'items' ? (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Order & Date</TableHead>
                    <TableHead className="text-xs">Procured item</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Assigned dealer</TableHead>
                    <TableHead className="text-xs">Quantity</TableHead>
                    <TableHead className="text-xs">Unit cost</TableHead>
                    <TableHead className="text-right text-xs">
                      Procured total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProcurements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="p-0">
                        <EmptyState
                          title="No dealer order items assigned"
                          description="When customer order items are assigned to dealers in the Orders panel, they will appear here as procurement entries."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProcurements.map((p, idx) => (
                      <TableRow key={`${p.orderId}-${p.itemId}-${idx}`}>
                        <TableCell>
                          <Link
                            to="/admin/orders"
                            className="font-mono text-xs font-semibold text-primary hover:underline block"
                          >
                            {p.orderNumber}
                          </Link>
                          <span className="text-[11px] text-muted-foreground">
                            {p.orderDate
                              ? new Date(p.orderDate).toLocaleDateString()
                              : '-'}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium text-xs text-foreground">
                            {p.itemName}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-normal capitalize"
                          >
                            {p.catalogType}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs font-medium text-foreground">
                            {p.dealerName}
                          </div>
                          {p.dealerPan && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              PAN: {p.dealerPan}
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <span className="font-mono text-xs text-foreground">
                            {p.qty} pcs
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {formatNPR(p.unitPrice)}
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                            {formatNPR(p.lineTotal)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Voucher ID & Date</TableHead>
                    <TableHead className="text-xs">Dealer & memo</TableHead>
                    <TableHead className="text-xs">Account</TableHead>
                    <TableHead className="text-xs">Reference</TableHead>
                    <TableHead className="text-right text-xs">
                      Amount disbursed
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDealerVouchers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <EmptyState
                          title="No dealer payout vouchers found"
                          description="Use the 'Record Payout' button to record settlement vouchers to suppliers."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDealerVouchers.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <span className="font-mono text-xs text-foreground block">
                            {v.id}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {v.date}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium text-xs text-foreground">
                            {v.memo}
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="font-mono text-xs uppercase text-muted-foreground">
                            {v.account}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground">
                            {v.refId || '-'}
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          <span className="font-mono text-xs font-semibold tabular-nums text-destructive">
                            -{formatNPR(v.amount)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. SUB-ACCOUNT: SALES ACCOUNT                       */}
      {/* ==================================================== */}
      {activeTab === 'sales-account' && (
        <div className="space-y-6">
          {/* Sub-account Banner Heading */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-gradient-to-r from-card to-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Sales Account & Revenue Ledger
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    Customer Billing & Category Sales
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Complete billing register: Gross order sales, Liquor vs
                  Grocery catalog breakdown, discounts, delivery fees, and tax
                  accounting.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="h-8 gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Export Sales
              </Button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Gross order sales"
              value={formatNPR(orderGrossRevenue)}
              note="Total customer order value"
              icon={TrendingUp}
              tone="success"
            />
            <KpiCard
              label="Net merchandise value"
              value={formatNPR(orderNetSales)}
              note="Excluding delivery & discounts"
              icon={ShoppingBag}
            />
            <KpiCard
              label="Discounts absorbed"
              value={formatNPR(orderDiscountsGiven)}
              note="Coupon codes and price rebates"
              icon={BadgePercent}
              tone="danger"
            />
            <KpiCard
              label="Delivery fees collected"
              value={formatNPR(orderDeliveryFees)}
              note="Shipping freight surcharge receipts"
              icon={Truck}
            />
          </div>

          {/* Catalog & Payment Breakdown Cards */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Catalog Breakdown: Liquor vs Grocery */}
            <Card className="p-4 space-y-4">
              <CardHeader className="p-0 pb-2 border-b border-border">
                <CardTitle className="text-xs font-semibold flex items-center justify-between">
                  <span>Catalog Performance Breakdown</span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Liquor vs Grocery Revenue
                  </span>
                </CardTitle>
              </CardHeader>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Wine className="h-3.5 w-3.5 text-primary" />
                      Liquor Catalog Revenue
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatNPR(liquorRevenue)}
                    </span>
                  </div>
                  <Progress
                    value={
                      liquorRevenue + groceryRevenue > 0
                        ? (liquorRevenue / (liquorRevenue + groceryRevenue)) *
                          100
                        : 50
                    }
                    className="h-2"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <ShoppingBag className="h-3.5 w-3.5 text-emerald-500" />
                      Grocery Catalog Revenue
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatNPR(groceryRevenue)}
                    </span>
                  </div>
                  <Progress
                    value={
                      liquorRevenue + groceryRevenue > 0
                        ? (groceryRevenue / (liquorRevenue + groceryRevenue)) *
                          100
                        : 50
                    }
                    className="h-2"
                  />
                </div>
              </div>
            </Card>

            {/* Payment Method Distribution */}
            <Card className="p-4 space-y-4">
              <CardHeader className="p-0 pb-2 border-b border-border">
                <CardTitle className="text-xs font-semibold flex items-center justify-between">
                  <span>Payment Method Distribution</span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Cash on Delivery vs Digital Pre-paid
                  </span>
                </CardTitle>
              </CardHeader>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Coins className="h-3.5 w-3.5 text-amber-500" />
                      Cash on Delivery (COD) Remittances
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatNPR(codTxVolume)}
                    </span>
                  </div>
                  <Progress
                    value={
                      codTxVolume + digitalVolume > 0
                        ? (codTxVolume / (codTxVolume + digitalVolume)) * 100
                        : 50
                    }
                    className="h-2"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Wallet className="h-3.5 w-3.5 text-blue-500" />
                      Digital Wallets (eSewa / Khalti / Fonepay)
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatNPR(digitalVolume)}
                    </span>
                  </div>
                  <Progress
                    value={
                      codTxVolume + digitalVolume > 0
                        ? (digitalVolume / (codTxVolume + digitalVolume)) * 100
                        : 50
                    }
                    className="h-2"
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Sales Orders Register */}
          <div className="space-y-3">
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search order number, customer name, phone..."
                  value={salesSearch}
                  onChange={(e) => setSalesSearch(e.target.value)}
                  className="h-8 pl-9 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <NativeSelect
                  value={salesPaymentFilter}
                  onChange={(e) => setSalesPaymentFilter(e.target.value)}
                  size="sm"
                  className="h-8 text-xs"
                >
                  <NativeSelectOption value="all">
                    All payment modes
                  </NativeSelectOption>
                  <NativeSelectOption value="cod">
                    Cash on Delivery (COD)
                  </NativeSelectOption>
                  <NativeSelectOption value="esewa">eSewa</NativeSelectOption>
                  <NativeSelectOption value="khalti">Khalti</NativeSelectOption>
                  <NativeSelectOption value="fonepay">
                    Fonepay
                  </NativeSelectOption>
                  <NativeSelectOption value="connectips">
                    ConnectIPS
                  </NativeSelectOption>
                </NativeSelect>

                <NativeSelect
                  value={salesStatusFilter}
                  onChange={(e) => setSalesStatusFilter(e.target.value)}
                  size="sm"
                  className="h-8 text-xs"
                >
                  <NativeSelectOption value="all">
                    All fulfillment statuses
                  </NativeSelectOption>
                  <NativeSelectOption value="delivered">
                    Delivered
                  </NativeSelectOption>
                  <NativeSelectOption value="dispatched">
                    Dispatched
                  </NativeSelectOption>
                  <NativeSelectOption value="processing">
                    Processing
                  </NativeSelectOption>
                  <NativeSelectOption value="cancelled">
                    Cancelled
                  </NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Order & Date</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs">Items</TableHead>
                    <TableHead className="text-xs">Payment mode</TableHead>
                    <TableHead className="text-xs">Delivery fee</TableHead>
                    <TableHead className="text-xs">Discount</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-right text-xs">
                      Total billed
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSalesOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="p-0">
                        <EmptyState
                          title="No sales orders found"
                          description="Try adjusting your filters or search keywords."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSalesOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Link
                            to="/admin/orders"
                            className="font-mono text-xs font-semibold text-primary hover:underline block"
                          >
                            {order.number}
                          </Link>
                          <span className="text-[11px] text-muted-foreground">
                            {order.events[0]?.at
                              ? new Date(
                                  order.events[0].at,
                                ).toLocaleDateString()
                              : '-'}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium text-xs text-foreground">
                            {order.customerName}
                          </div>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {order.customerPhone}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="font-mono text-xs text-foreground">
                            {order.items.length} items
                          </span>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-semibold uppercase"
                          >
                            {order.paymentMethod}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <span className="font-mono text-xs tabular-nums text-muted-foreground">
                            {formatNPR(order.deliveryCharge)}
                          </span>
                        </TableCell>

                        <TableCell>
                          {order.discount > 0 ? (
                            <span className="font-mono text-xs tabular-nums text-destructive">
                              -{formatNPR(order.discount)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">-</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={
                              order.status === 'delivered'
                                ? 'success'
                                : order.status === 'cancelled'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                            className="text-[10px] font-normal capitalize"
                          >
                            {order.status}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <span className="font-mono text-xs font-bold tabular-nums text-foreground">
                            {formatNPR(order.total)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. SUB-ACCOUNT: SALARY ACCOUNT                       */}
      {/* ==================================================== */}
      {activeTab === 'salary-account' && (
        <div className="space-y-6">
          {/* Sub-account Banner Heading */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-gradient-to-r from-card to-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Salary Account & Rider Payroll
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    Delivery Commissions & Payroll
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Rider delivery compensation settlements, commission
                  disbursements, cash-on-delivery reconciliation, and staff
                  payroll records.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => handleOpenSalaryDisbursement()}
                className="h-8 gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Disburse Payroll
              </Button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Active riders"
              value={String(ops.riders.length)}
              note="Active courier personnel"
              icon={UserCheck}
            />
            <KpiCard
              label="Total deliveries completed"
              value={String(totalDeliveries)}
              note="Across settlement cycles"
              icon={Truck}
            />
            <KpiCard
              label="Total commissions earned"
              value={formatNPR(totalCommissionsEarned)}
              note="Delivery per-drop incentives"
              icon={Coins}
              tone="success"
            />
            <KpiCard
              label="Pending payroll payouts"
              value={formatNPR(pendingSettlementPayouts)}
              note="Pending disbursement to couriers"
              icon={Clock}
              tone={pendingSettlementPayouts > 0 ? 'warning' : 'success'}
            />
          </div>

          {/* Rider Settlements Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Rider Commission Settlements
              </h4>
              <span className="text-xs text-muted-foreground">
                {rawSettlements.length} settlement cycles recorded
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Settlement ID</TableHead>
                    <TableHead className="text-xs">Rider Name</TableHead>
                    <TableHead className="text-xs">Period</TableHead>
                    <TableHead className="text-xs">Deliveries</TableHead>
                    <TableHead className="text-xs">Cash collected</TableHead>
                    <TableHead className="text-xs">Commission</TableHead>
                    <TableHead className="text-xs">Net Payout</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-right text-xs">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rawSettlements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="p-0">
                        <EmptyState
                          title="No courier settlements pending"
                          description="All rider accounts and delivery commissions are balanced."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    rawSettlements.map((set) => (
                      <TableRow key={set.id}>
                        <TableCell>
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {set.id}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium text-xs text-foreground">
                            {set.riderName}
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="text-xs text-muted-foreground font-mono">
                            {set.periodStart} → {set.periodEnd}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="font-mono text-xs text-foreground">
                            {set.deliveries}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                            {formatNPR(set.cashCollected)}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="font-mono text-xs font-medium tabular-nums text-success">
                            +{formatNPR(set.commission)}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="font-mono text-xs font-bold tabular-nums text-foreground">
                            {formatNPR(set.payout)}
                          </span>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={
                              set.status === 'paid' ? 'success' : 'secondary'
                            }
                            className="text-[10px] font-normal uppercase"
                          >
                            {set.status}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          {set.status !== 'paid' && (
                            <Button
                              size="sm"
                              onClick={() =>
                                handleApproveSettlement(set.id, 'paid')
                              }
                              disabled={isSubmitting}
                              className="h-7 px-2 text-xs"
                            >
                              Mark paid
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Payroll Disbursements History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Salary & Payroll Disbursement Vouchers
              </h4>
              <span className="text-xs text-muted-foreground">
                {salaryVouchers.length} disbursement records in general ledger
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Voucher ID & Date</TableHead>
                    <TableHead className="text-xs">Recipient / Memo</TableHead>
                    <TableHead className="text-xs">Account</TableHead>
                    <TableHead className="text-xs">Reference</TableHead>
                    <TableHead className="text-right text-xs">
                      Amount disbursed
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryVouchers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <EmptyState
                          title="No salary disbursement vouchers"
                          description="Disbursed payroll vouchers posted to the general ledger will appear here."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    salaryVouchers.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <span className="font-mono text-xs text-foreground block">
                            {v.id}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {v.date}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium text-xs text-foreground">
                            {v.memo}
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="font-mono text-xs uppercase text-muted-foreground">
                            {v.account}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground">
                            {v.refId || '-'}
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          <span className="font-mono text-xs font-semibold tabular-nums text-destructive">
                            -{formatNPR(v.amount)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODALS                                               */}
      {/* ==================================================== */}

      {/* Record Voucher Dialog */}
      <Dialog open={isAddVoucherOpen} onOpenChange={setIsAddVoucherOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Post Journal Voucher
            </DialogTitle>
            <DialogDescription className="text-xs">
              Direct entry into general ledger chart of accounts.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePostVoucher} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Description / memo *</Label>
              <Input
                required
                value={voucherForm.memo}
                onChange={(e) =>
                  setVoucherForm({ ...voucherForm, memo: e.target.value })
                }
                placeholder="e.g. Warehouse electricity utility payment"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <NativeSelect
                  value={voucherForm.category}
                  onChange={(e) =>
                    setVoucherForm({
                      ...voucherForm,
                      category: e.target.value as any,
                    })
                  }
                  size="sm"
                  className="w-full text-xs"
                >
                  <NativeSelectOption value="expense">
                    Operating expense
                  </NativeSelectOption>
                  <NativeSelectOption value="purchase">
                    Inventory purchase (COGS)
                  </NativeSelectOption>
                  <NativeSelectOption value="dealer_payment">
                    Dealer supplier payout
                  </NativeSelectOption>
                  <NativeSelectOption value="salary">
                    Staff & rider payroll
                  </NativeSelectOption>
                  <NativeSelectOption value="sales">
                    Direct sales income
                  </NativeSelectOption>
                  <NativeSelectOption value="cod">
                    COD remittance
                  </NativeSelectOption>
                  <NativeSelectOption value="refund">
                    Refund payout
                  </NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Target account</Label>
                <NativeSelect
                  value={voucherForm.account}
                  onChange={(e) =>
                    setVoucherForm({ ...voucherForm, account: e.target.value })
                  }
                  size="sm"
                  className="w-full text-xs"
                >
                  <NativeSelectOption value="bank">
                    Bank account
                  </NativeSelectOption>
                  <NativeSelectOption value="cash">
                    Cash in hand
                  </NativeSelectOption>
                  <NativeSelectOption value="esewa">
                    eSewa wallet
                  </NativeSelectOption>
                  <NativeSelectOption value="khalti">
                    Khalti wallet
                  </NativeSelectOption>
                  <NativeSelectOption value="dealer_payable">
                    Dealer accounts payable
                  </NativeSelectOption>
                  <NativeSelectOption value="sales_revenue">
                    Sales revenue
                  </NativeSelectOption>
                  <NativeSelectOption value="rider_payable">
                    Rider compensation payable
                  </NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Voucher type</Label>
                <NativeSelect
                  value={voucherForm.type}
                  onChange={(e) =>
                    setVoucherForm({
                      ...voucherForm,
                      type: e.target.value as any,
                    })
                  }
                  size="sm"
                  className="w-full text-xs"
                >
                  <NativeSelectOption value="debit">
                    Debit (-) Outflow / Expense
                  </NativeSelectOption>
                  <NativeSelectOption value="credit">
                    Credit (+) Inflow / Revenue
                  </NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Amount (in Rs. NPR) *</Label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={voucherForm.amountInRs}
                  onChange={(e) =>
                    setVoucherForm({
                      ...voucherForm,
                      amountInRs: Number(e.target.value),
                    })
                  }
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddVoucherOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-8 text-xs"
              >
                {isSubmitting ? 'Posting...' : 'Post entry'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Dealer Payout Dialog */}
      <Dialog open={isDealerPayoutOpen} onOpenChange={setIsDealerPayoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Disburse Dealer Supplier Payment
            </DialogTitle>
            <DialogDescription className="text-xs">
              Records an accounts payable settlement voucher to the dealer in
              the general ledger.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePostDealerPayout} className="space-y-4 pt-2">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide block">
                Dealer / Supplier
              </span>
              <span className="font-semibold text-foreground text-sm block">
                {dealerPayoutForm.dealerName}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Payment memo *</Label>
              <Input
                required
                value={dealerPayoutForm.memo}
                onChange={(e) =>
                  setDealerPayoutForm({
                    ...dealerPayoutForm,
                    memo: e.target.value,
                  })
                }
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Disburse from</Label>
                <NativeSelect
                  value={dealerPayoutForm.account}
                  onChange={(e) =>
                    setDealerPayoutForm({
                      ...dealerPayoutForm,
                      account: e.target.value,
                    })
                  }
                  size="sm"
                  className="w-full text-xs"
                >
                  <NativeSelectOption value="bank">
                    Bank transfer / Cheque
                  </NativeSelectOption>
                  <NativeSelectOption value="cash">
                    Cash in hand
                  </NativeSelectOption>
                  <NativeSelectOption value="esewa">
                    eSewa business payout
                  </NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Amount (in Rs. NPR) *</Label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={dealerPayoutForm.amountInRs}
                  onChange={(e) =>
                    setDealerPayoutForm({
                      ...dealerPayoutForm,
                      amountInRs: Number(e.target.value),
                    })
                  }
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDealerPayoutOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-8 text-xs"
              >
                {isSubmitting ? 'Recording...' : 'Disburse & record'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Disburse Salary Dialog */}
      <Dialog open={isSalaryModalOpen} onOpenChange={setIsSalaryModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Disburse Salary / Rider Commission
            </DialogTitle>
            <DialogDescription className="text-xs">
              Records a payroll disbursement debit voucher into the general
              ledger.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handlePostSalaryDisbursement}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1.5">
              <Label className="text-xs">Recipient / Rider (optional)</Label>
              <NativeSelect
                value={salaryForm.riderId}
                onChange={(e) => {
                  const r = ops.riders.find(
                    (rider) => rider.id === e.target.value,
                  )
                  setSalaryForm({
                    ...salaryForm,
                    riderId: e.target.value,
                    recipientName: r?.name || '',
                    memo: r
                      ? `Courier compensation: ${r.name}`
                      : salaryForm.memo,
                  })
                }}
                size="sm"
                className="w-full text-xs"
              >
                <NativeSelectOption value="">
                  General courier / staff pool
                </NativeSelectOption>
                {ops.riders.map((rider) => (
                  <NativeSelectOption key={rider.id} value={rider.id}>
                    {rider.name} ({rider.phone})
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Payroll memo *</Label>
              <Input
                required
                value={salaryForm.memo}
                onChange={(e) =>
                  setSalaryForm({ ...salaryForm, memo: e.target.value })
                }
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Payout source</Label>
                <NativeSelect
                  value={salaryForm.account}
                  onChange={(e) =>
                    setSalaryForm({ ...salaryForm, account: e.target.value })
                  }
                  size="sm"
                  className="w-full text-xs"
                >
                  <NativeSelectOption value="bank">
                    Bank account
                  </NativeSelectOption>
                  <NativeSelectOption value="cash">
                    Cash remittance
                  </NativeSelectOption>
                  <NativeSelectOption value="esewa">
                    eSewa wallet transfer
                  </NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Amount (in Rs. NPR) *</Label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={salaryForm.amountInRs}
                  onChange={(e) =>
                    setSalaryForm({
                      ...salaryForm,
                      amountInRs: Number(e.target.value),
                    })
                  }
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSalaryModalOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-8 text-xs"
              >
                {isSubmitting ? 'Recording...' : 'Disburse salary'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Official Financial Statement Preview Dialog */}
      <Dialog
        open={isStatementModalOpen}
        onOpenChange={setIsStatementModalOpen}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-sm font-semibold">
              Official Statement of Financial Position & P&L
            </DialogTitle>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="h-7 gap-1 text-xs"
            >
              <Printer className="h-3 w-3" />
              Print / Save PDF
            </Button>
          </DialogHeader>

          <div className="p-6 overflow-y-auto space-y-4 text-xs">
            <div className="flex items-start justify-between border-b border-border/50 pb-3">
              <div>
                <h2 className="text-xs font-bold text-foreground uppercase">
                  {ops.settings.legalName ||
                    'MEZMANI LIQUOR & GROCERY PVT. LTD.'}
                </h2>
                <p className="text-muted-foreground">
                  {ops.settings.address || 'Kathmandu, Nepal'}
                </p>
                <p className="text-muted-foreground font-mono">
                  PAN/VAT: {ops.settings.pan || '609823415'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-foreground uppercase block">
                  Audited financial report
                </span>
                <div className="text-muted-foreground text-[10px]">
                  Date: {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground border-b border-border/40 pb-1 text-xs">
                Operating Income
              </h4>
              <div className="flex justify-between py-1 text-muted-foreground">
                <span>Gross sales income:</span>
                <span className="font-mono text-foreground font-medium">
                  {formatNPR(grossSales)}
                </span>
              </div>
              <div className="flex justify-between py-1 text-muted-foreground">
                <span>Cost of goods sold (COGS & dealer procurement):</span>
                <span className="font-mono text-destructive">
                  -{formatNPR(cogsPurchases)}
                </span>
              </div>
              <div className="flex justify-between py-1 font-semibold text-foreground bg-muted/40 px-2 rounded">
                <span>Gross operating margin:</span>
                <span className="font-mono">{formatNPR(grossProfit)}</span>
              </div>

              <h4 className="font-semibold text-foreground border-b border-border/40 pb-1 text-xs pt-2">
                Operating Overhead & Payouts
              </h4>
              <div className="flex justify-between py-1 text-muted-foreground">
                <span>Operating expenses & payroll:</span>
                <span className="font-mono text-destructive">
                  -{formatNPR(operatingExpenses)}
                </span>
              </div>
              <div className="flex justify-between py-1 text-muted-foreground">
                <span>Customer refund payouts:</span>
                <span className="font-mono text-destructive">
                  -{formatNPR(refundsIssued)}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-md bg-muted/30 border border-border mt-3">
                <span className="text-xs font-medium text-foreground">
                  Net realized profit:
                </span>
                <span className="text-sm font-bold text-foreground font-mono">
                  {formatNPR(netEstimatedProfit)}
                </span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
