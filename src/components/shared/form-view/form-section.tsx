import * as React from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '#/lib/utils'

export interface FormSectionProps {
  title?: string
  description?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
  children: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function FormSection({
  title,
  description,
  collapsible = false,
  defaultCollapsed = false,
  children,
  actions,
  className,
}: FormSectionProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)

  return (
    <Card
      className={cn('border border-border/80 shadow-none bg-card', className)}
    >
      {(title || description || actions) && (
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/40 flex flex-row items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            {title && (
              <CardTitle className="text-sm font-semibold tracking-tight text-foreground truncate">
                {title}
              </CardTitle>
            )}
            {description && (
              <CardDescription className="text-xs text-muted-foreground">
                {description}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {actions}
            {collapsible && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(!collapsed)}
                className="size-7 text-muted-foreground"
                aria-label={collapsed ? 'Expand section' : 'Collapse section'}
              >
                {collapsed ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronUp className="size-3.5" />
                )}
              </Button>
            )}
          </div>
        </CardHeader>
      )}
      {!collapsed && (
        <CardContent className="p-4 sm:p-5">{children}</CardContent>
      )}
    </Card>
  )
}
