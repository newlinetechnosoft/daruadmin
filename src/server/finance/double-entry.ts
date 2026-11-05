import { and, eq, inArray, sql } from 'drizzle-orm'
import {
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
  PostDealerSettlementParams,
  PostJournalParams,
  PostJournalResult,
  PostOrderDeliveredParams,
  PostRiderPayoutParams,
  PostRiderSalaryAccrualParams,
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
  PostDealerSettlementParams,
  PostJournalParams,
  PostJournalResult,
  PostOrderDeliveredParams,
  PostRiderPayoutParams,
  PostRiderSalaryAccrualParams,
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

  // Gapless sequential numbering with row lock
  const voucherType = params.voucherType || 'JV'
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
  const journalEntryId = nid('je')

  // Insert header
  await tx.insert(journalEntries).values({
    id: journalEntryId,
    voucherNo,
    voucherType,
    fiscalYearId: fyInfo.id,
    postingDate,
    narration: params.narration,
    refType: params.refType || null,
    refId: params.refId || null,
    event: params.event || null,
    postingStatus: 'submitted',
    metadata: params.metadata || null,
    createdBy: params.createdBy,
  })

  // Insert lines
  for (const line of lines) {
    await tx.insert(journalLines).values({
      id: nid('jl'),
      journalEntryId,
      accountId: line.accountId,
      debit: line.debit ?? 0,
      credit: line.credit ?? 0,
      partyType: line.partyType || null,
      partyId: line.partyId || null,
      costCenter: line.costCenter || null,
      narration: line.narration || null,
    })
  }

  return { journalEntryId, voucherNo }
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

    // If original fiscal year is closed, default to current date; otherwise retain original posting date
    if (fyRows[0]?.isClosed) {
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
