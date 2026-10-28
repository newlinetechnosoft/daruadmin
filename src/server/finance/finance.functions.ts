import { dbTx } from '#/db'
import {
  dealers,
  dealerSettlements,
  orderItems,
  riderCashHandovers,
  riders,
} from '#/db/schema'
import { requirePermission, logAudit } from '#/server/auth/permissions'
import {
  getChartOfAccountsWithBalancesQuery,
  getDealerPayablesSummaryQuery,
  getFiscalYearsQuery,
  getGeneralLedgerQuery,
  getJournalEntriesQuery,
  getPublicVoucherBySlugQuery,
  getRiderAccountsSummaryQuery,
  getUnsettledDealerItemsQuery,
} from '#/server/finance/finance.queries'
import {
  postCashHandoverTx,
  postDealerSettlementTx,
  postJournalTx,
  reverseJournalTx,
} from '#/server/finance/double-entry'
import { createServerFn } from '@tanstack/react-start'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

function nid(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
}

/**
 * Loads comprehensive Double-Entry accounting data for the Admin Accounts Panel.
 */
export const getAccountingOverviewFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        accountId: z.string().optional(),
        voucherType: z.string().optional(),
        fiscalYearId: z.string().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')

    const [
      entries,
      ledger,
      accounts,
      fiscalYearsList,
      dealerPayables,
      riderAccounts,
    ] = await Promise.all([
      getJournalEntriesQuery({
        fiscalYearId: data?.fiscalYearId,
        voucherType: data?.voucherType,
        limit: 100,
      }),
      getGeneralLedgerQuery({
        accountId: data?.accountId,
        limit: 250,
      }),
      getChartOfAccountsWithBalancesQuery(),
      getFiscalYearsQuery(),
      getDealerPayablesSummaryQuery(),
      getRiderAccountsSummaryQuery(),
    ])

    return {
      entries,
      ledger,
      accounts,
      fiscalYears: fiscalYearsList,
      dealerPayables,
      riderAccounts,
    }
  })

/**
 * Creates a balanced manual journal voucher (JV, PV, RV, CV).
 */
export const postManualJournalVoucherFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        voucherType: z.enum(['JV', 'PV', 'RV', 'CV']).default('JV'),
        postingDate: z.string().optional(),
        narration: z.string().min(3),
        lines: z
          .array(
            z.object({
              accountId: z.string().min(1),
              debit: z.number().int().min(0),
              credit: z.number().int().min(0),
              partyType: z
                .enum(['dealer', 'rider', 'customer', 'supplier'])
                .optional(),
              partyId: z.string().optional(),
              costCenter: z
                .enum(['liquor', 'grocery', 'delivery', 'general'])
                .optional(),
              narration: z.string().optional(),
            }),
          )
          .min(2),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'create')

    const totalDebit = data.lines.reduce((acc, l) => acc + l.debit, 0)
    const totalCredit = data.lines.reduce((acc, l) => acc + l.credit, 0)

    if (totalDebit !== totalCredit) {
      throw new Error(
        `Journal entry is out of balance. Total Debit (Rs. ${(totalDebit / 100).toFixed(2)}) must equal Total Credit (Rs. ${(totalCredit / 100).toFixed(2)}).`,
      )
    }

    if (totalDebit === 0) {
      throw new Error('Journal entry cannot be zero.')
    }

    const postingDate = data.postingDate
      ? new Date(data.postingDate)
      : new Date()

    const result = await dbTx.transaction(async (tx) => {
      return postJournalTx(tx, {
        voucherType: data.voucherType,
        postingDate,
        narration: data.narration,
        refType: 'manual',
        refId: nid('man'),
        event: 'manual_voucher',
        createdBy: user.name,
        lines: data.lines,
      })
    })

    await logAudit(
      user.name,
      'accounts',
      'create',
      `Posted manual voucher ${result.voucherNo}: ${data.narration} (Rs. ${(totalDebit / 100).toFixed(2)})`,
    )

    return result
  })

/**
 * Records a dealer settlement disbursement with double-entry Payment Voucher (PV) & TDS.
 */
export const recordDealerDisbursementFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        dealerId: z.string().min(1),
        amountInRs: z.number().positive(),
        paymentAccount: z.enum(['bank', 'cash']).default('bank'),
        paymentMethod: z
          .enum(['cash', 'bank_transfer', 'esewa', 'khalti', 'cheque'])
          .default('bank_transfer'),
        paymentReference: z.string().optional(),
        tdsRate: z.number().min(0).max(100).default(0),
        memo: z.string().optional(),
        proofUrls: z.array(z.string()).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'create')

    const dealerRow = await dbTx
      .select()
      .from(dealers)
      .where(eq(dealers.id, data.dealerId))
      .limit(1)
    if (!dealerRow[0]) throw new Error('Dealer not found')

    const grossAmount = Math.round(data.amountInRs * 100) // to paisa
    const tdsAmount = Math.round(grossAmount * (data.tdsRate / 100))
    const netAmount = grossAmount - tdsAmount
    const settlementId = nid('dst')
    const slug = `vch_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
    const now = new Date()

    const result = await dbTx.transaction(async (tx) => {
      const posting = await postDealerSettlementTx(tx, {
        settlementId,
        dealerId: dealerRow[0].id,
        dealerName: dealerRow[0].name,
        grossAmount,
        tdsRate: data.tdsRate,
        paymentAccount: data.paymentAccount,
        actor: user,
      })

      await tx.insert(dealerSettlements).values({
        id: settlementId,
        dealerId: dealerRow[0].id,
        dealerName: dealerRow[0].name,
        voucherNo: posting.voucherNo,
        slug,
        grossAmount,
        tdsRate: data.tdsRate,
        tdsAmount,
        netAmount,
        status: 'paid',
        paymentMethod: data.paymentMethod,
        paymentReference: data.paymentReference || null,
        paidAt: now,
        paidBy: user.id,
        notes:
          data.memo || `Direct dealer disbursement to ${dealerRow[0].name}`,
        proofUrls: data.proofUrls,
        journalEntryId: posting.journalEntryId,
        createdAt: now,
        updatedAt: now,
      })

      return {
        ...posting,
        slug,
        grossAmount,
        tdsAmount,
        netAmount,
      }
    })

    await logAudit(
      user.name,
      'accounts',
      'create',
      `Dealer payout ${result.voucherNo}: Disbursed Rs. ${data.amountInRs} to ${dealerRow[0].name} (TDS ${data.tdsRate}%, slug: ${slug})`,
    )

    return result
  })

/**
 * Creates a batch settlement for delivered order lines from a dealer.
 * Marks order items settled and posts double-entry disbursement voucher.
 */
export const createDealerSettlementBatchFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        dealerId: z.string().min(1),
        orderItemIds: z.array(z.string()).min(1),
        paymentAccount: z.enum(['bank', 'cash']).default('bank'),
        paymentMethod: z
          .enum(['cash', 'bank_transfer', 'esewa', 'khalti', 'cheque'])
          .default('bank_transfer'),
        paymentReference: z.string().optional(),
        tdsRate: z.number().min(0).max(100).default(0),
        memo: z.string().optional(),
        proofUrls: z.array(z.string()).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'create')

    const dealerRow = await dbTx
      .select()
      .from(dealers)
      .where(eq(dealers.id, data.dealerId))
      .limit(1)
    if (!dealerRow[0]) throw new Error('Dealer not found')

    // Find and verify the requested order items
    const items = await dbTx
      .select()
      .from(orderItems)
      .where(
        and(
          eq(orderItems.dealerId, data.dealerId),
          eq(orderItems.isSettled, false),
          inArray(orderItems.id, data.orderItemIds),
        ),
      )

    if (items.length === 0) {
      throw new Error(
        'No unsettled items found matching the selection for this dealer',
      )
    }

    // Gross amount = sum of snapshotted dealer unit cost * quantity
    const grossAmount = items.reduce((sum, item) => {
      const unitCost = item.dealerCostPrice || item.actualDealerCostPrice || 0
      return sum + unitCost * item.qty
    }, 0)

    if (grossAmount <= 0) {
      throw new Error('Settlement gross amount must be greater than zero')
    }

    const tdsAmount = Math.round(grossAmount * (data.tdsRate / 100))
    const netAmount = grossAmount - tdsAmount
    const settlementId = nid('dst')
    const slug = `vch_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
    const now = new Date()

    const result = await dbTx.transaction(async (tx) => {
      const posting = await postDealerSettlementTx(tx, {
        settlementId,
        dealerId: dealerRow[0].id,
        dealerName: dealerRow[0].name,
        grossAmount,
        tdsRate: data.tdsRate,
        paymentAccount: data.paymentAccount,
        actor: user,
      })

      await tx.insert(dealerSettlements).values({
        id: settlementId,
        dealerId: dealerRow[0].id,
        dealerName: dealerRow[0].name,
        voucherNo: posting.voucherNo,
        slug,
        grossAmount,
        tdsRate: data.tdsRate,
        tdsAmount,
        netAmount,
        status: 'paid',
        paymentMethod: data.paymentMethod,
        paymentReference: data.paymentReference || null,
        paidAt: now,
        paidBy: user.id,
        notes:
          data.memo ||
          `Settled ${items.length} delivered line items for ${dealerRow[0].name}`,
        proofUrls: data.proofUrls,
        journalEntryId: posting.journalEntryId,
        createdAt: now,
        updatedAt: now,
      })

      // Mark the order items settled
      await tx
        .update(orderItems)
        .set({
          isSettled: true,
          settlementId,
        })
        .where(inArray(orderItems.id, data.orderItemIds))

      return {
        ...posting,
        slug,
        settledItemCount: items.length,
        grossAmount,
        tdsAmount,
        netAmount,
      }
    })

    await logAudit(
      user.name,
      'accounts',
      'create',
      `Batch settled ${items.length} items for ${dealerRow[0].name} (${result.voucherNo}, Rs. ${(grossAmount / 100).toFixed(2)})`,
    )

    return result
  })

/**
 * Loads unsettled delivered order lines available for dealer batch settlement.
 */
export const getUnsettledDealerItemsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z.object({ dealerId: z.string().optional() }).optional().parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')
    return getUnsettledDealerItemsQuery(data?.dealerId)
  })

/**
 * Public voucher fetcher by unguessable slug (public read-only, no login required).
 */
export const getPublicVoucherFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const voucher = await getPublicVoucherBySlugQuery(data.slug)
    if (!voucher) {
      throw new Error('Voucher not found or link has expired')
    }
    return voucher
  })

/**
 * Manager receives cash handover directly from rider at counter.
 */
export const recordManagerCashHandoverFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        riderId: z.string().min(1),
        amountInRs: z.number().positive(),
        notes: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'create')

    const riderRow = await dbTx
      .select()
      .from(riders)
      .where(eq(riders.id, data.riderId))
      .limit(1)
    if (!riderRow[0]) throw new Error('Rider profile not found')

    const amount = Math.round(data.amountInRs * 100) // to paisa
    if (riderRow[0].cashOnHand < amount) {
      throw new Error(
        `Handover amount (Rs. ${data.amountInRs}) exceeds rider's current cash on hand (Rs. ${(riderRow[0].cashOnHand / 100).toFixed(2)})`,
      )
    }

    const handoverId = nid('rch')
    const now = new Date()

    const result = await dbTx.transaction(async (tx) => {
      await tx
        .update(riders)
        .set({
          cashOnHand: riderRow[0].cashOnHand - amount,
          updatedAt: now,
        })
        .where(eq(riders.id, riderRow[0].id))

      await tx.insert(riderCashHandovers).values({
        id: handoverId,
        riderId: riderRow[0].id,
        amount,
        status: 'verified',
        receivedBy: user.id,
        notes: data.notes || `Counter cash handover verified by ${user.name}`,
      })

      return postCashHandoverTx(tx, {
        handoverId,
        riderId: riderRow[0].id,
        riderName: riderRow[0].name,
        amount,
        actor: user,
      })
    })

    await logAudit(
      user.name,
      'accounts',
      'create',
      `Received rider cash handover ${result.voucherNo}: Rs. ${data.amountInRs} from ${riderRow[0].name}`,
    )

    return result
  })

/**
 * Reverses a posted journal voucher (Admin only).
 */
export const reverseJournalVoucherFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        journalEntryId: z.string().min(1),
        reason: z.string().min(5),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')

    const result = await dbTx.transaction(async (tx) => {
      return reverseJournalTx(tx, {
        originalEntryId: data.journalEntryId,
        narration: `Reversal: ${data.reason}`,
        createdBy: user.name,
      })
    })

    await logAudit(
      user.name,
      'accounts',
      'approve',
      `Reversed journal voucher ${data.journalEntryId} with new entry ${result.voucherNo}: ${data.reason}`,
    )

    return result
  })
