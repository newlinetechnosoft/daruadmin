# src/server/finance — Double-Entry Accounting Core & Financial Operations

> **Single Source of Truth:** For full accounting architecture, ERPNext-class guarantees, Nepal tax/legal compliance, roadmap phases, and audit findings, read [`ACCOUNT_GUIDE.md`](file:///opt/void/git-repos/daru/ACCOUNT_GUIDE.md).
> **Conventions:** [`src/server/AGENT.md`](file:///opt/void/git-repos/daru/src/server/AGENT.md) · **Database & Migrations:** [`src/db/AGENT.md`](file:///opt/void/git-repos/daru/src/db/AGENT.md) · **Helpers:** `#/lib/money`, `#/lib/tax`, `#/lib/nepal-date`.

---

## 1. Non-Negotiable Core Rules

1. **Integer Paisa Everywhere:** All currency values in the database, server functions, queries, and engine inputs are integer paisa (`1 NPR = 100 paisa`). Format into rupees strictly at the UI boundary (`formatNPR`, `<MoneyText />`).
2. **Single Posting Gateway:** All ledger mutations go exclusively through [`postJournalTx`](file:///opt/void/git-repos/daru/src/server/finance/double-entry.ts) in [`src/server/finance/double-entry.ts`](file:///opt/void/git-repos/daru/src/server/finance/double-entry.ts). No other code inserts into `journal_entries` or `journal_lines`.
3. **Transaction Safety:** Every ledger mutation runs inside `dbTx.transaction(async (tx) => ...)`. Plain reads use `db` (neon-http).
4. **Append-Only Ledger:** Submitted vouchers and lines are strictly immutable. Corrections are made via exact reversing entries ([`reverseJournalTx`](file:///opt/void/git-repos/daru/src/server/finance/double-entry.ts)), never SQL `UPDATE` or `DELETE`.
5. **Zero `any`:** All finance code uses strict TypeScript types defined in [`src/server/finance/types.ts`](file:///opt/void/git-repos/daru/src/server/finance/types.ts) (`DbTx`, `PostJournalParams`, `JournalLineInput`, etc.). Exactly 0 `any` permitted.
6. **Semantic Account Keys:** Never hard-code string literals like `'acc_1011'`. Always import and use typed [`ACCOUNT_KEYS`](file:///opt/void/git-repos/daru/src/server/finance/account-keys.ts) from [`src/server/finance/account-keys.ts`](file:///opt/void/git-repos/daru/src/server/finance/account-keys.ts).
7. **Zero Writes to Legacy Tables:** Direct writes to the legacy single-entry table `ledger_entries` are retired. Legacy rows are archived in `legacy_ledger_archive` and kept strictly read-only.
8. **Agent DB Protocol:** The database is Neon-only. Coding agents author idempotent migrations in `drizzle/` and verify on PGlite (`bun test src/db/migrations.test.ts`), but **never** run migrations or writes on Neon. The owner executes reviewed SQL in the Neon Console SQL Editor after taking a branch backup.

---

## 2. ERPNext-Grade Accounting Guarantees

| Guarantee                | Level                 | Mechanism                                                                                                                                                                                                                                                                                         |
| ------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Balanced**          | Code + DB Trigger     | `postJournalTx` asserts `Σdebit = Σcredit > 0` and lines ≥ 2. PostgreSQL deferred constraint trigger `check_journal_entry_balanced_trigger` rejects unbalanced entries at transaction commit.                                                                                                     |
| **2. Immutable**         | Code + DB Trigger     | PostgreSQL `BEFORE UPDATE OR DELETE` triggers (`prevent_journal_lines_mutation_trigger` and `prevent_journal_entries_mutation_trigger`) abort direct SQL edits/deletes on submitted rows. Only reversal linking flags (`is_reversed`, `reversed_by`, `reversal_of`, `updated_at`) may be updated. |
| **3. Idempotent**        | Code + Unique Index   | Unique index on `(ref_type, ref_id, event)` prevents duplicate postings for the same business event. Returns existing voucher with `isDuplicate: true`.                                                                                                                                           |
| **4. Gapless Sequences** | DB Row Lock           | Row-locked sequence counter (`SELECT ... FOR UPDATE` on `voucher_sequences`) guarantees strictly monotonic, gapless voucher numbers per fiscal year (e.g. `JV-2083-00001`).                                                                                                                       |
| **5. Period-Safe**       | Engine Guard          | Rejects posting into closed fiscal years (`fiscal_years.is_closed = true`). Reversals adjust posting date to today if the original period is closed.                                                                                                                                              |
| **6. Traceable**         | Engine + Audit Log    | Vouchers link to source document (`refType`, `refId`) and creator; all administrative financial mutations log before/after audit entries via `logAudit`.                                                                                                                                          |
| **7. Sub-Ledger Parity** | Queries + Audit Tools | Party-controlled accounts require `partyType` and `partyId`. Sub-ledger balances for dealers and riders tie 100% to control account balances (`src/db/tools/audit-rider-balances.ts`).                                                                                                            |

---

## 3. File Map

| Path                                                                                                                               | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/server/finance/account-keys.ts`](file:///opt/void/git-repos/daru/src/server/finance/account-keys.ts)                         | Semantic enum-like constant `ACCOUNT_KEYS` and dynamic resolver `resolveAccount` / `resolveAllAccounts` backed by `account_defaults`.                                                                                                                                                                                                                                                                                                     |
| [`src/server/finance/account-defaults.test.ts`](file:///opt/void/git-repos/daru/src/server/finance/account-defaults.test.ts)       | Unit and integration tests for `ACC-1.1` default accounts resolution, dynamic remapping of `SALES`, and mutation validation guards.                                                                                                                                                                                                                                                                                                       |
| [`src/server/finance/types.ts`](file:///opt/void/git-repos/daru/src/server/finance/types.ts)                                       | Strict TypeScript interfaces: `DbTx`, `PostJournalParams`, `JournalLineInput`, `VoucherType`, `PartyType`, `CostCenter`.                                                                                                                                                                                                                                                                                                                  |
| [`src/server/finance/double-entry.ts`](file:///opt/void/git-repos/daru/src/server/finance/double-entry.ts)                         | Double-entry posting engine, sequence allocator, and standard business posting generators (`postOrderDeliveredTx`, `postCashHandoverTx`, `postDealerSettlementTx`, `postRiderSalaryAccrualTx`, `postRiderPayoutTx`, `reverseJournalTx`).                                                                                                                                                                                                  |
| [`src/server/finance/finance.queries.ts`](file:///opt/void/git-repos/daru/src/server/finance/finance.queries.ts)                   | Read-only and transactional queries: GL report, CoA with balances, account defaults (`getAccountDefaultsQuery`, `updateAccountDefaultsQuery`), dealer payables with FIFO aging, rider sub-ledger balances, party statements with opening + running balance (`getPartyStatementQuery`), filterable GL line reader (`getGeneralLedgerEntriesQuery`), single voucher loader (`getJournalEntryByIdQuery`), cost centers, public voucher data. |
| [`src/server/finance/finance.functions.ts`](file:///opt/void/git-repos/daru/src/server/finance/finance.functions.ts)               | TanStack Start server functions (`createServerFn`) guarded by permissions for overview, manual JVs, dealer disbursements, batch settlements, handovers, account defaults, and the Accounts UI report endpoints (`getGeneralLedgerFn`, `getJournalTransactionsFn`, `getDealerPayablesSummaryFn`, `getRiderAccountsSummaryFn`, `getPartyStatementFn`, `getJournalEntryByIdFn`, `getCostCentersFn`).                                         |
| [`src/server/finance/report-math.ts`](file:///opt/void/git-repos/daru/src/server/finance/report-math.ts)                           | Pure report math with no DB/IO: `signedMovement` (debit/credit-normal running balances) and `computePayableAging` (FIFO AP aging, advance application, 0–30 / 31–60 / 61–90 / 90+ buckets).                                                                                                                                                                                                                                               |
| [`src/server/finance/report-math.test.ts`](file:///opt/void/git-repos/daru/src/server/finance/report-math.test.ts)                 | Unit tests for normal-balance movement and FIFO payable aging: oldest-first application, partial payments, advances, bucket boundaries, future dates, and empty reports.                                                                                                                                                                                                                                                                  |
| [`src/server/finance/double-entry.test.ts`](file:///opt/void/git-repos/daru/src/server/finance/double-entry.test.ts)               | Unit tests verifying core posting logic, validations, party checks, gapless sequences, and reversal hardening.                                                                                                                                                                                                                                                                                                                            |
| [`src/server/finance/db-integrity.test.ts`](file:///opt/void/git-repos/daru/src/server/finance/db-integrity.test.ts)               | Unit tests running against real PGlite verifying database-level constraint triggers, mutation blocking, and engine integration.                                                                                                                                                                                                                                                                                                           |
| [`src/server/finance/rider-payroll.test.ts`](file:///opt/void/git-repos/daru/src/server/finance/rider-payroll.test.ts)             | Unit tests verifying rider payroll runs adhere to accrued ledger balance (Option A / Guarantee #7).                                                                                                                                                                                                                                                                                                                                       |
| [`src/server/finance/legacy-ledger-guard.test.ts`](file:///opt/void/git-repos/daru/src/server/finance/legacy-ledger-guard.test.ts) | Automated codebase scanner ensuring zero writes exist to legacy single-entry `ledger_entries`.                                                                                                                                                                                                                                                                                                                                            |

---

## 4. Standard Postings & Accounting Flows

| Event                           | Voucher      | Debit Account                                    | Credit Account                                                                                             |
| ------------------------------- | ------------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Order Delivered (COD)**       | `SV`         | `RIDER_COD_CASH` (`1031`) · `DISCOUNTS` (`5112`) | `SALES` (`4010`, net of VAT) · `VAT_OUTPUT` (`2021`, 13%) · `DELIVERY_INCOME` (`4020`)                     |
| **Order Dealer Cost Accrual**   | `SV` (lines) | `COGS_LIQUOR` (`5011`) or `COGS_FOOD` (`5012`)   | `DEALER_PAYABLE` (`2011`, with dealer party)                                                               |
| **Rider Delivery Comp Accrual** | `SV` (lines) | `RIDER_EXPENSE` (`5111`)                         | `RIDER_PAYABLE` (`2031`, with rider party)                                                                 |
| **Rider Cash Handover**         | `RV`         | `CASH_IN_HAND` (`1011`)                          | `RIDER_COD_CASH` (`1031`, with rider party)                                                                |
| **Dealer Settlement Paid**      | `PV`         | `DEALER_PAYABLE` (`2011`, gross)                 | `BANK_MAIN` (`1012`)/`CASH_IN_HAND` (`1011`, net) · `TDS_PAYABLE` (`2023`, TDS)                            |
| **Rider Salary Accrual**        | `JV`         | `RIDER_EXPENSE` (`5111`)                         | `RIDER_PAYABLE` (`2031`, with rider party)                                                                 |
| **Rider Settlement Paid**       | `PV`         | `RIDER_PAYABLE` (`2031`, ledger balance)         | `CASH_IN_HAND` (`1011`)/`BANK_MAIN` (`1012`) · `RIDER_COD_CASH` (`1031`) · `STAFF_RIDER_ADVANCES` (`1042`) |
| **Voucher Reversal**            | `JV`         | Inverted lines of original voucher               | Inverted lines of original voucher                                                                         |

---

## 4a. Accounts UI Read Model (ERPNext-style tables)

The `/admin/accounts` panel is split into `tabs/*` components. Every table is
filterable, searchable, sortable, and links to its source voucher/party/account:

- **General Ledger** (`getGeneralLedgerFn` → `getGeneralLedgerEntriesQuery`):
  filters by account, root type, sub-type, party, cost center, voucher type and
  date; server-side free-text search; opening balance per account/party and a
  per-row running balance. Account and party cells drill into the ledger or the
  party report; voucher numbers open the shared voucher dialog.
- **Transactions** (`getJournalTransactionsFn`): journal-entry headers with
  voucher type, reference type, date range and free-text search. Rows open the
  voucher dialog.
- **Dealer Report** (`getDealerPayablesSummaryFn` + `getPartyStatementFn`):
  all-time dealer payable summary with FIFO AP aging (0–30 / 31–60 / 61–90 /
  90+), last activity, and a date-ranged party statement with running balance.
  Payments reduce the oldest open procurement first; an advance paid before a
  purchase offsets the next purchase. The math lives in `report-math.ts` and is
  unit-tested independently from the database.
- **Rider Report** (`getRiderAccountsSummaryFn` + `getPartyStatementFn`):
  cash on hand, undeposited COD, commission payable, advances, status/zone
  filters, and a date-ranged statement. Rider statements deliberately keep a
  separate running balance per account because COD cash and commission payable
  have opposite normal balances.
- **Sales / Salary / Chart of Accounts / Account Defaults** are read from the
  existing overview payload and remain client-filterable.

Report queries are read-only and guarded by `accounts.view`. They never mutate
the ledger and never import client-only code.

## 4b. Schema Additions (migration `0022_accounting_section_refactor.sql`)

Additive only; no existing column is dropped or renamed.

- `ledger_accounts`: `account_type`, `balance_must_be`, `is_frozen`,
  `sort_order`, `description`, plus CHECK constraints. Seeded accounts are
  backfilled from their code; owner-managed classifications are preserved.
- `cost_centers`: ERPNext-style tree (`GEN`, `LIQ`, `FOO`, `DEL`) with
  `parent_id`, `is_group`, `is_active`.
- `journal_lines.cost_center_id`: FK to `cost_centers`, keeping the legacy
  free-text `cost_center` column untouched.
- Indexes for account/date and party lookups used by GL and party statements.

The migration is idempotent and is verified by `src/db/migrations.test.ts` on
PGlite. The owner applies it in the Neon SQL Editor after a branch backup.

## 5. Permissions & Separation of Duties (ACC-0.7 / G8)

Financial mutations are strictly segregated to uphold internal controls:

| Server Function                                                                                                                                                                 | Required Permission | Manager Role | Admin Role | Purpose                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------ | ---------- | -------------------------------------------------------------------------------------------- |
| [`getAccountingOverviewFn`](file:///opt/void/git-repos/daru/src/server/finance/finance.functions.ts#L49)                                                                        | `accounts.view`     | ✅ Allowed   | ✅ Allowed | Read accounting overview, charts, and summary metrics.                                       |
| `getGeneralLedgerFn`, `getJournalTransactionsFn`, `getPartyStatementFn`, `getDealerPayablesSummaryFn`, `getRiderAccountsSummaryFn`, `getJournalEntryByIdFn`, `getCostCentersFn` | `accounts.view`     | ✅ Allowed   | ✅ Allowed | Read-only Accounts UI report data (GL, transactions, dealer/rider statements, cost centers). |
| [`getUnsettledDealerItemsFn`](file:///opt/void/git-repos/daru/src/server/finance/finance.functions.ts#L384)                                                                     | `accounts.view`     | ✅ Allowed   | ✅ Allowed | Inspect delivered order lines awaiting dealer settlement.                                    |
| [`recordManagerCashHandoverFn`](file:///opt/void/git-repos/daru/src/server/finance/finance.functions.ts#L415)                                                                   | `accounts.create`   | ✅ Allowed   | ✅ Allowed | Record physical cash handed over by delivery riders.                                         |
| [`createDealerSettlementBatchFn`](file:///opt/void/git-repos/daru/src/server/finance/finance.functions.ts#L269)                                                                 | `accounts.create`   | ✅ Allowed   | ✅ Allowed | Assemble delivered dealer items into a settlement batch draft.                               |
| [`generateMonthlyRiderPayrollRunFn`](file:///opt/void/git-repos/daru/src/server/operations/operations.functions.ts#L2547)                                                       | `accounts.create`   | ✅ Allowed   | ✅ Allowed | Generate draft payroll run pulling ledger accrued balances.                                  |
| [`postManualJournalVoucherFn`](file:///opt/void/git-repos/daru/src/server/finance/finance.functions.ts#L115)                                                                    | `accounts.approve`  | ❌ Denied    | ✅ Allowed | Post unconstrained manual journals directly into the GL.                                     |
| [`recordDealerDisbursementFn`](file:///opt/void/git-repos/daru/src/server/finance/finance.functions.ts#L178)                                                                    | `accounts.approve`  | ❌ Denied    | ✅ Allowed | Disburse money from bank/cash to settle dealer payables.                                     |
| [`approveSettlementFn`](file:///opt/void/git-repos/daru/src/server/operations/operations.functions.ts#L2437)                                                                    | `accounts.approve`  | ❌ Denied    | ✅ Allowed | Authorize and disburse rider payroll settlements.                                            |
| [`reverseJournalVoucherFn`](file:///opt/void/git-repos/daru/src/server/finance/finance.functions.ts#L490)                                                                       | `accounts.approve`  | ❌ Denied    | ✅ Allowed | Execute an exact reversal of an existing submitted journal voucher.                          |
| [`getAccountDefaultsFn`](file:///opt/void/git-repos/daru/src/server/finance/finance.functions.ts)                                                                               | `accounts.view`     | ✅ Allowed   | ✅ Allowed | View system default accounts and candidate leaf accounts.                                    |
| [`updateAccountDefaultsFn`](file:///opt/void/git-repos/daru/src/server/finance/finance.functions.ts)                                                                            | `accounts.approve`  | ❌ Denied    | ✅ Allowed | Remap default accounts for system posting rules (ACC-1.1).                                   |

---

## 6. Testing Requirements

Every modification to finance code must pass:

1. `bun test` — 100% of test suites passing across all domains.
2. `bunx tsc --noEmit` — strict typecheck with zero errors and zero `any`.
3. `bunx eslint` & `bunx prettier --check` — clean linting and formatting.
4. Schema & trigger integrity on PGlite (`src/db/migrations.test.ts` and `src/server/finance/db-integrity.test.ts`).
