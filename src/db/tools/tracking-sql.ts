import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/**
 * tracking-sql.ts
 *
 * Generates the corrective transaction SQL to run in the Neon SQL Editor to fix
 * the migration tracking table `drizzle.__drizzle_migrations`.
 *
 * It:
 * 1. Removes the malformed row 8 ('0007_double_entry_accounting' with timestamp 1792148989282).
 * 2. Leaves rows 1-7 untouched (which match migrations 0000-0006 with 100% fidelity).
 * 3. Inserts the valid rows for migrations 0007-0017 with their real SHA-256 hashes
 *    and exact journal `when` timestamps.
 * 4. Selects all rows to verify.
 *
 * NOTE: This tool NEVER connects to Neon or any external database.
 */

function main() {
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle')
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json')

  if (!fs.existsSync(journalPath)) {
    console.error(`Cannot find journal at ${journalPath}`)
    process.exit(1)
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'))
  // Filter entries from 0007 onwards (idx >= 7)
  const targetEntries = journal.entries.filter(
    (e: { idx: number }) => e.idx >= 7,
  )

  const insertValues = targetEntries.map(
    (e: { tag: string; when: number }, idx: number) => {
      const filePath = path.join(migrationsFolder, `${e.tag}.sql`)
      const content = fs.readFileSync(filePath, 'utf-8')
      const hash = crypto.createHash('sha256').update(content).digest('hex')
      const isLast = idx === targetEntries.length - 1
      const terminator = isLast ? ';' : ','
      return `  ('${hash}', ${e.when})${terminator} /* ${e.tag} */`
    },
  )

  const sql = `-- ==============================================================================
-- NEON MIGRATION TRACKING REPAIR TRANSACTION
-- Run this in the Neon SQL Editor for your branch.
-- This aligns drizzle.__drizzle_migrations with drizzle/meta/_journal.json
-- ==============================================================================

BEGIN;

-- 1. Remove the malformed entry 8 that had tag name instead of hash and bad timestamp
DELETE FROM drizzle.__drizzle_migrations 
WHERE id = 8 AND hash = '0007_double_entry_accounting';

-- 2. Insert tracking records for migrations 0007 through 0017
-- Note: id is serial, so new rows will receive sequential IDs starting after 8.
INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at")
VALUES
${insertValues.join('\n')}

-- 3. Verification query: display all migration records
SELECT 
  id, 
  hash, 
  created_at, 
  to_timestamp(created_at / 1000) AS migration_timestamp
FROM drizzle.__drizzle_migrations 
ORDER BY id ASC;

COMMIT;
`

  console.log(sql)
}

main()
