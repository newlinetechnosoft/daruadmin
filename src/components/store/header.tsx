import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { StoreCountdownTimer } from '#/components/store/countdown-timer'
import {
  Bike,
  Clock,
  Heart,
  LogOut,
  Menu,
  Search,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UserRound,
  KeyRound,
} from 'lucide-react'
import { ChangePasswordDialog } from '#/components/auth/change-password-dialog'
import { toast } from 'sonner'

import { useCart } from '#/lib/cart-context'
import { authClient } from '#/lib/auth-client'
import { clearAllLocalData } from '#/lib/idb'
import { ThemeToggle } from '#/components/shared/theme-toggle'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
import { storeQueries } from '#/queries/admin'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '#/components/ui/sheet'

export function Header({ onSearch }: { onSearch?: (query: string) => void }) {
  const { itemCount, setIsOpen } = useCart()
  const { data: session } = authClient.useSession()
  const [searchVal, setSearchVal] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()

  const user = session?.user
  const firstName = user?.name?.trim().split(' ')[0]
  const isStaff = user?.role === 'admin' || user?.role === 'manager'
  const isRider = user?.role === 'rider'

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = searchVal.trim()
    if (!query) return

    if (onSearch) {
      onSearch(query)
    } else {
      navigate({ to: '/drinks', search: { query } })
    }

    setMobileMenuOpen(false)
  }

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
      await clearAllLocalData()
      queryClient.clear()
      await router.invalidate()
      setMobileMenuOpen(false)
      toast.success("You're signed out. See you soon!")
      navigate({ to: '/' })
    } catch {
      toast.error("We couldn't sign you out. Please try again.")
    }
  }

  const { data: storeStatus } = useQuery(storeQueries.operatingStatus())

  const navLinkClass =
    'relative py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&.active]:text-foreground'

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      {storeStatus?.showNotice && !storeStatus?.isOpen && (
        <div className="hidden md:block w-full bg-amber-500/15 border-b border-amber-500/30 px-3 sm:px-6 py-2 text-xs text-amber-950 dark:text-amber-200 transition-colors">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start flex-wrap">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              <span className="font-medium text-xs sm:text-sm">
                Mezmani is currently closed for immediate delivery. Place your order now and it will be delivered after reopening!
              </span>
            </div>
            <div className="shrink-0 flex items-center justify-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/25 border border-amber-500/40 text-amber-950 dark:text-amber-200 font-mono shadow-xs">
                <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Opens: {storeStatus.nextOpeningFormatted || 'Tomorrow at 10:00 AM'}</span>
              </span>
              <StoreCountdownTimer
                targetDateTime={storeStatus.nextOpeningDateTime}
                fallbackFormatted={storeStatus.nextOpeningFormatted}
                variant="header-badge"
              />
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto flex h-14 sm:h-16 lg:h-[4.25rem] max-w-7xl items-center justify-between gap-3 sm:gap-4 px-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex gap-4">
          <Link
            to="/"
            aria-label="Mezmani home"
            className="flex shrink-0 items-center"
          >
            {/* Light Theme Logo */}
            <img
              src="https://mezmani.com/mezmani_logo.webp"
              onError={(e) => {
                const target = e.currentTarget
                if (target.src !== `${window.location.origin}/mezmani_logo.webp`) {
                  target.src = '/mezmani_logo.webp'
                }
              }}
              alt="Mezmani"
              width="156"
              height="48"
              className="h-7 sm:h-8 lg:h-9 w-auto object-contain dark:hidden"
            />
            {/* Dark Theme Logo */}
            <img
              src="https://mezmani.com/mezmani_logo_bg.svg"
              onError={(e) => {
                const target = e.currentTarget
                if (target.src !== `${window.location.origin}/mezmani_logo_bg.svg`) {
                  target.src = '/mezmani_logo_bg.svg'
                }
              }}
              alt="Mezmani"
              width="156"
              height="48"
              className="h-7 sm:h-8 lg:h-9 w-auto object-contain hidden dark:block"
            />
          </Link>

          {/* Primary navigation */}
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-7 lg:flex"
          >
            <Link to="/drinks" className={navLinkClass}>
              Drinks
            </Link>
            <Link to="/food" className={navLinkClass}>
              Food
            </Link>
          </nav>
        </div>

        {/* Search and desktop actions */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <form
            onSubmit={handleSearchSubmit}
            role="search"
            className="relative hidden w-48 xl:block"
          >
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={searchVal}
              onChange={(event) => {
                setSearchVal(event.target.value)
                onSearch?.(event.target.value)
              }}
              placeholder="Search Mezmani"
              aria-label="Search drinks and food"
              className="h-10 rounded-full border-border/70 bg-muted/50 pl-9 text-sm placeholder:text-muted-foreground/80 focus-visible:bg-background"
            />
          </form>

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          <Button
            asChild
            variant="ghost"
            size="icon"
            className="hidden h-10 w-10 rounded-full text-muted-foreground hover:text-foreground sm:inline-flex"
            aria-label="Your favorites"
          >
            <Link to="/favorites">
              <Heart className="h-[18px] w-[18px]" />
            </Link>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 gap-2 rounded-full px-2.5"
                  aria-label="Open account menu"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/15 text-xs font-semibold text-foreground">
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-24 truncate text-sm font-medium md:inline">
                    {firstName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <div className="px-3 py-2.5">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                  {user.role && user.role !== 'customer' && (
                    <Badge variant="secondary" className="mt-2 text-[10px] capitalize">
                      {user.role}
                    </Badge>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/orders">
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    My orders
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/track">
                    <Truck className="mr-2 h-4 w-4" />
                    Track by code
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/favorites">
                    <Heart className="mr-2 h-4 w-4" />
                    My favorites
                  </Link>
                </DropdownMenuItem>
                {isStaff && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/admin">
                        <Shield className="mr-2 h-4 w-4" />
                        Admin dashboard
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                {isRider && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/rider">
                        <Bike className="mr-2 h-4 w-4" />
                        My deliveries
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setShowChangePassword(true)}
                  className="cursor-pointer"
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  Change password
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setShowSignOutConfirm(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              asChild
              variant="ghost"
              className="hidden h-10 rounded-full px-3 text-sm sm:inline-flex"
            >
              <Link to="/login">
                <UserRound className="mr-1.5 h-4 w-4" />
                Sign in
              </Link>
            </Button>
          )}

          {/* Cart is the primary action */}
          <Button
            onClick={() => setIsOpen(true)}
            className="relative h-9 sm:h-10 gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-3.5 font-semibold shadow-xs"
            aria-label={
              itemCount > 0
                ? `Open your cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
                : 'Open your cart'
            }
          >
            <ShoppingCart className="h-[17px] w-[17px]" />
            <span className="hidden sm:inline">Cart</span>
            {itemCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1 text-[10px] font-bold leading-none text-foreground">
                {itemCount}
              </span>
            )}
          </Button>

          {/* Mobile navigation */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-full lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-[18px] w-[18px]" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-[min(22rem,90vw)] flex-col p-0">
              <div className="border-b border-border px-6 py-5">
                <div className="mb-4 flex items-center justify-between pr-8">
                  <Link
                    to="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center focus-visible:outline-none"
                    aria-label="Mezmani home"
                  >
                    <img
                      src="https://mezmani.com/mezmani_logo.webp"
                      onError={(e) => {
                        const target = e.currentTarget
                        if (target.src !== `${window.location.origin}/mezmani_logo.webp`) {
                          target.src = '/mezmani_logo.webp'
                        }
                      }}
                      alt="Mezmani"
                      width="140"
                      height="42"
                      className="h-7 w-auto object-contain dark:hidden"
                    />
                    <img
                      src="https://mezmani.com/mezmani_logo_bg.svg"
                      onError={(e) => {
                        const target = e.currentTarget
                        if (target.src !== `${window.location.origin}/mezmani_logo_bg.svg`) {
                          target.src = '/mezmani_logo_bg.svg'
                        }
                      }}
                      alt="Mezmani"
                      width="140"
                      height="42"
                      className="h-7 w-auto object-contain hidden dark:block"
                    />
                  </Link>

                  <div className="flex items-center gap-1.5">
                    <ThemeToggle variant="outline" className="h-9 w-9 rounded-full" />
                  </div>
                </div>

                <SheetHeader className="text-left">
                  <SheetTitle className="text-lg">
                    {firstName ? `Hey, ${firstName}` : 'Welcome to Mezmani'}
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    Good food. Great drinks. Delivered.
                  </p>
                </SheetHeader>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <form onSubmit={handleSearchSubmit} role="search" className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    value={searchVal}
                    onChange={(event) => setSearchVal(event.target.value)}
                    placeholder="What are you craving?"
                    aria-label="Search drinks and food"
                    className="h-11 rounded-xl bg-muted/50 pl-9"
                  />
                </form>

                <nav aria-label="Mobile navigation" className="space-y-1">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Explore
                  </p>
                  <Link
                    to="/drinks"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    Drinks <span className="text-muted-foreground">→</span>
                  </Link>
                  <Link
                    to="/food"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    Food & snacks <span className="text-muted-foreground">→</span>
                  </Link>
                  <Link
                    to="/track"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    Track an order <span className="text-muted-foreground">→</span>
                  </Link>
                </nav>

                <div className="space-y-1 border-t border-border pt-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Your account
                  </p>
                  {user ? (
                    <>
                      <Link
                        to="/orders"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-muted"
                      >
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                        My orders
                      </Link>
                      <Link
                        to="/favorites"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-muted"
                      >
                        <Heart className="h-4 w-4 text-muted-foreground" />
                        My favorites
                      </Link>
                      {isStaff && (
                        <Link
                          to="/admin"
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-primary hover:bg-muted"
                        >
                          <Shield className="h-4 w-4" />
                          Admin dashboard
                        </Link>
                      )}
                      {isRider && (
                        <Link
                          to="/rider"
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-primary hover:bg-muted"
                        >
                          <Bike className="h-4 w-4" />
                          My deliveries
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false)
                          setShowChangePassword(true)
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-muted text-left text-foreground"
                      >
                        <KeyRound className="h-4 w-4 text-muted-foreground" />
                        Change password
                      </button>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button asChild variant="outline" className="rounded-xl">
                        <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                          Sign in
                        </Link>
                      </Button>
                      <Button asChild className="rounded-xl">
                        <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                          Create account
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 border-t border-border px-6 py-5">
                {user && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Signed in as</p>
                      <p className="truncate text-sm font-semibold">{user.name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMobileMenuOpen(false)
                        setShowSignOutConfirm(true)
                      }}
                      className="shrink-0 text-destructive hover:text-destructive"
                    >
                      <LogOut className="mr-1.5 h-4 w-4" />
                      Sign out
                    </Button>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <a href="tel:+9779847820683" className="text-xs text-muted-foreground hover:text-foreground">
                    Need help? +977-9847820683
                  </a>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Theme</span>
                    <ThemeToggle />
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <ConfirmDialog
        open={showSignOutConfirm}
        onOpenChange={setShowSignOutConfirm}
        title="Sign out of Mezmani?"
        description="Are you sure you want to sign out? You will need to sign in again to view your past orders."
        confirmLabel="Sign out"
        tone="destructive"
        icon={<LogOut className="h-5 w-5 text-destructive" />}
        onConfirm={handleSignOut}
      />

      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
        userName={user?.name}
        userEmail={user?.email}
      />
    </header>
  )
}
