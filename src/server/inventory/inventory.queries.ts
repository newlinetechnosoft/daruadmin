import { db } from '#/db'
import { dealers, stockMovements } from '#/db/schema'
import { desc, eq } from 'drizzle-orm'

export interface DealerDto {
  id: string
  name: string
  contact: string
  pan: string | null
  address: string
  city: string
  lat: number | null
  lng: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface StockMovementDto {
  id: string
  catalogType: 'liquor' | 'grocery'
  variantId: string
  dealerId: string | null
  delta: number
  type: string
  refType: string | null
  refId: string | null
  notes: string | null
  createdBy: string | null
  createdAt: string
}

export async function getAllDealersQuery(): Promise<DealerDto[]> {
  const rows = await db.select().from(dealers).orderBy(desc(dealers.createdAt))
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    contact: d.contact,
    pan: d.pan,
    address: d.address,
    city: d.city,
    lat: d.lat ? Number(d.lat) : null,
    lng: d.lng ? Number(d.lng) : null,
    isActive: d.isActive,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }))
}

export async function getDealerByIdQuery(
  id: string,
): Promise<DealerDto | null> {
  const rows = await db
    .select()
    .from(dealers)
    .where(eq(dealers.id, id))
    .limit(1)
  if (!rows[0]) return null
  const d = rows[0]
  return {
    id: d.id,
    name: d.name,
    contact: d.contact,
    pan: d.pan,
    address: d.address,
    city: d.city,
    lat: d.lat ? Number(d.lat) : null,
    lng: d.lng ? Number(d.lng) : null,
    isActive: d.isActive,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }
}

export async function getRecentStockMovementsQuery(
  limit = 100,
): Promise<StockMovementDto[]> {
  const rows = await db
    .select()
    .from(stockMovements)
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit)

  return rows.map((m) => ({
    id: m.id,
    catalogType: m.catalogType as 'liquor' | 'grocery',
    variantId: m.variantId,
    dealerId: m.dealerId,
    delta: m.delta,
    type: m.type,
    refType: m.refType,
    refId: m.refId,
    notes: m.notes,
    createdBy: m.createdBy,
    createdAt: m.createdAt.toISOString(),
  }))
}
