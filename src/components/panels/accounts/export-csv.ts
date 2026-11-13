export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

function escapeCsv(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/** Export a table to CSV with a UTF-8 BOM so Excel opens Nepali text correctly. */
export function exportCsv<T>(
  filename: string,
  columns: CsvColumn<T>[],
  rows: T[],
) {
  const header = columns.map((c) => escapeCsv(c.header)).join(',')
  const body = rows
    .map((row) => columns.map((c) => escapeCsv(c.value(row))).join(','))
    .join('\n')
  const csv = `\uFEFF${header}\n${body}`

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/** Rupee value (not paisa) for CSV cells. */
export function csvRupees(paisa: number | null | undefined) {
  return ((paisa ?? 0) / 100).toFixed(2)
}

/** ISO date (yyyy-mm-dd) for CSV cells. */
export function csvDate(value: string | Date | null | undefined) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}
