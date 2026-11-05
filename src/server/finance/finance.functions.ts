import { dbTx } from '#/db'
import {
  dealers,
  dealerSettlements,
  notifications,
  orderItems,
  riderCashHandovers,
  riders,
} from '#/db/schema'
import {
  requirePermission,
  requireRole,
  logAudit,
} from '#/server/auth/permissions'
import { RIDER_SETTLEMENT_METHOD_LABELS } from '#/server/riders/rider-settlements'
import {
  getAccountDefaultsQuery,
  getChartOfAccountsWithBalancesQuery,
  getDealerPayablesSummaryQuery,
  getFiscalYearsQuery,
  getGeneralLedgerQuery,
  getJournalEntriesQuery,
  getPublicVoucherBySlugQuery,
  getRiderAccountsSummaryQuery,
  getUnsettledDealerItemsQuery,
  updateAccountDefaultsQuery,
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
                .enum(['liquor', 'food', 'delivery', 'general'])
                .optional(),
              narration: z.string().optional(),
            }),
          )
          .min(2),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')

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
    const { user } = await requirePermission('accounts', 'approve')

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
 * Accepts a rider-submitted settlement request.
 *
 * Only managers and admins may accept a rider settlement. Until then the
 * request remains pending, the rider's cash-on-hand balance is untouched, and
 * no ledger entry is posted. Acceptance is the point where the amount is
 * considered settled.
 */
export const approveRiderCashSettlementFn = createServerFn({
  method: 'POST',
})
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        notes: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requireRole('admin', 'manager')
    const now = new Date()

    const result = await dbTx.transaction(async (tx) => {
      const handoverRows = await tx
        .select()
        .from(riderCashHandovers)
        .where(eq(riderCashHandovers.id, data.id))
        .limit(1)
        .for('update')
      if (handoverRows.length === 0) {
        throw new Error('Rider settlement request not found')
      }
      const handover = handoverRows[0]

      if (handover.status === 'verified') {
        throw new Error(
          'This rider settlement request has already been accepted.',
        )
      }
      if (handover.status === 'rejected') {
        throw new Error(
          'This rider settlement request was rejected and cannot be accepted.',
        )
      }
      if (
        handover.paymentMethod !== 'cash' &&
        !handover.paymentReference?.trim()
      ) {
        throw new Error(
          'Payment reference is required for bank transfer and cheque settlements.',
        )
      }

      const riderRows = await tx
        .select()
        .from(riders)
        .where(eq(riders.id, handover.riderId))
        .limit(1)
        .for('update')
      if (riderRows.length === 0) throw new Error('Rider profile not found')
      const rider = riderRows[0]

      if (rider.cashOnHand < handover.amount) {
        throw new Error(
          `Cannot accept settlement: rider only has Rs. ${(rider.cashOnHand / 100).toFixed(2)} cash on hand, but the request is for Rs. ${(handover.amount / 100).toFixed(2)}.`,
        )
      }

      await tx
        .update(riders)
        .set({
          cashOnHand: rider.cashOnHand - handover.amount,
          updatedAt: now,
        })
        .where(eq(riders.id, rider.id))

      const posting = await postCashHandoverTx(tx, {
        handoverId: handover.id,
        riderId: rider.id,
        riderName: rider.name,
        amount: handover.amount,
        paymentMethod: handover.paymentMethod as
          'cash' | 'bank_transfer' | 'cheque',
        actor: user,
      })

      const combinedNotes = data.notes
        ? handover.notes
          ? `${handover.notes} · ${data.notes}`
          : data.notes
        : handover.notes

      await tx
        .update(riderCashHandovers)
        .set({
          status: 'verified',
          receivedBy: user.id,
          reviewedAt: now,
          journalEntryId: posting.journalEntryId,
          notes: combinedNotes,
        })
        .where(eq(riderCashHandovers.id, handover.id))

      if (rider.userId) {
        await tx.insert(notifications).values({
          id: nid('notif'),
          userId: rider.userId,
          type: 'finance',
          title: 'Settlement request accepted',
          body: `Your ${RIDER_SETTLEMENT_METHOD_LABELS[handover.paymentMethod as 'cash' | 'bank_transfer' | 'cheque'].toLowerCase()} settlement of Rs. ${(handover.amount / 100).toFixed(2)} was accepted. Voucher: ${posting.voucherNo}.`,
          href: '/rider/earnings',
          read: false,
          createdAt: now,
        })
      }

      return {
        ...posting,
        amount: handover.amount,
        riderName: rider.name,
      }
    })

    await logAudit(
      user.name,
      'accounts',
      'approve',
      `Accepted rider settlement ${result.voucherNo} for ${result.riderName}: Rs. ${(result.amount / 100).toFixed(2)}`,
    )

    return result
  })

/**
 * Rejects a rider-submitted settlement request without touching the rider's
 * cash-on-hand balance or posting any ledger entry.
 */
export const rejectRiderCashSettlementFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().min(1),
        reason: z.string().min(3).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requireRole('admin', 'manager')
    const now = new Date()

    const result = await dbTx.transaction(async (tx) => {
      const handoverRows = await tx
        .select()
        .from(riderCashHandovers)
        .where(eq(riderCashHandovers.id, data.id))
        .limit(1)
        .for('update')
      if (handoverRows.length === 0) {
        throw new Error('Rider settlement request not found')
      }
      const handover = handoverRows[0]

      if (handover.status !== 'pending') {
        throw new Error(
          `This settlement request is already ${handover.status} and cannot be rejected.`,
        )
      }

      const riderRows = await tx
        .select()
        .from(riders)
        .where(eq(riders.id, handover.riderId))
        .limit(1)
      const rider = riderRows[0]

      await tx
        .update(riderCashHandovers)
        .set({
          status: 'rejected',
          receivedBy: user.id,
          reviewedAt: now,
          rejectionReason: data.reason,
        })
        .where(eq(riderCashHandovers.id, handover.id))

      if (riderRows.length > 0 && rider.userId) {
        await tx.insert(notifications).values({
          id: nid('notif'),
          userId: rider.userId,
          type: 'finance',
          title: 'Settlement request rejected',
          body: `Your settlement request of Rs. ${(handover.amount / 100).toFixed(2)} was rejected. Reason: ${data.reason}`,
          href: '/rider/earnings',
          read: false,
          createdAt: now,
        })
      }

      return { id: handover.id, status: 'rejected' as const }
    })

    await logAudit(
      user.name,
      'accounts',
      'edit',
      `Rejected rider settlement request ${data.id}: ${data.reason}`,
    )

    return result
  })

/**
 * Reverses a posted journal voucher (Admin only, requires accounts:approve).
 * Hardened per ACC-0.4 (G2):
 * - Requires accounts:approve permission.
 * - Mandatory reason of min 5 chars.
 * - Enforces append-only reversal with isReversed/reversedBy linking.
 * - Audit logs the reversal.
 */
export const reverseJournalVoucherFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        journalEntryId: z.string().min(1),
        reason: z.string().min(5),
        postingDate: z.string().optional(),
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
        postingDate: data.postingDate ? new Date(data.postingDate) : undefined,
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

/**
 * Loads default account mappings and eligible leaf accounts for Settings tab (ACC-1.1).
 * Requires accounts.view permission.
 */
export const getAccountDefaultsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('accounts', 'view')

    const [defaults, allAccounts] = await Promise.all([
      getAccountDefaultsQuery(),
      getChartOfAccountsWithBalancesQuery(),
    ])

    const availableAccounts = allAccounts
      .filter((a) => !a.isGroup && a.isActive)
      .map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        rootType: a.rootType,
      }))

    return {
      defaults,
      accounts: availableAccounts,
    }
  },
)

/**
 * Updates default account mappings (Admin only, requires accounts:approve or settings:edit).
 * Enforces non-group, active accounts and logs an audit record.
 */
export const updateAccountDefaultsFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        updates: z
          .array(
            z.object({
              key: z.string().min(1),
              accountId: z.string().min(1),
            }),
          )
          .min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')

    const result = await updateAccountDefaultsQuery(
      data.updates as any,
      user.name,
    )

    await logAudit(
      user.name,
      'accounts',
      'edit',
      `Updated ${result.updatedCount} accounting default account mapping(s)`,
    )

    return {
      success: true,
      count: result.updatedCount,
    }
  })
