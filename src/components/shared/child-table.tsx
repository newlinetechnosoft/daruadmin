import * as React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Plus, Trash2 } from 'lucide-react'
import { useIsMobile } from '#/hooks/use-mobile'
import { cn } from '#/lib/utils'

export interface ChildTableColumn<T> {
  id: string
  header: string
  width?: string
  align?: 'left' | 'center' | 'right'
  renderCell: (
    row: T,
    index: number,
    updateField: <TKey extends keyof T>(field: TKey, value: T[TKey]) => void,
  ) => React.ReactNode
}

export interface ChildTableProps<T> {
  columns: ChildTableColumn<T>[]
  data: T[]
  onRowAdd?: () => void
  onRowDelete?: (index: number) => void
  onRowChange?: (index: number, updated: T) => void
  addButtonLabel?: string
  renderFooter?: () => React.ReactNode
  renderMobileCard?: (
    row: T,
    index: number,
    onDelete?: () => void,
    updateField?: <TKey extends keyof T>(field: TKey, value: T[TKey]) => void,
  ) => React.ReactNode
  emptyMessage?: string
  readOnly?: boolean
  maxHeight?: string
  className?: string
}

/**
 * Frappe-style ChildTable for editable line items (orders, dealer item prices, vouchers).
 * Renders an inline grid on desktop and responsive cards on mobile.
 */
export function ChildTable<T extends Record<string, unknown>>({
  columns,
  data,
  onRowAdd,
  onRowDelete,
  onRowChange,
  addButtonLabel = 'Add row',
  renderFooter,
  renderMobileCard,
  emptyMessage = 'No items added yet.',
  readOnly = false,
  maxHeight,
  className,
}: ChildTableProps<T>) {
  const isMobile = useIsMobile()

  const handleFieldChange = (index: number, field: keyof T, val: unknown) => {
    if (!onRowChange) return
    const current = data[index]
    onRowChange(index, { ...current, [field]: val })
  }

  // Mobile layout: Stacked cards
  if (isMobile) {
    return (
      <div className={cn('space-y-3', className)}>
        {data.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          data.map((row, idx) => {
            if (renderMobileCard) {
              return renderMobileCard(
                row,
                idx,
                !readOnly && onRowDelete ? () => onRowDelete(idx) : undefined,
                (f, v) => handleFieldChange(idx, f, v),
              )
            }
            return (
              <Card
                key={idx}
                className="relative p-3 text-xs border border-border"
              >
                <CardContent className="p-0 space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground text-[10px]">
                      Row #{idx + 1}
                    </span>
                    {!readOnly && onRowDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                        onClick={() => onRowDelete(idx)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {columns.map((col) => (
                      <div key={col.id} className="flex flex-col gap-1">
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {col.header}
                        </span>
                        <div>
                          {col.renderCell(row, idx, (f, v) =>
                            handleFieldChange(idx, f, v),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}

        {!readOnly && onRowAdd && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRowAdd}
            className="w-full text-xs gap-1.5 border-dashed"
          >
            <Plus className="size-3.5" />
            {addButtonLabel}
          </Button>
        )}

        {renderFooter && <div className="pt-2">{renderFooter()}</div>}
      </div>
    )
  }

  // Desktop layout: Compact table
  return (
    <div className={cn('space-y-2', className)}>
      <div
        className="rounded-md border border-border overflow-auto click-scroll shadow-xs"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <Table className="min-w-full">
          <TableHeader className="bg-card sticky top-0 z-10 border-b border-border shadow-[0_1px_0_0_var(--color-border)]">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 text-center text-[11px] font-medium text-muted-foreground">
                #
              </TableHead>
              {columns.map((col) => (
                <TableHead
                  key={col.id}
                  style={{ width: col.width }}
                  className={cn(
                    'text-[11px] font-medium text-muted-foreground',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
              {!readOnly && onRowDelete && (
                <TableHead className="w-10 text-right text-[11px] font-medium text-muted-foreground" />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (!readOnly && onRowDelete ? 2 : 1)}
                  className="h-24 text-center text-xs text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, idx) => (
                <TableRow key={idx} className="hover:bg-muted/20">
                  <TableCell className="text-center font-mono text-[11px] text-muted-foreground py-2">
                    {idx + 1}
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell
                      key={col.id}
                      className={cn(
                        'py-2 text-xs',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                      )}
                    >
                      {col.renderCell(row, idx, (f, v) =>
                        handleFieldChange(idx, f, v),
                      )}
                    </TableCell>
                  ))}
                  {!readOnly && onRowDelete && (
                    <TableCell className="text-right py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                        onClick={() => onRowDelete(idx)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
          {renderFooter && (
            <TableFooter className="bg-muted/20 border-t border-border">
              {renderFooter()}
            </TableFooter>
          )}
        </Table>
      </div>

      {!readOnly && onRowAdd && (
        <div className="flex justify-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRowAdd}
            className="text-xs h-8 gap-1.5 border-dashed"
          >
            <Plus className="size-3.5" />
            {addButtonLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
