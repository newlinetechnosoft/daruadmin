import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

export const riders = pgTable(
  'riders',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    vehicle: text('vehicle').notNull().default('bike'), // 'bike' | 'scooter' | 'car'
    licenseNo: text('license_no').notNull().default(''),
    verified: boolean('verified').notNull().default(false),
    available: boolean('available').notNull().default(true),
    status: text('status').notNull().default('offline'), // 'offline' | 'available' | 'busy'
    lat: numeric('lat', { precision: 10, scale: 7 }).default('27.7172'),
    lng: numeric('lng', { precision: 10, scale: 7 }).default('85.3240'),
    zone: text('zone').notNull().default('Kathmandu'),
    baseSalary: integer('base_salary').notNull().default(0), // paisa
    perDropRate: integer('per_drop_rate').notNull().default(5000), // paisa (default Rs. 50)
    commissionRate: integer('commission_rate').notNull().default(10), // percent
    cashOnHand: integer('cash_on_hand').notNull().default(0), // paisa
    earnings: integer('earnings').notNull().default(0), // paisa
    deliveries: integer('deliveries').notNull().default(0),
    rating: numeric('rating', { precision: 3, scale: 2 })
      .notNull()
      .default('5.00'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('riders_user_id_idx').on(table.userId),
    index('riders_status_idx').on(table.status),
    index('riders_phone_idx').on(table.phone),
  ],
)

export const riderCashHandovers = pgTable(
  'rider_cash_handovers',
  {
    id: text('id').primaryKey(),
    riderId: text('rider_id')
      .notNull()
      .references(() => riders.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(), // paisa
    status: text('status').notNull().default('pending'), // 'pending' | 'verified' | 'rejected'
    notes: text('notes'),
    receivedBy: text('received_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('rider_cash_handovers_rider_id_idx').on(table.riderId),
    index('rider_cash_handovers_status_idx').on(table.status),
  ],
)

export const settlements = pgTable(
  'settlements',
  {
    id: text('id').primaryKey(),
    riderId: text('rider_id')
      .notNull()
      .references(() => riders.id, { onDelete: 'cascade' }),
    riderName: text('rider_name').notNull(),
    voucherNo: text('voucher_no'),
    slug: text('slug'),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    deliveries: integer('deliveries').notNull().default(0),
    cashCollected: integer('cash_collected').notNull().default(0), // paisa
    baseSalaryAmount: integer('base_salary_amount').notNull().default(0), // paisa
    perDropAmount: integer('per_drop_amount').notNull().default(0), // paisa
    commissionAmount: integer('commission_amount').notNull().default(0), // paisa
    commission: integer('commission').notNull().default(0), // legacy backwards compatibility
    grossEarnings: integer('gross_earnings').notNull().default(0), // paisa
    advancesDeducted: integer('advances_deducted').notNull().default(0), // paisa
    cashShortageDeducted: integer('cash_shortage_deducted')
      .notNull()
      .default(0), // paisa
    cashHeldDeducted: integer('cash_held_deducted').notNull().default(0), // paisa
    netPayout: integer('net_payout').notNull().default(0), // paisa
    payout: integer('payout').notNull().default(0), // legacy backwards compatibility (paisa)
    status: text('status').notNull().default('draft'), // 'draft' | 'approved' | 'paid'
    paymentMethod: text('payment_method'), // 'cash' | 'bank_transfer' | 'esewa' | 'khalti' | 'cheque'
    paymentReference: text('payment_reference'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    paidBy: text('paid_by'),
    notes: text('notes'),
    proofUrls: jsonb('proof_urls').notNull().default([]),
    journalEntryId: text('journal_entry_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('settlements_rider_id_idx').on(table.riderId),
    index('settlements_status_idx').on(table.status),
    index('settlements_voucher_no_idx').on(table.voucherNo),
    index('settlements_slug_idx').on(table.slug),
  ],
)

export const riderShifts = pgTable(
  'rider_shifts',
  {
    id: text('id').primaryKey(),
    riderId: text('rider_id')
      .notNull()
      .references(() => riders.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('active'), // 'active' | 'completed'
    startedAt: timestamp('started_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationMinutes: integer('duration_minutes').notNull().default(0),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('rider_shifts_rider_id_idx').on(table.riderId),
    index('rider_shifts_status_idx').on(table.status),
    index('rider_shifts_started_at_idx').on(table.startedAt),
  ],
)

export const ridersRelations = relations(riders, ({ one, many }) => ({
  user: one(user, {
    fields: [riders.userId],
    references: [user.id],
  }),
  handovers: many(riderCashHandovers),
  settlements: many(settlements),
  shifts: many(riderShifts),
}))

export const riderCashHandoversRelations = relations(
  riderCashHandovers,
  ({ one }) => ({
    rider: one(riders, {
      fields: [riderCashHandovers.riderId],
      references: [riders.id],
    }),
  }),
)

export const settlementsRelations = relations(settlements, ({ one }) => ({
  rider: one(riders, {
    fields: [settlements.riderId],
    references: [riders.id],
  }),
}))

export const riderShiftsRelations = relations(riderShifts, ({ one }) => ({
  rider: one(riders, {
    fields: [riderShifts.riderId],
    references: [riders.id],
  }),
}))
