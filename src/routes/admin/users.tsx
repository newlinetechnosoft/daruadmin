import { useState, useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getAdminUsersFn,
  updateUserRoleFn,
} from '#/server/catalog/catalog.functions'
import {
  Users,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  Bike,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  Calendar,
} from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/users')({
  loader: async () => {
    const users = await getAdminUsersFn()
    return { users }
  },
  component: AdminUsersPage,
})

const ROLES = [
  { value: 'admin', label: 'Admin (Full Access)' },
  { value: 'manager', label: 'Store Manager' },
  { value: 'rider', label: 'Delivery Rider' },
  { value: 'customer', label: 'Customer' },
]

const fieldCls =
  'h-11 w-full border border-black/30 bg-white px-3 text-sm outline-none placeholder:text-neutral-400 focus:border-black focus:shadow-[3px_3px_0_0_#000]'
const filterCls =
  'h-11 border border-black/30 bg-white px-3 text-sm outline-none focus:border-black'

const badgeBase =
  'inline-flex shrink-0 items-center gap-1 border px-2 py-1 text-[10px] font-bold uppercase tracking-wider'

function AdminUsersPage() {
  const { users } = Route.useLoaderData()
  const router = useRouter()

  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const userRole = u.role || 'customer'
      if (roleFilter !== 'all' && userRole !== roleFilter) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = u.name.toLowerCase().includes(q)
        const matchesEmail = u.email.toLowerCase().includes(q)
        const matchesPhone = u.phone?.toLowerCase().includes(q)
        return matchesName || matchesEmail || Boolean(matchesPhone)
      }
      return true
    })
  }, [users, searchQuery, roleFilter])

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId)
    try {
      await updateUserRoleFn({
        data: {
          userId,
          role: newRole,
        },
      })
      toast.success('User role updated')
      await router.invalidate()
    } catch {
      toast.error('Failed to update role')
    } finally {
      setUpdatingUserId(null)
    }
  }

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    setUpdatingUserId(userId)
    try {
      await updateUserRoleFn({
        data: {
          userId,
          role: users.find((u) => u.id === userId)?.role || 'customer',
          isActive: !currentStatus,
        },
      })
      toast.success(currentStatus ? 'User suspended' : 'User activated')
      await router.invalidate()
    } catch {
      toast.error('Failed to update status')
    } finally {
      setUpdatingUserId(null)
    }
  }

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case 'admin':
        return (
          <span className={`${badgeBase} border-black bg-black text-white`}>
            <Shield className="h-3 w-3" /> Admin
          </span>
        )
      case 'manager':
        return (
          <span className={`${badgeBase} border-black bg-white text-black`}>
            <ShieldAlert className="h-3 w-3" /> Manager
          </span>
        )
      case 'rider':
        return (
          <span
            className={`${badgeBase} border-black/30 bg-[#f3f2ee] text-black`}
          >
            <Bike className="h-3 w-3" /> Rider
          </span>
        )
      default:
        return (
          <span
            className={`${badgeBase} border-black/15 bg-white text-neutral-500`}
          >
            <UserCheck className="h-3 w-3" /> Customer
          </span>
        )
    }
  }

  return (
    <div className="space-y-8 bg-white p-5 text-[#101010] sm:p-8">
      {/* Header */}
      <div>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
          <Users className="h-3.5 w-3.5" /> Access
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <h1 className="text-4xl font-black uppercase leading-[0.9] tracking-tighter sm:text-6xl">
            Users &amp; permissions
          </h1>
          <span className="border border-black px-2.5 py-1 text-[11px] font-bold tabular-nums">
            {users.length} users
          </span>
        </div>
        <p className="mt-4 max-w-md text-sm text-neutral-600">
          Manage staff privileges, rider assignments, customer profiles, and
          account status.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 bg-[#f3f2ee] p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by name, email, or mobile number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${fieldCls} pl-10`}
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by user role"
          className={filterCls}
        >
          <option value="all">All Roles</option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="border border-black">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-black bg-[#f3f2ee] text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                <th className="px-4 py-3.5">User</th>
                <th className="px-4 py-3.5">Contact</th>
                <th className="px-4 py-3.5">Role permission</th>
                <th className="px-4 py-3.5">Joined</th>
                <th className="px-4 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-14 text-center text-sm text-neutral-500"
                  >
                    No matching users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const currentRole = u.role || 'customer'
                  const isUpdating = updatingUserId === u.id
                  const isActive = u.isActive !== false
                  return (
                    <tr
                      key={u.id}
                      className="transition-colors hover:bg-neutral-50"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3.5">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black text-sm font-bold text-white">
                            {u.name.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-semibold">{u.name}</div>
                            <div className="font-mono text-[11px] text-neutral-400">
                              ID: {u.id.slice(0, 10)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Mail className="h-3.5 w-3.5 text-neutral-400" />
                          <span>{u.email}</span>
                        </div>
                        {u.phone && (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
                            <Phone className="h-3.5 w-3.5 text-neutral-400" />
                            <span>{u.phone}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2.5">
                          {getRoleBadge(currentRole)}
                          <select
                            disabled={isUpdating}
                            value={currentRole}
                            aria-label={`Role for ${u.name}`}
                            onChange={(e) =>
                              handleRoleChange(u.id, e.target.value)
                            }
                            className="h-9 cursor-pointer border border-black/30 bg-white px-2 text-xs outline-none focus:border-black disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-xs text-neutral-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                          <span>
                            {new Date(u.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() =>
                            handleToggleActive(u.id, u.isActive ?? true)
                          }
                          className={`inline-flex cursor-pointer items-center gap-1.5 border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            isActive
                              ? 'border-black bg-black text-white hover:bg-neutral-800'
                              : 'border-red-700 bg-red-50 text-red-800 hover:bg-red-100'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3" /> Suspended
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
