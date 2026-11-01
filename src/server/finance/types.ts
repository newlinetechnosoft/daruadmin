import type { dbTx } from '#/db'
import type { SessionUser } from '#/server/auth/permissions'
import type { Order, OrderItem } from '#/server/operations/types'

/**
 * Database transaction client type inferred from the primary Neon serverless pool.
 */
export type DbTx = Parameters<Parameters<typeof dbTx.transaction>[0]>[0]

export const ALLOWED_PARTY_TYPES = [
  'dealer',
  'rider',
  'customer',
  'supplier',
] as const

export type PartyType = (typeof ALLOWED_PARTY_TYPES)[number]
export type CostCenter = 'liquor' | 'grocery' | 'delivery' | 'general'
export type VoucherType = 'JV' | 'PV' | 'RV' | 'CV' | 'SV'

export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | { [key: string]: SerializableValue }
  | SerializableValue[]

export type JournalMetadata = Record<string, SerializableValue>

export interface JournalLineInput {
  accountId: string
  debit?: number // paisa
  credit?: number // paisa
  partyType?: PartyType | null
  partyId?: string | null
  costCenter?: CostCenter | null
  narration?: string | null
}

export interface PostJournalParams {
  voucherType?: VoucherType
  postingDate?: Date
  narration: string
  refType?: string | null
  refId?: string | null
  event?: string | null
  createdBy: string
  metadata?: JournalMetadata | null
  lines: JournalLineInput[]
}

export interface PostJournalResult {
  journalEntryId: string
  voucherNo: string
  isDuplicate?: boolean
}

export type FinanceActor =
  SessionUser | { id: string; name: string; role: string }

export interface ReverseJournalParams {
  originalEntryId: string
  narration: string
  createdBy: string
  postingDate?: Date
}

export interface PostOrderDeliveredParams {
  order: Order
  items: OrderItem[]
  actor: FinanceActor
  rider?: {
    id: string
    name: string
    perDropRate?: number
    commissionRate?: number
  } | null
}

export interface PostCashHandoverParams {
  handoverId: string
  riderId: string
  riderName: string
  amount: number // paisa
  actor: FinanceActor
}

export interface PostDealerSettlementParams {
  settlementId: string
  dealerId: string
  dealerName: string
  grossAmount: number // paisa
  tdsRate?: number // e.g. 1.5%
  paymentAccount?: 'bank' | 'cash'
  actor: FinanceActor
}

export interface PostRiderSalaryAccrualParams {
  settlementId: string
  riderId: string
  riderName: string
  baseSalaryAmount: number // paisa
  actor: FinanceActor
}

export interface PostRiderPayoutParams {
  settlementId: string
  riderId: string
  riderName: string
  amount?: number // paisa (backward compatibility)
  grossAmount?: number // paisa
  netPaid?: number // paisa
  cashShortageDeducted?: number // paisa
  advancesDeducted?: number // paisa
  paymentAccount?: 'bank' | 'cash'
  actor: FinanceActor
}
