import { relations } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { orders } from './orders'

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
