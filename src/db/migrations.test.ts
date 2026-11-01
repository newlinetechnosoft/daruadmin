import { describe, expect, it } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'
import * as schema from '#/db/schema'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { is } from 'drizzle-orm'

describe('Database Migration Journal & Schema Integrity (INFRA-2)', () => {
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle')
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json')

  it('ensures every .sql file is registered in _journal.json and vice versa', () => {
    expect(fs.existsSync(journalPath)).toBe(true)
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'))
    const journalTags = new Set(
      journal.entries.map((e: { tag: string }) => e.tag),
    )

    const sqlFiles = fs
      .readdirSync(migrationsFolder)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => f.replace(/\.sql$/, ''))

    const sqlFileSet = new Set(sqlFiles)

    // Check bidirectional equivalence
    expect(journalTags).toEqual(sqlFileSet)
    expect(journal.entries.length).toBe(sqlFiles.length)
  })

  it('ensures journal "when" timestamps are strictly increasing and valid', () => {
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'))
    const entries = journal.entries as Array<{
      idx: number
      when: number
      tag: string
    }>

    for (let i = 0; i < entries.length; i++) {
      expect(entries[i].idx).toBe(i)
      expect(entries[i].when).toBeGreaterThan(0)

      if (i > 0) {
        expect(entries[i].when).toBeGreaterThan(entries[i - 1].when)
      }
    }
  })

  it('applies all migration files in journal order without error, and covers all Drizzle schema tables and columns', async () => {
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'))
    const pglite = new PGlite()

    // 1. Apply each migration statement-by-statement
    for (const entry of journal.entries) {
      const filePath = path.join(migrationsFolder, `${entry.tag}.sql`)
      const sqlContent = fs.readFileSync(filePath, 'utf-8')
      const statements = sqlContent.split('--> statement-breakpoint')

      for (const stmt of statements) {
        const trimmed = stmt.trim()
        if (trimmed) {
          try {
            await pglite.exec(trimmed)
          } catch (err) {
            throw new Error(
              `Migration ${entry.tag} failed on statement:\n${trimmed}\nError: ${err}`,
            )
          }
        }
      }
    }

    // 2. Query columns created in PGlite
    const res = await pglite.query<{
      table_name: string
      column_name: string
    }>(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
    `)

    const dbColumnSet = new Set(
      res.rows.map((r) => `${r.table_name}.${r.column_name}`),
    )

    // 3. Inspect every Drizzle table via getTableConfig
    const missingColumns: string[] = []
    let inspectedTableCount = 0

    for (const val of Object.values(schema)) {
      if (is(val, PgTable)) {
        inspectedTableCount++
        const config = getTableConfig(val)
        for (const col of config.columns) {
          const colKey = `${config.name}.${col.name}`
          if (!dbColumnSet.has(colKey)) {
            missingColumns.push(colKey)
          }
        }
      }
    }

    expect(inspectedTableCount).toBeGreaterThan(20)
    expect(missingColumns).toEqual([])
  }, 30000)
})
