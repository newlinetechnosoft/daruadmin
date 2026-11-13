import * as React from 'react'
import type {
  ColumnDef,
  SortingState,
  VisibilityState,
  ColumnFiltersState,
} from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
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
import { Input } from '#/components/ui/input'
import { Pagination } from '#/components/shared/pagination'
import { Skeleton } from '#/components/ui/skeleton'
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react'
import { cn } from '#/lib/utils'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  filterSlot?: React.ReactNode
  actionSlot?: React.ReactNode
  footerSlot?: React.ReactNode
  page?: number
  pages?: number
  onPage?: (page: number) => void
  isLoading?: boolean
  emptyMessage?: string
  className?: string
  dense?: boolean
  stickyHeader?: boolean
  initialSorting?: SortingState
  onRowClick?: (row: TData) => void
  rowClassName?: (row: TData) => string | undefined
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  filterSlot,
  actionSlot,
  footerSlot,
  page,
  pages,
  onPage,
  isLoading = false,
  emptyMessage = 'No results found.',
  className,
  dense = false,
  stickyHeader = false,
  initialSorting = [],
  onRowClick,
  rowClassName,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  })

  return (
    <div className={cn('space-y-3', className)}>
      {(searchKey || onSearchChange || filterSlot || actionSlot) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {(searchKey || onSearchChange) && (
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder={searchPlaceholder}
                  value={
                    onSearchChange
                      ? (searchValue ?? '')
                      : ((table.getColumn(searchKey ?? '')?.getFilterValue() as
                          string | undefined) ?? '')
                  }
                  onChange={(event) => {
                    if (onSearchChange) {
                      onSearchChange(event.target.value)
                    } else if (searchKey) {
                      table
                        .getColumn(searchKey)
                        ?.setFilterValue(event.target.value)
                    }
                  }}
                  className="h-9 pl-8 text-xs"
                />
              </div>
            )}
            {filterSlot}
          </div>
          {actionSlot && (
            <div className="flex items-center gap-2 shrink-0">{actionSlot}</div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader
            className={cn(
              'bg-muted/40 border-b border-border',
              stickyHeader && 'sticky top-0 z-10',
            )}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="hover:bg-transparent border-border"
              >
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sortDirection = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        'text-xs font-medium text-muted-foreground',
                        dense ? 'h-9 px-3' : 'h-10 px-4',
                        canSort && 'cursor-pointer select-none',
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder ? null : (
                        <span className="inline-flex items-center gap-1">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {canSort &&
                            (sortDirection === 'asc' ? (
                              <ArrowUp className="h-3 w-3 text-foreground" />
                            ) : sortDirection === 'desc' ? (
                              <ArrowDown className="h-3 w-3 text-foreground" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
                            ))}
                        </span>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  {columns.map((_column, colIdx) => (
                    <TableCell
                      key={colIdx}
                      className={dense ? 'px-3 py-2' : 'px-4 py-3'}
                    >
                      <Skeleton className="h-4 w-full max-w-[120px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(
                    'border-border hover:bg-muted/50 transition-colors',
                    onRowClick && 'cursor-pointer',
                    rowClassName?.(row.original),
                  )}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        dense ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm',
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="border-border">
                <TableCell
                  colSpan={columns.length}
                  className="h-28 text-center text-xs text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {footerSlot && <TableFooter>{footerSlot}</TableFooter>}
        </Table>

        {page !== undefined && pages !== undefined && onPage && (
          <Pagination page={page} pages={pages} onPage={onPage} />
        )}
      </div>
    </div>
  )
}
