import { useState, useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getOpsBundleFn,
  savePermissionsFn,
} from '#/server/operations/operations.functions'
import { updateUserRoleFn } from '#/server/catalog/catalog.functions'
import { MODULES, ACTIONS } from '#/server/operations/types'
import type { ModuleKey, ActionKey } from '#/server/operations/types'
import { PageHeader } from '#/components/admin/page-header'
import { KpiCard } from '#/components/admin/kpi-card'
import {
  pageClass,
  cardClass,
  tableWrap,
  thClass,
  tdClass,
  btnPrimary,
  btnSecondary,
  inputClass,
  selectClass,
} from '#/components/admin/styles'
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
      toast.success(`User role updated to ${newRole.toUpperCase()}`)
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
    <div className={pageClass}>
      <PageHeader
        kicker="Operations"
        title="Staff & Role-Based Access Control"
        description="Configure granular module action privileges across Managers, Couriers, and Support staff."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Staff & Operators"
          value={staffUsers.length}
          note="Active administrative accounts"
          icon={ShieldCheck}
        />
        <KpiCard
          label="RBAC Protected Modules"
          value={MODULES.length}
          note="Granular permission nodes"
          icon={KeyRound}
          tone="success"
        />
        <KpiCard
          label="Audit Log Entries"
          value={ops.audit.length}
          note="Recorded actions in Neon DB"
          icon={History}
        />
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 cursor-pointer transition ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Accounts ({staffUsers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 cursor-pointer transition ${
            activeTab === 'matrix'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Granular Permission Matrix</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 cursor-pointer transition ${
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Security Audit Trail ({ops.audit.length})</span>
        </button>
      </div>

      {/* Search Input */}
      {activeTab !== 'matrix' && (
        <div className={`${cardClass} p-4`}>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeTab === 'users'
                  ? 'Search staff by name, email, role...'
                  : 'Search audit trail by actor, module, action...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>
      )}

      {activeTab === 'users' ? (
        /* Staff Users Table */
        <div className={tableWrap}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className={thClass}>Staff Name</th>
                  <th className={thClass}>Email Address</th>
                  <th className={thClass}>Current Role</th>
                  <th className={thClass}>Access Rights</th>
                  <th className={`${thClass} text-right`}>Change Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/70 transition">
                    <td className={tdClass}>
                      <div className="font-semibold text-slate-900">{staff.name}</div>
                      <span className="text-xs text-slate-400 font-mono">ID: {staff.id}</span>
                    </td>

                    <td className={tdClass}>
                      <span className="font-mono text-xs text-slate-600">{staff.email}</span>
                    </td>

                    <td className={tdClass}>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-0.5 rounded ${
                          staff.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : staff.role === 'manager'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {staff.role}
                      </span>
                    </td>

                    <td className={tdClass}>
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectStaffForMatrix(staff.id)
                          setActiveTab('matrix')
                        }}
                        className="text-xs text-blue-600 hover:underline font-semibold"
                      >
                        Configure RBAC Node &rarr;
                      </button>
                    </td>

                    <td className={`${tdClass} text-right`}>
                      <select
                        value={staff.role || 'customer'}
                        onChange={(e) => handleRoleChange(staff.id, e.target.value)}
                        disabled={isUpdating}
                        className={selectClass}
                        style={{ height: '32px', width: 'auto', display: 'inline-block' }}
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="rider">Rider</option>
                        <option value="customer">Demote to Customer</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'matrix' ? (
        /* Granular RBAC Matrix */
        <div className={`${cardClass} p-5 space-y-5`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Grant Matrix for: <span className="text-blue-600">{selectedStaff?.name}</span> (
                {selectedStaff?.role})
              </h3>
              <p className="text-xs text-slate-500">
                Toggle specific privileges per module. Changes persist to the operational store.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedStaffId}
                onChange={(e) => handleSelectStaffForMatrix(e.target.value)}
                className={selectClass}
              >
                {staffUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleSaveMatrix}
                disabled={isUpdating || selectedStaff?.role === 'admin'}
                className={btnPrimary}
              >
                <Save className="h-4 w-4" />
                {isUpdating ? 'Saving...' : 'Save Matrix'}
              </button>
            </div>
          </div>

          {selectedStaff?.role === 'admin' && (
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-900 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-purple-700 shrink-0" />
              <span>
                <strong>Super Admin Notice:</strong> Full unrestricted access is automatically granted
                across all modules and actions.
              </span>
            </div>
          )}

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">System Module</th>
                  {ACTIONS.map((act) => (
                    <th key={act} className="py-2.5 px-3 text-center">
                      {act}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {MODULES.map((mod) => {
                  const currentModGrants = localGrants[mod] || []
                  return (
                    <tr key={mod} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-800 capitalize">
                        {mod.replace('_', ' ')}
                      </td>
                      {ACTIONS.map((act) => {
                        const hasGrant = currentModGrants.includes(act)
                        return (
                          <td key={act} className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={hasGrant}
                              disabled={selectedStaff?.role === 'admin' || isUpdating}
                              onChange={() => handleTogglePermission(mod, act)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Audit Trail Table */
        <div className="space-y-3">
          <div className="flex justify-end">
            <button type="button" onClick={handleExportAuditCSV} className={btnSecondary}>
              <Download className="h-4 w-4" />
              Export Audit CSV
            </button>
          </div>

          <div className={tableWrap}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                  <tr>
                    <th className={thClass}>Timestamp</th>
                    <th className={thClass}>Operator</th>
                    <th className={thClass}>Module</th>
                    <th className={thClass}>Action</th>
                    <th className={thClass}>Audit Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAudit.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition text-xs">
                      <td className={tdClass}>
                        <span className="font-mono text-slate-500 whitespace-nowrap">
                          {new Date(log.at).toLocaleString()}
                        </span>
                      </td>

                      <td className={tdClass}>
                        <span className="font-semibold text-slate-900">{log.actor}</span>
                      </td>

                      <td className={tdClass}>
                        <span className="font-semibold text-blue-600 capitalize">{log.module}</span>
                      </td>

                      <td className={tdClass}>
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {log.action}
                        </span>
                      </td>

                      <td className={tdClass}>
                        <span className="text-slate-700">{log.detail}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
