import * as React from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '#/components/ui/drawer'
import { useIsMobile } from '#/hooks/use-mobile'
import { cn } from '#/lib/utils'

export interface ResponsiveDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  children,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {children}
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  )
}

export function ResponsiveDialogTrigger({
  children,
  asChild,
  className,
}: {
  children: React.ReactNode
  asChild?: boolean
  className?: string
}) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return (
      <DrawerTrigger asChild={asChild} className={className}>
        {children}
      </DrawerTrigger>
    )
  }
  return (
    <DialogTrigger asChild={asChild} className={className}>
      {children}
    </DialogTrigger>
  )
}

export function ResponsiveDialogContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <DrawerContent className={cn('p-4 max-h-[88vh]', className)}>
        {children}
      </DrawerContent>
    )
  }

  return (
    <DialogContent className={cn('max-w-lg', className)}>
      {children}
    </DialogContent>
  )
}

export function ResponsiveDialogHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return (
      <DrawerHeader className={cn('px-0 pt-0 text-left', className)}>
        {children}
      </DrawerHeader>
    )
  }
  return (
    <DialogHeader className={cn('text-left', className)}>
      {children}
    </DialogHeader>
  )
}

export function ResponsiveDialogTitle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return <DrawerTitle className={className}>{children}</DrawerTitle>
  }
  return <DialogTitle className={className}>{children}</DialogTitle>
}

export function ResponsiveDialogDescription({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return (
      <DrawerDescription className={className}>{children}</DrawerDescription>
    )
  }
  return <DialogDescription className={className}>{children}</DialogDescription>
}

export function ResponsiveDialogFooter({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return (
      <DrawerFooter className={cn('px-0 pb-0 gap-2', className)}>
        {children}
      </DrawerFooter>
    )
  }
  return (
    <DialogFooter className={cn('gap-2', className)}>{children}</DialogFooter>
  )
}

export function ResponsiveDialogClose({
  children,
  asChild,
  className,
}: {
  children: React.ReactNode
  asChild?: boolean
  className?: string
}) {
  const isMobile = useIsMobile()
  if (isMobile) {
    return (
      <DrawerClose asChild={asChild} className={className}>
        {children}
      </DrawerClose>
    )
  }
  return (
    <DialogClose asChild={asChild} className={className}>
      {children}
    </DialogClose>
  )
}
