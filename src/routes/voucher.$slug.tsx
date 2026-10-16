import { createFileRoute } from '@tanstack/react-router'
import { getPublicVoucherFn } from '#/server/finance/finance.functions'
import { formatNPR } from '#/lib/money'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import {
  Printer,
  Share2,
  CheckCircle2,
  CreditCard,
  FileText,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/voucher/$slug')({
  loader: async ({ params }) => {
    try {
      const voucher = await getPublicVoucherFn({ data: { slug: params.slug } })
      return { voucher, error: null }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Voucher not found'
      return { voucher: null, error: msg }
    }
  },
  head: () => ({
    meta: [
      { name: 'robots', content: 'noindex, nofollow' },
      { title: 'Official Settlement Voucher — Mezmani Nepal' },
    ],
  }),
  component: PublicVoucherPage,
})

function PublicVoucherPage() {
  const { voucher, error } = Route.useLoaderData()

  if (error || !voucher) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold tracking-tight mb-2">Voucher Not Found</h1>
          <p className="text-sm text-muted-foreground mb-6">
            The requested settlement voucher could not be found or the link may have expired.
          </p>
          <Button variant="outline" onClick={() => (window.location.href = '/')}>
            Return to Store
          </Button>
        </Card>
      </div>
    )
  }

  const handlePrint = () => {
    window.print()
  }

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Mezmani Official Settlement Voucher ${voucher.voucherNo} for ${voucher.partyName} (Net: ${formatNPR(voucher.netAmount)}):\n${window.location.href}`,
    )
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank')
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    toast.success('Voucher link copied to clipboard!')
  }

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4 sm:px-6 lg:px-8">
      {/* Top action bar - hidden on print */}
      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <div className="text-xs text-muted-foreground">
          Verified Settlement Voucher &bull; Nepal Double-Entry ERP
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleShareWhatsApp} className="h-8 gap-1.5 text-xs text-[#25D366] border-[#25D366]/40 hover:bg-[#25D366]/10">
            <Share2 className="h-3.5 w-3.5" />
            WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyLink} className="h-8 gap-1.5 text-xs">
            Copy Link
          </Button>
          <Button size="sm" onClick={handlePrint} className="h-8 gap-1.5 text-xs">
            <Printer className="h-3.5 w-3.5" />
            Print Voucher
          </Button>
        </div>
      </div>

      {/* Official Voucher Printable Card */}
      <div className="max-w-3xl mx-auto bg-card border rounded-xl shadow-xs overflow-hidden print:border-none print:shadow-none">
        {/* Header with store brand & legal PAN */}
        <div className="p-6 sm:p-8 border-b bg-muted/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-primary">MEZMANI</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Liquor &amp; Delivery ERP
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Mezmani Retail Pvt. Ltd. &bull; Butwal, Rupandehi, Nepal
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                PAN / VAT: 123456789 &bull; Fiscal Year 2083/84 BS
              </p>
            </div>

            <div className="sm:text-right">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-semibold border border-emerald-500/20">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {voucher.status.toUpperCase()}
              </div>
              <div className="font-mono text-base font-bold text-foreground mt-2">
                {voucher.voucherNo}
              </div>
              <div className="text-xs text-muted-foreground">
                {voucher.dateBS.bs} ({voucher.dateBS.dual})
              </div>
            </div>
          </div>
        </div>

        {/* Party Details */}
        <div className="p-6 sm:p-8 border-b grid grid-cols-1 sm:grid-cols-2 gap-6 bg-card">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1">
              Disbursed To ({voucher.partyType})
            </div>
            <div className="text-base font-bold text-foreground">{voucher.partyName}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Verified Party Account &bull; Butwal Logistics Region
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-1">
              Disbursement Method &amp; Reference
            </div>
            <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              {voucher.paymentMethod ? voucher.paymentMethod.replace(/_/g, ' ').toUpperCase() : 'CASH / BANK'}
            </div>
            {voucher.paymentReference && (
              <div className="text-xs font-mono text-muted-foreground mt-0.5">
                Ref / Txn ID: {voucher.paymentReference}
              </div>
            )}
          </div>
        </div>

        {/* Financial Breakdown Table */}
        <div className="p-6 sm:p-8">
          <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">
            Settlement Summary &amp; Tax Deductions
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2.5 px-4 font-medium">Description</th>
                  <th className="text-right py-2.5 px-4 font-medium">Rate / Units</th>
                  <th className="text-right py-2.5 px-4 font-medium">Amount (NPR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {voucher.type === 'dealer' ? (
                  <>
                    <tr>
                      <td className="py-3 px-4 font-medium">
                        Gross Sourced Merchandise Cost (Delivered Order Lines)
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground font-mono text-xs">
                        Dealer Cost Snapshot
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium">
                        {formatNPR(voucher.grossAmount)}
                      </td>
                    </tr>
                    {voucher.tdsRate && voucher.tdsRate > 0 ? (
                      <tr className="bg-destructive/5 text-destructive">
                        <td className="py-3 px-4 font-medium">
                          Nepal Inland Revenue (IRD) TDS Withheld
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs">
                          {voucher.tdsRate}%
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium">
                          - {formatNPR(voucher.tdsAmount || 0)}
                        </td>
                      </tr>
                    ) : null}
                  </>
                ) : (
                  <>
                    {voucher.baseSalaryAmount && voucher.baseSalaryAmount > 0 ? (
                      <tr>
                        <td className="py-3 px-4 font-medium">Base Salary Component</td>
                        <td className="py-3 px-4 text-right text-muted-foreground font-mono text-xs">
                          Contractual Base
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium">
                          {formatNPR(voucher.baseSalaryAmount)}
                        </td>
                      </tr>
                    ) : null}
                    {voucher.perDropAmount && voucher.perDropAmount > 0 ? (
                      <tr>
                        <td className="py-3 px-4 font-medium">Per-Drop Delivery Fee Earnings</td>
                        <td className="py-3 px-4 text-right text-muted-foreground font-mono text-xs">
                          Completed Drops
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium">
                          {formatNPR(voucher.perDropAmount)}
                        </td>
                      </tr>
                    ) : null}
                    {voucher.commissionAmount && voucher.commissionAmount > 0 ? (
                      <tr>
                        <td className="py-3 px-4 font-medium">Commission Component</td>
                        <td className="py-3 px-4 text-right text-muted-foreground font-mono text-xs">
                          Commission Rate
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-medium">
                          {formatNPR(voucher.commissionAmount)}
                        </td>
                      </tr>
                    ) : null}
                    {voucher.advancesDeducted && voucher.advancesDeducted > 0 ? (
                      <tr className="text-destructive">
                        <td className="py-3 px-4 font-medium">Less: Prior Advances Deducted</td>
                        <td className="py-3 px-4 text-right font-mono text-xs">Advance Recovery</td>
                        <td className="py-3 px-4 text-right font-mono font-medium">
                          - {formatNPR(voucher.advancesDeducted)}
                        </td>
                      </tr>
                    ) : null}
                    {voucher.cashShortageDeducted && voucher.cashShortageDeducted > 0 ? (
                      <tr className="text-destructive">
                        <td className="py-3 px-4 font-medium">Less: Cash Shortage Deducted</td>
                        <td className="py-3 px-4 text-right font-mono text-xs">Reconciliation</td>
                        <td className="py-3 px-4 text-right font-mono font-medium">
                          - {formatNPR(voucher.cashShortageDeducted)}
                        </td>
                      </tr>
                    ) : null}
                  </>
                )}
              </tbody>
              <tfoot className="bg-muted/20 font-bold border-t">
                <tr>
                  <td colSpan={2} className="py-3 px-4 text-base">
                    Net Payout / Disbursement
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-base text-primary">
                    {formatNPR(voucher.netAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {voucher.notes && (
            <div className="mt-4 p-3 bg-muted/20 rounded-md text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Narration / Memo:</span> {voucher.notes}
            </div>
          )}

          {/* Proof Attachments */}
          {voucher.proofUrls && voucher.proofUrls.length > 0 && (
            <div className="mt-6 print:hidden">
              <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">
                Attached Proof Documents ({voucher.proofUrls.length})
              </div>
              <div className="flex flex-wrap gap-3">
                {voucher.proofUrls.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span>Proof Attachment #{idx + 1}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Signatures for Print View */}
          <div className="mt-12 pt-8 border-t grid grid-cols-2 gap-8 text-center text-xs text-muted-foreground hidden print:grid">
            <div>
              <div className="h-10 border-b border-dashed border-border/80 mb-2"></div>
              <div>Prepared By / Authorized Signature</div>
              <div className="font-semibold text-foreground mt-0.5">Mezmani Finance Operations</div>
            </div>
            <div>
              <div className="h-10 border-b border-dashed border-border/80 mb-2"></div>
              <div>Received By / Party Signature</div>
              <div className="font-semibold text-foreground mt-0.5">{voucher.partyName}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-muted/10 border-t text-center text-[11px] text-muted-foreground">
          Computer-generated official settlement receipt &bull; Secured with cryptographic tamper-evident slug &bull; Mezmani ERP Nepal
        </div>
      </div>
    </div>
  )
}
