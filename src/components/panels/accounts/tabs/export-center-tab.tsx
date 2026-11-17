import { useMemo, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Card } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { exportFinancialReportFn } from '#/server/finance/export.functions'
import { toast } from 'sonner'
import { formatDualDate } from '#/lib/nepal-date'
import {
  Calendar,
  Clock,
  Coins,
  Download,
  FileSpreadsheet,
  FileText,
  Landmark,
  Printer,
  Receipt,
  Scale,
  ShieldCheck,
  Store,
  TrendingUp,
  Truck,
} from 'lucide-react'

const REPORT_CATEGORIES = [
  {
    category: 'Essential Financial Statements',
    reports: [
      {
        id: 'trial-balance',
        name: 'Trial Balance',
        description: 'Debit & credit balances of all ledger accounts with mathematical proof.',
        icon: Scale,
        recommendedFormat: 'excel',
      },
      {
        id: 'profit-loss',
        name: 'Profit and Loss Statement',
        description: 'Revenue, Cost of Goods Sold, Gross Profit, Expenses & Net Profit.',
        icon: TrendingUp,
        recommendedFormat: 'excel',
      },
      {
        id: 'balance-sheet',
        name: 'Balance Sheet',
        description: 'Statement of financial position: Assets, Liabilities, and Equity.',
        icon: Landmark,
        recommendedFormat: 'excel',
      },
      {
        id: 'cash-flow',
        name: 'Cash Flow Statement',
        description: 'Direct method operational inflows, disbursements, opening & closing cash.',
        icon: Coins,
        recommendedFormat: 'excel',
      },
    ],
  },
  {
    category: 'Journals, Registers & Sub-Ledgers',
    reports: [
      {
        id: 'day-book',
        name: 'Day Book Register',
        description: 'Daily chronological journal transaction register with Dr/Cr totals.',
        icon: Clock,
        recommendedFormat: 'csv',
      },
      {
        id: 'general-ledger',
        name: 'General Ledger Register',
        description: 'Detailed account transaction lines with running balances and narrations.',
        icon: FileText,
        recommendedFormat: 'csv',
      },
      {
        id: 'vouchers',
        name: 'Voucher Audit Register',
        description: 'Complete record of all JV, PV, RV, CV, SV with maker-checker status.',
        icon: Receipt,
        recommendedFormat: 'csv',
      },
      {
        id: 'expenses',
        name: 'Operational Expenses & TDS',
        description: 'Itemized expense claims, vendors, tax invoices, and payment vouchers.',
        icon: Receipt,
        recommendedFormat: 'csv',
      },
    ],
  },
  {
    category: 'Aging, Parties & Tax Compliance',
    reports: [
      {
        id: 'aging-payable',
        name: 'Accounts Payable Aging (AP)',
        description: 'Dealer and supplier aging breakdown (0-30, 31-60, 61-90, 91+ days).',
        icon: Calendar,
        recommendedFormat: 'excel',
      },
      {
        id: 'aging-receivable',
        name: 'Accounts Receivable Aging (AR)',
        description: 'Customer credit and advances aging analysis across duration buckets.',
        icon: Calendar,
        recommendedFormat: 'excel',
      },
      {
        id: 'tax-summary',
        name: 'Nepal Tax & 13% VAT Summary',
        description: 'Output VAT, input tax credit, and TDS withholding liabilities for IRD filing.',
        icon: ShieldCheck,
        recommendedFormat: 'html',
      },
      {
        id: 'dealer-payables',
        name: 'Dealer Payables Summary',
        description: 'Dealer-wise order volumes, purchase costs, settlements, and outstanding balance.',
        icon: Store,
        recommendedFormat: 'excel',
      },
      {
        id: 'rider-cod',
        name: 'Rider COD Cash & Compensation',
        description: 'Undeposited COD cash in hand, commission payable, and payout history.',
        icon: Truck,
        recommendedFormat: 'excel',
      },
    ],
  },
] as const

type ExportReportId = (typeof REPORT_CATEGORIES)[number]['reports'][number]['id']

export function ExportCenterTab() {
  const { data: branches = [] } = useSuspenseQuery(adminQueries.branches())

  const [selectedReport, setSelectedReport] = useState<ExportReportId>('trial-balance')
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'html'>('csv')

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const firstOfMonthStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }, [])

  const [fromDate, setFromDate] = useState(firstOfMonthStr)
  const [toDate, setToDate] = useState(todayStr)
  const [branchId, setBranchId] = useState<string>('all')
  const [isExporting, setIsExporting] = useState(false)

  // Current selected branch name for print header
  const selectedBranchName = useMemo(() => {
    if (branchId === 'all') return 'All Branches (Consolidated)'
    const b = branches.find((item) => item.id === branchId)
    return b ? `${b.name} (${b.code})` : 'All Branches (Consolidated)'
  }, [branches, branchId])

  // Current selected report details
  const currentReportObj = useMemo(() => {
    for (const cat of REPORT_CATEGORIES) {
      const found = cat.reports.find((r) => r.id === selectedReport)
      if (found) return found
    }
    return REPORT_CATEGORIES[0].reports[0]
  }, [selectedReport])

  const handleExport = async (overrideFormat?: 'csv' | 'excel' | 'html') => {
    const targetFormat = overrideFormat || exportFormat
    try {
      setIsExporting(true)
      const res = await exportFinancialReportFn({
        data: {
          reportType: selectedReport,
          format: targetFormat,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          branchId: branchId === 'all' ? undefined : branchId,
          branchName: selectedBranchName,
        },
      })

      if (targetFormat === 'html') {
        // Open print preview in a clean new window
        const printWindow = window.open('', '_blank')
        if (printWindow) {
          printWindow.document.write(res.content)
          printWindow.document.close()
          printWindow.focus()
          setTimeout(() => {
            printWindow.print()
          }, 300)
          toast.success(`Prepared ${res.filename} for printing`)
        } else {
          toast.error('Pop-up was blocked. Please allow pop-ups to print.')
        }
      } else {
        // Trigger browser file download (CSV or Excel XML)
        const mimeType =
          targetFormat === 'excel'
            ? 'application/vnd.ms-excel;charset=utf-8;'
            : 'text/csv;charset=utf-8;'

        const blob = new Blob([res.content], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', res.filename)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        toast.success(`Exported ${res.filename} (${res.rowCount} records)`)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export report')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-bold text-foreground">
              Centralized Accounting Export Center
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Generate audit-ready CSV, Excel (.xls), and printable A4 statements directly derived from posted general ledgers with mathematical integrity.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <Badge variant="outline" className="text-primary font-bold">
            FY 2083/84
          </Badge>
          <span className="text-muted-foreground">{formatDualDate(toDate)}</span>
        </div>
      </div>

      {/* 1. Report Selector */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            1. Select Accounting Report
          </Label>
          <span className="text-[11px] text-muted-foreground">
            Active: <strong className="text-foreground">{currentReportObj.name}</strong>
          </span>
        </div>

        <div className="space-y-3">
          {REPORT_CATEGORIES.map((cat) => (
            <div key={cat.category} className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {cat.category}
              </span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {cat.reports.map((rep) => {
                  const Icon = rep.icon
                  const isSelected = rep.id === selectedReport
                  return (
                    <div
                      key={rep.id}
                      onClick={() => {
                        setSelectedReport(rep.id)
                        setExportFormat(rep.recommendedFormat as any)
                      }}
                      className={`cursor-pointer rounded-lg border p-3 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                          : 'border-border bg-card hover:border-border/80 hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`rounded-md p-1.5 ${
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-semibold text-foreground">
                              {rep.name}
                            </h4>
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
                            {rep.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Format & Configuration Parameters */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4 shadow-sm">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          2. Export Parameters & Target Format
        </Label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {/* Format Picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Export Format</Label>
            <NativeSelect
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as any)}
              className="h-8 text-xs font-mono"
            >
              <NativeSelectOption value="csv">CSV Spreadsheet (UTF-8 BOM)</NativeSelectOption>
              <NativeSelectOption value="excel">Microsoft Excel (.xls / XML)</NativeSelectOption>
              <NativeSelectOption value="html">Printable Statement / PDF</NativeSelectOption>
            </NativeSelect>
          </div>

          {/* From Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">From Date</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>

          {/* To Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">To Date</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>

          {/* Company Branch */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Company Branch</Label>
            <NativeSelect
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="h-8 text-xs font-mono"
            >
              <NativeSelectOption value="all">All Branches (Consolidated)</NativeSelectOption>
              {branches.map((b) => (
                <NativeSelectOption key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Selected Report: <strong>{currentReportObj.name}</strong></span>
            <span>•</span>
            <span>Branch: <strong>{selectedBranchName}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              className="h-8 gap-1.5 text-xs font-mono"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('excel')}
              disabled={isExporting}
              className="h-8 gap-1.5 text-xs font-mono"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Excel (.xls)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('html')}
              disabled={isExporting}
              className="h-8 gap-1.5 text-xs font-mono"
            >
              <Printer className="h-3.5 w-3.5 text-blue-600" />
              Print / PDF
            </Button>

            <Button
              size="sm"
              onClick={() => handleExport()}
              disabled={isExporting}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              {isExporting ? 'Generating Report…' : `Export ${exportFormat.toUpperCase()}`}
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Export Safety & Audit Notice Card */}
      <Card className="p-4 border-border bg-muted/20">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-semibold text-foreground">
              Enterprise Export Safety & Audit Compliance
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              Every exported document derives exclusively from server-verified, non-reversed double-entry journal vouchers.
              Exports include all matching records in the selected date range and branch scope (unpaginated complete ledger datasets),
              with strict RBAC authorization and tamper-evident audit timestamps.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
