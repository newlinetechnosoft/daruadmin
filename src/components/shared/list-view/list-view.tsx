import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type {
  PaginationState,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table'
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
import { Skeleton } from '#/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { useIsMobile } from '#/hooks/use-mobile'
import { cn } from '#/lib/utils'
import type { ListViewColumnDef, TableDensity } from './types'

export interface ListViewProps<TData> {
  data: TData[]
  columns: ListViewColumnDef<TData, unknown>[]
  isLoading?: boolean
  emptyMessage?: string
  emptyAction?: React.ReactNode
  density?: TableDensity
  rowIdKey?: keyof TData | ((row: TData) => string)
  renderCard?: (
    row: TData,
    index: number,
    isSelected: boolean,
  ) => React.ReactNode
  onRowClick?: (row: TData) => void
  rowSelection?: RowSelectionState
  onRowSelectionChange?: React.Dispatch<React.SetStateAction<RowSelectionState>>
  sorting?: SortingState
  onSortingChange?: React.Dispatch<React.SetStateAction<SortingState>>
  pagination?: PaginationState
  onPaginationChange?: React.Dispatch<React.SetStateAction<PaginationState>>
  pageSizeOptions?: number[]
  renderFooterTotals?: () => React.ReactNode
  className?: string
}

export function ListView<TData extends Record<string, unknown>>({
  data,
  columns,
  isLoading = false,
  emptyMessage = 'No records found.',
  emptyAction,
  density = 'comfortable',
  rowIdKey,
  renderCard,
  onRowClick,
  rowSelection: externalRowSelection,
  onRowSelectionChange: setExternalRowSelection,
  sorting: externalSorting,
  onSortingChange: setExternalSorting,
  pagination: externalPagination,
  onPaginationChange: setExternalPagination,
  pageSizeOptions = [10, 20, 50, 100],
  renderFooterTotals,
  className,
}: ListViewProps<TData>) {
  const isMobile = useIsMobile()

  // Local state fallbacks if not controlled by URL / parent
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([])
  const [internalRowSelection, setInternalRowSelection] =
    React.useState<RowSelectionState>({})
  const [internalPagination, setInternalPagination] =
    React.useState<PaginationState>({
      pageIndex: 0,
      pageSize: 20,
    })
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})

  const sorting = externalSorting ?? internalSorting
  const onSortingChange = setExternalSorting ?? setInternalSorting

  const rowSelection = externalRowSelection ?? internalRowSelection
  const onRowSelectionChange =
    setExternalRowSelection ?? setInternalRowSelection

  const pagination = externalPagination ?? internalPagination
  const onPaginationChange = setExternalPagination ?? setInternalPagination

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
      pagination,
      columnVisibility,
    },
    onSortingChange,
    onRowSelectionChange,
    onPaginationChange,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row, index) => {
      if (typeof rowIdKey === 'function') return rowIdKey(row)
      if (typeof rowIdKey === 'string' && rowIdKey in row)
        return String(row[rowIdKey])
      if ('id' in row) return String(row.id)
      return String(index)
    },
  })

  const rows = table.getRowModel().rows

  // Density padding classes
  const cellPaddingClass = density === 'compact' ? 'py-1.5 px-3' : 'py-2.5 px-3'

  return (
    <div className={cn('space-y-4', className)}>
      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : isMobile && renderCard ? (
        /* Mobile Card View (< 640px) */
        <div className="space-y-2.5">
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 p-8 text-center space-y-3">
              <p className="text-xs text-muted-foreground">{emptyMessage}</p>
              {emptyAction && <div>{emptyAction}</div>}
            </div>
          ) : (
            rows.map((row, idx) => (
              <div key={row.id}>
                {renderCard(row.original, idx, row.getIsSelected())}
              </div>
            ))
          )}
        </div>
      ) : (
        /* Standard Table View */
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40 sticky top-0 z-10 border-b border-border">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => {
                      const meta = header.column.columnDef.meta

                      // Hide column priority 2 or 3 on narrow displays via CSS
                      const priorityClasses =
                        meta?.priority === 3
                          ? 'hidden lg:table-cell'
                          : meta?.priority === 2
                            ? 'hidden sm:table-cell'
                            : ''

                      const alignClass =
                        meta?.align === 'right'
                          ? 'text-right'
                          : meta?.align === 'center'
                            ? 'text-center'
                            : 'text-left'

                      return (
                        <TableHead
                          key={header.id}
                          className={cn(
                            'text-[11px] font-medium text-muted-foreground select-none h-9 px-3',
                            alignClass,
                            priorityClasses,
                            meta?.headerClassName,
                          )}
                        >
                          {header.isPlaceholder ? null : (
                            <div
                              className={cn(
                                'flex items-center gap-1.5',
                                meta?.align === 'right' && 'justify-end',
                                meta?.align === 'center' && 'justify-center',
                                header.column.getCanSort() &&
                                  'cursor-pointer hover:text-foreground',
                              )}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                              {{
                                asc: (
                                  <ArrowUp className="size-3 text-primary" />
                                ),
                                desc: (
                                  <ArrowDown className="size-3 text-primary" />
                                ),
                              }[header.column.getIsSorted() as string] ??
                                (header.column.getCanSort() ? (
                                  <ArrowUpDown className="size-3 opacity-30 group-hover:opacity-100" />
                                ) : null)}
                            </div>
                          )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-32 text-center text-xs text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <p>{emptyMessage}</p>
                        {emptyAction && <div>{emptyAction}</div>}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                      className={cn(
                        'transition-colors hover:bg-muted/30',
                        onRowClick && 'cursor-pointer',
                      )}
                      onClick={() => onRowClick && onRowClick(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const meta = cell.column.columnDef.meta

                        const priorityClasses =
                          meta?.priority === 3
                            ? 'hidden lg:table-cell'
                            : meta?.priority === 2
                              ? 'hidden sm:table-cell'
                              : ''

                        const alignClass =
                          meta?.align === 'right'
                            ? 'text-right'
                            : meta?.align === 'center'
                              ? 'text-center'
                              : 'text-left'

                        return (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              'text-xs text-foreground',
                              cellPaddingClass,
                              alignClass,
                              priorityClasses,
                              meta?.className,
                            )}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
              {renderFooterTotals && (
                <TableFooter className="bg-muted/20 border-t border-border font-medium">
                  {renderFooterTotals()}
                </TableFooter>
              )}
            </Table>
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      {!isLoading && data.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              Showing{' '}
              <strong className="font-mono text-foreground">
                {table.getState().pagination.pageIndex *
                  table.getState().pagination.pageSize +
                  1}
              </strong>{' '}
              to{' '}
              <strong className="font-mono text-foreground">
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) *
                    table.getState().pagination.pageSize,
                  data.length,
                )}
              </strong>{' '}
              of{' '}
              <strong className="font-mono text-foreground">
                {data.length}
              </strong>{' '}
              records
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <Select
                value={String(table.getState().pagination.pageSize)}
                onValueChange={(val) => table.setPageSize(Number(val))}
              >
                <SelectTrigger className="h-7 w-[68px] text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((opt) => (
                    <SelectItem
                      key={opt}
                      value={String(opt)}
                      className="text-xs font-mono"
                    >
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-7"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                aria-label="First page"
              >
                <ChevronsLeft className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-7"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="px-2 text-xs font-mono">
                Page {table.getState().pagination.pageIndex + 1} of{' '}
                {Math.max(1, table.getPageCount())}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-7"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Next page"
              >
                <ChevronRight className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-7"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                aria-label="Last page"
              >
                <ChevronsRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
