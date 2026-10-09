export function paginate<T>(items: T[], page: number, size = 10) {
  const pages = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(Math.max(1, page), pages)
  const start = (current - 1) * size
  return {
    rows: items.slice(start, start + size),
    page: current,
    pages,
    total: items.length,
  }
}
