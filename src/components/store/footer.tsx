import { Link, useRouterState } from '@tanstack/react-router'
import { Facebook, Instagram, Mail, MapPin, Phone } from 'lucide-react'
import { useStoreSettings } from '#/lib/use-store-settings'
import { cn } from '#/lib/utils'

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M19.6 7.2a5.8 5.8 0 0 1-3.9-1.5v8.1a6.2 6.2 0 1 1-5.3-6.1v3.4a2.8 2.8 0 1 0 1.9 2.7V2.5h3.4c.2 2.2 1.8 4 3.9 4.3v.4Z" />
    </svg>
  )
}

const SOCIALS = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/profile.php?id=61596202793413',
    icon: Facebook,
    hover: 'hover:border-[#1877F2]/60 hover:bg-[#1877F2]/10 hover:text-[#1877F2]',
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/mezmani_/',
    icon: Instagram,
    hover: 'hover:border-[#E4405F]/60 hover:bg-[#E4405F]/10 hover:text-[#E4405F]',
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@mezmani1',
    icon: TikTokIcon,
    hover: 'hover:border-white/50 hover:bg-white/10 hover:text-white',
  },
] as const

const PAYMENTS = ['eSewa', 'Khalti', 'fonepay', 'ConnectIPS', 'COD'] as const

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar'

const linkClass =
  'w-fit text-sm text-sidebar-foreground/70 transition-colors hover:text-sidebar-primary focus-visible:text-sidebar-primary focus-visible:outline-none'

const iconBubble =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors'

const digits = (value: string) => value.replace(/[^0-9+]/g, '')

interface FooterProps {
  className?: string
  forceVisibleOnMobile?: boolean
}

export function Footer({ className, forceVisibleOnMobile }: FooterProps = {}) {
  const storeSettings = useStoreSettings()

  const pathname = useRouterState({
    select: (s) => s.location?.pathname || '/',
  })

  // Visible on mobile only on the landing page; always visible from md up.
  const isLandingPage = pathname === '/' || pathname === ''
  const isMobileHidden = !isLandingPage && !forceVisibleOnMobile

  const storeName = storeSettings?.storeName || 'Mezmani'
  const legalName = (
    storeSettings?.legalName || 'Mezmani Retail Pvt. Ltd.'
  ).replace(/\.+$/, '')
  const tagline =
    storeSettings?.tagline ||
    'Good food, great drinks, delivered to your doorstep. Serving Butwal and Tilottama.'
  const address = storeSettings?.address || 'Traffic Chowk, Butwal'
  const city = storeSettings?.city || 'Butwal'
  const phone = storeSettings?.phone || '+977-9800000000'
  const supportPhone = storeSettings?.supportPhone || phone
  const secondaryPhone = storeSettings?.secondaryPhone || ''
  const email = storeSettings?.email || 'ops@mezmani.com.np'

  // Don't print the city twice when the address already contains it.
  const fullAddress = address.toLowerCase().includes(city.toLowerCase())
    ? address
    : `${address}, ${city}`
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`

  const phones = [supportPhone, secondaryPhone].filter(Boolean)

  return (
    <footer
      id="about"
      className={cn(
        'relative isolate scroll-mt-24 overflow-hidden border-t border-sidebar-border bg-sidebar text-sidebar-foreground',
        isMobileHidden && 'hidden md:block',
        className,
      )}
    >
      {/* Soft glow + hairline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 left-1/2 -z-10 h-56 w-[40rem] max-w-[120%] -translate-x-1/2 rounded-full bg-sidebar-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sidebar-primary/50 to-transparent"
      />

      {/*
        Mobile bottom padding keeps the last line clear of the floating bottom
        nav (63px bar + 12px offset + safe area). Remove if your layout already
        reserves that space.
      */}
      <div className="mx-auto max-w-7xl px-5 pt-10 pb-[calc(6.25rem+env(safe-area-inset-bottom,0px))] sm:px-6 md:pt-12 md:pb-6 lg:px-8">
        <div className="grid items-start gap-x-10 gap-y-8 md:grid-cols-12">
          {/* ------------------------------ Brand ------------------------------ */}
          <div className="md:col-span-7 lg:col-span-4">
            <Link
              to="/"
              className={cn('block w-full rounded-2xl sm:w-fit', focusRing)}
              aria-label={`${storeName} home`}
            >
              <img
                src="https://mezmani.com/mezmani_logo_bg.svg"
                onError={(e) => {
                  const target = e.currentTarget
                  if (
                    target.src !== `${window.location.origin}/mezmani_logo_bg.svg`
                  ) {
                    target.src = '/mezmani_logo_bg.svg'
                  }
                }}
                alt={storeName}
                width="190"
                height="80"
                loading="lazy"
                decoding="async"
                className="h-auto w-full rounded-2xl sm:w-44"
              />
            </Link>

            <p className="mt-3 max-w-sm text-sm leading-relaxed text-sidebar-foreground/70">
              {tagline}
            </p>

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
              <div className="grid grid-cols-2 gap-2.5 sm:flex">
                <Link
                  to="/drinks"
                  preload="intent"
                  className={cn(
                    'inline-flex h-10 items-center justify-center rounded-full bg-sidebar-primary px-5 text-sm font-semibold text-sidebar-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.98]',
                    focusRing,
                  )}
                >
                  Order drinks
                </Link>
                <Link
                  to="/food"
                  preload="intent"
                  className={cn(
                    'inline-flex h-10 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent/40 px-5 text-sm font-semibold text-sidebar-foreground transition-all hover:border-sidebar-primary/50 hover:text-sidebar-primary active:scale-[0.98]',
                    focusRing,
                  )}
                >
                  Order food
                </Link>
              </div>

              <div className="flex items-center gap-2">
                {SOCIALS.map(({ label, href, icon: Icon, hover }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent/30 text-sidebar-foreground/75 transition-all active:scale-95',
                      focusRing,
                      hover,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* ------------------------------ Links ------------------------------ */}
          <div className="grid grid-cols-2 gap-6 md:col-span-5 lg:col-span-3 lg:pt-1">
            <nav aria-label="Explore" className="flex flex-col gap-2.5">
              <h4 className="text-sm font-semibold text-sidebar-foreground">
                Explore
              </h4>
              <Link to="/drinks" preload="intent" className={linkClass}>
                Drinks
              </Link>
              <Link to="/food" preload="intent" className={linkClass}>
                Food
              </Link>
              <a href="/#reviews" className={linkClass}>
                Reviews
              </a>
            </nav>

            <nav aria-label="Company" className="flex flex-col gap-2.5">
              <h4 className="text-sm font-semibold text-sidebar-foreground">
                Company
              </h4>
              <a href="/#about" className={linkClass}>
                About us
              </a>
              <a href="/#about" className={linkClass}>
                Delivery areas
              </a>
              <Link to="/privacy" preload="intent" className={linkClass}>
                Privacy Policy
              </Link>
              <a href={`tel:${digits(phone)}`} className={linkClass}>
                Contact us
              </a>
            </nav>
          </div>

          {/* ----------------------------- Support ----------------------------- */}
          <div className="md:col-span-12 lg:col-span-5">
            <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/30 p-4 sm:p-5">
              <h4 className="text-sm font-semibold text-sidebar-foreground">
                Need help with an order?
              </h4>
              <p className="mt-0.5 text-xs text-sidebar-foreground/60">
                We're happy to help.
              </p>

              <ul className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                {phones.length > 0 && (
                  <li className="flex items-center gap-3 md:col-span-2 lg:col-span-1">
                    <span className={cn(iconBubble, 'bg-sidebar-primary/15 text-sidebar-primary')}>
                      <Phone className="h-4 w-4" />
                    </span>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
                      {phones.map((num) => (
                        <a
                          key={num}
                          href={`tel:${digits(num)}`}
                          className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-sidebar-foreground transition-colors hover:text-sidebar-primary focus-visible:text-sidebar-primary focus-visible:outline-none sm:text-sm"
                        >
                          {num}
                        </a>
                      ))}
                    </div>
                  </li>
                )}

                {email && (
                  <li>
                    <a
                      href={`mailto:${email}`}
                      className="group flex items-center gap-3 focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          iconBubble,
                          'bg-sidebar-foreground/10 text-sidebar-foreground/80 group-hover:bg-sidebar-primary group-hover:text-sidebar-primary-foreground',
                        )}
                      >
                        <Mail className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 truncate text-sm text-sidebar-foreground/80 transition-colors group-hover:text-sidebar-primary">
                        {email}
                      </span>
                    </a>
                  </li>
                )}

                <li>
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 focus-visible:outline-none"
                  >
                    <span
                      className={cn(
                        iconBubble,
                        'bg-sidebar-foreground/10 text-sidebar-foreground/80 group-hover:bg-sidebar-primary group-hover:text-sidebar-primary-foreground',
                      )}
                    >
                      <MapPin className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 text-sm text-sidebar-foreground/80 transition-colors group-hover:text-sidebar-primary">
                      {fullAddress}
                    </span>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* ------------------------------ Bottom bar ------------------------------ */}
        <div className="mt-8 flex flex-col gap-4 border-t border-sidebar-border pt-5 md:mt-10 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1 text-xs text-sidebar-foreground/60">
            <p className="flex flex-wrap items-center gap-x-2">
              <span>© {new Date().getFullYear()} {legalName}. All rights reserved.</span>
              <span className="hidden sm:inline">•</span>
              <Link
                to="/privacy"
                preload="intent"
                className="underline underline-offset-2 transition-colors hover:text-sidebar-primary"
              >
                Privacy Policy
              </Link>
            </p>
            <p className="text-[11px] text-sidebar-foreground/50">
              Develop By:{' '}
              <a
                href="https://www.facebook.com/NewLinetechnosoft/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 transition-colors hover:text-sidebar-primary"
              >
                NewLine Technosoft
              </a>
            </p>
          </div>

          <div className="flex flex-col gap-2 md:items-end">
            <ul
              aria-label="Accepted payment methods"
              className="flex flex-wrap items-center gap-1.5 md:justify-end"
            >
              {PAYMENTS.map((name) => (
                <li
                  key={name}
                  className="rounded-md border border-sidebar-border bg-sidebar-accent/30 px-2.5 py-1 text-[11px] font-semibold text-sidebar-foreground/80"
                >
                  {name}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-sidebar-foreground/50">
              Please drink responsibly. 18+ verification required.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}