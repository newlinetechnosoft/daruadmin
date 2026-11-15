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
import { DEFAULT_GRANTS_BY_ROLE, isSuperAdmin } from '#/server/auth/permissions-shared'
import type { UserGrants } from '#/server/auth/permissions-shared'
import { PageHeader } from '#/components/shared/page-header'
import { DataRefreshButton } from '#/components/shared/data-refresh-button'
import { DataSection } from '#/components/shared/data-section'
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
  Terminal,
  CheckCircle2,
  Info,
  Copy,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
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
  const allModules = PERMISSION_SECTIONS.flatMap((s) =>
    s.modules.map((m) => m.key),
  )
  for (const mod of allModules) {
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
  food: ShoppingBag,
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
  const { data, isFetching, refetch } = useSuspenseQuery(adminQueries.staff())
  const { ops, users, currentUserId } = data

  const [activeTab, setActiveTab] = useState<'users' | 'matrix' | 'audit'>(
    'users',
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [userScopeFilter, setUserScopeFilter] = useState<
    'all' | 'staff' | 'superadmin' | 'admin' | 'manager' | 'rider' | 'customer'
  >('all')
  const [inspectingUser, setInspectingUser] = useState<StaffUser | null>(null)

  const currentUser = useMemo(
    () => users.find((u) => u.id === currentUserId),
    [users, currentUserId],
  )
  const isSuperAdminUser = isSuperAdmin(currentUser)

  // Filter staff users (admin, manager, rider, or superadmin)
  const staffUsers = useMemo(() => {
    return users.filter(
      (u) => u.role === 'admin' || u.role === 'manager' || u.role === 'rider' || isSuperAdmin(u),
    )
  }, [users])

  // Matrix-eligible users: HIDE super admin completely from permission matrix
  const matrixEligibleUsers = useMemo(() => {
    return users.filter(
      (u) => !isSuperAdmin(u) && (u.role === 'admin' || u.role === 'manager' || u.role === 'rider'),
    )
  }, [users])

  // Track selected staff id initialized from matrixEligibleUsers
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    matrixEligibleUsers[0]?.id || '',
  )

  // Derived selected staff, falling back to first matrix-eligible user
  const selectedStaff: StaffUser | null = useMemo(() => {
    if (matrixEligibleUsers.length === 0) return null
    const found = matrixEligibleUsers.find((u) => u.id === selectedStaffId)
    return found ?? (matrixEligibleUsers.length > 0 ? matrixEligibleUsers[0] : null)
  }, [matrixEligibleUsers, selectedStaffId])

  // Whether current viewer can customize permissions for selected staff:
  // Super Admin can customize Admin, Manager, and Rider. Regular Admin can customize Manager and Rider.
  const isTargetAdmin = selectedStaff?.role === 'admin'
  const canEditSelected = Boolean(
    selectedStaff &&
      !isSuperAdmin(selectedStaff) &&
      (!isTargetAdmin || isSuperAdminUser),
  )

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

  // All Users / Directory filter
  const displayedUsers = useMemo(() => {
    let list = users
    if (userScopeFilter === 'staff') {
      list = users.filter(
        (u) => u.role === 'admin' || u.role === 'manager' || u.role === 'rider' || isSuperAdmin(u),
      )
    } else if (userScopeFilter === 'superadmin') {
      list = users.filter((u) => isSuperAdmin(u))
    } else if (userScopeFilter !== 'all') {
      list = users.filter((u) => !isSuperAdmin(u) && u.role === userScopeFilter)
    }

    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase()
    return list.filter((u) => {
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      )
    })
  }, [users, userScopeFilter, searchQuery])

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
    if (selectedStaff.id in ops.permissions) {
      return ops.permissions[selectedStaff.id]
    }
    const role = selectedStaff.role || 'manager'
    const roleKey = role in DEFAULT_GRANTS_BY_ROLE ? role : 'manager'
    return DEFAULT_GRANTS_BY_ROLE[roleKey]
  }, [selectedStaff, ops.permissions])

  // Check if current user has custom permissions saved in DB
  const hasCustomPermissions = useMemo(() => {
    if (!selectedStaff) return false
    return selectedStaff.id in ops.permissions
  }, [selectedStaff, ops.permissions])

  // Current effective grants for editing
  const currentGrants = useMemo((): UserGrants => {
    if (!selectedStaff) return {}
    return drafts[selectedStaff.id] ?? baselineGrants
  }, [selectedStaff, drafts, baselineGrants])

  // Check if draft has unsaved changes compared to server baseline
  const isDirty = useMemo(() => {
    if (!selectedStaff || !canEditSelected) return false
    const draft = drafts[selectedStaff.id]
    if (!draft) return false
    return !areGrantsEqual(draft, baselineGrants)
  }, [selectedStaff, drafts, baselineGrants, canEditSelected])

  const handleSelectStaffForMatrix = (userId: string) => {
    setSelectedStaffId(userId)
  }

  const handleTogglePermission = (mod: ModuleKey, action: ActionKey) => {
    if (!selectedStaff || !canEditSelected) return

    setDrafts((prev) => {
      const userDraft = prev[selectedStaff.id] ?? baselineGrants
      const existing = userDraft[mod] || []
      const has = existing.includes(action)

      let nextActions: ActionKey[]
      if (has) {
        if (action === 'view') {
          // Revoking 'view' clears dependent actions since viewing is required for all operations
          nextActions = []
        } else {
          nextActions = existing.filter((a) => a !== action)
        }
      } else {
        if (action !== 'view' && !existing.includes('view')) {
          // Granting mutation/operational privileges automatically requires & grants 'view'
          nextActions = [...existing, action, 'view']
        } else {
          nextActions = [...existing, action]
        }
      }

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

  // Batch action: toggle a specific action across an entire section
  const handleToggleSectionAction = (
    modules: ModuleKey[],
    action: ActionKey,
  ) => {
    if (!selectedStaff || !canEditSelected) return

    setDrafts((prev) => {
      const userDraft = { ...(prev[selectedStaff.id] ?? baselineGrants) }
      const allHaveAction = modules.every((mod) =>
        (userDraft[mod] || []).includes(action),
      )

      for (const mod of modules) {
        const existing = userDraft[mod] || []
        if (allHaveAction) {
          if (action === 'view') {
            userDraft[mod] = []
          } else {
            userDraft[mod] = existing.filter((a) => a !== action)
          }
        } else {
          if (action !== 'view') {
            userDraft[mod] = Array.from(new Set([...existing, action, 'view']))
          } else {
            userDraft[mod] = Array.from(new Set([...existing, 'view']))
          }
        }
      }

      return {
        ...prev,
        [selectedStaff.id]: userDraft,
      }
    })
  }

  // Batch action: toggle all actions for a specific module
  const handleToggleModuleAll = (mod: ModuleKey) => {
    if (!selectedStaff || !canEditSelected) return

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
    if (!selectedStaff || !canEditSelected) return

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

  // Batch action: full CRUD (view, create, edit, delete) for an entire section
  const handleSectionFullCrud = (modules: ModuleKey[]) => {
    if (!selectedStaff || !canEditSelected) return

    setDrafts((prev) => {
      const userDraft = { ...(prev[selectedStaff.id] ?? baselineGrants) }
      for (const mod of modules) {
        userDraft[mod] = ['view', 'create', 'edit', 'delete']
      }
      return {
        ...prev,
        [selectedStaff.id]: userDraft,
      }
    })
    toast.success('Granted Full CRUD (view, create, edit, delete) in section')
  }

  // Batch action: view only for an entire section
  const handleSectionViewOnly = (modules: ModuleKey[]) => {
    if (!selectedStaff || !canEditSelected) return

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
    if (!selectedStaff || !canEditSelected) return

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
    if (!selectedStaff || !canEditSelected) return
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

  // Preset: Full CRUD across all modules
  const handlePresetFullCrud = () => {
    if (!selectedStaff || !canEditSelected) return
    const allKeys = PERMISSION_SECTIONS.flatMap((s) =>
      s.modules.map((m) => m.key),
    )
    setDrafts((prev) => {
      const nextDraft: UserGrants = {}
      for (const key of allKeys) {
        nextDraft[key] = ['view', 'create', 'edit', 'delete']
      }
      return {
        ...prev,
        [selectedStaff.id]: nextDraft,
      }
    })
    toast.success('Applied Full CRUD preset (View, Create, Edit, Delete)')
  }

  // Preset: Full Access across all modules
  const handlePresetFullAccess = () => {
    if (!selectedStaff || !canEditSelected) return
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
    if (!selectedStaff || !canEditSelected) return
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
    if (!selectedStaff || !canEditSelected) {
      return { added: 0, removed: 0 }
    }
    const draft = drafts[selectedStaff.id]
    if (!draft) return { added: 0, removed: 0 }

    let added = 0
    let removed = 0
    const allModules = PERMISSION_SECTIONS.flatMap((s) =>
      s.modules.map((m) => m.key),
    )
    for (const mod of allModules) {
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
    if (!selectedStaff || !canEditSelected) return

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
    if (!selectedStaff || !canEditSelected) return

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
          <div className="flex items-center gap-2">
            <DataRefreshButton
              queryKeys={[adminQueries.staff().queryKey]}
              onRefresh={() => refetch()}
              isRefreshing={isFetching}
              variant="button"
            />
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="gap-1.5 h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add Staff Account
            </Button>
          </div>
        }
      />

      <DataSection isRefreshing={isFetching}>
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Total Registered Users"
            value={users.length}
            note="All user accounts & directory"
            icon={Users}
          />
          <KpiCard
            label="Staff & Operators"
            value={staffUsers.length}
            note="Admins, managers, riders"
            icon={ShieldCheck}
          />
          <KpiCard
            label="Matrix Protected Nodes"
            value={MODULES.length}
            note="Granular RBAC modules"
            icon={KeyRound}
            tone="success"
          />
          <KpiCard
            label="Audit Log Entries"
            value={ops.audit.length}
            note="Recorded system events"
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
              <span>User Directory & Details ({users.length})</span>
            </TabsTrigger>
            <TabsTrigger value="matrix" className="gap-2 text-xs">
              <KeyRound className="h-3.5 w-3.5" />
              <span>Admin & Rider Matrix ({matrixEligibleUsers.length})</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2 text-xs">
              <History className="h-3.5 w-3.5" />
              <span>Audit Trail ({ops.audit.length})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search Bar & Scope Filters */}
        {activeTab !== 'matrix' && (
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={
                  activeTab === 'users'
                    ? 'Search users by name, email, phone, role, ID...'
                    : 'Search audit trail by actor, module, action...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-9 text-xs"
              />
            </div>

            {activeTab === 'users' && (
              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto text-xs">
                <span className="text-muted-foreground text-[11px] font-medium mr-1">Filter:</span>
                {(
                  [
                    { id: 'all', label: `All (${users.length})` },
                    { id: 'staff', label: `Staff (${staffUsers.length})` },
                    { id: 'superadmin', label: `Super Admin (${users.filter((u) => isSuperAdmin(u)).length})` },
                    { id: 'admin', label: `Admin (${users.filter((u) => u.role === 'admin').length})` },
                    { id: 'manager', label: `Manager (${users.filter((u) => u.role === 'manager').length})` },
                    { id: 'rider', label: `Rider (${users.filter((u) => u.role === 'rider').length})` },
                    { id: 'customer', label: `Customer (${users.filter((u) => u.role === 'customer').length})` },
                  ] as const
                ).map((scope) => (
                  <Button
                    key={scope.id}
                    variant={userScopeFilter === scope.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUserScopeFilter(scope.id)}
                    className="h-7 px-2.5 text-xs font-normal"
                  >
                    {scope.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' ? (
          /* All Users Directory Table */
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs min-w-[200px]">User Name & Profile</TableHead>
                    <TableHead className="text-xs min-w-[200px]">Email & Verification</TableHead>
                    <TableHead className="text-xs min-w-[130px]">Phone Contact</TableHead>
                    <TableHead className="text-xs min-w-[140px]">System Role</TableHead>
                    <TableHead className="text-xs min-w-[100px]">Account State</TableHead>
                    <TableHead className="text-xs min-w-[140px]">Access Rights</TableHead>
                    <TableHead className="text-right text-xs min-w-[180px]">Role Governance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="p-0">
                        <EmptyState
                          title="No users match your criteria"
                          description="Try switching the scope filter or modifying your search query."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedUsers.map((u) => {
                      const isSelf = u.id === currentUserId
                      const isUpdatingThisRow = updatingRoleUserIds.has(u.id)
                      const isSuper = isSuperAdmin(u)
                      const isEligibleForMatrix = !isSuper && (u.role === 'admin' || u.role === 'manager' || u.role === 'rider')
                      const canChangeRole = !isSelf && !isSuper && (!isTargetAdmin || isSuperAdminUser)

                      return (
                        <TableRow key={u.id} className="hover:bg-muted/20">
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-7 w-7 shrink-0">
                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                  {u.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col min-w-0">
                                <div className="font-medium text-xs text-foreground flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => setInspectingUser(u)}
                                    className="font-semibold hover:underline text-left truncate"
                                    title="Click to inspect complete user details"
                                  >
                                    {u.name}
                                  </button>
                                  {isSelf && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] py-0 px-1 font-mono text-muted-foreground"
                                    >
                                      You
                                    </Badge>
                                  )}
                                  {isSuper && (
                                    <Badge
                                      variant="default"
                                      className="text-[10px] py-0 px-1.5 gap-1 bg-primary text-primary-foreground font-semibold"
                                    >
                                      <Terminal className="h-2.5 w-2.5" />
                                      Developer Team
                                    </Badge>
                                  )}
                                </div>
                                <span className="font-mono text-[11px] text-muted-foreground truncate">
                                  ID: {u.id}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col text-xs">
                              <span className="font-mono text-muted-foreground truncate">
                                {u.email}
                              </span>
                              <div className="flex items-center gap-1 text-[11px]">
                                {u.emailVerified ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Verified
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Unverified email</span>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col text-xs font-mono">
                              <span className="text-foreground">
                                {u.phone || 'No phone'}
                              </span>
                              {u.phone && (
                                <span className="text-[11px] text-muted-foreground font-sans">
                                  {u.phoneVerified ? 'Verified SMS' : 'Unverified'}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            {isSuper ? (
                              <Badge
                                variant="default"
                                className="text-xs font-semibold py-0.5 px-2 bg-primary text-primary-foreground gap-1"
                              >
                                <Terminal className="h-3 w-3" />
                                Super Admin
                              </Badge>
                            ) : u.role === 'admin' ? (
                              <Badge variant="default" className="text-xs font-medium py-0.5 px-2">
                                Admin
                              </Badge>
                            ) : u.role === 'manager' ? (
                              <Badge variant="secondary" className="text-xs font-medium py-0.5 px-2">
                                Manager
                              </Badge>
                            ) : u.role === 'rider' ? (
                              <Badge variant="outline" className="text-xs font-medium py-0.5 px-2 border-primary/40 text-primary">
                                Rider
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs font-normal py-0.5 px-2 text-muted-foreground">
                                Customer
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs">
                              {u.banned ? (
                                <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                                  Suspended
                                </Badge>
                              ) : u.isActive === false ? (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground">
                                  Inactive
                                </Badge>
                              ) : (
                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px]">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Active
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setInspectingUser(u)}
                                className="h-7 px-2 text-[11px] gap-1"
                              >
                                <Info className="h-3 w-3" />
                                Details
                              </Button>
                              {isEligibleForMatrix ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    handleSelectStaffForMatrix(u.id)
                                    setActiveTab('matrix')
                                  }}
                                  className="h-7 px-2 text-[11px] text-primary hover:text-primary hover:bg-primary/10"
                                >
                                  Matrix →
                                </Button>
                              ) : isSuper ? (
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  Root Bypass
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">
                                  Storefront only
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isUpdatingThisRow && (
                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                              )}
                              {isSuper ? (
                                <span className="text-[11px] font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded">
                                  Root Protected
                                </span>
                              ) : (
                                <NativeSelect
                                  value={u.role || 'customer'}
                                  onChange={(e) =>
                                    handleRoleSelectChange(u.id, e.target.value)
                                  }
                                  disabled={isUpdatingThisRow || !canChangeRole}
                                  title={
                                    !canChangeRole
                                      ? 'You cannot modify this role'
                                      : 'Change account role'
                                  }
                                  size="sm"
                                  className={`h-7 text-xs ${
                                    !canChangeRole ? 'opacity-60 cursor-not-allowed' : ''
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
                                    Customer
                                  </NativeSelectOption>
                                </NativeSelect>
                              )}
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
                            className="text-xs py-0 px-1.5 capitalize font-normal"
                          >
                            {selectedStaff.role}
                          </Badge>

                          {selectedStaff.role === 'admin' ? (
                            <Badge
                              variant="default"
                              className="text-xs py-0 px-1.5"
                            >
                              Super Admin
                            </Badge>
                          ) : hasCustomPermissions ? (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 px-1.5 text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
                            >
                              Custom overrides active
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 px-1.5 text-muted-foreground border-border"
                            >
                              Role defaults active
                            </Badge>
                          )}

                          {isDirty && (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 px-1.5 text-info border-info/40 bg-info/10 animate-pulse"
                            >
                              Unsaved changes (+{grantDiffStats.added} / -
                              {grantDiffStats.removed})
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {selectedStaff.email} • ID:{' '}
                          <span className="font-mono text-xs">
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
                          {matrixEligibleUsers.map((u) => (
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
                      {hasCustomPermissions && canEditSelected && (
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
                          !canEditSelected
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
                      {canEditSelected && (
                        <div className="flex items-center gap-1.5 border border-border/60 rounded-md p-0.5 bg-muted/20">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handlePresetReadOnly}
                            disabled={isSavingMatrix || isResettingDefaults}
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                            title="Grant 'view' privilege across all system modules"
                          >
                            <Eye className="h-3 w-3" />
                            Read-only
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handlePresetFullCrud}
                            disabled={isSavingMatrix || isResettingDefaults}
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                            title="Grant standard CRUD (View, Create, Edit, Delete) across all modules"
                          >
                            <Shield className="h-3 w-3" />
                            Full CRUD
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handlePresetFullAccess}
                            disabled={isSavingMatrix || isResettingDefaults}
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
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
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-destructive"
                            title="Revoke all privileges across all system modules"
                          >
                            <XCircle className="h-3 w-3" />
                            Clear all
                          </Button>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
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

                {/* Admin Matrix Customization Notice */}
                {selectedStaff.role === 'admin' && (
                  <div
                    className={`p-3.5 rounded-lg border text-xs flex items-center gap-3 ${
                      isSuperAdminUser
                        ? 'bg-primary/10 border-primary/20 text-foreground'
                        : 'bg-muted/40 border-border text-muted-foreground'
                    }`}
                  >
                    <ShieldCheck
                      className={`h-4 w-4 shrink-0 ${
                        isSuperAdminUser ? 'text-primary' : 'text-foreground'
                      }`}
                    />
                    <div className="leading-relaxed">
                      {isSuperAdminUser ? (
                        <>
                          <strong className="text-foreground font-semibold">
                            Super Admin Governance Active:
                          </strong>{' '}
                          You are customizing granular matrix access for Administrator{' '}
                          <span className="font-semibold text-foreground">{selectedStaff.name}</span>. Overrides saved here take precedence over standard administrator defaults.
                        </>
                      ) : (
                        <>
                          <strong className="text-foreground font-semibold">
                            Administrator Account:
                          </strong>{' '}
                          Administrator permissions can only be reconfigured or customized by the Super Admin (Developer Team: admin@newline.com).
                        </>
                      )}
                    </div>
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
                    const sectionTotal =
                      sectionModuleKeys.length * ACTIONS.length
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
                                  className="text-xs py-0 px-1.5 h-4.5 font-normal border-border bg-background"
                                >
                                  {sectionEnabled} / {sectionTotal} granted
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {section.description}
                              </p>
                            </div>
                          </div>

                          {/* Section Batch Buttons */}
                          {selectedStaff.role !== 'admin' && (
                            <div className="flex flex-wrap items-center gap-1 self-end sm:self-auto">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleSectionGrantAll(sectionModuleKeys)
                                }
                                disabled={isSavingMatrix || isResettingDefaults}
                                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                title={`Grant all permissions in ${section.name}`}
                              >
                                Grant all
                              </Button>
                              <span className="text-muted-foreground/30">
                                •
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleSectionFullCrud(sectionModuleKeys)
                                }
                                disabled={isSavingMatrix || isResettingDefaults}
                                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                title={`Grant CRUD permissions (View, Create, Edit, Delete) in ${section.name}`}
                              >
                                Full CRUD
                              </Button>
                              <span className="text-muted-foreground/30">
                                •
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleSectionViewOnly(sectionModuleKeys)
                                }
                                disabled={isSavingMatrix || isResettingDefaults}
                                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                title={`Set ${section.name} modules to View only`}
                              >
                                View only
                              </Button>
                              <span className="text-muted-foreground/30">
                                •
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleSectionClearAll(sectionModuleKeys)
                                }
                                disabled={isSavingMatrix || isResettingDefaults}
                                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
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
                                {ACTIONS.map((act) => {
                                  const allHaveAction = sectionModuleKeys.every(
                                    (k) =>
                                      (currentGrants[k] || []).includes(act),
                                  )
                                  const someHaveAction =
                                    !allHaveAction &&
                                    sectionModuleKeys.some((k) =>
                                      (currentGrants[k] || []).includes(act),
                                    )

                                  return (
                                    <TableHead
                                      key={act}
                                      className="text-center text-xs capitalize w-[10%] min-w-[70px] p-1"
                                      title={`${act.toUpperCase()}: ${ACTION_DESCRIPTIONS[act]}. Click to toggle column across ${section.name}.`}
                                    >
                                      {!canEditSelected ? (
                                        <div>
                                          <div>{act}</div>
                                          <div className="text-xs font-normal text-muted-foreground tracking-tight lowercase">
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
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleToggleSectionAction(
                                              sectionModuleKeys,
                                              act,
                                            )
                                          }
                                          disabled={
                                            isSavingMatrix ||
                                            isResettingDefaults
                                          }
                                          className="group inline-flex flex-col items-center justify-center w-full py-1 px-1 rounded hover:bg-muted/60 transition-colors cursor-pointer disabled:cursor-not-allowed"
                                          title={`Click to ${allHaveAction ? 'revoke' : 'grant'} "${act}" for all modules in ${section.name}`}
                                        >
                                          <div className="flex items-center gap-1 font-semibold text-foreground group-hover:text-primary">
                                            <span>{act}</span>
                                            <span
                                              className={`inline-block size-1.5 rounded-full ${
                                                allHaveAction
                                                  ? 'bg-primary'
                                                  : someHaveAction
                                                    ? 'bg-amber-500'
                                                    : 'bg-muted-foreground/30'
                                              }`}
                                            />
                                          </div>
                                          <div className="text-xs font-normal text-muted-foreground tracking-tight lowercase group-hover:text-foreground">
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
                                        </button>
                                      )}
                                    </TableHead>
                                  )
                                })}
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
                                            <span className="font-mono text-xs text-muted-foreground/80">
                                              /{modDef.key}
                                            </span>

                                            {/* Status Badge */}
                                            {selectedStaff.role === 'admin' ||
                                            isAllChecked ? (
                                              <Badge
                                                variant="default"
                                                className="text-xs py-0 px-1 h-3.5 font-normal bg-emerald-600/90 hover:bg-emerald-600 text-white"
                                              >
                                                Full access
                                              </Badge>
                                            ) : isViewOnly ? (
                                              <Badge
                                                variant="secondary"
                                                className="text-xs py-0 px-1 h-3.5 font-normal"
                                              >
                                                Read only
                                              </Badge>
                                            ) : currentModGrants.length > 0 ? (
                                              <Badge
                                                variant="outline"
                                                className="text-xs py-0 px-1 h-3.5 font-normal text-amber-600 dark:text-amber-400 border-amber-500/30"
                                              >
                                                {currentModGrants.length} of 6
                                              </Badge>
                                            ) : (
                                              <Badge
                                                variant="outline"
                                                className="text-xs py-0 px-1 h-3.5 font-normal text-muted-foreground border-border"
                                              >
                                                No access
                                              </Badge>
                                            )}

                                            {/* Row Quick Toggle */}
                                            {canEditSelected && (
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
                                                className="h-4.5 px-1 text-xs text-muted-foreground hover:text-foreground ml-auto"
                                              >
                                                {isAllChecked
                                                  ? 'Deselect all'
                                                  : 'Select all'}
                                              </Button>
                                            )}
                                          </div>
                                          <p className="text-xs text-muted-foreground line-clamp-1 leading-normal">
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
                                              !canEditSelected ||
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
                            className="text-xs font-mono uppercase"
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
      </DataSection>

      {/* Complete User Details Dialog */}
      <Dialog
        open={Boolean(inspectingUser)}
        onOpenChange={(open) => !open && setInspectingUser(null)}
      >
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-border/70 bg-muted/20">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                  {inspectingUser?.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  <span>{inspectingUser?.name}</span>
                  {inspectingUser && isSuperAdmin(inspectingUser) && (
                    <Badge variant="default" className="text-[10px] py-0 px-1.5 gap-1">
                      <Terminal className="h-3 w-3" /> Super Admin
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Account profile, verification status, and permissions.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {inspectingUser && (
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/30 border border-border/60">
                <div>
                  <span className="text-muted-foreground text-[11px]">System Role</span>
                  <div className="font-semibold text-foreground capitalize mt-0.5">
                    {isSuperAdmin(inspectingUser) ? 'Super Admin (Developer Team)' : inspectingUser.role}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">Account Status</span>
                  <div className="font-semibold text-foreground mt-0.5">
                    {inspectingUser.banned ? (
                      <span className="text-destructive">Banned / Suspended</span>
                    ) : inspectingUser.isActive === false ? (
                      <span className="text-muted-foreground">Inactive</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">Active</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">Email Verification</span>
                  <div className="font-semibold text-foreground mt-0.5">
                    {inspectingUser.emailVerified ? 'Verified' : 'Unverified'}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">Phone Verification</span>
                  <div className="font-semibold text-foreground mt-0.5">
                    {inspectingUser.phoneVerified ? 'Verified' : 'Unverified'}
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Email Address</span>
                  <span className="font-mono text-foreground">{inspectingUser.email}</span>
                </div>
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Mobile Phone</span>
                  <span className="font-mono text-foreground">{inspectingUser.phone || 'None registered'}</span>
                </div>
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">User ID</span>
                  <div className="flex items-center gap-1.5 font-mono text-foreground">
                    <span>{inspectingUser.id}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(inspectingUser.id)
                        toast.success('User ID copied to clipboard')
                      }}
                      className="h-5 w-5"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Registered At</span>
                  <span className="text-foreground">
                    {new Date(inspectingUser.createdAt).toLocaleString()}
                  </span>
                </div>
                {inspectingUser.banReason && (
                  <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                    <strong>Ban Reason:</strong> {inspectingUser.banReason}
                  </div>
                )}
              </div>

              {isSuperAdmin(inspectingUser) && (
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 text-xs">
                  <strong className="text-foreground">Developer Root Access:</strong>{' '}
                  This account possesses immutable root authority across all database modules, double-entry ledgers, and system settings.
                </div>
              )}
            </div>
          )}

          <DialogFooter className="p-4 border-t border-border/70 bg-muted/20 flex sm:justify-between items-center gap-2">
            {inspectingUser &&
              !isSuperAdmin(inspectingUser) &&
              (inspectingUser.role === 'admin' ||
                inspectingUser.role === 'manager' ||
                inspectingUser.role === 'rider') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const id = inspectingUser.id
                    setInspectingUser(null)
                    handleSelectStaffForMatrix(id)
                    setActiveTab('matrix')
                  }}
                  className="h-8 text-xs text-primary gap-1"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Open Permission Matrix
                </Button>
              )}
            <Button
              variant="default"
              size="sm"
              onClick={() => setInspectingUser(null)}
              className="h-8 text-xs ml-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
