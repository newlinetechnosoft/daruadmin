import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
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
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    deliveries: integer('deliveries').notNull().default(0),
    cashCollected: integer('cash_collected').notNull().default(0), // paisa
    commission: integer('commission').notNull().default(0), // paisa
    payout: integer('payout').notNull().default(0), // paisa
    status: text('status').notNull().default('draft'), // 'draft' | 'approved' | 'paid'
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('settlements_rider_id_idx').on(table.riderId),
    index('settlements_status_idx').on(table.status),
  ],
)

export const ridersRelations = relations(riders, ({ one, many }) => ({
  user: one(user, {
    fields: [riders.userId],
    references: [user.id],
  }),
  handovers: many(riderCashHandovers),
  settlements: many(settlements),
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
