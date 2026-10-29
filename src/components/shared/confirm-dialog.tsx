import * as React from 'react'
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
import { cn } from '#/lib/utils'
import { Loader2 } from 'lucide-react'

export interface ConfirmDialogProps {
  open: boolean
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  tone?: 'danger' | 'destructive' | 'default'
  isLoading?: boolean
  disabled?: boolean
  icon?: React.ReactNode
  children?: React.ReactNode
  onConfirm: () => void | Promise<void>
  onClose?: () => void
  onOpenChange?: (open: boolean) => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  tone,
  isLoading,
  disabled,
  icon,
  children,
  onConfirm,
  onClose,
  onOpenChange,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = React.useState(false)
  const isDanger = danger || tone === 'danger' || tone === 'destructive'
  const busy = isLoading ?? internalLoading

  const handleClose = () => {
    if (busy) return
    onClose?.()
    onOpenChange?.(false)
  }

  const handleConfirm = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (busy || disabled) return
    try {
      setInternalLoading(true)
      await onConfirm()
      onClose?.()
      onOpenChange?.(false)
    } catch {
      // Caller handles error notification via toast
    } finally {
      setInternalLoading(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return
        onOpenChange?.(v)
        if (!v) onClose?.()
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base font-semibold">
            {icon && <span className="shrink-0">{icon}</span>}
            <span>{title}</span>
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-xs text-muted-foreground text-left">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {children && <div className="py-2">{children}</div>}

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel
            onClick={handleClose}
            disabled={busy}
            className="h-9 cursor-pointer"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={busy || disabled}
            variant={isDanger ? 'destructive' : 'default'}
            className={cn('h-9 cursor-pointer gap-2')}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {busy && typeof confirmLabel === 'string' && !confirmLabel.endsWith('...')
              ? `${confirmLabel}...`
              : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
