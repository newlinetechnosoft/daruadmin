import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { orders } from './orders'
import { dealers } from './inventory'

/**
 * Nepal Fiscal Year (Shrawan 1 to Ashadh end).
 * Postings are strictly bound to an open fiscal year.
 */
export const fiscalYears = pgTable(
  'fiscal_years',
  {
    id: text('id').primaryKey(), // 'fy-2081-82', 'fy-2082-83', 'fy-2083-84'
    name: text('name').notNull().unique(), // '2081/82', '2082/83', '2083/84'
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }).notNull(),
    isClosed: boolean('is_closed').notNull().default(false),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedBy: text('closed_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('fiscal_years_dates_idx').on(table.startDate, table.endDate),
    index('fiscal_years_is_closed_idx').on(table.isClosed),
  ],
)

/**
 * Sequential voucher counter per fiscal year and voucher type.
 * Incremented via row-lock inside transaction to guarantee gapless, duplicate-free numbering.
 */
export const voucherSequences = pgTable(
  'voucher_sequences',
  {
    id: text('id').primaryKey(), // e.g. 'seq_fy-2083-84_JV'
    fiscalYearId: text('fiscal_year_id')
      .notNull()
      .references(() => fiscalYears.id, { onDelete: 'cascade' }),
    voucherType: text('voucher_type').notNull(), // 'JV', 'PV', 'RV', 'CV', 'SV'
    prefix: text('prefix').notNull().default('JV'),
    lastNo: integer('last_no').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('voucher_sequences_fy_type_idx').on(
      table.fiscalYearId,
      table.voucherType,
    ),
  ],
)

/**
 * Double-Entry Chart of Accounts.
 * Follows Frappe/ERPNext hierarchical model adapted for Nepal:
 * Asset, Liability, Equity, Income, Expense with group folders and party ledgers.
 */
export const ledgerAccounts = pgTable(
  'ledger_accounts',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(), // e.g. '1010', '2010', '4010'
    name: text('name').notNull(),
    rootType: text('root_type').notNull(), // 'asset' | 'liability' | 'equity' | 'income' | 'expense'
    parentId: text('parent_id'),
    isGroup: boolean('is_group').notNull().default(false),
    ownerType: text('owner_type'), // 'dealer' | 'rider' | 'customer' | null
    ownerId: text('owner_id'), // party id
    currency: text('currency').notNull().default('NPR'),
    isActive: boolean('is_active').notNull().default(true),
    accountType: text('account_type'), // 'cash' | 'bank' | 'receivable' | 'payable' | 'tax' | ...
    balanceMustBe: text('balance_must_be'), // 'debit' | 'credit' | null
    isFrozen: boolean('is_frozen').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('ledger_accounts_root_type_idx').on(table.rootType),
    index('ledger_accounts_parent_idx').on(table.parentId),
    index('ledger_accounts_owner_idx').on(table.ownerType, table.ownerId),
    index('ledger_accounts_is_active_idx').on(table.isActive),
    index('ledger_accounts_account_type_idx').on(table.accountType),
    check(
      'ledger_accounts_root_type_check',
      sql`root_type IN ('asset', 'liability', 'equity', 'income', 'expense')`,
    ),
    check(
      'ledger_accounts_account_type_check',
      sql`account_type IN ('cash', 'bank', 'receivable', 'payable', 'tax', 'stock_adjustment', 'round_off', 'income', 'expense', 'cogs', 'equity', 'fixed_asset', 'other')`,
    ),
    check(
      'ledger_accounts_balance_must_be_check',
      sql`balance_must_be IN ('debit', 'credit')`,
    ),
  ],
)

/**
 * Default Accounts (Accounting Settings)
 * Maps semantic business account keys to default Ledger Accounts in Chart of Accounts.
 * Allows dynamic remapping of sales, taxes, payables, and expenses.
 * Specification: ACCOUNT_GUIDE.md §5.3 & ACC-1.1
 */
export const accountDefaults = pgTable(
  'account_defaults',
  {
    id: text('id').primaryKey(), // e.g. 'def_SALES'
    key: text('key').notNull().unique(), // e.g. 'SALES'
    accountId: text('account_id')
      .notNull()
      .references(() => ledgerAccounts.id),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    updatedBy: text('updated_by'),
  },
  (table) => [
    index('account_defaults_account_id_idx').on(table.accountId),
    index('account_defaults_key_idx').on(table.key),
  ],
)

/**
 * Cost center tree (ERPNext-style).
 * Liquor / Food / Delivery / General by default, with optional sub-centers.
 */
export const costCenters = pgTable(
  'cost_centers',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    parentId: text('parent_id'),
    isGroup: boolean('is_group').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('cost_centers_parent_idx').on(table.parentId),
    index('cost_centers_is_active_idx').on(table.isActive),
  ],
)

/**
 * Company Branches for Multi-Branch Accounting (Phase 5).
 * Enables branch-specific cash/bank accounts, expenses, and profitability.
 */
export const branches = pgTable(
  'branches',
  {
    id: text('id').primaryKey(), // e.g. 'br_butwal_main'
    code: text('code').notNull().unique(), // e.g. 'BUTWAL', 'KTM'
    name: text('name').notNull(),
    city: text('city'),
    address: text('address'),
    phone: text('phone'),
    isHeadOffice: boolean('is_head_office').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('branches_code_idx').on(table.code),
    index('branches_is_active_idx').on(table.isActive),
  ],
)

/**
 * Nepal BS Monthly Accounting Periods per Fiscal Year (Shrawan to Ashadh).
 * Used for monthly lock, VAT returns, and period closing.
 */
export const accountingPeriods = pgTable(
  'accounting_periods',
  {
    id: text('id').primaryKey(), // e.g. 'period_fy-2083-84_01'
    fiscalYearId: text('fiscal_year_id')
      .notNull()
      .references(() => fiscalYears.id, { onDelete: 'cascade' }),
    periodNo: integer('period_no').notNull(), // 1 to 12
    name: text('name').notNull(), // 'Shrawan', 'Bhadra', etc.
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('open'), // 'open' | 'closed'
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedBy: text('closed_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('accounting_periods_fy_idx').on(table.fiscalYearId),
    index('accounting_periods_dates_idx').on(table.startDate, table.endDate),
    uniqueIndex('accounting_periods_fy_no_uniq').on(
      table.fiscalYearId,
      table.periodNo,
    ),
  ],
)

/**
 * Journal entries header.
 * Immutable / append-only. Corrections require a reversal journal entry.
 */
export const journalEntries = pgTable(
  'journal_entries',
  {
    id: text('id').primaryKey(),
    voucherNo: text('voucher_no'), // nullable for drafts until submitted
    voucherType: text('voucher_type').notNull().default('JV'), // 'JV', 'PV', 'RV', 'CV', 'SV', 'CN', 'DN', 'OB', 'PC'
    fiscalYearId: text('fiscal_year_id')
      .notNull()
      .references(() => fiscalYears.id),
    branchId: text('branch_id').references(() => branches.id, {
      onDelete: 'set null',
    }),
    postingDate: timestamp('posting_date', { withTimezone: true })
      .defaultNow()
      .notNull(),
    narration: text('narration').notNull(),
    refType: text('ref_type'), // 'order', 'rider_cash_handover', 'dealer_settlement', 'manual', 'payroll', 'expense', 'closing'
    refId: text('ref_id'),
    event: text('event'), // 'order_delivered', 'cash_handover', 'dealer_settlement', etc.
    postingStatus: text('posting_status').notNull().default('submitted'), // 'draft', 'submitted', 'approved', 'cancelled'
    reversalOf: text('reversal_of'),
    isReversed: boolean('is_reversed').notNull().default(false),
    reversedBy: text('reversed_by'),
    metadata: jsonb('metadata'),
    createdBy: text('created_by').notNull(),
    submittedBy: text('submitted_by'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('journal_entries_fy_idx').on(table.fiscalYearId),
    index('journal_entries_date_idx').on(table.postingDate),
    index('journal_entries_status_idx').on(table.postingStatus),
    index('journal_entries_ref_idx').on(table.refType, table.refId),
    index('journal_entries_branch_idx').on(table.branchId),
    index('journal_entries_is_reversed_idx').on(table.isReversed),
    index('journal_entries_reversed_by_idx').on(table.reversedBy),
    uniqueIndex('journal_entries_voucher_no_uniq_idx')
      .on(table.voucherNo)
      .where(sql`voucher_no IS NOT NULL`),
    uniqueIndex('journal_entries_ref_event_uniq_idx')
      .on(table.refType, table.refId, table.event)
      .where(
        sql`ref_type IS NOT NULL AND ref_id IS NOT NULL AND event IS NOT NULL`,
      ),
    check(
      'journal_entries_status_check',
      sql`posting_status IN ('draft', 'submitted', 'approved', 'cancelled')`,
    ),
  ],
)

/**
 * Double-entry lines.
 * Must balance per journalEntry: sum(debit) == sum(credit).
 */
export const journalLines = pgTable(
  'journal_lines',
  {
    id: text('id').primaryKey(),
    journalEntryId: text('journal_entry_id')
      .notNull()
      .references(() => journalEntries.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => ledgerAccounts.id),
    debit: integer('debit').notNull().default(0), // integer paisa
    credit: integer('credit').notNull().default(0), // integer paisa
    partyType: text('party_type'), // 'dealer', 'rider', 'customer', 'supplier', 'employee'
    partyId: text('party_id'),
    branchId: text('branch_id').references(() => branches.id, {
      onDelete: 'set null',
    }),
    costCenter: text('cost_center'), // legacy free-text value ('liquor', 'food', 'delivery', 'general')
    costCenterId: text('cost_center_id').references(() => costCenters.id, {
      onDelete: 'set null',
    }),
    narration: text('narration'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('journal_lines_entry_idx').on(table.journalEntryId),
    index('journal_lines_account_idx').on(table.accountId),
    index('journal_lines_party_idx').on(table.partyType, table.partyId),
    index('journal_lines_cost_center_id_idx').on(table.costCenterId),
    check(
      'journal_lines_debit_credit_check',
      sql`debit >= 0 AND credit >= 0 AND ((debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0))`,
    ),
  ],
)

/**
 * Safe archive of legacy test single-entry rows.
 */
export const legacyLedgerArchive = pgTable('legacy_ledger_archive', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  type: text('type').notNull(),
  category: text('category').notNull(),
  account: text('account').notNull(),
  memo: text('memo').notNull(),
  amount: integer('amount').notNull(),
  refType: text('ref_type').notNull(),
  refId: text('ref_id'),
  archivedAt: timestamp('archived_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  originalCreatedAt: timestamp('original_created_at', {
    withTimezone: true,
  }).notNull(),
})

/**
 * Legacy single-entry table preserved for backward-compatibility.
 */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: text('id').primaryKey(),
    date: text('date').notNull(), // YYYY-MM-DD
    type: text('type').notNull(), // 'debit' | 'credit'
    category: text('category').notNull(), // 'sales' | 'purchase' | 'expense' | 'refund' | 'cod' | 'settlement' | 'tax' | 'delivery' | 'other'
    account: text('account').notNull(),
    memo: text('memo').notNull(),
    amount: integer('amount').notNull(), // paisa
    refType: text('ref_type').notNull(), // 'order' | 'settlement' | 'manual' | 'refund'
    refId: text('ref_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('ledger_entries_date_idx').on(table.date),
    index('ledger_entries_category_idx').on(table.category),
    index('ledger_entries_type_idx').on(table.type),
    index('ledger_entries_ref_idx').on(table.refType, table.refId),
  ],
)

export const payments = pgTable(
  'payments',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    gateway: text('gateway').notNull(), // 'cod' | 'esewa' | 'khalti' | 'fonepay' | 'connectips'
    amount: integer('amount').notNull(), // paisa
    status: text('status').notNull().default('initiated'), // 'initiated' | 'success' | 'failed' | 'reconciled'
    reference: text('reference').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('payments_order_id_idx').on(table.orderId),
    index('payments_gateway_idx').on(table.gateway),
    index('payments_status_idx').on(table.status),
  ],
)

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}))

export const fiscalYearsRelations = relations(fiscalYears, ({ many }) => ({
  voucherSequences: many(voucherSequences),
  journalEntries: many(journalEntries),
  accountingPeriods: many(accountingPeriods),
}))

export const voucherSequencesRelations = relations(
  voucherSequences,
  ({ one }) => ({
    fiscalYear: one(fiscalYears, {
      fields: [voucherSequences.fiscalYearId],
      references: [fiscalYears.id],
    }),
  }),
)

export const ledgerAccountsRelations = relations(
  ledgerAccounts,
  ({ one, many }) => ({
    parent: one(ledgerAccounts, {
      fields: [ledgerAccounts.parentId],
      references: [ledgerAccounts.id],
    }),
    children: many(ledgerAccounts),
    lines: many(journalLines),
    defaults: many(accountDefaults),
  }),
)

export const accountDefaultsRelations = relations(
  accountDefaults,
  ({ one }) => ({
    account: one(ledgerAccounts, {
      fields: [accountDefaults.accountId],
      references: [ledgerAccounts.id],
    }),
  }),
)

export const journalEntriesRelations = relations(
  journalEntries,
  ({ one, many }) => ({
    fiscalYear: one(fiscalYears, {
      fields: [journalEntries.fiscalYearId],
      references: [fiscalYears.id],
    }),
    branch: one(branches, {
      fields: [journalEntries.branchId],
      references: [branches.id],
    }),
    lines: many(journalLines),
    attachments: many(voucherAttachments),
    reversalEntry: one(journalEntries, {
      fields: [journalEntries.reversalOf],
      references: [journalEntries.id],
    }),
  }),
)

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  entry: one(journalEntries, {
    fields: [journalLines.journalEntryId],
    references: [journalEntries.id],
  }),
  account: one(ledgerAccounts, {
    fields: [journalLines.accountId],
    references: [ledgerAccounts.id],
  }),
  branch: one(branches, {
    fields: [journalLines.branchId],
    references: [branches.id],
  }),
  costCenter: one(costCenters, {
    fields: [journalLines.costCenterId],
    references: [costCenters.id],
  }),
}))

export const costCentersRelations = relations(costCenters, ({ one, many }) => ({
  parent: one(costCenters, {
    fields: [costCenters.parentId],
    references: [costCenters.id],
  }),
  children: many(costCenters),
  lines: many(journalLines),
}))

/**
 * Dealer settlements header for batch settlement of delivered order items.
 * Each settlement has an unguessable slug, sequential voucher number, TDS breakdown, and proof URLs.
 */
export const dealerSettlements = pgTable(
  'dealer_settlements',
  {
    id: text('id').primaryKey(),
    dealerId: text('dealer_id')
      .notNull()
      .references(() => dealers.id, { onDelete: 'cascade' }),
    dealerName: text('dealer_name').notNull(),
    voucherNo: text('voucher_no').notNull().unique(),
    slug: text('slug').notNull().unique(),
    grossAmount: integer('gross_amount').notNull(), // snapshotted dealer cost in paisa
    tdsRate: integer('tds_rate').notNull().default(0), // basis points or percent
    tdsAmount: integer('tds_amount').notNull().default(0), // paisa
    netAmount: integer('net_amount').notNull(), // paisa
    status: text('status').notNull().default('draft'), // 'draft' | 'approved' | 'paid' | 'disputed' | 'reversed'
    paymentMethod: text('payment_method'), // 'cash' | 'bank_transfer' | 'esewa' | 'khalti' | 'cheque'
    paymentReference: text('payment_reference'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    paidBy: text('paid_by'),
    notes: text('notes'),
    proofUrls: jsonb('proof_urls').notNull().default([]),
    journalEntryId: text('journal_entry_id').references(
      () => journalEntries.id,
      {
        onDelete: 'set null',
      },
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('dealer_settlements_dealer_id_idx').on(table.dealerId),
    index('dealer_settlements_status_idx').on(table.status),
    index('dealer_settlements_created_at_idx').on(table.createdAt),
  ],
)

export const dealerSettlementsRelations = relations(
  dealerSettlements,
  ({ one }) => ({
    dealer: one(dealers, {
      fields: [dealerSettlements.dealerId],
      references: [dealers.id],
    }),
    journalEntry: one(journalEntries, {
      fields: [dealerSettlements.journalEntryId],
      references: [journalEntries.id],
    }),
  }),
)

/**
 * Supporting attachments for journal entries and vouchers.
 */
export const voucherAttachments = pgTable(
  'voucher_attachments',
  {
    id: text('id').primaryKey(),
    journalEntryId: text('journal_entry_id')
      .notNull()
      .references(() => journalEntries.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    name: text('name').notNull(),
    size: integer('size').notNull().default(0), // bytes
    mimeType: text('mime_type'),
    uploadedBy: text('uploaded_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('voucher_attachments_entry_idx').on(table.journalEntryId),
  ],
)

/**
 * Expense Categories mapping to Chart of Accounts expense heads.
 */
export const expenseCategories = pgTable(
  'expense_categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    description: text('description'),
    defaultAccountId: text('default_account_id').references(
      () => ledgerAccounts.id,
      { onDelete: 'set null' },
    ),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('expense_categories_account_idx').on(table.defaultAccountId),
    index('expense_categories_is_active_idx').on(table.isActive),
  ],
)

/**
 * Advanced Expense Management (Phase 8).
 * Tracks claims, bills, approvals, receipts, and posted double-entry journals.
 */
export const expenses = pgTable(
  'expenses',
  {
    id: text('id').primaryKey(),
    expenseNumber: text('expense_number').notNull().unique(), // e.g. 'EXP-2083-00001'
    categoryAccountId: text('category_account_id')
      .notNull()
      .references(() => ledgerAccounts.id),
    paymentAccountId: text('payment_account_id').references(
      () => ledgerAccounts.id,
    ),
    amount: integer('amount').notNull(), // integer paisa
    taxAmount: integer('tax_amount').notNull().default(0), // integer paisa
    expenseDate: timestamp('expense_date', { withTimezone: true })
      .defaultNow()
      .notNull(),
    vendorName: text('vendor_name'),
    vendorPan: text('vendor_pan'),
    branchId: text('branch_id').references(() => branches.id, {
      onDelete: 'set null',
    }),
    costCenterId: text('cost_center_id').references(() => costCenters.id, {
      onDelete: 'set null',
    }),
    paymentMethod: text('payment_method').default('cash'), // 'cash' | 'bank_transfer' | 'cheque' | 'esewa'
    paymentReference: text('payment_reference'),
    status: text('status').notNull().default('draft'), // 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid'
    receiptUrls: jsonb('receipt_urls').notNull().default([]),
    notes: text('notes'),
    submittedBy: text('submitted_by').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    paidBy: text('paid_by'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    journalEntryId: text('journal_entry_id').references(
      () => journalEntries.id,
      { onDelete: 'set null' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('expenses_category_idx').on(table.categoryAccountId),
    index('expenses_payment_acc_idx').on(table.paymentAccountId),
    index('expenses_branch_idx').on(table.branchId),
    index('expenses_status_idx').on(table.status),
    index('expenses_date_idx').on(table.expenseDate),
  ],
)

/**
 * Bank Accounts Management (Phase 7).
 * Connects operational commercial bank accounts to the General Ledger.
 */
export const bankAccounts = pgTable(
  'bank_accounts',
  {
    id: text('id').primaryKey(),
    bankName: text('bank_name').notNull(), // e.g. 'Nabil Bank', 'Global IME'
    accountNumber: text('account_number').notNull().unique(),
    accountName: text('account_name').notNull(), // e.g. 'Daru Gang Pvt Ltd'
    branchName: text('branch_name'),
    ledgerAccountId: text('ledger_account_id').references(
      () => ledgerAccounts.id,
      { onDelete: 'set null' },
    ),
    currency: text('currency').notNull().default('NPR'),
    openingBalance: integer('opening_balance').notNull().default(0), // paisa
    currentBalance: integer('current_balance').notNull().default(0), // paisa
    branchId: text('branch_id').references(() => branches.id, {
      onDelete: 'set null',
    }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('bank_accounts_ledger_acc_idx').on(table.ledgerAccountId),
    index('bank_accounts_branch_idx').on(table.branchId),
    index('bank_accounts_is_active_idx').on(table.isActive),
  ],
)

/**
 * Bank Transactions & Reconciliation (Phase 7).
 * Stores imported or entered bank statement lines for automated/manual reconciliation.
 */
export const bankTransactions = pgTable(
  'bank_transactions',
  {
    id: text('id').primaryKey(),
    bankAccountId: text('bank_account_id')
      .notNull()
      .references(() => bankAccounts.id, { onDelete: 'cascade' }),
    transactionDate: timestamp('transaction_date', {
      withTimezone: true,
    }).notNull(),
    description: text('description').notNull(),
    referenceNo: text('reference_no'),
    debit: integer('debit').notNull().default(0), // deposit in paisa
    credit: integer('credit').notNull().default(0), // withdrawal in paisa
    matchedJournalLineId: text('matched_journal_line_id').references(
      () => journalLines.id,
      { onDelete: 'set null' },
    ),
    status: text('status').notNull().default('unmatched'), // 'unmatched' | 'matched' | 'cleared'
    reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
    reconciledBy: text('reconciled_by'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('bank_transactions_bank_acc_idx').on(table.bankAccountId),
    index('bank_transactions_date_idx').on(table.transactionDate),
    index('bank_transactions_status_idx').on(table.status),
    index('bank_transactions_matched_line_idx').on(table.matchedJournalLineId),
  ],
)

/**
 * Period Closing Vouchers (Phase 13).
 * Records fiscal year-end closing entries transferring P&L balances to Retained Earnings.
 */
export const periodClosingVouchers = pgTable(
  'period_closing_vouchers',
  {
    id: text('id').primaryKey(),
    fiscalYearId: text('fiscal_year_id')
      .notNull()
      .references(() => fiscalYears.id),
    closingJournalEntryId: text('closing_journal_entry_id')
      .notNull()
      .references(() => journalEntries.id),
    retainedEarningsAccountId: text('retained_earnings_account_id')
      .notNull()
      .references(() => ledgerAccounts.id),
    netProfitOrLoss: integer('net_profit_or_loss').notNull(), // paisa
    closedBy: text('closed_by').notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('period_closing_fy_idx').on(table.fiscalYearId),
    index('period_closing_entry_idx').on(table.closingJournalEntryId),
  ],
)

export const branchesRelations = relations(branches, ({ many }) => ({
  journalEntries: many(journalEntries),
  journalLines: many(journalLines),
  expenses: many(expenses),
  bankAccounts: many(bankAccounts),
}))

export const accountingPeriodsRelations = relations(
  accountingPeriods,
  ({ one }) => ({
    fiscalYear: one(fiscalYears, {
      fields: [accountingPeriods.fiscalYearId],
      references: [fiscalYears.id],
    }),
  }),
)

export const voucherAttachmentsRelations = relations(
  voucherAttachments,
  ({ one }) => ({
    journalEntry: one(journalEntries, {
      fields: [voucherAttachments.journalEntryId],
      references: [journalEntries.id],
    }),
  }),
)

export const expenseCategoriesRelations = relations(
  expenseCategories,
  ({ one }) => ({
    defaultAccount: one(ledgerAccounts, {
      fields: [expenseCategories.defaultAccountId],
      references: [ledgerAccounts.id],
    }),
  }),
)

export const expensesRelations = relations(expenses, ({ one }) => ({
  categoryAccount: one(ledgerAccounts, {
    fields: [expenses.categoryAccountId],
    references: [ledgerAccounts.id],
  }),
  paymentAccount: one(ledgerAccounts, {
    fields: [expenses.paymentAccountId],
    references: [ledgerAccounts.id],
  }),
  branch: one(branches, {
    fields: [expenses.branchId],
    references: [branches.id],
  }),
  costCenter: one(costCenters, {
    fields: [expenses.costCenterId],
    references: [costCenters.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [expenses.journalEntryId],
    references: [journalEntries.id],
  }),
}))

export const bankAccountsRelations = relations(
  bankAccounts,
  ({ one, many }) => ({
    ledgerAccount: one(ledgerAccounts, {
      fields: [bankAccounts.ledgerAccountId],
      references: [ledgerAccounts.id],
    }),
    branch: one(branches, {
      fields: [bankAccounts.branchId],
      references: [branches.id],
    }),
    transactions: many(bankTransactions),
  }),
)

export const bankTransactionsRelations = relations(
  bankTransactions,
  ({ one }) => ({
    bankAccount: one(bankAccounts, {
      fields: [bankTransactions.bankAccountId],
      references: [bankAccounts.id],
    }),
    matchedJournalLine: one(journalLines, {
      fields: [bankTransactions.matchedJournalLineId],
      references: [journalLines.id],
    }),
  }),
)

export const periodClosingVouchersRelations = relations(
  periodClosingVouchers,
  ({ one }) => ({
    fiscalYear: one(fiscalYears, {
      fields: [periodClosingVouchers.fiscalYearId],
      references: [fiscalYears.id],
    }),
    closingJournalEntry: one(journalEntries, {
      fields: [periodClosingVouchers.closingJournalEntryId],
      references: [journalEntries.id],
    }),
    retainedEarningsAccount: one(ledgerAccounts, {
      fields: [periodClosingVouchers.retainedEarningsAccountId],
      references: [ledgerAccounts.id],
    }),
  }),
)
