import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { VoucherDetailsDialog } from './voucher-details-dialog'

/**
 * Opens any posted voucher by id. The GL/report rows only carry an entry id,
 * so this hook loads the full voucher and renders the shared details dialog.
 */
export function useVoucherDialog() {
  const [entryId, setEntryId] = useState<string | null>(null)
  const { data: entry, isFetching } = useQuery({
    ...adminQueries.journalEntryById(entryId ?? '__none__'),
    enabled: !!entryId,
  })

  const close = () => setEntryId(null)

  const openVoucher = useCallback((id: string | null | undefined) => {
    if (id) setEntryId(id)
  }, [])

  const dialog = entryId ? (
    entry ? (
      <VoucherDetailsDialog
        open
        onOpenChange={(open) => {
          if (!open) close()
        }}
        entry={entry}
      />
    ) : (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Loading voucher</DialogTitle>
            <DialogDescription>
              Fetching the voucher header and accounting lines.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isFetching ? 'Loading voucher…' : 'Voucher not found.'}
          </div>
        </DialogContent>
      </Dialog>
    )
  ) : null

  return {
    openVoucher,
    closeVoucher: close,
    voucherDialog: dialog,
    isFetchingVoucher: isFetching,
  }
}
