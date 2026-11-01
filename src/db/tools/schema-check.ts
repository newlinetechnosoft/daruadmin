import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'

/**
 * schema-check.ts
 *
 * Applies all migrations (0000-0015) in journal order to an isolated in-memory PGlite instance,
 * then generates and prints a single SQL query to run against Neon.
 *
 * The printed query compares Neon's information_schema against the complete expected schema.
 * If the query returns 0 rows, Neon contains all expected tables and columns.
 *
 * NOTE: This tool NEVER connects to Neon or any external database.
 */

async function main() {
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle')
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json')

  if (!fs.existsSync(journalPath)) {
    console.error(`Cannot find journal at ${journalPath}`)
    process.exit(1)
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'))
  const pglite = new PGlite()

  // Apply all migrations in order
  for (const entry of journal.entries) {
    const filePath = path.join(migrationsFolder, `${entry.tag}.sql`)
    const sqlContent = fs.readFileSync(filePath, 'utf-8')
    const statements = sqlContent.split('--> statement-breakpoint')
    for (const stmt of statements) {
      const trimmed = stmt.trim()
      if (trimmed) {
        await pglite.exec(trimmed)
      }
    }
  }

  // Extract all public tables and columns created by the migrations
  const res = await pglite.query<{ table_name: string; column_name: string }>(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    ORDER BY table_name, column_name
  `)

  const valueRows = res.rows
    .map(
      (r) =>
        `    ('${r.table_name.replace(/'/g, "''")}', '${r.column_name.replace(/'/g, "''")}')`,
    )
    .join(',\n')

  const neonQuery = `-- ==============================================================================
-- NEON SCHEMA COMPLETENESS VERIFICATION QUERY
-- Generated from migration journal (0000 through ${journal.entries[journal.entries.length - 1].tag})
-- Run this query in the Neon SQL Editor.
-- Expected result: 0 rows returned (proves Neon has all tables & columns).
-- If any rows return, they represent missing (table_name, column_name) pairs.
-- ==============================================================================

WITH expected(table_name, column_name) AS (
  VALUES
${valueRows}
)
SELECT 
  e.table_name, 
  e.column_name,
  CASE 
    WHEN t.table_name IS NULL THEN 'MISSING_TABLE'
    ELSE 'MISSING_COLUMN'
  END AS missing_type
FROM expected e
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' 
 AND t.table_name = e.table_name
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' 
 AND c.table_name = e.table_name 
 AND c.column_name = e.column_name
WHERE c.column_name IS NULL
ORDER BY e.table_name, e.column_name;`

  console.log(neonQuery)
}

main().catch((err) => {
  console.error('schema-check tool error:', err)
  process.exit(1)
})
