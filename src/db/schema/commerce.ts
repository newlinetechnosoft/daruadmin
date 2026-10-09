import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** Key-value operational store for orders, riders, ledger, and admin settings. */
export const opsKv = pgTable('ops_kv', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
