import { useState, useMemo, useEffect } from 'react'
import {
  getRouteApi,
  useNavigate,
  useRouter,
  Link,
} from '@tanstack/react-router'
import { addLedgerFn } from '#/server/operations/operations.functions'
import {
  postManualJournalVoucherFn,
  recordDealerDisbursementFn,
  recordManagerCashHandoverFn,
} from '#/server/finance/finance.functions'
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
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  FileText,
  ExternalLink,
  FileSpreadsheet,
  ArrowRight,
  X,
  Calendar,
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
import { BatchDealerSettlementDialog } from './batch-dealer-settlement-dialog'
import { RiderPayrollRunDialog } from './rider-payroll-run-dialog'
import { RiderSettlementApprovalDialog } from './rider-settlement-approval-dialog'
import { VoucherDetailsDialog } from './voucher-details-dialog'
import { FinancialReportsTab } from './financial-reports-tab'
import type { DetailedJournalEntry } from '#/server/finance/finance.queries'

const routeApi = getRouteApi('/admin/accounts')

type SubAccountTab =
  | 'ledger'
  | 'transactions'
  | 'dealer-ledger'
  | 'sales-account'
  | 'salary-account'
  | 'chart-of-accounts'
  | 'financial-reports'

export function AccountsPanel() {
  const { ops } = routeApi.useLoaderData()
  const search = routeApi.useSearch()
  const navigate = useNavigate()
  const router = useRouter()

  const activeTab: SubAccountTab = search.tab || 'ledger'

  const setActiveTab = (tab: SubAccountTab) => {
    navigate({
      to: '/admin/accounts',
      search: (prev) => ({ ...prev, tab }),
    })
  }

  // General Ledger state
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState(search.account || 'all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [glPartyTypeFilter, setGlPartyTypeFilter] = useState(
    search.partyType || 'all',
  )
  const [glPartyIdFilter, setGlPartyIdFilter] = useState(
    search.partyId || 'all',
  )
  const [glVoucherTypeFilter, setGlVoucherTypeFilter] = useState(
    search.voucherType || 'all',
  )

  // Double-Entry State
  const [ledgerSubView, setLedgerSubView] = useState<
    'vouchers' | 'general-ledger' | 'legacy'
  >('vouchers')
  const [expandedVoucherId, setExpandedVoucherId] = useState<string | null>(
    null,
  )
  const [coaCategoryFilter, setCoaCategoryFilter] = useState('all')
  const [coaSearch, setCoaSearch] = useState('')
  const [voucherTypeFilter, setVoucherTypeFilter] = useState('all')

  // Voucher Inspector Modal State
  const [isVoucherDetailsOpen, setIsVoucherDetailsOpen] = useState(false)
  const [selectedVoucherEntry, setSelectedVoucherEntry] =
    useState<DetailedJournalEntry | null>(null)
  const [selectedVoucherSlug, setSelectedVoucherSlug] = useState<string | null>(
    null,
  )

  useEffect(() => {
    if (search.account) {
      setAccountFilter(search.account)
      setLedgerSubView('general-ledger')
    }
  }, [search.account])

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
  const [isBatchDealerSettlementOpen, setIsBatchDealerSettlementOpen] =
    useState(false)
  const [batchDealerId, setBatchDealerId] = useState<string>('')
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false)
  const [isRiderPayrollRunOpen, setIsRiderPayrollRunOpen] = useState(false)
  const [isRiderApprovalModalOpen, setIsRiderApprovalModalOpen] =
    useState(false)
  const [selectedRiderSettlement, setSelectedRiderSettlement] =
    useState<any>(null)
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Double-entry manual voucher form
  const [manualVoucherForm, setManualVoucherForm] = useState({
    voucherType: 'JV' as 'JV' | 'PV' | 'RV' | 'CV',
    narration: '',
    debitAccountId: 'acc_5041',
    creditAccountId: 'acc_1012',
    amountInRs: 1000,
  })

  // Handover modal state
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false)
  const [handoverForm, setHandoverForm] = useState({
    riderId: '',
    amountInRs: 0,
    notes: '',
  })

  // Dealer payout form
  const [dealerPayoutForm, setDealerPayoutForm] = useState({
    dealerId: '',
    dealerName: '',
    amountInRs: 0,
    tdsRate: 0,
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
  const rawJournalEntries = ops.journalEntries
  const rawGeneralLedger = ops.generalLedger
  const rawChartOfAccounts = ops.chartOfAccounts
  const rawFiscalYears = ops.fiscalYears
  const rawDealerPayables = ops.dealerPayables
  const rawRiderAccounts = ops.riderAccounts

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

  // Double-Entry Calculations
  const filteredJournalEntries = useMemo(() => {
    return rawJournalEntries.filter((e) => {
      if (voucherTypeFilter !== 'all' && e.voucherType !== voucherTypeFilter) {
        return false
      }
      if (ledgerSearch.trim()) {
        const q = ledgerSearch.toLowerCase()
        return (
          e.voucherNo.toLowerCase().includes(q) ||
          e.narration.toLowerCase().includes(q) ||
          (e.refId || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [rawJournalEntries, voucherTypeFilter, ledgerSearch])

  const filteredGeneralLedger = useMemo(() => {
    return rawGeneralLedger.filter((row: any) => {
      if (
        accountFilter !== 'all' &&
        row.accountId !== accountFilter &&
        row.accountCode !== accountFilter
      ) {
        return false
      }
      if (glPartyTypeFilter !== 'all' && row.partyType !== glPartyTypeFilter) {
        return false
      }
      if (glPartyIdFilter !== 'all' && row.partyId !== glPartyIdFilter) {
        return false
      }
      if (
        glVoucherTypeFilter !== 'all' &&
        row.voucherType !== glVoucherTypeFilter
      ) {
        return false
      }
      if (ledgerSearch.trim()) {
        const q = ledgerSearch.toLowerCase()
        return (
          row.voucherNo.toLowerCase().includes(q) ||
          row.accountName.toLowerCase().includes(q) ||
          row.accountCode.toLowerCase().includes(q) ||
          (row.partyId || '').toLowerCase().includes(q) ||
          (row.narration || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [
    rawGeneralLedger,
    accountFilter,
    glPartyTypeFilter,
    glPartyIdFilter,
    glVoucherTypeFilter,
    ledgerSearch,
  ])

  const totalGlDebit = useMemo(() => {
    return filteredGeneralLedger.reduce(
      (sum: number, r: any) => sum + r.debit,
      0,
    )
  }, [filteredGeneralLedger])

  const totalGlCredit = useMemo(() => {
    return filteredGeneralLedger.reduce(
      (sum: number, r: any) => sum + r.credit,
      0,
    )
  }, [filteredGeneralLedger])

  const netGlClosingBalance = useMemo(() => {
    if (filteredGeneralLedger.length === 0) return 0
    return filteredGeneralLedger[filteredGeneralLedger.length - 1].balance
  }, [filteredGeneralLedger])

  const filteredChartOfAccounts = useMemo(() => {
    return rawChartOfAccounts.filter((acc) => {
      if (coaCategoryFilter !== 'all' && acc.rootType !== coaCategoryFilter) {
        return false
      }
      if (coaSearch.trim()) {
        const q = coaSearch.toLowerCase()
        return (
          acc.code.toLowerCase().includes(q) ||
          acc.name.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [rawChartOfAccounts, coaCategoryFilter, coaSearch])

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
    const fromLedger = rawLedger.filter(
      (l) =>
        l.category === 'dealer_payment' ||
        l.refType === 'dealer' ||
        (l.category === 'purchase' && l.refId?.startsWith('dlr_')),
    )
    const fromSettlements = (ops.dealerSettlements || []).map((ds: any) => ({
      id: ds.id,
      date: ds.createdAt ? ds.createdAt.slice(0, 10) : '',
      type: 'debit',
      category: 'dealer_settlement',
      account: ds.paymentMethod || 'bank',
      memo:
        ds.notes || `Disbursement for ${ds.dealerName} (${ds.voucherNo || ''})`,
      amount: ds.netAmount || ds.grossAmount,
      refType: 'dealer_settlement',
      refId: ds.dealerId,
      slug: ds.slug,
      voucherNo: ds.voucherNo,
    }))
    return [...fromSettlements, ...fromLedger]
  }, [rawLedger, ops.dealerSettlements])

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

    // Merge double-entry AP summaries when present
    for (const dp of rawDealerPayables) {
      const existing = map.get(dp.dealerId)
      if (existing) {
        if (dp.totalProcured > 0) existing.totalProcured = dp.totalProcured
        if (dp.totalPaid > 0) existing.totalPaid = dp.totalPaid
      }
    }

    return Array.from(map.values())
  }, [rawDealers, dealerProcurements, dealerVouchers, rawDealerPayables])

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
  const handlePostManualVoucher = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualVoucherForm.narration || manualVoucherForm.amountInRs <= 0) {
      toast.error('Please enter a narration and valid amount in Rs.')
      return
    }

    try {
      setIsSubmitting(true)
      const amtPaisa = toPaisa(Number(manualVoucherForm.amountInRs))
      await postManualJournalVoucherFn({
        data: {
          voucherType: manualVoucherForm.voucherType,
          narration: manualVoucherForm.narration,
          lines: [
            {
              accountId: manualVoucherForm.debitAccountId,
              debit: amtPaisa,
              credit: 0,
              narration: manualVoucherForm.narration,
            },
            {
              accountId: manualVoucherForm.creditAccountId,
              debit: 0,
              credit: amtPaisa,
              narration: manualVoucherForm.narration,
            },
          ],
        },
      })
      toast.success('Double-entry journal voucher posted successfully!')
      setIsAddVoucherOpen(false)
      setManualVoucherForm({
        voucherType: 'JV',
        narration: '',
        debitAccountId: 'acc_5041',
        creditAccountId: 'acc_1012',
        amountInRs: 1000,
      })
      await router.invalidate()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to post voucher')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenDealerPayout = (
    dealer: (typeof rawDealers)[number],
    balance: number,
  ) => {
    const defaultTds = (dealer as any).tdsRate
      ? Number((dealer as any).tdsRate)
      : 0
    setDealerPayoutForm({
      dealerId: dealer.id,
      dealerName: dealer.name,
      amountInRs: Math.max(0, Math.round(balance / 100)),
      tdsRate: defaultTds,
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
      await recordDealerDisbursementFn({
        data: {
          dealerId: dealerPayoutForm.dealerId,
          amountInRs: Number(dealerPayoutForm.amountInRs),
          paymentAccount: dealerPayoutForm.account === 'cash' ? 'cash' : 'bank',
          tdsRate: Number(dealerPayoutForm.tdsRate || 0),
          memo: dealerPayoutForm.memo,
        },
      })
      toast.success(
        `Dealer payout of Rs. ${dealerPayoutForm.amountInRs} posted with PV voucher`,
      )
      setIsDealerPayoutOpen(false)
      await router.invalidate()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to record dealer payout')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenCashHandover = (
    riderId?: string,
    riderName?: string,
    cash?: number,
  ) => {
    setHandoverForm({
      riderId: riderId || '',
      amountInRs: cash ? Math.round(cash / 100) : 500,
      notes: riderName ? `Cash handover from ${riderName}` : '',
    })
    setIsHandoverModalOpen(true)
  }

  const handlePostCashHandover = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!handoverForm.riderId || handoverForm.amountInRs <= 0) {
      toast.error('Please select a rider and enter a valid handover amount')
      return
    }

    try {
      setIsSubmitting(true)
      await recordManagerCashHandoverFn({
        data: {
          riderId: handoverForm.riderId,
          amountInRs: Number(handoverForm.amountInRs),
          notes: handoverForm.notes || undefined,
        },
      })
      toast.success('Rider cash handover received and RV voucher posted!')
      setIsHandoverModalOpen(false)
      await router.invalidate()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to record cash handover')
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

  const handleOpenVoucherDetails = (
    voucherNo: string,
    slug?: string | null,
  ) => {
    const matchedEntry = rawJournalEntries.find(
      (e: any) => e.voucherNo === voucherNo || e.id === voucherNo,
    )
    let publicSlug = slug || null
    if (!publicSlug) {
      const ds = (ops.dealerSettlements || []).find(
        (s: any) => s.voucherNo === voucherNo,
      )
      if (ds?.slug) publicSlug = ds.slug
      const rs = (ops.settlements || []).find(
        (s: any) => s.voucherNo === voucherNo || s.id === voucherNo,
      )
      if (rs?.slug) publicSlug = rs.slug
    }

    if (matchedEntry) {
      setSelectedVoucherEntry(matchedEntry)
      setSelectedVoucherSlug(publicSlug)
      setIsVoucherDetailsOpen(true)
    } else {
      const matchingGlRows = rawGeneralLedger.filter(
        (r: any) => r.voucherNo === voucherNo,
      )
      if (matchingGlRows.length > 0) {
        const first = matchingGlRows[0]
        const totalDebit = matchingGlRows.reduce(
          (s: number, r: any) => s + r.debit,
          0,
        )
        const totalCredit = matchingGlRows.reduce(
          (s: number, r: any) => s + r.credit,
          0,
        )
        const fallbackEntry: DetailedJournalEntry = {
          id: first.entryId || voucherNo,
          voucherNo: first.voucherNo,
          voucherType: first.voucherType,
          fiscalYearId: '',
          postingDate: first.postingDate,
          bsDate: first.bsDate,
          dualDate: first.dualDate,
          narration: first.narration || '',
          refType: null,
          refId: null,
          event: null,
          postingStatus: 'posted',
          reversalOf: null,
          metadata: null,
          createdBy: 'system',
          totalDebit,
          totalCredit,
          lines: matchingGlRows.map((r: any) => ({
            id: r.lineId,
            accountId: r.accountId,
            accountCode: r.accountCode,
            accountName: r.accountName,
            accountRootType: r.accountRootType,
            debit: r.debit,
            credit: r.credit,
            partyType: r.partyType,
            partyId: r.partyId,
            costCenter: r.costCenter,
            narration: r.narration,
          })),
        }
        setSelectedVoucherEntry(fallbackEntry)
        setSelectedVoucherSlug(publicSlug)
        setIsVoucherDetailsOpen(true)
      } else {
        toast.info(`Voucher ${voucherNo} details not found`)
      }
    }
  }

  const handleDrillDownToLedger = (accountIdOrCode: string) => {
    setAccountFilter(accountIdOrCode)
    setLedgerSubView('general-ledger')
    setActiveTab('ledger')
    navigate({
      to: '/admin/accounts',
      search: (prev) => ({ ...prev, tab: 'ledger', account: accountIdOrCode }),
    })
  }

  const handleResetGlFilters = () => {
    setAccountFilter('all')
    setGlPartyTypeFilter('all')
    setGlPartyIdFilter('all')
    setGlVoucherTypeFilter('all')
    setLedgerSearch('')
    navigate({
      to: '/admin/accounts',
      search: (prev) => ({
        ...prev,
        tab: 'ledger',
        account: undefined,
        partyType: undefined,
        partyId: undefined,
        voucherType: undefined,
      }),
    })
  }

  const handleExportGeneralLedgerCSV = () => {
    const headers =
      'Posting Date BS,Posting Date AD,Voucher No,Voucher Type,Account Code,Account Name,Party Type,Party ID,Narration,Debit (NPR),Credit (NPR),Running Balance (NPR)\n'
    const rows = filteredGeneralLedger
      .map(
        (r: any) =>
          `"${r.bsDate}","${r.postingDate.slice(0, 10)}","${r.voucherNo}","${r.voucherType}","${r.accountCode}","${r.accountName.replace(/"/g, '""')}","${r.partyType || ''}","${r.partyId || ''}","${(r.narration || '').replace(/"/g, '""')}",${(r.debit / 100).toFixed(2)},${(r.credit / 100).toFixed(2)},${(r.balance / 100).toFixed(2)}`,
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `general-ledger-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('General Ledger exported to CSV')
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

      {/* Sub-Accounts Navigation Tabs */}
      <div className="border-b border-border">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as SubAccountTab)}
        >
          <TabsList className="flex h-10 w-full items-center justify-start gap-1 bg-transparent p-0 overflow-x-auto click-scroll border-none">
            <TabsTrigger
              value="ledger"
              className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 pb-2.5 pt-2 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none gap-2 shrink-0 cursor-pointer"
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>General Ledger</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                {rawJournalEntries.length}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="transactions"
              className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 pb-2.5 pt-2 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none gap-2 shrink-0 cursor-pointer"
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Transactions</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                {rawPayments.length}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="dealer-ledger"
              className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 pb-2.5 pt-2 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none gap-2 shrink-0 cursor-pointer"
            >
              <Store className="h-3.5 w-3.5" />
              <span>Dealer Payables</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                {rawDealers.length}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="sales-account"
              className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 pb-2.5 pt-2 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none gap-2 shrink-0 cursor-pointer"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Sales Account</span>
            </TabsTrigger>

            <TabsTrigger
              value="salary-account"
              className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 pb-2.5 pt-2 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none gap-2 shrink-0 cursor-pointer"
            >
              <Coins className="h-3.5 w-3.5" />
              <span>Rider Payroll</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                {rawSettlements.length}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="chart-of-accounts"
              className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 pb-2.5 pt-2 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none gap-2 shrink-0 cursor-pointer"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Chart of Accounts</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                39
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="financial-reports"
              className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 pb-2.5 pt-2 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:shadow-none gap-2 shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Financial Reports</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ==================================================== */}
      {/* 1. SUB-ACCOUNT: GENERAL LEDGER                       */}
      {/* ==================================================== */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
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

          {/* Sub-view Switcher & Filters */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2.5">
              <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
                <Button
                  type="button"
                  variant={ledgerSubView === 'vouchers' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setLedgerSubView('vouchers')}
                  className="h-7 text-xs gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Journal Vouchers ({rawJournalEntries.length})
                </Button>
                <Button
                  type="button"
                  variant={
                    ledgerSubView === 'general-ledger' ? 'default' : 'ghost'
                  }
                  size="sm"
                  onClick={() => setLedgerSubView('general-ledger')}
                  className="h-7 text-xs gap-1.5"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  General Ledger ({rawGeneralLedger.length})
                </Button>
                <Button
                  type="button"
                  variant={ledgerSubView === 'legacy' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setLedgerSubView('legacy')}
                  className="h-7 text-xs gap-1.5"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Legacy Archive ({rawLedger.length})
                </Button>
              </div>

              <span className="text-xs text-muted-foreground">
                {ledgerSubView === 'vouchers' &&
                  `${filteredJournalEntries.length} vouchers`}
                {ledgerSubView === 'general-ledger' &&
                  `${filteredGeneralLedger.length} ledger postings`}
                {ledgerSubView === 'legacy' &&
                  `${filteredLedger.length} legacy entries`}
              </span>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={
                    ledgerSubView === 'vouchers'
                      ? 'Search voucher #, narration, ref ID...'
                      : 'Search account, memo, voucher...'
                  }
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="h-8 pl-9 text-xs"
                />
              </div>

              {ledgerSubView === 'vouchers' ? (
                <div className="flex items-center gap-2">
                  <NativeSelect
                    value={voucherTypeFilter}
                    onChange={(e) => setVoucherTypeFilter(e.target.value)}
                    size="sm"
                    className="h-8 text-xs font-mono"
                  >
                    <NativeSelectOption value="all">
                      All Voucher Types
                    </NativeSelectOption>
                    <NativeSelectOption value="SV">
                      SV - Sales Voucher
                    </NativeSelectOption>
                    <NativeSelectOption value="RV">
                      RV - Receipt Voucher
                    </NativeSelectOption>
                    <NativeSelectOption value="PV">
                      PV - Payment Voucher
                    </NativeSelectOption>
                    <NativeSelectOption value="JV">
                      JV - Journal Voucher
                    </NativeSelectOption>
                    <NativeSelectOption value="CV">
                      CV - Contra Voucher
                    </NativeSelectOption>
                  </NativeSelect>
                </div>
              ) : ledgerSubView === 'general-ledger' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <NativeSelect
                    value={accountFilter}
                    onChange={(e) => setAccountFilter(e.target.value)}
                    size="sm"
                    className="h-8 text-xs font-mono max-w-[200px]"
                  >
                    <NativeSelectOption value="all">
                      All Chart Accounts ({rawChartOfAccounts.length})
                    </NativeSelectOption>
                    {rawChartOfAccounts
                      .filter((a: any) => !a.isGroup)
                      .map((a: any) => (
                        <NativeSelectOption key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>

                  <NativeSelect
                    value={glPartyTypeFilter}
                    onChange={(e) => {
                      setGlPartyTypeFilter(e.target.value)
                      setGlPartyIdFilter('all')
                    }}
                    size="sm"
                    className="h-8 text-xs"
                  >
                    <NativeSelectOption value="all">
                      All Parties
                    </NativeSelectOption>
                    <NativeSelectOption value="dealer">
                      Dealers / Suppliers
                    </NativeSelectOption>
                    <NativeSelectOption value="rider">
                      Fleet Couriers
                    </NativeSelectOption>
                    <NativeSelectOption value="customer">
                      Customers
                    </NativeSelectOption>
                  </NativeSelect>

                  {glPartyTypeFilter === 'dealer' && (
                    <NativeSelect
                      value={glPartyIdFilter}
                      onChange={(e) => setGlPartyIdFilter(e.target.value)}
                      size="sm"
                      className="h-8 text-xs max-w-[150px]"
                    >
                      <NativeSelectOption value="all">
                        All Dealers ({rawDealers.length})
                      </NativeSelectOption>
                      {rawDealers.map((d: any) => (
                        <NativeSelectOption key={d.id} value={d.id}>
                          {d.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}

                  {glPartyTypeFilter === 'rider' && (
                    <NativeSelect
                      value={glPartyIdFilter}
                      onChange={(e) => setGlPartyIdFilter(e.target.value)}
                      size="sm"
                      className="h-8 text-xs max-w-[150px]"
                    >
                      <NativeSelectOption value="all">
                        All Riders ({ops.riders.length})
                      </NativeSelectOption>
                      {ops.riders.map((r: any) => (
                        <NativeSelectOption key={r.id} value={r.id}>
                          {r.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}

                  <NativeSelect
                    value={glVoucherTypeFilter}
                    onChange={(e) => setGlVoucherTypeFilter(e.target.value)}
                    size="sm"
                    className="h-8 text-xs font-mono"
                  >
                    <NativeSelectOption value="all">
                      All Vouchers
                    </NativeSelectOption>
                    <NativeSelectOption value="SV">
                      SV - Sales
                    </NativeSelectOption>
                    <NativeSelectOption value="RV">
                      RV - Receipt
                    </NativeSelectOption>
                    <NativeSelectOption value="PV">
                      PV - Payment
                    </NativeSelectOption>
                    <NativeSelectOption value="JV">
                      JV - Journal
                    </NativeSelectOption>
                    <NativeSelectOption value="CV">
                      CV - Contra
                    </NativeSelectOption>
                  </NativeSelect>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportGeneralLedgerCSV}
                    className="h-8 gap-1.5 text-xs"
                    title="Export filtered General Ledger to CSV"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </Button>
                </div>
              ) : (
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
              )}
            </div>

            {ledgerSubView === 'general-ledger' &&
              (accountFilter !== 'all' ||
                glPartyTypeFilter !== 'all' ||
                glPartyIdFilter !== 'all' ||
                glVoucherTypeFilter !== 'all' ||
                ledgerSearch.trim() !== '') && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 text-xs">
                  <span className="text-muted-foreground font-medium">
                    Active Filters:
                  </span>
                  {accountFilter !== 'all' && (
                    <Badge
                      variant="secondary"
                      className="gap-1 text-[11px] font-mono"
                    >
                      Account:{' '}
                      {rawChartOfAccounts.find(
                        (a: any) =>
                          a.id === accountFilter || a.code === accountFilter,
                      )?.code || accountFilter}
                      <button
                        type="button"
                        onClick={() => setAccountFilter('all')}
                        className="cursor-pointer"
                      >
                        <X className="h-3 w-3 hover:text-foreground" />
                      </button>
                    </Badge>
                  )}
                  {glPartyTypeFilter !== 'all' && (
                    <Badge
                      variant="secondary"
                      className="gap-1 text-[11px] capitalize"
                    >
                      Party: {glPartyTypeFilter}
                      <button
                        type="button"
                        onClick={() => {
                          setGlPartyTypeFilter('all')
                          setGlPartyIdFilter('all')
                        }}
                        className="cursor-pointer"
                      >
                        <X className="h-3 w-3 hover:text-foreground" />
                      </button>
                    </Badge>
                  )}
                  {glPartyIdFilter !== 'all' && (
                    <Badge variant="secondary" className="gap-1 text-[11px]">
                      Party ID: {glPartyIdFilter}
                      <button
                        type="button"
                        onClick={() => setGlPartyIdFilter('all')}
                        className="cursor-pointer"
                      >
                        <X className="h-3 w-3 hover:text-foreground" />
                      </button>
                    </Badge>
                  )}
                  {glVoucherTypeFilter !== 'all' && (
                    <Badge
                      variant="secondary"
                      className="gap-1 text-[11px] font-mono"
                    >
                      Type: {glVoucherTypeFilter}
                      <button
                        type="button"
                        onClick={() => setGlVoucherTypeFilter('all')}
                        className="cursor-pointer"
                      >
                        <X className="h-3 w-3 hover:text-foreground" />
                      </button>
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetGlFilters}
                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Reset All Filters
                  </Button>
                </div>
              )}
          </div>

          {/* Ledger Table Container */}
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {ledgerSubView === 'vouchers' && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead className="text-xs">Voucher No & Type</TableHead>
                    <TableHead className="text-xs">Date (BS & AD)</TableHead>
                    <TableHead className="text-xs">Narration & Event</TableHead>
                    <TableHead className="text-xs">Reference</TableHead>
                    <TableHead className="text-right text-xs">
                      Total Debit
                    </TableHead>
                    <TableHead className="text-right text-xs">
                      Total Credit
                    </TableHead>
                    <TableHead className="text-center text-xs">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJournalEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="p-0">
                        <EmptyState
                          title="No journal vouchers found"
                          description="Double-entry vouchers (JV, PV, RV, SV) will appear here once generated."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredJournalEntries.map((entry: any) => {
                      const isExpanded = expandedVoucherId === entry.id
                      return (
                        <>
                          <TableRow
                            key={entry.id}
                            className="cursor-pointer hover:bg-muted/30"
                            onClick={() =>
                              setExpandedVoucherId(isExpanded ? null : entry.id)
                            }
                          >
                            <TableCell className="p-2 text-muted-foreground">
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="font-mono text-[10px]"
                                >
                                  {entry.voucherType}
                                </Badge>
                                <span className="font-mono text-xs font-semibold text-foreground">
                                  {entry.voucherNo}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-foreground block font-medium">
                                {entry.bsDate}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {entry.postingDate.slice(0, 10)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs text-foreground font-medium">
                                {entry.narration}
                              </div>
                              {entry.event && (
                                <span className="text-[10px] text-muted-foreground capitalize">
                                  Event: {entry.event.replace('_', ' ')}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {entry.refType
                                  ? `${entry.refType}: ${entry.refId || '—'}`
                                  : '—'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                              {formatNPR(entry.totalDebit)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                              {formatNPR(entry.totalCredit)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={
                                  entry.postingStatus === 'submitted'
                                    ? 'success'
                                    : 'secondary'
                                }
                                className="text-[10px] uppercase font-normal"
                              >
                                {entry.postingStatus}
                              </Badge>
                            </TableCell>
                          </TableRow>

                          {/* Expanded Lines */}
                          {isExpanded && (
                            <TableRow
                              key={`${entry.id}-lines`}
                              className="bg-muted/20"
                            >
                              <TableCell colSpan={8} className="p-3">
                                <div className="rounded-md border border-border bg-card p-2.5 space-y-2">
                                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                                    <span>Voucher Balanced Lines</span>
                                    <span>Created by: {entry.createdBy}</span>
                                  </div>
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-border/50 text-muted-foreground text-[10px]">
                                        <th className="text-left py-1 font-medium">
                                          Account Code & Title
                                        </th>
                                        <th className="text-left py-1 font-medium">
                                          Party / Cost Center
                                        </th>
                                        <th className="text-left py-1 font-medium">
                                          Line Narration
                                        </th>
                                        <th className="text-right py-1 font-medium">
                                          Debit (Rs.)
                                        </th>
                                        <th className="text-right py-1 font-medium">
                                          Credit (Rs.)
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/30 font-mono">
                                      {entry.lines.map((l: any) => (
                                        <tr key={l.id} className="py-1">
                                          <td className="py-1 text-left text-foreground">
                                            <span className="font-bold">
                                              {l.accountCode}
                                            </span>{' '}
                                            · {l.accountName}
                                          </td>
                                          <td className="py-1 text-left text-muted-foreground text-[11px]">
                                            {l.partyType
                                              ? `${l.partyType} (${l.partyId})`
                                              : l.costCenter || '—'}
                                          </td>
                                          <td className="py-1 text-left text-muted-foreground text-[11px] font-sans">
                                            {l.narration || '—'}
                                          </td>
                                          <td className="py-1 text-right text-emerald-600 dark:text-emerald-400">
                                            {l.debit > 0
                                              ? formatNPR(l.debit)
                                              : '—'}
                                          </td>
                                          <td className="py-1 text-right text-blue-600 dark:text-blue-400">
                                            {l.credit > 0
                                              ? formatNPR(l.credit)
                                              : '—'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            )}

            {ledgerSubView === 'general-ledger' && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">
                      Posting Date (BS & AD)
                    </TableHead>
                    <TableHead className="text-xs">Voucher No</TableHead>
                    <TableHead className="text-xs">Account</TableHead>
                    <TableHead className="text-xs">
                      Description & Memo
                    </TableHead>
                    <TableHead className="text-xs">
                      Cost Center / Party
                    </TableHead>
                    <TableHead className="text-right text-xs">Debit</TableHead>
                    <TableHead className="text-right text-xs">Credit</TableHead>
                    <TableHead className="text-right text-xs">
                      Running Balance
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGeneralLedger.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="p-0">
                        <EmptyState
                          title="No general ledger lines found"
                          description="Postings to the selected account will appear here."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {filteredGeneralLedger.map((row: any) => (
                        <TableRow key={row.lineId}>
                          <TableCell>
                            <span className="text-xs font-medium text-foreground block">
                              {row.bsDate}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {row.postingDate.slice(0, 10)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenVoucherDetails(row.voucherNo)
                              }
                              className="font-mono text-xs font-semibold text-primary hover:underline cursor-pointer text-left"
                              title="Inspect journal voucher and balancing legs"
                            >
                              {row.voucherNo}
                            </button>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs font-bold text-foreground block">
                              {row.accountCode}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {row.accountName}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-foreground font-medium">
                              {row.narration}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-[11px] text-muted-foreground">
                              {row.partyType
                                ? `${row.partyType}: ${row.partyId}`
                                : row.costCenter || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                            {row.debit > 0 ? formatNPR(row.debit) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-blue-600 dark:text-blue-400 font-semibold">
                            {row.credit > 0 ? formatNPR(row.credit) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold tabular-nums">
                            {formatNPR(row.balance)}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Summary Table Footer */}
                      <TableRow className="bg-muted/40 font-bold border-t-2 border-border">
                        <TableCell
                          colSpan={5}
                          className="text-xs uppercase text-foreground"
                        >
                          Total Movement ({filteredGeneralLedger.length} lines)
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                          {formatNPR(totalGlDebit)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-blue-600 dark:text-blue-400">
                          {formatNPR(totalGlCredit)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                          {formatNPR(netGlClosingBalance)}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            )}

            {ledgerSubView === 'legacy' && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date and ID</TableHead>
                    <TableHead className="text-xs">
                      Description & memo
                    </TableHead>
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
                          title="No legacy ledger vouchers found"
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
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. SUB-ACCOUNT: TRANSACTION                         */}
      {/* ==================================================== */}
      {activeTab === 'transactions' && (
        <div className="space-y-6">
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Dealer Accounts &amp; Payables Overview
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Showing {dealerBalances.length} registered dealers
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setBatchDealerId('')
                    setIsBatchDealerSettlementOpen(true)
                  }}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  Batch Settle Items
                </Button>
                <Link to="/admin/dealers">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    Dealers Directory
                  </Button>
                </Link>
              </div>
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
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setBatchDealerId(dealer.id)
                            setIsBatchDealerSettlementOpen(true)
                          }}
                          className="h-6 px-2 text-[10px] gap-1"
                          title="Select and settle delivered items for this dealer"
                        >
                          <Receipt className="h-3 w-3 text-amber-500" />
                          Settle Items
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleOpenDealerPayout(dealer, balance)
                          }
                          className="h-6 px-2 text-[10px] gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          Payout
                        </Button>
                      </div>
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
                    filteredDealerVouchers.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <span className="font-mono text-xs text-foreground block">
                            {v.voucherNo || v.id}
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
                          {v.slug ? (
                            <a
                              href={`/voucher/${v.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono"
                              title="View printable settlement voucher"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>{v.voucherNo || 'Voucher'}</span>
                            </a>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">
                              {v.refId || '-'}
                            </span>
                          )}
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

          {/* Rider Fleet Accounts Overview */}
          {rawRiderAccounts.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Rider Accounts &amp; COD Cash Balances
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {rawRiderAccounts.length} active couriers
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenCashHandover()}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
                    Receive Cash Handover
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenSalaryDisbursement()}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Manual Entry
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setIsRiderPayrollRunOpen(true)}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Run Monthly Payroll
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {rawRiderAccounts.map((r: any) => (
                  <Card key={r.riderId} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-xs text-foreground block">
                          {r.riderName}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {r.phone || 'No phone'}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleOpenCashHandover(
                            r.riderId,
                            r.riderName,
                            r.cashOnHand,
                          )
                        }
                        className="h-6 px-2 text-[10px] gap-1"
                      >
                        <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
                        Receive
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/30 p-2 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">
                          Cash in Hand
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {formatNPR(r.cashOnHand)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">
                          Commission Payable
                        </span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatNPR(r.commissionPayable)}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

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
                          <div className="flex items-center justify-end gap-1.5">
                            {set.slug && (
                              <a
                                href={`/voucher/${set.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                                title="Open printable public voucher"
                              >
                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                <span>Voucher</span>
                              </a>
                            )}
                            {set.status !== 'paid' && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedRiderSettlement(set)
                                  setIsRiderApprovalModalOpen(true)
                                }}
                                disabled={isSubmitting}
                                className="h-7 px-2 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Approve & Pay
                              </Button>
                            )}
                          </div>
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
      {/* 6. SUB-ACCOUNT: CHART OF ACCOUNTS                    */}
      {/* ==================================================== */}
      {activeTab === 'chart-of-accounts' && (
        <div className="space-y-6">
          {/* Root Category KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              label="Total Assets (1xxx)"
              value={formatNPR(
                rawChartOfAccounts
                  .filter((a: any) => a.rootType === 'asset' && !a.isGroup)
                  .reduce(
                    (sum: number, a: any) => sum + Math.max(0, a.netBalance),
                    0,
                  ),
              )}
              note="Cash, fleet, bank, clearing"
              icon={Wallet}
            />
            <KpiCard
              label="Total Liabilities (2xxx)"
              value={formatNPR(
                rawChartOfAccounts
                  .filter((a: any) => a.rootType === 'liability' && !a.isGroup)
                  .reduce(
                    (sum: number, a: any) => sum + Math.max(0, a.netBalance),
                    0,
                  ),
              )}
              note="Dealer AP, VAT 13%, TDS, riders"
              icon={Store}
              tone="warning"
            />
            <KpiCard
              label="Equity (3xxx)"
              value={formatNPR(
                rawChartOfAccounts
                  .filter((a: any) => a.rootType === 'equity' && !a.isGroup)
                  .reduce(
                    (sum: number, a: any) => sum + Math.max(0, a.netBalance),
                    0,
                  ),
              )}
              note="Capital & retained earnings"
              icon={Coins}
            />
            <KpiCard
              label="Total Revenue (4xxx)"
              value={formatNPR(
                rawChartOfAccounts
                  .filter((a: any) => a.rootType === 'income' && !a.isGroup)
                  .reduce(
                    (sum: number, a: any) => sum + Math.max(0, a.netBalance),
                    0,
                  ),
              )}
              note="Liquor, grocery, delivery"
              icon={TrendingUp}
              tone="success"
            />
            <KpiCard
              label="Total Expenses (5xxx)"
              value={formatNPR(
                rawChartOfAccounts
                  .filter((a: any) => a.rootType === 'expense' && !a.isGroup)
                  .reduce(
                    (sum: number, a: any) => sum + Math.max(0, a.netBalance),
                    0,
                  ),
              )}
              note="COGS, commission, overhead"
              icon={ArrowUpRight}
              tone="danger"
            />
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search account code (e.g. 1011) or name..."
                value={coaSearch}
                onChange={(e) => setCoaSearch(e.target.value)}
                className="h-8 pl-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs py-1 px-2.5 gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Active FY:{' '}
                {rawFiscalYears.find((fy: any) => !fy.isClosed)?.name ||
                  '2083/84'}
              </Badge>

              <NativeSelect
                value={coaCategoryFilter}
                onChange={(e) => setCoaCategoryFilter(e.target.value)}
                size="sm"
                className="h-8 text-xs"
              >
                <NativeSelectOption value="all">
                  All Root Types ({rawChartOfAccounts.length})
                </NativeSelectOption>
                <NativeSelectOption value="asset">
                  Assets (1000s)
                </NativeSelectOption>
                <NativeSelectOption value="liability">
                  Liabilities (2000s)
                </NativeSelectOption>
                <NativeSelectOption value="equity">
                  Equity (3000s)
                </NativeSelectOption>
                <NativeSelectOption value="income">
                  Income / Revenue (4000s)
                </NativeSelectOption>
                <NativeSelectOption value="expense">
                  Expenses / COGS (5000s)
                </NativeSelectOption>
              </NativeSelect>
            </div>
          </div>

          {/* Chart of Accounts Table */}
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[120px]">
                    Account Code
                  </TableHead>
                  <TableHead className="text-xs">
                    Account Title & Ledger
                  </TableHead>
                  <TableHead className="text-xs">Root Type</TableHead>
                  <TableHead className="text-xs">Classification</TableHead>
                  <TableHead className="text-right text-xs">
                    Total Debit
                  </TableHead>
                  <TableHead className="text-right text-xs">
                    Total Credit
                  </TableHead>
                  <TableHead className="text-right text-xs">
                    Net Balance
                  </TableHead>
                  <TableHead className="text-right text-xs w-[90px]">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChartOfAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="p-0">
                      <EmptyState
                        title="No accounts match filter"
                        description="Try adjusting your search or category filter."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredChartOfAccounts.map((acc: any) => {
                    const isGroup = acc.isGroup
                    const isDebitNormal =
                      acc.rootType === 'asset' || acc.rootType === 'expense'
                    return (
                      <TableRow
                        key={acc.id}
                        className={isGroup ? 'bg-muted/30 font-semibold' : ''}
                      >
                        <TableCell>
                          <button
                            type="button"
                            onClick={() =>
                              !isGroup && handleDrillDownToLedger(acc.id)
                            }
                            className={`font-mono text-xs font-bold text-left ${
                              !isGroup
                                ? 'text-primary hover:underline cursor-pointer'
                                : 'text-foreground'
                            }`}
                            title={
                              !isGroup
                                ? 'Drill down into General Ledger'
                                : undefined
                            }
                          >
                            {acc.code}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isGroup && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1.5 py-0"
                              >
                                GROUP
                              </Badge>
                            )}
                            <span className="text-xs text-foreground font-medium">
                              {acc.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] capitalize ${
                              acc.rootType === 'asset'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : acc.rootType === 'liability'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : acc.rootType === 'income'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : acc.rootType === 'expense'
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                      : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                            }`}
                          >
                            {acc.rootType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-[11px] text-muted-foreground">
                            {acc.ownerType
                              ? `${acc.ownerType} ledger`
                              : isGroup
                                ? 'Parent Group'
                                : 'Ledger Account'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {acc.totalDebit > 0 ? formatNPR(acc.totalDebit) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {acc.totalCredit > 0
                            ? formatNPR(acc.totalCredit)
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          <span
                            className={
                              acc.netBalance > 0
                                ? isDebitNormal
                                  ? 'text-primary'
                                  : 'text-emerald-600 dark:text-emerald-400'
                                : acc.netBalance < 0
                                  ? 'text-destructive'
                                  : 'text-muted-foreground'
                            }
                          >
                            {formatNPR(acc.netBalance)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {!isGroup && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDrillDownToLedger(acc.id)}
                              className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                              title="Drill down into General Ledger"
                            >
                              <span>Ledger</span>
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 7. SUB-ACCOUNT: FINANCIAL REPORTS (ERP DESK)         */}
      {/* ==================================================== */}
      {activeTab === 'financial-reports' && (
        <FinancialReportsTab
          chartOfAccounts={rawChartOfAccounts}
          onDrillDown={handleDrillDownToLedger}
          settings={{
            legalName: ops.settings.legalName,
            address: ops.settings.address,
            pan: ops.settings.pan,
          }}
          fiscalYearName={
            rawFiscalYears.find((fy: any) => !fy.isClosed)?.name || '2083/84'
          }
        />
      )}

      {/* ==================================================== */}
      {/* MODALS                                               */}
      {/* ==================================================== */}

      {/* Record Double-Entry Voucher Dialog */}
      <Dialog open={isAddVoucherOpen} onOpenChange={setIsAddVoucherOpen}>
        <DialogContent className="sm:max-w-lg md:max-w-xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
          <form
            onSubmit={handlePostManualVoucher}
            className="flex flex-col h-full min-h-0"
          >
            <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-muted/10">
              <DialogTitle className="text-sm font-semibold">
                Post Double-Entry Journal Voucher
              </DialogTitle>
              <DialogDescription className="text-xs">
                Balanced journal voucher posting directly to Nepal Chart of
                Accounts.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 click-scroll">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Voucher Type *</Label>
                  <NativeSelect
                    value={manualVoucherForm.voucherType}
                    onChange={(e) =>
                      setManualVoucherForm({
                        ...manualVoucherForm,
                        voucherType: e.target.value as any,
                      })
                    }
                    size="sm"
                    className="w-full text-xs font-mono"
                  >
                    <NativeSelectOption value="JV">
                      JV - Journal Voucher
                    </NativeSelectOption>
                    <NativeSelectOption value="PV">
                      PV - Payment Voucher
                    </NativeSelectOption>
                    <NativeSelectOption value="RV">
                      RV - Receipt Voucher
                    </NativeSelectOption>
                    <NativeSelectOption value="CV">
                      CV - Contra Voucher
                    </NativeSelectOption>
                  </NativeSelect>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Amount (in Rs. NPR) *</Label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={manualVoucherForm.amountInRs}
                    onChange={(e) =>
                      setManualVoucherForm({
                        ...manualVoucherForm,
                        amountInRs: Number(e.target.value),
                      })
                    }
                    className="h-8 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Narration / memo *</Label>
                <Input
                  required
                  value={manualVoucherForm.narration}
                  onChange={(e) =>
                    setManualVoucherForm({
                      ...manualVoucherForm,
                      narration: e.target.value,
                    })
                  }
                  placeholder="e.g. Warehouse electricity utility payment"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      Debit Line (Dr.) *
                    </Label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Rs.{' '}
                      {Number(
                        manualVoucherForm.amountInRs || 0,
                      ).toLocaleString()}
                    </span>
                  </div>
                  <NativeSelect
                    value={manualVoucherForm.debitAccountId}
                    onChange={(e) =>
                      setManualVoucherForm({
                        ...manualVoucherForm,
                        debitAccountId: e.target.value,
                      })
                    }
                    size="sm"
                    className="w-full text-xs font-mono"
                  >
                    {rawChartOfAccounts
                      .filter((a: any) => !a.isGroup)
                      .map((a: any) => (
                        <NativeSelectOption key={a.id} value={a.id}>
                          {a.code} - {a.name} ({a.rootType})
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      Credit Line (Cr.) *
                    </Label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Rs.{' '}
                      {Number(
                        manualVoucherForm.amountInRs || 0,
                      ).toLocaleString()}
                    </span>
                  </div>
                  <NativeSelect
                    value={manualVoucherForm.creditAccountId}
                    onChange={(e) =>
                      setManualVoucherForm({
                        ...manualVoucherForm,
                        creditAccountId: e.target.value,
                      })
                    }
                    size="sm"
                    className="w-full text-xs font-mono"
                  >
                    {rawChartOfAccounts
                      .filter((a: any) => !a.isGroup)
                      .map((a: any) => (
                        <NativeSelectOption key={a.id} value={a.id}>
                          {a.code} - {a.name} ({a.rootType})
                        </NativeSelectOption>
                      ))}
                  </NativeSelect>
                </div>
              </div>
            </div>

            <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddVoucherOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Posting...' : 'Post balanced voucher'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Dealer Payout Dialog */}
      <Dialog open={isDealerPayoutOpen} onOpenChange={setIsDealerPayoutOpen}>
        <DialogContent className="sm:max-w-lg md:max-w-xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
          <form
            onSubmit={handlePostDealerPayout}
            className="flex flex-col h-full min-h-0"
          >
            <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-muted/10">
              <DialogTitle className="text-sm font-semibold">
                Disburse Dealer Supplier Payment
              </DialogTitle>
              <DialogDescription className="text-xs">
                Records an accounts payable settlement voucher to the dealer in
                the general ledger with optional TDS withholding.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 click-scroll">
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
                  <Label className="text-xs">Gross Amount (in Rs. NPR) *</Label>
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

                <div className="space-y-1.5">
                  <Label className="text-xs">TDS Withholding Rate %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={dealerPayoutForm.tdsRate}
                    onChange={(e) =>
                      setDealerPayoutForm({
                        ...dealerPayoutForm,
                        tdsRate: Number(e.target.value),
                      })
                    }
                    placeholder="0 (default)"
                    className="h-8 font-mono text-xs"
                  />
                </div>
              </div>

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
                    Bank transfer / Cheque (acc_1012)
                  </NativeSelectOption>
                  <NativeSelectOption value="cash">
                    Cash in hand (acc_1011)
                  </NativeSelectOption>
                </NativeSelect>
              </div>

              {/* Payout Calculation Preview */}
              <div className="rounded-md border border-border bg-muted/20 p-2.5 text-xs space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Gross Payable (Dr Dealer AP):</span>
                  <span className="font-mono">
                    Rs.{' '}
                    {Number(dealerPayoutForm.amountInRs || 0).toLocaleString()}
                  </span>
                </div>
                {Number(dealerPayoutForm.tdsRate || 0) > 0 && (
                  <div className="flex justify-between text-amber-500">
                    <span>
                      TDS Withholding ({dealerPayoutForm.tdsRate}% Cr TDS):
                    </span>
                    <span className="font-mono">
                      -Rs.{' '}
                      {(
                        (Number(dealerPayoutForm.amountInRs || 0) *
                          Number(dealerPayoutForm.tdsRate)) /
                        100
                      ).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border/50">
                  <span>Net Disbursed (Cr Cash/Bank):</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    Rs.{' '}
                    {(
                      Number(dealerPayoutForm.amountInRs || 0) *
                      (1 - Number(dealerPayoutForm.tdsRate || 0) / 100)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDealerPayoutOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Posting...' : 'Disburse & Post PV'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receive Rider Cash Handover Dialog */}
      <Dialog open={isHandoverModalOpen} onOpenChange={setIsHandoverModalOpen}>
        <DialogContent className="sm:max-w-lg md:max-w-xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
          <form
            onSubmit={handlePostCashHandover}
            className="flex flex-col h-full min-h-0"
          >
            <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-muted/10">
              <DialogTitle className="text-sm font-semibold">
                Receive Rider Cash Handover
              </DialogTitle>
              <DialogDescription className="text-xs">
                Receives COD cash collected by rider into operations counter and
                posts Receipt Voucher (RV).
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 click-scroll">
              <div className="space-y-1.5">
                <Label className="text-xs">Select Rider *</Label>
                <NativeSelect
                  value={handoverForm.riderId}
                  onChange={(e) => {
                    const r = ops.riders.find(
                      (rider) => rider.id === e.target.value,
                    )
                    setHandoverForm({
                      ...handoverForm,
                      riderId: e.target.value,
                      amountInRs: r
                        ? Math.round(r.cashOnHand / 100)
                        : handoverForm.amountInRs,
                      notes: r
                        ? `Cash handover from ${r.name}`
                        : handoverForm.notes,
                    })
                  }}
                  size="sm"
                  className="w-full text-xs"
                >
                  <NativeSelectOption value="">
                    Choose rider...
                  </NativeSelectOption>
                  {ops.riders.map((r) => (
                    <NativeSelectOption key={r.id} value={r.id}>
                      {r.name} — Cash on hand: Rs.{' '}
                      {(r.cashOnHand / 100).toLocaleString()}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  Amount Received (in Rs. NPR) *
                </Label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={handoverForm.amountInRs}
                  onChange={(e) =>
                    setHandoverForm({
                      ...handoverForm,
                      amountInRs: Number(e.target.value),
                    })
                  }
                  className="h-8 font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notes / Verification memo</Label>
                <Input
                  value={handoverForm.notes}
                  onChange={(e) =>
                    setHandoverForm({ ...handoverForm, notes: e.target.value })
                  }
                  placeholder="Counter handover verified"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsHandoverModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Receiving...' : 'Verify & Post RV'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Disburse Salary Dialog */}
      <Dialog open={isSalaryModalOpen} onOpenChange={setIsSalaryModalOpen}>
        <DialogContent className="sm:max-w-lg md:max-w-xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
          <form
            onSubmit={handlePostSalaryDisbursement}
            className="flex flex-col h-full min-h-0"
          >
            <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-muted/10">
              <DialogTitle className="text-sm font-semibold">
                Disburse Salary / Rider Commission
              </DialogTitle>
              <DialogDescription className="text-xs">
                Records a payroll disbursement debit voucher into the general
                ledger.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 click-scroll">
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
            </div>

            <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSalaryModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
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
        <DialogContent className="sm:max-w-3xl md:max-w-4xl w-[calc(100%-2rem)] max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border flex flex-row items-center justify-between space-y-0 bg-muted/10 shrink-0">
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

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 text-xs click-scroll">
            <div className="flex items-start justify-between border-b border-border/50 pb-3">
              <div>
                <h2 className="text-xs font-bold text-foreground uppercase">
                  {ops.settings.legalName ||
                    'MEZMANI LIQUOR & GROCERY PVT. LTD.'}
                </h2>
                <p className="text-muted-foreground">
                  {ops.settings.address || 'Traffic Chowk, Butwal, Nepal'}
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

          <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-between">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
              className="gap-1.5"
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </Button>
            <Button size="sm" onClick={() => setIsStatementModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Dealer Settlement Dialog */}
      <BatchDealerSettlementDialog
        open={isBatchDealerSettlementOpen}
        onOpenChange={setIsBatchDealerSettlementOpen}
        dealers={rawDealers.map((d) => ({
          id: d.id,
          name: d.name,
          city: d.city,
          pan: d.pan,
          defaultTdsRate: d.tdsRate ? parseFloat(d.tdsRate) : 0,
        }))}
        initialDealerId={batchDealerId}
      />

      {/* Rider Monthly Payroll Run Dialog */}
      <RiderPayrollRunDialog
        open={isRiderPayrollRunOpen}
        onOpenChange={setIsRiderPayrollRunOpen}
        riders={ops.riders}
      />

      {/* Rider Settlement Double-Entry Approval & Payout Dialog */}
      <RiderSettlementApprovalDialog
        open={isRiderApprovalModalOpen}
        onOpenChange={setIsRiderApprovalModalOpen}
        settlement={selectedRiderSettlement}
        onSuccess={(_voucherNo, slug) => {
          setSelectedVoucherSlug(slug)
        }}
      />

      {/* ERPNext Voucher Details Inspector Dialog */}
      <VoucherDetailsDialog
        open={isVoucherDetailsOpen}
        onOpenChange={setIsVoucherDetailsOpen}
        entry={selectedVoucherEntry}
        publicSlug={selectedVoucherSlug}
      />
    </div>
  )
}
