import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requirePermission, logAudit } from '#/server/auth/permissions'
import { db } from '#/db'
import { journalEntries } from '#/db/schema'
import { eq, sql } from 'drizzle-orm'
import {
  addVoucherAttachmentQuery,
  createDraftJournalVoucherQuery,
  getVoucherAttachmentsQuery,
  getVoucherDetailsQuery,
  getVouchersListQuery,
  submitDraftVoucherQuery,
} from './vouchers.queries'
import type { VoucherType } from './types'

export const getVouchersListFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z
      .object({
        voucherType: z.string().optional(),
        postingStatus: z.string().optional(),
        branchId: z.string().optional(),
        search: z.string().optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')

    return getVouchersListQuery({
      voucherType: data?.voucherType,
      postingStatus: data?.postingStatus,
      branchId: data?.branchId,
      search: data?.search,
      fromDate: data?.fromDate ? new Date(data.fromDate) : undefined,
      toDate: data?.toDate ? new Date(data.toDate) : undefined,
      limit: data?.limit,
      offset: data?.offset,
    })
  })

export const createDraftVoucherFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        voucherType: z
          .enum(['JV', 'PV', 'RV', 'CV', 'SV', 'CN', 'DN', 'OB'])
          .default('JV'),
        postingDate: z.string().optional(),
        narration: z.string().min(3),
        branchId: z.string().optional(),
        refId: z.string().optional(),
        lines: z
          .array(
            z.object({
              accountId: z.string().min(1),
              debit: z.number().int().min(0),
              credit: z.number().int().min(0),
              partyType: z
                .enum(['dealer', 'rider', 'customer', 'supplier', 'employee'])
                .optional(),
              partyId: z.string().optional(),
              costCenter: z
                .enum(['liquor', 'food', 'delivery', 'general'])
                .optional(),
              costCenterId: z.string().optional(),
              branchId: z.string().optional(),
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
        `Draft journal voucher is out of balance. Total Debit (Rs. ${(totalDebit / 100).toFixed(2)}) must equal Total Credit (Rs. ${(totalCredit / 100).toFixed(2)}).`,
      )
    }

    const result = await createDraftJournalVoucherQuery({
      voucherType: data.voucherType as VoucherType,
      postingDate: data.postingDate ? new Date(data.postingDate) : undefined,
      narration: data.narration,
      refId: data.refId,
      branchId: data.branchId,
      lines: data.lines.map((l) => ({
        ...l,
        branchId: l.branchId || data.branchId || null,
      })),
      actor: user,
    })

    await logAudit(
      user.name,
      'accounts',
      'create',
      `Saved draft voucher ${result.journalEntryId}: ${data.narration}`,
    )

    return result
  })

export const submitDraftVoucherFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z.object({ journalEntryId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')

    const result = await submitDraftVoucherQuery({
      journalEntryId: data.journalEntryId,
      actor: user,
    })

    await logAudit(
      user.name,
      'accounts',
      'approve',
      `Submitted and posted draft voucher into General Ledger as ${result.voucherNo}`,
    )

    return result
  })

export const addVoucherAttachmentFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        journalEntryId: z.string().min(1),
        url: z.string().min(1),
        name: z.string().min(1),
        size: z.number().optional(),
        mimeType: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'create')

    return addVoucherAttachmentQuery({
      journalEntryId: data.journalEntryId,
      url: data.url,
      name: data.name,
      size: data.size,
      mimeType: data.mimeType,
      uploadedBy: user.name,
    })
  })

export const getVoucherAttachmentsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z.object({ journalEntryId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')
    return getVoucherAttachmentsQuery(data.journalEntryId)
  })

export const getVoucherDetailsFn = createServerFn({ method: 'GET' })
  .validator((d: unknown) =>
    z.object({ journalEntryId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requirePermission('accounts', 'view')
    const voucher = await getVoucherDetailsQuery(data.journalEntryId)
    if (!voucher) {
      throw new Error(`Voucher with ID "${data.journalEntryId}" not found.`)
    }
    return voucher
  })

export const approveVoucherFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z.object({ journalEntryId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')
    return submitDraftVoucherQuery({
      journalEntryId: data.journalEntryId,
      actor: user,
      approvedBy: user.name,
    })
  })

export const cancelVoucherFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        journalEntryId: z.string().min(1),
        reason: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'approve')
    await db
      .update(journalEntries)
      .set({
        postingStatus: 'cancelled',
        narration: sql`${journalEntries.narration} || ' [CANCELLED: ' || ${data.reason || 'by administrator'} || ']'`,
      })
      .where(eq(journalEntries.id, data.journalEntryId))

    await logAudit(
      user.name,
      'accounts',
      'approve',
      `Cancelled voucher ${data.journalEntryId}: ${data.reason || ''}`,
    )
    return { success: true }
  })
