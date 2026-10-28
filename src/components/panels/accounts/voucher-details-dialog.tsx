import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { formatNPR } from '#/lib/money'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  CheckCircle2,
  ExternalLink,
  Printer,
  Copy,
  Receipt,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import type { DetailedJournalEntry } from '#/server/finance/finance.queries'

export interface VoucherDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: DetailedJournalEntry | null
  publicSlug?: string | null
}

export function VoucherDetailsDialog({
  open,
  onOpenChange,
  entry,
  publicSlug,
}: VoucherDetailsDialogProps) {
  const [copied, setCopied] = useState(false)

  if (!entry) return null

  const isBalanced =
    entry.totalDebit === entry.totalCredit && entry.totalDebit > 0
  const variance = Math.abs(entry.totalDebit - entry.totalCredit)

  const copyPublicLink = () => {
    if (!publicSlug) return
    const url = `${window.location.origin}/voucher/${publicSlug}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Public voucher link copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl w-[calc(100%-2rem)] max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">
        <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border flex flex-row items-center justify-between space-y-0 bg-muted/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-semibold font-mono">
                  {entry.voucherNo}
                </DialogTitle>
                <Badge
                  variant={
                    entry.voucherType === 'SV'
                      ? 'default'
                      : entry.voucherType === 'PV'
                        ? 'destructive'
                        : entry.voucherType === 'RV'
                          ? 'secondary'
                          : 'outline'
                  }
                  className="text-[10px] uppercase font-mono"
                >
                  {entry.voucherType === 'SV' && 'Sales Voucher'}
                  {entry.voucherType === 'PV' && 'Payment Voucher'}
                  {entry.voucherType === 'RV' && 'Receipt Voucher'}
                  {entry.voucherType === 'JV' && 'Journal Voucher'}
                  {entry.voucherType === 'CV' && 'Contra Voucher'}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
                >
                  {entry.postingStatus}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Double-Entry Posting Record · Nepal Standard Accounting
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {publicSlug && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyPublicLink}
                className="h-8 gap-1.5 text-xs"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Copied' : 'Share Voucher'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-8 gap-1.5 text-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5 text-xs click-scroll">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg border border-border bg-card/60">
            <div>
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">
                Posting Date (BS)
              </span>
              <span className="font-medium text-foreground text-xs">
                {entry.bsDate || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">
                Gregorian (AD)
              </span>
              <span className="font-mono text-muted-foreground text-xs">
                {entry.postingDate.slice(0, 10)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">
                Reference
              </span>
              <span className="font-mono text-foreground text-xs">
                {entry.refType
                  ? `${entry.refType} #${entry.refId || ''}`
                  : 'Manual'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">
                Posted By
              </span>
              <span className="text-foreground text-xs">
                {entry.createdBy || 'System'}
              </span>
            </div>
          </div>

          {/* Narration */}
          {entry.narration && (
            <div className="p-3 rounded-md bg-muted/40 border border-border/60">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block mb-0.5">
                Narration / Memo
              </span>
              <p className="text-xs text-foreground font-medium">
                {entry.narration}
              </p>
            </div>
          )}

          {/* Journal Lines Table */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Accounting Legs ({entry.lines.length} lines)
              </span>
              {isBalanced ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Balanced (Zero Variance)
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-destructive">
                  Unbalanced! Variance: {formatNPR(variance)}
                </span>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs font-semibold">
                      Account
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Party / Cost Center
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Line Narration
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Debit (Dr)
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-blue-600 dark:text-blue-400">
                      Credit (Cr)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entry.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <span className="font-mono text-xs font-bold text-foreground block">
                          {line.accountCode}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {line.accountName}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-foreground">
                          {line.partyType
                            ? `${line.partyType}: ${line.partyId}`
                            : line.costCenter || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px] text-muted-foreground">
                          {line.narration || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {line.debit > 0 ? formatNPR(line.debit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {line.credit > 0 ? formatNPR(line.credit) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 font-bold border-t-2 border-border">
                    <TableCell
                      colSpan={3}
                      className="text-xs uppercase text-foreground"
                    >
                      Total Ledger Movement
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                      {formatNPR(entry.totalDebit)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-blue-600 dark:text-blue-400">
                      {formatNPR(entry.totalCredit)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Public Link Card */}
          {publicSlug && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <div>
                  <span className="text-xs font-semibold text-foreground block">
                    Public Shareable Voucher Slug
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    /voucher/{publicSlug}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                asChild
                className="h-7 gap-1 text-xs"
              >
                <Link
                  to="/voucher/$slug"
                  params={{ slug: publicSlug }}
                  target="_blank"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open Public View
                </Link>
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-1.5"
          >
            <Printer className="h-4 w-4" />
            Print Voucher
          </Button>
          <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
