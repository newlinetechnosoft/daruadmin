import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useCart } from '#/lib/cart-context'
import { Menu, X, PhoneCall } from 'lucide-react'

export function Header({ onSearch }: { onSearch?: (query: string) => void }) {
  const { itemCount, setIsOpen } = useCart()
  const [searchVal, setSearchVal] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
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

  return (
    <header className="sticky top-0 z-50 h-[78px] bg-white/96 backdrop-blur-md border-b border-[#dedbd4]">
      <div className="w-[min(1220px,calc(100%-50px))] max-sm:w-[calc(100%-30px)] mx-auto h-full flex items-center justify-between">
        {/* LOGO */}
        <Link
          to="/"
          className="text-[21px] font-black tracking-[-0.07em] text-[#181818] uppercase"
        >
          BARMANDOO
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
                : 'hidden md:flex md:w-48 lg:w-60'
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

          <nav className="flex flex-col gap-2.5 text-sm font-semibold text-[#181818]">
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
              Food & Munchies
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
              About Barmandoo
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
