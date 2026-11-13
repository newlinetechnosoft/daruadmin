import { useCallback, useMemo, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { adminQueries } from '#/queries/admin'
import { DataTable } from '#/components/shared/data-table'
import { MoneyText } from '#/components/shared/money-text'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { TableCell, TableRow } from '#/components/ui/table'
import { ROOT_TYPE_OPTIONS } from '../accounts-route'
import { csvRupees, exportCsv } from '../export-csv'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Layers,
  Snowflake,
  Wallet,
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

function isDebitNormal(rootType: string) {
  return rootType === 'asset' || rootType === 'expense'
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
  const navigate = useNavigate()
  const { data: ledgerData } = useSuspenseQuery(adminQueries.ledger())
  const chartOfAccounts = ledgerData.ops.chartOfAccounts

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 200)
  const [rootFilter, setRootFilter] = useState<string>('all')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const { roots } = useMemo(() => buildTree(chartOfAccounts), [chartOfAccounts])

  const groupIds = useMemo(
    () =>
      chartOfAccounts
        .filter((account) => account.isGroup)
        .map((account) => account.id),
    [chartOfAccounts],
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

  const leafAccounts = useMemo(
    () => chartOfAccounts.filter((account) => !account.isGroup),
    [chartOfAccounts],
  )
  const totalDebit = leafAccounts.reduce(
    (sum, account) => sum + account.totalDebit,
    0,
  )
  const totalCredit = leafAccounts.reduce(
    (sum, account) => sum + account.totalCredit,
    0,
  )
  const variance = totalDebit - totalCredit
  const frozenCount = chartOfAccounts.filter(
    (account) => account.isFrozen,
  ).length

  const allCollapsed =
    groupIds.length > 0 && groupIds.every((id) => collapsed.has(id))

  const columns = useMemo<ColumnDef<CoaTreeRow>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'Account',
        enableSorting: false,
        cell: ({ row }) => {
          const account = row.original
          return (
            <div
              className="flex items-start gap-1"
              style={{ paddingLeft: account.depth * 16 }}
            >
              {account.children.length > 0 ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleExpand(account.id)
                  }}
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={account.isExpanded ? 'Collapse' : 'Expand'}
                >
                  {account.isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <span className="h-4 w-4 shrink-0" />
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
            <Badge variant="secondary" className="text-[10px] uppercase">
              {row.original.balanceMustBe}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'rollupDebit',
        header: 'Debit',
        cell: ({ row }) =>
          row.original.rollupDebit > 0 ? (
            <MoneyText
              paisa={row.original.rollupDebit}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'rollupCredit',
        header: 'Credit',
        cell: ({ row }) =>
          row.original.rollupCredit > 0 ? (
            <MoneyText
              paisa={row.original.rollupCredit}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400"
            />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'rollupBalance',
        header: 'Balance',
        cell: ({ row }) => (
          <MoneyText
            paisa={row.original.rollupBalance}
            className={`text-xs font-bold ${
              row.original.rollupBalance < 0
                ? 'text-rose-600 dark:text-rose-400'
                : isDebitNormal(row.original.rootType)
                  ? 'text-foreground'
                  : 'text-emerald-600 dark:text-emerald-400'
            }`}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div
            className="flex justify-end"
            onClick={(event) => event.stopPropagation()}
          >
            {!row.original.isGroup && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openLedger(row.original.id)}
                className="h-7 gap-1 px-2 text-xs"
              >
                <ExternalLink className="h-3 w-3" />
                Ledger
              </Button>
            )}
          </div>
        ),
      },
    ],
    [openLedger, toggleExpand],
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
          header: 'Debit (NPR)',
          value: (account) => csvRupees(account.rollupDebit),
        },
        {
          header: 'Credit (NPR)',
          value: (account) => csvRupees(account.rollupCredit),
        },
        {
          header: 'Balance (NPR)',
          value: (account) => csvRupees(account.rollupBalance),
        },
        {
          header: 'Ledger Lines',
          value: (account) => account.rollupLines,
        },
        {
          header: 'Description',
          value: (account) => account.description ?? '',
        },
      ],
      rows,
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Accounts</span>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="mt-1 block text-lg font-bold font-mono tabular-nums">
            {chartOfAccounts.length}
          </span>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Groups / Leaves
            </span>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="mt-1 block text-lg font-bold font-mono tabular-nums">
            {groupIds.length}
            <span className="text-xs font-normal text-muted-foreground">
              {' '}
              / {leafAccounts.length}
            </span>
          </span>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Frozen</span>
            <Snowflake className="h-4 w-4 text-sky-500" />
          </div>
          <span className="mt-1 block text-lg font-bold font-mono tabular-nums">
            {frozenCount}
          </span>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Debit / Credit Variance
            </span>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </div>
          <MoneyText
            paisa={variance}
            className={`mt-1 block text-lg font-bold ${
              variance === 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          />
        </div>
      </div>

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

      <p className="text-xs text-muted-foreground">
        Group accounts roll up every child posting. Select a leaf account to
        open its General Ledger, or use the Ledger button on any row.
      </p>
    </div>
  )
}
