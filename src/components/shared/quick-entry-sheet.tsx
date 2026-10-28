import * as React from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '#/components/ui/drawer'
import { useIsMobile } from '#/hooks/use-mobile'
import { cn } from '#/lib/utils'

export interface QuickEntrySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  widthClass?: string // e.g. "sm:max-w-md" or "sm:max-w-lg"
}

/**
 * Responsive side sheet (desktop) / bottom drawer (mobile)
 * Used for creating small master records (brands, categories, promos)
 * without full-page navigation.
 */
export function QuickEntrySheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  widthClass = 'sm:max-w-lg',
}: QuickEntrySheetProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={cn('max-h-[90vh] flex flex-col', className)}>
          <DrawerHeader className="text-left border-b border-border/50 pb-3">
            <DrawerTitle className="text-base font-semibold">
              {title}
            </DrawerTitle>
            {description && (
              <DrawerDescription className="text-xs text-muted-foreground">
                {description}
              </DrawerDescription>
            )}
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'flex flex-col p-0 border-l border-border',
          widthClass,
          className,
        )}
      >
        <SheetHeader className="px-6 py-4 border-b border-border/50 text-left">
          <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
          {description && (
            <SheetDescription className="text-xs text-muted-foreground">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
