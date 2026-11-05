import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import {
  approveRiderCashSettlementFn,
  rejectRiderCashSettlementFn,
} from '#/server/finance/finance.functions'
import { RIDER_SETTLEMENT_METHOD_LABELS } from '#/server/riders/rider-settlements'
import type { RiderCashHandover } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Badge } from '#/components/ui/badge'
import { EmptyState } from '#/components/shared/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { CheckCircle2, Clock, Loader2, Wallet, XCircle } from 'lucide-react'
import { toast } from 'sonner'

interface RiderSettlementRequestsProps {
  requests: RiderCashHandover[]
}

export function RiderSettlementRequests({
  requests,
}: RiderSettlementRequestsProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<RiderCashHandover | null>(null)
  const [action, setAction] = useState<'approve' | 'reject'>('approve')
  const [rejectionReason, setRejectionReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const orderedRequests = [...requests].sort((a, b) => {
    const rank = { pending: 0, verified: 1, rejected: 2 }
    const diff = rank[a.status] - rank[b.status]
    if (diff !== 0) return diff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const openDialog = (
    request: RiderCashHandover,
    nextAction: 'approve' | 'reject',
  ) => {
    setSelected(request)
    setAction(nextAction)
    setRejectionReason('')
  }

  const closeDialog = () => {
    setSelected(null)
    setRejectionReason('')
  }

  const refreshData = async () => {
    await queryClient.invalidateQueries({
      queryKey: adminQueries.ledger().queryKey,
    })
    await router.invalidate()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return

    if (action === 'reject' && rejectionReason.trim().length < 3) {
      toast.error('Please provide a rejection reason (at least 3 characters).')
      return
    }

    try {
      setIsSubmitting(true)
      if (action === 'approve') {
        const result = await approveRiderCashSettlementFn({
          data: { id: selected.id },
        })
        toast.success(
          `Settlement accepted and posted as voucher ${result.voucherNo}.`,
        )
      } else {
        await rejectRiderCashSettlementFn({
          data: { id: selected.id, reason: rejectionReason.trim() },
        })
        toast.success('Rider settlement request rejected.')
      }
      closeDialog()
      await refreshData()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update rider settlement request')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-warning" />
            Rider Settlement Requests
          </h4>
          <p className="text-xs text-muted-foreground">
            Rider-submitted COD settlements remain pending until a manager or
            admin accepts them. Only then is the amount considered settled.
          </p>
        </div>
        <Badge
          variant={pendingCount > 0 ? 'warning' : 'secondary'}
          className="text-xs font-normal"
        >
          {pendingCount} pending
        </Badge>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Rider</TableHead>
              <TableHead className="text-xs">Amount</TableHead>
              <TableHead className="text-xs">Method</TableHead>
              <TableHead className="text-xs">Reference</TableHead>
              <TableHead className="text-xs">Requested</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-right text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderedRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    title="No rider settlement requests"
                    description="Rider-submitted partial settlements will appear here for manager or admin approval."
                  />
                </TableCell>
              </TableRow>
            ) : (
              orderedRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <span className="font-medium text-xs text-foreground">
                      {request.riderName || request.riderId}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                      {formatNPR(request.amount)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {RIDER_SETTLEMENT_METHOD_LABELS[request.paymentMethod]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {request.paymentReference || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {new Date(request.createdAt).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        request.status === 'verified'
                          ? 'success'
                          : request.status === 'rejected'
                            ? 'destructive'
                            : 'warning'
                      }
                      className="text-xs font-normal capitalize"
                    >
                      {request.status === 'verified'
                        ? 'Settled'
                        : request.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {request.status === 'pending' ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => openDialog(request, 'approve')}
                          className="h-7 gap-1 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDialog(request, 'reject')}
                          className="h-7 gap-1 px-2 text-xs text-destructive"
                        >
                          <XCircle className="h-3 w-3" />
                          Reject
                        </Button>
                      </div>
                    ) : request.status === 'rejected' ? (
                      <span
                        className="text-xs text-destructive"
                        title={request.rejectionReason || undefined}
                      >
                        {request.rejectionReason || 'Rejected'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Posted to ledger
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) closeDialog()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-sm">
                {action === 'approve'
                  ? 'Accept Rider Settlement'
                  : 'Reject Rider Settlement'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {action === 'approve'
                  ? 'Accepting will mark the request as settled, reduce the rider’s cash on hand, and post a receipt voucher to the ledger.'
                  : 'Rejecting leaves the rider’s cash on hand unchanged. The rider can submit a corrected request later.'}
              </DialogDescription>
            </DialogHeader>

            {selected && (
              <div className="space-y-4 py-4">
                <div className="space-y-1.5 rounded-md border border-border bg-muted/40 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Rider</span>
                    <span className="font-semibold text-foreground">
                      {selected.riderName || selected.riderId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatNPR(selected.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <span className="text-foreground">
                      {RIDER_SETTLEMENT_METHOD_LABELS[selected.paymentMethod]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="font-mono text-foreground">
                      {selected.paymentReference || 'Not required (cash)'}
                    </span>
                  </div>
                  {selected.notes && (
                    <div className="flex items-start justify-between gap-4 border-t border-border/60 pt-1.5">
                      <span className="text-muted-foreground">Rider note</span>
                      <span className="text-right text-foreground">
                        {selected.notes}
                      </span>
                    </div>
                  )}
                </div>

                {action === 'reject' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="rejection-reason" className="text-xs">
                      Rejection reason *
                    </Label>
                    <Input
                      id="rejection-reason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g. Reference number does not match bank statement"
                      className="text-xs"
                      required
                      minLength={3}
                      maxLength={500}
                    />
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeDialog}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className={
                  action === 'approve'
                    ? 'gap-1.5 bg-emerald-600 text-xs text-white hover:bg-emerald-700'
                    : 'gap-1.5 text-xs'
                }
                variant={action === 'reject' ? 'destructive' : 'default'}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : action === 'approve' ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Accept &amp; Post Voucher
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
    </div>
  )
}
