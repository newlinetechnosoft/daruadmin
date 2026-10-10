import { useState, useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getOpsBundleFn,
  savePermissionsFn,
} from '#/server/operations/operations.functions'
import { updateUserRoleFn } from '#/server/catalog/catalog.functions'
import { MODULES, ACTIONS } from '#/server/operations/types'
import type { ModuleKey, ActionKey } from '#/server/operations/types'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '#/components/ui/tabs'
import {
  NativeSelect,
  NativeSelectOption,
} from '#/components/ui/native-select'
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

export const Route = createFileRoute('/admin/staff')({
  loader: async () => {
    return getOpsBundleFn()
  },
  component: AdminStaffPage,
})

function AdminStaffPage() {
  const { ops, users } = Route.useLoaderData()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'users' | 'matrix' | 'audit'>('users')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStaffId, setSelectedStaffId] = useState<string>(users[0]?.id || '')
  const [isUpdating, setIsUpdating] = useState(false)

  // Filter staff users (admin, manager, or rider)
  const staffUsers = useMemo(() => {
    return users.filter((u) => u.role === 'admin' || u.role === 'manager' || u.role === 'rider')
  }, [users])

  const filteredStaff = useMemo(() => {
    return staffUsers.filter((u) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.role || '').includes(q)
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

  // Current staff member's permissions
  const selectedStaff = users.find((u) => u.id === selectedStaffId) || users[0]
  const currentGrants: Record<string, string[]> = useMemo(() => {
    if (!selectedStaff) return {}
    if (selectedStaff.role === 'admin') {
      return Object.fromEntries(MODULES.map((m) => [m, [...ACTIONS]]))
    }
    return (ops.permissions[selectedStaff.id] as Record<string, string[]>) || {
      dashboard: ['view'],
      orders: ['view', 'edit'],
      products: ['view'],
      customers: ['view'],
      riders: ['view'],
      shipping: ['view'],
    }
  }, [selectedStaff, ops.permissions])

  const [localGrants, setLocalGrants] = useState<Record<string, string[]>>(currentGrants)

  const handleSelectStaffForMatrix = (userId: string) => {
    setSelectedStaffId(userId)
    const st = users.find((u) => u.id === userId)
    if (st && st.role === 'admin') {
      setLocalGrants(Object.fromEntries(MODULES.map((m) => [m, [...ACTIONS]])))
    } else {
      setLocalGrants(
        (ops.permissions[userId] as Record<string, string[]>) || {
          dashboard: ['view'],
          orders: ['view', 'edit'],
          products: ['view'],
        }
      )
    }
  }

  const handleTogglePermission = (mod: ModuleKey, action: ActionKey) => {
    setLocalGrants((prev) => {
      const existing = prev[mod] || []
      const has = existing.includes(action)
      const nextActions = has
        ? existing.filter((a) => a !== action)
        : [...existing, action]
      return { ...prev, [mod]: nextActions }
    })
  }

  const handleSaveMatrix = async () => {
    if (!selectedStaff) return

    try {
      setIsUpdating(true)
      await savePermissionsFn({
        data: {
          userId: selectedStaff.id,
          grants: localGrants,
        },
      })
      toast.success(`RBAC permissions saved for ${selectedStaff.name}!`)
      await router.invalidate()
    } catch {
      toast.error('Failed to save permissions')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setIsUpdating(true)
      await updateUserRoleFn({ data: { userId, role: newRole } })
      toast.success(`User role updated to ${newRole}`)
      await router.invalidate()
    } catch {
      toast.error('Failed to update role')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleExportAuditCSV = () => {
    const headers = 'Timestamp,Actor,Module,Action,Detail\n'
    const rows = filteredAudit
      .map(
        (a) =>
          `"${a.at}","${a.actor}","${a.module}","${a.action}","${a.detail.replace(/"/g, '""')}"`
      )
      .join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success('Audit trail exported to CSV')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Operations"
        title="Staff and access control"
        description="Configure granular module action privileges across managers, couriers, and support staff."
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
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
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
                <TableHead className="text-right text-xs">Change role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      title="No staff members found"
                      description="Try adjusting your search terms."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredStaff.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell>
                      <div className="font-medium text-xs text-foreground">{staff.name}</div>
                      <span className="font-mono text-[11px] text-muted-foreground">ID: {staff.id.slice(0, 10)}...</span>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{staff.email}</span>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={staff.role === 'admin' ? 'default' : 'secondary'}
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
                      <NativeSelect
                        value={staff.role || 'customer'}
                        onChange={(e) => handleRoleChange(staff.id, e.target.value)}
                        disabled={isUpdating}
                        size="sm"
                        className="h-7 text-xs"
                      >
                        <NativeSelectOption value="admin">Admin</NativeSelectOption>
                        <NativeSelectOption value="manager">Manager</NativeSelectOption>
                        <NativeSelectOption value="rider">Rider</NativeSelectOption>
                        <NativeSelectOption value="customer">Demote to customer</NativeSelectOption>
                      </NativeSelect>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : activeTab === 'matrix' ? (
        /* Granular RBAC Matrix */
        <Card className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div>
              <h3 className="text-xs font-semibold text-foreground">
                Grant matrix for: <span className="text-primary">{selectedStaff?.name}</span> (
                {selectedStaff?.role})
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Toggle privileges per module. Changes persist to the operational store.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <NativeSelect
                value={selectedStaffId}
                onChange={(e) => handleSelectStaffForMatrix(e.target.value)}
                size="sm"
                className="h-8 text-xs"
              >
                {staffUsers.map((u) => (
                  <NativeSelectOption key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </NativeSelectOption>
                ))}
              </NativeSelect>

              <Button
                size="sm"
                onClick={handleSaveMatrix}
                disabled={isUpdating || selectedStaff?.role === 'admin'}
                className="h-8 gap-1.5 text-xs"
              >
                <Save className="h-3.5 w-3.5" />
                {isUpdating ? 'Saving...' : 'Save matrix'}
              </Button>
            </div>
          </div>

          {selectedStaff?.role === 'admin' && (
            <div className="p-3 bg-muted/40 rounded-md border border-border text-xs flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-foreground shrink-0" />
              <span className="text-muted-foreground">
                <strong className="text-foreground">Super admin notice:</strong> Full unrestricted access is automatically granted across all modules and actions.
              </span>
            </div>
          )}

          <div className="overflow-hidden border border-border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">System module</TableHead>
                  {ACTIONS.map((act) => (
                    <TableHead key={act} className="text-center text-xs capitalize">
                      {act}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {MODULES.map((mod) => {
                  const currentModGrants = localGrants[mod] || []
                  return (
                    <TableRow key={mod}>
                      <TableCell className="font-medium text-xs capitalize">
                        {mod.replace('_', ' ')}
                      </TableCell>
                      {ACTIONS.map((act) => {
                        const hasGrant = currentModGrants.includes(act)
                        return (
                          <TableCell key={act} className="text-center">
                            <Checkbox
                              checked={hasGrant}
                              disabled={selectedStaff?.role === 'admin' || isUpdating}
                              onCheckedChange={() => handleTogglePermission(mod, act)}
                              aria-label={`${act} on ${mod}`}
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
      ) : (
        /* Audit Trail Table */
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportAuditCSV} className="h-8 gap-1.5 text-xs">
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

                      <TableCell className="font-medium text-foreground">{log.actor}</TableCell>

                      <TableCell className="capitalize text-foreground">{log.module}</TableCell>

                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono uppercase">
                          {log.action}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-muted-foreground">{log.detail}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
