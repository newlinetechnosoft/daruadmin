import * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { can } from '#/server/auth/permissions-shared'
import type { ModuleKey, Settlement } from '#/server/operations/types'
import { DataRefreshButton } from '#/components/shared/data-refresh-button'
import { DataSection } from '#/components/shared/data-section'
import { PageHeader } from '#/components/shared/page-header'
import { AsyncBoundary } from '#/components/shared/async-boundary'
import { TabSkeleton, type SkeletonVariant } from '#/components/shared/loading'
import {
  postManualJournalVoucherFn,
  recordDealerDisbursementFn,
  recordManagerCashHandoverFn,
} from '#/server/finance/finance.functions'
import { formatNPR } from '#/lib/money'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Banknote,
  Bike,
  Building2,
  Calendar,
  Coins,
  CreditCard,
  FileSpreadsheet,
  FolderTree,
  Plus,
  Receipt,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  TrendingUp,
  Wallet,
  Download,
  Landmark,
  Scale,
  Tag,
  UserCheck,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { accountsRouteApi, normalizeAccountsTab } from './accounts-route'
import type { AccountsTab } from './accounts-route'

// Lazy-loaded tab components for component-scoped code splitting
const AccountsOverview = React.lazy(() =>
  import('./accounts-overview').then((m) => ({ default: m.AccountsOverview })),
)
const GeneralLedgerTab = React.lazy(() =>
  import('./tabs/general-ledger-tab').then((m) => ({
    default: m.GeneralLedgerTab,
  })),
)
const TransactionsTab = React.lazy(() =>
  import('./tabs/transactions-tab').then((m) => ({
    default: m.TransactionsTab,
  })),
)
const VouchersTab = React.lazy(() =>
  import('./tabs/vouchers-tab').then((m) => ({ default: m.VouchersTab })),
)
const PartyAccountsTab = React.lazy(() =>
  import('./tabs/party-accounts-tab').then((m) => ({
    default: m.PartyAccountsTab,
  })),
)
const BankCashTab = React.lazy(() =>
  import('./tabs/bank-cash-tab').then((m) => ({ default: m.BankCashTab })),
)
const ExpensesTab = React.lazy(() =>
  import('./tabs/expenses-tab').then((m) => ({ default: m.ExpensesTab })),
)
const ReconciliationTab = React.lazy(() =>
  import('./tabs/reconciliation-tab').then((m) => ({
    default: m.ReconciliationTab,
  })),
)
const ExportCenterTab = React.lazy(() =>
  import('./tabs/export-center-tab').then((m) => ({
    default: m.ExportCenterTab,
  })),
)
const PeriodCloseTab = React.lazy(() =>
  import('./tabs/period-close-tab').then((m) => ({
    default: m.PeriodCloseTab,
  })),
)
const AuditTrailTab = React.lazy(() =>
  import('./tabs/audit-trail-tab').then((m) => ({ default: m.AuditTrailTab })),
)
const AccountingSettingsTab = React.lazy(() =>
  import('./tabs/accounting-settings-tab').then((m) => ({
    default: m.AccountingSettingsTab,
  })),
)
const AccountDefaultsTab = React.lazy(() =>
  import('./account-defaults-tab').then((m) => ({
    default: m.AccountDefaultsTab,
  })),
)
const DealerReportTab = React.lazy(() =>
  import('./tabs/dealer-report-tab').then((m) => ({
    default: m.DealerReportTab,
  })),
)
const RiderReportTab = React.lazy(() =>
  import('./tabs/rider-report-tab').then((m) => ({
    default: m.RiderReportTab,
  })),
)
const RiderSettlementRequests = React.lazy(() =>
  import('./rider-settlement-requests').then((m) => ({
    default: m.RiderSettlementRequests,
  })),
)
const SalesAccountTab = React.lazy(() =>
  import('./tabs/sales-account-tab').then((m) => ({
    default: m.SalesAccountTab,
  })),
)
const SalaryAccountTab = React.lazy(() =>
  import('./tabs/salary-account-tab').then((m) => ({
    default: m.SalaryAccountTab,
  })),
)
const ChartOfAccountsTab = React.lazy(() =>
  import('./tabs/chart-of-accounts-tab').then((m) => ({
    default: m.ChartOfAccountsTab,
  })),
)
const BranchesTab = React.lazy(() =>
  import('./tabs/branches-tab').then((m) => ({ default: m.BranchesTab })),
)
const FinancialReportsTab = React.lazy(() =>
  import('./financial-reports-tab').then((m) => ({
    default: m.FinancialReportsTab,
  })),
)

// Lazy-loaded heavy dialogs
const BatchDealerSettlementDialog = React.lazy(() =>
  import('./batch-dealer-settlement-dialog').then((m) => ({
    default: m.BatchDealerSettlementDialog,
  })),
)
const RiderPayrollRunDialog = React.lazy(() =>
  import('./rider-payroll-run-dialog').then((m) => ({
    default: m.RiderPayrollRunDialog,
  })),
)
const RiderSettlementApprovalDialog = React.lazy(() =>
  import('./rider-settlement-approval-dialog').then((m) => ({
    default: m.RiderSettlementApprovalDialog,
  })),
)

type ManualVoucherType = 'JV' | 'PV' | 'RV' | 'CV'
type DealerPaymentMethod =
  'cash' | 'bank_transfer' | 'esewa' | 'khalti' | 'cheque'

const TAB_TRIGGER_CLASS =
  'relative h-9 shrink-0 cursor-pointer gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-2.5 pb-2 pt-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none'

const DEALER_PAYMENT_METHODS: Array<{
  value: DealerPaymentMethod
  label: string
}> = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'esewa', label: 'eSewa' },
  { value: 'khalti', label: 'Khalti' },
  { value: 'cheque', label: 'Cheque' },
]

export const TAB_MODULE_MAP: Record<AccountsTab, ModuleKey> = {
  overview: 'accounts_overview',
  'chart-of-accounts': 'accounts_chart_of_accounts',
  branches: 'accounts_branches',
  ledger: 'accounts_ledger',
  transactions: 'accounts_ledger',
  vouchers: 'accounts_vouchers',
  'party-accounts': 'accounts_party_accounts',
  'dealer-ledger': 'accounts_dealer_ledger',
  'rider-ledger': 'accounts_rider_ledger',
  'customer-ledger': 'accounts_customer_ledger',
  'supplier-ledger': 'accounts_supplier_ledger',
  'employee-ledger': 'accounts_employee_ledger',
  'bank-cash': 'accounts_bank_cash',
  expenses: 'accounts_expenses',
  reconciliation: 'accounts_reconciliation',
  'financial-reports': 'accounts_financial_reports',
  'export-center': 'accounts_export_center',
  'period-close': 'accounts_period_close',
  'audit-trail': 'accounts_audit_trail',
  settings: 'accounts_settings',
  'account-defaults': 'accounts_settings',
  'sales-account': 'accounts_sales_account',
  'salary-account': 'accounts_salary_account',
}

export const TAB_PREFETCH: Record<
  AccountsTab,
  {
    importTab: () => Promise<unknown>
    prefetchQueries: (qc: QueryClient) => void
  }
> = {
  overview: {
    importTab: () => import('./accounts-overview'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.ledger())
    },
  },
  'chart-of-accounts': {
    importTab: () => import('./tabs/chart-of-accounts-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.coaTree())
    },
  },
  branches: {
    importTab: () => import('./tabs/branches-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.branches())
    },
  },
  ledger: {
    importTab: () => import('./tabs/general-ledger-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.ledger())
      void qc.prefetchQuery(adminQueries.coaTree())
    },
  },
  transactions: {
    importTab: () => import('./tabs/transactions-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.journalTransactions({}))
    },
  },
  vouchers: {
    importTab: () => import('./tabs/vouchers-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.vouchersList({}))
    },
  },
  'party-accounts': {
    importTab: () => import('./tabs/party-accounts-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.dealers())
      void qc.prefetchQuery(adminQueries.riders())
    },
  },
  'dealer-ledger': {
    importTab: () => import('./tabs/dealer-report-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.dealers())
    },
  },
  'rider-ledger': {
    importTab: () => import('./tabs/rider-report-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.riders())
    },
  },
  'customer-ledger': {
    importTab: () => import('./tabs/party-accounts-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.customers())
    },
  },
  'supplier-ledger': {
    importTab: () => import('./tabs/party-accounts-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.dealers())
    },
  },
  'employee-ledger': {
    importTab: () => import('./tabs/party-accounts-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.staff())
    },
  },
  'bank-cash': {
    importTab: () => import('./tabs/bank-cash-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.bankAccounts())
      void qc.prefetchQuery(adminQueries.cashAccounts())
    },
  },
  expenses: {
    importTab: () => import('./tabs/expenses-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.expenseCategories())
      void qc.prefetchQuery(adminQueries.expenses({}))
      void qc.prefetchQuery(adminQueries.branches())
      void qc.prefetchQuery(adminQueries.bankAccounts())
      void qc.prefetchQuery(adminQueries.cashAccounts())
    },
  },
  reconciliation: {
    importTab: () => import('./tabs/reconciliation-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.bankAccounts())
      void qc.prefetchQuery(adminQueries.cashAccounts())
    },
  },
  'financial-reports': {
    importTab: () => import('./financial-reports-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.coaTree())
    },
  },
  'export-center': {
    importTab: () => import('./tabs/export-center-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.coaTree())
    },
  },
  'period-close': {
    importTab: () => import('./tabs/period-close-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.accountingPeriods())
    },
  },
  'audit-trail': {
    importTab: () => import('./tabs/audit-trail-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.financialAuditLogs({}))
    },
  },
  settings: {
    importTab: () => import('./tabs/accounting-settings-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.accountingConfig())
    },
  },
  'account-defaults': {
    importTab: () => import('./account-defaults-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.accountingConfig())
    },
  },
  'sales-account': {
    importTab: () => import('./tabs/sales-account-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.orders())
    },
  },
  'salary-account': {
    importTab: () => import('./tabs/salary-account-tab'),
    prefetchQueries: (qc) => {
      void qc.prefetchQuery(adminQueries.riders())
    },
  },
}

export function getTabSkeletonVariant(tab: AccountsTab): SkeletonVariant {
  switch (tab) {
    case 'overview':
    case 'bank-cash':
    case 'expenses':
    case 'dealer-ledger':
    case 'rider-ledger':
      return 'stats-table'
    case 'financial-reports':
      return 'report'
    case 'settings':
    case 'account-defaults':
      return 'form'
    case 'export-center':
      return 'cards'
    default:
      return 'table'
  }
}

export function AccountsPanel() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const search = accountsRouteApi.useSearch()
  const { data: access } = useSuspenseQuery(adminQueries.access())
  const grants = access?.grants
  const {
    data: ledgerData,
    isFetching,
    refetch,
  } = useSuspenseQuery(adminQueries.ledger())
  const ops = ledgerData.ops

  const chartOfAccounts = ops.chartOfAccounts
  const dealers = ops.dealers
  const riders = ops.riders
  const dealerPayables = ops.dealerPayables
  const riderCashHandovers = ops.riderCashHandovers

  const activeTab = normalizeAccountsTab(search.tab)

  const invalidateLedger = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] }),
      queryClient.invalidateQueries({
        queryKey: ['admin', 'dealer-payables-summary'],
      }),
      queryClient.invalidateQueries({
        queryKey: ['admin', 'rider-accounts-summary'],
      }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'general-ledger'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'party-statement'] }),
      queryClient.invalidateQueries({
        queryKey: ['admin', 'journal-transactions'],
      }),
    ])
  }, [queryClient])

  const setActiveTab = useCallback(
    (tab: AccountsTab) => {
      navigate({
        to: '/admin/accounts',
        search: (previous) => ({
          ...previous,
          tab,
          account: undefined,
          voucherType: undefined,
          partyType: undefined,
          partyId: undefined,
        }),
      })
    },
    [navigate],
  )

  const postableAccounts = useMemo(
    () =>
      chartOfAccounts.filter((account) => !account.isGroup && account.isActive),
    [chartOfAccounts],
  )

  const defaultDebitAccountId =
    postableAccounts.find((account) => account.code === '5130')?.id ??
    postableAccounts.find((account) => account.rootType === 'expense')?.id ??
    postableAccounts.at(0)?.id ??
    ''
  const defaultCreditAccountId =
    postableAccounts.find((account) => account.code === '1012')?.id ??
    postableAccounts.find((account) => account.code === '1011')?.id ??
    postableAccounts.at(0)?.id ??
    ''

  const batchDealers = useMemo(
    () =>
      dealers.map((dealer) => ({
        id: dealer.id,
        name: dealer.name,
        city: dealer.city,
        pan: dealer.pan,
        defaultTdsRate: Number(dealer.tdsRate ?? 0),
      })),
    [dealers],
  )

  const payrollRiders = useMemo(
    () =>
      riders.map((rider) => ({
        id: rider.id,
        name: rider.name,
        phone: rider.phone,
        baseSalary: rider.baseSalary,
        perDropRate: rider.perDropRate,
      })),
    [riders],
  )

  const [isAddVoucherOpen, setIsAddVoucherOpen] = useState(false)
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false)
  const [isDealerPayoutOpen, setIsDealerPayoutOpen] = useState(false)
  const [isBatchDealerSettlementOpen, setIsBatchDealerSettlementOpen] =
    useState(false)
  const [hasOpenedBatchSettlement, setHasOpenedBatchSettlement] =
    useState(false)
  const [batchDealerId, setBatchDealerId] = useState('')
  const [isRiderPayrollRunOpen, setIsRiderPayrollRunOpen] = useState(false)
  const [hasOpenedPayrollRun, setHasOpenedPayrollRun] = useState(false)
  const [isRiderApprovalModalOpen, setIsRiderApprovalModalOpen] =
    useState(false)
  const [hasOpenedApprovalModal, setHasOpenedApprovalModal] = useState(false)
  const [selectedRiderSettlement, setSelectedRiderSettlement] =
    useState<Settlement | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [manualVoucherForm, setManualVoucherForm] = useState({
    voucherType: 'JV' as ManualVoucherType,
    postingDate: new Date().toISOString().slice(0, 10),
    narration: '',
    debitAccountId: defaultDebitAccountId,
    creditAccountId: defaultCreditAccountId,
    amountInRs: 1000,
  })

  const [handoverForm, setHandoverForm] = useState({
    riderId: '',
    amountInRs: 0,
    notes: '',
  })

  const [dealerPayoutForm, setDealerPayoutForm] = useState({
    dealerId: '',
    dealerName: '',
    amountInRs: 0,
    tdsRate: 0,
    paymentMethod: 'bank_transfer' as DealerPaymentMethod,
    paymentReference: '',
    memo: '',
  })

  const handleOpenCashHandover = useCallback(
    (riderId?: string, riderName?: string, cashOnHand?: number) => {
      const fallbackId =
        riderId ??
        riders.find((rider) => rider.cashOnHand > 0)?.id ??
        riders.at(0)?.id ??
        ''
      const rider = riders.find((item) => item.id === fallbackId)
      const availableCash = cashOnHand ?? rider?.cashOnHand ?? 0
      setHandoverForm({
        riderId: fallbackId,
        amountInRs: Math.max(0, Math.round(availableCash / 100)),
        notes: riderName
          ? `Cash handover from ${riderName}`
          : rider
            ? `Cash handover from ${rider.name}`
            : '',
      })
      setIsHandoverModalOpen(true)
    },
    [riders],
  )

  const handlePostCashHandover = async (event: React.FormEvent) => {
    event.preventDefault()
    const amountInRs = Number(handoverForm.amountInRs)
    if (!handoverForm.riderId) {
      toast.error('Please select the rider handing over cash')
      return
    }
    if (!Number.isFinite(amountInRs) || amountInRs <= 0) {
      toast.error('Enter a valid handover amount')
      return
    }

    const rider = riders.find((item) => item.id === handoverForm.riderId)
    if (rider && amountInRs * 100 > rider.cashOnHand) {
      toast.error(
        `Handover exceeds cash on hand (${formatNPR(rider.cashOnHand)}).`,
      )
      return
    }

    try {
      setIsSubmitting(true)
      const result = await recordManagerCashHandoverFn({
        data: {
          riderId: handoverForm.riderId,
          amountInRs,
          notes: handoverForm.notes.trim() || undefined,
        },
      })
      toast.success(
        `Cash handover ${result.voucherNo} posted for ${formatNPR(
          Math.round(amountInRs * 100),
        )}.`,
      )
      setIsHandoverModalOpen(false)
      await invalidateLedger()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to record cash handover',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenDealerPayout = useCallback(
    (dealerId: string) => {
      const summary = dealerPayables.find(
        (dealer) => dealer.dealerId === dealerId,
      )
      if (!summary) {
        toast.error('Dealer payable summary not found')
        return
      }
      setDealerPayoutForm({
        dealerId: summary.dealerId,
        dealerName: summary.dealerName,
        amountInRs: Math.max(0, Math.round(summary.outstandingPayable / 100)),
        tdsRate: summary.tdsRate,
        paymentMethod: 'bank_transfer',
        paymentReference: '',
        memo: `Procurement settlement payout to ${summary.dealerName}`,
      })
      setIsDealerPayoutOpen(true)
    },
    [dealerPayables],
  )

  const handlePostDealerPayout = async (event: React.FormEvent) => {
    event.preventDefault()
    const amountInRs = Number(dealerPayoutForm.amountInRs)
    const tdsRate = Number(dealerPayoutForm.tdsRate)
    if (!dealerPayoutForm.dealerId) {
      toast.error('Select a dealer before posting a payout')
      return
    }
    if (!Number.isFinite(amountInRs) || amountInRs <= 0) {
      toast.error('Enter a valid disbursement amount')
      return
    }
    if (!Number.isFinite(tdsRate) || tdsRate < 0 || tdsRate > 100) {
      toast.error('TDS rate must be between 0 and 100')
      return
    }

    try {
      setIsSubmitting(true)
      const result = await recordDealerDisbursementFn({
        data: {
          dealerId: dealerPayoutForm.dealerId,
          amountInRs,
          paymentAccount:
            dealerPayoutForm.paymentMethod === 'cash' ? 'cash' : 'bank',
          paymentMethod: dealerPayoutForm.paymentMethod,
          paymentReference:
            dealerPayoutForm.paymentReference.trim() || undefined,
          tdsRate,
          memo: dealerPayoutForm.memo.trim() || undefined,
          proofUrls: [],
        },
      })
      toast.success(
        `Dealer payout ${result.voucherNo} posted. Net ${formatNPR(
          result.netAmount,
        )}.`,
      )
      setIsDealerPayoutOpen(false)
      await invalidateLedger()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to post dealer payout',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenBatchSettlement = useCallback((dealerId?: string) => {
    setBatchDealerId(dealerId ?? '')
    setHasOpenedBatchSettlement(true)
    setIsBatchDealerSettlementOpen(true)
  }, [])

  const handleOpenSettlementApproval = useCallback((settlement: Settlement) => {
    setSelectedRiderSettlement(settlement)
    setHasOpenedApprovalModal(true)
    setIsRiderApprovalModalOpen(true)
  }, [])

  const handleOpenRiderPayrollRun = useCallback(() => {
    setHasOpenedPayrollRun(true)
    setIsRiderPayrollRunOpen(true)
  }, [])

  const handlePostManualVoucher = async (event: React.FormEvent) => {
    event.preventDefault()
    const amountInPaisa = Math.round(Number(manualVoucherForm.amountInRs) * 100)
    if (!manualVoucherForm.debitAccountId) {
      toast.error('Select a debit account')
      return
    }
    if (!manualVoucherForm.creditAccountId) {
      toast.error('Select a credit account')
      return
    }
    if (
      manualVoucherForm.debitAccountId === manualVoucherForm.creditAccountId
    ) {
      toast.error('Debit and credit accounts must be different')
      return
    }
    if (!Number.isFinite(amountInPaisa) || amountInPaisa <= 0) {
      toast.error('Enter a valid voucher amount')
      return
    }
    if (manualVoucherForm.narration.trim().length < 3) {
      toast.error('Narration must be at least 3 characters')
      return
    }

    try {
      setIsSubmitting(true)
      const result = await postManualJournalVoucherFn({
        data: {
          voucherType: manualVoucherForm.voucherType,
          postingDate: manualVoucherForm.postingDate || undefined,
          narration: manualVoucherForm.narration.trim(),
          lines: [
            {
              accountId: manualVoucherForm.debitAccountId,
              debit: amountInPaisa,
              credit: 0,
            },
            {
              accountId: manualVoucherForm.creditAccountId,
              debit: 0,
              credit: amountInPaisa,
            },
          ],
        },
      })
      toast.success(`Voucher ${result.voucherNo} posted successfully.`)
      setIsAddVoucherOpen(false)
      setManualVoucherForm((previous) => ({
        ...previous,
        narration: '',
        amountInRs: 1000,
        postingDate: new Date().toISOString().slice(0, 10),
      }))
      await invalidateLedger()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to post voucher',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedHandoverRider = riders.find(
    (rider) => rider.id === handoverForm.riderId,
  )
  const dealerNetPreview = formatNPR(
    Math.round(
      Number(dealerPayoutForm.amountInRs || 0) *
        100 *
        (1 - Number(dealerPayoutForm.tdsRate || 0) / 100),
    ),
  )

  const tabItems: Array<{
    value: AccountsTab
    label: string
    icon: LucideIcon
    count?: number
  }> = [
    { value: 'overview', label: 'Overview', icon: Wallet },
    {
      value: 'chart-of-accounts',
      label: 'Chart of Accounts',
      icon: FolderTree,
      count: chartOfAccounts.length,
    },
    {
      value: 'branches',
      label: 'Branches',
      icon: Building2,
    },
    {
      value: 'ledger',
      label: 'General Ledger',
      icon: Receipt,
      count: ops.generalLedger.length,
    },
    {
      value: 'vouchers',
      label: 'Vouchers',
      icon: CreditCard,
    },
    {
      value: 'party-accounts',
      label: 'Party Accounts',
      icon: Users,
    },
    {
      value: 'dealer-ledger',
      label: 'Dealer Ledger',
      icon: Store,
      count: dealerPayables.length,
    },
    {
      value: 'rider-ledger',
      label: 'Rider Ledger',
      icon: Bike,
      count: ops.riderAccounts.length,
    },
    {
      value: 'customer-ledger',
      label: 'Customer Ledger',
      icon: Users,
    },
    {
      value: 'supplier-ledger',
      label: 'Supplier Ledger',
      icon: Building2,
    },
    {
      value: 'employee-ledger',
      label: 'Employee Ledger',
      icon: UserCheck,
    },
    {
      value: 'bank-cash',
      label: 'Bank & Cash',
      icon: Landmark,
    },
    {
      value: 'expenses',
      label: 'Expenses',
      icon: Tag,
    },
    {
      value: 'reconciliation',
      label: 'Reconciliation',
      icon: Scale,
    },
    {
      value: 'financial-reports',
      label: 'Financial Reports',
      icon: FileSpreadsheet,
    },
    {
      value: 'export-center',
      label: 'Export Center',
      icon: Download,
    },
    {
      value: 'period-close',
      label: 'Period Close',
      icon: Calendar,
    },
    {
      value: 'audit-trail',
      label: 'Audit Trail',
      icon: ShieldCheck,
    },
    {
      value: 'settings',
      label: 'Accounting Settings',
      icon: SlidersHorizontal,
    },
    {
      value: 'sales-account',
      label: 'Sales Account',
      icon: TrendingUp,
      count: ops.orders.length,
    },
    {
      value: 'salary-account',
      label: 'Salary Account',
      icon: Coins,
      count: ops.settlements.length,
    },
  ]

  const visibleTabItems = useMemo(() => {
    return tabItems.filter((item) => {
      const moduleKey = TAB_MODULE_MAP[item.value]
      return !moduleKey || can(grants, moduleKey, 'view')
    })
  }, [grants, tabItems])

  useEffect(() => {
    if (visibleTabItems.length > 0 && !visibleTabItems.some((t) => t.value === activeTab)) {
      setActiveTab(visibleTabItems[0].value)
    }
  }, [visibleTabItems, activeTab, setActiveTab])

  return (
    <div className="space-y-3.5">
      <PageHeader
        kicker="Finance & Accounts"
        title="Accounts & Financial Ledger"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DataRefreshButton
              queryKeys={[adminQueries.ledger().queryKey]}
              onRefresh={() => refetch()}
              isRefreshing={isFetching}
              variant="button"
            />
            {can(grants, 'accounts_financial_reports', 'view') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('financial-reports')}
                className="h-8 gap-1.5 text-xs"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Reports
              </Button>
            )}
            {can(grants, 'accounts_vouchers', 'create') && (
              <Button
                size="sm"
                onClick={() => setIsAddVoucherOpen(true)}
                className="h-8 gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Post voucher
              </Button>
            )}
          </div>
        }
      />

      <DataSection isRefreshing={isFetching}>
        {visibleTabItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-xs">
            <ShieldCheck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground">
              Permission Required
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Your account does not have permission to view any accounting ledgers or sub-menus. Please contact an administrator to adjust your permissions in the Staff Matrix.
            </p>
          </div>
        ) : (
          <>
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(normalizeAccountsTab(value))}
            >
              <div className="border-b border-border">
                <TabsList className="click-scroll flex h-9 w-full items-center justify-start gap-0.5 overflow-x-auto border-none bg-transparent p-0">
                  {visibleTabItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <TabsTrigger
                        key={item.value}
                        value={item.value}
                        className={TAB_TRIGGER_CLASS}
                        onPointerEnter={() => {
                          const prefetch = TAB_PREFETCH[item.value]
                          if (prefetch) {
                            void prefetch.importTab()
                            prefetch.prefetchQueries(queryClient)
                          }
                        }}
                        onFocus={() => {
                          const prefetch = TAB_PREFETCH[item.value]
                          if (prefetch) {
                            void prefetch.importTab()
                            prefetch.prefetchQueries(queryClient)
                          }
                        }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{item.label}</span>
                        {item.count !== undefined && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                            {item.count}
                          </span>
                        )}
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </div>
            </Tabs>

            <div className="pt-4">
              <AsyncBoundary
                key={activeTab}
                fallback={
                  <TabSkeleton variant={getTabSkeletonVariant(activeTab)} />
                }
              >
                {activeTab === 'overview' && (
                <AccountsOverview
                  onPostVoucher={() => setIsAddVoucherOpen(true)}
                  onCashHandover={() => handleOpenCashHandover()}
                  onDealerSettlement={() => handleOpenBatchSettlement()}
                  onRiderPayroll={handleOpenRiderPayrollRun}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'ledger' && <GeneralLedgerTab />}

              {activeTab === 'transactions' && <TransactionsTab />}

              {activeTab === 'vouchers' && <VouchersTab />}

              {activeTab === 'party-accounts' && <PartyAccountsTab />}

              {activeTab === 'customer-ledger' && (
                <PartyAccountsTab initialPartyType="customer" />
              )}

              {activeTab === 'supplier-ledger' && (
                <PartyAccountsTab initialPartyType="supplier" />
              )}

              {activeTab === 'employee-ledger' && (
                <PartyAccountsTab initialPartyType="employee" />
              )}

              {activeTab === 'bank-cash' && <BankCashTab />}

              {activeTab === 'expenses' && <ExpensesTab />}

              {activeTab === 'reconciliation' && <ReconciliationTab />}

              {activeTab === 'export-center' && <ExportCenterTab />}

              {activeTab === 'period-close' && <PeriodCloseTab />}

              {activeTab === 'audit-trail' && <AuditTrailTab />}

              {activeTab === 'settings' && <AccountingSettingsTab />}

              {activeTab === 'dealer-ledger' && (
                <DealerReportTab
                  onPayoutDealer={handleOpenDealerPayout}
                  onSettleDealer={handleOpenBatchSettlement}
                />
              )}

              {activeTab === 'rider-ledger' && (
                <div className="space-y-5">
                  <RiderReportTab onRecordCashHandover={handleOpenCashHandover} />
                  <RiderSettlementRequests requests={riderCashHandovers} />
                </div>
              )}

              {activeTab === 'sales-account' && <SalesAccountTab />}

              {activeTab === 'salary-account' && (
                <SalaryAccountTab
                  onRunPayroll={handleOpenRiderPayrollRun}
                  onApproveSettlement={handleOpenSettlementApproval}
                />
              )}

              {activeTab === 'chart-of-accounts' && <ChartOfAccountsTab />}

              {activeTab === 'branches' && <BranchesTab />}

              {activeTab === 'financial-reports' && (
                <FinancialReportsTab
                  chartOfAccounts={chartOfAccounts}
                  onDrillDown={(accountId) => {
                    navigate({
                      to: '/admin/accounts',
                      search: (previous) => ({
                        ...previous,
                        tab: 'ledger',
                        account: accountId,
                        partyType: undefined,
                        partyId: undefined,
                      }),
                    })
                  }}
                  settings={ops.settings}
                  fiscalYearName={ops.fiscalYears[0]?.name}
                />
              )}

              {activeTab === 'account-defaults' && <AccountDefaultsTab />}
              </AsyncBoundary>
            </div>
          </>
        )}
      </DataSection>

      <Dialog open={isAddVoucherOpen} onOpenChange={setIsAddVoucherOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Receipt className="h-4 w-4 text-primary" />
              Post Journal Voucher
            </DialogTitle>
            <DialogDescription className="text-xs">
              Create a balanced manual double-entry voucher. Debits must equal
              credits.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePostManualVoucher} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Voucher Type</Label>
                <NativeSelect
                  value={manualVoucherForm.voucherType}
                  onChange={(event) =>
                    setManualVoucherForm({
                      ...manualVoucherForm,
                      voucherType: event.target.value as ManualVoucherType,
                    })
                  }
                  className="h-8 text-xs"
                >
                  <NativeSelectOption value="JV">
                    Journal Voucher (JV)
                  </NativeSelectOption>
                  <NativeSelectOption value="PV">
                    Payment Voucher (PV)
                  </NativeSelectOption>
                  <NativeSelectOption value="RV">
                    Receipt Voucher (RV)
                  </NativeSelectOption>
                  <NativeSelectOption value="CV">
                    Contra Voucher (CV)
                  </NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Posting Date (AD)</Label>
                <Input
                  type="date"
                  value={manualVoucherForm.postingDate}
                  onChange={(event) =>
                    setManualVoucherForm({
                      ...manualVoucherForm,
                      postingDate: event.target.value,
                    })
                  }
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Amount (NPR)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualVoucherForm.amountInRs}
                  onChange={(event) =>
                    setManualVoucherForm({
                      ...manualVoucherForm,
                      amountInRs: Number(event.target.value),
                    })
                  }
                  className="h-8 text-right text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Debit Account</Label>
                <NativeSelect
                  value={manualVoucherForm.debitAccountId}
                  onChange={(event) =>
                    setManualVoucherForm({
                      ...manualVoucherForm,
                      debitAccountId: event.target.value,
                    })
                  }
                  className="h-8 text-xs"
                >
                  {postableAccounts.map((account) => (
                    <NativeSelectOption key={account.id} value={account.id}>
                      {account.code} — {account.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Credit Account</Label>
                <NativeSelect
                  value={manualVoucherForm.creditAccountId}
                  onChange={(event) =>
                    setManualVoucherForm({
                      ...manualVoucherForm,
                      creditAccountId: event.target.value,
                    })
                  }
                  className="h-8 text-xs"
                >
                  {postableAccounts.map((account) => (
                    <NativeSelectOption key={account.id} value={account.id}>
                      {account.code} — {account.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Narration</Label>
              <Input
                value={manualVoucherForm.narration}
                onChange={(event) =>
                  setManualVoucherForm({
                    ...manualVoucherForm,
                    narration: event.target.value,
                  })
                }
                placeholder="e.g. Owner capital injection / office rent adjustment"
                className="h-8 text-xs"
                minLength={3}
                required
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono">
              <span className="text-muted-foreground">
                Dr {manualVoucherForm.debitAccountId || '—'} · Cr{' '}
                {manualVoucherForm.creditAccountId || '—'}
              </span>
              <span className="font-semibold text-foreground">
                {formatNPR(
                  Math.round(Number(manualVoucherForm.amountInRs || 0) * 100),
                )}
              </span>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddVoucherOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Posting…' : 'Post Voucher'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isHandoverModalOpen} onOpenChange={setIsHandoverModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Banknote className="h-4 w-4 text-amber-500" />
              Record Rider Cash Handover
            </DialogTitle>
            <DialogDescription className="text-xs">
              Receive COD cash at the counter. This reduces the rider's cash on
              hand and posts a receipt voucher.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePostCashHandover} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Rider</Label>
              <NativeSelect
                value={handoverForm.riderId}
                onChange={(event) => {
                  const riderId = event.target.value
                  const rider = riders.find((item) => item.id === riderId)
                  setHandoverForm((previous) => ({
                    ...previous,
                    riderId,
                    amountInRs: rider
                      ? Math.max(0, Math.round(rider.cashOnHand / 100))
                      : previous.amountInRs,
                    notes: rider
                      ? `Cash handover from ${rider.name}`
                      : previous.notes,
                  }))
                }}
                className="h-8 text-xs"
              >
                <NativeSelectOption value="">Select rider…</NativeSelectOption>
                {riders.map((rider) => (
                  <NativeSelectOption key={rider.id} value={rider.id}>
                    {rider.name} — {formatNPR(rider.cashOnHand)} cash
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Amount (NPR)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={handoverForm.amountInRs}
                  onChange={(event) =>
                    setHandoverForm({
                      ...handoverForm,
                      amountInRs: Number(event.target.value),
                    })
                  }
                  className="h-8 text-right text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rider cash on hand</Label>
                <div className="flex h-8 items-center justify-end rounded-md border border-border bg-muted/30 px-2 text-xs font-mono">
                  {formatNPR(selectedHandoverRider?.cashOnHand ?? 0)}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input
                value={handoverForm.notes}
                onChange={(event) =>
                  setHandoverForm({
                    ...handoverForm,
                    notes: event.target.value,
                  })
                }
                placeholder="Optional handover note"
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsHandoverModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Posting…' : 'Post Handover'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDealerPayoutOpen} onOpenChange={setIsDealerPayoutOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Store className="h-4 w-4 text-primary" />
              Dealer Direct Payout
            </DialogTitle>
            <DialogDescription className="text-xs">
              Disburse a lump-sum payment against the dealer payable. The ledger
              posts a payment voucher with TDS withholding.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePostDealerPayout} className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Dealer</span>
                <span className="font-semibold text-foreground">
                  {dealerPayoutForm.dealerName || '—'}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">
                  Outstanding payable
                </span>
                <span className="font-mono text-foreground">
                  {formatNPR(
                    dealerPayables.find(
                      (dealer) => dealer.dealerId === dealerPayoutForm.dealerId,
                    )?.outstandingPayable ?? 0,
                  )}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Gross Amount (NPR)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dealerPayoutForm.amountInRs}
                  onChange={(event) =>
                    setDealerPayoutForm({
                      ...dealerPayoutForm,
                      amountInRs: Number(event.target.value),
                    })
                  }
                  className="h-8 text-right text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">TDS Rate (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={dealerPayoutForm.tdsRate}
                  onChange={(event) =>
                    setDealerPayoutForm({
                      ...dealerPayoutForm,
                      tdsRate: Number(event.target.value),
                    })
                  }
                  className="h-8 text-right text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Method</Label>
                <NativeSelect
                  value={dealerPayoutForm.paymentMethod}
                  onChange={(event) =>
                    setDealerPayoutForm({
                      ...dealerPayoutForm,
                      paymentMethod: event.target.value as DealerPaymentMethod,
                    })
                  }
                  className="h-8 text-xs"
                >
                  {DEALER_PAYMENT_METHODS.map((method) => (
                    <NativeSelectOption key={method.value} value={method.value}>
                      {method.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ledger Account</Label>
                <div className="flex h-8 items-center rounded-md border border-border bg-muted/30 px-2 text-xs">
                  {dealerPayoutForm.paymentMethod === 'cash'
                    ? 'Cash in Hand (acc_1011)'
                    : 'Bank Account (acc_1012)'}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Payment Reference</Label>
              <Input
                value={dealerPayoutForm.paymentReference}
                onChange={(event) =>
                  setDealerPayoutForm({
                    ...dealerPayoutForm,
                    paymentReference: event.target.value,
                  })
                }
                placeholder="Bank UTR, cheque no. or wallet transaction ID"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Memo</Label>
              <Input
                value={dealerPayoutForm.memo}
                onChange={(event) =>
                  setDealerPayoutForm({
                    ...dealerPayoutForm,
                    memo: event.target.value,
                  })
                }
                className="h-8 text-xs"
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                Net disbursement after TDS
              </span>
              <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {dealerNetPreview}
              </span>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDealerPayoutOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Posting…' : 'Disburse Payout'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {hasOpenedBatchSettlement && (
        <React.Suspense fallback={null}>
          <BatchDealerSettlementDialog
            open={isBatchDealerSettlementOpen}
            onOpenChange={setIsBatchDealerSettlementOpen}
            dealers={batchDealers}
            initialDealerId={batchDealerId || undefined}
            onSettled={() => {
              void invalidateLedger()
            }}
          />
        </React.Suspense>
      )}

      {hasOpenedPayrollRun && (
        <React.Suspense fallback={null}>
          <RiderPayrollRunDialog
            open={isRiderPayrollRunOpen}
            onOpenChange={setIsRiderPayrollRunOpen}
            riders={payrollRiders}
            onSuccess={() => {
              void invalidateLedger()
            }}
          />
        </React.Suspense>
      )}

      {hasOpenedApprovalModal && (
        <React.Suspense fallback={null}>
          <RiderSettlementApprovalDialog
            open={isRiderApprovalModalOpen}
            onOpenChange={(open) => {
              setIsRiderApprovalModalOpen(open)
              if (!open) setSelectedRiderSettlement(null)
            }}
            settlement={selectedRiderSettlement}
            onSuccess={(voucherNo) => {
              toast.success(`Settlement voucher ${voucherNo} posted.`)
              setSelectedRiderSettlement(null)
              void invalidateLedger()
            }}
          />
        </React.Suspense>
      )}
    </div>
  )
}
