import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useCart } from '#/lib/cart-context'
import { authClient } from '#/lib/auth-client'
import { clearAllLocalData } from '#/lib/idb'
import { toast } from 'sonner'
import {
  Menu,
  PhoneCall,
  User,
  LogOut,
  Search,
  ShoppingCart,
  Shield,
  Bike,
  Heart,
  Truck,
  ShoppingBag,
} from 'lucide-react'
import { ThemeToggle } from '#/components/shared/theme-toggle'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Badge } from '#/components/ui/badge'
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
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()

  const firstName = session?.user?.name?.trim().split(' ')[0]
  const isStaff =
    session?.user?.role === 'admin' || session?.user?.role === 'manager'
  const isRider = session?.user?.role === 'rider'

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (onSearch) {
      onSearch(searchVal)
    } else if (searchVal.trim()) {
      navigate({
        to: '/drinks',
        search: { query: searchVal.trim() },
      })
    }
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

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo & Brand */}
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            MEZMANI
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link
              to="/drinks"
              className="hover:text-foreground transition-colors"
              activeProps={{ className: 'text-foreground font-semibold' }}
            >
              Drinks
            </Link>
            <Link
              to="/grocery"
              className="hover:text-foreground transition-colors"
              activeProps={{ className: 'text-foreground font-semibold' }}
            >
              Food
            </Link>
            <Link
              to="/track"
              className="hover:text-foreground transition-colors flex items-center gap-1.5"
              activeProps={{ className: 'text-foreground font-semibold' }}
            >
              <Truck className="h-4 w-4 text-primary" />
              Track my order
            </Link>
            <a
              href="/#reviews"
              className="hover:text-foreground transition-colors"
            >
              Reviews
            </a>
            <a
              href="/#about"
              className="hover:text-foreground transition-colors"
            >
              About
            </a>
            {isStaff && (
              <Link
                to="/admin"
                className="hover:text-foreground transition-colors text-primary font-semibold"
                activeProps={{ className: 'text-foreground font-semibold' }}
              >
                Admin
              </Link>
            )}
            {isRider && (
              <Link
                to="/rider"
                className="hover:text-foreground transition-colors text-primary font-semibold flex items-center gap-1.5"
                activeProps={{ className: 'text-foreground font-semibold' }}
              >
                <Bike className="h-4 w-4" />
                Deliveries
              </Link>
            )}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Search bar */}
          <form
            onSubmit={handleSearchSubmit}
            role="search"
            className="hidden sm:flex relative w-48 md:w-64"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              value={searchVal}
              onChange={(e) => {
                setSearchVal(e.target.value)
                onSearch?.(e.target.value)
              }}
              placeholder="What are you craving?"
              aria-label="Search drinks and food"
              className="h-9 pl-9 pr-3 text-sm"
            />
          </form>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* User Profile / Auth */}
          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 h-9 px-2 text-sm font-medium"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {session.user.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline max-w-[120px] truncate">
                    Hi, {firstName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 text-sm">
                <div className="px-2 py-2">
                  <p className="font-medium text-foreground truncate">
                    {session.user.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {session.user.email}
                  </p>
                  {session.user.role && session.user.role !== 'customer' && (
                    <Badge
                      variant="secondary"
                      className="mt-1.5 text-[11px] capitalize"
                    >
                      {session.user.role}
                    </Badge>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/orders" className="cursor-pointer">
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    My orders
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/track" className="cursor-pointer">
                    <Truck className="h-4 w-4 mr-2" />
                    Where's my order?
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/favorites" className="cursor-pointer">
                    <Heart className="h-4 w-4 mr-2" />
                    My favorites
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {isStaff && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="cursor-pointer">
                        <Shield className="h-4 w-4 mr-2" />
                        Admin dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {isRider && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/rider" className="cursor-pointer">
                        <Bike className="h-4 w-4 mr-2" />
                        My deliveries
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onSelect={() => setShowSignOutConfirm(true)}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 text-sm"
            >
              <Link to="/login">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Sign in</span>
              </Link>
            </Button>
          )}

          {/* Favorites Link */}
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            aria-label="Your favorites"
          >
            <Link to="/favorites">
              <Heart className="h-[18px] w-[18px]" />
            </Link>
          </Button>

          {/* Cart Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(true)}
            aria-label={
              itemCount > 0
                ? `Open your cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
                : 'Open your cart'
            }
            className="h-9 gap-1.5 px-3 text-sm"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Cart</span>
            {itemCount > 0 && (
              <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {itemCount}
              </span>
            )}
          </Button>

          {/* Mobile Sheet Nav */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 md:hidden text-muted-foreground"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-80 p-6 flex flex-col justify-between"
            >
              <div className="space-y-6">
                <SheetHeader className="text-left">
                  <SheetTitle className="text-base font-semibold">
                    {firstName ? `Hi, ${firstName}` : 'Welcome to MEZMANI'}
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    Drinks and snacks, delivered to your door.
                  </p>
                </SheetHeader>

                <form
                  onSubmit={handleSearchSubmit}
                  role="search"
                  className="relative w-full"
                >
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    value={searchVal}
                    onChange={(e) => setSearchVal(e.target.value)}
                    placeholder="What are you craving?"
                    aria-label="Search drinks and food"
                    className="h-10 pl-9 text-sm"
                  />
                </form>

                <nav className="flex flex-col space-y-1 text-sm font-medium">
                  <Link
                    to="/drinks"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-foreground hover:text-primary transition-colors py-2"
                  >
                    Drinks
                  </Link>
                  <Link
                    to="/grocery"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-foreground hover:text-primary transition-colors py-2"
                  >
                    Food &amp; snacks
                  </Link>
                  <Link
                    to="/track"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-foreground hover:text-primary transition-colors py-2 flex items-center gap-2"
                  >
                    <Truck className="h-4 w-4 text-primary" />
                    Track my order
                  </Link>
                  {session?.user && (
                    <Link
                      to="/orders"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-foreground hover:text-primary transition-colors py-2 flex items-center gap-2"
                    >
                      <ShoppingBag className="h-4 w-4 text-primary" />
                      My orders
                    </Link>
                  )}
                  <Link
                    to="/favorites"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-foreground hover:text-primary transition-colors py-2 flex items-center gap-2"
                  >
                    <Heart className="h-4 w-4 text-primary" />
                    My favorites
                  </Link>
                  <a
                    href="/#reviews"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors py-2"
                  >
                    Reviews
                  </a>
                  <a
                    href="/#about"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors py-2"
                  >
                    About us
                  </a>
                  {isStaff && (
                    <Link
                      to="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-primary font-semibold transition-colors py-2 flex items-center gap-2"
                    >
                      <Shield className="h-4 w-4" />
                      Admin dashboard
                    </Link>
                  )}
                  {isRider && (
                    <Link
                      to="/rider"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-primary font-semibold transition-colors py-2 flex items-center gap-2"
                    >
                      <Bike className="h-4 w-4" />
                      My deliveries
                    </Link>
                  )}
                </nav>
              </div>

              <div className="pt-6 border-t border-border space-y-4">
                {session?.user ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate max-w-[160px]">
                      Signed in as{' '}
                      <span className="font-medium text-foreground">
                        {firstName}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMobileMenuOpen(false)
                        setShowSignOutConfirm(true)
                      }}
                      className="h-8 text-sm text-destructive hover:text-destructive"
                    >
                      Sign out
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full text-sm"
                    >
                      <Link
                        to="/login"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Sign in
                      </Link>
                    </Button>
                    <Button asChild size="sm" className="w-full text-sm">
                      <Link
                        to="/signup"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Create account
                      </Link>
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <a
                    href="tel:+9779802088800"
                    className="flex items-center gap-1.5 hover:text-foreground"
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                    <span>Call us: +977-9802088800</span>
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">
                  Most orders arrive in about 40 minutes.
                </p>
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
    </header>
  )
}
