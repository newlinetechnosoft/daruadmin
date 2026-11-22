import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Home, Wine, UtensilsCrossed, ShoppingBag, User } from 'lucide-react'
import { cn } from '#/lib/utils'

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

interface NavItem {
  id: string
  label: string
  to: string
  icon: typeof Home
  match: (pathname: string) => boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    to: '/',
    icon: Home,
    match: (p) => p === '/',
  },
  {
    id: 'drinks',
    label: 'Drinks',
    to: '/drinks',
    icon: Wine,
    match: (p) => p === '/drinks' || p.startsWith('/drinks/'),
  },
  {
    id: 'food',
    label: 'Food',
    to: '/food',
    icon: UtensilsCrossed,
    match: (p) => p === '/food' || p.startsWith('/food/'),
  },
  {
    id: 'orders',
    label: 'My Orders',
    to: '/orders',
    icon: ShoppingBag,
    match: (p) =>
      p === '/orders' || p.startsWith('/orders/') || p.startsWith('/track'),
  },
  {
    id: 'profile',
    label: 'Profile',
    to: '/profile',
    icon: User,
    match: (p) => p === '/profile' || p.startsWith('/profile/'),
  },
]

const COUNT = NAV_ITEMS.length
const BAR_HEIGHT = 55 // px, height of the bar itself
const INSET = 10 // px, horizontal padding inside the bar (keeps edge notches roomy)
const CORNER = 26 // px, outer corner radius
const GAP = 5 // px, ring between bubble and bar
const SLIDE_MS = 440

const useIsoLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

/* -------------------------------------------------------------------------- */
/*  Geometry                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * One continuous outline for the whole bar.
 *
 * The notch is a circular scoop (radius `rn`) centred on the top edge, so it is
 * perfectly concentric with the bubble and leaves an even ring around it.
 * Smooth shoulders blend the scoop into the flat top edge. Near the left/right
 * edges the shoulders and corner radius shrink automatically so the shape never
 * leaves the bar.
 */
function buildPath(W: number, H: number, cx: number | null, rn: number) {
  const R = CORNER

  // No active tab: plain rounded rectangle.
  if (cx === null || W <= 0) {
    return [
      `M 0 ${R}`,
      `A ${R} ${R} 0 0 1 ${R} 0`,
      `L ${W - R} 0`,
      `A ${R} ${R} 0 0 1 ${W} ${R}`,
      `L ${W} ${H - R}`,
      `A ${R} ${R} 0 0 1 ${W - R} ${H}`,
      `L ${R} ${H}`,
      `A ${R} ${R} 0 0 1 0 ${H - R}`,
      'Z',
    ].join(' ')
  }

  const theta = (35 * Math.PI) / 180
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)

  // Shoulder length, limited by the nearest edge.
  const f = Math.max(0, Math.min(16, cx - rn - 4, W - cx - rn - 4))

  const x1 = cx - rn - f // notch start (left)
  const x2 = cx + rn + f // notch end (right)

  // Points where the shoulder meets the circular scoop.
  const pLx = cx - rn * cos
  const pRx = cx + rn * cos
  const py = rn * sin

  const k = Math.max(4, (pLx - x1) * 0.55 + 2) // control handle length

  // Corner radii shrink if the notch is close to an edge.
  const rl = Math.max(1, Math.min(R, x1))
  const rr = Math.max(1, Math.min(R, W - x2))

  const f2 = (n: number) => Number(n.toFixed(2))

  return [
    `M 0 ${f2(rl)}`,
    `A ${f2(rl)} ${f2(rl)} 0 0 1 ${f2(rl)} 0`,
    `L ${f2(x1)} 0`,
    // left shoulder -> scoop
    `C ${f2(x1 + k)} 0 ${f2(pLx - sin * k)} ${f2(py - cos * k)} ${f2(pLx)} ${f2(py)}`,
    // scoop (concentric with bubble)
    `A ${f2(rn)} ${f2(rn)} 0 0 0 ${f2(pRx)} ${f2(py)}`,
    // scoop -> right shoulder
    `C ${f2(pRx + sin * k)} ${f2(py - cos * k)} ${f2(x2 - k)} 0 ${f2(x2)} 0`,
    `L ${f2(W - rr)} 0`,
    `A ${f2(rr)} ${f2(rr)} 0 0 1 ${f2(W)} ${f2(rr)}`,
    `L ${W} ${H - R}`,
    `A ${R} ${R} 0 0 1 ${W - R} ${H}`,
    `L ${R} ${H}`,
    `A ${R} ${R} 0 0 1 0 ${H - R}`,
    'Z',
  ].join(' ')
}

/* -------------------------------------------------------------------------- */
/*  Hooks                                                                     */
/* -------------------------------------------------------------------------- */

/** Measures an element's width and keeps it in sync on resize / rotation. */
function useElementWidth<T extends HTMLElement>(initial: number) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(initial)

  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const w = el.offsetWidth
      if (w > 0) setWidth(w)
    }
    measure()

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      return () => ro.disconnect()
    }
    window.addEventListener('resize', measure, { passive: true })
    return () => window.removeEventListener('resize', measure)
  }, [])

  return [ref, width] as const
}

/**
 * Animates a number toward `target` with JS (not CSS `transition: d`), so the
 * bar outline and the bubble move in perfect sync on every browser, including
 * Safari. Respects prefers-reduced-motion.
 */
function useAnimatedNumber(target: number | null) {
  const [value, setValue] = useState(target ?? 0)
  const current = useRef(value)

  useEffect(() => {
    if (target === null) return

    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const from = current.current

    if (reduce || Math.abs(from - target) < 0.5) {
      current.current = target
      setValue(target)
      return
    }

    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / SLIDE_MS)
      const eased = 1 - Math.pow(1 - t, 5) // easeOutQuint: fast start, long soft landing
      const next = from + (target - from) * eased
      current.current = next
      setValue(next)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return value
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const [navRef, navWidth] = useElementWidth<HTMLElement>(360)

  const isExcluded =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/superadmin') ||
    pathname.startsWith('/rider') ||
    pathname.startsWith('/api')

  const routeIndex = useMemo(
    () => NAV_ITEMS.findIndex((item) => item.match(pathname)),
    [pathname],
  )

  // Optimistic highlight on tap; cleared once the router finishes navigating.
  const [tappedIndex, setTappedIndex] = useState<number | null>(null)
  useEffect(() => setTappedIndex(null), [pathname])

  const activeIndex = tappedIndex ?? routeIndex
  const hasActive = activeIndex >= 0 && activeIndex < COUNT
  const ActiveIcon = hasActive ? NAV_ITEMS[activeIndex].icon : Home

  // Layout maths (all in px, derived from the measured width).
  const tabWidth = (navWidth - INSET * 2) / COUNT
  const bubbleSize = Math.round(Math.min(52, Math.max(42, tabWidth * 0.62)))
  const scoopRadius = bubbleSize / 2 + GAP

  const targetCx = hasActive ? INSET + (activeIndex + 0.5) * tabWidth : null
  const cx = useAnimatedNumber(targetCx)

  const path = useMemo(
    () => buildPath(navWidth, BAR_HEIGHT, hasActive ? cx : null, scoopRadius),
    [navWidth, cx, hasActive, scoopRadius],
  )

  if (isExcluded) return null

  return (
    <aside
      aria-label="Mobile navigation"
      className="pointer-events-none fixed inset-x-3 z-40 select-none sm:mx-auto sm:max-w-md md:hidden"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      <nav
        ref={navRef}
        className="pointer-events-auto relative w-full"
        style={{ height: BAR_HEIGHT }}
      >
        {/* Bar surface + border: one continuous path */}
        <svg
          aria-hidden="true"
          width={navWidth}
          height={BAR_HEIGHT}
          viewBox={`0 0 ${navWidth} ${BAR_HEIGHT}`}
          fill="none"
          className="pointer-events-none absolute inset-0 overflow-visible drop-shadow-[0_10px_28px_rgba(0,0,0,0.12)] dark:drop-shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
        >
          <path
            d={path}
            strokeWidth={1.5}
            strokeLinejoin="round"
            className="fill-card stroke-border"
          />
        </svg>

        {/* Floating bubble, centred on the top edge of the bar */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute z-20 flex items-center justify-center rounded-full bg-card shadow-md transition-opacity duration-300 ease-out',
            hasActive ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            width: bubbleSize,
            height: bubbleSize,
            left: cx,
            top: -1,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <ActiveIcon
            key={activeIndex}
            className="h-5 w-5 stroke-[2.2] text-primary animate-in zoom-in-75 fade-in duration-300"
          />
        </div>

        {/* Tabs */}
        <ul
          className="relative z-10 grid h-full w-full"
          style={{
            gridTemplateColumns: `repeat(${COUNT}, minmax(0, 1fr))`,
            paddingInline: INSET,
          }}
        >
          {NAV_ITEMS.map((item, index) => {
            const isActive = index === activeIndex
            const Icon = item.icon

            return (
              <li key={item.id} className="h-full min-w-0">
                <Link
                  to={item.to}
                  onClick={() => setTappedIndex(index)}
                  aria-current={isActive ? 'page' : undefined}
                  className="group flex h-full w-full flex-col items-center justify-end rounded-2xl pb-2 pt-1 outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  {/* Icon slot: fades out when its tab is active (bubble shows it) */}
                  <span
                    className={cn(
                      'mb-0.5 flex h-6 items-center justify-center transition-all duration-300 ease-out',
                      isActive
                        ? 'pointer-events-none -translate-y-2 scale-50 opacity-0'
                        : 'opacity-100',
                    )}
                  >
                    <Icon className="h-5 w-5 stroke-[1.8] text-muted-foreground transition-colors group-hover:text-foreground" />
                  </span>

                  <span
                    className={cn(
                      'w-full truncate px-0.5 text-center text-[10px] leading-tight tracking-tight transition-colors duration-300 ease-out min-[380px]:text-[11px]',
                      isActive
                        ? 'font-bold text-primary'
                        : 'font-medium text-muted-foreground group-hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
