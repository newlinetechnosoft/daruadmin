import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requirePermission, logAudit } from '#/server/auth/permissions'
import {
  autoMatchBankTransactionsQuery,
  clearBankTransactionQuery,
  createBankAccountQuery,
  finalizeBankReconciliationQuery,
  getBankAccountsQuery,
  getBankReconciliationSummaryQuery,
  getBankTransactionsQuery,
  getCashAccountsQuery,
  getCashClosingHistoryQuery,
  getCashFlowTrackingQuery,
  getCashInHandSummaryQuery,
  getUnmatchedBankJournalLinesQuery,
  importBankTransactionsQuery,
  matchBankTransactionQuery,
  postQuickBankEntryQuery,
  recordCashClosingQuery,
} from './banking.queries'
import { postContraVoucherTx } from './double-entry'
import { dbTx } from '#/db'

export const getBankAccountsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('accounts', 'view')
    return getBankAccountsQuery()
  },
)

export const createBankAccountFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        bankName: z.string().min(2),
        accountNumber: z.string().min(3),
        accountName: z.string().min(2),
        branchName: z.string().optional(),
        ledgerAccountId: z.string().optional(),
        openingBalanceInRs: z.number().default(0),
        branchId: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'create')

    const result = await createBankAccountQuery({
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      accountName: data.accountName,
      branchName: data.branchName,
      ledgerAccountId: data.ledgerAccountId,
      openingBalance: Math.round(data.openingBalanceInRs * 100),
      branchId: data.branchId,
    })

    await logAudit(
      user.name,
      'accounts',
      'create',
      `Created bank account: ${result.bankName} (${result.accountNumber})`,
    )

    return result
  })

export const getCashInHandSummaryFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('accounts', 'view')
    return getCashInHandSummaryQuery()
  },
)

export const getCashClosingHistoryFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        branchId: z.string().optional(),
        limit: z.number().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')
    return getCashClosingHistoryQuery(data)
  })

export const recordCashClosingFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        physicalCashCountedInRs: z.number().min(0),
        notes: z.string().optional(),
        branchId: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')

    const result = await recordCashClosingQuery({
      physicalCashCounted: Math.round(data.physicalCashCountedInRs * 100),
      notes: data.notes,
      branchId: data.branchId,
      actor: user,
    })

    await logAudit(
      user.name,
      'accounts',
      'approve',
      `Day-end cash closing (Z-Report): Counted Rs. ${data.physicalCashCountedInRs}, Expected Rs. ${(result.expectedCash / 100).toFixed(2)}, Variance Rs. ${(result.variance / 100).toFixed(2)}${result.voucherNo ? ` (Voucher: ${result.voucherNo})` : ''}`,
    )

    return result
  })

export const postContraTransferFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        fromAccountId: z.string().min(1),
        toAccountId: z.string().min(1),
        amountInRs: z.number().positive(),
        narration: z.string().min(3),
        branchId: z.string().optional(),
        postingDate: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')

    const amount = Math.round(data.amountInRs * 100)
    const postingDate = data.postingDate ? new Date(data.postingDate) : new Date()

    const result = await dbTx.transaction(async (tx) => {
      return postContraVoucherTx(tx, {
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        amount,
        narration: data.narration,
        branchId: data.branchId,
        postingDate,
        actor: user,
      })
    })

    await logAudit(
      user.name,
      'accounts',
      'create',
      `Posted contra transfer ${result.voucherNo}: Rs. ${data.amountInRs} (${data.narration})`,
    )

    return result
  })

export const getBankTransactionsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        bankAccountId: z.string().min(1),
        status: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')
    return getBankTransactionsQuery(data)
  })

export const matchBankTransactionFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        bankTransactionId: z.string().min(1),
        journalLineId: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')
    return matchBankTransactionQuery({
      bankTransactionId: data.bankTransactionId,
      journalLineId: data.journalLineId,
      actor: user,
    })
  })

export const clearBankTransactionFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z.object({ bankTransactionId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'approve')
    return clearBankTransactionQuery(data.bankTransactionId)
  })

export const getCashAccountsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('accounts', 'view')
    return getCashAccountsQuery()
  },
)

export const getUnmatchedBankJournalLinesFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z.object({ bankAccountId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')
    return getUnmatchedBankJournalLinesQuery(data.bankAccountId)
  })

export const importBankTransactionsFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        bankAccountId: z.string().min(1),
        transactions: z.array(
          z.object({
            transactionDate: z.string(),
            description: z.string().min(1),
            referenceNo: z.string().optional().nullable(),
            debitRs: z.number().optional().default(0),
            creditRs: z.number().optional().default(0),
          }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'create')
    const result = await importBankTransactionsQuery({
      bankAccountId: data.bankAccountId,
      transactions: data.transactions,
    })

    await logAudit(
      user.name,
      'accounts',
      'create',
      `Imported ${result.importedCount} bank statement rows (${result.duplicateCount} duplicates skipped) for bank ${data.bankAccountId}`,
    )

    return result
  })

export const autoMatchBankTransactionsFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z.object({ bankAccountId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')
    const result = await autoMatchBankTransactionsQuery(data.bankAccountId, user)

    await logAudit(
      user.name,
      'accounts',
      'approve',
      `Auto-matched ${result.matchedCount} bank transactions for bank ${data.bankAccountId}`,
    )

    return result
  })

export const getBankReconciliationSummaryFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z.object({ bankAccountId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')
    return getBankReconciliationSummaryQuery(data.bankAccountId)
  })

export const finalizeBankReconciliationFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z.object({ bankAccountId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')
    const result = await finalizeBankReconciliationQuery(data.bankAccountId, user)

    await logAudit(
      user.name,
      'accounts',
      'approve',
      `Finalized bank reconciliation for bank ${data.bankAccountId}: ${result.clearedCount} transactions marked cleared`,
    )

    return result
  })

export const postQuickBankEntryFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        bankAccountId: z.string().min(1),
        entryType: z.enum(['bank_charges', 'interest', 'deposit', 'withdrawal']),
        amountInRs: z.number().positive(),
        narration: z.string().min(3),
        postingDate: z.string().optional(),
        bankTransactionId: z.string().optional(),
        refId: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')
    const result = await postQuickBankEntryQuery({
      bankAccountId: data.bankAccountId,
      entryType: data.entryType,
      amount: Math.round(data.amountInRs * 100),
      narration: data.narration,
      postingDate: data.postingDate ? new Date(data.postingDate) : undefined,
      bankTransactionId: data.bankTransactionId,
      refId: data.refId,
      actor: user,
    })

    await logAudit(
      user.name,
      'accounts',
      'create',
      `Posted quick bank ${data.entryType} voucher ${result.voucherNo} for Rs. ${data.amountInRs}`,
    )

    return result
  })

export const getCashFlowTrackingFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requirePermission('accounts', 'view')
    return getCashFlowTrackingQuery()
  },
)
