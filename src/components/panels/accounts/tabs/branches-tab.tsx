import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { MoneyText } from '#/components/shared/money-text'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  ArrowRightLeft,
  Building2,
  Edit2,
  ExternalLink,
  Plus,
} from 'lucide-react'
import {
  createBranchFn,
  recordInterBranchTransferFn,
  updateBranchFn,
} from '#/server/finance/branches.functions'
import type { BranchItem } from '#/server/finance/branches.queries'
import { toast } from 'sonner'

export function BranchesTab() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: branches = [] } = useSuspenseQuery(adminQueries.branches())

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const { data: profitability = [] } = useQuery(
    adminQueries.branchProfitability({
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    }),
  )

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null)
  const [transferSourceBranch, setTransferSourceBranch] = useState<BranchItem | null>(null)
  const [isTransferOpen, setIsTransferOpen] = useState(false)

  // Aggregated KPIs
  const activeCount = branches.filter((b) => b.isActive).length
  const headOffice = branches.find((b) => b.isHeadOffice)
  const consolidatedIncome = profitability.reduce((s, p) => s + p.totalIncome, 0)
  const consolidatedExpenses = profitability.reduce((s, p) => s + p.totalExpenses, 0)
  const consolidatedNet = profitability.reduce((s, p) => s + p.netProfit, 0)

  const handleOpenTransfer = (branch?: BranchItem) => {
    setTransferSourceBranch(branch || branches[0] || null)
    setIsTransferOpen(true)
  }

  const handleNavigateToBranchLedger = (branchId: string) => {
    navigate({
      to: '/admin/accounts',
      search: (prev) => ({
        ...prev,
        tab: 'ledger',
        branchId,
      }),
    })
  }

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2.5">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Multi-Branch Enterprise Accounting
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Decentralized branch accounting, inter-branch fund transfers, branch-wise P&L and consolidated financial control.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenTransfer()}
            disabled={branches.length < 2}
            className="h-8 gap-1.5 text-xs"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Inter-Branch Transfer
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="h-8 gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New Branch
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold">
            Company Branches
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold text-foreground">
              {branches.length}
            </span>
            <span className="text-xs text-muted-foreground">
              ({activeCount} Active)
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold">
            Head Office
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge variant="secondary" className="font-mono text-xs">
              {headOffice?.code || 'MAIN'}
            </Badge>
            <span className="text-xs text-foreground font-medium truncate">
              {headOffice?.city || 'Butwal'}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold">
            Consolidated Revenue
          </span>
          <div className="mt-1 font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
            <MoneyText paisa={consolidatedIncome} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold">
            Operating Expenses
          </span>
          <div className="mt-1 font-mono text-lg font-bold text-rose-600 dark:text-rose-400">
            <MoneyText paisa={consolidatedExpenses} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-[11px] text-muted-foreground uppercase font-semibold">
            Consolidated Net Profit
          </span>
          <div
            className={`mt-1 font-mono text-lg font-bold ${
              consolidatedNet >= 0
                ? 'text-foreground'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            <MoneyText paisa={Math.abs(consolidatedNet)} />
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {consolidatedNet >= 0 ? '(Profit)' : '(Loss)'}
            </span>
          </div>
        </div>
      </div>

      {/* Branch Performance & Profitability Table */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              Branch Profitability Matrix
            </span>
            <Badge variant="outline" className="text-[10px] font-mono">
              Consolidated & Branch Breakdown
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Period:</span>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-7 w-32 text-xs font-mono"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-7 w-32 text-xs font-mono"
            />
            {(fromDate || toDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFromDate('')
                  setToDate('')
                }}
                className="h-7 px-2 text-xs"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="w-36 text-xs">Branch</TableHead>
                <TableHead className="w-28 text-xs">Location</TableHead>
                <TableHead className="text-right text-xs">Income</TableHead>
                <TableHead className="text-right text-xs">COGS</TableHead>
                <TableHead className="text-right text-xs">Gross Profit</TableHead>
                <TableHead className="text-right text-xs">Expenses</TableHead>
                <TableHead className="text-right text-xs">Net Margin</TableHead>
                <TableHead className="w-16 text-center text-xs">Status</TableHead>
                <TableHead className="w-44 text-right text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-8 text-center text-xs text-muted-foreground"
                  >
                    No branches configured. Click "New Branch" to register a branch.
                  </TableCell>
                </TableRow>
              ) : (
                branches.map((b) => {
                  const p = profitability.find((row) => row.branchId === b.id) || {
                    totalIncome: 0,
                    totalCogs: 0,
                    grossProfit: 0,
                    totalExpenses: 0,
                    netProfit: 0,
                  }
                  const marginPct =
                    p.totalIncome > 0
                      ? Math.round((p.netProfit / p.totalIncome) * 100)
                      : 0

                  return (
                    <TableRow key={b.id} className="border-border text-xs">
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground">
                            {b.name}
                          </span>
                          {b.isHeadOffice && (
                            <Badge
                              variant="outline"
                              className="border-primary/40 bg-primary/10 text-primary text-[9px] px-1 py-0"
                            >
                              HQ
                            </Badge>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          Code: {b.code}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div>{b.city || '—'}</div>
                        {b.phone && (
                          <div className="text-[10px] text-muted-foreground/70">
                            {b.phone}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                        <MoneyText paisa={p.totalIncome} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        <MoneyText paisa={p.totalCogs} />
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        <MoneyText paisa={p.grossProfit} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-rose-600 dark:text-rose-400">
                        <MoneyText paisa={p.totalExpenses} />
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        <div
                          className={
                            p.netProfit >= 0
                              ? 'text-foreground'
                              : 'text-rose-600 dark:text-rose-400'
                          }
                        >
                          <MoneyText paisa={Math.abs(p.netProfit)} />
                          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                            ({marginPct}%)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            b.isActive
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                              : 'border-muted text-muted-foreground'
                          }`}
                        >
                          {b.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleNavigateToBranchLedger(b.id)}
                            className="h-6 gap-1 px-2 text-[11px]"
                            title="View general ledger for this branch"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ledger
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenTransfer(b)}
                            className="h-6 gap-1 px-2 text-[11px]"
                            title="Transfer funds to/from this branch"
                          >
                            <ArrowRightLeft className="h-3 w-3" />
                            Transfer
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingBranch(b)}
                            className="h-6 w-6 p-0"
                            title="Edit branch details"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create Branch Modal */}
      {isCreateOpen && (
        <CreateBranchDialog
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'branches'] })
            setIsCreateOpen(false)
          }}
        />
      )}

      {/* Edit Branch Modal */}
      {editingBranch && (
        <EditBranchDialog
          branch={editingBranch}
          onClose={() => setEditingBranch(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'branches'] })
            setEditingBranch(null)
          }}
        />
      )}

      {/* Inter-Branch Transfer Modal */}
      {isTransferOpen && (
        <InterBranchTransferDialog
          branches={branches}
          initialSourceBranch={transferSourceBranch}
          onClose={() => setIsTransferOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] })
            queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'branches'] })
            queryClient.invalidateQueries({ queryKey: ['admin', 'finance', 'branch-profitability'] })
            setIsTransferOpen(false)
          }}
        />
      )}
    </div>
  )
}

function CreateBranchDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [isHeadOffice, setIsHeadOffice] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !name.trim()) {
      toast.error('Branch code and name are required.')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await createBranchFn({
        data: {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          city: city.trim() || undefined,
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
          isHeadOffice,
        },
      })
      toast.success(`Created branch ${res.name} (${res.code}) successfully!`)
      onSuccess()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create branch')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Register New Branch
          </DialogTitle>
          <DialogDescription className="text-xs">
            Create an independent company branch with localized cash vault, expenses, and P&L.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Branch Code *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. KTM, PKR"
                maxLength={8}
                className="h-8 font-mono text-xs uppercase"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Branch Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pokhara Branch"
                className="h-8 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">City</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Pokhara"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 061-520000"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Street Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Lakeside Road, Pokhara"
              className="h-8 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <input
              type="checkbox"
              id="isHeadOffice"
              checked={isHeadOffice}
              onChange={(e) => setIsHeadOffice(e.target.checked)}
              className="rounded border-border"
            />
            <Label htmlFor="isHeadOffice" className="text-xs cursor-pointer">
              Set as Principal Head Office
            </Label>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8 text-xs"
            >
              {isSubmitting ? 'Creating…' : 'Create Branch'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditBranchDialog({
  branch,
  onClose,
  onSuccess,
}: {
  branch: BranchItem
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(branch.name)
  const [city, setCity] = useState(branch.city || '')
  const [address, setAddress] = useState(branch.address || '')
  const [phone, setPhone] = useState(branch.phone || '')
  const [isHeadOffice, setIsHeadOffice] = useState(branch.isHeadOffice)
  const [isActive, setIsActive] = useState(branch.isActive)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      setIsSubmitting(true)
      await updateBranchFn({
        data: {
          id: branch.id,
          name: name.trim(),
          city: city.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          isHeadOffice,
          isActive,
        },
      })
      toast.success(`Updated branch ${branch.code} successfully!`)
      onSuccess()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update branch')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Edit2 className="h-4 w-4 text-primary" />
            Edit Branch: {branch.name} ({branch.code})
          </DialogTitle>
          <DialogDescription className="text-xs">
            Update branch profile, contact info and operational status.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Branch Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">City</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editIsHeadOffice"
                checked={isHeadOffice}
                onChange={(e) => setIsHeadOffice(e.target.checked)}
                className="rounded border-border"
              />
              <Label htmlFor="editIsHeadOffice" className="text-xs cursor-pointer">
                Head Office
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editIsActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-border"
              />
              <Label htmlFor="editIsActive" className="text-xs cursor-pointer">
                Active Branch
              </Label>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8 text-xs"
            >
              {isSubmitting ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function InterBranchTransferDialog({
  branches,
  initialSourceBranch,
  onClose,
  onSuccess,
}: {
  branches: BranchItem[]
  initialSourceBranch: BranchItem | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [fromBranchId, setFromBranchId] = useState(
    initialSourceBranch?.id || branches[0]?.id || '',
  )
  const [toBranchId, setToBranchId] = useState(
    branches.find((b) => b.id !== fromBranchId)?.id || '',
  )
  const [fromAccountId, setFromAccountId] = useState('acc_1011') // Cash in Hand default
  const [toAccountId, setToAccountId] = useState('acc_1011')
  const [amountInRs, setAmountInRs] = useState('')
  const [narration, setNarration] = useState('')
  const [postingDate, setPostingDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activeBranches = branches.filter((b) => b.isActive)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountNum = parseFloat(amountInRs)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid transfer amount.')
      return
    }
    if (fromBranchId === toBranchId && fromAccountId === toAccountId) {
      toast.error('Source and destination cannot be identical in the same branch.')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await recordInterBranchTransferFn({
        data: {
          fromBranchId,
          toBranchId,
          fromAccountId,
          toAccountId,
          amountInRs: amountNum,
          narration: narration.trim() || undefined,
          postingDate: postingDate || undefined,
        },
      })
      toast.success(`Inter-branch transfer posted: ${res.voucherNo}`)
      onSuccess()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to post inter-branch transfer')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            Inter-Branch Fund Transfer
          </DialogTitle>
          <DialogDescription className="text-xs">
            Transfer liquid funds between company branches with double-entry contra verification.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Source Branch & Account */}
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
              Source Disbursing Branch
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">From Branch</Label>
                <NativeSelect
                  value={fromBranchId}
                  onChange={(e) => setFromBranchId(e.target.value)}
                  className="h-8 text-xs"
                >
                  {activeBranches.map((b) => (
                    <NativeSelectOption key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">From Account</Label>
                <NativeSelect
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="h-8 text-xs font-mono"
                >
                  <NativeSelectOption value="acc_1011">
                    1011 - Cash in Hand
                  </NativeSelectOption>
                  <NativeSelectOption value="acc_1012">
                    1012 - Main Operating Bank
                  </NativeSelectOption>
                </NativeSelect>
              </div>
            </div>
          </div>

          {/* Destination Branch & Account */}
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
              Destination Receiving Branch
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">To Branch</Label>
                <NativeSelect
                  value={toBranchId}
                  onChange={(e) => setToBranchId(e.target.value)}
                  className="h-8 text-xs"
                >
                  {activeBranches.map((b) => (
                    <NativeSelectOption key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To Account</Label>
                <NativeSelect
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="h-8 text-xs font-mono"
                >
                  <NativeSelectOption value="acc_1011">
                    1011 - Cash in Hand
                  </NativeSelectOption>
                  <NativeSelectOption value="acc_1012">
                    1012 - Main Operating Bank
                  </NativeSelectOption>
                </NativeSelect>
              </div>
            </div>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Transfer Amount (NPR) *</Label>
              <Input
                type="number"
                step="0.01"
                min="1"
                value={amountInRs}
                onChange={(e) => setAmountInRs(e.target.value)}
                placeholder="Rs. 0.00"
                className="h-8 font-mono text-xs font-bold"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Transfer Date</Label>
              <Input
                type="date"
                value={postingDate}
                onChange={(e) => setPostingDate(e.target.value)}
                className="h-8 font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Narration / Memo</Label>
            <Input
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="e.g. Branch replenishment, cash vault rebalancing"
              className="h-8 text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8 gap-1.5 text-xs"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              {isSubmitting ? 'Transferring…' : 'Execute Transfer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
