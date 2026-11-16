import { useState, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Download,
  FileSpreadsheet,
  FileText,
  Upload,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { adminQueries } from '#/queries/admin'
import {
  exportSuperAdminDataFn,
  bulkImportSuperAdminDataFn,
} from '#/server/superadmin/superadmin.functions'
import { downloadCsvFile, parseCsvText } from '#/lib/csv-helper'
import type { ParsedCsvResult } from '#/lib/csv-helper'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent } from '#/components/ui/card'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { Label } from '#/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '#/components/ui/tabs'
import { Textarea } from '#/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { SectionHeader } from './section-header'
import { CsvSchemaDisclosure } from './csv-schema-disclosure'
import type { EntityConfig } from '../types'

interface CsvImportTabProps {
  config: EntityConfig
}

export function CsvImportTab({ config }: CsvImportTabProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [inputTab, setInputTab] = useState<'upload' | 'paste'>('upload')
  const [importMode, setImportMode] = useState<'upsert' | 'skip'>('upsert')
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [pastedCsv, setPastedCsv] = useState('')
  const [parsedData, setParsedData] = useState<ParsedCsvResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [importReport, setImportReport] = useState<{
    inserted: number
    updated: number
    skipped: number
    errors: string[]
  } | null>(null)

  const handleDownloadTemplate = () => {
    downloadCsvFile(config.templateFilename, config.sampleCsv)
    toast.success(`Downloaded ${config.label} template CSV`, {
      description: `Filename: ${config.templateFilename}`,
    })
  }

  const handleExportData = async () => {
    try {
      setIsExporting(true)
      const res = await exportSuperAdminDataFn({
        data: { entity: config.key },
      })
      downloadCsvFile(res.filename, res.csv)
      toast.success(`Exported ${res.count} ${config.label}`, {
        description: `Saved as ${res.filename} with UTF-8 BOM`,
      })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export live data')
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFileName(file.name)
    setImportReport(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) {
        toast.error('The selected file appears to be empty')
        return
      }
      const result = parseCsvText(text)
      setParsedData(result)
      if (result.errors.length > 0) {
        toast.warning(`Parsed with warnings: ${result.errors[0]}`)
      } else {
        toast.success(`Parsed ${result.rows.length} rows successfully`)
      }
    }
    reader.onerror = () => {
      toast.error('Failed to read CSV file')
    }
    reader.readAsText(file)
  }

  const handleParsePastedText = () => {
    if (!pastedCsv.trim()) {
      toast.error('Please paste CSV text to preview')
      return
    }
    setImportReport(null)
    const result = parseCsvText(pastedCsv)
    setParsedData(result)
    setSelectedFileName('Pasted CSV text')
    if (result.errors.length > 0) {
      toast.warning(`Parsed with warnings: ${result.errors[0]}`)
    } else {
      toast.success(`Parsed ${result.rows.length} rows successfully`)
    }
  }

  const handleClear = () => {
    setParsedData(null)
    setPastedCsv('')
    setSelectedFileName(null)
    setImportReport(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleExecuteImport = async () => {
    if (!parsedData || parsedData.rows.length === 0) {
      toast.error('No rows ready to import')
      return
    }

    try {
      setIsImporting(true)
      const res = await bulkImportSuperAdminDataFn({
        data: {
          entity: config.key,
          mode: importMode,
          rows: parsedData.rows,
        },
      })

      setImportReport(res)
      await queryClient.invalidateQueries({
        queryKey: adminQueries.superAdminOverview().queryKey,
      })

      if (res.errors.length > 0) {
        toast.warning(
          `Import finished with notices: ${res.inserted} inserted, ${res.updated} updated, ${res.errors.length} errors`,
        )
      } else {
        toast.success(
          `Import complete! ${res.inserted} inserted, ${res.updated} updated, ${res.skipped} skipped.`,
        )
      }
    } catch (err: any) {
      toast.error(err?.message || 'Bulk import failed')
    } finally {
      setIsImporting(false)
    }
  }

  const validationSummary = useMemo(() => {
    if (!parsedData || parsedData.rows.length === 0) return null

    const requiredCols = config.columns.filter((c) => c.required).map((c) => c.name)
    const headers = parsedData.headers.map((h) => h.toLowerCase())

    const missingRequiredHeaders = requiredCols.filter(
      (req) => !headers.includes(req.toLowerCase()),
    )

    let rowsWithMissingFields = 0
    parsedData.rows.forEach((r) => {
      const isMissing = requiredCols.some((reqCol) => {
        const val = r[reqCol] || r[reqCol.toLowerCase()]
        return !val || val.trim() === ''
      })
      if (isMissing) rowsWithMissingFields++
    })

    return {
      totalRows: parsedData.rows.length,
      missingRequiredHeaders,
      rowsWithMissingFields,
      isValid: missingRequiredHeaders.length === 0 && rowsWithMissingFields === 0,
    }
  }, [parsedData, config])

  return (
    <div className="space-y-4">
      {/* View Header with secondary export / template download actions */}
      <SectionHeader
        title={config.label}
        icon={config.icon}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <Download className="h-3.5 w-3.5 text-primary" />
              <span>Download Template</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportData}
              disabled={isExporting}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              {isExporting ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5" />
              )}
              <span>Export CSV</span>
            </Button>
          </>
        }
      />

      {/* Collapsed Schema Disclosure */}
      <CsvSchemaDisclosure
        columns={config.columns}
        primaryKeyDesc={config.primaryKeyDesc}
      />

      {/* Main Bulk Import Action Area */}
      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                Bulk Import
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                ({config.primaryKeyDesc})
              </span>
            </div>

            {/* Conflict Policy */}
            <div className="flex items-center gap-2.5 bg-muted/40 px-2.5 py-1.5 rounded-lg border border-border text-xs">
              <span className="text-muted-foreground font-medium">Conflict Policy:</span>
              <RadioGroup
                value={importMode}
                onValueChange={(val: any) => setImportMode(val)}
                className="flex items-center gap-3 text-xs"
              >
                <div className="flex items-center space-x-1.5">
                  <RadioGroupItem value="upsert" id={`${config.key}-mode-upsert`} />
                  <Label htmlFor={`${config.key}-mode-upsert`} className="text-xs font-medium cursor-pointer">
                    Upsert
                  </Label>
                </div>
                <div className="flex items-center space-x-1.5">
                  <RadioGroupItem value="skip" id={`${config.key}-mode-skip`} />
                  <Label htmlFor={`${config.key}-mode-skip`} className="text-xs font-medium cursor-pointer">
                    Skip
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {/* Import Modes: File or Paste */}
          <Tabs value={inputTab} onValueChange={(val: any) => setInputTab(val)} className="w-full">
            <TabsList className="grid grid-cols-2 max-w-xs h-8">
              <TabsTrigger value="upload" className="text-xs gap-1.5">
                <FileSpreadsheet className="h-3 w-3" />
                <span>Upload CSV</span>
              </TabsTrigger>
              <TabsTrigger value="paste" className="text-xs gap-1.5">
                <FileText className="h-3 w-3" />
                <span>Paste Raw CSV</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-border hover:border-primary/60 rounded-xl p-6 text-center transition-colors bg-muted/10 hover:bg-muted/20"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {selectedFileName ? selectedFileName : 'Choose or drop CSV file'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Supports UTF-8 CSV exports
                    </p>
                  </div>
                  {selectedFileName && (
                    <Badge variant="outline" className="mt-1 text-xs font-mono">
                      {selectedFileName}
                    </Badge>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="paste" className="mt-3 space-y-2">
              <Textarea
                rows={5}
                placeholder={`Paste CSV lines here, e.g.:\n${config.sampleCsv}`}
                value={pastedCsv}
                onChange={(e) => setPastedCsv(e.target.value)}
                className="font-mono text-xs"
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPastedCsv('')}
                  disabled={!pastedCsv}
                  className="text-xs h-7"
                >
                  Clear Text
                </Button>
                <Button
                  size="sm"
                  onClick={handleParsePastedText}
                  disabled={!pastedCsv.trim()}
                  className="text-xs h-7 gap-1"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Parse & Preview</span>
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* Validation & Preview Section */}
          {parsedData && (
            <div className="space-y-3 pt-3 border-t border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-semibold text-foreground">
                    Parsed: <strong className="font-mono">{parsedData.rows.length}</strong> rows, <strong className="font-mono">{parsedData.headers.length}</strong> columns
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClear}
                    className="h-7 text-xs"
                  >
                    Discard
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleExecuteImport}
                    disabled={isImporting || parsedData.rows.length === 0}
                    className="h-7 text-xs gap-1.5 bg-primary font-semibold"
                  >
                    {isImporting ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    <span>
                      {isImporting
                        ? 'Importing...'
                        : `Import ${parsedData.rows.length} Records`}
                    </span>
                  </Button>
                </div>
              </div>

              {/* Validation Warning */}
              {validationSummary && !validationSummary.isValid && (
                <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-foreground flex items-start gap-2 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-xs">Validation Notice</p>
                    {validationSummary.missingRequiredHeaders.length > 0 && (
                      <p className="text-[11px]">
                        Missing required columns:{' '}
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                          {validationSummary.missingRequiredHeaders.join(', ')}
                        </span>
                      </p>
                    )}
                    {validationSummary.rowsWithMissingFields > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        {validationSummary.rowsWithMissingFields} row(s) contain empty mandatory values and will be skipped.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Data Preview Table */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Preview of first {Math.min(parsedData.rows.length, 6)} rows</span>
                  <span className="font-mono">Total: {parsedData.rows.length}</span>
                </div>
                <div className="rounded-lg border border-border overflow-x-auto max-h-[240px]">
                  <Table>
                    <TableHeader className="bg-muted/40 sticky top-0">
                      <TableRow>
                        <TableHead className="text-xs font-bold py-1.5 w-10 text-center">#</TableHead>
                        {parsedData.headers.map((h) => (
                          <TableHead key={h} className="text-xs font-bold py-1.5 font-mono whitespace-nowrap">
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.rows.slice(0, 6).map((row, idx) => (
                        <TableRow key={idx} className="hover:bg-muted/20">
                          <TableCell className="text-xs text-muted-foreground text-center py-1.5 font-mono">
                            {idx + 1}
                          </TableCell>
                          {parsedData.headers.map((h) => (
                            <TableCell key={h} className="text-xs py-1.5 font-mono max-w-[200px] truncate">
                              {row[h] || <span className="text-muted-foreground italic">—</span>}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {/* Execution Report Card */}
          {importReport && (
            <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs space-y-2.5 pt-3 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-foreground">
                    Import Execution Summary
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Mode: {importMode.toUpperCase()}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded-lg border border-border bg-muted/20">
                  <p className="text-muted-foreground text-[11px] font-medium">Inserted</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">
                    {importReport.inserted}
                  </p>
                </div>
                <div className="p-2 rounded-lg border border-border bg-muted/20">
                  <p className="text-muted-foreground text-[11px] font-medium">Updated</p>
                  <p className="text-lg font-bold text-primary tabular-nums font-mono">
                    {importReport.updated}
                  </p>
                </div>
                <div className="p-2 rounded-lg border border-border bg-muted/20">
                  <p className="text-muted-foreground text-[11px] font-medium">Skipped</p>
                  <p className="text-lg font-bold text-muted-foreground tabular-nums font-mono">
                    {importReport.skipped}
                  </p>
                </div>
                <div className="p-2 rounded-lg border border-border bg-muted/20">
                  <p className="text-muted-foreground text-[11px] font-medium">Errors</p>
                  <p className={`text-lg font-bold tabular-nums font-mono ${importReport.errors.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {importReport.errors.length}
                  </p>
                </div>
              </div>

              {importReport.errors.length > 0 && (
                <div className="p-2.5 rounded-lg border border-destructive/30 bg-destructive/5 space-y-1">
                  <div className="flex items-center gap-1 text-xs font-semibold text-destructive">
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Row Validation Diagnostics ({importReport.errors.length})</span>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto pl-4 list-disc">
                    {importReport.errors.map((err, i) => (
                      <li key={i} className="font-mono text-[11px]">
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
