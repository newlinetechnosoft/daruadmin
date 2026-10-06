# src/server/finance — ledger, VAT, invoices, settlements, payments, reports

**Read when:** ledger/accounting, VAT, invoices, rider cash, dealer settlement, eSewa/payments, financial reports.
**Conventions:** `src/server/AGENT.md` · **Helpers:** `#/lib/money`, `#/lib/tax` (`src/lib/AGENT.md`).

## Money & VAT
- Integer **paisa** everywhere. **Assumption:** displayed prices are **VAT-inclusive**; VAT = `total × rate / (100 + rate)`, default **13%** (configurable in `site_settings`). Excise assumed inside price. **Confirm with the owner's accountant.**
- Invoices: sequential `invoice_no`, store PAN/VAT no., optional buyer PAN, per-line taxable amount + VAT + total, printable view.

## Double-entry ledger
Tables: `ledger_accounts` (code, name, type asset/liability/equity/income/expense, optional `ownerType/ownerId` for per-rider and per-dealer sub-accounts), `ledger_transactions` (date, description, `refType/refId`, `createdBy`, `reversalOf?`), `ledger_entries` (`accountId`, `debit`, `credit`).
- Debits **must equal** credits per transaction (enforce in code; add a DB check if possible).
- **Append-only.** Corrections = a new reversing transaction (`reverseTransaction`, admin only).
- Post only through `finance/post.ts` (`postTransaction(tx, {...})`) inside the caller's `dbTx` transaction.

| Event | Debit | Credit |
|---|---|---|
| Order delivered (COD) | Rider Cash Holding (asset) — total | Sales (income) — net; VAT Payable (liability) — VAT |
| Order delivered (cost from dealer) | Cost of Goods Sold | Dealer Payable (liability) |
| Rider hands cash to manager | Cash in Hand | Rider Cash Holding |
| Dealer settlement paid | Dealer Payable | Cash in Hand / Bank |
| Cancel/refund after delivery | Reverse the original entries | |
| Expense | Expense account | Cash / Bank |

## Cash & settlement flow
- `cash_collections` row per delivered COD order (rider, amount, `heldAt`, `handedOverAt`, `receivedBy`). Manager records handover → ledger posts.
- Dealer settlement: manager creates `dealer_settlement` for a dealer + period (lists delivered, not-yet-settled orders → `dealer_settlement_items`) → records payment → ledger posts → items marked settled.

## Payments / eSewa (Phase 6)
COD is the only live method. `payments` table is provider-agnostic. Gateway config (merchant code/secret, test/live, active) is edited by admin in settings (`platform/AGENT.md`), secrets **encrypted** (`#/lib/crypto`) and masked in API responses. **Always verify the payment server-side** (callback + status check, idempotent) before marking `paid`. Webhook route: `src/routes/api/webhooks/esewa.ts`.

## Functions
| Function | Roles | Purpose | Status |
|---|---|---|---|
| `recordCashHandover` | admin, manager | Rider → manager cash + ledger | ⬜ |
| `createDealerSettlement`, `recordSettlementPayment`, `listSettlements` | admin, manager | Dealer settlement | ⬜ |
| `listLedgerAccounts`, `getAccountStatement` | admin (manager limited) | Ledger read | ⬜ |
| `postManualJournal`, `reverseTransaction` | admin | Manual accounting | ⬜ |
| `recordExpense` | admin, manager | Expenses | ⬜ |
| `getInvoice`, `listInvoices` | admin, manager | Invoices | ⬜ |
| `reportSales`, `reportVat`, `reportProfit`, `reportStockValuation` | admin | Financial reports (date range, CSV export) | ⬜ |
| `reportDealerSettlement`, `reportRiderCash`, `reportOrders` | admin, manager | Operational reports | ⬜ |
| internal: `postOrderDelivered`, `postCashHandover` | (called by orders) | Standard postings | ⬜ |
| future: `initiateEsewaPayment`, `verifyEsewaPayment` | customer / webhook | Online payment | ⬜ |

## Assumptions to confirm
- VAT-inclusive pricing @13%; any additional duties on invoices.
- Chart of accounts codes (create seed with the standard accounts above).

## Status: ⬜ not started
