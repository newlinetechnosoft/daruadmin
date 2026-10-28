import { useState, useMemo } from 'react'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import {
  savePermissionsFn,
  resetPermissionsFn,
} from '#/server/operations/operations.functions'
import type { getStaffOpsFn } from '#/server/operations/operations.functions'
import { updateUserRoleFn } from '#/server/catalog/catalog.functions'
import {
  MODULES,
  ACTIONS,
  PERMISSION_SECTIONS,
} from '#/server/operations/types'
import type { ModuleKey, ActionKey } from '#/server/operations/types'
import { DEFAULT_GRANTS_BY_ROLE } from '#/server/auth/permissions-shared'
import type { UserGrants } from '#/server/auth/permissions-shared'
import { PageHeader } from '#/components/shared/page-header'
import { KpiCard } from '#/components/shared/kpi-card'
import {
  KeyRound,
  History,
  Search,
  Download,
  Users,
  ShieldCheck,
  Save,
  UserPlus,
  RotateCcw,
  Loader2,
  Undo2,
  LayoutDashboard,
  Wine,
  ShoppingBag,
  Tags,
  ClipboardList,
  Package,
  Bike,
  Shield,
  Truck,
  Wallet,
  CreditCard,
  Megaphone,
  BarChart3,
  Settings,
  CheckCheck,
  XCircle,
  Eye,
  Award,
  Store,
} from 'lucide-react'
import { CreateStaffDialog } from './create-staff-dialog'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import { Checkbox } from '#/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Card } from '#/components/ui/card'
import { EmptyState } from '#/components/shared/empty-state'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'

function getErrorMessage(
  err: unknown,
  fallback = 'An unexpected error occurred',
): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return fallback
}

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""'
  let str = String(val)
  // Neutralize formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  return `"${str.replace(/"/g, '""')}"`
}

function areGrantsEqual(a: UserGrants, b: UserGrants): boolean {
  for (const mod of MODULES) {
    const aActs = [...(a[mod] ?? [])].sort()
    const bActs = [...(b[mod] ?? [])].sort()
    if (aActs.length !== bActs.length) return false
    for (let i = 0; i < aActs.length; i++) {
      if (aActs[i] !== bActs[i]) return false
    }
  }
  return true
}

const MODULE_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  dashboard: LayoutDashboard,
  liquor: Wine,
  grocery: ShoppingBag,
  categories: Tags,
  brands: Award,
  orders: ClipboardList,
  customers: Users,
  inventory: Package,
  dealers: Store,
  riders: Bike,
  staff: Shield,
  users: Users,
  shipping: Truck,
  accounts: Wallet,
  payments: CreditCard,
  marketing: Megaphone,
  reports: BarChart3,
  settings: Settings,
}

const SECTION_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  Overview: LayoutDashboard,
  Catalog: Wine,
  Commerce: ShoppingBag,
  Operations: Shield,
  Finance: Wallet,
  Growth: Megaphone,
  System: Settings,
}

const ACTION_DESCRIPTIONS: Record<ActionKey, string> = {
  view: 'Browse & read records',
  create: 'Add new entries',
  edit: 'Update existing records',
  delete: 'Delete & purge records',
  export: 'Download CSV & reports',
  approve: 'Authorize payments & overrides',
}

type StaffUser = Awaited<ReturnType<typeof getStaffOpsFn>>['users'][number]

export function StaffPanel() {
  const queryClient = useQueryClient()
  const { data } = useSuspenseQuery(adminQueries.staff())
  const { ops, users, currentUserId } = data

  const [activeTab, setActiveTab] = useState<'users' | 'matrix' | 'audit'>(
    'users',
  )
  const [searchQuery, setSearchQuery] = useState('')

  // Filter staff users (admin, manager, or rider) - excluding pure customers
  const staffUsers = useMemo(() => {
    return users.filter(
      (u) => u.role === 'admin' || u.role === 'manager' || u.role === 'rider',
    )
  }, [users])

  // Track selected staff id initialized from staffUsers
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    staffUsers[0]?.id || '',
  )

  // Derived selected staff, falling back to first staff user if current is demoted/removed
  const selectedStaff: StaffUser | null = useMemo(() => {
    if (staffUsers.length === 0) return null
    const found = staffUsers.find((u) => u.id === selectedStaffId)
    return found ?? (staffUsers.length > 0 ? staffUsers[0] : null)
  }, [staffUsers, selectedStaffId])

  // Per-user drafts for the permission matrix to allow non-destructive user switching
  const [drafts, setDrafts] = useState<Record<string, UserGrants | undefined>>(
    {},
  )

  // Per-action loading states
  const [isSavingMatrix, setIsSavingMatrix] = useState(false)
  const [isResettingDefaults, setIsResettingDefaults] = useState(false)
  const [updatingRoleUserIds, setUpdatingRoleUserIds] = useState<Set<string>>(
    new Set(),
  )
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  // Role change confirmation state
  const [roleChangeConfirm, setRoleChangeConfirm] = useState<{
    userId: string
    userName: string
    currentRole: string
    newRole: string
  } | null>(null)

  const filteredStaff = useMemo(() => {
    return staffUsers.filter((u) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.role || '').includes(q)
      )
    })
  }, [staffUsers, searchQuery])

  const filteredAudit = useMemo(() => {
    return ops.audit.filter((a) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        a.actor.toLowerCase().includes(q) ||
        a.module.toLowerCase().includes(q) ||
        a.action.toLowerCase().includes(q) ||
        a.detail.toLowerCase().includes(q)
      )
    })
  }, [ops.audit, searchQuery])

  // Effective baseline grants from server data
  const baselineGrants = useMemo((): UserGrants => {
    if (!selectedStaff) return {}
    if (selectedStaff.role === 'admin') {
      return Object.fromEntries(MODULES.map((m) => [m, [...ACTIONS]]))
    }
    if (selectedStaff.id in ops.permissions) {
      return ops.permissions[selectedStaff.id]
    }
    const role = selectedStaff.role || 'manager'
    const roleKey = role in DEFAULT_GRANTS_BY_ROLE ? role : 'manager'
    return DEFAULT_GRANTS_BY_ROLE[roleKey]
  }, [selectedStaff, ops.permissions])

  // Check if current user has custom permissions saved in DB
  const hasCustomPermissions = useMemo(() => {
    if (!selectedStaff || selectedStaff.role === 'admin') return false
    return selectedStaff.id in ops.permissions
  }, [selectedStaff, ops.permissions])

  // Current effective grants for editing
  const currentGrants = useMemo((): UserGrants => {
    if (!selectedStaff) return {}
    if (selectedStaff.role === 'admin') {
      return Object.fromEntries(MODULES.map((m) => [m, [...ACTIONS]]))
    }
    return drafts[selectedStaff.id] ?? baselineGrants
  }, [selectedStaff, drafts, baselineGrants])

  // Check if draft has unsaved changes compared to server baseline
  const isDirty = useMemo(() => {
    if (!selectedStaff || selectedStaff.role === 'admin') return false
    const draft = drafts[selectedStaff.id]
    if (!draft) return false
    return !areGrantsEqual(draft, baselineGrants)
  }, [selectedStaff, drafts, baselineGrants])

  const handleSelectStaffForMatrix = (userId: string) => {
    setSelectedStaffId(userId)
  }

  const handleTogglePermission = (mod: ModuleKey, action: ActionKey) => {
    if (!selectedStaff || selectedStaff.role === 'admin') return

    setDrafts((prev) => {
      const userDraft = prev[selectedStaff.id] ?? baselineGrants
      const existing = userDraft[mod] || []
      const has = existing.includes(action)
      const nextActions = has
        ? existing.filter((a) => a !== action)
        : [...existing, action]

      return {
        ...prev,
        [selectedStaff.id]: {
          ...userDraft,
          [mod]: nextActions,
        },
      }
    })
  }

  const [matrixSearchQuery, setMatrixSearchQuery] = useState('')

  // Batch action: toggle all actions for a specific module
  const handleToggleModuleAll = (mod: ModuleKey) => {
    if (!selectedStaff || selectedStaff.role === 'admin') return

    setDrafts((prev) => {
      const userDraft = prev[selectedStaff.id] ?? baselineGrants
      const currentActs = userDraft[mod] || []
      const isAllSelected = ACTIONS.every((act) => currentActs.includes(act))
      const nextActs = isAllSelected ? [] : [...ACTIONS]

      return {
        ...prev,
        [selectedStaff.id]: {
          ...userDraft,
          [mod]: nextActs,
        },
      }
    })
  }

  // Batch action: grant all actions for an entire section
  const handleSectionGrantAll = (modules: ModuleKey[]) => {
    if (!selectedStaff || selectedStaff.role === 'admin') return

    setDrafts((prev) => {
      const userDraft = { ...(prev[selectedStaff.id] ?? baselineGrants) }
      for (const mod of modules) {
        userDraft[mod] = [...ACTIONS]
      }
      return {
        ...prev,
        [selectedStaff.id]: userDraft,
      }
    })
    toast.success('Granted all permissions in section')
  }

  // Batch action: view only for an entire section
  const handleSectionViewOnly = (modules: ModuleKey[]) => {
    if (!selectedStaff || selectedStaff.role === 'admin') return

    setDrafts((prev) => {
      const userDraft = { ...(prev[selectedStaff.id] ?? baselineGrants) }
      for (const mod of modules) {
        userDraft[mod] = ['view']
      }
      return {
        ...prev,
        [selectedStaff.id]: userDraft,
      }
    })
    toast.info('Set section to View-only')
  }

  // Batch action: clear an entire section
  const handleSectionClearAll = (modules: ModuleKey[]) => {
    if (!selectedStaff || selectedStaff.role === 'admin') return

    setDrafts((prev) => {
      const userDraft = { ...(prev[selectedStaff.id] ?? baselineGrants) }
      for (const mod of modules) {
        userDraft[mod] = []
      }
      return {
        ...prev,
        [selectedStaff.id]: userDraft,
      }
    })
    toast.info('Cleared permissions in section')
  }

  // Preset: Read-Only across all modules
  const handlePresetReadOnly = () => {
    if (!selectedStaff || selectedStaff.role === 'admin') return
    const allKeys = PERMISSION_SECTIONS.flatMap((s) =>
      s.modules.map((m) => m.key),
    )
    setDrafts((prev) => {
      const nextDraft: UserGrants = {}
      for (const key of allKeys) {
        nextDraft[key] = ['view']
      }
      return {
        ...prev,
        [selectedStaff.id]: nextDraft,
      }
    })
    toast.info('Applied Read-Only preset across all sections')
  }

  // Preset: Full Access across all modules
  const handlePresetFullAccess = () => {
    if (!selectedStaff || selectedStaff.role === 'admin') return
    const allKeys = PERMISSION_SECTIONS.flatMap((s) =>
      s.modules.map((m) => m.key),
    )
    setDrafts((prev) => {
      const nextDraft: UserGrants = {}
      for (const key of allKeys) {
        nextDraft[key] = [...ACTIONS]
      }
      return {
        ...prev,
        [selectedStaff.id]: nextDraft,
      }
    })
    toast.success('Applied Full Access preset across all sections')
  }

  // Preset: Clear All
  const handlePresetClearAll = () => {
    if (!selectedStaff || selectedStaff.role === 'admin') return
    const allKeys = PERMISSION_SECTIONS.flatMap((s) =>
      s.modules.map((m) => m.key),
    )
    setDrafts((prev) => {
      const nextDraft: UserGrants = {}
      for (const key of allKeys) {
        nextDraft[key] = []
      }
      return {
        ...prev,
        [selectedStaff.id]: nextDraft,
      }
    })
    toast.info('Cleared all permissions')
  }

  // Filter sections by matrixSearchQuery
  const filteredSections = useMemo(() => {
    if (!matrixSearchQuery.trim()) return PERMISSION_SECTIONS
    const q = matrixSearchQuery.toLowerCase()
    return PERMISSION_SECTIONS.map((section) => {
      const matchesSection = section.name.toLowerCase().includes(q)
      const matchingModules = section.modules.filter(
        (m) =>
          matchesSection ||
          m.label.toLowerCase().includes(q) ||
          m.key.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q),
      )
      return {
        ...section,
        modules: matchingModules,
      }
    }).filter((section) => section.modules.length > 0)
  }, [matrixSearchQuery])

  // Total grants stats
  const matrixStats = useMemo(() => {
    let totalEnabled = 0
    let totalPossible = 0
    for (const section of PERMISSION_SECTIONS) {
      for (const m of section.modules) {
        totalPossible += ACTIONS.length
        const acts = currentGrants[m.key] || []
        totalEnabled += acts.length
      }
    }
    return {
      totalEnabled,
      totalPossible,
      percent:
        totalPossible > 0
          ? Math.round((totalEnabled / totalPossible) * 100)
          : 0,
    }
  }, [currentGrants])

  // Unsaved changes diff count
  const grantDiffStats = useMemo(() => {
    if (!selectedStaff || selectedStaff.role === 'admin') {
      return { added: 0, removed: 0 }
    }
    const draft = drafts[selectedStaff.id]
    if (!draft) return { added: 0, removed: 0 }

    let added = 0
    let removed = 0
    for (const mod of MODULES) {
      const baseActs = new Set(baselineGrants[mod] || [])
      const draftActs = new Set(draft[mod] || [])

      for (const act of draftActs) {
        if (!baseActs.has(act)) added++
      }
      for (const act of baseActs) {
        if (!draftActs.has(act)) removed++
      }
    }
    return { added, removed }
  }, [selectedStaff, drafts, baselineGrants])

  const handleResetDraft = () => {
    if (!selectedStaff) return
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[selectedStaff.id]
      return next
    })
    toast.info('Draft changes reset to saved baseline.')
  }

  const handleResetToRoleDefaults = async () => {
    if (!selectedStaff || selectedStaff.role === 'admin') return

    try {
      setIsResettingDefaults(true)
      await resetPermissionsFn({ data: { userId: selectedStaff.id } })
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[selectedStaff.id]
        return next
      })
      toast.success(
        `Reset permissions to ${selectedStaff.role} defaults for ${selectedStaff.name}!`,
      )
      await queryClient.invalidateQueries({
        queryKey: adminQueries.staff().queryKey,
      })
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(err, 'Failed to reset permissions to defaults'),
      )
    } finally {
      setIsResettingDefaults(false)
    }
  }

  const handleSaveMatrix = async () => {
    if (!selectedStaff || selectedStaff.role === 'admin') return

    try {
      setIsSavingMatrix(true)
      await savePermissionsFn({
        data: {
          userId: selectedStaff.id,
          permissions: currentGrants, // Fixed payload mismatch: sent as 'permissions'
        },
      })
      // Clear draft on successful save
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[selectedStaff.id]
        return next
      })
      toast.success(`RBAC permissions saved for ${selectedStaff.name}!`)
      await queryClient.invalidateQueries({
        queryKey: adminQueries.staff().queryKey,
      })
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to save permissions'))
    } finally {
      setIsSavingMatrix(false)
    }
  }

  const handleRoleSelectChange = (userId: string, newRole: string) => {
    const staff = staffUsers.find((u) => u.id === userId)
    if (!staff) return
    if (staff.role === newRole) return

    // Confirm before promoting to admin or demoting to customer
    if (newRole === 'admin' || newRole === 'customer') {
      setRoleChangeConfirm({
        userId,
        userName: staff.name,
        currentRole: staff.role || 'customer',
        newRole,
      })
    } else {
      void executeRoleChange(userId, newRole)
    }
  }

  const executeRoleChange = async (userId: string, newRole: string) => {
    try {
      setUpdatingRoleUserIds((prev) => new Set(prev).add(userId))
      await updateUserRoleFn({ data: { userId, role: newRole } })
      toast.success(`User role updated to ${newRole}`)

      // If the selected matrix user's role changed, reset their draft
      if (selectedStaffId === userId) {
        setDrafts((prev) => {
          const next = { ...prev }
          delete next[userId]
          return next
        })
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminQueries.staff().queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: adminQueries.users().queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: adminQueries.chrome().queryKey,
        }),
      ])
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to update role'))
    } finally {
      setUpdatingRoleUserIds((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
      setRoleChangeConfirm(null)
    }
  }

  const handleExportAuditCSV = () => {
    const headers =
      ['Timestamp', 'Operator', 'Module', 'Action', 'Audit summary']
        .map(escapeCsvCell)
        .join(',') + '\n'

    const rows = filteredAudit
      .map((a) =>
        [a.at, a.actor, a.module, a.action, a.detail]
          .map(escapeCsvCell)
          .join(','),
      )
      .join('\n')

    const BOM = '\uFEFF' // UTF-8 BOM for Excel
    const blob = new Blob([BOM + headers + rows], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Audit trail exported to CSV')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Operations"
        title="Staff and access control"
        description="Configure granular module action privileges across managers, couriers, and support staff."
        actions={
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5 h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Add Staff Account
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Staff and operators"
          value={staffUsers.length}
          note="Active administrative accounts"
          icon={ShieldCheck}
        />
        <KpiCard
          label="Protected modules"
          value={MODULES.length}
          note="Granular permission nodes"
          icon={KeyRound}
          tone="success"
        />
        <KpiCard
          label="Audit log entries"
          value={ops.audit.length}
          note="Recorded actions in Neon DB"
          icon={History}
        />
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) =>
          setActiveTab(val as 'users' | 'matrix' | 'audit')
        }
      >
        <TabsList className="h-9">
          <TabsTrigger value="users" className="gap-2 text-xs">
            <Users className="h-3.5 w-3.5" />
            <span>Staff accounts ({staffUsers.length})</span>
          </TabsTrigger>
          <TabsTrigger value="matrix" className="gap-2 text-xs">
            <KeyRound className="h-3.5 w-3.5" />
            <span>Permission matrix</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2 text-xs">
            <History className="h-3.5 w-3.5" />
            <span>Audit trail ({ops.audit.length})</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search Bar */}
      {activeTab !== 'matrix' && (
        <div className="flex rounded-lg border border-border bg-card p-3">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={
                activeTab === 'users'
                  ? 'Search staff by name, email, role...'
                  : 'Search audit trail by actor, module, action...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-9 text-xs"
            />
          </div>
        </div>
      )}

      {activeTab === 'users' ? (
        /* Staff Users Table */
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Staff name</TableHead>
                <TableHead className="text-xs">Email address</TableHead>
                <TableHead className="text-xs">Current role</TableHead>
                <TableHead className="text-xs">Access rights</TableHead>
                <TableHead className="text-right text-xs">
                  Change role
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      title="No staff members found"
                      description="Try adjusting your search terms or create a new staff account."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredStaff.map((staff) => {
                  const isSelf = staff.id === currentUserId
                  const isUpdatingThisRow = updatingRoleUserIds.has(staff.id)

                  return (
                    <TableRow key={staff.id}>
                      <TableCell>
                        <div className="font-medium text-xs text-foreground flex items-center gap-1.5">
                          <span>{staff.name}</span>
                          {isSelf && (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1 font-mono text-muted-foreground"
                            >
                              You
                            </Badge>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          ID: {staff.id.slice(0, 10)}...
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {staff.email}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            staff.role === 'admin' ? 'default' : 'secondary'
                          }
                          className="text-[11px] font-normal capitalize"
                        >
                          {staff.role}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => {
                            handleSelectStaffForMatrix(staff.id)
                            setActiveTab('matrix')
                          }}
                          className="h-auto p-0 text-xs text-primary"
                        >
                          Configure RBAC node →
                        </Button>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isUpdatingThisRow && (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          )}
                          <NativeSelect
                            value={staff.role || 'customer'}
                            onChange={(e) =>
                              handleRoleSelectChange(staff.id, e.target.value)
                            }
                            disabled={isUpdatingThisRow || isSelf}
                            title={
                              isSelf
                                ? 'You cannot change your own role'
                                : 'Change account role'
                            }
                            size="sm"
                            className={`h-7 text-xs ${
                              isSelf ? 'opacity-60 cursor-not-allowed' : ''
                            }`}
                          >
                            <NativeSelectOption value="admin">
                              Admin
                            </NativeSelectOption>
                            <NativeSelectOption value="manager">
                              Manager
                            </NativeSelectOption>
                            <NativeSelectOption value="rider">
                              Rider
                            </NativeSelectOption>
                            <NativeSelectOption value="customer">
                              Demote to customer
                            </NativeSelectOption>
                          </NativeSelect>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      ) : activeTab === 'matrix' ? (
        /* Granular RBAC Matrix */
        <div className="space-y-4">
          {!selectedStaff ? (
            <Card className="p-4">
              <EmptyState
                title="No staff members available"
                description="Add a staff account to configure module permissions."
              />
            </Card>
          ) : (
            <>
              {/* Staff Selector & Matrix Controls Header */}
              <Card className="p-4 space-y-4 border-border bg-card shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border">
                  {/* Staff Identity */}
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                        {selectedStaff.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">
                          {selectedStaff.name}
                        </h3>
                        <Badge
                          variant={
                            selectedStaff.role === 'admin'
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-[10px] py-0 px-1.5 capitalize font-normal"
                        >
                          {selectedStaff.role}
                        </Badge>

                        {selectedStaff.role === 'admin' ? (
                          <Badge
                            variant="default"
                            className="text-[10px] py-0 px-1.5"
                          >
                            Super Admin
                          </Badge>
                        ) : hasCustomPermissions ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
                          >
                            Custom overrides active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 text-muted-foreground border-border"
                          >
                            Role defaults active
                          </Badge>
                        )}

                        {isDirty && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 text-info border-info/40 bg-info/10 animate-pulse"
                          >
                            Unsaved changes (+{grantDiffStats.added} / -
                            {grantDiffStats.removed})
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedStaff.email} • ID:{' '}
                        <span className="font-mono text-[11px]">
                          {selectedStaff.id.slice(0, 12)}...
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Actions & Switcher */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        Staff:
                      </span>
                      <NativeSelect
                        value={selectedStaff.id}
                        onChange={(e) =>
                          handleSelectStaffForMatrix(e.target.value)
                        }
                        size="sm"
                        className="h-8 text-xs min-w-[170px]"
                      >
                        {staffUsers.map((u) => (
                          <NativeSelectOption key={u.id} value={u.id}>
                            {u.name} ({u.role})
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>

                    {/* Reset Draft Changes button */}
                    {isDirty && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetDraft}
                        className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        Reset edits
                      </Button>
                    )}

                    {/* Reset to Role Defaults button */}
                    {hasCustomPermissions && selectedStaff.role !== 'admin' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetToRoleDefaults}
                        disabled={isResettingDefaults || isSavingMatrix}
                        className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                        title={`Revert ${selectedStaff.name}'s privileges to standard ${selectedStaff.role} defaults`}
                      >
                        {isResettingDefaults ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        Reset to defaults
                      </Button>
                    )}

                    {/* Save Matrix Button */}
                    <Button
                      size="sm"
                      onClick={handleSaveMatrix}
                      disabled={
                        !isDirty ||
                        isSavingMatrix ||
                        selectedStaff.role === 'admin'
                      }
                      className="h-8 gap-1.5 text-xs shadow-xs"
                    >
                      {isSavingMatrix ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      {isSavingMatrix ? 'Saving...' : 'Save matrix'}
                    </Button>
                  </div>
                </div>

                {/* Sub-toolbar: Search & Batch Presets */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Filter matrix sections or modules..."
                      value={matrixSearchQuery}
                      onChange={(e) => setMatrixSearchQuery(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>

                  {/* Quick Presets & Stats */}
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedStaff.role !== 'admin' && (
                      <div className="flex items-center gap-1.5 border border-border/60 rounded-md p-0.5 bg-muted/20">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handlePresetReadOnly}
                          disabled={isSavingMatrix || isResettingDefaults}
                          className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                          title="Grant 'view' privilege across all system modules"
                        >
                          <Eye className="h-3 w-3" />
                          Read-only
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handlePresetFullAccess}
                          disabled={isSavingMatrix || isResettingDefaults}
                          className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                          title="Grant all 6 actions across all system modules"
                        >
                          <CheckCheck className="h-3 w-3" />
                          Full access
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handlePresetClearAll}
                          disabled={isSavingMatrix || isResettingDefaults}
                          className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-destructive"
                          title="Revoke all privileges across all system modules"
                        >
                          <XCircle className="h-3 w-3" />
                          Clear all
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/40 border border-border text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {matrixStats.totalEnabled}
                      </span>
                      <span>/ {matrixStats.totalPossible} granted</span>
                      <span className="text-muted-foreground/60">
                        ({matrixStats.percent}%)
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Super Admin Notice */}
              {selectedStaff.role === 'admin' && (
                <div className="p-3 bg-muted/40 rounded-lg border border-border text-xs flex items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">
                      Super admin unrestricted access:
                    </strong>{' '}
                    Administrator accounts inherently possess full bypass
                    permissions across all modules, categories, actions, and
                    data exports.
                  </span>
                </div>
              )}

              {/* Filtered Sections List */}
              {filteredSections.length === 0 ? (
                <Card className="p-8">
                  <EmptyState
                    title="No matching modules found"
                    description={`No system permissions match your search "${matrixSearchQuery}".`}
                  />
                </Card>
              ) : (
                filteredSections.map((section) => {
                  const SectionIcon =
                    SECTION_ICONS[section.name] || LayoutDashboard
                  const sectionModuleKeys = section.modules.map((m) => m.key)
                  const sectionTotal = sectionModuleKeys.length * ACTIONS.length
                  const sectionEnabled = sectionModuleKeys.reduce(
                    (sum, k) => sum + (currentGrants[k]?.length || 0),
                    0,
                  )

                  return (
                    <Card
                      key={section.name}
                      className="overflow-hidden border-border bg-card shadow-xs"
                    >
                      {/* Section Heading & Batch Controls */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 bg-muted/30 border-b border-border">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-background border border-border shadow-2xs text-foreground">
                            <SectionIcon className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-semibold text-foreground tracking-tight">
                                {section.name}
                              </h4>
                              <Badge
                                variant="outline"
                                className="text-[10px] py-0 px-1.5 h-4.5 font-normal border-border bg-background"
                              >
                                {sectionEnabled} / {sectionTotal} granted
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">
                              {section.description}
                            </p>
                          </div>
                        </div>

                        {/* Section Batch Buttons */}
                        {selectedStaff.role !== 'admin' && (
                          <div className="flex items-center gap-1 self-end sm:self-auto">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleSectionGrantAll(sectionModuleKeys)
                              }
                              disabled={isSavingMatrix || isResettingDefaults}
                              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                              title={`Grant all permissions in ${section.name}`}
                            >
                              Grant all
                            </Button>
                            <span className="text-muted-foreground/30">•</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleSectionViewOnly(sectionModuleKeys)
                              }
                              disabled={isSavingMatrix || isResettingDefaults}
                              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                              title={`Set ${section.name} modules to View only`}
                            >
                              View only
                            </Button>
                            <span className="text-muted-foreground/30">•</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleSectionClearAll(sectionModuleKeys)
                              }
                              disabled={isSavingMatrix || isResettingDefaults}
                              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                              title={`Clear all permissions in ${section.name}`}
                            >
                              Clear
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Section Modules Table */}
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/10 hover:bg-muted/10">
                              <TableHead className="text-xs w-[38%] min-w-[220px]">
                                Module & Capabilities
                              </TableHead>
                              {ACTIONS.map((act) => (
                                <TableHead
                                  key={act}
                                  className="text-center text-xs capitalize w-[10%] min-w-[70px]"
                                  title={`${act.toUpperCase()}: ${ACTION_DESCRIPTIONS[act]}`}
                                >
                                  <div>{act}</div>
                                  <div className="text-[9px] font-normal text-muted-foreground tracking-tight lowercase">
                                    {act === 'view'
                                      ? 'browse'
                                      : act === 'create'
                                        ? 'add'
                                        : act === 'edit'
                                          ? 'update'
                                          : act === 'delete'
                                            ? 'remove'
                                            : act === 'export'
                                              ? 'csv'
                                              : 'authorize'}
                                  </div>
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {section.modules.map((modDef) => {
                              const ModIcon =
                                MODULE_ICONS[modDef.key] || KeyRound
                              const currentModGrants =
                                currentGrants[modDef.key] || []
                              const isAllChecked = ACTIONS.every((act) =>
                                currentModGrants.includes(act),
                              )
                              const isViewOnly =
                                currentModGrants.length === 1 &&
                                currentModGrants[0] === 'view'

                              return (
                                <TableRow
                                  key={modDef.key}
                                  className="hover:bg-muted/20 transition-colors"
                                >
                                  {/* Module Info & Quick Row Toggle */}
                                  <TableCell className="py-2.5">
                                    <div className="flex items-start gap-2.5">
                                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/60 border border-border/50 text-foreground mt-0.5">
                                        <ModIcon className="h-3.5 w-3.5" />
                                      </div>

                                      <div className="min-w-0 flex-1 space-y-0.5">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="font-semibold text-xs text-foreground">
                                            {modDef.label}
                                          </span>
                                          <span className="font-mono text-[10px] text-muted-foreground/80">
                                            /{modDef.key}
                                          </span>

                                          {/* Status Badge */}
                                          {selectedStaff.role === 'admin' ||
                                          isAllChecked ? (
                                            <Badge
                                              variant="default"
                                              className="text-[9px] py-0 px-1 h-3.5 font-normal bg-emerald-600/90 hover:bg-emerald-600 text-white"
                                            >
                                              Full access
                                            </Badge>
                                          ) : isViewOnly ? (
                                            <Badge
                                              variant="secondary"
                                              className="text-[9px] py-0 px-1 h-3.5 font-normal"
                                            >
                                              Read only
                                            </Badge>
                                          ) : currentModGrants.length > 0 ? (
                                            <Badge
                                              variant="outline"
                                              className="text-[9px] py-0 px-1 h-3.5 font-normal text-amber-600 dark:text-amber-400 border-amber-500/30"
                                            >
                                              {currentModGrants.length} of 6
                                            </Badge>
                                          ) : (
                                            <Badge
                                              variant="outline"
                                              className="text-[9px] py-0 px-1 h-3.5 font-normal text-muted-foreground border-border"
                                            >
                                              No access
                                            </Badge>
                                          )}

                                          {/* Row Quick Toggle */}
                                          {selectedStaff.role !== 'admin' && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() =>
                                                handleToggleModuleAll(
                                                  modDef.key,
                                                )
                                              }
                                              disabled={
                                                isSavingMatrix ||
                                                isResettingDefaults
                                              }
                                              className="h-4.5 px-1 text-[10px] text-muted-foreground hover:text-foreground ml-auto"
                                            >
                                              {isAllChecked
                                                ? 'Deselect all'
                                                : 'Select all'}
                                            </Button>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground line-clamp-1 leading-normal">
                                          {modDef.description}
                                        </p>
                                      </div>
                                    </div>
                                  </TableCell>

                                  {/* Action Checkboxes */}
                                  {ACTIONS.map((act) => {
                                    const hasGrant =
                                      currentModGrants.includes(act)
                                    return (
                                      <TableCell
                                        key={act}
                                        className="text-center py-2.5"
                                      >
                                        <Checkbox
                                          checked={hasGrant}
                                          disabled={
                                            selectedStaff.role === 'admin' ||
                                            isSavingMatrix ||
                                            isResettingDefaults
                                          }
                                          onCheckedChange={() =>
                                            handleTogglePermission(
                                              modDef.key,
                                              act,
                                            )
                                          }
                                          aria-label={`${act} on ${modDef.label}`}
                                          title={`${act.toUpperCase()}: ${ACTION_DESCRIPTIONS[act]} for ${modDef.label}`}
                                        />
                                      </TableCell>
                                    )
                                  })}
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </Card>
                  )
                })
              )}
            </>
          )}
        </div>
      ) : (
        /* Audit Trail Table */
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAuditCSV}
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Export audit CSV
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Timestamp</TableHead>
                  <TableHead className="text-xs">Operator</TableHead>
                  <TableHead className="text-xs">Module</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                  <TableHead className="text-xs">Audit summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAudit.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <EmptyState
                        title="No audit entries found"
                        description="Try adjusting your search criteria."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAudit.map((log) => (
                    <TableRow key={log.id} className="text-xs">
                      <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                        {new Date(log.at).toLocaleString()}
                      </TableCell>

                      <TableCell className="font-medium text-foreground">
                        {log.actor}
                      </TableCell>

                      <TableCell className="capitalize text-foreground">
                        {log.module}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono uppercase"
                        >
                          {log.action}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {log.detail}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Role Change Confirmation Dialog */}
      <AlertDialog
        open={Boolean(roleChangeConfirm)}
        onOpenChange={(open) => {
          if (!open) setRoleChangeConfirm(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {roleChangeConfirm?.newRole === 'admin'
                ? 'Promote to Administrator?'
                : 'Demote to Customer?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {roleChangeConfirm?.newRole === 'admin'
                ? `Are you sure you want to promote ${roleChangeConfirm.userName} to Admin? Administrators have unrestricted super admin access across all modules and actions.`
                : `Are you sure you want to demote ${roleChangeConfirm?.userName} to Customer? They will immediately lose all staff panel access.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (roleChangeConfirm) {
                  void executeRoleChange(
                    roleChangeConfirm.userId,
                    roleChangeConfirm.newRole,
                  )
                }
              }}
              className={
                roleChangeConfirm?.newRole === 'customer'
                  ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                  : ''
              }
            >
              {roleChangeConfirm?.newRole === 'admin'
                ? 'Promote to Admin'
                : 'Demote to Customer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateStaffDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  )
}
