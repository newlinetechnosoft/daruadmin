import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: [number, number][][]
}

export const serviceZones = pgTable('service_zones', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  polygon: jsonb('polygon').$type<GeoJSONPolygon>().notNull(),
  isActive: boolean('is_active').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export type ServiceZone = typeof serviceZones.$inferSelect
export type NewServiceZone = typeof serviceZones.$inferInsert
