import {
  Pagination as ShadcnPagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '#/components/ui/pagination'

export function Pagination({
  page,
  pages,
  onPage,
}: {
  page: number
  pages: number
  onPage: (p: number) => void
}) {
  if (pages <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card">
      <span className="text-xs text-muted-foreground tabular-nums">
        Page {page} of {pages}
      </span>
      <ShadcnPagination className="mx-0 w-auto justify-end">
        <PaginationContent className="gap-1">
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault()
                if (page > 1) onPage(page - 1)
              }}
              className={page <= 1 ? 'pointer-events-none opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault()
                if (page < pages) onPage(page + 1)
              }}
              className={page >= pages ? 'pointer-events-none opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            />
          </PaginationItem>
        </PaginationContent>
      </ShadcnPagination>
    </div>
  )
}
