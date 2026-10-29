import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { approveSettlementFn } from '#/server/operations/operations.functions'
import type { Settlement } from '#/server/operations/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Card } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { CheckCircle2, Loader2, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { formatNPR } from '#/lib/money'

export interface RiderSettlementApprovalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settlement: Settlement | null
  onSuccess?: (voucherNo: string, slug: string) => void
}

export function RiderSettlementApprovalDialog({
  open,
  onOpenChange,
  settlement,
  onSuccess,
}: RiderSettlementApprovalDialogProps) {
  const router = useRouter()

  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'bank_transfer' | 'esewa' | 'khalti' | 'cheque'
  >('cash')
  const [paymentAccount, setPaymentAccount] = useState<'cash' | 'bank'>('cash')
  const [paymentReference, setPaymentReference] = useState('')
  const [proofUrl, setProofUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!settlement) return null

  const netPayout = settlement.netPayout || settlement.payout || 0

  const handleApproveAndPay = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setIsSubmitting(true)
      const res = await approveSettlementFn({
        data: {
          id: settlement.id,
          paymentMethod,
          paymentAccount,
          paymentReference: paymentReference.trim() || undefined,
          proofUrls: proofUrl.trim() ? [proofUrl.trim()] : undefined,
          notes: notes.trim() || undefined,
        },
      })

      toast.success(
        `Settlement voucher ${res.voucherNo} posted & disbursed successfully`,
      )
      onOpenChange(false)
      if (onSuccess) onSuccess(res.voucherNo, res.slug)
      await router.invalidate()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve and disburse settlement')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
        <form
          onSubmit={handleApproveAndPay}
          className="flex flex-col h-full min-h-0"
        >
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-muted/10">
            <DialogTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-emerald-500" />
                Approve & Disburse Courier Settlement
              </span>
              <Badge variant="outline" className="font-mono text-xs">
                {settlement.voucherNo || settlement.id}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Post double-entry salary expense accrual, debit Rider Payable, and
              credit payment account with proof voucher generation.
            </DialogDescription>
          </DialogHeader>

          {/* Breakdown Summary */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 click-scroll">
            <Card className="p-3 bg-muted/40 space-y-2 border-border text-xs">
              <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground">
                  Recipient Courier:
                </span>
                <span className="font-semibold text-foreground">
                  {settlement.riderName}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground">Period:</span>
                <span className="font-mono text-xs text-foreground">
                  {settlement.periodStart?.slice(0, 10)} →{' '}
                  {settlement.periodEnd?.slice(0, 10)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Deliveries ({settlement.deliveries} drops):
                </span>
                <span className="font-mono text-foreground">
                  {formatNPR(
                    settlement.perDropAmount || settlement.commission || 0,
                  )}
                </span>
              </div>

              {settlement.baseSalaryAmount ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Monthly Base Salary:
                  </span>
                  <span className="font-mono text-foreground">
                    {formatNPR(settlement.baseSalaryAmount)}
                  </span>
                </div>
              ) : null}

              {settlement.commissionAmount ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Delivery Commission:
                  </span>
                  <span className="font-mono text-foreground">
                    {formatNPR(settlement.commissionAmount)}
                  </span>
                </div>
              ) : null}

              {settlement.advancesDeducted ? (
                <div className="flex items-center justify-between text-warning">
                  <span>Advance Deductions:</span>
                  <span className="font-mono">
                    - {formatNPR(settlement.advancesDeducted)}
                  </span>
                </div>
              ) : null}

              {settlement.cashShortageDeducted ? (
                <div className="flex items-center justify-between text-destructive">
                  <span>COD Cash Shortage Deductions:</span>
                  <span className="font-mono">
                    - {formatNPR(settlement.cashShortageDeducted)}
                  </span>
                </div>
              ) : null}

              <div className="flex items-center justify-between pt-2 border-t border-border font-bold text-sm">
                <span>Net Disbursement Payout:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  {formatNPR(netPayout)}
                </span>
              </div>
            </Card>

            {/* Payout Options */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Payment Method</Label>
                <NativeSelect
                  value={paymentMethod}
                  onChange={(e) => {
                    const m = e.target.value as any
                    setPaymentMethod(m)
                    if (m === 'cash') setPaymentAccount('cash')
                    else setPaymentAccount('bank')
                  }}
                  className="w-full text-xs"
                >
                  <NativeSelectOption value="cash">Cash</NativeSelectOption>
                  <NativeSelectOption value="bank_transfer">
                    Bank Transfer
                  </NativeSelectOption>
                  <NativeSelectOption value="esewa">eSewa</NativeSelectOption>
                  <NativeSelectOption value="khalti">Khalti</NativeSelectOption>
                  <NativeSelectOption value="cheque">Cheque</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Ledger Account</Label>
                <NativeSelect
                  value={paymentAccount}
                  onChange={(e) => setPaymentAccount(e.target.value as any)}
                  className="w-full text-xs"
                >
                  <NativeSelectOption value="cash">
                    Cash in Hand (acc_1011)
                  </NativeSelectOption>
                  <NativeSelectOption value="bank">
                    Bank Account (acc_1012)
                  </NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Payment Reference / Transaction ID
              </Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. Bank UTR / eSewa Txn ID"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Proof Attachment URL (Signed Receipt / Slip)
              </Label>
              <Input
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                placeholder="https://.../receipt.jpg"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notes / Memo</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional settlement notes"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Posting Ledger...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve & Disburse Payout
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
