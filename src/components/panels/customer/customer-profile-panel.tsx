import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Header } from '#/components/store/header'
import { authClient } from '#/lib/auth-client'
import { clearAllLocalData } from '#/lib/idb'
import { getCustomerOrdersFn } from '#/server/orders/order.functions'
import type { Order } from '#/server/operations/types'
import { Card } from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Skeleton } from '#/components/ui/skeleton'
import { Separator } from '#/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
import { ChangePasswordDialog } from '#/components/auth/change-password-dialog'
import { EditPhoneDialog } from './edit-phone-dialog'
import { ChangePhotoDialog } from './change-photo-dialog'
import {
  Mail,
  Phone,
  Pencil,
  KeyRound,
  LogOut,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Sparkles,
  ChevronRight,
  LogIn,
  Package,
  Camera,
} from 'lucide-react'
import { toast } from 'sonner'

export function CustomerProfilePanel() {
  const { data: session, isPending: isSessionPending, refetch: refetchSession } = authClient.useSession()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [orders, setOrders] = useState<Order[]>([])
  const [isOrdersLoading, setIsOrdersLoading] = useState(true)

  const [isEditPhoneOpen, setIsEditPhoneOpen] = useState(false)
  const [isChangePhotoOpen, setIsChangePhotoOpen] = useState(false)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  // Fetch orders for customer stats
  useEffect(() => {
    if (isSessionPending) return
    if (!session?.user) {
      setIsOrdersLoading(false)
      return
    }

    let isMounted = true
    setIsOrdersLoading(true)

    getCustomerOrdersFn()
      .then((res) => {
        if (!isMounted) return
        setOrders(res || [])
      })
      .catch((err) => {
        console.error('Failed to load customer orders for profile stats:', err)
      })
      .finally(() => {
        if (isMounted) setIsOrdersLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [session?.user, isSessionPending])

  // Order statistics
  const stats = useMemo(() => {
    const total = orders.length
    const successful = orders.filter((o) => o.status === 'delivered').length
    const cancelled = orders.filter((o) => o.status === 'cancelled').length
    const inTransit = orders.filter(
      (o) =>
        o.status === 'pending' ||
        o.status === 'confirmed' ||
        o.status === 'dealer_assigned' ||
        o.status === 'rider_assigned' ||
        o.status === 'picked_up' ||
        o.status === 'out_for_delivery',
    ).length
    const failed = orders.filter(
      (o) => o.status === 'delivery_failed' || o.status === 'returned',
    ).length

    const successRate = total > 0 ? Math.round((successful / total) * 100) : 0

    return {
      total,
      successful,
      cancelled,
      inTransit,
      inProgress: inTransit,
      failed,
      successRate,
    }
  }, [orders])

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await authClient.signOut()
      await clearAllLocalData()
      queryClient.clear()
      toast.success('Signed out successfully')
      navigate({ to: '/' })
    } catch (err) {
      console.error('Failed to sign out:', err)
      toast.error('Failed to sign out. Please try again.')
    } finally {
      setIsSigningOut(false)
      setIsSignOutConfirmOpen(false)
    }
  }

  const handlePhoneUpdated = async () => {
    await refetchSession()
    queryClient.invalidateQueries()
  }

  const handlePhotoUpdated = async () => {
    await refetchSession()
    queryClient.invalidateQueries()
  }

  const user = session?.user

  // Format initials
  const initials = useMemo(() => {
    if (!user?.name) return 'U'
    const parts = user.name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return user.name.slice(0, 2).toUpperCase()
  }, [user?.name])

  return (
    <div className="storefront min-h-screen bg-background flex flex-col selection:bg-primary selection:text-primary-foreground">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 pb-28 md:pb-16 space-y-8">
        {/* Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center space-x-2 text-xs text-muted-foreground"
        >
          <Link to="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-foreground">My Profile</span>
        </nav>

        {/* Loading Skeleton */}
        {isSessionPending && (
          <div className="space-y-6">
            <Card className="p-8 border-border/80 shadow-md">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <Skeleton className="h-24 w-24 rounded-full" />
                <div className="space-y-3 flex-1 text-center sm:text-left">
                  <Skeleton className="h-6 w-48 mx-auto sm:mx-0" />
                  <Skeleton className="h-4 w-64 mx-auto sm:mx-0" />
                  <Skeleton className="h-4 w-40 mx-auto sm:mx-0" />
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Unauthenticated State */}
        {!isSessionPending && !user && (
          <Card className="border-border/80 p-8 sm:p-12 text-center max-w-md mx-auto shadow-xl rounded-2xl bg-card">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 mb-4 shadow-inner">
              <LogIn className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              Sign In to Your Profile
            </h2>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Sign in to manage your account details, phone verification, security preferences, and view your complete order history.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <Button
                size="lg"
                className="w-full rounded-xl font-bold shadow-md gap-2"
                onClick={() =>
                  navigate({ to: '/login', search: { redirect: '/profile' } })
                }
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In to Continue</span>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full rounded-xl"
              >
                <Link to="/signup" search={{ redirect: '/profile' }}>
                  Create a Free Account
                </Link>
              </Button>
            </div>
          </Card>
        )}

        {/* Authenticated Profile Content */}
        {!isSessionPending && user && (
          <div className="space-y-8">
            {/* The Best Profile Card */}
            <div className="relative rounded-3xl border border-border/80 bg-card text-card-foreground shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl">
              {/* Decorative Banner Ribbon */}
              <div className="h-32 sm:h-36 w-full bg-gradient-to-r from-amber-500/25 via-primary/20 to-orange-500/25 border-b border-border/40 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-400/20 via-transparent to-transparent opacity-80 pointer-events-none" />
                <div className="absolute right-4 top-4 flex items-center gap-2">
                </div>
              </div>

              {/* Profile Card Body */}
              <div className="px-6 sm:px-8 pb-8 pt-0 relative">
                {/* Avatar & Main Identity Row */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 -mt-14 sm:-mt-16 mb-6">
                  <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
                    {/* Profile Picture with Change Photo Trigger */}
                    <div
                      className="relative group cursor-pointer"
                      onClick={() => setIsChangePhotoOpen(true)}
                      title="Click to change profile picture"
                    >
                      <Avatar className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-card shadow-2xl ring-2 ring-primary/40 bg-card overflow-hidden">
                        {user.image && (
                          <AvatarImage
                            src={user.image}
                            alt={user.name || 'Profile Picture'}
                            className="object-cover"
                          />
                        )}
                        <AvatarFallback className="bg-gradient-to-tr from-amber-500 to-amber-600 text-white font-extrabold text-2xl sm:text-3xl shadow-inner">
                          {initials}
                        </AvatarFallback>
                      </Avatar>

                      {/* Hover Overlay with Camera Icon */}
                      <div className="absolute inset-0 rounded-full bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                        <Camera className="h-5 w-5 drop-shadow" />
                        <span className="text-[9px] font-semibold mt-0.5 tracking-tight">Change</span>
                      </div>

                      {/* Quick Edit Camera Button at Bottom Right */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setIsChangePhotoOpen(true)
                        }}
                        className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center border-2 border-card hover:scale-110 active:scale-95 transition-transform"
                        title="Change profile picture"
                        aria-label="Change profile picture"
                      >
                        <Camera className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Name & Basic Details */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                          {user.name || 'Valued Customer'}
                        </h1>
                      </div>
                      <p className="truncate text-sm font-semibold text-foreground font-mono">
                        {(user as any).phone ? ` ${(user as any).phone}` : 'No phone linked'}
                      </p>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center justify-center gap-2.5 pt-2 sm:pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsChangePasswordOpen(true)}
                      className="rounded-xl font-medium gap-1.5 shadow-sm hover:border-primary/50 transition-all text-xs"
                    >
                      <KeyRound className="h-3.5 w-3.5 text-primary" />
                      <span>Change Password</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSignOutConfirmOpen(true)}
                      className="rounded-xl font-medium text-destructive hover:bg-destructive/10 hover:border-destructive/40 transition-all text-xs gap-1.5 shadow-sm"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Logout</span>
                    </Button>
                  </div>
                </div>

                <Separator className="my-6 opacity-60" />

                {/* Contact Information Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Email Section */}
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 sm:p-5 flex items-start gap-4 transition-all hover:bg-muted/50 hover:border-border">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-sm mt-0.5">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Email Address
                        </span>
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px] px-2 py-0.5 font-medium gap-1"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Verified
                        </Badge>
                      </div>
                      <p className="truncate text-sm font-semibold text-foreground font-mono">
                        {user.email || 'No email registered'}
                      </p>
                      
                    </div>
                  </div>

                  {/* Phone Section (With Pencil Edit Icon!) */}
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 sm:p-5 flex items-start gap-4 transition-all hover:bg-muted/50 hover:border-border group/phone">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm mt-0.5">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Mobile Number
                        </span>

                        <div className="flex items-center gap-1.5">
                          {(user as any).phoneVerified ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px] px-2 py-0.5 font-medium gap-1"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              OTP Verified
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[10px] px-2 py-0.5 font-medium"
                            >
                              Pending Verification
                            </Badge>
                          )}

                          {/* Top Pencil Icon to Edit Phone Number */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsEditPhoneOpen(true)}
                            className="h-7 w-7 rounded-lg text-primary hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Edit and verify phone number"
                            aria-label="Edit mobile number"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground font-mono">
                          {(user as any).phone ? `+977 ${(user as any).phone}` : 'No phone linked'}
                        </p>
                        
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Statistics & Summary Table Section */}
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                    <span>Orders & Purchase Summary</span>
                  </h2>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-xl self-start sm:self-auto text-xs font-semibold gap-1.5 border-border shadow-sm hover:border-primary/50"
                >
                  <Link to="/orders">
                    <span>View All Orders</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>

              {/* 4 Metric Highlight Cards: 2 on Mobile View, 4 in One Row on PC View */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 min-w-0 w-full">
                {/* 1. Total Orders */}
                <Card className="rounded-2xl border-border/80 shadow-sm hover:shadow-md bg-card transition-all p-3.5 sm:p-4 lg:p-5 flex flex-col justify-between min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5 sm:space-y-1 min-w-0">
                      <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                        Total Orders
                      </p>
                      <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-foreground tracking-tight">
                        {isOrdersLoading ? (
                          <Skeleton className="h-7 sm:h-9 w-10 sm:w-12" />
                        ) : (
                          stats.total
                        )}
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
                        All-time orders
                      </p>
                    </div>
                    <div className="h-8 w-8 sm:h-9 sm:w-9 lg:h-11 lg:w-11 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shadow-inner shrink-0">
                      <Package className="h-4 w-4 sm:h-4 sm:w-4 lg:h-5 lg:w-5" />
                    </div>
                  </div>
                </Card>

                {/* 2. In Progress Orders (Light Blue Color & Real Value!) */}
                <Card className="rounded-2xl border-sky-500/25 bg-card hover:border-sky-500/40 shadow-sm hover:shadow-md transition-all p-3.5 sm:p-4 lg:p-5 flex flex-col justify-between min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5 sm:space-y-1 min-w-0">
                      <p className="text-[10px] sm:text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider truncate">
                        In Progress
                      </p>
                      <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-sky-600 dark:text-sky-400 tracking-tight">
                        {isOrdersLoading ? (
                          <Skeleton className="h-7 sm:h-9 w-10 sm:w-12" />
                        ) : (
                          stats.inProgress
                        )}
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-sky-600/80 dark:text-sky-400/80 truncate">
                        Active deliveries
                      </p>
                    </div>
                    <div className="h-8 w-8 sm:h-9 sm:w-9 lg:h-11 lg:w-11 rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/25 flex items-center justify-center shadow-inner shrink-0">
                      <Clock className="h-4 w-4 sm:h-4 sm:w-4 lg:h-5 lg:w-5" />
                    </div>
                  </div>
                </Card>

                {/* 3. Successful Orders */}
                <Card className="rounded-2xl border-border/80 hover:border-emerald-500/30 shadow-sm hover:shadow-md bg-card transition-all p-3.5 sm:p-4 lg:p-5 flex flex-col justify-between min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5 sm:space-y-1 min-w-0">
                      <p className="text-[10px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider truncate">
                        Successful
                      </p>
                      <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                        {isOrdersLoading ? (
                          <Skeleton className="h-7 sm:h-9 w-10 sm:w-12" />
                        ) : (
                          stats.successful
                        )}
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-emerald-600/80 dark:text-emerald-400/80 truncate">
                        {stats.total > 0 ? `${stats.successRate}% completion` : 'Delivered'}
                      </p>
                    </div>
                    <div className="h-8 w-8 sm:h-9 sm:w-9 lg:h-11 lg:w-11 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shadow-inner shrink-0">
                      <CheckCircle2 className="h-4 w-4 sm:h-4 sm:w-4 lg:h-5 lg:w-5" />
                    </div>
                  </div>
                </Card>

                {/* 4. Cancelled Orders */}
                <Card className="rounded-2xl border-border/80 hover:border-destructive/30 shadow-sm hover:shadow-md bg-card transition-all p-3.5 sm:p-4 lg:p-5 flex flex-col justify-between min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5 sm:space-y-1 min-w-0">
                      <p className="text-[10px] sm:text-xs font-semibold text-destructive uppercase tracking-wider truncate">
                        Cancelled
                      </p>
                      <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-destructive tracking-tight">
                        {isOrdersLoading ? (
                          <Skeleton className="h-7 sm:h-9 w-10 sm:w-12" />
                        ) : (
                          stats.cancelled
                        )}
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-destructive/80 truncate">
                        Cancelled orders
                      </p>
                    </div>
                    <div className="h-8 w-8 sm:h-9 sm:w-9 lg:h-11 lg:w-11 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-center shadow-inner shrink-0">
                      <XCircle className="h-4 w-4 sm:h-4 sm:w-4 lg:h-5 lg:w-5" />
                    </div>
                  </div>
                </Card>
              </div>

              
    
            </div>
          </div>
        )}
      </main>


      {/* Edit Phone Number Dialog with OTP */}
      <EditPhoneDialog
        open={isEditPhoneOpen}
        onOpenChange={setIsEditPhoneOpen}
        currentPhone={(user as any)?.phone}
        onSuccess={handlePhoneUpdated}
      />

      {/* Change Profile Photo Dialog */}
      <ChangePhotoDialog
        open={isChangePhotoOpen}
        onOpenChange={setIsChangePhotoOpen}
        currentImage={user?.image}
        userName={user?.name}
        onSuccess={handlePhotoUpdated}
      />

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={isChangePasswordOpen}
        onOpenChange={setIsChangePasswordOpen}
        userEmail={user?.email}
        userName={user?.name}
      />

      {/* Sign Out Confirmation Dialog */}
      <ConfirmDialog
        open={isSignOutConfirmOpen}
        onOpenChange={setIsSignOutConfirmOpen}
        title="Sign Out of Mezmani?"
        description="Are you sure you want to sign out? You will need your login credentials to sign back in."
        confirmLabel="Sign Out"
        tone="destructive"
        isLoading={isSigningOut}
        icon={<LogOut className="h-5 w-5 text-destructive" />}
        onConfirm={handleSignOut}
      />
    </div>
  )
}
