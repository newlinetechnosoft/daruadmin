import { useState, useMemo } from 'react'
import {
  Download,
  Search,
  KeyRound,
  UserCheck,
  UserX,
  MoreHorizontal,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getSuperAdminUserPasswordFn,
  updateSuperAdminUserPasswordFn,
} from '#/server/superadmin/superadmin.functions'
import {
  updateUserRoleFn,
  updateUserStatusFn,
} from '#/server/catalog/catalog.functions'
import { downloadCsvFile, generateCsvString } from '#/lib/csv-helper'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import { Label } from '#/components/ui/label'
import { Card, CardContent } from '#/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { SectionHeader } from '../components/section-header'

interface UserItem {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  role: string | null
  isActive?: boolean | null
  banned?: boolean | null
  banReason?: string | null
  createdAt?: string | Date | null
}

interface UserRolesTabProps {
  users?: UserItem[]
  onRefetchUsers?: () => void
}

export function UserRolesTab({
  users = [],
  onRefetchUsers,
}: UserRolesTabProps) {
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [isUpdatingUser, setIsUpdatingUser] = useState(false)

  // Ban Dialog State
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [targetUser, setTargetUser] = useState<UserItem | null>(null)
  const [banReasonInput, setBanReasonInput] = useState('')

  // Password Vault Dialog State
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [passwordTargetUser, setPasswordTargetUser] = useState<UserItem | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')
  const [isPinVerified, setIsPinVerified] = useState(false)
  const [revealedPasswordData, setRevealedPasswordData] = useState<{
    password?: string | null
    updatedAt?: string | null
  } | null>(null)
  const [newPasswordInput, setNewPasswordInput] = useState('')
  const [showRevealedPassword, setShowRevealedPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isCheckingPassword, setIsCheckingPassword] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [copied, setCopied] = useState(false)

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = userSearch.toLowerCase().trim()
      const matchesSearch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q))

      const matchesRole =
        userRoleFilter === 'all' || (u.role || 'customer') === userRoleFilter

      return matchesSearch && matchesRole
    })
  }, [users, userSearch, userRoleFilter])

  const handleExportUsers = () => {
    try {
      const columns = [
        { header: 'id', key: 'id' as const },
        { header: 'name', key: 'name' as const },
        { header: 'email', key: 'email' as const },
        { header: 'phone', key: 'phone' as const },
        { header: 'role', key: 'role' as const },
        { header: 'isActive', key: 'isActive' as const },
        { header: 'banned', key: 'banned' as const },
      ]
      const rows = filteredUsers.map((u) => ({
        id: u.id,
        name: u.name || '',
        email: u.email || '',
        phone: u.phone || '',
        role: u.role || 'customer',
        isActive: u.isActive !== false ? 'true' : 'false',
        banned: u.banned ? 'true' : 'false',
      }))
      const csvStr = generateCsvString(columns, rows)
      downloadCsvFile(`users-manifest-${Date.now()}.csv`, csvStr)
      toast.success(`Exported ${rows.length} users to CSV`)
    } catch {
      toast.error('Failed to export users CSV')
    }
  }

  const handleChangeUserRole = async (userId: string, newRole: string) => {
    try {
      setIsUpdatingUser(true)
      await updateUserRoleFn({ data: { userId, role: newRole as any } })
      toast.success(`Role upgraded to ${newRole.toUpperCase()}`)
      onRefetchUsers?.()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update user role')
    } finally {
      setIsUpdatingUser(false)
    }
  }

  const handleToggleUserActive = async (userId: string, currentActive: boolean) => {
    try {
      setIsUpdatingUser(true)
      await updateUserStatusFn({ data: { userId, isActive: !currentActive } })
      toast.success(currentActive ? 'User account deactivated' : 'User account activated')
      onRefetchUsers?.()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to toggle account status')
    } finally {
      setIsUpdatingUser(false)
    }
  }

  const handleOpenBanDialog = (u: UserItem) => {
    setTargetUser(u)
    setBanReasonInput('')
    setBanDialogOpen(true)
  }

  const handleConfirmBan = async () => {
    if (!targetUser) return
    try {
      setIsUpdatingUser(true)
      await updateUserStatusFn({
        data: {
          userId: targetUser.id,
          banned: true,
          banReason: banReasonInput || 'Suspended by Super Admin operator',
        },
      })
      toast.success(`Account banned: ${targetUser.name || targetUser.email}`)
      setBanDialogOpen(false)
      onRefetchUsers?.()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to ban user')
    } finally {
      setIsUpdatingUser(false)
    }
  }

  const handleLiftBan = async (u: UserItem) => {
    try {
      setIsUpdatingUser(true)
      await updateUserStatusFn({
        data: {
          userId: u.id,
          banned: false,
          banReason: null,
        },
      })
      toast.success(`Suspension lifted for ${u.name || u.email}`)
      onRefetchUsers?.()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to lift ban')
    } finally {
      setIsUpdatingUser(false)
    }
  }

  // Password Vault handlers
  const handleOpenPasswordModal = (u: UserItem) => {
    setPasswordTargetUser(u)
    setPinInput('')
    setPinError('')
    setIsPinVerified(false)
    setRevealedPasswordData(null)
    setNewPasswordInput('')
    setShowRevealedPassword(false)
    setShowNewPassword(false)
    setPasswordDialogOpen(true)
  }

  const handleClosePasswordModal = () => {
    setPasswordDialogOpen(false)
    setPasswordTargetUser(null)
    setPinInput('')
    setPinError('')
    setIsPinVerified(false)
    setRevealedPasswordData(null)
  }

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordTargetUser) return
    if (!pinInput.trim()) {
      setPinError('Security PIN required')
      return
    }

    try {
      setIsCheckingPassword(true)
      setPinError('')
      const res = await getSuperAdminUserPasswordFn({
        data: { userId: passwordTargetUser.id, pin: pinInput },
      })
      setIsPinVerified(true)
      setRevealedPasswordData(res)
      toast.success('Security PIN verified — Vault Unlocked')
    } catch (err: any) {
      setPinError(err?.message || 'Invalid Super Admin Security PIN')
    } finally {
      setIsCheckingPassword(false)
    }
  }

  const handleSaveNewPassword = async () => {
    if (!passwordTargetUser || !newPasswordInput || newPasswordInput.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    try {
      setIsSavingPassword(true)
      await updateSuperAdminUserPasswordFn({
        data: {
          userId: passwordTargetUser.id,
          newPassword: newPasswordInput,
          pin: pinInput,
        },
      })
      toast.success(`Password reset for ${passwordTargetUser.name || passwordTargetUser.email}`)
      setRevealedPasswordData({
        password: newPasswordInput,
        updatedAt: new Date().toISOString(),
      })
      setNewPasswordInput('')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update user password')
    } finally {
      setIsSavingPassword(false)
    }
  }

  const handleGenerateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*'
    let pass = ''
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNewPasswordInput(pass)
    setShowNewPassword(true)
    toast.info('Generated random password')
  }

  const handleCopyPassword = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Password copied to clipboard')
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="User & Role Governance"
        description="Inspect customer, rider, and staff accounts. Manage roles, activation, and bans."
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportUsers}
            className="h-8 text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Users CSV</span>
          </Button>
        }
      />

      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardContent className="p-4 space-y-3">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or mobile..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                <SelectTrigger className="text-xs h-8 w-[140px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="superadmin">Super Admin</SelectItem>
                  <SelectItem value="admin">Store Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="rider">Rider</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="text-xs font-mono px-2 py-1 shrink-0">
                {filteredUsers.length} Users
              </Badge>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-xs font-bold py-2">User / Identity</TableHead>
                  <TableHead className="text-xs font-bold py-2">Phone</TableHead>
                  <TableHead className="text-xs font-bold py-2 w-[130px]">Role</TableHead>
                  <TableHead className="text-xs font-bold py-2 w-[100px]">Status</TableHead>
                  <TableHead className="text-xs font-bold py-2 w-[50px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-xs">
                      No users found matching query
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.slice(0, 50).map((u) => {
                    const isSuper =
                      u.role === 'superadmin' || u.email?.toLowerCase() === 'admin@newline.com'
                    return (
                      <TableRow key={u.id} className="text-xs hover:bg-muted/20">
                        <TableCell className="py-2">
                          <div className="space-y-0.5">
                            <p className="font-semibold text-foreground flex items-center gap-1.5">
                              <span>{u.name || 'Unnamed User'}</span>
                              {isSuper && (
                                <Badge variant="default" className="text-[10px] px-1 py-0 bg-cyan-600">
                                  ROOT
                                </Badge>
                              )}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono truncate max-w-[200px]">
                              {u.email || 'No email'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground py-2">
                          {u.phone || '—'}
                        </TableCell>
                        <TableCell className="py-2">
                          <Select
                            disabled={isUpdatingUser || (isSuper && u.email === 'admin@newline.com')}
                            value={u.role || 'customer'}
                            onValueChange={(val) => handleChangeUserRole(u.id, val)}
                          >
                            <SelectTrigger className="text-xs h-7 w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="superadmin">Super Admin</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="rider">Rider</SelectItem>
                              <SelectItem value="customer">Customer</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className={
                                u.isActive !== false
                                  ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10 text-[10px] px-1 py-0'
                                  : 'text-amber-500 border-amber-500/30 bg-amber-500/10 text-[10px] px-1 py-0'
                              }
                            >
                              {u.isActive !== false ? 'Active' : 'Inactive'}
                            </Badge>
                            {u.banned && (
                              <Badge
                                variant="destructive"
                                className="text-[10px] px-1 py-0"
                                title={u.banReason || 'Banned account'}
                              >
                                Banned
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-2">
                          {/* Row actions menu (kebab) */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs w-44">
                              <DropdownMenuItem
                                onClick={() => handleOpenPasswordModal(u)}
                                className="gap-2 cursor-pointer"
                              >
                                <KeyRound className="h-3.5 w-3.5 text-amber-500" />
                                <span>Password Vault</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                disabled={isUpdatingUser || isSuper}
                                onClick={() => handleToggleUserActive(u.id, u.isActive !== false)}
                                className="gap-2 cursor-pointer"
                              >
                                {u.isActive !== false ? (
                                  <>
                                    <UserX className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span>Deactivate</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                                    <span>Activate</span>
                                  </>
                                )}
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              {u.banned ? (
                                <DropdownMenuItem
                                  disabled={isUpdatingUser}
                                  onClick={() => handleLiftBan(u)}
                                  className="gap-2 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                >
                                  <UserCheck className="h-3.5 w-3.5" />
                                  <span>Lift Ban</span>
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  disabled={isUpdatingUser || isSuper}
                                  onClick={() => handleOpenBanDialog(u)}
                                  className="gap-2 text-rose-500 focus:text-rose-600 focus:bg-rose-500/10 cursor-pointer"
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                  <span>Suspend / Ban</span>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Ban / Suspension Confirmation Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-rose-500">
              <ShieldAlert className="h-4 w-4" />
              <span>Suspend User Account</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Suspending <strong className="text-foreground">{targetUser?.name || targetUser?.email}</strong> will revoke active sessions and prevent order placement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-xs font-semibold">Reason for Suspension (Audit Log)</Label>
            <Input
              value={banReasonInput}
              onChange={(e) => setBanReasonInput(e.target.value)}
              placeholder="e.g. Chargeback dispute, invalid phone, policy violation..."
              className="text-xs h-8"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBanDialogOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isUpdatingUser}
              onClick={handleConfirmBan}
              className="text-xs h-8 gap-1.5"
            >
              {isUpdatingUser ? <RefreshCw className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
              <span>Confirm Suspension</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Vault Dialog */}
      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleClosePasswordModal()
          else setPasswordDialogOpen(true)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Lock className="h-4 w-4" />
              </div>
              <span>Password Security Vault</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Credential inspection & reset for{' '}
              <strong className="text-foreground">{passwordTargetUser?.name || 'User'}</strong> ({passwordTargetUser?.email || ''}).
            </DialogDescription>
          </DialogHeader>

          {!isPinVerified ? (
            <form onSubmit={handleVerifyPin} className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Super Admin Security PIN</Label>
                <div className="relative">
                  <Input
                    type="password"
                    autoFocus
                    maxLength={10}
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value)
                      if (pinError) setPinError('')
                    }}
                    placeholder="Enter PIN"
                    className="text-xs h-8 tracking-widest pl-8 font-mono"
                  />
                  <Lock className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
                {pinError && (
                  <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    <span>{pinError}</span>
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClosePasswordModal}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isCheckingPassword || !pinInput.trim()}
                  className="text-xs h-8 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isCheckingPassword ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <KeyRound className="h-3 w-3" />
                  )}
                  <span>Unlock Vault</span>
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-primary" />
                    Current Plaintext Password
                  </span>
                  {revealedPasswordData?.updatedAt && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(revealedPasswordData.updatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {revealedPasswordData?.password ? (
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        readOnly
                        type={showRevealedPassword ? 'text' : 'password'}
                        value={revealedPasswordData.password}
                        className="font-mono text-xs h-8 bg-background pr-10 select-all"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowRevealedPassword((v) => !v)}
                        className="h-7 w-7 absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showRevealedPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyPassword(revealedPasswordData.password!)}
                      className="h-8 text-xs px-2.5 gap-1 shrink-0"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </Button>
                  </div>
                ) : (
                  <div className="rounded border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-muted-foreground space-y-0.5">
                    <p className="text-[11px] font-medium text-foreground">
                      One-Way Cryptographic Hash
                    </p>
                    <p className="text-[10px]">
                      Set a new password below to make it visible and manageable in this vault.
                    </p>
                  </div>
                )}
              </div>

              {/* Set New Password */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Set New Password</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateRandomPassword}
                    className="h-6 text-[11px] px-1.5 text-primary gap-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Generate Random</span>
                  </Button>
                </div>

                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Enter at least 6 characters..."
                    className="text-xs h-8 pr-10 font-mono"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="h-7 w-7 absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>

                <Button
                  type="button"
                  size="sm"
                  disabled={isSavingPassword || !newPasswordInput || newPasswordInput.length < 6}
                  onClick={handleSaveNewPassword}
                  className="w-full text-xs gap-1.5 bg-primary text-primary-foreground h-8"
                >
                  {isSavingPassword ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <KeyRound className="h-3 w-3" />
                  )}
                  <span>Apply New Password</span>
                </Button>
              </div>

              <DialogFooter className="pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClosePasswordModal}
                  className="text-xs h-8"
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
