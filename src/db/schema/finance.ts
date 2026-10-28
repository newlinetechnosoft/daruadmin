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
    check(
      'ledger_accounts_root_type_check',
      sql`root_type IN ('asset', 'liability', 'equity', 'income', 'expense')`,
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
    voucherNo: text('voucher_no').notNull().unique(), // e.g. 'JV-2083-00001'
    voucherType: text('voucher_type').notNull().default('JV'), // 'JV', 'PV', 'RV', 'CV', 'SV'
    fiscalYearId: text('fiscal_year_id')
      .notNull()
      .references(() => fiscalYears.id),
    postingDate: timestamp('posting_date', { withTimezone: true })
      .defaultNow()
      .notNull(),
    narration: text('narration').notNull(),
    refType: text('ref_type'), // 'order', 'rider_cash_handover', 'dealer_settlement', 'manual', 'payroll'
    refId: text('ref_id'),
    event: text('event'), // 'order_delivered', 'cash_handover', 'dealer_settlement', etc.
    postingStatus: text('posting_status').notNull().default('submitted'), // 'draft', 'submitted', 'cancelled'
    reversalOf: text('reversal_of'),
    metadata: jsonb('metadata'),
    createdBy: text('created_by').notNull(),
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
    uniqueIndex('journal_entries_ref_event_uniq_idx')
      .on(table.refType, table.refId, table.event)
      .where(
        sql`ref_type IS NOT NULL AND ref_id IS NOT NULL AND event IS NOT NULL`,
      ),
    check(
      'journal_entries_status_check',
      sql`posting_status IN ('draft', 'submitted', 'cancelled')`,
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
    partyType: text('party_type'), // 'dealer', 'rider', 'customer', 'supplier'
    partyId: text('party_id'),
    costCenter: text('cost_center'), // 'liquor', 'grocery', 'delivery', 'general'
    narration: text('narration'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('journal_lines_entry_idx').on(table.journalEntryId),
    index('journal_lines_account_idx').on(table.accountId),
    index('journal_lines_party_idx').on(table.partyType, table.partyId),
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
  }),
)

export const journalEntriesRelations = relations(
  journalEntries,
  ({ one, many }) => ({
    fiscalYear: one(fiscalYears, {
      fields: [journalEntries.fiscalYearId],
      references: [fiscalYears.id],
    }),
    lines: many(journalLines),
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
