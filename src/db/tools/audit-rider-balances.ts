/**
 * audit-rider-balances.ts (ACC-0.10)
 *
 * Precondition & Reconciliation Audit Script for Rider Compensation (G10 / Option A).
 *
 * Produces read-only SQL queries to inspect:
 * 1. Precondition check: Count of journal_lines on RIDER_PAYABLE (acc_2031) with NULL party.
 * 2. Guarantee #7 Parity: Control account balance vs sum of sub-ledger balances per rider.
 * 3. Rider-by-Rider: Accrued Ledger Payable vs Approved/Paid Settlements.
 *
 * NOTE: This tool generates read-only SQL for the owner to review and execute in Neon SQL Editor.
 */

export const RIDER_PAYABLE_AUDIT_SQL = `-- ==============================================================================
-- RIDER PAYABLE (acc_2031) RECONCILIATION & INTEGRITY AUDIT (ACC-0.10)
-- Read-only verification queries for Neon SQL Editor.
-- ==============================================================================

-- 1. Precondition Check:
-- Ensure no orphaned or corrupted journal_lines exist on RIDER_PAYABLE (acc_2031) lacking party identification.
SELECT 
  count(*) AS total_lines,
  count(CASE WHEN party_id IS NULL OR party_type IS NULL THEN 1 END) AS null_party_lines,
  count(CASE WHEN party_type != 'rider' THEN 1 END) AS non_rider_party_lines
FROM journal_lines 
WHERE account_id = 'acc_2031';

-- 2. Guarantee #7 Parity Check:
-- Assert that the control account balance on acc_2031 equals the exact sum of rider sub-ledger balances.
WITH control_acc AS (
  SELECT 
    COALESCE(SUM(credit) - SUM(debit), 0) AS control_balance
  FROM journal_lines
  WHERE account_id = 'acc_2031'
),
sub_ledger AS (
  SELECT 
    COALESCE(SUM(credit) - SUM(debit), 0) AS subledger_balance
  FROM journal_lines
  WHERE account_id = 'acc_2031' AND party_type = 'rider' AND party_id IS NOT NULL
)
SELECT 
  control_acc.control_balance,
  sub_ledger.subledger_balance,
  (control_acc.control_balance - sub_ledger.subledger_balance) AS parity_diff
FROM control_acc, sub_ledger;

-- 3. Rider-by-Rider Ledger vs Past Settlement Payouts:
-- Compares accrued double-entry credits, debited payouts, outstanding ledger balance,
-- and past settlements recorded in the settlements table.
WITH rider_ledger AS (
  SELECT 
    party_id AS rider_id,
    COALESCE(SUM(credit), 0) AS total_accrued_credit,
    COALESCE(SUM(debit), 0) AS total_payout_debit,
    COALESCE(SUM(credit) - SUM(debit), 0) AS net_ledger_balance
  FROM journal_lines
  WHERE account_id = 'acc_2031' AND party_type = 'rider'
  GROUP BY party_id
),
rider_settlements AS (
  SELECT 
    rider_id,
    COALESCE(SUM(CASE WHEN status = 'paid' THEN gross_earnings ELSE 0 END), 0) AS total_paid_settlements,
    COALESCE(SUM(CASE WHEN status = 'draft' THEN gross_earnings ELSE 0 END), 0) AS total_draft_settlements
  FROM settlements
  GROUP BY rider_id
)
SELECT 
  r.id AS rider_id,
  r.name AS rider_name,
  COALESCE(rl.total_accrued_credit, 0) AS total_accrued_credit,
  COALESCE(rl.total_payout_debit, 0) AS total_payout_debit,
  COALESCE(rl.net_ledger_balance, 0) AS net_ledger_balance,
  COALESCE(rs.total_paid_settlements, 0) AS total_paid_settlements,
  COALESCE(rs.total_draft_settlements, 0) AS total_draft_settlements,
  (COALESCE(rl.total_payout_debit, 0) - COALESCE(rs.total_paid_settlements, 0)) AS payout_ledger_diff
FROM riders r
LEFT JOIN rider_ledger rl ON r.id = rl.rider_id
LEFT JOIN rider_settlements rs ON r.id = rs.rider_id
ORDER BY r.name;
`

function main() {
  console.log(RIDER_PAYABLE_AUDIT_SQL)
}

if (import.meta.main) {
  main()
}
