import { beforeAll, describe, expect, it } from 'bun:test'
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'
import { drizzle } from 'drizzle-orm/pglite'
import * as schema from '#/db/schema'
import { postJournalTx, reverseJournalTx } from './double-entry'
import { ACCOUNT_KEYS } from './account-keys'
import type { DbTx } from './types'

describe('Database-Level Accounting Integrity Triggers (ACC-0.5 / G3)', () => {
  let pglite: PGlite
  let db: ReturnType<typeof drizzle<typeof schema>>

  beforeAll(async () => {
    pglite = new PGlite()
    db = drizzle(pglite, { schema })

    const migrationsFolder = path.resolve(process.cwd(), 'drizzle')
    const journalPath = path.join(migrationsFolder, 'meta', '_journal.json')
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'))

    // Apply all migrations (0000 through 0017) in sequence
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
  })

  describe('1. Deferred Constraint Trigger: Σdebit = Σcredit (check_journal_entry_balanced_trigger)', () => {
    it('accepts balanced entries with multiple lines at commit', async () => {
      await pglite.exec(`
        BEGIN;
        INSERT INTO journal_entries (id, voucher_no, voucher_type, fiscal_year_id, posting_date, narration, posting_status, created_by)
        VALUES ('entry_bal_1', 'JV-2083-00010', 'JV', 'fy-2083-84', NOW(), 'Balanced 2-line test', 'submitted', 'usr_test');

        INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, party_type, party_id)
        VALUES ('line_bal_1_1', 'entry_bal_1', '${ACCOUNT_KEYS.CASH_IN_HAND}', 25000, 0, NULL, NULL);

        INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, party_type, party_id)
        VALUES ('line_bal_1_2', 'entry_bal_1', '${ACCOUNT_KEYS.SALES}', 0, 25000, NULL, NULL);
        COMMIT;
      `)

      const res = await pglite.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM journal_lines WHERE journal_entry_id = 'entry_bal_1';`,
      )
      expect(Number(res.rows[0].count)).toBe(2)
    })

    it('accepts compound multi-line balanced entries (1 debit, 2 credits)', async () => {
      await pglite.exec(`
        BEGIN;
        INSERT INTO journal_entries (id, voucher_no, voucher_type, fiscal_year_id, posting_date, narration, posting_status, created_by)
        VALUES ('entry_bal_comp', 'JV-2083-00011', 'JV', 'fy-2083-84', NOW(), 'Balanced compound test', 'submitted', 'usr_test');

        INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, party_type, party_id)
        VALUES ('line_comp_1', 'entry_bal_comp', '${ACCOUNT_KEYS.CASH_IN_HAND}', 11300, 0, NULL, NULL);

        INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, party_type, party_id)
        VALUES ('line_comp_2', 'entry_bal_comp', '${ACCOUNT_KEYS.SALES}', 0, 10000, NULL, NULL);

        INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, party_type, party_id)
        VALUES ('line_comp_3', 'entry_bal_comp', '${ACCOUNT_KEYS.VAT_OUTPUT}', 0, 1300, NULL, NULL);
        COMMIT;
      `)

      const res = await pglite.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM journal_lines WHERE journal_entry_id = 'entry_bal_comp';`,
      )
      expect(Number(res.rows[0].count)).toBe(3)
    })

    it('rejects unbalanced entries at commit time', async () => {
      let rejected = false
      let errMsg = ''
      try {
        await pglite.exec(`
          BEGIN;
          INSERT INTO journal_entries (id, voucher_no, voucher_type, fiscal_year_id, posting_date, narration, posting_status, created_by)
          VALUES ('entry_unbal', 'JV-2083-00012', 'JV', 'fy-2083-84', NOW(), 'Unbalanced test', 'submitted', 'usr_test');

          INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, party_type, party_id)
          VALUES ('line_unbal_1', 'entry_unbal', '${ACCOUNT_KEYS.CASH_IN_HAND}', 10000, 0, NULL, NULL);

          INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, party_type, party_id)
          VALUES ('line_unbal_2', 'entry_unbal', '${ACCOUNT_KEYS.SALES}', 0, 9000, NULL, NULL);
          COMMIT;
        `)
      } catch (err: any) {
        rejected = true
        errMsg = err.message
      }
      expect(rejected).toBe(true)
      expect(errMsg).toContain('is unbalanced')
      expect(errMsg).toContain('total debit (10000) <> total credit (9000)')
    })

    it('rejects single-line entries at commit time (line count < 2)', async () => {
      let rejected = false
      let errMsg = ''
      try {
        await pglite.exec(`
          BEGIN;
          INSERT INTO journal_entries (id, voucher_no, voucher_type, fiscal_year_id, posting_date, narration, posting_status, created_by)
          VALUES ('entry_single', 'JV-2083-00013', 'JV', 'fy-2083-84', NOW(), 'Single line test', 'submitted', 'usr_test');

          INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, party_type, party_id)
          VALUES ('line_single_1', 'entry_single', '${ACCOUNT_KEYS.CASH_IN_HAND}', 10000, 0, NULL, NULL);
          COMMIT;
        `)
      } catch (err: any) {
        rejected = true
        errMsg = err.message
      }
      expect(rejected).toBe(true)
      expect(errMsg).toContain('must have at least 2 lines')
    })

    it('rejects empty submitted entries at commit time (line count = 0)', async () => {
      let rejected = false
      let errMsg = ''
      try {
        await pglite.exec(`
          BEGIN;
          INSERT INTO journal_entries (id, voucher_no, voucher_type, fiscal_year_id, posting_date, narration, posting_status, created_by)
          VALUES ('entry_empty', 'JV-2083-00014', 'JV', 'fy-2083-84', NOW(), 'Empty entry test', 'submitted', 'usr_test');
          COMMIT;
        `)
      } catch (err: any) {
        rejected = true
        errMsg = err.message
      }
      expect(rejected).toBe(true)
      expect(errMsg).toContain('must have at least 2 lines (found 0)')
    })
  })

  describe('2. Immutability on journal_lines (prevent_journal_lines_mutation_trigger)', () => {
    it('blocks direct SQL UPDATE on lines of a submitted entry', async () => {
      let rejected = false
      let errMsg = ''
      try {
        await pglite.exec(
          `UPDATE journal_lines SET debit = 99999 WHERE id = 'line_bal_1_1';`,
        )
      } catch (err: any) {
        rejected = true
        errMsg = err.message
      }
      expect(rejected).toBe(true)
      expect(errMsg).toContain(
        'Mutation not allowed: journal lines for submitted entry entry_bal_1 are immutable (UPDATE)',
      )
    })

    it('blocks direct SQL DELETE on lines of a submitted entry', async () => {
      let rejected = false
      let errMsg = ''
      try {
        await pglite.exec(
          `DELETE FROM journal_lines WHERE id = 'line_bal_1_2';`,
        )
      } catch (err: any) {
        rejected = true
        errMsg = err.message
      }
      expect(rejected).toBe(true)
      expect(errMsg).toContain(
        'Mutation not allowed: journal lines for submitted entry entry_bal_1 are immutable (DELETE)',
      )
    })
  })

  describe('3. Immutability on journal_entries (prevent_journal_entries_mutation_trigger)', () => {
    it('blocks direct SQL DELETE on a submitted journal entry', async () => {
      let rejected = false
      let errMsg = ''
      try {
        await pglite.exec(
          `DELETE FROM journal_entries WHERE id = 'entry_bal_1';`,
        )
      } catch (err: any) {
        rejected = true
        errMsg = err.message
      }
      expect(rejected).toBe(true)
      expect(errMsg).toContain(
        'Deletion not allowed: submitted journal entry entry_bal_1 is immutable',
      )
    })

    it('blocks direct SQL UPDATE on core fields of a submitted journal entry', async () => {
      const coreFieldsToTest: Array<{ col: string; val: string }> = [
        { col: 'voucher_no', val: "'JV-2083-HACKED'" },
        { col: 'voucher_type', val: "'PV'" },
        { col: 'posting_date', val: "'2020-01-01 00:00:00+00'" },
        { col: 'narration', val: "'Tampered narration'" },
        { col: 'ref_type', val: "'hacked'" },
        { col: 'ref_id', val: "'hacked_id'" },
        { col: 'event', val: "'hacked_event'" },
        { col: 'posting_status', val: "'cancelled'" },
        { col: 'created_by', val: "'hacker'" },
      ]

      for (const field of coreFieldsToTest) {
        let rejected = false
        try {
          await pglite.exec(
            `UPDATE journal_entries SET ${field.col} = ${field.val} WHERE id = 'entry_bal_1';`,
          )
        } catch (err: any) {
          rejected = true
          expect(err.message).toContain(
            'Mutation not allowed: submitted journal entry entry_bal_1 fields are immutable',
          )
        }
        expect(rejected).toBe(true)
      }
    })

    it('allows updating reversal link flags (is_reversed, reversed_by, reversal_of, updated_at)', async () => {
      // First insert another valid entry to serve as the reversal entry
      await pglite.exec(`
        BEGIN;
        INSERT INTO journal_entries (id, voucher_no, voucher_type, fiscal_year_id, posting_date, narration, posting_status, created_by)
        VALUES ('entry_rev_target', 'JV-2083-00015', 'JV', 'fy-2083-84', NOW(), 'Reversing entry', 'submitted', 'usr_test');

        INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, party_type, party_id)
        VALUES ('line_rev_1', 'entry_rev_target', '${ACCOUNT_KEYS.CASH_IN_HAND}', 0, 25000, NULL, NULL);

        INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, party_type, party_id)
        VALUES ('line_rev_2', 'entry_rev_target', '${ACCOUNT_KEYS.SALES}', 25000, 0, NULL, NULL);
        COMMIT;
      `)

      // Now link them: mark original as reversed by entry_rev_target, and set reversal_of on entry_rev_target
      await pglite.exec(`
        UPDATE journal_entries
        SET is_reversed = true, reversed_by = 'entry_rev_target', updated_at = NOW()
        WHERE id = 'entry_bal_1';

        UPDATE journal_entries
        SET reversal_of = 'entry_bal_1', updated_at = NOW()
        WHERE id = 'entry_rev_target';
      `)

      const orig = await pglite.query<{
        is_reversed: boolean
        reversed_by: string
      }>(
        `SELECT is_reversed, reversed_by FROM journal_entries WHERE id = 'entry_bal_1';`,
      )
      expect(orig.rows[0].is_reversed).toBe(true)
      expect(orig.rows[0].reversed_by).toBe('entry_rev_target')

      const rev = await pglite.query<{ reversal_of: string }>(
        `SELECT reversal_of FROM journal_entries WHERE id = 'entry_rev_target';`,
      )
      expect(rev.rows[0].reversal_of).toBe('entry_bal_1')
    })

    it('blocks un-reversing an already-reversed entry', async () => {
      let rejected = false
      let errMsg = ''
      try {
        await pglite.exec(
          `UPDATE journal_entries SET is_reversed = false WHERE id = 'entry_bal_1';`,
        )
      } catch (err: any) {
        rejected = true
        errMsg = err.message
      }
      expect(rejected).toBe(true)
      expect(errMsg).toContain(
        'Mutation not allowed: cannot un-reverse journal entry entry_bal_1',
      )
    })

    it('blocks modifying reversed_by once set', async () => {
      let rejected = false
      let errMsg = ''
      try {
        await pglite.exec(
          `UPDATE journal_entries SET reversed_by = 'another_entry' WHERE id = 'entry_bal_1';`,
        )
      } catch (err: any) {
        rejected = true
        errMsg = err.message
      }
      expect(rejected).toBe(true)
      expect(errMsg).toContain(
        'Mutation not allowed: cannot change reversed_by on journal entry entry_bal_1',
      )
    })

    it('blocks modifying reversal_of once set', async () => {
      let rejected = false
      let errMsg = ''
      try {
        await pglite.exec(
          `UPDATE journal_entries SET reversal_of = 'another_entry' WHERE id = 'entry_rev_target';`,
        )
      } catch (err: any) {
        rejected = true
        errMsg = err.message
      }
      expect(rejected).toBe(true)
      expect(errMsg).toContain(
        'Mutation not allowed: cannot change reversal_of on journal entry entry_rev_target',
      )
    })
  })

  describe('4. Posting Engine End-to-End Compatibility (postJournalTx & reverseJournalTx)', () => {
    it('successfully posts a voucher through postJournalTx against real triggers in PGlite', async () => {
      let postResult: any
      await db.transaction(async (tx) => {
        postResult = await postJournalTx(tx as unknown as DbTx, {
          voucherType: 'JV',
          narration: 'PGlite posting engine integration test',
          createdBy: 'usr_admin',
          lines: [
            {
              accountId: ACCOUNT_KEYS.CASH_IN_HAND,
              debit: 75000,
              credit: 0,
            },
            {
              accountId: ACCOUNT_KEYS.SALES,
              debit: 0,
              credit: 75000,
            },
          ],
        })
      })

      expect(postResult).toBeDefined()
      expect(postResult.journalEntryId).toBeDefined()
      expect(postResult.voucherNo).toMatch(/^JV-2083-\d{5}$/)

      // Verify row in database
      const rows = await pglite.query<{
        voucher_no: string
        posting_status: string
      }>(
        `SELECT voucher_no, posting_status FROM journal_entries WHERE id = '${postResult.journalEntryId}';`,
      )
      expect(rows.rows.length).toBe(1)
      expect(rows.rows[0].voucher_no).toBe(postResult.voucherNo)
      expect(rows.rows[0].posting_status).toBe('submitted')
    })

    it('successfully reverses a voucher through reverseJournalTx against real triggers in PGlite', async () => {
      // 1. Post original voucher
      let originalPost: any
      await db.transaction(async (tx) => {
        originalPost = await postJournalTx(tx as unknown as DbTx, {
          voucherType: 'JV',
          narration: 'Original voucher for reverseJournalTx integration test',
          createdBy: 'usr_admin',
          lines: [
            {
              accountId: ACCOUNT_KEYS.CASH_IN_HAND,
              debit: 42000,
              credit: 0,
            },
            {
              accountId: ACCOUNT_KEYS.SALES,
              debit: 0,
              credit: 42000,
            },
          ],
        })
      })

      // 2. Reverse original voucher
      let revResult: any
      await db.transaction(async (tx) => {
        revResult = await reverseJournalTx(tx as unknown as DbTx, {
          originalEntryId: originalPost.journalEntryId,
          narration: 'Reversal test via reverseJournalTx',
          createdBy: 'usr_admin',
        })
      })

      expect(revResult).toBeDefined()
      expect(revResult.journalEntryId).toBeDefined()

      // 3. Verify original entry has is_reversed = true and reversed_by set
      const origRows = await pglite.query<{
        is_reversed: boolean
        reversed_by: string
      }>(
        `SELECT is_reversed, reversed_by FROM journal_entries WHERE id = '${originalPost.journalEntryId}';`,
      )
      expect(origRows.rows[0].is_reversed).toBe(true)
      expect(origRows.rows[0].reversed_by).toBe(revResult.journalEntryId)

      // 4. Verify reversing entry has reversal_of set
      const revRows = await pglite.query<{
        reversal_of: string
        is_reversed: boolean
      }>(
        `SELECT reversal_of, is_reversed FROM journal_entries WHERE id = '${revResult.journalEntryId}';`,
      )
      expect(revRows.rows[0].reversal_of).toBe(originalPost.journalEntryId)
      expect(revRows.rows[0].is_reversed).toBe(false)

      // 5. Verify net sum of all lines between original and reversal is exactly 0
      const netSum = await pglite.query<{
        net_cash: string
        net_sales: string
      }>(`
        SELECT 
          SUM(CASE WHEN account_id = '${ACCOUNT_KEYS.CASH_IN_HAND}' THEN debit - credit ELSE 0 END) AS net_cash,
          SUM(CASE WHEN account_id = '${ACCOUNT_KEYS.SALES}' THEN credit - debit ELSE 0 END) AS net_sales
        FROM journal_lines
        WHERE journal_entry_id IN ('${originalPost.journalEntryId}', '${revResult.journalEntryId}');
      `)
      expect(Number(netSum.rows[0].net_cash)).toBe(0)
      expect(Number(netSum.rows[0].net_sales)).toBe(0)
    })
  })
})
