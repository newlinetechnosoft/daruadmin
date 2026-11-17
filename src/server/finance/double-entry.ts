import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import {
  accountingPeriods,
  fiscalYears,
  voucherSequences,
  journalEntries,
  journalLines,
  ledgerAccounts,
} from '#/db/schema'
import { getNepalFiscalYear } from '#/lib/nepal-date'
import { PARTY_CONTROLLED_ACCOUNTS, resolveAllAccounts } from './account-keys'
import { ALLOWED_PARTY_TYPES } from './types'
import type {
  CostCenter,
  DbTx,
  FinanceActor,
  JournalLineInput,
  PartyType,
  PostCashHandoverParams,
  PostCustomerPaymentParams,
  PostDealerAdvanceParams,
  PostDealerPurchaseReturnParams,
  PostDealerSettlementParams,
  PostGatewaySettlementParams,
  PostInterBranchTransferParams,
  PostJournalParams,
  PostJournalResult,
  PostOrderDeliveredParams,
  PostRiderAdvanceParams,
  PostRiderPayoutParams,
  PostRiderSalaryAccrualParams,
  PostSalesReturnParams,
  ReverseJournalParams,
  VoucherType,
} from './types'

export type {
  CostCenter,
  DbTx,
  FinanceActor,
  JournalLineInput,
  PartyType,
  PostCashHandoverParams,
  PostCustomerPaymentParams,
  PostDealerAdvanceParams,
  PostDealerPurchaseReturnParams,
  PostDealerSettlementParams,
  PostGatewaySettlementParams,
  PostInterBranchTransferParams,
  PostJournalParams,
  PostJournalResult,
  PostOrderDeliveredParams,
  PostRiderAdvanceParams,
  PostRiderPayoutParams,
  PostRiderSalaryAccrualParams,
  PostSalesReturnParams,
  ReverseJournalParams,
  VoucherType,
}

// Helper for unique ID generation
function nid(prefix = 'id'): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

/**
 * Core Double-Entry Engine.
 * Must run inside an existing dbTx transaction.
 * Enforces:
 *  1. At least 2 lines.
 *  2. All debits >= 0, credits >= 0, exactly one > 0 per line.
 *  3. Balanced entry: sum(debit) === sum(credit) > 0.
 *  4. Open Nepal Fiscal Year check.
 *  5. Gapless sequential voucher numbering with row lock.
 *  6. Idempotency on (refType, refId, event).
 */
export async function postJournalTx(
  tx: DbTx,
  params: PostJournalParams,
): Promise<PostJournalResult> {
  const lines = params.lines
  if (lines.length < 2) {
    throw new Error(
      'A double-entry journal transaction requires at least 2 lines.',
    )
  }

  let totalDebit = 0
  let totalCredit = 0

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]
    const debit = line.debit ?? 0
    const credit = line.credit ?? 0

    if (debit < 0 || credit < 0) {
      throw new Error(
        `Line ${idx + 1}: Negative amounts are prohibited in double-entry.`,
      )
    }
    if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      throw new Error(
        `Line ${idx + 1}: Exactly one of debit or credit must be positive (debit: ${debit}, credit: ${credit}).`,
      )
    }

    // Party validation: allowed partyType (ACC-0.3)
    if (line.partyType && !ALLOWED_PARTY_TYPES.includes(line.partyType)) {
      throw new Error(
        `Line ${idx + 1}: Invalid partyType "${line.partyType}". Allowed party types are: ${ALLOWED_PARTY_TYPES.join(', ')}.`,
      )
    }

    // Party-controlled accounts require both partyType and partyId (ACC-0.3 / G1)
    if (
      (PARTY_CONTROLLED_ACCOUNTS as readonly string[]).includes(line.accountId)
    ) {
      if (!line.partyType || !line.partyId || line.partyId.trim() === '') {
        throw new Error(
          `Line ${idx + 1}: Account "${line.accountId}" is a party-controlled account and requires both partyType and partyId.`,
        )
      }
    }

    totalDebit += debit
    totalCredit += credit
  }

  if (totalDebit !== totalCredit) {
    throw new Error(
      `Unbalanced journal entry! Total Debit (${totalDebit} paisa) must equal Total Credit (${totalCredit} paisa). Difference: ${totalDebit - totalCredit} paisa.`,
    )
  }

  if (totalDebit === 0) {
    throw new Error('Journal transaction amount must be greater than zero.')
  }

  // Idempotency check: if already posted for this (refType, refId, event), return existing record
  if (params.refType && params.refId && params.event) {
    const existing = await tx
      .select({
        id: journalEntries.id,
        voucherNo: journalEntries.voucherNo,
      })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.refType, params.refType),
          eq(journalEntries.refId, params.refId),
          eq(journalEntries.event, params.event),
        ),
      )
      .limit(1)

    if (existing[0]) {
      return {
        journalEntryId: existing[0].id,
        voucherNo: existing[0].voucherNo,
        isDuplicate: true,
      }
    }
  }

  // Validate Chart of Accounts: reject unknown, group, and inactive accounts (ACC-0.3 / G1)
  const uniqueAccountIds = Array.from(new Set(lines.map((l) => l.accountId)))
  const dbAccounts = await tx
    .select({
      id: ledgerAccounts.id,
      name: ledgerAccounts.name,
      isGroup: ledgerAccounts.isGroup,
      isActive: ledgerAccounts.isActive,
    })
    .from(ledgerAccounts)
    .where(inArray(ledgerAccounts.id, uniqueAccountIds))

  const accountMap = new Map(dbAccounts.map((a) => [a.id, a]))

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]
    const acc = accountMap.get(line.accountId)
    if (!acc) {
      throw new Error(
        `Line ${idx + 1}: Account "${line.accountId}" does not exist in Chart of Accounts.`,
      )
    }
    if (acc.isGroup) {
      throw new Error(
        `Line ${idx + 1}: Cannot post to group account "${acc.name}" (${acc.id}). Journal lines must use non-group leaf accounts.`,
      )
    }
    if (!acc.isActive) {
      throw new Error(
        `Line ${idx + 1}: Cannot post to inactive account "${acc.name}" (${acc.id}).`,
      )
    }
  }

  // Resolve Nepal Fiscal Year
  const postingDate = params.postingDate || new Date()
  const fyInfo = getNepalFiscalYear(postingDate)

  const fyRows = await tx
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.id, fyInfo.id))
    .limit(1)

  if (fyRows[0]?.isClosed) {
    throw new Error(
      `Nepal Fiscal Year ${fyRows[0].name} is closed. Postings in closed periods are prohibited.`,
    )
  }

  if (!fyRows[0]) {
    await tx
      .insert(fiscalYears)
      .values({
        id: fyInfo.id,
        name: fyInfo.name,
        startDate: fyInfo.startDate,
        endDate: fyInfo.endDate,
        isClosed: false,
      })
      .onConflictDoNothing()
  }

  const postingStatus = params.postingStatus || 'submitted'
  const voucherType = params.voucherType || 'JV'

  // Verify BS Accounting Period Lock: Prohibit postings in locked/closed monthly periods (unless period closing voucher PC)
  if (voucherType !== 'PC') {
    const lockedPeriod = await tx
      .select({
        id: accountingPeriods.id,
        name: accountingPeriods.name,
        status: accountingPeriods.status,
      })
      .from(accountingPeriods)
      .where(
        and(
          lte(accountingPeriods.startDate, postingDate),
          gte(accountingPeriods.endDate, postingDate),
          eq(accountingPeriods.status, 'closed'),
        ),
      )
      .limit(1)

    if (lockedPeriod[0]) {
      throw new Error(
        `Accounting period "${lockedPeriod[0].name}" is locked. Retro-dated postings in locked periods are prohibited.`,
      )
    }
  }

  let voucherNo: string | null = null

  if (postingStatus !== 'draft') {
    // Gapless sequential numbering with row lock
    const seqRes = await tx.execute(sql`
      SELECT * FROM voucher_sequences
      WHERE fiscal_year_id = ${fyInfo.id} AND voucher_type = ${voucherType}
      FOR UPDATE
    `)

    let nextNo = 1
    let prefix: string = voucherType

    if (seqRes.rows[0]) {
      const currentNo = Number(seqRes.rows[0].last_no) || 0
      nextNo = currentNo + 1
      prefix = String(seqRes.rows[0].prefix || voucherType)
      await tx.execute(sql`
        UPDATE voucher_sequences
        SET last_no = ${nextNo}, updated_at = NOW()
        WHERE fiscal_year_id = ${fyInfo.id} AND voucher_type = ${voucherType}
      `)
    } else {
      await tx.insert(voucherSequences).values({
        id: `seq_${fyInfo.id}_${voucherType}`,
        fiscalYearId: fyInfo.id,
        voucherType,
        prefix,
        lastNo: nextNo,
      })
    }

    const fyYearOnly = fyInfo.name.split('/')[0]
    voucherNo = `${prefix}-${fyYearOnly}-${String(nextNo).padStart(5, '0')}`
  }

  const journalEntryId = nid('je')

  // Insert header
  await tx.insert(journalEntries).values({
    id: journalEntryId,
    voucherNo,
    voucherType,
    fiscalYearId: fyInfo.id,
    branchId: params.branchId || null,
    postingDate,
    narration: params.narration,
    refType: params.refType || null,
    refId: params.refId || null,
    event: params.event || null,
    postingStatus,
    metadata: params.metadata || null,
    createdBy: params.createdBy,
  })

  // Insert lines
  for (const line of lines) {
    await tx.insert(journalLines).values({
      id: nid('jl'),
      journalEntryId,
      branchId: line.branchId || params.branchId || null,
      accountId: line.accountId,
      debit: line.debit ?? 0,
      credit: line.credit ?? 0,
      partyType: line.partyType || null,
      partyId: line.partyId || null,
      costCenter: line.costCenter || null,
      costCenterId: line.costCenterId || null,
      narration: line.narration || null,
    })
  }

  return { journalEntryId, voucherNo }
}

/**
 * Promotes a draft voucher to submitted with gapless sequential voucher number (Phase 3 & 6).
 */
export async function submitDraftJournalTx(
  tx: DbTx,
  params: {
    journalEntryId: string
    actor: FinanceActor
    approvedBy?: string
  },
): Promise<{ journalEntryId: string; voucherNo: string }> {
  const entry = await tx
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.id, params.journalEntryId))
    .limit(1)

  if (!entry[0]) {
    throw new Error(`Journal voucher ${params.journalEntryId} not found.`)
  }

  if (entry[0].postingStatus !== 'draft') {
    throw new Error(
      `Cannot submit voucher in "${entry[0].postingStatus}" status. Only drafts can be submitted.`,
    )
  }

  // Check lines balance
  const lines = await tx
    .select({
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .where(eq(journalLines.journalEntryId, params.journalEntryId))

  if (lines.length < 2) {
    throw new Error('A double-entry voucher requires at least 2 lines.')
  }

  let totalDebit = 0
  let totalCredit = 0
  for (const l of lines) {
    totalDebit += l.debit
    totalCredit += l.credit
  }

  if (totalDebit !== totalCredit || totalDebit <= 0) {
    throw new Error(
      `Unbalanced entry! Debit (${totalDebit} paisa) must equal Credit (${totalCredit} paisa) > 0.`,
    )
  }

  // Fiscal Year check
  const fyInfo = getNepalFiscalYear(entry[0].postingDate)
  const fyRows = await tx
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.id, fyInfo.id))
    .limit(1)

  if (fyRows[0]?.isClosed) {
    throw new Error(`Nepal Fiscal Year ${fyRows[0].name} is closed.`)
  }

  // Lock and allocate voucher number
  const voucherType = entry[0].voucherType || 'JV'
  const seqRes = await tx.execute(sql`
    SELECT * FROM voucher_sequences
    WHERE fiscal_year_id = ${fyInfo.id} AND voucher_type = ${voucherType}
    FOR UPDATE
  `)

  let nextNo = 1
  let prefix: string = voucherType

  if (seqRes.rows[0]) {
    const currentNo = Number(seqRes.rows[0].last_no) || 0
    nextNo = currentNo + 1
    prefix = String(seqRes.rows[0].prefix || voucherType)
    await tx.execute(sql`
      UPDATE voucher_sequences
      SET last_no = ${nextNo}, updated_at = NOW()
      WHERE fiscal_year_id = ${fyInfo.id} AND voucher_type = ${voucherType}
    `)
  } else {
    await tx.insert(voucherSequences).values({
      id: `seq_${fyInfo.id}_${voucherType}`,
      fiscalYearId: fyInfo.id,
      voucherType,
      prefix,
      lastNo: nextNo,
    })
  }

  const fyYearOnly = fyInfo.name.split('/')[0]
  const voucherNo = `${prefix}-${fyYearOnly}-${String(nextNo).padStart(5, '0')}`

  const now = new Date()
  await tx
    .update(journalEntries)
    .set({
      voucherNo,
      postingStatus: params.approvedBy ? 'approved' : 'submitted',
      submittedBy: params.actor.name,
      submittedAt: now,
      approvedBy: params.approvedBy || null,
      approvedAt: params.approvedBy ? now : null,
    })
    .where(eq(journalEntries.id, params.journalEntryId))

  return { journalEntryId: params.journalEntryId, voucherNo }
}

/**
 * Creates an exact reversing journal entry for an existing transaction (Admin only).
 * Hardened per ACC-0.4 (G2):
 * - Blocks reversing an entry that has already been reversed.
 * - Blocks reversing an entry that is itself a reversal.
 * - Guarantees idempotency on (refType: 'journal_reversal', refId: original.id, event: 'reversed').
 * - Implements reversal date policy per ACCOUNT_GUIDE.md §5.4:
 *   defaults to original posting date if its fiscal year is open, otherwise today.
 * - Marks original entry with isReversed: true, reversedBy: reversalEntryId.
 * - Marks reversal entry with reversalOf: original.id.
 */
export async function reverseJournalTx(
  tx: DbTx,
  params: ReverseJournalParams,
): Promise<PostJournalResult> {
  const original = await tx
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.id, params.originalEntryId))
    .limit(1)

  if (!original[0]) {
    throw new Error('Original journal entry not found.')
  }

  // Guard 1: Cannot reverse a reversal entry
  if (original[0].reversalOf) {
    throw new Error(
      `Cannot reverse journal entry "${original[0].voucherNo}" because it is already a reversal of "${original[0].reversalOf}".`,
    )
  }

  // Guard 2: Cannot reverse an entry that has already been reversed (ACC-0.4)
  if (original[0].isReversed || original[0].reversedBy) {
    throw new Error(
      `Journal entry "${original[0].voucherNo}" has already been reversed by "${original[0].reversedBy || 'another reversal'}". Duplicate reversals are prohibited.`,
    )
  }

  // Reversal date policy per ACCOUNT_GUIDE.md §5.4:
  // Default to original posting date if that Nepal Fiscal Year is still open, otherwise today.
  let targetPostingDate: Date
  if (params.postingDate) {
    targetPostingDate = params.postingDate
  } else {
    const origFy = getNepalFiscalYear(new Date(original[0].postingDate))
    const fyRows = await tx
      .select({ id: fiscalYears.id, isClosed: fiscalYears.isClosed })
      .from(fiscalYears)
      .where(eq(fiscalYears.id, origFy.id))
      .limit(1)

    // Check if original period is locked
    const origLocked = await tx
      .select({ id: accountingPeriods.id })
      .from(accountingPeriods)
      .where(
        and(
          lte(accountingPeriods.startDate, new Date(original[0].postingDate)),
          gte(accountingPeriods.endDate, new Date(original[0].postingDate)),
          eq(accountingPeriods.status, 'closed'),
        ),
      )
      .limit(1)

    // If original fiscal year or accounting period is closed, default to current date; otherwise retain original posting date
    if (fyRows[0]?.isClosed || origLocked[0]) {
      targetPostingDate = new Date()
    } else {
      targetPostingDate = new Date(original[0].postingDate)
    }
  }

  const originalLines = await tx
    .select()
    .from(journalLines)
    .where(eq(journalLines.journalEntryId, params.originalEntryId))

  if (originalLines.length === 0) {
    throw new Error('Original journal entry has no lines to reverse.')
  }

  // Invert debit and credit
  const reversedLines: JournalLineInput[] = originalLines.map((l) => ({
    accountId: l.accountId,
    debit: l.credit, // invert
    credit: l.debit, // invert
    partyType: l.partyType as JournalLineInput['partyType'],
    partyId: l.partyId,
    costCenter: l.costCenter as JournalLineInput['costCenter'],
    narration: `Reversal: ${l.narration || original[0].narration}`,
  }))

  const res = await postJournalTx(tx, {
    voucherType: 'JV',
    postingDate: targetPostingDate,
    narration: params.narration,
    refType: 'journal_reversal',
    refId: original[0].id,
    event: 'reversed',
    createdBy: params.createdBy,
    metadata: {
      reversedEntryId: original[0].id,
      reversedVoucherNo: original[0].voucherNo,
      originalPostingDate: original[0].postingDate.toISOString(),
    },
    lines: reversedLines,
  })

  // Mark original entry as reversed and record the reversing entry ID
  await tx
    .update(journalEntries)
    .set({
      isReversed: true,
      reversedBy: res.journalEntryId,
    })
    .where(eq(journalEntries.id, original[0].id))

  // Link reversal on new entry
  await tx
    .update(journalEntries)
    .set({
      reversalOf: original[0].id,
    })
    .where(eq(journalEntries.id, res.journalEntryId))

  return res
}

/**
 * Standard Posting 1: Order Delivered.
 * Posts both customer revenue (COD or Online) and Dealer Procurement COGS in ONE atomic transaction.
 */
export async function postOrderDeliveredTx(
  tx: DbTx,
  params: PostOrderDeliveredParams,
): Promise<PostJournalResult> {
  const { order, items, actor, rider } = params
  const isCOD = order.paymentMethod === 'cod'
  const accounts = await resolveAllAccounts(tx)

  // Calculate VAT breakdown:
  // Prices in Nepal are 13% VAT inclusive.
  // Taxable amount = ROUND(subtotal / 1.13)
  const vatAmount =
    order.tax && order.tax > 0
      ? order.tax
      : Math.round((order.subtotal * 13) / 113)
  const netSales = order.subtotal - vatAmount
  const lines: JournalLineInput[] = []

  // A. Debit Payment Asset
  if (isCOD) {
    // Dr. Rider Undeposited COD Cash (Asset) with rider party
    lines.push({
      accountId: accounts.RIDER_COD_CASH,
      debit: order.total,
      partyType: 'rider',
      partyId: order.riderId,
      costCenter: 'delivery',
      narration: `COD collected for order ${order.number}`,
    })
  } else {
    // Dr. eSewa Clearing Account (Asset)
    lines.push({
      accountId: accounts.ESEWA_CLEARING,
      debit: order.total,
      partyType: 'customer',
      partyId: order.customerId || null,
      costCenter: 'general',
      narration: `Online payment cleared for order ${order.number}`,
    })
  }

  // B. Debit Discounts Allowed if any discount was given
  if (order.discount > 0) {
    lines.push({
      accountId: accounts.DISCOUNTS,
      debit: order.discount,
      costCenter: 'general',
      narration: `Discount allowed on order ${order.number}`,
    })
  }

  // C. Credit Sales Revenue Net (Income)
  lines.push({
    accountId: accounts.SALES,
    credit: netSales,
    costCenter: 'general',
    narration: `Net sales revenue from order ${order.number}`,
  })

  // D. Credit VAT Output Payable 13% (Liability)
  if (vatAmount > 0) {
    lines.push({
      accountId: accounts.VAT_OUTPUT,
      credit: vatAmount,
      costCenter: 'general',
      narration: `13% Output VAT on order ${order.number}`,
    })
  }

  // E. Credit Delivery Fee Income (Income)
  if (order.deliveryCharge > 0) {
    lines.push({
      accountId: accounts.DELIVERY_INCOME,
      credit: order.deliveryCharge,
      costCenter: 'delivery',
      narration: `Delivery fee charged on order ${order.number}`,
    })
  }

  // F. Sourcing COGS & Dealer Procurement Payables
  // Group dealer cost by dealer and catalog type
  const dealerCostGroups = new Map<
    string,
    { dealerId: string; liquorCost: number; foodCost: number }
  >()

  for (const it of items) {
    if (it.dealerId && it.dealerCostPrice && it.dealerCostPrice > 0) {
      const lineCost = it.dealerCostPrice * it.qty
      const existing = dealerCostGroups.get(it.dealerId) || {
        dealerId: it.dealerId,
        liquorCost: 0,
        foodCost: 0,
      }
      if (it.catalogType === 'liquor') {
        existing.liquorCost += lineCost
      } else {
        existing.foodCost += lineCost
      }
      dealerCostGroups.set(it.dealerId, existing)
    }
  }

  for (const g of dealerCostGroups.values()) {
    const totalDealerCost = g.liquorCost + g.foodCost
    if (totalDealerCost > 0) {
      if (g.liquorCost > 0) {
        lines.push({
          accountId: accounts.COGS_LIQUOR,
          debit: g.liquorCost,
          costCenter: 'liquor',
          narration: `COGS Liquor sourced for order ${order.number}`,
        })
      }
      if (g.foodCost > 0) {
        lines.push({
          accountId: accounts.COGS_FOOD,
          debit: g.foodCost,
          costCenter: 'food',
          narration: `COGS Food sourced for order ${order.number}`,
        })
      }
      lines.push({
        accountId: accounts.DEALER_PAYABLE,
        credit: totalDealerCost,
        partyType: 'dealer',
        partyId: g.dealerId,
        costCenter: 'general',
        narration: `Procurement payable to dealer for order ${order.number}`,
      })
    }
  }

  // G. Rider Delivery Pay & Commission Accrual
  if (rider && order.riderId) {
    const perDrop = rider.perDropRate ?? 5000 // default Rs. 50
    const commissionPct = rider.commissionRate ?? 10
    const commission = Math.round(order.deliveryCharge * (commissionPct / 100))
    const riderCompensation = perDrop + commission

    if (riderCompensation > 0) {
      lines.push({
        accountId: accounts.RIDER_EXPENSE,
        debit: riderCompensation,
        partyType: 'rider',
        partyId: rider.id,
        costCenter: 'delivery',
        narration: `Delivery compensation accrued for rider ${rider.name} on order ${order.number}`,
      })
      lines.push({
        accountId: accounts.RIDER_PAYABLE,
        credit: riderCompensation,
        partyType: 'rider',
        partyId: rider.id,
        costCenter: 'delivery',
        narration: `Accrued compensation payable to rider ${rider.name} for order ${order.number}`,
      })
    }
  }

  return postJournalTx(tx, {
    voucherType: 'SV', // Sales Voucher
    postingDate: new Date(),
    narration: `Order ${order.number} delivered (${order.customerName})`,
    refType: 'order',
    refId: order.id,
    event: 'order_delivered',
    createdBy: actor.name,
    metadata: {
      orderId: order.id,
      orderNumber: order.number,
      paymentMethod: order.paymentMethod,
      total: order.total,
    },
    lines,
  })
}

/**
 * Standard Posting 2: Rider Cash Handover / Settlement.
 * Dr. Cash in Hand (ACCOUNT_KEYS.CASH_IN_HAND) or Bank (ACCOUNT_KEYS.BANK_MAIN)
 * Cr. Rider Undeposited COD Cash (ACCOUNT_KEYS.RIDER_COD_CASH) with rider party
 */
export async function postCashHandoverTx(
  tx: DbTx,
  params: PostCashHandoverParams,
): Promise<PostJournalResult> {
  const {
    handoverId,
    riderId,
    riderName,
    amount,
    paymentMethod = 'cash',
    actor,
  } = params
  if (amount <= 0) {
    throw new Error('Cash handover amount must be greater than zero.')
  }
  const accounts = await resolveAllAccounts(tx)
  const receivedIntoAccount =
    paymentMethod === 'cash' ? accounts.CASH_IN_HAND : accounts.BANK_MAIN
  const methodLabel =
    paymentMethod === 'cash'
      ? 'Cash'
      : paymentMethod === 'bank_transfer'
        ? 'Bank transfer'
        : 'Cheque'

  return postJournalTx(tx, {
    voucherType: 'RV', // Receipt Voucher
    postingDate: new Date(),
    narration: `Rider ${methodLabel.toLowerCase()} settlement received from ${riderName}`,
    refType: 'rider_cash_handover',
    refId: handoverId,
    event: 'cash_handover',
    createdBy: actor.name,
    metadata: { riderId, riderName, amount, paymentMethod },
    lines: [
      {
        accountId: receivedIntoAccount,
        debit: amount,
        costCenter: 'general',
        narration: `${methodLabel} settlement received from rider ${riderName}`,
      },
      {
        accountId: accounts.RIDER_COD_CASH,
        credit: amount,
        partyType: 'rider',
        partyId: riderId,
        costCenter: 'delivery',
        narration: `Rider COD cash liability cleared for ${riderName}`,
      },
    ],
  })
}

/**
 * Standard Posting 3: Dealer Settlement Payment.
 * Dr. Dealer Procurement Payable (DEALER_PAYABLE) [Gross Amount]
 * Cr. Main Operating Bank Account (BANK_MAIN) / Cash (CASH_IN_HAND) [Net Payout]
 * Cr. TDS Withholding Tax Payable (TDS_PAYABLE) [TDS Amount if applicable]
 */
export async function postDealerSettlementTx(
  tx: DbTx,
  params: PostDealerSettlementParams,
): Promise<PostJournalResult> {
  const {
    settlementId,
    dealerId,
    dealerName,
    grossAmount,
    tdsRate = 0,
    paymentAccount = 'bank',
    actor,
  } = params

  if (grossAmount <= 0) {
    throw new Error('Settlement gross amount must be greater than zero.')
  }

  const accounts = await resolveAllAccounts(tx)
  const tdsAmount = tdsRate > 0 ? Math.round(grossAmount * (tdsRate / 100)) : 0
  const netPaid = grossAmount - tdsAmount
  const payoutAccountId =
    paymentAccount === 'cash' ? accounts.CASH_IN_HAND : accounts.BANK_MAIN

  const lines: JournalLineInput[] = [
    {
      accountId: accounts.DEALER_PAYABLE,
      debit: grossAmount,
      partyType: 'dealer',
      partyId: dealerId,
      costCenter: 'general',
      narration: `Procurement settlement payout for ${dealerName}`,
    },
    {
      accountId: payoutAccountId,
      credit: netPaid,
      costCenter: 'general',
      narration: `Payout disbursed to ${dealerName} via ${paymentAccount}`,
    },
  ]

  if (tdsAmount > 0) {
    lines.push({
      accountId: accounts.TDS_PAYABLE,
      credit: tdsAmount,
      costCenter: 'general',
      narration: `TDS withholding (${tdsRate}%) deducted on payment to ${dealerName}`,
    })
  }

  return postJournalTx(tx, {
    voucherType: 'PV', // Payment Voucher
    postingDate: new Date(),
    narration: `Procurement settlement payment to ${dealerName}`,
    refType: 'dealer_settlement',
    refId: settlementId,
    event: 'dealer_settlement',
    createdBy: actor.name,
    metadata: { dealerId, dealerName, grossAmount, tdsRate, netPaid },
    lines,
  })
}

/**
 * Standard Posting: Rider Monthly Fixed Base Salary Accrual.
 * Dr. Rider Compensation Expense (ACCOUNT_KEYS.RIDER_EXPENSE)
 * Cr. Rider Payable (ACCOUNT_KEYS.RIDER_PAYABLE)
 */
export async function postRiderSalaryAccrualTx(
  tx: DbTx,
  params: PostRiderSalaryAccrualParams,
): Promise<PostJournalResult> {
  const { settlementId, riderId, riderName, baseSalaryAmount, actor } = params
  if (baseSalaryAmount <= 0) {
    throw new Error('Base salary accrual must be greater than zero.')
  }
  const accounts = await resolveAllAccounts(tx)

  return postJournalTx(tx, {
    voucherType: 'JV',
    postingDate: new Date(),
    narration: `Monthly base salary accrued for courier ${riderName}`,
    refType: 'payroll',
    refId: settlementId,
    event: 'rider_salary_accrual',
    createdBy: actor.name,
    metadata: { riderId, riderName, baseSalaryAmount },
    lines: [
      {
        accountId: accounts.RIDER_EXPENSE,
        debit: baseSalaryAmount,
        partyType: 'rider',
        partyId: riderId,
        costCenter: 'delivery',
        narration: `Monthly fixed base salary for rider ${riderName}`,
      },
      {
        accountId: accounts.RIDER_PAYABLE,
        credit: baseSalaryAmount,
        partyType: 'rider',
        partyId: riderId,
        costCenter: 'delivery',
        narration: `Monthly base salary payable to rider ${riderName}`,
      },
    ],
  })
}

/**
 * Standard Posting 4: Rider Salary / Commission Payout & Deductions.
 * Dr. Rider Payable (RIDER_PAYABLE) [Gross Amount]
 * Cr. Cash in Hand (CASH_IN_HAND) / Bank (BANK_MAIN) [Net Payout]
 * Cr. Rider Undeposited COD Cash (RIDER_COD_CASH) [Cash Shortage Deducted]
 * Cr. Staff & Rider Advances (STAFF_RIDER_ADVANCES) [Advances Deducted]
 */
export async function postRiderPayoutTx(
  tx: DbTx,
  params: PostRiderPayoutParams,
): Promise<PostJournalResult> {
  const {
    settlementId,
    riderId,
    riderName,
    paymentAccount = 'cash',
    actor,
  } = params

  const gross = params.grossAmount ?? params.amount ?? 0
  const shortage = params.cashShortageDeducted ?? 0
  const advances = params.advancesDeducted ?? 0
  const net =
    params.netPaid ??
    (params.amount
      ? params.amount - shortage - advances
      : gross - shortage - advances)

  if (gross <= 0) {
    throw new Error('Payout gross amount must be greater than zero.')
  }

  const accounts = await resolveAllAccounts(tx)
  const payoutAccountId =
    paymentAccount === 'cash' ? accounts.CASH_IN_HAND : accounts.BANK_MAIN

  const lines: JournalLineInput[] = [
    {
      accountId: accounts.RIDER_PAYABLE,
      debit: gross,
      partyType: 'rider',
      partyId: riderId,
      costCenter: 'delivery',
      narration: `Settlement gross payable cleared for rider ${riderName}`,
    },
  ]

  if (net > 0) {
    lines.push({
      accountId: payoutAccountId,
      credit: net,
      costCenter: 'delivery',
      narration: `Payout disbursed to rider ${riderName} via ${paymentAccount}`,
    })
  }

  if (shortage > 0) {
    lines.push({
      accountId: accounts.RIDER_COD_CASH,
      credit: shortage,
      partyType: 'rider',
      partyId: riderId,
      costCenter: 'delivery',
      narration: `COD cash shortage deducted from payroll for rider ${riderName}`,
    })
  }

  if (advances > 0) {
    lines.push({
      accountId: accounts.STAFF_RIDER_ADVANCES,
      credit: advances,
      partyType: 'rider',
      partyId: riderId,
      costCenter: 'delivery',
      narration: `Advance recovery deducted from payroll for rider ${riderName}`,
    })
  }

  return postJournalTx(tx, {
    voucherType: 'PV', // Payment Voucher
    postingDate: new Date(),
    narration: `Rider payout disbursed to ${riderName}`,
    refType: 'payroll',
    refId: settlementId,
    event: 'rider_payout',
    createdBy: actor.name,
    metadata: {
      riderId,
      riderName,
      grossAmount: gross,
      netPaid: net,
      shortageDeducted: shortage,
      advancesDeducted: advances,
      paymentAccount,
    },
    lines,
  })
}

/**
 * Standard Posting 5: Contra Voucher (Phase 7 / ACC-3.3).
 * Internal cash and bank transfers (Cash to Bank, Bank to Cash, Bank to Bank).
 * Dr. Destination Account (Bank/Cash)
 * Cr. Source Account (Bank/Cash)
 */
export async function postContraVoucherTx(
  tx: DbTx,
  params: {
    fromAccountId: string
    toAccountId: string
    amount: number // paisa
    narration: string
    branchId?: string | null
    postingDate?: Date
    actor: FinanceActor
  },
): Promise<PostJournalResult> {
  const { fromAccountId, toAccountId, amount, narration, branchId, postingDate, actor } = params

  if (amount <= 0) {
    throw new Error('Contra voucher amount must be greater than zero.')
  }
  if (fromAccountId === toAccountId) {
    throw new Error('Source and destination accounts in a contra voucher must be different.')
  }

  return postJournalTx(tx, {
    voucherType: 'CV',
    postingDate: postingDate || new Date(),
    narration,
    refType: 'contra',
    refId: nid('con'),
    event: 'internal_transfer',
    branchId: branchId || null,
    createdBy: actor.name,
    metadata: { fromAccountId, toAccountId, amount },
    lines: [
      {
        accountId: toAccountId,
        debit: amount,
        branchId: branchId || null,
        costCenter: 'general',
        narration: `Deposit/Transfer into destination account`,
      },
      {
        accountId: fromAccountId,
        credit: amount,
        branchId: branchId || null,
        costCenter: 'general',
        narration: `Withdrawal/Transfer from source account`,
      },
    ],
  })
}

/**
 * Standard Posting 6: Expense Payment (Phase 8 / ACC-3.4).
 * Dr. Expense Category Account (Net Expense)
 * Dr. VAT Input Account (if tax amount > 0)
 * Cr. Payment Account (Cash / Bank / Payable)
 */
export async function postExpensePaymentTx(
  tx: DbTx,
  params: {
    expenseId: string
    expenseNumber: string
    categoryAccountId: string
    paymentAccountId: string
    amount: number // total paisa (gross)
    taxAmount?: number // tax paisa (VAT input)
    tdsAmount?: number // TDS deduction paisa
    vendorName?: string | null
    branchId?: string | null
    costCenterId?: string | null
    narration: string
    postingDate?: Date
    actor: FinanceActor
  },
): Promise<PostJournalResult> {
  const {
    expenseId,
    expenseNumber,
    categoryAccountId,
    paymentAccountId,
    amount,
    taxAmount = 0,
    tdsAmount = 0,
    vendorName,
    branchId,
    costCenterId,
    narration,
    postingDate,
    actor,
  } = params

  if (amount <= 0) {
    throw new Error('Expense amount must be greater than zero.')
  }

  const accounts = await resolveAllAccounts(tx)
  const netExpense = amount - (taxAmount || 0)
  if (netExpense < 0) {
    throw new Error('Tax amount cannot exceed total expense amount.')
  }
  if (tdsAmount < 0 || tdsAmount > amount) {
    throw new Error('TDS withholding cannot be negative or exceed total expense amount.')
  }

  const lines: JournalLineInput[] = []

  // Dr. Expense Category Account (Net Expense)
  lines.push({
    accountId: categoryAccountId,
    debit: netExpense,
    branchId: branchId || null,
    costCenterId: costCenterId || null,
    narration: `Expense: ${narration}${vendorName ? ` (${vendorName})` : ''}`,
  })

  // Dr. VAT Input (if applicable)
  if (taxAmount > 0) {
    lines.push({
      accountId: accounts.VAT_INPUT,
      debit: taxAmount,
      branchId: branchId || null,
      costCenterId: costCenterId || null,
      narration: `Input tax on expense ${expenseNumber}`,
    })
  }

  // Cr. TDS Withholding Tax Payable (if TDS is deducted)
  if (tdsAmount > 0) {
    lines.push({
      accountId: accounts.TDS_PAYABLE,
      credit: tdsAmount,
      branchId: branchId || null,
      costCenterId: costCenterId || null,
      narration: `TDS withheld on expense ${expenseNumber}${vendorName ? ` (${vendorName})` : ''}`,
    })
  }

  // Cr. Payment Account (Cash/Bank) for Net Disbursed: (amount - tdsAmount)
  const netDisbursed = amount - tdsAmount
  if (netDisbursed > 0) {
    lines.push({
      accountId: paymentAccountId,
      credit: netDisbursed,
      branchId: branchId || null,
      costCenterId: costCenterId || null,
      narration: `Payment for expense ${expenseNumber}`,
    })
  }

  return postJournalTx(tx, {
    voucherType: 'PV',
    postingDate: postingDate || new Date(),
    narration: `Expense ${expenseNumber}: ${narration}`,
    refType: 'expense',
    refId: expenseId,
    event: 'expense_paid',
    branchId: branchId || null,
    createdBy: actor.name,
    metadata: {
      expenseId,
      expenseNumber,
      amount,
      taxAmount,
      tdsAmount,
      netDisbursed,
      vendorName: vendorName || null,
    },
    lines,
  })
}

/**
 * Standard Posting 7: Period Closing Voucher (Phase 13 / ACC-5.1).
 * Transfers all P&L income and expense balances for a Fiscal Year into Retained Earnings.
 */
export async function postPeriodClosingTx(
  tx: DbTx,
  params: {
    fiscalYearId: string
    fiscalYearName: string
    lines: JournalLineInput[]
    retainedEarningsAccountId: string
    netProfitOrLoss: number // paisa
    narration: string
    postingDate: Date
    actor: FinanceActor
  },
): Promise<PostJournalResult> {
  const { fiscalYearId, fiscalYearName, lines, retainedEarningsAccountId, netProfitOrLoss, narration, postingDate, actor } = params

  return postJournalTx(tx, {
    voucherType: 'PC',
    postingDate,
    narration: narration || `Year-end closing voucher for FY ${fiscalYearName}`,
    refType: 'closing',
    refId: fiscalYearId,
    event: 'period_closing',
    createdBy: actor.name,
    metadata: {
      fiscalYearId,
      fiscalYearName,
      netProfitOrLoss,
      retainedEarningsAccountId,
    },
    lines,
  })
}

/**
 * Standard Posting 8: Sales Return / Credit Note (Phase 3).
 * Dr. Sales Revenue (SALES) [Subtotal - Tax]
 * Dr. Output VAT Payable 13% (VAT_OUTPUT) [Tax]
 * Cr. Discounts Allowed (DISCOUNTS) [Discount, if any]
 * Cr. Customer Payment Asset / Customer Receivable [Refund Amount]
 * Optional: Reverses dealer payable and COGS for returned inventory.
 */
export async function postSalesReturnTx(
  tx: DbTx,
  params: PostSalesReturnParams,
): Promise<PostJournalResult> {
  const {
    returnId,
    orderId,
    orderNumber,
    customerId,
    customerName,
    subtotal,
    tax = 0,
    discount = 0,
    refundAmount,
    refundMethod,
    dealerCostToReverse = [],
    branchId,
    actor,
  } = params

  if (refundAmount <= 0) {
    throw new Error('Refund amount must be greater than zero.')
  }

  const accounts = await resolveAllAccounts(tx)
  const netSales = subtotal - tax
  const lines: JournalLineInput[] = []

  // 1. Dr. Sales Revenue (reversal)
  if (netSales > 0) {
    lines.push({
      accountId: accounts.SALES,
      debit: netSales,
      branchId: branchId || null,
      costCenter: 'general',
      narration: `Sales return on order ${orderNumber}`,
    })
  }

  // 2. Dr. VAT Output (reversal of tax liability)
  if (tax > 0) {
    lines.push({
      accountId: accounts.VAT_OUTPUT,
      debit: tax,
      branchId: branchId || null,
      costCenter: 'general',
      narration: `Output VAT reversal on return for order ${orderNumber}`,
    })
  }

  // 3. Cr. Discounts (reversal of discount)
  if (discount > 0) {
    lines.push({
      accountId: accounts.DISCOUNTS,
      credit: discount,
      branchId: branchId || null,
      costCenter: 'general',
      narration: `Discount reversal on return for order ${orderNumber}`,
    })
  }

  // 4. Cr. Refund method (Cash / Bank / Customer Credit)
  let refundAccountId = accounts.CASH_IN_HAND
  let refundPartyType: PartyType | null = null
  let refundPartyId: string | null = null

  if (refundMethod === 'bank') {
    refundAccountId = accounts.BANK_MAIN
  } else if (refundMethod === 'customer_credit') {
    refundAccountId = accounts.CUSTOMER_RECEIVABLE
    refundPartyType = 'customer'
    refundPartyId = customerId || 'cust_walkin'
  }

  lines.push({
    accountId: refundAccountId,
    credit: refundAmount,
    partyType: refundPartyType,
    partyId: refundPartyId,
    branchId: branchId || null,
    costCenter: 'general',
    narration: `Refund disbursed for return on order ${orderNumber} via ${refundMethod}`,
  })

  // 5. Dealer sourcing reversal if returned to dealer
  for (const item of dealerCostToReverse) {
    if (item.amount > 0) {
      lines.push({
        accountId: accounts.DEALER_PAYABLE,
        debit: item.amount,
        partyType: 'dealer',
        partyId: item.dealerId,
        branchId: branchId || null,
        costCenter: 'general',
        narration: `Dealer procurement payable reversal on return for order ${orderNumber}`,
      })
      lines.push({
        accountId: item.catalogType === 'liquor' ? accounts.COGS_LIQUOR : accounts.COGS_FOOD,
        credit: item.amount,
        branchId: branchId || null,
        costCenter: item.catalogType === 'liquor' ? 'liquor' : 'food',
        narration: `COGS reversal on return for order ${orderNumber}`,
      })
    }
  }

  return postJournalTx(tx, {
    voucherType: 'CN', // Credit Note
    postingDate: new Date(),
    narration: `Credit Note / Sales Return for order ${orderNumber}${customerName ? ` (${customerName})` : ''}`,
    refType: 'sales_return',
    refId: returnId,
    event: 'sales_returned',
    branchId: branchId || null,
    createdBy: actor.name,
    metadata: {
      returnId,
      orderId,
      orderNumber,
      customerId: customerId || null,
      customerName: customerName || null,
      refundAmount,
      refundMethod,
    },
    lines,
  })
}

/**
 * Standard Posting 9: Customer Trade Payment / Credit Receipt (Phase 3 & 4).
 * Dr. Payment Account (Cash / Bank / eSewa / Khalti)
 * Cr. Customer Trade Receivables (CUSTOMER_RECEIVABLE)
 */
export async function postCustomerPaymentTx(
  tx: DbTx,
  params: PostCustomerPaymentParams,
): Promise<PostJournalResult> {
  const {
    paymentId,
    customerId,
    customerName,
    amount,
    paymentMethod,
    branchId,
    narration,
    actor,
  } = params

  if (amount <= 0) {
    throw new Error('Payment amount must be greater than zero.')
  }

  const accounts = await resolveAllAccounts(tx)
  let receivingAccountId = accounts.CASH_IN_HAND
  if (paymentMethod === 'bank') receivingAccountId = accounts.BANK_MAIN
  else if (paymentMethod === 'esewa') receivingAccountId = accounts.ESEWA_CLEARING
  else if (paymentMethod === 'khalti') receivingAccountId = accounts.KHALTI_CLEARING

  return postJournalTx(tx, {
    voucherType: 'RV',
    postingDate: new Date(),
    narration: narration || `Customer payment received from ${customerName}`,
    refType: 'customer_payment',
    refId: paymentId,
    event: 'customer_payment_received',
    branchId: branchId || null,
    createdBy: actor.name,
    metadata: { paymentId, customerId, customerName, amount, paymentMethod },
    lines: [
      {
        accountId: receivingAccountId,
        debit: amount,
        branchId: branchId || null,
        costCenter: 'general',
        narration: `Payment received via ${paymentMethod} from ${customerName}`,
      },
      {
        accountId: accounts.CUSTOMER_RECEIVABLE,
        credit: amount,
        partyType: 'customer',
        partyId: customerId,
        branchId: branchId || null,
        costCenter: 'general',
        narration: `Receivable balance cleared by ${customerName}`,
      },
    ],
  })
}

/**
 * Standard Posting 10: Dealer Advance Payment (Phase 3 & 4).
 * Dr. Staff & Dealer Advances (STAFF_RIDER_ADVANCES)
 * Cr. Cash / Bank
 */
export async function postDealerAdvanceTx(
  tx: DbTx,
  params: PostDealerAdvanceParams,
): Promise<PostJournalResult> {
  const {
    advanceId,
    dealerId,
    dealerName,
    amount,
    paymentMethod = 'bank',
    branchId,
    narration,
    actor,
  } = params

  if (amount <= 0) {
    throw new Error('Advance amount must be greater than zero.')
  }

  const accounts = await resolveAllAccounts(tx)
  const disbursingAccount =
    paymentMethod === 'cash' ? accounts.CASH_IN_HAND : accounts.BANK_MAIN

  return postJournalTx(tx, {
    voucherType: 'PV',
    postingDate: new Date(),
    narration: narration || `Advance disbursement to dealer ${dealerName}`,
    refType: 'dealer_advance',
    refId: advanceId,
    event: 'dealer_advance_paid',
    branchId: branchId || null,
    createdBy: actor.name,
    metadata: { advanceId, dealerId, dealerName, amount, paymentMethod },
    lines: [
      {
        accountId: accounts.STAFF_RIDER_ADVANCES,
        debit: amount,
        partyType: 'dealer',
        partyId: dealerId,
        branchId: branchId || null,
        costCenter: 'general',
        narration: `Procurement advance issued to dealer ${dealerName}`,
      },
      {
        accountId: disbursingAccount,
        credit: amount,
        branchId: branchId || null,
        costCenter: 'general',
        narration: `Advance disbursed via ${paymentMethod} to ${dealerName}`,
      },
    ],
  })
}

/**
 * Standard Posting 11: Rider Advance Payment (Phase 3 & 4).
 * Dr. Staff & Rider Advances (STAFF_RIDER_ADVANCES)
 * Cr. Cash / Bank
 */
export async function postRiderAdvanceTx(
  tx: DbTx,
  params: PostRiderAdvanceParams,
): Promise<PostJournalResult> {
  const {
    advanceId,
    riderId,
    riderName,
    amount,
    paymentMethod = 'cash',
    branchId,
    narration,
    actor,
  } = params

  if (amount <= 0) {
    throw new Error('Advance amount must be greater than zero.')
  }

  const accounts = await resolveAllAccounts(tx)
  const disbursingAccount =
    paymentMethod === 'bank' ? accounts.BANK_MAIN : accounts.CASH_IN_HAND

  return postJournalTx(tx, {
    voucherType: 'PV',
    postingDate: new Date(),
    narration: narration || `Advance disbursement to courier ${riderName}`,
    refType: 'rider_advance',
    refId: advanceId,
    event: 'rider_advance_paid',
    branchId: branchId || null,
    createdBy: actor.name,
    metadata: { advanceId, riderId, riderName, amount, paymentMethod },
    lines: [
      {
        accountId: accounts.STAFF_RIDER_ADVANCES,
        debit: amount,
        partyType: 'rider',
        partyId: riderId,
        branchId: branchId || null,
        costCenter: 'delivery',
        narration: `Staff advance issued to courier ${riderName}`,
      },
      {
        accountId: disbursingAccount,
        credit: amount,
        branchId: branchId || null,
        costCenter: 'delivery',
        narration: `Advance disbursed via ${paymentMethod} to courier ${riderName}`,
      },
    ],
  })
}

/**
 * Standard Posting 12: Gateway Settlement into Bank (Phase 3).
 * Dr. Main Bank Account (BANK_MAIN) [Net Amount]
 * Dr. Payment Gateway Commission (GATEWAY_FEES) [Fee Amount]
 * Cr. Gateway Clearing Account (ESEWA_CLEARING / KHALTI_CLEARING) [Gross Amount]
 */
export async function postGatewaySettlementTx(
  tx: DbTx,
  params: PostGatewaySettlementParams,
): Promise<PostJournalResult> {
  const {
    settlementId,
    gateway,
    grossAmount,
    feeAmount,
    netBankAmount,
    referenceNo,
    branchId,
    actor,
  } = params

  if (grossAmount <= 0) {
    throw new Error('Gateway settlement gross amount must be greater than zero.')
  }
  if (netBankAmount + feeAmount !== grossAmount) {
    throw new Error(
      `Gateway settlement unbalanced: net amount (${netBankAmount}) + fee (${feeAmount}) must equal gross amount (${grossAmount}).`,
    )
  }

  const accounts = await resolveAllAccounts(tx)
  const clearingAccountId =
    gateway === 'khalti' ? accounts.KHALTI_CLEARING : accounts.ESEWA_CLEARING
  const gatewayLabel = gateway === 'khalti' ? 'Khalti' : 'eSewa'

  const lines: JournalLineInput[] = [
    {
      accountId: accounts.BANK_MAIN,
      debit: netBankAmount,
      branchId: branchId || null,
      costCenter: 'general',
      narration: `${gatewayLabel} payout deposited into main bank${referenceNo ? ` (Ref: ${referenceNo})` : ''}`,
    },
  ]

  if (feeAmount > 0) {
    lines.push({
      accountId: accounts.GATEWAY_FEES,
      debit: feeAmount,
      branchId: branchId || null,
      costCenter: 'general',
      narration: `${gatewayLabel} transaction processing fee deducted`,
    })
  }

  lines.push({
    accountId: clearingAccountId,
    credit: grossAmount,
    branchId: branchId || null,
    costCenter: 'general',
    narration: `${gatewayLabel} clearing balance transferred to bank`,
  })

  return postJournalTx(tx, {
    voucherType: 'CV',
    postingDate: new Date(),
    narration: `${gatewayLabel} settlement batch${referenceNo ? ` #${referenceNo}` : ''}`,
    refType: 'gateway_settlement',
    refId: settlementId,
    event: 'gateway_funds_settled',
    branchId: branchId || null,
    createdBy: actor.name,
    metadata: { settlementId, gateway, grossAmount, feeAmount, netBankAmount, referenceNo },
    lines,
  })
}

/**
 * Standard Posting 13: Dealer Purchase Return / Debit Note (Phase 3 & 4).
 * Dr. Dealer Payable (DEALER_PAYABLE)
 * Cr. Cost of Goods Sold (COGS_LIQUOR / COGS_FOOD)
 */
export async function postDealerPurchaseReturnTx(
  tx: DbTx,
  params: PostDealerPurchaseReturnParams,
): Promise<PostJournalResult> {
  const {
    returnId,
    dealerId,
    dealerName,
    catalogType,
    amount,
    reason,
    branchId,
    actor,
  } = params

  if (amount <= 0) {
    throw new Error('Purchase return amount must be greater than zero.')
  }

  const accounts = await resolveAllAccounts(tx)
  const cogsAccount =
    catalogType === 'liquor' ? accounts.COGS_LIQUOR : accounts.COGS_FOOD

  return postJournalTx(tx, {
    voucherType: 'DN', // Debit Note
    postingDate: new Date(),
    narration: `Purchase return / Debit note to ${dealerName}${reason ? `: ${reason}` : ''}`,
    refType: 'purchase_return',
    refId: returnId,
    event: 'purchase_return_debited',
    branchId: branchId || null,
    createdBy: actor.name,
    metadata: { returnId, dealerId, dealerName, catalogType, amount, reason },
    lines: [
      {
        accountId: accounts.DEALER_PAYABLE,
        debit: amount,
        partyType: 'dealer',
        partyId: dealerId,
        branchId: branchId || null,
        costCenter: 'general',
        narration: `Debit note issued to dealer ${dealerName}`,
      },
      {
        accountId: cogsAccount,
        credit: amount,
        branchId: branchId || null,
        costCenter: catalogType,
        narration: `Procurement COGS reversed for returned items from ${dealerName}`,
      },
    ],
  })
}

/**
 * Standard Posting 14: Inter-Branch Fund Transfer (Phase 5).
 * Transfers funds between two company branches.
 * Dr. Destination Branch Account (Bank/Cash with toBranchId)
 * Cr. Source Branch Account (Bank/Cash with fromBranchId)
 */
export async function postInterBranchTransferTx(
  tx: DbTx,
  params: PostInterBranchTransferParams,
): Promise<PostJournalResult> {
  const {
    fromBranchId,
    fromBranchName,
    toBranchId,
    toBranchName,
    fromAccountId,
    toAccountId,
    amount,
    narration,
    postingDate,
    actor,
  } = params

  if (amount <= 0) {
    throw new Error('Inter-branch transfer amount must be greater than zero.')
  }
  if (fromBranchId === toBranchId && fromAccountId === toAccountId) {
    throw new Error('Source and destination account cannot be identical in the same branch.')
  }

  const memo =
    narration?.trim() ||
    `Inter-branch fund transfer: ${fromBranchName} -> ${toBranchName}`

  return postJournalTx(tx, {
    voucherType: 'CV',
    postingDate: postingDate || new Date(),
    narration: memo,
    refType: 'inter_branch_transfer',
    refId: nid('ibt'),
    event: 'inter_branch_transferred',
    branchId: fromBranchId,
    createdBy: actor.name,
    metadata: {
      fromBranchId,
      fromBranchName,
      toBranchId,
      toBranchName,
      fromAccountId,
      toAccountId,
      amount,
    },
    lines: [
      {
        accountId: toAccountId,
        debit: amount,
        branchId: toBranchId,
        costCenter: 'general',
        narration: `Transfer received at ${toBranchName} from ${fromBranchName}`,
      },
      {
        accountId: fromAccountId,
        credit: amount,
        branchId: fromBranchId,
        costCenter: 'general',
        narration: `Transfer disbursed from ${fromBranchName} to ${toBranchName}`,
      },
    ],
  })
}
