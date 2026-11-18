import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { logAudit, requirePermission } from '#/server/auth/permissions'
import { getStoreSettingsQuery } from '#/server/platform/platform.queries'
import {
  getAgingReportQuery,
  getBalanceSheetReportQuery,
  getCashFlowStatementReportQuery,
  getDayBookReportQuery,
  getProfitAndLossReportQuery,
  getTaxSummaryReportQuery,
  getTrialBalanceReportQuery,
} from './reports.queries'
import {
  getDealerPayablesSummaryQuery,
  getGeneralLedgerEntriesQuery,
  getPartyStatementQuery,
  getRiderAccountsSummaryQuery,
} from './finance.queries'
import { getExpensesQuery } from './expenses.queries'
import { getVouchersListQuery } from './vouchers.queries'

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = String(val).replace(/"/g, '""')
  return `"${s}"`
}

export function buildCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const headerLine = headers.map(escapeCsvField).join(',')
  const bodyLines = rows.map((r) => r.map(escapeCsvField).join(','))
  // UTF-8 BOM + CSV lines
  return '\uFEFF' + [headerLine, ...bodyLines].join('\r\n')
}

export function buildExcelXml(
  reportTitle: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const sanitize = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  const isNumeric = (val: unknown): boolean => {
    if (val === null || val === undefined || val === '') return false
    return !isNaN(Number(val))
  }

  const headerCells = headers
    .map(
      (h) =>
        `<Cell ss:StyleID="Header"><Data ss:Type="String">${sanitize(h)}</Data></Cell>`,
    )
    .join('')

  const dataRows = rows
    .map((r) => {
      const isTotalRow =
        r[0] === 'TOTAL' || r[0] === 'TOTALS' || r[0] === 'GRAND TOTAL'
      const cells = r
        .map((cell) => {
          if (isNumeric(cell)) {
            const num = Number(cell)
            const style = isTotalRow ? 'Total' : 'Money'
            return `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${num}</Data></Cell>`
          }
          const style = isTotalRow ? 'TotalText' : 'Default'
          return `<Cell ss:StyleID="${style}"><Data ss:Type="String">${sanitize(cell)}</Data></Cell>`
        })
        .join('')
      return `<Row>${cells}</Row>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Money">
   <NumberFormat ss:Format="#,##0.00"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Total">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="TotalText">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${sanitize(reportTitle.slice(0, 30))}">
  <Table>
   <Row>${headerCells}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`
}

export function buildPrintableHtml(
  reportTitle: string,
  meta: {
    legalName: string
    pan: string
    address: string
    dateRange: string
    branchName: string
    fiscalYear: string
  },
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const sanitize = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  const isNumeric = (val: unknown): boolean => {
    if (val === null || val === undefined || val === '') return false
    return !isNaN(Number(val))
  }

  const headerThs = headers
    .map(
      (h, idx) =>
        `<th class="${idx >= headers.length - 3 ? 'text-right' : 'text-left'}">${sanitize(h)}</th>`,
    )
    .join('')

  const bodyTrs = rows
    .map((r) => {
      const isTotalRow =
        r[0] === 'TOTAL' || r[0] === 'TOTALS' || r[0] === 'GRAND TOTAL'
      const tds = r
        .map((cell) => {
          if (isNumeric(cell)) {
            const formatted = Number(cell).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
            return `<td class="text-right font-mono">${formatted}</td>`
          }
          return `<td class="text-left">${sanitize(cell)}</td>`
        })
        .join('')
      return `<tr class="${isTotalRow ? 'font-bold bg-gray-100 border-t-2 border-b-2' : ''}">${tds}</tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${sanitize(reportTitle)} - ${sanitize(meta.legalName)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; font-size: 11px; margin: 0; padding: 12px; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 18px; font-weight: bold; color: #0f172a; }
    .meta { font-size: 10px; color: #64748b; line-height: 1.4; }
    .badge { display: inline-block; padding: 2px 6px; font-size: 9px; font-weight: bold; background: #e2e8f0; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #0f172a; color: #ffffff; padding: 6px 8px; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; }
    td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-mono { font-family: monospace; }
    .font-bold { font-weight: bold; }
    .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${sanitize(meta.legalName)}</div>
      <div class="meta">${sanitize(meta.address)} • PAN: <strong>${sanitize(meta.pan)}</strong></div>
      <div class="meta" style="margin-top: 4px; font-size: 13px; font-weight: 600; color: #0f172a;">${sanitize(reportTitle)}</div>
    </div>
    <div style="text-align: right;">
      <span class="badge">FY ${sanitize(meta.fiscalYear)}</span>
      <div class="meta" style="margin-top: 4px;">Branch: <strong>${sanitize(meta.branchName)}</strong></div>
      <div class="meta">Period: ${sanitize(meta.dateRange)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>${headerThs}</tr>
    </thead>
    <tbody>
      ${bodyTrs}
    </tbody>
  </table>

  <div class="footer">
    <span>Generated by Daru Admin ERP System on ${new Date().toLocaleString('en-US')}</span>
    <span>Authorized Financial Record • Page 1 of 1</span>
  </div>
</body>
</html>`
}

export const exportFinancialReportFn = createServerFn({ method: 'POST' })
  .validator((d: unknown) =>
    z
      .object({
        reportType: z.enum([
          'trial-balance',
          'profit-loss',
          'balance-sheet',
          'cash-flow',
          'day-book',
          'aging-payable',
          'aging-receivable',
          'general-ledger',
          'vouchers',
          'expenses',
          'tax-summary',
          'party-statement',
          'dealer-payables',
          'rider-cod',
        ]),
        format: z.enum(['csv', 'excel', 'html']).default('csv'),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        branchId: z.string().optional(),
        branchName: z.string().optional(),
        costCenterId: z.string().optional(),
        partyType: z.enum(['dealer', 'rider', 'customer', 'supplier', 'employee']).optional(),
        partyId: z.string().optional(),
        accountId: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { user } = await requirePermission('accounts', 'view')

    const fromDate = data.fromDate ? new Date(data.fromDate) : undefined
    const toDate = data.toDate ? new Date(data.toDate) : undefined
    const today = new Date().toISOString().slice(0, 10)

    let reportTitle = 'Financial Report'
    let headers: string[] = []
    let rows: (string | number | null | undefined)[][] = []
    let fileBase = `report_${data.reportType}_${today}`

    if (data.reportType === 'trial-balance') {
      reportTitle = 'Trial Balance Report'
      fileBase = `trial_balance_${today}`
      const tb = await getTrialBalanceReportQuery({
        fromDate,
        toDate,
        branchId: data.branchId,
        costCenterId: data.costCenterId,
        includeZero: true,
      })

      headers = [
        'Account Code',
        'Account Name',
        'Root Type',
        'Opening Dr (Rs)',
        'Opening Cr (Rs)',
        'Period Dr (Rs)',
        'Period Cr (Rs)',
        'Closing Dr (Rs)',
        'Closing Cr (Rs)',
      ]
      rows = tb.accounts.map((a) => [
        a.code,
        a.name,
        a.rootType,
        (a.openingDebit / 100).toFixed(2),
        (a.openingCredit / 100).toFixed(2),
        (a.periodDebit / 100).toFixed(2),
        (a.periodCredit / 100).toFixed(2),
        (a.closingDebit / 100).toFixed(2),
        (a.closingCredit / 100).toFixed(2),
      ])
      rows.push([
        'TOTALS',
        tb.isBalanced ? 'PROVEN BALANCED' : 'UNBALANCED VARIANCE',
        '',
        (tb.totalOpeningDebit / 100).toFixed(2),
        (tb.totalOpeningCredit / 100).toFixed(2),
        (tb.totalPeriodDebit / 100).toFixed(2),
        (tb.totalPeriodCredit / 100).toFixed(2),
        (tb.totalClosingDebit / 100).toFixed(2),
        (tb.totalClosingCredit / 100).toFixed(2),
      ])
    } else if (data.reportType === 'profit-loss') {
      reportTitle = 'Profit & Loss Statement (Income Statement)'
      fileBase = `profit_loss_${today}`
      const pnl = await getProfitAndLossReportQuery({
        fromDate,
        toDate,
        branchId: data.branchId,
        costCenterId: data.costCenterId,
      })

      headers = ['Category', 'Account Code', 'Account Name', 'Current Period (Rs)', 'Previous Period (Rs)']
      rows.push(['REVENUE / INCOME', '', '', (pnl.totalIncome / 100).toFixed(2), ''])
      pnl.incomeRows.forEach((r) => rows.push(['Income', r.code, r.name, (r.currentPeriod / 100).toFixed(2), (r.previousPeriod / 100).toFixed(2)]))

      rows.push(['COST OF GOODS SOLD (COGS)', '', '', (pnl.totalCogs / 100).toFixed(2), ''])
      pnl.cogsRows.forEach((r) => rows.push(['COGS', r.code, r.name, (r.currentPeriod / 100).toFixed(2), (r.previousPeriod / 100).toFixed(2)]))

      rows.push(['GROSS PROFIT', '', '', (pnl.grossProfit / 100).toFixed(2), (pnl.previousPeriod.grossProfit / 100).toFixed(2)])

      rows.push(['OPERATING & ADMIN EXPENSES', '', '', (pnl.totalOperatingExpenses / 100).toFixed(2), ''])
      pnl.operatingExpenseRows.forEach((r) => rows.push(['Expense', r.code, r.name, (r.currentPeriod / 100).toFixed(2), (r.previousPeriod / 100).toFixed(2)]))

      rows.push(['NET PROFIT (EBITDA)', '', '', (pnl.netProfit / 100).toFixed(2), (pnl.previousPeriod.netProfit / 100).toFixed(2)])
    } else if (data.reportType === 'balance-sheet') {
      reportTitle = 'Balance Sheet (Statement of Financial Position)'
      fileBase = `balance_sheet_${today}`
      const bs = await getBalanceSheetReportQuery({
        asOfDate: toDate || new Date(),
        branchId: data.branchId,
      })

      headers = ['Category', 'Account Code', 'Account Name', 'Balance (Rs)']
      rows.push(['ASSETS', '', '', (bs.totalAssets / 100).toFixed(2)])
      bs.assetRows.forEach((r) => rows.push(['Asset', r.code, r.name, (r.balance / 100).toFixed(2)]))

      rows.push(['LIABILITIES', '', '', (bs.totalLiabilities / 100).toFixed(2)])
      bs.liabilityRows.forEach((r) => rows.push(['Liability', r.code, r.name, (r.balance / 100).toFixed(2)]))

      rows.push(['EQUITY', '', '', (bs.totalEquity / 100).toFixed(2)])
      bs.equityRows.forEach((r) => rows.push(['Equity', r.code, r.name, (r.balance / 100).toFixed(2)]))
      rows.push(['Current Period Retained Profit', '', '', (bs.currentYearProfit / 100).toFixed(2)])

      rows.push(['TOTAL LIABILITIES & EQUITY', '', '', (bs.totalLiabilitiesAndEquity / 100).toFixed(2)])
    } else if (data.reportType === 'cash-flow') {
      reportTitle = 'Cash Flow Statement (Direct Method)'
      fileBase = `cash_flow_${today}`
      const cf = await getCashFlowStatementReportQuery({
        fromDate,
        toDate,
        branchId: data.branchId,
      })

      headers = ['Flow Type', 'Account / Description', 'Narration', 'Amount (Rs)']
      rows.push(['OPENING CASH & BANK', 'Cash & Bank Balances at Start', '', (cf.openingCashAndBank / 100).toFixed(2)])

      rows.push(['OPERATING INFLOWS', '', '', (cf.totalOperatingInflows / 100).toFixed(2)])
      cf.operatingInflows.forEach((item) => rows.push(['Inflow', item.name, item.narration || '', (item.amount / 100).toFixed(2)]))

      rows.push(['OPERATING OUTFLOWS', '', '', (cf.totalOperatingOutflows / 100).toFixed(2)])
      cf.operatingOutflows.forEach((item) => rows.push(['Outflow', item.name, item.narration || '', (item.amount / 100).toFixed(2)]))

      rows.push(['NET OPERATING CASH FLOW', '', '', (cf.netOperatingCashFlow / 100).toFixed(2)])
      rows.push(['NET CHANGE IN CASH', '', '', (cf.netChangeInCash / 100).toFixed(2)])
      rows.push(['CLOSING CASH & BANK', 'Verified Cash & Bank Balances at End', '', (cf.closingCashAndBank / 100).toFixed(2)])
    } else if (data.reportType === 'day-book') {
      reportTitle = 'Day Book (Chronological Journal Register)'
      fileBase = `day_book_${today}`
      const dbRes = await getDayBookReportQuery({
        date: toDate || new Date(),
        branchId: data.branchId,
        limit: 5000,
      })

      headers = ['Voucher No', 'Type', 'Posting Date', 'Account Code', 'Account Name', 'Narration', 'Debit (Rs)', 'Credit (Rs)']
      rows = dbRes.lines.map((l) => [
        l.voucherNo || '',
        l.voucherType,
        l.postingDate.slice(0, 10),
        l.accountCode,
        l.accountName,
        l.narration || '',
        (l.debit / 100).toFixed(2),
        (l.credit / 100).toFixed(2),
      ])
      rows.push(['TOTAL', '', '', '', '', '', (dbRes.totalDebit / 100).toFixed(2), (dbRes.totalCredit / 100).toFixed(2)])
    } else if (data.reportType === 'aging-payable' || data.reportType === 'aging-receivable') {
      const isPayable = data.reportType === 'aging-payable'
      reportTitle = isPayable ? 'Accounts Payable Aging Report' : 'Accounts Receivable Aging Report'
      fileBase = isPayable ? `ap_aging_${today}` : `ar_aging_${today}`

      const aging = await getAgingReportQuery({
        type: isPayable ? 'payable' : 'receivable',
        asOfDate: toDate || new Date(),
        branchId: data.branchId,
      })

      headers = ['Party Name', 'Party Type', '0-30 Days (Rs)', '31-60 Days (Rs)', '61-90 Days (Rs)', '91+ Days (Rs)', 'Total Dues (Rs)']
      rows = aging.parties.map((p) => [
        p.partyName,
        p.partyType,
        (p.currentBalance / 100).toFixed(2),
        (p.days31to60 / 100).toFixed(2),
        (p.days61to90 / 100).toFixed(2),
        (p.daysOver90 / 100).toFixed(2),
        (p.totalOutstanding / 100).toFixed(2),
      ])
      rows.push([
        'TOTALS',
        '',
        (aging.total0to30 / 100).toFixed(2),
        (aging.total31to60 / 100).toFixed(2),
        (aging.total61to90 / 100).toFixed(2),
        (aging.totalOver90 / 100).toFixed(2),
        (aging.grandTotal / 100).toFixed(2),
      ])
    } else if (data.reportType === 'general-ledger') {
      reportTitle = 'General Ledger Register'
      fileBase = `general_ledger_${today}`
      const gl = await getGeneralLedgerEntriesQuery({
        accountId: data.accountId,
        partyType: data.partyType,
        partyId: data.partyId,
        branchId: data.branchId,
        costCenterId: data.costCenterId,
        fromDate,
        toDate,
        limit: 10000,
      })

      headers = [
        'Posting Date (AD)',
        'BS Date',
        'Voucher No',
        'Voucher Type',
        'Account Code',
        'Account Name',
        'Party',
        'Narration',
        'Debit (Rs)',
        'Credit (Rs)',
        'Running Balance (Rs)',
      ]
      rows = gl.map((r) => [
        r.postingDate.slice(0, 10),
        r.bsDate,
        r.voucherNo || '',
        r.voucherType,
        r.accountCode,
        r.accountName,
        r.partyName || r.partyType || '',
        r.narration || '',
        (r.debit / 100).toFixed(2),
        (r.credit / 100).toFixed(2),
        (r.runningBalance / 100).toFixed(2),
      ])
    } else if (data.reportType === 'vouchers') {
      reportTitle = 'Voucher Audit Register'
      fileBase = `vouchers_register_${today}`
      const vchs = await getVouchersListQuery({
        fromDate,
        toDate,
        branchId: data.branchId,
        limit: 10000,
      })

      headers = ['Voucher No', 'Type', 'Posting Date', 'BS Date', 'Status', 'Narration', 'Debit (Rs)', 'Credit (Rs)', 'Created By']
      rows = vchs.map((v) => [
        v.voucherNo || '',
        v.voucherType,
        v.postingDate.slice(0, 10),
        v.bsDate,
        v.postingStatus,
        v.narration,
        (v.totalDebit / 100).toFixed(2),
        (v.totalCredit / 100).toFixed(2),
        v.createdBy,
      ])
    } else if (data.reportType === 'expenses') {
      reportTitle = 'Operational Expenses & TDS Register'
      fileBase = `expenses_register_${today}`
      const exps = await getExpensesQuery({
        fromDate,
        toDate,
        branchId: data.branchId,
        limit: 10000,
      })

      headers = ['Expense No', 'Date', 'Category', 'Vendor', 'Vendor PAN', 'Branch', 'Status', 'Tax (Rs)', 'Amount (Rs)', 'Submitted By']
      rows = exps.map((e) => [
        e.expenseNumber,
        e.expenseDate.slice(0, 10),
        e.categoryAccountName,
        e.vendorName || '',
        e.vendorPan || '',
        e.branchName || '',
        e.status,
        (e.taxAmount / 100).toFixed(2),
        (e.amount / 100).toFixed(2),
        e.submittedBy,
      ])
    } else if (data.reportType === 'tax-summary') {
      reportTitle = 'Inland Revenue Tax & 13% VAT Summary'
      fileBase = `tax_vat_summary_${today}`
      const tax = await getTaxSummaryReportQuery({ fromDate, toDate })

      headers = ['Compliance Metric', 'Amount (Rs)']
      rows = [
        ['Taxable Sales (Gross Base)', (tax.taxableSales / 100).toFixed(2)],
        ['13% Output VAT Collected', (tax.vatOutputCollected / 100).toFixed(2)],
        ['Input VAT Credit (Tax Invoices)', (tax.vatInputCredit / 100).toFixed(2)],
        ['Net VAT Payable to IRD', (tax.netVatPayable / 100).toFixed(2)],
        ['TDS Payable Owed (Income Tax Act)', (tax.tdsPayableOwed / 100).toFixed(2)],
        ['TDS Deducted From Dealers', (tax.tdsDeductedFromDealers / 100).toFixed(2)],
      ]
    } else if (data.reportType === 'dealer-payables') {
      reportTitle = 'Dealer Outstanding Payables Summary'
      fileBase = `dealer_payables_${today}`
      const dealersRes = await getDealerPayablesSummaryQuery()

      headers = [
        'Dealer Name',
        'Total Procured (Rs)',
        'Total Paid (Rs)',
        'Outstanding Payable (Rs)',
        '0-30 Days (Current)',
        '31-60 Days',
        '61-90 Days',
        '90+ Days',
      ]
      rows = dealersRes.map((d) => [
        d.dealerName,
        (d.totalProcured / 100).toFixed(2),
        (d.totalPaid / 100).toFixed(2),
        (d.outstandingPayable / 100).toFixed(2),
        (d.current / 100).toFixed(2),
        (d.days31To60 / 100).toFixed(2),
        (d.days61To90 / 100).toFixed(2),
        (d.days90Plus / 100).toFixed(2),
      ])
    } else if (data.reportType === 'rider-cod') {
      reportTitle = 'Rider COD Cash & Compensation Summary'
      fileBase = `rider_cod_${today}`
      const ridersRes = await getRiderAccountsSummaryQuery()

      headers = ['Rider Name', 'Phone', 'Zone', 'Status', 'Cash On Hand (Rs)', 'Undeposited COD Cash (Rs)', 'Commission Payable (Rs)']
      rows = ridersRes.map((r) => [
        r.riderName,
        r.phone || '',
        r.zone || '',
        r.status,
        (r.cashOnHand / 100).toFixed(2),
        (r.undepositedCodCash / 100).toFixed(2),
        (r.commissionPayable / 100).toFixed(2),
      ])
    } else if (data.reportType === 'party-statement' && data.partyType && data.partyId) {
      reportTitle = `Party Ledger Statement (${data.partyType.toUpperCase()})`
      fileBase = `party_statement_${data.partyType}_${today}`
      const stmt = await getPartyStatementQuery({
        partyType: data.partyType,
        partyId: data.partyId,
        fromDate,
        toDate,
        limit: 10000,
      })

      headers = ['Date (AD)', 'BS Date', 'Voucher No', 'Type', 'Account', 'Narration', 'Debit (Rs)', 'Credit (Rs)', 'Balance (Rs)']
      rows = stmt.map((r) => [
        r.postingDate.slice(0, 10),
        r.bsDate,
        r.voucherNo || '',
        r.voucherType,
        r.accountName,
        r.narration || '',
        (r.debit / 100).toFixed(2),
        (r.credit / 100).toFixed(2),
        (r.runningBalance / 100).toFixed(2),
      ])
    }

    // Format content according to requested format
    let content = ''
    let filename = `${fileBase}.${data.format === 'excel' ? 'xls' : data.format === 'html' ? 'html' : 'csv'}`
    let contentType = 'text/csv; charset=utf-8'

    if (data.format === 'excel') {
      content = buildExcelXml(reportTitle, headers, rows)
      contentType = 'application/vnd.ms-excel; charset=utf-8'
    } else if (data.format === 'html') {
      const storeSettings = await getStoreSettingsQuery()
      content = buildPrintableHtml(
        reportTitle,
        {
          legalName: storeSettings.legalName || 'Mezmani Group Pvt. Ltd.',
          pan: storeSettings.pan || storeSettings.vat || '601234567',
          address: storeSettings.address
            ? `${storeSettings.address}, ${storeSettings.city}`
            : 'Butwal, Nepal',
          dateRange: `${fromDate ? fromDate.toISOString().slice(0, 10) : 'Start'} to ${toDate ? toDate.toISOString().slice(0, 10) : today}`,
          branchName: data.branchName || 'All Branches (Consolidated)',
          fiscalYear: '2083/84',
        },
        headers,
        rows,
      )
      contentType = 'text/html; charset=utf-8'
    } else {
      content = buildCsv(headers, rows)
      contentType = 'text/csv; charset=utf-8'
    }

    await logAudit(
      user.name,
      'accounts',
      'export',
      `Exported ${reportTitle} (${data.reportType}) in ${data.format.toUpperCase()} format (${rows.length} records)`,
    )

    return {
      filename,
      content,
      csvContent: content,
      format: data.format,
      contentType,
      rowCount: rows.length,
    }
  })
