import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { generateMonthlyRiderPayrollRunFn } from '#/server/operations/operations.functions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Checkbox } from '#/components/ui/checkbox'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Card } from '#/components/ui/card'
import { Calendar, DollarSign, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { formatNPR } from '#/lib/money'

export interface RiderPayrollRunDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  riders: Array<{
    id: string
    name: string
    phone?: string
    baseSalary?: number
    perDropRate?: number
  }>
  onSuccess?: () => void
}

export function RiderPayrollRunDialog({
  open,
  onOpenChange,
  riders,
  onSuccess,
}: RiderPayrollRunDialogProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Default to 1st of current month to today
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const defaultStart = firstDay.toISOString().slice(0, 10)
  const defaultEnd = now.toISOString().slice(0, 10)

  const [periodStart, setPeriodStart] = useState(defaultStart)
  const [periodEnd, setPeriodEnd] = useState(defaultEnd)
  const [selectedRiderId, setSelectedRiderId] = useState<string>('all')
  const [includeBaseSalary, setIncludeBaseSalary] = useState(true)
  const [deductCashShortages, setDeductCashShortages] = useState(true)
  const [deductAdvances, setDeductAdvances] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const targetCount =
    selectedRiderId === 'all'
      ? riders.length
      : riders.filter((r) => r.id === selectedRiderId).length

  const handleGeneratePayroll = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!periodStart || !periodEnd) {
      toast.error('Please specify both start and end dates')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await generateMonthlyRiderPayrollRunFn({
        data: {
          periodStart,
          periodEnd,
          riderId: selectedRiderId === 'all' ? undefined : selectedRiderId,
          includeBaseSalary,
          deductCashShortages,
          deductAdvances,
        },
      })

      toast.success(
        `Generated ${res.length} draft payroll settlement(s) successfully`,
      )
      onOpenChange(false)
      if (onSuccess) onSuccess()
      await queryClient.invalidateQueries({
        queryKey: adminQueries.ledger().queryKey,
      })
      await router.invalidate()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate monthly payroll run')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
        <form
          onSubmit={handleGeneratePayroll}
          className="flex flex-col h-full min-h-0"
        >
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-muted/10">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Generate Monthly Courier Payroll Run
            </DialogTitle>
            <DialogDescription className="text-xs">
              Aggregate delivered drops, compute per-drop earnings + base
              salary, apply shortage deductions, and create draft settlement
              vouchers for approval.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 click-scroll">
            {/* Courier Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Target Couriers</Label>
              <NativeSelect
                value={selectedRiderId}
                onChange={(e) => setSelectedRiderId(e.target.value)}
                className="w-full text-xs"
              >
                <NativeSelectOption value="all">
                  All Active Couriers ({riders.length})
                </NativeSelectOption>
                {riders.map((r) => (
                  <NativeSelectOption key={r.id} value={r.id}>
                    {r.name} (Base: {formatNPR(r.baseSalary || 0)}, Drop:{' '}
                    {formatNPR(r.perDropRate || 5000)})
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            {/* Date Range Selection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Period Start</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Period End</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
            </div>

            {/* Computation Options */}
            <Card className="p-3 bg-muted/30 border-dashed space-y-2.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Payroll Components
              </span>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeBaseSalary"
                  checked={includeBaseSalary}
                  onCheckedChange={(c) => setIncludeBaseSalary(Boolean(c))}
                />
                <label
                  htmlFor="includeBaseSalary"
                  className="text-xs font-medium leading-none cursor-pointer"
                >
                  Include Monthly Base Salary (accrued per rider)
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="deductCashShortages"
                  checked={deductCashShortages}
                  onCheckedChange={(c) => setDeductCashShortages(Boolean(c))}
                />
                <label
                  htmlFor="deductCashShortages"
                  className="text-xs font-medium leading-none cursor-pointer"
                >
                  Deduct Unreconciled COD Cash Shortages
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="deductAdvances"
                  checked={deductAdvances}
                  onCheckedChange={(c) => setDeductAdvances(Boolean(c))}
                />
                <label
                  htmlFor="deductAdvances"
                  className="text-xs font-medium leading-none cursor-pointer"
                >
                  Deduct Prior Advance Disbursals
                </label>
              </div>
            </Card>

            <div className="rounded-md border border-border bg-background p-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Couriers to process:
                </span>
              </div>
              <span className="font-semibold text-foreground font-mono">
                {targetCount} personnel
              </span>
            </div>
          </div>

          <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || targetCount === 0}
              className="gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <DollarSign className="h-3.5 w-3.5" />
                  Generate Draft Settlements
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
