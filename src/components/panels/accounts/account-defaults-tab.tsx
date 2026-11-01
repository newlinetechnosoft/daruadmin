import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { updateAccountDefaultsFn } from '#/server/finance/finance.functions'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { toast } from 'sonner'
import {
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import type { AccountKey, RootType } from '#/server/finance/account-keys'

const ROOT_TYPE_COLORS: Record<
  RootType,
  { badge: string; text: string; bg: string }
> = {
  asset: {
    badge: 'border-blue-500/20 bg-blue-500/10 text-blue-500',
    text: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
  },
  liability: {
    badge: 'border-rose-500/20 bg-rose-500/10 text-rose-500',
    text: 'text-rose-500',
    bg: 'bg-rose-50 dark:bg-rose-950/20',
  },
  equity: {
    badge: 'border-purple-500/20 bg-purple-500/10 text-purple-500',
    text: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-950/20',
  },
  income: {
    badge: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
    text: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
  },
  expense: {
    badge: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
    text: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
  },
}

interface LeafAccountOption {
  id: string
  code: string
  name: string
  rootType: string
}

export function AccountDefaultsTab() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery(adminQueries.accountDefaults())

  const [selectedAccounts, setSelectedAccounts] = React.useState<
    Record<string, string>
  >({})
  const [searchQuery, setSearchQuery] = React.useState('')
  const [rootFilter, setRootFilter] = React.useState<string>('all')

  // Initialize local selection state from server data
  React.useEffect(() => {
    if (data?.defaults) {
      const initial: Record<string, string> = {}
      for (const item of data.defaults) {
        initial[item.key] = item.accountId
      }
      setSelectedAccounts(initial)
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: async (updates: Array<{ key: string; accountId: string }>) => {
      return updateAccountDefaultsFn({ data: { updates } })
    },
    onSuccess: (res) => {
      toast.success(
        `Successfully saved ${res.count} account default mapping(s)!`,
      )
      queryClient.invalidateQueries({ queryKey: ['admin', 'account-defaults'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] })
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update account defaults')
    },
  })

  // Detect dirty (unsaved) changes
  const dirtyChanges = React.useMemo(() => {
    if (!data?.defaults) return []
    const changes: Array<{
      key: AccountKey
      accountId: string
      oldAccountId: string
      label: string
    }> = []

    for (const item of data.defaults) {
      const current = selectedAccounts[item.key]
      if (current && current !== item.accountId) {
        changes.push({
          key: item.key,
          accountId: current,
          oldAccountId: item.accountId,
          label: item.metadata.label,
        })
      }
    }
    return changes
  }, [data, selectedAccounts])

  const handleSelectChange = (key: string, accountId: string) => {
    setSelectedAccounts((prev) => ({
      ...prev,
      [key]: accountId,
    }))
  }

  const handleReset = () => {
    if (!data?.defaults) return
    const resetState: Record<string, string> = {}
    for (const item of data.defaults) {
      resetState[item.key] = item.accountId
    }
    setSelectedAccounts(resetState)
    toast.info('Discarded unsaved changes')
  }

  const handleSave = () => {
    if (dirtyChanges.length === 0) return
    mutation.mutate(
      dirtyChanges.map((c) => ({ key: c.key, accountId: c.accountId })),
    )
  }

  // Filter defaults by search and root type
  const filteredDefaults = React.useMemo(() => {
    if (!data?.defaults) return []
    const q = searchQuery.toLowerCase().trim()

    return data.defaults.filter((item) => {
      if (rootFilter !== 'all' && item.metadata.rootType !== rootFilter) {
        return false
      }
      if (!q) return true

      return (
        item.key.toLowerCase().includes(q) ||
        item.metadata.label.toLowerCase().includes(q) ||
        item.metadata.description.toLowerCase().includes(q) ||
        item.accountCode.toLowerCase().includes(q) ||
        item.accountName.toLowerCase().includes(q)
      )
    })
  }, [data, searchQuery, rootFilter])

  // Map of available leaf accounts by rootType
  const accountsByRoot = React.useMemo(() => {
    const grouped: Record<string, LeafAccountOption[]> = {}
    if (!data?.accounts) return grouped
    for (const acc of data.accounts) {
      if (!grouped[acc.rootType]) {
        grouped[acc.rootType] = []
      }
      grouped[acc.rootType].push(acc)
    }
    return grouped
  }, [data])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs text-muted-foreground">
            Loading accounting defaults...
          </p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6 text-center text-sm text-destructive">
        Failed to load accounting settings. Please check your permissions or try
        again.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                Account Defaults & Posting Rules (ACC-1.1)
              </h2>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground leading-relaxed">
              System events (order delivery, rider COD handovers, dealer
              settlements, payroll) resolve their ledger lines dynamically from
              these defaults. Remapping any key immediately routes future
              postings without altering historical vouchers.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {dirtyChanges.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={mutation.isPending}
                className="h-8 gap-1.5 text-xs cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Discard ({dirtyChanges.length})
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={dirtyChanges.length === 0 || mutation.isPending}
              className="h-8 gap-1.5 text-xs cursor-pointer bg-primary font-medium"
            >
              {mutation.isPending ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {dirtyChanges.length > 0
                ? `Save Changes (${dirtyChanges.length})`
                : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Configured</p>
              <p className="text-xs font-semibold text-foreground">
                {data.defaults.length} Semantic Keys
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Resolved</p>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                100% Active Leaf
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/10 text-blue-500">
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Unsaved</p>
              <p className="text-xs font-semibold text-foreground">
                {dirtyChanges.length} modified
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-500">
              <HelpCircle className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Policy</p>
              <p className="text-xs font-semibold text-foreground">
                ERPNext Append-Only
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search defaults by key, name, or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Types' },
            { id: 'income', label: 'Income' },
            { id: 'expense', label: 'Expense / COGS' },
            { id: 'asset', label: 'Asset' },
            { id: 'liability', label: 'Liability' },
            { id: 'equity', label: 'Equity' },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={rootFilter === tab.id ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setRootFilter(tab.id)}
              className="h-7 px-2.5 text-[11px] font-medium cursor-pointer"
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid of Default Mappings */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredDefaults.map((item) => {
          const isDirty =
            selectedAccounts[item.key] &&
            selectedAccounts[item.key] !== item.accountId
          const color =
            ROOT_TYPE_COLORS[item.metadata.rootType] || ROOT_TYPE_COLORS.asset

          // Get candidate accounts for dropdown (prioritize matching rootType, but allow cross-type if applicable)
          const primaryOptions =
            accountsByRoot[item.metadata.rootType] || data.accounts

          return (
            <Card
              key={item.key}
              className={`transition-all duration-150 ${
                isDirty
                  ? 'border-primary ring-1 ring-primary/30 bg-primary/[0.02]'
                  : 'hover:border-foreground/20'
              }`}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {item.key}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase tracking-wider py-0 px-1.5 font-medium ${color.badge}`}
                      >
                        {item.metadata.rootType}
                      </Badge>
                      {isDirty && (
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary text-[10px] font-medium"
                        >
                          Modified
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xs font-medium text-foreground">
                      {item.metadata.label}
                    </CardTitle>
                  </div>
                </div>
                <CardDescription className="text-[11px] text-muted-foreground leading-snug pt-1">
                  {item.metadata.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 pt-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      Assigned Account:
                    </span>
                    {isDirty && (
                      <span className="text-[10px] text-muted-foreground">
                        Saved: {item.accountCode} - {item.accountName}
                      </span>
                    )}
                  </div>

                  <Select
                    value={selectedAccounts[item.key] || item.accountId}
                    onValueChange={(val) => handleSelectChange(item.key, val)}
                  >
                    <SelectTrigger className="h-9 text-xs w-full bg-background cursor-pointer">
                      <SelectValue placeholder="Select target ledger account" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 text-xs">
                      {primaryOptions.map((acc) => (
                        <SelectItem
                          key={acc.id}
                          value={acc.id}
                          className="text-xs cursor-pointer"
                        >
                          <span className="font-mono font-medium text-muted-foreground mr-1.5">
                            {acc.code}
                          </span>
                          <span>{acc.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase ml-2">
                            ({acc.rootType})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredDefaults.length === 0 && (
        <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
          <SlidersHorizontal className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-xs font-medium text-foreground">
            No accounting defaults matched your search.
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Try adjusting your search query or root type filter.
          </p>
        </div>
      )}
    </div>
  )
}
