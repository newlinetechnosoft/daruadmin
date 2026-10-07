import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useCart } from '#/lib/cart-context'
import { authClient } from '#/lib/auth-client'
import { toast } from 'sonner'
import { Menu, X, PhoneCall, User, LogOut } from 'lucide-react'

export function Header({ onSearch }: { onSearch?: (query: string) => void }) {
  const { itemCount, setIsOpen } = useCart()
  const { data: session } = authClient.useSession()
  const [searchVal, setSearchVal] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
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
      setUserDropdownOpen(false)
      setMobileMenuOpen(false)
      toast.success('Signed out successfully')
      navigate({ to: '/' })
    } catch {
      toast.error('Failed to sign out')
    }
  }

  return (
    <header className="sticky top-0 z-50 h-[78px] bg-white/96 backdrop-blur-md border-b border-[#dedbd4]">
      <div className="w-[min(1220px,calc(100%-50px))] max-sm:w-[calc(100%-30px)] mx-auto h-full flex items-center justify-between">
        {/* LOGO */}
        <Link
          to="/"
          className="text-[21px] font-black tracking-[-0.07em] text-[#181818] uppercase"
        >
          MEZMANI
        </Link>

        {/* DESKTOP NAV LINKS */}
        <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-[#181818]">
          <Link
            to="/drinks"
            className="hover:opacity-50 transition-opacity"
            activeProps={{ className: 'font-bold' }}
          >
            Drinks
          </Link>
          <Link
            to="/grocery"
            className="hover:opacity-50 transition-opacity"
            activeProps={{ className: 'font-bold' }}
          >
            Food
          </Link>
          <a href="/#reviews" className="hover:opacity-50 transition-opacity">
            Reviews
          </a>
          <a href="/#about" className="hover:opacity-50 transition-opacity">
            About
          </a>
        </nav>

        {/* RIGHT ACTIONS */}
        <div className="flex items-center gap-3.5 max-sm:gap-2">
          {/* Quick search input (toggle or persistent) */}
          <form
            onSubmit={handleSearchSubmit}
            className={`transition-all duration-200 ${
              searchOpen
                ? 'flex items-center w-56 sm:w-72'
                : 'hidden md:flex md:w-44 lg:w-56'
            }`}
          >
            <div className="relative w-full">
              <input
                type="text"
                value={searchVal}
                onChange={(e) => {
                  setSearchVal(e.target.value)
                  onSearch?.(e.target.value)
                }}
                placeholder="Search drinks or food..."
                className="w-full h-9 pl-3 pr-8 rounded-[3px] border border-[#dedbd4] bg-white text-xs text-[#181818] placeholder:text-[#999] focus:outline-none focus:border-[#171717]"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y/1/2 text-[#888] hover:text-[#171717] border-0 bg-transparent cursor-pointer text-xs"
              >
                ⌕
              </button>
            </div>
          </form>

          {/* Search Toggle button (mobile/tablet) */}
          <button
            type="button"
            onClick={() => setSearchOpen(!searchOpen)}
            className="md:hidden w-10 h-10 grid place-items-center border-0 bg-transparent text-[21px] text-[#181818] cursor-pointer"
            aria-label="Search"
          >
            ⌕
          </button>

          {/* User Auth Pill / Dropdown */}
          {session?.user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-2 max-sm:px-2 max-sm:py-1.5 rounded-full border border-[#dedbd4] bg-[#f8f5ef] text-xs font-semibold text-[#181818] hover:border-[#171717] transition-all cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-[#171717] text-[#d8ff38] text-[10px] font-bold grid place-items-center uppercase">
                  {session.user.name.charAt(0)}
                </div>
                <span className="hidden sm:inline max-w-[90px] truncate text-xs font-semibold">
                  {session.user.name}
                </span>
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-[#dedbd4] rounded-[4px] shadow-lg p-2 z-50 text-xs">
                  <div className="px-3 py-2 border-b border-[#f0eee9]">
                    <p className="font-bold text-[#181818] truncate">
                      {session.user.name}
                    </p>
                    <p className="text-[10px] text-[#777] truncate">
                      {session.user.email}
                    </p>
                    {session.user.role && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded-[2px] bg-[#f1f1ed] text-[9px] font-bold uppercase tracking-wider text-[#171717]">
                        {session.user.role}
                      </span>
                    )}
                    {session.user.role === 'admin' && (
                      <Link
                        to="/admin"
                        onClick={() => setUserDropdownOpen(false)}
                        className="w-full text-left px-3 py-2 text-[#181818] hover:bg-[#f8f5ef] rounded-[2px] font-semibold transition-colors flex items-center justify-between mt-1"
                      >
                        <span>Admin Portal</span>
                        <span className="text-[9px] font-mono px-1 rounded bg-[#d8ff38] text-black font-bold">
                          OPS
                        </span>
                      </Link>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 text-rose-600 hover:bg-[#f8f5ef] rounded-[2px] font-semibold transition-colors border-0 bg-transparent cursor-pointer flex items-center gap-1.5 mt-1"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-[#181818] hover:opacity-60 transition-opacity"
            >
              <User className="h-3.5 w-3.5" />
              <span>Sign in</span>
            </Link>
          )}

          {/* Carting Button (exact drinks.html style) */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="group flex items-center gap-[7px] px-4 py-2.5 max-sm:px-3 max-sm:py-2 border border-[#171717] rounded-full bg-white text-xs font-semibold text-[#181818] hover:bg-[#171717] hover:text-white transition-colors cursor-pointer"
          >
            <span>Cart</span>
            <span className="min-w-[19px] h-[19px] px-1 grid place-items-center rounded-full bg-[#171717] text-white text-[10px] font-bold group-hover:bg-white group-hover:text-[#171717] transition-colors">
              {itemCount}
            </span>
          </button>

          {/* Mobile hamburger menu */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-9 h-9 grid place-items-center border border-[#dedbd4] rounded-[4px] bg-white text-[#181818] cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* MOBILE MENU DROPDOWN */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#dedbd4] bg-white px-6 py-4 space-y-3 shadow-lg">
          <form onSubmit={handleSearchSubmit} className="relative w-full mb-3">
            <input
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Search drinks or food..."
              className="w-full h-10 pl-3 pr-8 rounded-[3px] border border-[#dedbd4] text-xs text-[#181818]"
            />
            <button
              type="submit"
              className="absolute right-3 top-1/2 -translate-y/1/2 text-sm text-[#888]"
            >
              ⌕
            </button>
          </form>

          {/* Mobile User Section */}
          <div className="pb-2 border-b border-[#f0eee9]">
            {session?.user ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#181818]">
                    {session.user.name}
                  </p>
                  <p className="text-[10px] text-[#777]">
                    {session.user.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-xs text-rose-600 font-semibold border-0 bg-transparent cursor-pointer"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-xs font-bold text-[#181818] hover:underline"
                >
                  Sign in
                </Link>
                <span className="text-[#aaa]">·</span>
                <Link
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-xs font-bold text-[#181818] hover:underline"
                >
                  Create account
                </Link>
              </div>
            )}
          </div>

          <nav className="flex flex-col gap-2.5 text-sm font-semibold text-[#181818]">
            {session?.user.role === 'admin' && (
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 border-b border-[#f0eee9] text-[#181818] flex items-center justify-between"
              >
                <span>Admin Operations Portal</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#d8ff38] text-black font-bold">
                  ADMIN
                </span>
              </Link>
            )}
            <Link
              to="/drinks"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 border-b border-[#f0eee9]"
            >
              Drinks Catalog
            </Link>
            <Link
              to="/grocery"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 border-b border-[#f0eee9]"
            >
              Food &amp; Munchies
            </Link>
            <a
              href="/#reviews"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 border-b border-[#f0eee9]"
            >
              Customer Reviews
            </a>
            <a
              href="/#about"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 border-b border-[#f0eee9]"
            >
              About Mezmani
            </a>
          </nav>

          <div className="pt-2 text-xs text-[#777] flex items-center justify-between">
            <a
              href="tel:+9779802088800"
              className="flex items-center gap-1 font-semibold text-[#181818]"
            >
              <PhoneCall className="h-3 w-3" /> +977-9802088800
            </a>
            <span className="font-bold text-[#181818]">40 MIN DELIVERY</span>
          </div>
        </div>
      )}
    </header>
  )
}
