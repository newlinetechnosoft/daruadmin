import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { buttonVariants } from '#/components/ui/button'
import { cn } from '#/lib/utils'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  tone,
  onConfirm,
  onClose,
  onOpenChange,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  tone?: 'danger' | 'destructive' | 'default'
  onConfirm: () => void
  onClose?: () => void
  onOpenChange?: (open: boolean) => void
}) {
  const isDanger = danger || tone === 'danger' || tone === 'destructive'
  const handleClose = () => {
    onClose?.()
    onOpenChange?.(false)
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange?.(v)
        if (!v) onClose?.()
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-semibold">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel onClick={handleClose} className="h-9">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(
              'h-9',
              isDanger && buttonVariants({ variant: 'destructive' }),
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
