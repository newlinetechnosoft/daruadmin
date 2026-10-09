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
    <div className="flex items-center justify-end gap-2 px-4 py-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium disabled:opacity-40"
      >
        Previous
      </button>
      <span className="text-xs text-slate-500">
        {page} / {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium disabled:opacity-40"
      >
        Next
      </button>
    </div>
  )
}
