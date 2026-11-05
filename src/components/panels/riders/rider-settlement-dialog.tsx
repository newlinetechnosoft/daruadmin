import { useState } from 'react'
import {
  approveRiderCashSettlementFn,
  rejectRiderCashSettlementFn,
} from '#/server/finance/finance.functions'
import {
  getAvailableRiderCash,
  RIDER_SETTLEMENT_METHOD_LABELS,
} from '#/server/riders/rider-settlements'
import type { Rider, RiderCashHandover } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Badge } from '#/components/ui/badge'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  CheckCircle2,
  Clock,
  Coins,
  Loader2,
  Wallet,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

interface RiderSettlementDialogProps {
  rider: Rider | null
  requests: RiderCashHandover[]
  open: boolean
  onOpenChange: (open: boolean) => void
  canReview: boolean
  onUpdated: () => Promise<void> | void
}

function formatRequestedAt(iso: string) {
  return new Date(iso).toLocaleString()
}

export function RiderSettlementDialog({
  rider,
  requests,
  open,
  onOpenChange,
  canReview,
  onUpdated,
}: RiderSettlementDialogProps) {
  const [approveTarget, setApproveTarget] = useState<RiderCashHandover | null>(
    null,
  )
  const [rejectTarget, setRejectTarget] = useState<RiderCashHandover | null>(
    null,
  )
  const [rejectionReason, setRejectionReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const riderRequests = rider
    ? requests.filter((request) => request.riderId === rider.id)
    : []
  const pendingRequests = riderRequests
    .filter((request) => request.status === 'pending')
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
  const recentHistory = riderRequests
    .filter((request) => request.status !== 'pending')
    .sort(
      (a, b) =>
        new Date(b.reviewedAt || b.createdAt).getTime() -
        new Date(a.reviewedAt || a.createdAt).getTime(),
    )
    .slice(0, 5)
  const pendingAmount = pendingRequests.reduce(
    (total, request) => total + request.amount,
    0,
  )
  const availableToSettle = rider
    ? getAvailableRiderCash(rider.cashOnHand, pendingAmount)
    : 0

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSubmitting) return
    if (!nextOpen) {
      setApproveTarget(null)
      setRejectTarget(null)
      setRejectionReason('')
    }
    onOpenChange(nextOpen)
  }

  const handleApprove = async () => {
    if (!approveTarget) return

    try {
      setIsSubmitting(true)
      const result = await approveRiderCashSettlementFn({
        data: { id: approveTarget.id },
      })
      toast.success(
        `Accepted ${formatNPR(approveTarget.amount)} from ${rider?.name ?? 'rider'} and posted voucher ${result.voucherNo}.`,
      )
      setApproveTarget(null)
      await onUpdated()
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to accept rider settlement request',
      )
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectTarget) return

    const reason = rejectionReason.trim()
    if (reason.length < 3) {
      toast.error('Please provide a rejection reason (at least 3 characters).')
      return
    }

    try {
      setIsSubmitting(true)
      await rejectRiderCashSettlementFn({
        data: { id: rejectTarget.id, reason },
      })
      toast.success('Rider settlement request rejected.')
      setRejectTarget(null)
      setRejectionReason('')
      await onUpdated()
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to reject rider settlement request',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open && Boolean(rider)} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] flex-col overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b border-border bg-muted/10 p-4 pb-3 sm:p-6 sm:pb-3">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Wallet className="h-4 w-4 text-warning" />
              Rider COD settlement
            </DialogTitle>
            <DialogDescription className="text-xs">
              {rider
                ? `Review settlement requests submitted by ${rider.name}. Only the requested amount is settled; accepting does not clear the rider's remaining COD float.`
                : 'Review rider-submitted settlement requests.'}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            {rider && (
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
                <div>
                  <span className="block text-muted-foreground">
                    Cash in hand
                  </span>
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {formatNPR(rider.cashOnHand)}
                  </span>
                </div>
                <div>
                  <span className="block text-muted-foreground">Requested</span>
                  <span className="font-mono text-sm font-semibold text-warning">
                    {formatNPR(pendingAmount)}
                  </span>
                </div>
                <div>
                  <span className="block text-muted-foreground">
                    Unrequested cash
                  </span>
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {formatNPR(availableToSettle)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
                  <Coins className="h-3.5 w-3.5 text-warning" />
                  Pending requests
                </h4>
                <Badge
                  variant={pendingRequests.length > 0 ? 'warning' : 'secondary'}
                  className="text-xs font-normal"
                >
                  {pendingRequests.length} pending
                </Badge>
              </div>

              {pendingRequests.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center">
                  <Clock className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                  <p className="text-xs font-medium text-foreground">
                    No pending settlement request
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ask the rider to submit a full or partial settlement from
                    their Earnings page. The full COD balance can no longer be
                    settled directly from this page.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="space-y-2 rounded-lg border border-border bg-card p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-sm font-semibold text-foreground">
                              {formatNPR(request.amount)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {
                                RIDER_SETTLEMENT_METHOD_LABELS[
                                  request.paymentMethod
                                ]
                              }
                            </Badge>
                            {request.paymentReference && (
                              <Badge variant="secondary" className="text-xs">
                                Ref: {request.paymentReference}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Requested {formatRequestedAt(request.createdAt)}
                          </p>
                          {request.notes && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Note: {request.notes}
                            </p>
                          )}
                        </div>

                        {canReview && (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => setApproveTarget(request)}
                              disabled={isSubmitting}
                              className="h-7 gap-1 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRejectTarget(request)
                                setRejectionReason('')
                              }}
                              disabled={isSubmitting}
                              className="h-7 gap-1 px-2 text-xs text-destructive"
                            >
                              <XCircle className="h-3 w-3" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>

                      <p className="border-t border-border/60 pt-1.5 text-xs text-muted-foreground">
                        Accepting settles exactly{' '}
                        <span className="font-semibold text-foreground">
                          {formatNPR(request.amount)}
                        </span>{' '}
                        and leaves{' '}
                        <span className="font-semibold text-foreground">
                          {formatNPR(
                            rider ? rider.cashOnHand - request.amount : 0,
                          )}
                        </span>{' '}
                        cash on hand. Any other pending requests remain
                        outstanding.
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {!canReview && pendingRequests.length > 0 && (
                <p className="rounded-md border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning">
                  Only a manager or admin can accept or reject rider settlement
                  requests.
                </p>
              )}
            </div>

            {recentHistory.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent settlement history
                </h4>
                <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                  {recentHistory.map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-semibold text-foreground">
                          {formatNPR(request.amount)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {
                            RIDER_SETTLEMENT_METHOD_LABELS[
                              request.paymentMethod
                            ]
                          }
                        </Badge>
                        {request.paymentReference && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {request.paymentReference}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatRequestedAt(
                            request.reviewedAt || request.createdAt,
                          )}
                        </span>
                        <Badge
                          variant={
                            request.status === 'verified'
                              ? 'success'
                              : 'destructive'
                          }
                          className="text-xs font-normal"
                        >
                          {request.status === 'verified'
                            ? 'Settled'
                            : 'Rejected'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t border-border p-4 sm:p-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(approveTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isSubmitting) setApproveTarget(null)
        }}
        title="Accept rider settlement?"
        description={
          approveTarget
            ? `This will mark ${formatNPR(approveTarget.amount)} from ${rider?.name ?? 'the rider'} as settled, reduce their cash on hand, and post a receipt voucher. Their remaining COD float stays outstanding.`
            : undefined
        }
        confirmLabel="Accept & post voucher"
        isLoading={isSubmitting}
        onClose={() => setApproveTarget(null)}
        onConfirm={handleApprove}
      />

      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isSubmitting) {
            setRejectTarget(null)
            setRejectionReason('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleReject}>
            <DialogHeader>
              <DialogTitle className="text-sm">
                Reject rider settlement
              </DialogTitle>
              <DialogDescription className="text-xs">
                Rejecting leaves the rider&apos;s cash on hand unchanged. The
                rider can submit a corrected request later.
              </DialogDescription>
            </DialogHeader>

            {rejectTarget && (
              <div className="space-y-3 py-4">
                <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Rider</span>
                    <span className="font-semibold text-foreground">
                      {rider?.name ?? 'Rider'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatNPR(rejectTarget.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <span className="text-foreground">
                      {
                        RIDER_SETTLEMENT_METHOD_LABELS[
                          rejectTarget.paymentMethod
                        ]
                      }
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="font-mono text-foreground">
                      {rejectTarget.paymentReference || 'Not required (cash)'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rider-rejection-reason" className="text-xs">
                    Rejection reason *
                  </Label>
                  <Input
                    id="rider-rejection-reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Reference number does not match bank statement"
                    className="text-xs"
                    required
                    minLength={3}
                    maxLength={500}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setRejectTarget(null)
                  setRejectionReason('')
                }}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={isSubmitting}
                className="gap-1.5 text-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5" />
                    Reject Request
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
