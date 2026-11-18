import { useCallback, useMemo, useState } from 'react'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { adminQueries } from '#/queries/admin'
import { DataTable } from '#/components/shared/data-table'
import { MoneyText } from '#/components/shared/money-text'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { TableCell, TableRow } from '#/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { ROOT_TYPE_OPTIONS } from '../accounts-route'
import { exportCsv } from '../export-csv'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import {
  createAccountFn,
  updateAccountFn,
} from '#/server/finance/coa.functions'
import { toast } from 'sonner'
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Download,
  Edit2,
  ExternalLink,
  MoreVertical,
  Plus,
  Power,
  Snowflake,
} from 'lucide-react'
import type { AccountWithBalance } from '#/server/finance/finance.queries'

const ROOT_TYPE_CLASS: Record<string, string> = {
  asset: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  liability:
    'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  equity:
    'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400',
  income:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  expense: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
}

interface CoaTreeNode extends AccountWithBalance {
  children: CoaTreeNode[]
  rollupDebit: number
  rollupCredit: number
  rollupBalance: number
  rollupLines: number
}

interface CoaTreeRow extends CoaTreeNode {
  depth: number
  isExpanded: boolean
}

function buildTree(accounts: AccountWithBalance[]) {
  const nodes = new Map<string, CoaTreeNode>()
  for (const account of accounts) {
    nodes.set(account.id, {
      ...account,
      children: [],
      rollupDebit: account.totalDebit,
      rollupCredit: account.totalCredit,
      rollupBalance: account.netBalance,
      rollupLines: account.lineCount,
    })
  }

  const roots: CoaTreeNode[] = []
  for (const account of accounts) {
    const node = nodes.get(account.id)
    if (!node) continue
    const parent = account.parentId ? nodes.get(account.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const rollup = (node: CoaTreeNode) => {
    node.children.sort((a, b) => a.code.localeCompare(b.code))
    for (const child of node.children) {
      rollup(child)
      node.rollupDebit += child.rollupDebit
      node.rollupCredit += child.rollupCredit
      node.rollupBalance += child.rollupBalance
      node.rollupLines += child.rollupLines
    }
  }
  roots.sort((a, b) => a.code.localeCompare(b.code))
  for (const root of roots) rollup(root)

  return { roots, nodes }
}

export function ChartOfAccountsTab() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: ledgerData } = useSuspenseQuery(adminQueries.ledger())
  const chartOfAccounts = ledgerData.ops.chartOfAccounts

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 200)
  const [rootFilter, setRootFilter] = useState<string>('all')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<AccountWithBalance | null>(null)

  // Create form state
  const [createCode, setCreateCode] = useState('')
  const [createName, setCreateName] = useState('')
  const [createRootType, setCreateRootType] = useState<
    'asset' | 'liability' | 'equity' | 'income' | 'expense'
  >('expense')
  const [createParentId, setCreateParentId] = useState<string>('')
  const [createIsGroup, setCreateIsGroup] = useState(false)
  const [createAccountType, setCreateAccountType] = useState('other')
  const [createBalanceSide, setCreateBalanceSide] = useState<'debit' | 'credit'>('debit')
  const [createDescription, setCreateDescription] = useState('')

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAccountType, setEditAccountType] = useState('other')

  const { roots } = useMemo(() => buildTree(chartOfAccounts), [chartOfAccounts])

  const groupAccounts = useMemo(
    () => chartOfAccounts.filter((account) => account.isGroup),
    [chartOfAccounts],
  )

  const groupIds = useMemo(
    () => groupAccounts.map((account) => account.id),
    [groupAccounts],
  )

  const isFiltering = debouncedQuery.trim().length > 0 || rootFilter !== 'all'

  const visibleIds = useMemo(() => {
    const text = debouncedQuery.trim().toLowerCase()
    const matches = (account: CoaTreeNode) => {
      if (rootFilter !== 'all' && account.rootType !== rootFilter) return false
      if (!text) return true
      return (
        account.code.toLowerCase().includes(text) ||
        account.name.toLowerCase().includes(text) ||
        (account.accountType ?? '').toLowerCase().includes(text) ||
        (account.description ?? '').toLowerCase().includes(text)
      )
    }

    const visible = new Set<string>()
    const visit = (node: CoaTreeNode): boolean => {
      const childMatch = node.children.map(visit).some(Boolean)
      const selfMatch = matches(node)
      if (selfMatch || childMatch) visible.add(node.id)
      return selfMatch || childMatch
    }
    for (const root of roots) visit(root)
    return visible
  }, [roots, debouncedQuery, rootFilter])

  const rows = useMemo(() => {
    const flat: CoaTreeRow[] = []
    const visit = (node: CoaTreeNode, depth: number) => {
      if (!visibleIds.has(node.id)) return
      const isExpanded =
        isFiltering || !collapsed.has(node.id) || node.children.length === 0
      flat.push({ ...node, depth, isExpanded })
      if (node.children.length > 0 && isExpanded) {
        for (const child of node.children) visit(child, depth + 1)
      }
    }
    for (const root of roots) visit(root, 0)
    return flat
  }, [roots, visibleIds, collapsed, isFiltering])

  const toggleExpand = useCallback((id: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allCollapsed =
    groupIds.length > 0 && groupIds.every((id) => collapsed.has(id))

  const openLedger = useCallback(
    (accountId: string) => {
      navigate({
        to: '/admin/accounts',
        search: (previous) => ({
          ...previous,
          tab: 'ledger',
          account: accountId,
          partyType: undefined,
          partyId: undefined,
        }),
      })
    },
    [navigate],
  )

  const handleOpenEdit = (acc: AccountWithBalance) => {
    setSelectedAccount(acc)
    setEditName(acc.name)
    setEditDescription(acc.description || '')
    setEditAccountType(acc.accountType || 'other')
    setIsEditOpen(true)
  }

  const handleToggleFreeze = async (acc: AccountWithBalance) => {
    try {
      setIsSubmitting(true)
      await updateAccountFn({
        data: { id: acc.id, isFrozen: !acc.isFrozen },
      })
      toast.success(
        `Account ${acc.code} ${acc.isFrozen ? 'unfrozen' : 'frozen'} successfully`,
      )
      await queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update freeze status')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleActive = async (acc: AccountWithBalance) => {
    try {
      setIsSubmitting(true)
      await updateAccountFn({
        data: { id: acc.id, isActive: !acc.isActive },
      })
      toast.success(
        `Account ${acc.code} ${acc.isActive ? 'deactivated' : 'activated'} successfully`,
      )
      await queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update account status')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName.trim()) {
      toast.error('Account name is required')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await createAccountFn({
        data: {
          code: createCode.trim() || undefined,
          name: createName.trim(),
          rootType: createRootType,
          parentId: createParentId || undefined,
          isGroup: createIsGroup,
          accountType: createAccountType,
          balanceMustBe: createBalanceSide,
          description: createDescription.trim() || undefined,
        },
      })
      toast.success(`Account "${res.name}" (${res.code}) created successfully`)
      setIsCreateOpen(false)
      setCreateName('')
      setCreateCode('')
      setCreateDescription('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create account')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAccount) return
    if (!editName.trim()) {
      toast.error('Account name is required')
      return
    }

    try {
      setIsSubmitting(true)
      await updateAccountFn({
        data: {
          id: selectedAccount.id,
          name: editName.trim(),
          description: editDescription.trim() || null,
          accountType: editAccountType,
        },
      })
      toast.success('Account updated successfully')
      setIsEditOpen(false)
      setSelectedAccount(null)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update account')
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns = useMemo<ColumnDef<CoaTreeRow>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'Account',
        cell: ({ row }) => {
          const account = row.original
          const paddingLeft = `${account.depth * 18 + 4}px`
          const hasChildren = account.children.length > 0

          return (
            <div
              className="flex items-center gap-2"
              style={{ paddingLeft }}
              onClick={(event) => {
                if (hasChildren) {
                  event.stopPropagation()
                  toggleExpand(account.id)
                }
              }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                  aria-label={account.isExpanded ? 'Collapse' : 'Expand'}
                >
                  {account.isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <span className="inline-block h-5 w-5 shrink-0 text-center text-muted-foreground/40">
                  ·
                </span>
              )}
              <div className="min-w-0 leading-tight">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`font-mono text-xs ${
                      account.isGroup
                        ? 'font-bold text-foreground'
                        : 'font-semibold text-foreground'
                    }`}
                  >
                    {account.code}
                  </span>
                  <span
                    className={`text-xs ${
                      account.isGroup
                        ? 'font-semibold text-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {account.name}
                  </span>
                  {account.isGroup && (
                    <Badge
                      variant="outline"
                      className="px-1 py-0 text-[9px] uppercase tracking-wide"
                    >
                      Group
                    </Badge>
                  )}
                  {account.isFrozen && (
                    <Badge
                      variant="outline"
                      className="gap-0.5 border-sky-500/30 bg-sky-500/10 px-1 py-0 text-[9px] text-sky-600 dark:text-sky-400"
                    >
                      <Snowflake className="h-2.5 w-2.5" />
                      Frozen
                    </Badge>
                  )}
                  {!account.isActive && (
                    <Badge
                      variant="outline"
                      className="px-1 py-0 text-[9px] text-muted-foreground"
                    >
                      Inactive
                    </Badge>
                  )}
                </span>
                {account.description && (
                  <span
                    className="block max-w-[360px] truncate text-[10px] text-muted-foreground"
                    title={account.description}
                  >
                    {account.description}
                  </span>
                )}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'rootType',
        header: 'Type',
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={`text-[10px] capitalize ${
              ROOT_TYPE_CLASS[row.original.rootType] ?? ''
            }`}
          >
            {row.original.rootType}
          </Badge>
        ),
      },
      {
        accessorKey: 'accountType',
        header: 'Sub-type',
        cell: ({ row }) =>
          row.original.accountType ? (
            <span className="text-xs capitalize text-muted-foreground">
              {row.original.accountType.replace(/_/g, ' ')}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'balanceMustBe',
        header: 'Balance',
        cell: ({ row }) =>
          row.original.balanceMustBe ? (
            <span className="font-mono text-xs uppercase text-muted-foreground">
              {row.original.balanceMustBe}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: 'totalDebit',
        header: () => <div className="text-right">Debit (NPR)</div>,
        cell: ({ row }) => (
          <MoneyText
            paisa={
              row.original.isGroup
                ? row.original.rollupDebit
                : row.original.totalDebit
            }
            className={`block text-right text-xs font-mono ${
              row.original.isGroup ? 'font-semibold' : ''
            }`}
          />
        ),
      },
      {
        id: 'totalCredit',
        header: () => <div className="text-right">Credit (NPR)</div>,
        cell: ({ row }) => (
          <MoneyText
            paisa={
              row.original.isGroup
                ? row.original.rollupCredit
                : row.original.totalCredit
            }
            className={`block text-right text-xs font-mono ${
              row.original.isGroup ? 'font-semibold' : ''
            }`}
          />
        ),
      },
      {
        id: 'netBalance',
        header: () => <div className="text-right">Net Balance</div>,
        cell: ({ row }) => {
          const balance = row.original.isGroup
            ? row.original.rollupBalance
            : row.original.netBalance
          const isNegative = balance < 0
          return (
            <MoneyText
              paisa={Math.abs(balance)}
              className={`block text-right text-xs font-mono font-bold ${
                isNegative
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            />
          )
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const acc = row.original
          return (
            <div
              className="flex items-center justify-end gap-1"
              onClick={(event) => event.stopPropagation()}
            >
              {!acc.isGroup && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openLedger(acc.id)}
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span className="hidden sm:inline">Ledger</span>
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    title="Account options"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                    <span className="sr-only">Open account options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 text-xs">
                  <DropdownMenuItem
                    onClick={() => handleOpenEdit(acc)}
                    className="gap-2 cursor-pointer"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Edit Account</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToggleFreeze(acc)}
                    disabled={isSubmitting}
                    className="gap-2 cursor-pointer"
                  >
                    <Snowflake
                      className={`h-3.5 w-3.5 ${
                        acc.isFrozen ? 'text-sky-500' : 'text-muted-foreground'
                      }`}
                    />
                    <span>
                      {acc.isFrozen ? 'Unfreeze Account' : 'Freeze Account'}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleToggleActive(acc)}
                    disabled={isSubmitting}
                    className={`gap-2 cursor-pointer ${
                      acc.isActive
                        ? 'text-rose-600 focus:text-rose-600'
                        : 'text-emerald-600 focus:text-emerald-600'
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                    <span>
                      {acc.isActive ? 'Deactivate Account' : 'Activate Account'}
                    </span>
                  </DropdownMenuItem>
                  {!acc.isGroup && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => openLedger(acc.id)}
                        className="gap-2 cursor-pointer"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>View General Ledger</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [openLedger, toggleExpand, isSubmitting],
  )

  const handleExport = () => {
    exportCsv(
      `chart-of-accounts-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Code', value: (account) => account.code },
        { header: 'Name', value: (account) => account.name },
        { header: 'Root Type', value: (account) => account.rootType },
        { header: 'Sub-type', value: (account) => account.accountType ?? '' },
        {
          header: 'Balance Must Be',
          value: (account) => account.balanceMustBe ?? '',
        },
        {
          header: 'Group',
          value: (account) => (account.isGroup ? 'yes' : 'no'),
        },
        {
          header: 'Frozen',
          value: (account) => (account.isFrozen ? 'yes' : 'no'),
        },
        {
          header: 'Active',
          value: (account) => (account.isActive ? 'yes' : 'no'),
        },
        {
          header: 'Total Debit (NPR)',
          value: (account) => (account.totalDebit / 100).toFixed(2),
        },
        {
          header: 'Total Credit (NPR)',
          value: (account) => (account.totalCredit / 100).toFixed(2),
        },
        {
          header: 'Net Balance (NPR)',
          value: (account) => (account.netBalance / 100).toFixed(2),
        },
      ],
      rows,
    )
  }

  const { totalDebit, totalCredit } = useMemo(() => {
    const leaf = chartOfAccounts.filter((a) => !a.isGroup)
    return {
      totalDebit: leaf.reduce((s, a) => s + a.totalDebit, 0),
      totalCredit: leaf.reduce((s, a) => s + a.totalCredit, 0),
    }
  }, [chartOfAccounts])
  const variance = totalDebit - totalCredit

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <DataTable
        columns={columns}
        data={rows}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search account code, name, sub-type or description…"
        filterSlot={
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              size="sm"
              value={rootFilter}
              onChange={(event) => setRootFilter(event.target.value)}
              className="h-8 text-xs"
            >
              {ROOT_TYPE_OPTIONS.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <span className="text-[10px] text-muted-foreground">
              {rows.length} visible of {chartOfAccounts.length}
            </span>
          </div>
        }
        actionSlot={
          <>
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="h-8 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New Account
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCollapsed(allCollapsed ? new Set() : new Set(groupIds))
              }}
              className="h-8 gap-1.5 text-xs"
            >
              {allCollapsed ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={rows.length === 0}
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          </>
        }
        emptyMessage="No accounts match the selected search or account type."
        dense
        stickyHeader
        onRowClick={(account) => {
          if (account.children.length > 0) toggleExpand(account.id)
          else openLedger(account.id)
        }}
        rowClassName={(account) =>
          account.isGroup ? 'bg-muted/20' : undefined
        }
        footerSlot={
          rows.length > 0 ? (
            <TableRow className="border-border hover:bg-transparent">
              <TableCell colSpan={6} className="px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  {rows.length} row{rows.length === 1 ? '' : 's'} · group rows
                  include child roll-ups
                </span>
              </TableCell>
              <TableCell className="px-3 py-2 text-right">
                <MoneyText
                  paisa={variance}
                  className={`text-xs font-bold ${
                    variance === 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                />
              </TableCell>
              <TableCell />
            </TableRow>
          ) : null
        }
      />

      {/* Create Account Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="h-4 w-4 text-primary" />
              Create Chart of Accounts Entry
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add a new root group or postable leaf account.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCreate} className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Root Type</Label>
                <NativeSelect
                  value={createRootType}
                  onChange={(e) =>
                    setCreateRootType(e.target.value as any)
                  }
                  className="h-8 text-xs"
                >
                  <NativeSelectOption value="asset">Asset</NativeSelectOption>
                  <NativeSelectOption value="liability">Liability</NativeSelectOption>
                  <NativeSelectOption value="equity">Equity</NativeSelectOption>
                  <NativeSelectOption value="income">Income</NativeSelectOption>
                  <NativeSelectOption value="expense">Expense</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Parent Group</Label>
                <NativeSelect
                  value={createParentId}
                  onChange={(e) => setCreateParentId(e.target.value)}
                  className="h-8 text-xs"
                >
                  <NativeSelectOption value="">None (Top-Level)</NativeSelectOption>
                  {groupAccounts
                    .filter((g) => g.rootType === createRootType)
                    .map((g) => (
                      <NativeSelectOption key={g.id} value={g.id}>
                        {g.code} - {g.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Account Code (Optional)</Label>
                <Input
                  value={createCode}
                  onChange={(e) => setCreateCode(e.target.value)}
                  placeholder="Auto-generated if empty"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Sub-Type</Label>
                <NativeSelect
                  value={createAccountType}
                  onChange={(e) => setCreateAccountType(e.target.value)}
                  className="h-8 text-xs"
                >
                  <NativeSelectOption value="cash">Cash</NativeSelectOption>
                  <NativeSelectOption value="bank">Bank</NativeSelectOption>
                  <NativeSelectOption value="receivable">Receivable</NativeSelectOption>
                  <NativeSelectOption value="payable">Payable</NativeSelectOption>
                  <NativeSelectOption value="tax">Tax / VAT / TDS</NativeSelectOption>
                  <NativeSelectOption value="income">Income</NativeSelectOption>
                  <NativeSelectOption value="expense">Expense</NativeSelectOption>
                  <NativeSelectOption value="cogs">COGS</NativeSelectOption>
                  <NativeSelectOption value="equity">Equity</NativeSelectOption>
                  <NativeSelectOption value="fixed_asset">Fixed Asset</NativeSelectOption>
                  <NativeSelectOption value="other">Other</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Account Name</Label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Office Stationery, Delivery Fuel"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Normal Balance Side</Label>
                <NativeSelect
                  value={createBalanceSide}
                  onChange={(e) => setCreateBalanceSide(e.target.value as any)}
                  className="h-8 text-xs"
                >
                  <NativeSelectOption value="debit">Debit (Dr)</NativeSelectOption>
                  <NativeSelectOption value="credit">Credit (Cr)</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="isGroupAccount"
                  checked={createIsGroup}
                  onChange={(e) => setCreateIsGroup(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                <label htmlFor="isGroupAccount" className="text-xs cursor-pointer">
                  Is Group Folder
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description / Notes</Label>
              <Input
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Optional description"
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Creating…' : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Edit2 className="h-4 w-4 text-primary" />
              Edit Account ({selectedAccount?.code})
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update description, sub-type, or title.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Account Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Sub-Type</Label>
              <NativeSelect
                value={editAccountType}
                onChange={(e) => setEditAccountType(e.target.value)}
                className="h-8 text-xs"
              >
                <NativeSelectOption value="cash">Cash</NativeSelectOption>
                <NativeSelectOption value="bank">Bank</NativeSelectOption>
                <NativeSelectOption value="receivable">Receivable</NativeSelectOption>
                <NativeSelectOption value="payable">Payable</NativeSelectOption>
                <NativeSelectOption value="tax">Tax / VAT / TDS</NativeSelectOption>
                <NativeSelectOption value="income">Income</NativeSelectOption>
                <NativeSelectOption value="expense">Expense</NativeSelectOption>
                <NativeSelectOption value="cogs">COGS</NativeSelectOption>
                <NativeSelectOption value="equity">Equity</NativeSelectOption>
                <NativeSelectOption value="fixed_asset">Fixed Asset</NativeSelectOption>
                <NativeSelectOption value="other">Other</NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
