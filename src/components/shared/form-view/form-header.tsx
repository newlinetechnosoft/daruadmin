import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { StatusIndicator } from '#/components/shared/status-indicator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '#/components/ui/breadcrumb'
import {
  MoreHorizontal,
  Loader2,
  Save,
  Printer,
  Copy,
  Trash2,
  ArrowLeft,
} from 'lucide-react'
import type { WorkflowAction } from './types'
import { cn } from '#/lib/utils'

export interface FormHeaderBreadcrumb {
  label: string
  href?: string
}

export interface FormHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: FormHeaderBreadcrumb[]
  backHref?: string
  status?: string
  statusLabel?: string
  isDirty?: boolean
  isSubmitting?: boolean
  onSave?: () => void
  saveLabel?: string
  workflowActions?: WorkflowAction[]
  onDuplicate?: () => void
  onPrint?: () => void
  onDelete?: () => void
  deleteLabel?: string
  moreActions?: { label: string; onClick: () => void; destructive?: boolean }[]
  readOnly?: boolean
  className?: string
}

export function FormHeader({
  title,
  subtitle,
  breadcrumbs = [],
  backHref,
  status,
  statusLabel,
  isDirty = false,
  isSubmitting = false,
  onSave,
  saveLabel = 'Save',
  workflowActions = [],
  onDuplicate,
  onPrint,
  onDelete,
  deleteLabel = 'Delete record',
  moreActions = [],
  readOnly = false,
  className,
}: FormHeaderProps) {
  return (
    <div
      className={cn(
        'sticky top-0 z-20 -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8 px-4 py-3 sm:px-6 sm:py-3.5 lg:px-8 bg-background/95 backdrop-blur border-b border-border transition-all',
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList className="text-xs">
              {backHref && (
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to={backHref} className="flex items-center gap-1">
                      <ArrowLeft className="size-3" />
                      <span>Back</span>
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              )}
              {backHref && <BreadcrumbSeparator />}
              {breadcrumbs.map((b, i) => {
                const isLast = i === breadcrumbs.length - 1
                return (
                  <React.Fragment key={i}>
                    <BreadcrumbItem>
                      {isLast || !b.href ? (
                        <BreadcrumbPage className="font-medium text-foreground truncate max-w-[200px]">
                          {b.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={b.href}>{b.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </React.Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}

        {/* Title, Status, and Actions Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground truncate">
              {title}
            </h1>

            {status && (
              <StatusIndicator
                status={status}
                labelOverride={statusLabel}
                asBadge
              />
            )}

            {isDirty && !readOnly && (
              <Badge
                variant="outline"
                className="text-[11px] font-normal border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5"
              >
                Not saved
              </Badge>
            )}

            {readOnly && (
              <Badge
                variant="outline"
                className="text-[11px] font-normal text-muted-foreground border-border px-2 py-0.5"
              >
                Read-only
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Custom Workflow Actions (e.g. Confirm, Assign Rider, etc.) */}
            {workflowActions.map((act) => (
              <Button
                key={act.id}
                type="button"
                variant={act.variant || 'outline'}
                size="sm"
                onClick={act.onClick}
                disabled={act.disabled || act.loading}
                className="h-8 text-xs gap-1.5"
              >
                {act.loading && <Loader2 className="size-3 animate-spin" />}
                {act.label}
              </Button>
            ))}

            {/* Primary Save Button */}
            {!readOnly && onSave && (
              <Button
                type="button"
                size="sm"
                onClick={onSave}
                disabled={isSubmitting || !isDirty}
                className="h-8 text-xs gap-1.5 min-w-[70px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="size-3.5" />
                    {saveLabel}
                  </>
                )}
              </Button>
            )}

            {/* More Menu */}
            {(onDuplicate || onPrint || onDelete || moreActions.length > 0) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground"
                    aria-label="More record actions"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {onDuplicate && (
                    <DropdownMenuItem
                      onSelect={onDuplicate}
                      className="text-xs gap-2 cursor-pointer"
                    >
                      <Copy className="size-3.5" />
                      <span>Duplicate</span>
                    </DropdownMenuItem>
                  )}
                  {onPrint && (
                    <DropdownMenuItem
                      onSelect={onPrint}
                      className="text-xs gap-2 cursor-pointer"
                    >
                      <Printer className="size-3.5" />
                      <span>Print</span>
                    </DropdownMenuItem>
                  )}

                  {moreActions.map((act, i) => (
                    <DropdownMenuItem
                      key={i}
                      onSelect={act.onClick}
                      className={cn(
                        'text-xs gap-2 cursor-pointer',
                        act.destructive && 'text-rose-600 focus:text-rose-600',
                      )}
                    >
                      {act.label}
                    </DropdownMenuItem>
                  ))}

                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={onDelete}
                        className="text-xs gap-2 text-rose-600 focus:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                        <span>{deleteLabel}</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
