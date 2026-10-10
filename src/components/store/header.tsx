import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useCart } from '#/lib/cart-context'
import { authClient } from '#/lib/auth-client'
import { toast } from 'sonner'
import {
  Menu,
  PhoneCall,
  User,
  LogOut,
  Search,
  ShoppingCart,
  Shield,
} from 'lucide-react'
import { ThemeToggle } from '#/components/shared/theme-toggle'
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
  const navigate = useNavigate()

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
      setMobileMenuOpen(false)
      toast.success('Signed out successfully')
      navigate({ to: '/' })
    } catch {
      toast.error('Failed to sign out')
    }
  }

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo & Brand */}
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="text-base font-semibold tracking-tight text-foreground"
          >
            MEZMANI
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-muted-foreground">
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
            <a href="/#reviews" className="hover:text-foreground transition-colors">
              Reviews
            </a>
            <a href="/#about" className="hover:text-foreground transition-colors">
              About
            </a>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Search bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden sm:flex relative w-44 md:w-56"
          >
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              value={searchVal}
              onChange={(e) => {
                setSearchVal(e.target.value)
                onSearch?.(e.target.value)
              }}
              placeholder="Search drinks or food..."
              className="h-8 pl-8 pr-3 text-xs"
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
                  className="gap-2 h-8 px-2 text-xs font-medium"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[10px]">
                      {session.user.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline max-w-[100px] truncate">
                    {session.user.name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 text-xs">
                <div className="px-2 py-1.5">
                  <p className="font-medium text-foreground truncate">
                    {session.user.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {session.user.email}
                  </p>
                  {session.user.role && (
                    <Badge variant="secondary" className="mt-1 text-[10px] capitalize">
                      {session.user.role}
                    </Badge>
                  )}
                </div>
                <DropdownMenuSeparator />
                {session.user.role === 'admin' && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="cursor-pointer">
                        <Shield className="h-3.5 w-3.5 mr-2" />
                        Admin Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <Link to="/login">
                <User className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign in</span>
              </Link>
            </Button>
          )}

          {/* Cart Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(true)}
            className="h-8 gap-1.5 px-3 text-xs"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cart</span>
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {itemCount}
            </span>
          </Button>

          {/* Mobile Sheet Nav */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 md:hidden text-muted-foreground"
                aria-label="Toggle navigation menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-6 flex flex-col justify-between">
              <div className="space-y-6">
                <SheetHeader className="text-left">
                  <SheetTitle className="text-sm font-semibold">MEZMANI</SheetTitle>
                </SheetHeader>

                <form onSubmit={handleSearchSubmit} className="relative w-full">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    value={searchVal}
                    onChange={(e) => setSearchVal(e.target.value)}
                    placeholder="Search catalog..."
                    className="h-8 pl-8 text-xs"
                  />
                </form>

                <nav className="flex flex-col space-y-3 text-xs font-medium">
                  <Link
                    to="/drinks"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-foreground hover:text-primary transition-colors py-1"
                  >
                    Drinks Catalog
                  </Link>
                  <Link
                    to="/grocery"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-foreground hover:text-primary transition-colors py-1"
                  >
                    Food &amp; Snacks
                  </Link>
                  <a
                    href="/#reviews"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    Reviews
                  </a>
                  <a
                    href="/#about"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    About Us
                  </a>
                  {session?.user.role === 'admin' && (
                    <Link
                      to="/admin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-primary font-semibold transition-colors py-1 flex items-center justify-between"
                    >
                      <span>Admin Portal</span>
                      <Badge variant="outline" className="text-[10px]">OPS</Badge>
                    </Link>
                  )}
                </nav>
              </div>

              <div className="pt-6 border-t border-border space-y-3">
                {session?.user ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground truncate max-w-[140px]">
                      {session.user.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSignOut}
                      className="h-7 text-xs text-destructive hover:text-destructive"
                    >
                      Sign out
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm" className="w-full text-xs">
                      <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                        Sign in
                      </Link>
                    </Button>
                    <Button asChild size="sm" className="w-full text-xs">
                      <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                        Sign up
                      </Link>
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2">
                  <a href="tel:+9779802088800" className="flex items-center gap-1 hover:text-foreground">
                    <PhoneCall className="h-3 w-3" />
                    <span>+977-9802088800</span>
                  </a>
                  <span>40m Delivery</span>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
