import { describe, it, expect } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'

describe('ACC-0.11: Legacy ledger write guard', () => {
  it('ensures no code in src writes to legacy ledger_entries', () => {
    const srcDir = path.resolve(import.meta.dir, '../../..', 'src')
    const files: string[] = []

    function walkDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walkDir(fullPath)
        } else if (
          (entry.name.endsWith('.ts') ||
            entry.name.endsWith('.tsx') ||
            entry.name.endsWith('.js')) &&
          !entry.name.endsWith('.test.ts') &&
          !entry.name.endsWith('.test.tsx') &&
          !entry.name.endsWith('.spec.ts') &&
          !fullPath.includes('/src/db/schema/')
        ) {
          files.push(fullPath)
        }
      }
    }

    walkDir(srcDir)

    const writePatterns = [
      /\.(insert|update|delete)\s*\(\s*(ledgerEntries|ledger_entries)/,
      /insert\s+into\s+ledger_entries/i,
      /update\s+ledger_entries\s+set/i,
      /delete\s+from\s+ledger_entries/i,
    ]

    const violations: { file: string; line: number; text: string }[] = []

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      lines.forEach((lineText, idx) => {
        for (const pattern of writePatterns) {
          if (pattern.test(lineText)) {
            violations.push({
              file: path.relative(srcDir, filePath),
              line: idx + 1,
              text: lineText.trim(),
            })
          }
        }
      })
    }

    expect(violations).toEqual([])
  })
})
