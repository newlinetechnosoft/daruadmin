import { useMemo, useState } from 'react'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { MoneyText } from '#/components/shared/money-text'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  addVoucherAttachmentFn,
  approveVoucherFn,
  cancelVoucherFn,
  createDraftVoucherFn,
  submitDraftVoucherFn,
} from '#/server/finance/vouchers.functions'
import {
  postManualJournalVoucherFn,
  reverseJournalVoucherFn,
} from '#/server/finance/finance.functions'
import { formatNPR } from '#/lib/money'
import { toast } from 'sonner'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Paperclip,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  XCircle,
  ExternalLink,
} from 'lucide-react'
import { VOUCHER_TYPE_OPTIONS } from '../accounts-route'
import type { VoucherListItem, VoucherDetailsItem } from '#/server/finance/vouchers.queries'

interface VoucherLineForm {
  id: string
  accountId: string
  debitRs: string
  creditRs: string
  partyType: 'dealer' | 'rider' | 'customer' | 'supplier' | 'employee' | ''
  partyId: string
  costCenter: 'general' | 'liquor' | 'food' | 'delivery'
  branchId: string
  narration: string
}

export function VouchersTab() {
  const queryClient = useQueryClient()
  const { data: ledgerData } = useSuspenseQuery(adminQueries.ledger())
  const chartOfAccounts = ledgerData.ops.chartOfAccounts

  const { data: branches = [] } = useSuspenseQuery(adminQueries.branches())
  const { data: dealersData } = useSuspenseQuery(adminQueries.dealers())
  const { data: ridersData } = useSuspenseQuery(adminQueries.riders())
  const dealers = dealersData?.dealers || []
  const riders = ridersData?.riders || []

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals State
  const [isNewVoucherOpen, setIsNewVoucherOpen] = useState(false)
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null)
  const [reversalTargetVoucher, setReversalTargetVoucher] = useState<VoucherDetailsItem | null>(null)
  const [reversalReason, setReversalReason] = useState('')
  const [reversalDate, setReversalDate] = useState(new Date().toISOString().slice(0, 10))
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Attachment upload form state inside modal
  const [attachName, setAttachName] = useState('')
  const [attachUrl, setAttachUrl] = useState('')
  const [isAttaching, setIsAttaching] = useState(false)

  // Fetch vouchers list
  const { data: vouchers = [], refetch } = useSuspenseQuery(
    adminQueries.vouchersList({
      status: statusFilter === 'all' ? undefined : (statusFilter as any),
      voucherType: typeFilter === 'all' ? undefined : typeFilter,
      branchId: branchFilter === 'all' ? undefined : branchFilter,
      search: searchQuery.trim() || undefined,
    }),
  )

  // Fetch details of selected voucher (if open)
  const {
    data: activeVoucherDetails,
    isLoading: isLoadingDetails,
    refetch: refetchDetails,
  } = useQuery({
    ...adminQueries.voucherDetails(selectedVoucherId || ''),
    enabled: Boolean(selectedVoucherId),
  })

  // Dynamic Voucher Form State
  const [voucherType, setVoucherType] = useState<
    'JV' | 'PV' | 'RV' | 'CV' | 'SV' | 'CN' | 'DN' | 'OB'
  >('JV')
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10))
  const [branchId, setBranchId] = useState('')
  const [refId, setRefId] = useState('')
  const [narration, setNarration] = useState('')
  const [asDraft, setAsDraft] = useState(false)

  const postableAccounts = useMemo(
    () => chartOfAccounts.filter((a) => !a.isGroup && a.isActive),
    [chartOfAccounts],
  )

  const [lines, setLines] = useState<VoucherLineForm[]>([
    {
      id: '1',
      accountId: postableAccounts[0]?.id || '',
      debitRs: '1000',
      creditRs: '0',
      partyType: '',
      partyId: '',
      costCenter: 'general',
      branchId: '',
      narration: '',
    },
    {
      id: '2',
      accountId: postableAccounts[1]?.id || '',
      debitRs: '0',
      creditRs: '1000',
      partyType: '',
      partyId: '',
      costCenter: 'general',
      branchId: '',
      narration: '',
    },
  ])

  // Calculated totals for form
  const totalDebitPaisa = useMemo(
    () =>
      lines.reduce(
        (sum, l) => sum + Math.round(Number(l.debitRs || 0) * 100),
        0,
      ),
    [lines],
  )

  const totalCreditPaisa = useMemo(
    () =>
      lines.reduce(
        (sum, l) => sum + Math.round(Number(l.creditRs || 0) * 100),
        0,
      ),
    [lines],
  )

  const differencePaisa = totalDebitPaisa - totalCreditPaisa
  const isBalanced = totalDebitPaisa > 0 && differencePaisa === 0

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        accountId: postableAccounts[0]?.id || '',
        debitRs: '0',
        creditRs: '0',
        partyType: '',
        partyId: '',
        costCenter: 'general',
        branchId: '',
        narration: '',
      },
    ])
  }

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 2) {
      toast.error('A voucher requires at least two lines')
      return
    }
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  const handleLineChange = (
    id: string,
    field: keyof VoucherLineForm,
    value: string,
  ) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const updated = { ...l, [field]: value }

        // Smart Party Auto-Detection when account changes
        if (field === 'accountId') {
          const acc = postableAccounts.find((a) => a.id === value)
          if (acc) {
            if (acc.code === '2011' || acc.code === '1041') {
              updated.partyType = 'dealer'
            } else if (acc.code === '2031' || acc.code === '1042') {
              updated.partyType = 'rider'
            } else if (acc.code === '1031') {
              updated.partyType = 'customer'
            }
          }
        }
        return updated
      }),
    )
  }

  const handleSaveVoucher = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!narration.trim()) {
      toast.error('Please enter a narration')
      return
    }

    if (!asDraft && !isBalanced) {
      toast.error('Debits and credits must be equal before posting')
      return
    }

    const formattedLines = lines.map((l) => ({
      accountId: l.accountId,
      debit: Math.round(Number(l.debitRs || 0) * 100),
      credit: Math.round(Number(l.creditRs || 0) * 100),
      partyType: (l.partyType || undefined) as any,
      partyId: l.partyId.trim() || undefined,
      costCenter: l.costCenter || 'general',
      branchId: l.branchId || branchId || undefined,
      narration: l.narration.trim() || undefined,
    }))

    try {
      setIsSubmitting(true)
      if (asDraft) {
        await createDraftVoucherFn({
          data: {
            voucherType,
            postingDate,
            branchId: branchId || undefined,
            refId: refId.trim() || undefined,
            narration: narration.trim(),
            lines: formattedLines,
          },
        })
        toast.success(`Draft voucher created successfully`)
      } else {
        const res = await postManualJournalVoucherFn({
          data: {
            voucherType,
            postingDate,
            branchId: branchId || undefined,
            refId: refId.trim() || undefined,
            narration: narration.trim(),
            lines: formattedLines,
          },
        })
        toast.success(`Voucher ${res.voucherNo} posted successfully`)
      }

      setIsNewVoucherOpen(false)
      setNarration('')
      setRefId('')
      await refetch()
      await queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'finance'] })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create voucher')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitDraft = async (voucherId: string) => {
    try {
      setIsSubmitting(true)
      const res = await submitDraftVoucherFn({ data: { journalEntryId: voucherId } })
      toast.success(`Draft voucher submitted with voucher no: ${res.voucherNo}`)
      await refetch()
      if (selectedVoucherId === voucherId) {
        await refetchDetails()
      }
      await queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit voucher')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApprove = async (voucherId: string) => {
    try {
      setIsSubmitting(true)
      await approveVoucherFn({ data: { journalEntryId: voucherId } })
      toast.success('Voucher approved and posted')
      await refetch()
      if (selectedVoucherId === voucherId) {
        await refetchDetails()
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve voucher')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = async (voucherId: string) => {
    const reason = prompt('Please enter cancellation reason:', 'Cancelled by administrator')
    if (reason === null) return
    try {
      setIsSubmitting(true)
      await cancelVoucherFn({
        data: { journalEntryId: voucherId, reason: reason.trim() || 'Cancelled by administrator' },
      })
      toast.success('Voucher cancelled')
      await refetch()
      if (selectedVoucherId === voucherId) {
        await refetchDetails()
      }
      await queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel voucher')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExecuteReversal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reversalTargetVoucher) return
    if (!reversalReason.trim() || reversalReason.trim().length < 5) {
      toast.error('Please enter a detailed reason for reversal (min 5 characters)')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await reverseJournalVoucherFn({
        data: {
          journalEntryId: reversalTargetVoucher.id,
          reason: reversalReason.trim(),
          postingDate: reversalDate || undefined,
        },
      })
      toast.success(`Reversal voucher ${res.voucherNo} posted successfully!`)
      setReversalTargetVoucher(null)
      setReversalReason('')
      await refetch()
      if (selectedVoucherId) {
        await refetchDetails()
      }
      await queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'finance'] })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reverse voucher')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVoucherId) return
    if (!attachName.trim() || !attachUrl.trim()) {
      toast.error('Please provide both attachment title and file URL')
      return
    }

    try {
      setIsAttaching(true)
      await addVoucherAttachmentFn({
        data: {
          journalEntryId: selectedVoucherId,
          name: attachName.trim(),
          url: attachUrl.trim(),
        },
      })
      toast.success('Document attached to voucher')
      setAttachName('')
      setAttachUrl('')
      await refetchDetails()
      await refetch()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to attach document')
    } finally {
      setIsAttaching(false)
    }
  }

  const handlePrintVoucher = (voucher: VoucherDetailsItem) => {
    const printWindow = window.open('', '_blank', 'width=850,height=900')
    if (!printWindow) {
      toast.error('Popup blocked. Please allow popups to print vouchers.')
      return
    }

    const linesHtml = voucher.lines
      .map(
        (l, idx) => `
      <tr>
        <td style="padding: 6px; border: 1px solid #ccc; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px; border: 1px solid #ccc;">
          <strong>${l.accountCode}</strong> - ${l.accountName}
          ${l.narration ? `<div style="font-size: 11px; color: #555;">${l.narration}</div>` : ''}
        </td>
        <td style="padding: 6px; border: 1px solid #ccc;">${l.partyType ? `${l.partyType.toUpperCase()}: ${l.partyId}` : '—'}</td>
        <td style="padding: 6px; border: 1px solid #ccc;">${l.costCenter || 'General'}</td>
        <td style="padding: 6px; border: 1px solid #ccc; text-align: right; font-family: monospace;">${l.debit > 0 ? (l.debit / 100).toFixed(2) : '-'}</td>
        <td style="padding: 6px; border: 1px solid #ccc; text-align: right; font-family: monospace;">${l.credit > 0 ? (l.credit / 100).toFixed(2) : '-'}</td>
      </tr>
    `,
      )
      .join('')

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Voucher - ${voucher.voucherNo || 'Draft'}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 13px; color: #111; margin: 24px; line-height: 1.4; }
            .header { text-align: center; border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 16px; }
            .title { font-size: 18px; font-weight: bold; letter-spacing: 1px; }
            .subtitle { font-size: 13px; color: #444; margin-top: 4px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
            .meta-item { font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
            th { background: #f2f2f2; border: 1px solid #ccc; padding: 6px; text-align: left; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 48px; text-align: center; }
            .sig-line { border-top: 1px solid #333; padding-top: 6px; font-size: 12px; font-weight: bold; }
            @media print { body { margin: 12mm; } button { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">DARU GANG / MEZMANI</div>
            <div class="subtitle">FINANCIAL ACCOUNTING SYSTEM &bull; ${voucher.voucherType} VOUCHER</div>
            <div style="font-size: 11px; color: #666; margin-top: 2px;">Branch: ${voucher.branchName || 'Head Office'}</div>
          </div>

          <div class="meta-grid">
            <div>
              <div class="meta-item"><strong>Voucher No:</strong> ${voucher.voucherNo || '[DRAFT]'}</div>
              <div class="meta-item"><strong>Voucher Type:</strong> ${voucher.voucherType}</div>
              <div class="meta-item"><strong>Posting Status:</strong> ${voucher.postingStatus.toUpperCase()}</div>
            </div>
            <div style="text-align: right;">
              <div class="meta-item"><strong>Date (BS):</strong> ${voucher.bsDate}</div>
              <div class="meta-item"><strong>Date (AD):</strong> ${voucher.postingDate.slice(0, 10)}</div>
              ${voucher.refId ? `<div class="meta-item"><strong>Ref #:</strong> ${voucher.refId}</div>` : ''}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 32px; text-align: center;">#</th>
                <th>Account Code & Title</th>
                <th>Party</th>
                <th>Cost Center</th>
                <th style="text-align: right; width: 100px;">Debit (NPR)</th>
                <th style="text-align: right; width: 100px;">Credit (NPR)</th>
              </tr>
            </thead>
            <tbody>
              ${linesHtml}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold; background: #fafafa;">
                <td colspan="4" style="padding: 6px; border: 1px solid #ccc; text-align: right;">TOTAL:</td>
                <td style="padding: 6px; border: 1px solid #ccc; text-align: right; font-family: monospace;">Rs. ${(voucher.totalDebit / 100).toFixed(2)}</td>
                <td style="padding: 6px; border: 1px solid #ccc; text-align: right; font-family: monospace;">Rs. ${(voucher.totalCredit / 100).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <div style="margin-bottom: 20px; font-size: 12px; background: #fdfdfd; padding: 8px; border: 1px dashed #ccc;">
            <strong>Narration:</strong> ${voucher.narration}
          </div>

          <div class="signatures">
            <div>
              <div style="height: 40px; font-size: 11px; color: #777;">${voucher.createdBy}</div>
              <div class="sig-line">Prepared By (Maker)</div>
            </div>
            <div>
              <div style="height: 40px; font-size: 11px; color: #777;">${voucher.submittedBy || '—'}</div>
              <div class="sig-line">Checked By (Verifier)</div>
            </div>
            <div>
              <div style="height: 40px; font-size: 11px; color: #777;">${voucher.approvedBy || '—'}</div>
              <div class="sig-line">Approved By (Authorizer)</div>
            </div>
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  const getStatusBadge = (status: VoucherListItem['postingStatus'], isReversed?: boolean) => {
    if (isReversed) {
      return (
        <Badge variant="outline" className="border-purple-500/40 text-purple-600 dark:text-purple-400 gap-1">
          <RotateCcw className="h-3 w-3" /> Reversed
        </Badge>
      )
    }

    switch (status) {
      case 'draft':
        return (
          <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 gap-1">
            <Clock className="h-3 w-3" /> Draft
          </Badge>
        )
      case 'submitted':
        return (
          <Badge variant="outline" className="border-blue-500/40 text-blue-600 dark:text-blue-400 gap-1">
            <AlertCircle className="h-3 w-3" /> Submitted
          </Badge>
        )
      case 'approved':
        return (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Approved
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge variant="outline" className="border-rose-500/40 text-rose-600 dark:text-rose-400 gap-1">
            <XCircle className="h-3 w-3" /> Cancelled
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search voucher, narration, ref…"
              className="h-8 pl-8 text-xs font-mono"
            />
          </div>

          <NativeSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 text-xs w-32"
          >
            <NativeSelectOption value="all">All Statuses</NativeSelectOption>
            <NativeSelectOption value="draft">Draft</NativeSelectOption>
            <NativeSelectOption value="submitted">Submitted</NativeSelectOption>
            <NativeSelectOption value="approved">Approved</NativeSelectOption>
            <NativeSelectOption value="cancelled">Cancelled</NativeSelectOption>
          </NativeSelect>

          <NativeSelect
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 text-xs w-36"
          >
            {VOUCHER_TYPE_OPTIONS.map((opt) => (
              <NativeSelectOption key={opt.value} value={opt.value}>
                {opt.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="h-8 text-xs w-36"
          >
            <NativeSelectOption value="all">All Branches</NativeSelectOption>
            {branches.map((b) => (
              <NativeSelectOption key={b.id} value={b.id}>
                {b.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <Button
          size="sm"
          onClick={() => setIsNewVoucherOpen(true)}
          className="h-8 gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Voucher
        </Button>
      </div>

      {/* Vouchers Table */}
      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="w-28 text-xs">Voucher No</TableHead>
              <TableHead className="w-20 text-xs">Type</TableHead>
              <TableHead className="w-36 text-xs">Date (AD / BS)</TableHead>
              <TableHead className="w-24 text-xs">Branch</TableHead>
              <TableHead className="w-24 text-xs">Ref #</TableHead>
              <TableHead className="text-xs">Narration</TableHead>
              <TableHead className="w-28 text-right text-xs">Debit (NPR)</TableHead>
              <TableHead className="w-28 text-right text-xs">Credit (NPR)</TableHead>
              <TableHead className="w-24 text-center text-xs">Status</TableHead>
              <TableHead className="w-40 text-right text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vouchers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="py-8 text-center text-xs text-muted-foreground"
                >
                  No vouchers found for the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              vouchers.map((v) => (
                <TableRow key={v.id} className="border-border text-xs hover:bg-muted/30">
                  <TableCell
                    className="font-mono font-semibold cursor-pointer text-primary hover:underline"
                    onClick={() => setSelectedVoucherId(v.id)}
                  >
                    {v.voucherNo || (
                      <span className="text-muted-foreground italic font-normal">Draft</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {v.voucherType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground text-[11px]">
                    <div>{v.postingDate.slice(0, 10)}</div>
                    <div className="text-[10px] text-muted-foreground/80">{v.bsDate}</div>
                  </TableCell>
                  <TableCell className="text-xs truncate max-w-[100px]" title={v.branchName || 'Head Office'}>
                    {v.branchName || <span className="text-muted-foreground">Head Office</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[80px]" title={v.refId || '—'}>
                    {v.refId || '—'}
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={v.narration}>
                    {v.narration}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    <MoneyText paisa={v.totalDebit} />
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    <MoneyText paisa={v.totalCredit} />
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(v.postingStatus, v.isReversed)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        title="View Details"
                        onClick={() => setSelectedVoucherId(v.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>

                      {v.postingStatus === 'draft' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          disabled={isSubmitting}
                          onClick={() => handleSubmitDraft(v.id)}
                        >
                          Submit
                        </Button>
                      )}
                      {v.postingStatus === 'submitted' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-emerald-600 hover:text-emerald-700"
                          disabled={isSubmitting}
                          onClick={() => handleApprove(v.id)}
                        >
                          Approve
                        </Button>
                      )}
                      {(v.postingStatus === 'draft' ||
                        v.postingStatus === 'submitted') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-rose-600 hover:text-rose-700"
                          disabled={isSubmitting}
                          onClick={() => handleCancel(v.id)}
                        >
                          Cancel
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

      {/* Dynamic Dr/Cr Voucher Creation Dialog */}
      <Dialog open={isNewVoucherOpen} onOpenChange={setIsNewVoucherOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Receipt className="h-4 w-4 text-primary" />
              Dynamic Double-Entry Voucher Creation
            </DialogTitle>
            <DialogDescription className="text-xs">
              Every journal line must balance. Debits must equal credits. Supports Nepal FY numbering, branch allocation, party ledgers, and maker-checker approval.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveVoucher} className="space-y-4 pt-2">
            {/* Header Form Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-muted/20 p-3 rounded-md border border-border/60">
              <div className="space-y-1">
                <Label className="text-xs">Voucher Type</Label>
                <NativeSelect
                  value={voucherType}
                  onChange={(e) => setVoucherType(e.target.value as any)}
                  className="h-8 text-xs"
                >
                  <NativeSelectOption value="JV">Journal Voucher (JV)</NativeSelectOption>
                  <NativeSelectOption value="PV">Payment Voucher (PV)</NativeSelectOption>
                  <NativeSelectOption value="RV">Receipt Voucher (RV)</NativeSelectOption>
                  <NativeSelectOption value="CV">Contra Voucher (CV)</NativeSelectOption>
                  <NativeSelectOption value="SV">Sales Voucher (SV)</NativeSelectOption>
                  <NativeSelectOption value="CN">Credit Note (CN)</NativeSelectOption>
                  <NativeSelectOption value="DN">Debit Note (DN)</NativeSelectOption>
                  <NativeSelectOption value="OB">Opening Balance (OB)</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Posting Date</Label>
                <Input
                  type="date"
                  value={postingDate}
                  onChange={(e) => setPostingDate(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Branch</Label>
                <NativeSelect
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="h-8 text-xs"
                >
                  <NativeSelectOption value="">Head Office / Consolidated</NativeSelectOption>
                  {branches.map((b) => (
                    <NativeSelectOption key={b.id} value={b.id}>
                      {b.code} - {b.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Reference Number</Label>
                <Input
                  value={refId}
                  onChange={(e) => setRefId(e.target.value)}
                  placeholder="Invoice #, Cheque #, etc."
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">Narration / Memo *</Label>
                <Input
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder="Detailed business explanation for this transaction…"
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Workflow Action</Label>
                <div className="flex items-center gap-3 pt-2">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={asDraft}
                      onChange={(e) => setAsDraft(e.target.checked)}
                      className="rounded border-border text-primary"
                    />
                    <span>Save as Draft (Post later)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Dynamic Lines Table */}
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/40 text-[11px]">
                    <TableHead className="w-52">Account *</TableHead>
                    <TableHead className="w-28 text-right">Debit (NPR)</TableHead>
                    <TableHead className="w-28 text-right">Credit (NPR)</TableHead>
                    <TableHead className="w-48">Party (Optional)</TableHead>
                    <TableHead className="w-28">Cost Center</TableHead>
                    <TableHead>Line Narration</TableHead>
                    <TableHead className="w-10 text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id} className="border-border">
                      {/* Account Selector */}
                      <TableCell className="p-1.5">
                        <NativeSelect
                          value={line.accountId}
                          onChange={(e) =>
                            handleLineChange(line.id, 'accountId', e.target.value)
                          }
                          className="h-7 text-xs"
                        >
                          {postableAccounts.map((acc) => (
                            <NativeSelectOption key={acc.id} value={acc.id}>
                              {acc.code} - {acc.name} ({acc.rootType})
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </TableCell>

                      {/* Debit Input */}
                      <TableCell className="p-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debitRs}
                          onChange={(e) =>
                            handleLineChange(line.id, 'debitRs', e.target.value)
                          }
                          className="h-7 text-right text-xs font-mono"
                        />
                      </TableCell>

                      {/* Credit Input */}
                      <TableCell className="p-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.creditRs}
                          onChange={(e) =>
                            handleLineChange(line.id, 'creditRs', e.target.value)
                          }
                          className="h-7 text-right text-xs font-mono"
                        />
                      </TableCell>

                      {/* Party Selection (Type + Identifier) */}
                      <TableCell className="p-1.5">
                        <div className="flex items-center gap-1">
                          <NativeSelect
                            value={line.partyType}
                            onChange={(e) =>
                              handleLineChange(
                                line.id,
                                'partyType',
                                e.target.value as any,
                              )
                            }
                            className="h-7 text-[11px] w-24"
                          >
                            <NativeSelectOption value="">None</NativeSelectOption>
                            <NativeSelectOption value="dealer">Dealer</NativeSelectOption>
                            <NativeSelectOption value="rider">Rider</NativeSelectOption>
                            <NativeSelectOption value="customer">Customer</NativeSelectOption>
                            <NativeSelectOption value="supplier">Supplier</NativeSelectOption>
                            <NativeSelectOption value="employee">Staff</NativeSelectOption>
                          </NativeSelect>

                          {line.partyType === 'dealer' ? (
                            <NativeSelect
                              value={line.partyId}
                              onChange={(e) =>
                                handleLineChange(line.id, 'partyId', e.target.value)
                              }
                              className="h-7 text-[11px] flex-1"
                            >
                              <NativeSelectOption value="">Select Dealer</NativeSelectOption>
                              {dealers.map((d) => (
                                <NativeSelectOption key={d.id} value={d.id}>
                                  {d.name}
                                </NativeSelectOption>
                              ))}
                            </NativeSelect>
                          ) : line.partyType === 'rider' ? (
                            <NativeSelect
                              value={line.partyId}
                              onChange={(e) =>
                                handleLineChange(line.id, 'partyId', e.target.value)
                              }
                              className="h-7 text-[11px] flex-1"
                            >
                              <NativeSelectOption value="">Select Rider</NativeSelectOption>
                              {riders.map((r) => (
                                <NativeSelectOption key={r.id} value={r.id}>
                                  {r.name}
                                </NativeSelectOption>
                              ))}
                            </NativeSelect>
                          ) : line.partyType ? (
                            <Input
                              value={line.partyId}
                              onChange={(e) =>
                                handleLineChange(line.id, 'partyId', e.target.value)
                              }
                              placeholder="Party ID / Name"
                              className="h-7 text-xs flex-1"
                            />
                          ) : null}
                        </div>
                      </TableCell>

                      {/* Cost Center */}
                      <TableCell className="p-1.5">
                        <NativeSelect
                          value={line.costCenter}
                          onChange={(e) =>
                            handleLineChange(
                              line.id,
                              'costCenter',
                              e.target.value as any,
                            )
                          }
                          className="h-7 text-[11px]"
                        >
                          <NativeSelectOption value="general">General</NativeSelectOption>
                          <NativeSelectOption value="liquor">Liquor</NativeSelectOption>
                          <NativeSelectOption value="food">Food</NativeSelectOption>
                          <NativeSelectOption value="delivery">Delivery</NativeSelectOption>
                        </NativeSelect>
                      </TableCell>

                      {/* Line Narration */}
                      <TableCell className="p-1.5">
                        <Input
                          value={line.narration}
                          onChange={(e) =>
                            handleLineChange(line.id, 'narration', e.target.value)
                          }
                          placeholder="Optional memo"
                          className="h-7 text-xs"
                        />
                      </TableCell>

                      {/* Remove Button */}
                      <TableCell className="p-1.5 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-rose-600"
                          onClick={() => handleRemoveLine(line.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Bottom Balance Bar */}
            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLine}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3 w-3" /> Add Line
              </Button>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground">Total Debit: </span>
                  <span className="font-semibold text-foreground">
                    {formatNPR(totalDebitPaisa)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Credit: </span>
                  <span className="font-semibold text-foreground">
                    {formatNPR(totalCreditPaisa)}
                  </span>
                </div>
                <div className="pl-2 border-l border-border">
                  {isBalanced ? (
                    <Badge className="bg-emerald-600 text-white gap-1 text-[11px]">
                      <CheckCircle2 className="h-3 w-3" /> Balanced
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1 text-[11px]">
                      Diff: {formatNPR(Math.abs(differencePaisa))}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewVoucherOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || (!asDraft && !isBalanced)}
              >
                {isSubmitting
                  ? 'Saving…'
                  : asDraft
                    ? 'Save Draft'
                    : 'Post Voucher'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Interactive Voucher Details Modal */}
      <Dialog
        open={Boolean(selectedVoucherId)}
        onOpenChange={(open) => !open && setSelectedVoucherId(null)}
      >
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
          {isLoadingDetails || !activeVoucherDetails ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Loading voucher details…
            </div>
          ) : (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-primary" />
                      <DialogTitle className="text-base font-bold font-mono">
                        {activeVoucherDetails.voucherNo || '[DRAFT VOUCHER]'}
                      </DialogTitle>
                      <Badge variant="outline" className="font-mono text-xs">
                        {activeVoucherDetails.voucherType}
                      </Badge>
                      {getStatusBadge(
                        activeVoucherDetails.postingStatus,
                        activeVoucherDetails.isReversed,
                      )}
                    </div>
                    <DialogDescription className="text-xs pt-1">
                      {activeVoucherDetails.dualDate} &bull; FY: {activeVoucherDetails.fiscalYearId} &bull;{' '}
                      Branch: {activeVoucherDetails.branchName || 'Head Office'}
                    </DialogDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => handlePrintVoucher(activeVoucherDetails)}
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print Voucher
                    </Button>

                    {activeVoucherDetails.postingStatus === 'approved' &&
                      !activeVoucherDetails.isReversed && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs text-purple-600 hover:text-purple-700"
                          onClick={() => {
                            setReversalTargetVoucher(activeVoucherDetails)
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reverse Voucher
                        </Button>
                      )}
                  </div>
                </div>
              </DialogHeader>

              {/* Reversal Alerts */}
              {activeVoucherDetails.isReversed && (
                <div className="rounded-md border border-purple-500/40 bg-purple-500/10 p-2.5 text-xs text-purple-600 dark:text-purple-400 flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 shrink-0" />
                  <span>
                    This voucher has been reversed by reversal entry:{' '}
                    <strong>{activeVoucherDetails.reversedBy}</strong>. Its financial impact in the General Ledger has been neutralized.
                  </span>
                </div>
              )}

              {activeVoucherDetails.reversalOf && (
                <div className="rounded-md border border-blue-500/40 bg-blue-500/10 p-2.5 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    This is an immutable reversal entry for original voucher:{' '}
                    <strong>{activeVoucherDetails.reversalOf}</strong>.
                  </span>
                </div>
              )}

              {/* Audit Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-muted/20 p-2.5 rounded-md border border-border/60">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Created By</div>
                  <div className="font-medium text-foreground">{activeVoucherDetails.createdBy}</div>
                  <div className="text-[10px] text-muted-foreground">{activeVoucherDetails.createdAt.slice(0, 10)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Submitted By</div>
                  <div className="font-medium text-foreground">{activeVoucherDetails.submittedBy || '—'}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {activeVoucherDetails.submittedAt ? activeVoucherDetails.submittedAt.slice(0, 10) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Approved By</div>
                  <div className="font-medium text-foreground">{activeVoucherDetails.approvedBy || '—'}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {activeVoucherDetails.approvedAt ? activeVoucherDetails.approvedAt.slice(0, 10) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold">Reference</div>
                  <div className="font-mono text-foreground">{activeVoucherDetails.refId || '—'}</div>
                  <div className="text-[10px] text-muted-foreground">{activeVoucherDetails.refType || 'manual'}</div>
                </div>
              </div>

              {/* Narration */}
              <div className="text-xs bg-card p-2.5 rounded-md border border-border">
                <span className="font-semibold text-muted-foreground">Narration / Memo: </span>
                <span className="text-foreground">{activeVoucherDetails.narration}</span>
              </div>

              {/* Journal Lines Table */}
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-[11px]">
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead>Account Code & Name</TableHead>
                      <TableHead className="w-32">Party</TableHead>
                      <TableHead className="w-24">Cost Center</TableHead>
                      <TableHead className="w-28 text-right">Debit (NPR)</TableHead>
                      <TableHead className="w-28 text-right">Credit (NPR)</TableHead>
                      <TableHead>Line Narration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeVoucherDetails.lines.map((line, idx) => (
                      <TableRow key={line.id} className="text-xs border-border">
                        <TableCell className="text-center font-mono text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold font-mono text-foreground">
                            {line.accountCode} - {line.accountName}
                          </div>
                          <div className="text-[10px] text-muted-foreground uppercase">
                            {line.accountRootType}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {line.partyType ? (
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {line.partyType}: {line.partyId}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs capitalize text-muted-foreground">
                          {line.costCenter || 'General'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {line.debit > 0 ? <MoneyText paisa={line.debit} /> : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {line.credit > 0 ? <MoneyText paisa={line.credit} /> : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-xs">
                          {line.narration || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Total Dr/Cr Footer */}
                <div className="flex items-center justify-between p-3 bg-muted/20 border-t border-border font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="font-semibold text-muted-foreground">Total Journal Lines:</span>
                    <span>{activeVoucherDetails.lines.length}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-muted-foreground">Total Debit: </span>
                      <span className="font-bold text-foreground">
                        {formatNPR(activeVoucherDetails.totalDebit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Credit: </span>
                      <span className="font-bold text-foreground">
                        {formatNPR(activeVoucherDetails.totalCredit)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attachments Section */}
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Paperclip className="h-3.5 w-3.5 text-primary" />
                    Document Attachments ({activeVoucherDetails.attachments.length})
                  </div>
                </div>

                {activeVoucherDetails.attachments.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeVoucherDetails.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2 rounded-md border border-border bg-muted/10 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <div className="truncate">
                            <div className="font-medium truncate">{att.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              By {att.uploadedBy} &bull; {att.createdAt.slice(0, 10)}
                            </div>
                          </div>
                        </div>

                        <a
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 text-[11px] shrink-0 font-medium pl-2"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Attachment Form */}
                <form
                  onSubmit={handleAddAttachment}
                  className="flex flex-col sm:flex-row items-center gap-2 pt-1"
                >
                  <Input
                    value={attachName}
                    onChange={(e) => setAttachName(e.target.value)}
                    placeholder="Attachment Title (e.g. Tax Invoice #102)"
                    className="h-7 text-xs flex-1"
                  />
                  <Input
                    value={attachUrl}
                    onChange={(e) => setAttachUrl(e.target.value)}
                    placeholder="Document URL / Link"
                    className="h-7 text-xs flex-1 font-mono"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={isAttaching || !attachName || !attachUrl}
                    className="h-7 text-xs gap-1 shrink-0"
                  >
                    <Upload className="h-3 w-3" />
                    {isAttaching ? 'Attaching…' : 'Attach File'}
                  </Button>
                </form>
              </div>

              {/* Modal Actions Footer */}
              <DialogFooter className="border-t border-border pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedVoucherId(null)}
                >
                  Close
                </Button>

                {activeVoucherDetails.postingStatus === 'draft' && (
                  <Button
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => handleSubmitDraft(activeVoucherDetails.id)}
                  >
                    Submit Draft Voucher
                  </Button>
                )}

                {activeVoucherDetails.postingStatus === 'submitted' && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={isSubmitting}
                    onClick={() => handleApprove(activeVoucherDetails.id)}
                  >
                    Approve & Post to Ledger
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reversal Confirmation Dialog */}
      <Dialog
        open={Boolean(reversalTargetVoucher)}
        onOpenChange={(open) => !open && setReversalTargetVoucher(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-rose-600">
              <RotateCcw className="h-4 w-4" />
              Reverse Voucher {reversalTargetVoucher?.voucherNo}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Reversing creates an exact inverse accounting voucher in the General Ledger. The original voucher will be marked as reversed and linked permanently.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleExecuteReversal} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Reason for Reversal *</Label>
              <Input
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="e.g., Wrong dealer cost center credited, duplicate entry"
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Reversal Posting Date</Label>
              <Input
                type="date"
                value={reversalDate}
                onChange={(e) => setReversalDate(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReversalTargetVoucher(null)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={isSubmitting || reversalReason.trim().length < 5}
              >
                {isSubmitting ? 'Posting Reversal…' : 'Post Reversal Voucher'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
