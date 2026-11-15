/**
 * Shared CSV Utility for Export, Download, and Bulk Import Parsing.
 * Follows RFC-4180 with UTF-8 BOM for Nepali and special character preservation.
 */

export function downloadCsvFile(filename: string, csvContent: string): void {
  // Ensure UTF-8 BOM so Excel opens text/Nepali correctly
  const fullContent = csvContent.startsWith('\uFEFF')
    ? csvContent
    : `\uFEFF${csvContent}`
  const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return ''
  let str = String(val)
  // Neutralize formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function generateCsvString<T>(
  columns: { header: string; key?: keyof T; value?: (row: T) => unknown }[],
  data: T[],
): string {
  const headerLine = columns.map((c) => escapeCsvField(c.header)).join(',')
  const rowLines = data.map((row) =>
    columns
      .map((c) => {
        const val = c.value ? c.value(row) : c.key ? row[c.key] : ''
        return escapeCsvField(val)
      })
      .join(','),
  )
  return `${headerLine}\n${rowLines.join('\n')}`
}

export interface ParsedCsvResult {
  headers: string[]
  rows: Record<string, string>[]
  errors: string[]
}

/**
 * Robust RFC-4180 compliant CSV parser with support for multi-line fields,
 * escaped quotes ("" and \"), and whitespace trimming.
 */
export function parseCsvText(rawText: string): ParsedCsvResult {
  const clean = rawText.replace(/^\uFEFF/, '').trim()
  if (!clean) {
    return { headers: [], rows: [], errors: ['CSV content is empty'] }
  }

  const lines: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let insideQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]
    const nextChar = clean[i + 1]

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"'
        i++
      } else if (char === '\\' && nextChar === '"') {
        currentField += '"'
        i++
      } else if (char === '"') {
        insideQuotes = false
      } else {
        currentField += char
      }
    } else {
      if (char === '"') {
        insideQuotes = true
      } else if (char === ',') {
        currentRow.push(currentField.trim())
        currentField = ''
      } else if (char === '\r') {
        if (nextChar === '\n') i++
        currentRow.push(currentField.trim())
        if (currentRow.some((f) => f.length > 0)) {
          lines.push(currentRow)
        }
        currentRow = []
        currentField = ''
      } else if (char === '\n') {
        currentRow.push(currentField.trim())
        if (currentRow.some((f) => f.length > 0)) {
          lines.push(currentRow)
        }
        currentRow = []
        currentField = ''
      } else {
        currentField += char
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some((f) => f.length > 0)) {
      lines.push(currentRow)
    }
  }

  if (lines.length === 0) {
    return { headers: [], rows: [], errors: ['No data rows found in CSV'] }
  }

  const rawHeaders = lines[0].map((h) => h.replace(/^["']|["']$/g, '').trim())
  const headers = rawHeaders.filter((h) => h.length > 0)

  if (headers.length === 0) {
    return { headers: [], rows: [], errors: ['No valid column headers found'] }
  }

  const rows: Record<string, string>[] = []
  const parseErrors: string[] = []

  for (let r = 1; r < lines.length; r++) {
    const rowValues = lines[r]
    // Skip empty lines or commented lines starting with #
    if (rowValues.length === 0 || (rowValues[0] && rowValues[0].startsWith('#'))) {
      continue
    }

    const rowObj: Record<string, string> = {}
    for (let c = 0; c < headers.length; c++) {
      const headerName = headers[c]
      rowObj[headerName] = rowValues[c] !== undefined ? rowValues[c].trim() : ''
    }
    rows.push(rowObj)
  }

  return { headers, rows, errors: parseErrors }
}
