import { db } from '#/db'
import {
  costCenters,
  fiscalYears,
  ledgerAccounts,
  voucherSequences,
} from '#/db/schema'
import { desc, eq, sql } from 'drizzle-orm'
import { getStoreSettingsQuery } from '#/server/platform/platform.queries'

export interface VoucherSequenceItem {
  id: string
  voucherType: string
  prefix: string
  lastNo: number
  updatedAt: string
}

export interface AccountingConfigResult {
  activeFiscalYear: {
    id: string
    name: string
    startDate: string
    endDate: string
    isClosed: boolean
  } | null
  voucherSequences: VoucherSequenceItem[]
  costCenters: Array<{ id: string; code: string; name: string; isActive: boolean }>
  postingPolicies: {
    requireBalancing: boolean
    allowDraftVouchers: boolean
    enforceBranchTagging: boolean
    makerCheckerThresholdPaisa: number
    makerCheckerThresholdRupees: number
    autoPostOrderSales: boolean
    autoPostDealerCost: boolean
    autoPostCodCollection: boolean
  }
  currency: {
    code: string
    symbol: string
    subUnit: string
    precision: number
    storageFormat: string
  }
  securityAudit: {
    totalAccounts: number
    frozenAccounts: number
    activeFiscalYears: number
  }
  nepalCompliance: {
    pan: string
    legalName: string
    tradeName: string
    vatRegistered: boolean
    taxOffice: string
    currency: {
      code: string
      symbol: string
      subUnit: string
      subUnitRatio: number
      numberingFormat: string
    }
    vatRules: {
      standardRatePercent: number
      effectiveFromBS: string
      effectiveFromAD: string
      statutoryAct: string
      outputAccountCode: string
      inputAccountCode: string
      filingDeadline: string
    }
    tdsSchedules: Array<{
      category: string
      ratePercent: number
      statutorySection: string
      applicableTo: string
      effectiveFromBS: string
      effectiveFromAD: string
    }>
    paymentGatewayClearing: {
      accountCode: string
      accountName: string
      supportedGateways: string[]
      settlementPolicy: string
    }
    codReconciliation: {
      riderCodAccountCode: string
      physicalVaultAccountCode: string
      handoverCutoff: string
      varianceThresholdPaisa: number
    }
  }
}

export async function getAccountingConfigurationQuery(): Promise<AccountingConfigResult> {
  // 1. Fiscal Year
  const [activeFy] = await db
    .select()
    .from(fiscalYears)
    .where(eq(fiscalYears.isClosed, false))
    .orderBy(desc(fiscalYears.startDate))
    .limit(1)

  // 2. Voucher Sequences
  const [seqRows, storeSettings] = await Promise.all([
    db
      .select()
      .from(voucherSequences)
      .where(activeFy ? eq(voucherSequences.fiscalYearId, activeFy.id) : sql`1=1`),
    getStoreSettingsQuery(),
  ])

  // Standard voucher types ensure complete coverage
  const standardTypes = ['JV', 'PV', 'RV', 'CV', 'SV', 'CN', 'DN', 'OB', 'PC']
  const seqMap = new Map(seqRows.map((s) => [s.voucherType, s]))

  const allSequences: VoucherSequenceItem[] = standardTypes.map((type) => {
    const existing = seqMap.get(type)
    return {
      id: existing?.id || `seq_${activeFy?.id || 'default'}_${type}`,
      voucherType: type,
      prefix: existing?.prefix || type,
      lastNo: existing?.lastNo || 0,
      updatedAt: existing?.updatedAt?.toISOString() || new Date().toISOString(),
    }
  })

  // 3. Cost Centers
  const ccRows = await db.select().from(costCenters).orderBy(costCenters.code)

  // 4. Security & Accounts count
  const [accCounts] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      frozen: sql<number>`COALESCE(SUM(CASE WHEN ${ledgerAccounts.isFrozen} = true THEN 1 ELSE 0 END), 0)`,
    })
    .from(ledgerAccounts)

  const [fyCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(fiscalYears)

  return {
    activeFiscalYear: activeFy
      ? {
          id: activeFy.id,
          name: activeFy.name,
          startDate: activeFy.startDate.toISOString().slice(0, 10),
          endDate: activeFy.endDate.toISOString().slice(0, 10),
          isClosed: activeFy.isClosed,
        }
      : null,
    voucherSequences: allSequences,
    costCenters: ccRows.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      isActive: c.isActive,
    })),
    postingPolicies: {
      requireBalancing: true,
      allowDraftVouchers: true,
      enforceBranchTagging: true,
      makerCheckerThresholdPaisa: 5000000, // Rs. 50,000 in integer paisa
      makerCheckerThresholdRupees: 50000,
      autoPostOrderSales: true,
      autoPostDealerCost: true,
      autoPostCodCollection: true,
    },
    currency: {
      code: 'NPR',
      symbol: 'Rs.',
      subUnit: 'Paisa',
      precision: 2,
      storageFormat: 'Integer Paisa (1 NPR = 100 Paisa)',
    },
    securityAudit: {
      totalAccounts: Number(accCounts?.total) || 0,
      frozenAccounts: Number(accCounts?.frozen) || 0,
      activeFiscalYears: Number(fyCount?.count) || 1,
    },
    nepalCompliance: {
      pan: storeSettings.pan || '601234567',
      legalName: storeSettings.legalName || 'Mezmani Retail Pvt. Ltd.',
      tradeName: storeSettings.storeName || 'Mezmani',
      vatRegistered: Boolean(storeSettings.vat || storeSettings.pan),
      taxOffice: `Inland Revenue Office (IRO), ${storeSettings.city || 'Butwal'} / LTO Nepal`,
      currency: {
        code: storeSettings.currency || 'NPR',
        symbol: storeSettings.currencySymbol || 'Rs.',
        subUnit: 'Paisa',
        subUnitRatio: 100,
        numberingFormat: 'South Asian (Lakhs & Crores: 1,23,45,678.90)',
      },
      vatRules: {
        standardRatePercent: storeSettings.taxRate ?? 13,
        effectiveFromBS: '2054-08-01',
        effectiveFromAD: '1997-11-16',
        statutoryAct: 'Value Added Tax Act, 2052 (Nepal)',
        outputAccountCode: '2021',
        inputAccountCode: '2022',
        filingDeadline: '25th day of following BS month (Monthly VAT Return)',
      },
      tdsSchedules: [
        {
          category: 'Goods Procurement & Contracts (VAT Vendor)',
          ratePercent: 1.5,
          statutorySection: 'Section 89 (Income Tax Act, 2058)',
          applicableTo: 'Procurement of goods and supply contracts from VAT-registered vendors',
          effectiveFromBS: '2075-04-01',
          effectiveFromAD: '2018-07-17',
        },
        {
          category: 'Vehicle Lease & Transport Services',
          ratePercent: 10,
          statutorySection: 'Section 88(1) (Income Tax Act, 2058)',
          applicableTo: 'Rider logistics, vehicle rental, and transport service contracts',
          effectiveFromBS: '2070-04-01',
          effectiveFromAD: '2013-07-16',
        },
        {
          category: 'House Rent & Commercial Warehouses',
          ratePercent: 10,
          statutorySection: 'Section 88(1) / Local Government Act',
          applicableTo: 'Office lease, warehouse rental, and dark store hubs',
          effectiveFromBS: '2075-04-01',
          effectiveFromAD: '2018-07-17',
        },
        {
          category: 'Consultancy & Technical Services',
          ratePercent: 15,
          statutorySection: 'Section 88(1) (Income Tax Act, 2058)',
          applicableTo: 'Software, legal, auditing, and specialized consultancy fees',
          effectiveFromBS: '2059-01-01',
          effectiveFromAD: '2002-04-14',
        },
        {
          category: 'Commission & Brokerage Payments',
          ratePercent: 15,
          statutorySection: 'Section 88(2) (Income Tax Act, 2058)',
          applicableTo: 'Sales commission agents and promotional referral payouts',
          effectiveFromBS: '2059-01-01',
          effectiveFromAD: '2002-04-14',
        },
      ],
      paymentGatewayClearing: {
        accountCode: '1013',
        accountName: 'Payment Gateway Clearing (eSewa / Khalti)',
        supportedGateways: ['eSewa', 'Khalti', 'Fonepay', 'ConnectIPS'],
        settlementPolicy: 'T+1 settlement with MDR commission recognition',
      },
      codReconciliation: {
        riderCodAccountCode: '1012',
        physicalVaultAccountCode: '1011',
        handoverCutoff: 'End of Delivery Shift (Daily 22:00 NPT)',
        varianceThresholdPaisa: 0,
      },
    },
  }
}

export async function updateVoucherSequencePrefixQuery(
  fiscalYearId: string,
  voucherType: string,
  prefix: string,
): Promise<{ success: boolean; prefix: string }> {
  const cleanPrefix = prefix.trim().toUpperCase()
  const seqId = `seq_${fiscalYearId}_${voucherType}`

  await db
    .insert(voucherSequences)
    .values({
      id: seqId,
      fiscalYearId,
      voucherType,
      prefix: cleanPrefix,
      lastNo: 0,
    })
    .onConflictDoUpdate({
      target: [voucherSequences.fiscalYearId, voucherSequences.voucherType],
      set: {
        prefix: cleanPrefix,
        updatedAt: new Date(),
      },
    })

  return { success: true, prefix: cleanPrefix }
}
