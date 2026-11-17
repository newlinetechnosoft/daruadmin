import { useState } from 'react'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  executePeriodClosingVoucherFn,
  generateFiscalYearPeriodsFn,
  togglePeriodLockFn,
} from '#/server/finance/periods.functions'
import { updateVoucherSequencePrefixFn } from '#/server/finance/settings.functions'
import { toast } from 'sonner'
import {
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  CreditCard,
  Edit2,
  FileText,
  Hash,
  Lock,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Unlock,
} from 'lucide-react'
import { AccountDefaultsTab } from '../account-defaults-tab'

export function AccountingSettingsTab() {
  const queryClient = useQueryClient()
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    'defaults' | 'periods' | 'sequences' | 'rules' | 'nepal-compliance' | 'currency' | 'protection'
  >('defaults')

  // Queries
  const { data: ledgerData } = useSuspenseQuery(adminQueries.ledger())
  const fiscalYears = ledgerData.ops.fiscalYears
  const currentFy = fiscalYears[0]

  const { data: periods = [], refetch: refetchPeriods } = useSuspenseQuery(
    adminQueries.accountingPeriods({ fiscalYear: currentFy?.id }),
  )

  const { data: config, refetch: refetchConfig } = useSuspenseQuery(
    adminQueries.accountingConfig(),
  )

  // Modals state
  const [isClosingDialogOpen, setIsClosingDialogOpen] = useState(false)
  const [closingNarration, setClosingNarration] = useState(
    `Fiscal Year End Closing - ${currentFy?.name || '2083/84'}`,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Voucher prefix edit modal
  const [editingSequence, setEditingSequence] = useState<{
    voucherType: string
    currentPrefix: string
  } | null>(null)
  const [newPrefix, setNewPrefix] = useState('')

  const updatePrefixMutation = useMutation({
    mutationFn: async (data: { fiscalYearId: string; voucherType: string; prefix: string }) => {
      return updateVoucherSequencePrefixFn({ data })
    },
    onSuccess: (res) => {
      toast.success(`Prefix for ${editingSequence?.voucherType} updated to ${res.prefix}`)
      setEditingSequence(null)
      refetchConfig()
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update voucher prefix')
    },
  })

  const handleToggleLock = async (periodId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'open' ? 'closed' : 'open'
    try {
      setIsSubmitting(true)
      await togglePeriodLockFn({
        data: { periodId, status: nextStatus },
      })
      toast.success(
        `Period ${nextStatus === 'closed' ? 'locked' : 'unlocked'} successfully`,
      )
      await refetchPeriods()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to toggle period lock')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGeneratePeriods = async () => {
    if (!currentFy) {
      toast.error('No active fiscal year found')
      return
    }
    try {
      setIsSubmitting(true)
      const res = await generateFiscalYearPeriodsFn({
        data: { fiscalYearId: currentFy.id },
      })
      toast.success(`Generated ${res.count} BS monthly periods`)
      await refetchPeriods()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate periods')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExecuteYearEndClose = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentFy) return

    try {
      setIsSubmitting(true)
      const res = await executePeriodClosingVoucherFn({
        data: {
          fiscalYearId: currentFy.id,
          narration: closingNarration.trim(),
        },
      })
      toast.success(`Year-end closing voucher ${res.voucherNo} posted!`)
      setIsClosingDialogOpen(false)
      await Promise.all([
        refetchPeriods(),
        queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] }),
      ])
    } catch (err: any) {
      toast.error(err?.message || 'Failed to execute period closing')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            Dynamic Accounting & Financial Configuration
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure system control accounts, fiscal period locks, voucher numbering prefixes, maker-checker posting policies, and currency precision.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono text-primary font-bold">
            FY {config.activeFiscalYear?.name || currentFy?.name || '2083/84'}
          </Badge>
          <Badge variant="secondary" className="text-xs font-mono">
            NPR (Paisa Precision)
          </Badge>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <Tabs
        value={activeSettingsTab}
        onValueChange={(val) => setActiveSettingsTab(val as any)}
        className="w-full"
      >
        <TabsList className="h-9 flex flex-wrap max-w-full overflow-x-auto border-b border-border bg-transparent p-0 justify-start">
          <TabsTrigger value="defaults" className="flex items-center gap-1.5 text-xs">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Default Accounts Mapping
          </TabsTrigger>

          <TabsTrigger value="periods" className="flex items-center gap-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5 text-blue-600" />
            Fiscal Periods & Year-End Close
          </TabsTrigger>

          <TabsTrigger value="sequences" className="flex items-center gap-1.5 text-xs">
            <Hash className="h-3.5 w-3.5 text-purple-600" />
            Voucher Numbering
          </TabsTrigger>

          <TabsTrigger value="rules" className="flex items-center gap-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Posting Rules & Maker-Checker
          </TabsTrigger>

          <TabsTrigger value="nepal-compliance" className="flex items-center gap-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5 text-teal-600" />
            Nepal Tax & Statutory Rules
          </TabsTrigger>

          <TabsTrigger value="currency" className="flex items-center gap-1.5 text-xs">
            <Coins className="h-3.5 w-3.5 text-amber-600" />
            Currency & Precision
          </TabsTrigger>

          <TabsTrigger value="protection" className="flex items-center gap-1.5 text-xs">
            <Lock className="h-3.5 w-3.5 text-rose-600" />
            Account Freezing & Protection
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ==================================================================== */}
      {/* 1. DEFAULT ACCOUNTS MAPPING                                          */}
      {/* ==================================================================== */}
      {activeSettingsTab === 'defaults' && (
        <div className="space-y-4">
          <AccountDefaultsTab />
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. FISCAL PERIODS & BS MONTHLY LOCKS                                 */}
      {/* ==================================================================== */}
      {activeSettingsTab === 'periods' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Nepal BS Monthly Accounting Periods ({config.activeFiscalYear?.name || '2083/84'})
              </h3>
              <p className="text-xs text-muted-foreground">
                Lock historical BS months to prohibit retro-dated vouchers or balance modifications following official IRD monthly tax filing.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {periods.length === 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGeneratePeriods}
                  disabled={isSubmitting}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Generate 12 BS Periods
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsClosingDialogOpen(true)}
                className="h-8 gap-1.5 text-xs text-purple-600 hover:text-purple-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Execute Year-End Close
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/40 text-[11px]">
                  <TableHead className="w-20 font-bold">Period</TableHead>
                  <TableHead className="w-36 font-bold">Month (BS)</TableHead>
                  <TableHead className="w-32 font-bold">Start Date (AD)</TableHead>
                  <TableHead className="w-32 font-bold">End Date (AD)</TableHead>
                  <TableHead className="w-28 text-center font-bold">Status</TableHead>
                  <TableHead className="w-36 text-right font-bold">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      No monthly periods initialized yet. Click &quot;Generate 12 BS Periods&quot; to initialize Shrawan through Ashadh.
                    </TableCell>
                  </TableRow>
                ) : (
                  periods.map((p) => (
                    <TableRow key={p.id} className="border-border text-xs hover:bg-muted/30">
                      <TableCell className="font-mono text-muted-foreground">
                        #{p.periodNo}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {p.name}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {p.startDate.slice(0, 10)}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {p.endDate.slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] gap-1 ${
                            p.status === 'open'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                              : 'border-amber-500/30 bg-amber-500/10 text-amber-600'
                          }`}
                        >
                          {p.status === 'open' ? (
                            <>
                              <Unlock className="h-3 w-3" /> Open
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3" /> Locked
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isSubmitting}
                          onClick={() => handleToggleLock(p.id, p.status)}
                          className="h-6 px-2 text-[11px]"
                        >
                          {p.status === 'open' ? 'Lock Period' : 'Unlock Period'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. VOUCHER NUMBERING & SEQUENCING                                    */}
      {/* ==================================================================== */}
      {activeSettingsTab === 'sequences' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Hash className="h-4 w-4 text-purple-600" />
              Voucher Prefix & Gapless Sequencing
            </h3>
            <p className="text-xs text-muted-foreground">
              Voucher sequences are incremented atomically inside database transactions with row-level locks, ensuring duplicate-free, audit-compliant voucher numbers.
            </p>
          </div>

          <div className="rounded-md border border-border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/40 text-[11px]">
                  <TableHead className="w-24 font-bold">Voucher Type</TableHead>
                  <TableHead className="font-bold">Description</TableHead>
                  <TableHead className="w-32 font-bold">Prefix</TableHead>
                  <TableHead className="w-32 text-right font-bold">Last Generated No</TableHead>
                  <TableHead className="w-36 text-right font-bold">Sample Voucher</TableHead>
                  <TableHead className="w-28 text-center font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {config.voucherSequences.map((seq) => {
                  const typeDescriptions: Record<string, string> = {
                    JV: 'Journal Voucher (Standard double-entry adjustment)',
                    PV: 'Payment Voucher (Cash/Bank disbursement & expense)',
                    RV: 'Receipt Voucher (Customer/Party money collection)',
                    CV: 'Contra Voucher (Bank deposits, cash withdrawals, internal transfer)',
                    SV: 'Sales Voucher (Sales revenue recognition)',
                    CN: 'Credit Note (Sales return & customer allowance)',
                    DN: 'Debit Note (Purchase return & vendor debit)',
                    OB: 'Opening Balance Voucher (Initial ledger setup)',
                    PC: 'Period Closing Voucher (Year-end profit transfer to Retained Earnings)',
                  }

                  const sampleNo = `${seq.prefix}-${String(seq.lastNo + 1).padStart(5, '0')}`

                  return (
                    <TableRow key={seq.voucherType} className="border-border text-xs hover:bg-muted/30">
                      <TableCell className="font-mono font-bold text-primary">
                        {seq.voucherType}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {typeDescriptions[seq.voucherType] || 'Voucher Sequence'}
                      </TableCell>
                      <TableCell className="font-mono font-semibold">
                        <Badge variant="outline" className="font-mono text-xs">
                          {seq.prefix}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        #{seq.lastNo}
                      </TableCell>
                      <TableCell className="text-right font-mono text-primary font-medium">
                        {sampleNo}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingSequence({
                              voucherType: seq.voucherType,
                              currentPrefix: seq.prefix,
                            })
                            setNewPrefix(seq.prefix)
                          }}
                          className="h-6 px-2 text-[11px] gap-1"
                        >
                          <Edit2 className="h-3 w-3" />
                          Prefix
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. POSTING RULES & MAKER-CHECKER POLICIES                            */}
      {/* ==================================================================== */}
      {activeSettingsTab === 'rules' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Financial Posting Policies & Internal Controls
            </h3>
            <p className="text-xs text-muted-foreground">
              Configure accounting integrity constraints, maker-checker authorization limits, and automated event triggers.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wide text-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Double-Entry Posting Mandates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Debit-Credit Balance Requirement:</span>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 font-mono">
                    Strictly Balanced (0.00 Variance)
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Voucher Immutability:</span>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 font-mono">
                    Immutable (Audit Reversal Only)
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Maker-Checker Approval Threshold:</span>
                  <span className="font-mono font-bold text-foreground">
                    Rs. {config.postingPolicies.makerCheckerThresholdRupees.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Multi-Branch Line Tagging:</span>
                  <Badge variant="outline" className="text-primary font-mono">
                    Mandatory on All Lines
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wide text-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  Automatic Business Lifecycle Postings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Sales Order Confirmation:</span>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 font-mono">
                    Auto-posts SV (Dr Receivable / Cr Sales)
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Dealer Sourcing & Procurement:</span>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 font-mono">
                    Auto-posts JV (Dr COGS / Cr Dealer Payable)
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Rider COD Delivery Completion:</span>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 font-mono">
                    Auto-posts RV (Dr Rider Cash / Cr Customer)
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Online Payment Gateway Capture:</span>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 font-mono">
                    Auto-posts RV (Dr Gateway / Cr Customer)
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. NEPAL BUSINESS & TAX COMPLIANCE                                   */}
      {/* ==================================================================== */}
      {activeSettingsTab === 'nepal-compliance' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-teal-600" />
              Nepal Statutory Tax & Business Compliance
            </h3>
            <p className="text-xs text-muted-foreground">
              Official entity tax registration, statutory VAT 13% schedule, Income Tax Act 2058 TDS withholding rates, and local payment clearing rules.
            </p>
          </div>

          {/* Registration & IRD Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 border-border shadow-xs space-y-1.5">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                PAN / VAT Number
              </span>
              <div className="text-xl font-bold font-mono text-primary flex items-center gap-2">
                {config.nepalCompliance?.pan || '601234567'}
                <Badge className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 text-[10px]">
                  VAT Active
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {config.nepalCompliance?.legalName || 'Daru Gang Pvt Ltd'} ({config.nepalCompliance?.tradeName || 'Mezmani'})
              </p>
            </Card>

            <Card className="p-4 border-border shadow-xs space-y-1.5">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                Inland Revenue Tax Office
              </span>
              <div className="text-sm font-bold text-foreground">
                {config.nepalCompliance?.taxOffice || 'Inland Revenue Office (IRO), Butwal'}
              </div>
              <p className="text-xs text-muted-foreground">
                Filing Jurisdiction: Government of Nepal (IRD)
              </p>
            </Card>

            <Card className="p-4 border-border shadow-xs space-y-1.5">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                VAT Schedule & Deadline
              </span>
              <div className="text-sm font-bold text-foreground">
                {config.nepalCompliance?.vatRules?.standardRatePercent || 13}% Standard VAT
              </div>
              <p className="text-xs text-muted-foreground">
                {config.nepalCompliance?.vatRules?.filingDeadline || 'Monthly by 25th BS'}
              </p>
            </Card>
          </div>

          {/* Nepal TDS Schedules Table */}
          <Card className="border-border shadow-xs">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Nepal Withholding Tax (TDS) Statutory Schedules (Income Tax Act, 2058)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category / Purpose</TableHead>
                    <TableHead>Statutory Provision</TableHead>
                    <TableHead>Applicable Scope</TableHead>
                    <TableHead className="w-24 text-center">TDS Rate</TableHead>
                    <TableHead className="w-32 text-right">Effective From (BS)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(config.nepalCompliance?.tdsSchedules || []).map((tds, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-xs text-foreground">
                        {tds.category}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {tds.statutorySection}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs">
                        {tds.applicableTo}
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs text-primary">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {tds.ratePercent}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-muted-foreground">
                        {tds.effectiveFromBS}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Gateway & COD Reconciliation Policy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 border-border shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-600" />
                Payment Gateway Clearing Policy
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Clearing Account:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {config.nepalCompliance?.paymentGatewayClearing?.accountCode || '1013'} — {config.nepalCompliance?.paymentGatewayClearing?.accountName || 'Payment Gateway Clearing'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Supported Providers:</span>
                  <div className="flex gap-1">
                    {(config.nepalCompliance?.paymentGatewayClearing?.supportedGateways || ['eSewa', 'Khalti', 'Fonepay', 'ConnectIPS']).map((gw) => (
                      <Badge key={gw} variant="outline" className="text-[10px]">
                        {gw}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Settlement Policy:</span>
                  <span className="text-foreground">
                    {config.nepalCompliance?.paymentGatewayClearing?.settlementPolicy || 'T+1 settlement with MDR commission recognition'}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-4 border-border shadow-xs space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-600" />
                Cash On Delivery (COD) Rider Reconciliation
              </h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Rider Transit COD:</span>
                  <span className="font-mono font-semibold text-foreground">
                    Account {config.nepalCompliance?.codReconciliation?.riderCodAccountCode || '1012'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Vault In-Hand Cash:</span>
                  <span className="font-mono font-semibold text-foreground">
                    Account {config.nepalCompliance?.codReconciliation?.physicalVaultAccountCode || '1011'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Daily Handover Cutoff:</span>
                  <span className="text-foreground">
                    {config.nepalCompliance?.codReconciliation?.handoverCutoff || 'End of Delivery Shift (Daily 22:00 NPT)'}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. CURRENCY & MATHEMATICAL PRECISION                                 */}
      {/* ==================================================================== */}
      {activeSettingsTab === 'currency' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-600" />
              Currency & Fractional Precision Standards
            </h3>
            <p className="text-xs text-muted-foreground">
              To eliminate IEEE 754 floating-point drift, all accounting entries in the database are stored and processed strictly as integer paisa (1 NPR = 100 Paisa).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-4 border-border shadow-sm space-y-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                Base Currency Code
              </span>
              <div className="text-2xl font-bold font-mono text-primary">
                {config.currency.code}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Official Currency: Nepalese Rupee (NPR)
              </p>
            </Card>

            <Card className="p-4 border-border shadow-sm space-y-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                Fractional Unit
              </span>
              <div className="text-2xl font-bold font-mono text-foreground">
                {config.currency.subUnit}
              </div>
              <p className="text-[11px] text-muted-foreground">
                1 Rupee = 100 Paisa (Integer Paisa Storage)
              </p>
            </Card>

            <Card className="p-4 border-border shadow-sm space-y-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                Display Format & Symbol
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-600">
                {config.currency.symbol}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Nepali Lakhs/Crores notation (e.g. Rs. 1,00,000.00)
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. ACCOUNT FREEZING & PROTECTION AUDIT                               */}
      {/* ==================================================================== */}
      {activeSettingsTab === 'protection' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Lock className="h-4 w-4 text-rose-600" />
              Account Protection & Ledger Freezing Safeguards
            </h3>
            <p className="text-xs text-muted-foreground">
              Auditing account protection rules preventing accidental deletion, unauthorized renaming, or retro-dated mutations of active accounts.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-4 border-border shadow-sm">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                Total Chart of Accounts
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-foreground">
                {config.securityAudit.totalAccounts}
              </div>
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Leaf & Group accounts
              </span>
            </Card>

            <Card className="p-4 border-border shadow-sm">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                Frozen Accounts
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-amber-600">
                {config.securityAudit.frozenAccounts}
              </div>
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Locked against manual modifications
              </span>
            </Card>

            <Card className="p-4 border-border shadow-sm">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                Balance Protection Enforced
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-emerald-600 flex items-center gap-2">
                <ShieldCheck className="h-6 w-6" />
                Active
              </div>
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Deletion blocked if balance &gt; 0 or entries exist
              </span>
            </Card>
          </div>

          <Card className="border-border p-4 bg-muted/20">
            <div className="flex items-start gap-3 text-xs">
              <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-semibold text-foreground">
                  System Control Account Deletion Prevention Rule
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  Accounts configured as defaults (Cash in hand, Bank, Accounts Receivable, Dealer Payable, Rider COD, Sales, COGS, VAT, TDS) are tagged as protected control accounts.
                  Any API or database operation attempting to deactivate or delete these accounts without re-assigning defaults is blocked automatically with an error.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Dialog: Edit Voucher Prefix */}
      <Dialog open={!!editingSequence} onOpenChange={(open) => !open && setEditingSequence(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Hash className="h-4 w-4 text-primary" />
              Edit {editingSequence?.voucherType} Prefix
            </DialogTitle>
            <DialogDescription className="text-xs">
              Change the prefix code prepended to all newly generated {editingSequence?.voucherType} vouchers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">New Voucher Prefix</Label>
              <Input
                value={newPrefix}
                onChange={(e) => setNewPrefix(e.target.value.toUpperCase())}
                placeholder="e.g. JV, PV, RV"
                maxLength={8}
                className="h-8 font-mono text-xs uppercase"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingSequence(null)}
              disabled={updatePrefixMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!currentFy || !editingSequence) return
                updatePrefixMutation.mutate({
                  fiscalYearId: currentFy.id,
                  voucherType: editingSequence.voucherType,
                  prefix: newPrefix.trim(),
                })
              }}
              disabled={updatePrefixMutation.isPending || !newPrefix.trim()}
            >
              {updatePrefixMutation.isPending ? 'Saving…' : 'Save Prefix'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Year-End Closing Dialog */}
      <Dialog open={isClosingDialogOpen} onOpenChange={setIsClosingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <RotateCcw className="h-4 w-4 text-primary" />
              Execute Year-End Fiscal Closing
            </DialogTitle>
            <DialogDescription className="text-xs">
              Transfers net revenue & expense balances into Retained Earnings (Equity) and closes the fiscal period.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleExecuteYearEndClose} className="space-y-3 pt-2">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1.5">
              <div className="font-semibold text-foreground">
                Automated Year-End Closing Actions:
              </div>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground text-[11px]">
                <li>Zeroes out all Income & Expense account balances.</li>
                <li>Calculates Net Profit or Loss for the fiscal year.</li>
                <li>Transfers the net balance to Retained Earnings (Account 3020).</li>
                <li>Generates an immutable Period Closing (PC) voucher.</li>
              </ul>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Voucher Narration</Label>
              <Input
                value={closingNarration}
                onChange={(e) => setClosingNarration(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsClosingDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Closing…' : 'Execute Period Close'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
