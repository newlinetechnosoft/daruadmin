import { useState, useMemo } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getAdminUsersFn,
  updateUserRoleFn,
} from '#/server/catalog/catalog.functions'
import {
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
import { PageHeader } from '#/components/shared/page-header'
import { Input } from '#/components/ui/input'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
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
import { EmptyState } from '#/components/shared/empty-state'

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
          <Badge variant="default" className="gap-1 text-xs font-normal">
            <Shield className="h-3 w-3" /> Admin
          </Badge>
        )
      case 'manager':
        return (
          <Badge variant="secondary" className="gap-1 text-xs font-normal">
            <ShieldAlert className="h-3 w-3" /> Manager
          </Badge>
        )
      case 'rider':
        return (
          <Badge variant="outline" className="gap-1 text-xs font-normal">
            <Bike className="h-3 w-3" /> Rider
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="gap-1 text-xs font-normal text-muted-foreground">
            <UserCheck className="h-3 w-3" /> Customer
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Access"
        title="Users and permissions"
        description="Manage staff privileges, rider assignments, customer profiles, and account status."
        actions={
          <Badge variant="secondary" className="font-mono text-xs">
            {users.length} users
          </Badge>
        }
      />

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-9 text-xs"
          />
        </div>

        <NativeSelect
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          size="sm"
          className="h-8 text-xs"
        >
          <NativeSelectOption value="all">All roles</NativeSelectOption>
          {ROLES.map((r) => (
            <NativeSelectOption key={r.value} value={r.value}>
              {r.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">User</TableHead>
              <TableHead className="text-xs">Contact</TableHead>
              <TableHead className="text-xs">Role permission</TableHead>
              <TableHead className="text-xs">Joined</TableHead>
              <TableHead className="text-center text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    title="No matching users found"
                    description="Try adjusting your search query or role filter."
                  />
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((u) => {
                const currentRole = u.role || 'customer'
                const isUpdating = updatingUserId === u.id
                const isActive = u.isActive !== false
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                            {u.name.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-foreground">{u.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {u.id.slice(0, 10)}...
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-foreground">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span>{u.email}</span>
                      </div>
                      {u.phone && (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{u.phone}</span>
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRoleBadge(currentRole)}
                        <NativeSelect
                          disabled={isUpdating}
                          value={currentRole}
                          onChange={(e) =>
                            handleRoleChange(u.id, e.target.value)
                          }
                          size="sm"
                          className="h-7 text-xs"
                        >
                          {ROLES.map((r) => (
                            <NativeSelectOption key={r.value} value={r.value}>
                              {r.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>
                          {new Date(u.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <Button
                        variant={isActive ? 'outline' : 'destructive'}
                        size="sm"
                        disabled={isUpdating}
                        onClick={() =>
                          handleToggleActive(u.id, u.isActive ?? true)
                        }
                        className="h-7 gap-1 text-[11px]"
                      >
                        {isActive ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" /> Suspended
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
