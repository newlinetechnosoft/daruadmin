import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { storefrontQueries } from '#/queries/storefront'
import { Header } from '#/components/store/header'
import { toast } from 'sonner'
import {
  ArrowRight,
  ShieldCheck,
  Clock,
  Award,
  Sparkles,
  Utensils,
  Wine,
} from 'lucide-react'

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    const [groceryCategories, liquorCategories] = await Promise.all([
      context.queryClient.ensureQueryData(storefrontQueries.groceryCategories()),
      context.queryClient.ensureQueryData(storefrontQueries.liquorCategories()),
    ])
    return { groceryCategories, liquorCategories }
  },
  component: HomePage,
})

function getCategoryFallbackImage(slug?: string, name?: string): string {
  const s = `${slug ?? ''} ${name ?? ''}`.toLowerCase()
  if (s.includes('momo') || s.includes('dumpling')) {
    return 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=1000&q=80'
  }
  if (
    s.includes('snack') ||
    s.includes('munch') ||
    s.includes('chip') ||
    s.includes('peanut')
  ) {
    return 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=1000&q=80'
  }
  if (
    s.includes('beverage') ||
    s.includes('mixer') ||
    s.includes('drink') ||
    s.includes('juice') ||
    s.includes('cola')
  ) {
    return 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=1000&q=80'
  }
  if (s.includes('pizza')) {
    return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1000&q=80'
  }
  if (s.includes('burger')) {
    return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1000&q=80'
  }
  if (s.includes('biryani') || s.includes('rice')) {
    return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1000&q=80'
  }
  if (
    s.includes('noodle') ||
    s.includes('chowmein') ||
    s.includes('pasta') ||
    s.includes('spaghetti')
  ) {
    return 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1000&q=80'
  }
  if (s.includes('ice') || s.includes('party')) {
    return 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1000&q=80'
  }
  return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1000&q=80'
}

type GroceryCategoryItem = {
  id: string
  name: string
  slug: string
  description?: string | null
  imageUrl?: string | null
  showOnLandingPage?: boolean
}

function FoodCategoryCard({
  category,
  index,
  isFeatured = false,
  totalCount = 1,
  className = '',
}: {
  category: GroceryCategoryItem
  index: number
  isFeatured?: boolean
  totalCount?: number
  className?: string
}) {
  const imgSrc =
    category.imageUrl && category.imageUrl.trim() !== ''
      ? category.imageUrl
      : getCategoryFallbackImage(category.slug, category.name)

  if (isFeatured) {
    return (
      <Link
        to="/grocery"
        search={{ category: category.slug }}
        className="group relative isolate block overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 bg-card/60 shadow-xl transition-all duration-500 hover:-translate-y-1.5 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10 animate-in fade-in-0 slide-in-from-bottom-6 duration-700 fill-mode-both"
      >
        <div className="grid grid-cols-1 items-center lg:grid-cols-12 min-h-[340px] sm:min-h-[440px]">
          {/* Left Details */}
          <div className="z-10 flex flex-col justify-between p-5 sm:p-10 lg:col-span-5 h-full">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-primary">
                <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Featured Category
              </div>
              <h3 className="mt-3 sm:mt-4 text-2xl font-black uppercase tracking-tight text-foreground sm:text-5xl group-hover:text-primary transition-colors duration-300">
                {category.name}
              </h3>
              <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-3">
                {category.description ||
                  'Explore delicious handcrafted dishes and essential kitchen items, freshly prepared and delivered within 30 minutes.'}
              </p>
            </div>

            <div className="mt-5 sm:mt-8 pt-4 sm:pt-6 border-t border-border/60 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground group-hover:text-primary transition-colors">
                Order {category.name} →
              </span>
              <span className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/30">
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>

          {/* Right Big Image */}
          <div className="relative h-60 sm:h-88 lg:h-full lg:col-span-7 overflow-hidden">
            <img
              src={imgSrc}
              alt={category.name}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                const target = e.currentTarget
                const fallback = getCategoryFallbackImage(
                  category.slug,
                  category.name,
                )
                if (target.src !== fallback) target.src = fallback
              }}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent lg:bg-gradient-to-r lg:from-background lg:via-transparent lg:to-transparent pointer-events-none" />
          </div>
        </div>
      </Link>
    )
  }

  // Adaptive height based on layout density & 2-column mobile
  const cardHeightClass =
    totalCount === 2
      ? 'min-h-[220px] sm:min-h-[380px] md:min-h-[440px]'
      : totalCount === 3
        ? 'min-h-[200px] sm:min-h-[360px] md:min-h-[420px]'
        : 'min-h-[190px] sm:min-h-[320px] md:min-h-[380px]'

  return (
    <Link
      to="/grocery"
      search={{ category: category.slug }}
      style={{ animationDelay: `${index * 120}ms` }}
      className={`group relative isolate flex flex-col justify-end overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 bg-card/60 p-3.5 sm:p-6 md:p-7 ${cardHeightClass} shadow-lg transition-all duration-500 hover:-translate-y-2 hover:border-primary/60 hover:shadow-2xl hover:shadow-primary/15 animate-in fade-in-0 slide-in-from-bottom-6 duration-700 fill-mode-both ${className}`}
    >
      {/* Big Image Background with Smooth Zoom */}
      <img
        src={imgSrc}
        alt={category.name}
        loading="lazy"
        decoding="async"
        onError={(e) => {
          const target = e.currentTarget
          const fallback = getCategoryFallbackImage(
            category.slug,
            category.name,
          )
          if (target.src !== fallback) target.src = fallback
        }}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 group-hover:rotate-0.5"
      />

      {/* Multi-stop dark gradient for high readability & depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/10 transition-opacity duration-300 group-hover:opacity-90 pointer-events-none" />

      {/* Top badges */}
      <div className="relative z-10 mb-auto flex items-center justify-between w-full">
        <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/40 backdrop-blur-md px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-[11px] font-bold text-white shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {String(index + 1).padStart(2, '0')}
        </span>

        <span className="grid h-7 w-7 sm:h-10 sm:w-10 place-items-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md text-white transition-all duration-300 group-hover:bg-primary group-hover:border-primary group-hover:text-primary-foreground group-hover:scale-110 group-hover:rotate-[-45deg] shadow-md">
          <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
        </span>
      </div>

      {/* Bottom Content */}
      <div className="relative z-10 pt-2 sm:pt-6">
        <h3 className="text-sm sm:text-2xl md:text-3xl font-black uppercase tracking-tight text-white drop-shadow-md transition-transform duration-300 group-hover:translate-x-1 line-clamp-1 sm:line-clamp-none">
          {category.name}
        </h3>
        {category.description && (
          <p className="hidden sm:block mt-2 text-xs text-gray-300/90 line-clamp-2 leading-relaxed drop-shadow">
            {category.description}
          </p>
        )}
        <div className="mt-1.5 sm:mt-4 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold text-amber-300 group-hover:text-amber-200 transition-colors uppercase tracking-wider">
          <span>Explore</span>
          <ArrowRight className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  )
}

const HERO_SLIDES = [
  '/images/butwal_night_view.webp',
  '/images/beer-bg.webp',
  '/images/pizza-bg.webp',
  '/images/bg_bike.webp',
]

const FEATURES = [
  { title: '30 minute delivery', body: 'Fast delivery whenever you need it.' },
  { title: 'Secure payments', body: 'Safe and convenient payment options.' },
  { title: '5-12pm customer service', body: "We're always here to help." },
]

const REVIEWS = [
  { quote: 'Too polite & for sure best service.', name: 'Yogendra Dhami' },
  {
    quote: 'One of the best service providers for late night.',
    name: 'Ramkrishna Baruwal',
  },
  {
    quote: 'Fast delivery and very cooperative. Highly recommended.',
    name: 'Krishant Rana',
  },
]

/* ------------------------------------------------------------------ */
/*  Drink tile primitives                                              */
/* ------------------------------------------------------------------ */

/**
 * Compact tile: solid color, product cutout filling the space, vertical
 * label on the left edge. The grid needs `group/bento` so that hovering
 * one tile softly dims the others.
 */
const drinkTile =
  'group relative isolate block h-full min-w-0 overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl focus-visible:-translate-y-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

/** Vertical label scale, tuned per tile footprint */
const LABEL_SIZE = {
  sm: 'text-xl sm:text-2xl',
  md: 'text-2xl sm:text-4xl',
  lg: 'text-4xl sm:text-6xl',
} as const

type LabelSize = keyof typeof LABEL_SIZE

function getDrinkCategoryImage(category: {
  imageUrl?: string | null
  slug?: string
  name?: string
}): string {
  if (category.imageUrl && category.imageUrl.trim() !== '') {
    return category.imageUrl
  }
  const s = `${category.slug ?? ''} ${category.name ?? ''}`.toLowerCase()
  if (
    s.includes('beer') ||
    s.includes('cider') ||
    s.includes('lager') ||
    s.includes('ale')
  ) {
    return '/images/beer.webp'
  }
  if (
    s.includes('whiskey') ||
    s.includes('whisky') ||
    s.includes('scotch') ||
    s.includes('bourbon')
  ) {
    return '/images/whiskey.webp'
  }
  if (s.includes('vodka')) {
    return '/images/vodka.webp'
  }
  if (
    s.includes('wine') ||
    s.includes('champagne') ||
    s.includes('prosecco') ||
    s.includes('sparkling')
  ) {
    return '/images/wine.webp'
  }
  if (
    s.includes('tobacco') ||
    s.includes('cigarette') ||
    s.includes('cigar') ||
    s.includes('smoke')
  ) {
    return '/images/tobacco.webp'
  }
  if (
    s.includes('spirit') ||
    s.includes('domestic') ||
    s.includes('rum') ||
    s.includes('gin') ||
    s.includes('tequila') ||
    s.includes('brandy') ||
    s.includes('liqueur')
  ) {
    return '/images/spirits.webp'
  }
  return '/images/spirits.webp'
}

function splitDrinkCategoryName(name: string): string[] {
  const trimmed = name.trim()
  const words = trimmed.split(/\s+/)
  if (words.length <= 2) return words
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

const DRINK_BENTO_SLOTS = [
  // Slot 0: Top Left (Domestic Spirits)
  {
    className:
      'col-span-2 lg:col-span-4 lg:col-start-1 lg:row-start-1 bg-secondary/40',
    size: 'md' as LabelSize,
    chip: 'bg-primary text-primary-foreground',
  },
  // Slot 1: Bottom Left 1 (Vodka)
  {
    className:
      'col-span-1 lg:col-span-2 lg:col-start-1 lg:row-start-2 bg-secondary/40',
    size: 'sm' as LabelSize,
    chip: 'bg-primary text-primary-foreground',
  },
  // Slot 2: Bottom Left 2 (Whiskey)
  {
    className:
      'col-span-1 lg:col-span-2 lg:col-start-3 lg:row-start-2 bg-secondary/40',
    size: 'sm' as LabelSize,
    chip: 'bg-primary text-primary-foreground',
  },
  // Slot 3: Center Featured Tall (Beer)
  {
    className:
      'col-span-2 row-span-2 lg:col-span-4 lg:col-start-5 lg:row-start-1 bg-secondary/60',
    size: 'lg' as LabelSize,
    chip: 'bg-primary text-primary-foreground',
  },
  // Slot 4: Top Right (Tobacco)
  {
    className:
      'col-span-1 lg:col-span-4 lg:col-start-9 lg:row-start-1 bg-secondary/40',
    size: 'md' as LabelSize,
    chip: 'bg-primary text-primary-foreground',
  },
  // Slot 5: Bottom Right (Wine)
  {
    className:
      'col-span-1 lg:col-span-4 lg:col-start-9 lg:row-start-2 bg-secondary/40',
    size: 'md' as LabelSize,
    chip: 'bg-primary text-primary-foreground',
  },
]


function DrinkTileBody({
  lines,
  src,
  alt,
  tone,
  chip = 'bg-primary text-primary-foreground',
  size = 'sm',
}: {
  /** label split into lines, e.g. ['Domestic', 'Spirits'] */
  lines: string[]
  src: string
  alt: string
  /** label text color class */
  tone: string
  /** hover arrow chip colors */
  chip?: string
  size?: LabelSize
}) {
  return (
    <>
      {/* Product cutout — takes everything right of the label strip */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="absolute inset-y-0 right-0 h-full w-[calc(100%-2.5rem)] object-contain p-2 drop-shadow-md transition-transform duration-500 ease-out  group-hover:-rotate-2 sm:w-[calc(100%-3rem)] sm:p-3"
      />

      {/* Vertical label, reads bottom-to-top, anchored bottom-left */}
      <span
        className={`pointer-events-none absolute bottom-3 left-3 rotate-180 font-black uppercase leading-[0.9] tracking-tighter transition-transform duration-300 [writing-mode:vertical-rl] group-hover:-translate-y-1 sm:bottom-4 sm:left-4 ${LABEL_SIZE[size]} ${tone}`}
      >
        {lines.map((line, i) => (
          <span key={line}>
            {line}
            {i < lines.length - 1 && <br />}
          </span>
        ))}
      </span>

      {/* Hover arrow chip */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute right-3 top-3 z-10 grid h-8 w-8 -translate-y-1 place-items-center rounded-full text-sm font-bold opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 ${chip}`}
      >
        →
      </span>
    </>
  )
}

function SearchIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function HomePage() {
  const navigate = useNavigate()
  const loaderData = Route.useLoaderData()
    const { data: allGroceryCategories = loaderData?.groceryCategories ?? [] } =
    useQuery({
      ...storefrontQueries.groceryCategories(),
      initialData: loaderData?.groceryCategories,
    })

  // Smart landing page category visibility:
  // Show categories that have the "Visible on landing page" check button enabled
  const groceryCategories = allGroceryCategories.filter(
    (cat: any) => Boolean(cat.showOnLandingPage) && cat.isActive !== false,
  )

  const { data: allLiquorCategories = loaderData?.liquorCategories ?? [] } =
    useQuery({
      ...storefrontQueries.liquorCategories(),
      initialData: loaderData?.liquorCategories,
    })

  // Smart landing page drinks category visibility:
  // Show drinks categories where showOnLandingPage is checked in the admin panel
  const drinksCategories = allLiquorCategories.filter(
    (cat: any) => Boolean(cat.showOnLandingPage) && cat.isActive !== false,
  )

  const [searchQuery, setSearchQuery] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (isPaused) return
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [isPaused])

  const handleHeroSearch = (e: FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate({
        to: '/drinks',
        search: { query: searchQuery.trim() },
      })
    } else {
      navigate({ to: '/drinks' })
    }
  }

  const handleGetApp = (e: FormEvent) => {
    e.preventDefault()
    if (!phoneNumber.trim()) {
      toast.error('Please enter your mobile number')
      return
    }
    toast.success(`Download link sent to ${phoneNumber}! Check your SMS.`)
    setPhoneNumber('')
  }

  const wrap = 'mx-auto w-full max-w-7xl px-5 sm:px-8'
  const eyebrow =
    'text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground'

  return (
    <div className="storefront flex min-h-screen flex-col bg-background font-sans text-foreground antialiased">
      <Header />

      <main className="flex-1">
        {/* HERO WITH 5 AUTO-SCROLLING BACKGROUNDS IN 5-SECOND LOOP */}
        {/* HERO SECTION MATCHING USER REFERENCE DESIGN */}
        <section
          className="relative min-h-[82vh] sm:min-h-[88vh] lg:min-h-[90vh] flex flex-col justify-between overflow-hidden bg-background select-none"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          aria-label="Hero Showcase"
        >
          {/* 5-BACKGROUND HORIZONTAL SLIDING TRACK WITH 5-SECOND LOOP */}
          <div
            className="absolute inset-0 flex transition-transform duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {HERO_SLIDES.map((slideImg, idx) => (
              <div
                key={idx}
                className="relative h-full w-full shrink-0 overflow-hidden"
              >
                <img
                  src={slideImg}
                  alt={`Food & Drinks Delivery Background ${idx + 1}`}
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  fetchPriority={idx === 0 ? 'high' : 'auto'}
                  className={`h-full w-full object-cover object-center transition-transform duration-[7000ms] ease-out ${idx === currentSlide ? 'scale-110' : 'scale-100'
                    }`}
                />
              </div>
            ))}
          </div>

          {/* DARK VIGNETTE OVERLAY FOR CRISP TEXT CONTRAST OVER PHOTOS */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/80 z-[1] pointer-events-none" />

          {/* HERO FOREGROUND CONTENT */}
          <div className="mx-auto max-w-5xl px-4 sm:px-8 w-full flex-1 flex flex-col items-center justify-center text-center relative z-10 py-16 sm:py-24">
            {/* TOP PILL BADGE */}

            {/*
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 sm:px-5 py-1.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-md shadow-lg mb-6">
              <Sparkles size={15} className="text-primary" />
              <span>NEPAL&apos;S #1 FASTEST DELIVERY PLATFORM</span>
            </div>
              */}

            {/* BOLD HEADLINE */}
            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[5.25rem] font-black tracking-tight uppercase leading-[1.05] drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">
              <span className="text-primary drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                FOOD &amp;{' '}
              </span>
              <span className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                DRINKS{' '}
              </span>
              <span className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                DELIVERY
              </span>
            </h1>

            {/* SUBTITLE */}
            <p className="mt-4 text-xs sm:text-sm md:text-base font-bold tracking-[0.2em] text-white/90 uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              EASY, FAST &amp; AFFORDABLE
            </p>

            {/* SPEED FOOTER */}
            <p className="mt-5 sm:mt-6 text-xs sm:text-sm font-bold tracking-[0.18em] text-amber-300 uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              ALCOHOL, BEVERAGES &amp; FOOD DELIVERY WITHIN 30 MINS
            </p>

            {/* CAPSULE SEARCH BAR */}
            <form
              onSubmit={handleHeroSearch}
              className="mt-8 sm:mt-10 w-full max-w-2xl"
            >
              <div className="relative flex items-center rounded-full border border-white/30 bg-black/70 p-1.5 sm:p-2 shadow-[0_8px_30px_rgb(0,0,0,0.5)] backdrop-blur-md transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/30">
                <SearchIcon className="ml-3 sm:ml-4 h-5 w-5 sm:h-6 sm:w-6 text-white/70 shrink-0" />
                <input
                  id="hero-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for food or drinks"
                  className="w-full bg-transparent px-3 py-2 text-xs sm:text-sm md:text-base font-semibold text-white outline-none placeholder:text-white/60"
                />
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-full bg-primary hover:bg-primary/90 px-5 sm:px-7 py-2.5 sm:py-3 text-xs sm:text-sm font-black text-primary-foreground shadow-md transition-transform hover:scale-105 shrink-0 cursor-pointer"
                >
                  <span>SHOP</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>

            {/* 5-SLIDE LOOP INDICATORS */}
            <div className="mt-8 flex items-center gap-2.5 rounded-full bg-black/60 border border-white/20 px-3.5 py-1.5 backdrop-blur-md shadow-md">
              {HERO_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${idx === currentSlide
                    ? 'w-8 bg-primary shadow-md shadow-primary/50'
                    : 'w-2.5 bg-white/70 hover:bg-white'
                    }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* BOTTOM TRUST BADGES */}
          <div className="relative z-20 border-t border-white/15 bg-black/75 backdrop-blur-md py-3.5 text-xs font-semibold text-white/90">
            <div className="mx-auto flex max-w-7xl items-center justify-around px-4">
              <div className="flex items-center gap-2 font-extrabold">
                <ShieldCheck size={16} className="white font-extrabold" />
                <span>100% Genuine Quality</span>
              </div>
              <div className="flex items-center gap-2 font-extrabold">
                <Clock size={16} className="white font-extrabold" />
                <span>30 Min Express Delivery</span>
              </div>
              <div className="flex items-center gap-2 font-extrabold">
                <Award size={16} className="white font-extrabold" />
                <span>5-12pm Night Delivery</span>
              </div>
            </div>
          </div>
        </section>

        {/* SHOP BY DRINKS */}
        <section
          className="h-[90%] scroll-mt-24 bg-card py-16 sm:py-24"
          id="drinks"
        >
          <div className={wrap}>
            <div className="mb-8 flex items-end justify-between gap-6 sm:mb-12">
              <div>
                <p className={eyebrow}>Explore</p>
                <h2 className="mt-3 text-4xl font-black uppercase leading-none tracking-tighter sm:text-6xl">
                  Shop by drinks
                </h2>
              </div>
              <Link
                to="/drinks"
                className="shrink-0 border-b border-foreground pb-0.5 text-sm font-semibold transition-opacity hover:opacity-60 text-foreground"
              >
                View all →
              </Link>
            </div>

            {/* Dynamic Responsive Drinks Grid */}
            {drinksCategories.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center animate-in fade-in-0 duration-500">
                <Wine className="mx-auto h-12 w-12 text-muted-foreground/60" />
                <h3 className="mt-4 text-lg font-bold text-foreground">
                  Curated Drink Menu Coming Up
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Browse our full chilled beer, premier spirits and wine catalog.
                </p>
                <Link
                  to="/drinks"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all"
                >
                  Browse Drinks
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : drinksCategories.length === 1 ? (
              <div className="mx-auto max-w-4xl">
                <Link
                  to="/drinks"
                  search={{ category: drinksCategories[0].slug }}
                  className={`${drinkTile} min-h-[380px] sm:min-h-[440px] bg-secondary/50`}
                >
                  <DrinkTileBody
                    lines={splitDrinkCategoryName(drinksCategories[0].name)}
                    src={getDrinkCategoryImage(drinksCategories[0])}
                    alt={drinksCategories[0].name}
                    tone="text-foreground"
                    size="lg"
                  />
                </Link>
              </div>
            ) : drinksCategories.length === 2 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 auto-rows-[15rem] sm:auto-rows-[19rem]">
                {drinksCategories.map((cat: any) => (
                  <Link
                    key={cat.id}
                    to="/drinks"
                    search={{ category: cat.slug }}
                    className={`${drinkTile} bg-secondary/40`}
                  >
                    <DrinkTileBody
                      lines={splitDrinkCategoryName(cat.name)}
                      src={getDrinkCategoryImage(cat)}
                      alt={cat.name}
                      tone="text-foreground"
                      size="md"
                    />
                  </Link>
                ))}
              </div>
            ) : drinksCategories.length === 3 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-[14rem] sm:auto-rows-[18rem]">
                {drinksCategories.map((cat: any) => (
                  <Link
                    key={cat.id}
                    to="/drinks"
                    search={{ category: cat.slug }}
                    className={`${drinkTile} bg-secondary/40`}
                  >
                    <DrinkTileBody
                      lines={splitDrinkCategoryName(cat.name)}
                      src={getDrinkCategoryImage(cat)}
                      alt={cat.name}
                      tone="text-foreground"
                      size="md"
                    />
                  </Link>
                ))}
              </div>
            ) : drinksCategories.length === 4 ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-[13rem] sm:auto-rows-[17rem]">
                {drinksCategories.map((cat: any) => (
                  <Link
                    key={cat.id}
                    to="/drinks"
                    search={{ category: cat.slug }}
                    className={`${drinkTile} bg-secondary/40`}
                  >
                    <DrinkTileBody
                      lines={splitDrinkCategoryName(cat.name)}
                      src={getDrinkCategoryImage(cat)}
                      alt={cat.name}
                      tone="text-foreground"
                      size="md"
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {/* 6-Slot Bento Grid (Matching Exact Iconic Layout) */}
                <div className="group/bento grid auto-rows-[11rem] grid-cols-2 gap-3 sm:auto-rows-[13rem] sm:gap-4 lg:auto-rows-[18.5rem] lg:grid-cols-12">
                  {drinksCategories.slice(0, 6).map((cat: any, idx: number) => {
                    const slot = DRINK_BENTO_SLOTS[idx] ?? DRINK_BENTO_SLOTS[0]
                    return (
                      <Link
                        key={cat.id}
                        to={cat.slug === 'party-essentials' ? '/grocery' : '/drinks'}
                        search={{ category: cat.slug }}
                        className={`${drinkTile} ${slot.className}`}
                      >
                        <DrinkTileBody
                          lines={splitDrinkCategoryName(cat.name)}
                          src={getDrinkCategoryImage(cat)}
                          alt={cat.name}
                          tone="text-foreground"
                          chip={slot.chip}
                          size={slot.size}
                        />
                      </Link>
                    )
                  })}
                </div>

                {/* Overflow categories beyond 6 in complementary responsive tiles */}
                {drinksCategories.length > 6 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 auto-rows-[11rem] sm:auto-rows-[13rem] lg:auto-rows-[15rem] pt-1">
                    {drinksCategories.slice(6).map((cat: any) => (
                      <Link
                        key={cat.id}
                        to="/drinks"
                        search={{ category: cat.slug }}
                        className={`${drinkTile} bg-secondary/40`}
                      >
                        <DrinkTileBody
                          lines={splitDrinkCategoryName(cat.name)}
                          src={getDrinkCategoryImage(cat)}
                          alt={cat.name}
                          tone="text-foreground"
                          size="md"
                        />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* SHOP BY FOOD & GROCERY */}
        <section
          className="relative isolate scroll-mt-24 overflow-hidden border-t border-border bg-gradient-to-b from-background via-card/25 to-background py-16 sm:py-24"
          id="food"
        >
          {/* Subtle Ambient Glows */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-20 top-1/4 -z-10 h-80 w-80 rounded-full bg-amber-500/[0.04] blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 bottom-10 -z-10 h-96 w-96 rounded-full bg-primary/[0.04] blur-3xl"
          />

          <div className={wrap}>
            <div className="mb-8 flex flex-col justify-between gap-4 sm:mb-12 sm:flex-row sm:items-end">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-primary uppercase">
                    <Sparkles className="h-3 w-3" /> Fresh &amp; Ready
                  </span>
                  <span className={eyebrow}>Fast Delivery</span>
                </div>
                <h2 className="mt-3 text-4xl font-black uppercase leading-none tracking-tighter sm:text-6xl text-foreground">
                  Shop by food
                </h2>
                <p className="mt-2.5 max-w-xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Hot meals, late-night bites, and essential snacks delivered fresh to your doorstep in 30 minutes.
                </p>
              </div>

              <Link
                to="/grocery"
                className="group inline-flex items-center gap-2 border-b border-foreground pb-1 text-sm font-semibold text-foreground transition-all hover:opacity-75"
              >
                <span>View all food &amp; groceries</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Flexible & Animated Category Grid based on count */}
            {groceryCategories.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center animate-in fade-in-0 duration-500">
                <Utensils className="mx-auto h-12 w-12 text-muted-foreground/60" />
                <h3 className="mt-4 text-lg font-bold text-foreground">
                  Delicious Food Menu Coming Up
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Browse our full food, beverage and grocery catalog.
                </p>
                <Link
                  to="/grocery"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all"
                >
                  Browse Groceries
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : groceryCategories.length === 1 ? (
              <div className="mx-auto max-w-4xl">
                <FoodCategoryCard
                  category={groceryCategories[0]}
                  index={0}
                  isFeatured={true}
                  totalCount={1}
                />
              </div>
            ) : groceryCategories.length === 2 ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-6 md:gap-8">
                {groceryCategories.map((cat, i) => (
                  <FoodCategoryCard
                    key={cat.id}
                    category={cat}
                    index={i}
                    totalCount={2}
                  />
                ))}
              </div>
            ) : groceryCategories.length === 3 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 md:gap-8">
                {groceryCategories.map((cat, i) => (
                  <FoodCategoryCard
                    key={cat.id}
                    category={cat}
                    index={i}
                    totalCount={3}
                    className={i === 2 ? 'col-span-2 md:col-span-1' : ''}
                  />
                ))}
              </div>
            ) : groceryCategories.length === 4 ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                {groceryCategories.map((cat, i) => (
                  <FoodCategoryCard
                    key={cat.id}
                    category={cat}
                    index={i}
                    totalCount={4}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                {groceryCategories.map((cat, i) => (
                  <FoodCategoryCard
                    key={cat.id}
                    category={cat}
                    index={i}
                    totalCount={groceryCategories.length}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* APP */}
        <section className="bg-secondary/30 border-y border-border">
          <div
            className={`${wrap} grid items-center gap-14 py-16 sm:py-24 lg:grid-cols-2`}
          >
            <div className="flex justify-center lg:justify-start">
              <div className="w-60 rounded-[2.5rem] bg-foreground text-background p-2.5 shadow-2xl sm:w-72">
                <div className="relative flex aspect-[9/17] flex-col justify-between overflow-hidden rounded-[2rem] bg-card border border-border p-6 text-card-foreground">
                  <div>
                    <span className="text-xs font-black uppercase tracking-tighter">
                      <img
                        src="/mezmani_logo.webp"
                        alt="LOGO"
                        width="180"
                        height="180"
                        loading="lazy"
                        className="-ml-2"
                      />
                    </span>
                    <strong className="mt-4 block text-3xl font-black uppercase leading-[0.92] tracking-tighter">
                      Good times
                      <br />
                      delivered.
                    </strong>
                  </div>
                  <img
                    src="/images/riderimage.jpeg"
                    alt="Delivery rider"
                    className="mx-auto h-[60%] w-full object-cover object-center"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className={eyebrow}>Mezmani app</p>
              <h2 className="mt-3 text-4xl font-black uppercase leading-[0.92] tracking-tighter sm:text-6xl">
                Your drinks.
                <br />
                <span className="text-muted-foreground">Wherever you go.</span>
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                Get your liquor, food and party supplies delivered with just a
                few taps.
              </p>

              <form
                onSubmit={handleGetApp}
                className="mt-8 flex max-w-lg flex-col gap-3 sm:flex-row"
              >
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter your number (98XXXXXXXX)"
                  className="h-14 min-w-0 flex-1 border border-input bg-card px-4 text-base text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring rounded-md"
                />
                <button
                  type="submit"
                  className="h-14 bg-primary px-8 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer rounded-md"
                >
                  Get App
                </button>
              </form>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="h-11 border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer rounded-md"
                  onClick={() => toast.success('iOS App download link sent!')}
                >
                  App Store
                </button>
                <button
                  type="button"
                  className="h-11 border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer rounded-md"
                  onClick={() =>
                    toast.success('Google Play download link sent!')
                  }
                >
                  Google Play
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="py-14 sm:py-20">
          <div className={`${wrap} grid gap-10 sm:grid-cols-3 sm:gap-8`}>
            {FEATURES.map((f, i) => (
              <div key={f.title} className="border-t-2 border-border pt-5">
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 text-xl font-bold tracking-tight text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* REVIEWS */}
        <section
          className="scroll-mt-24 border-t border-border bg-secondary/30 py-16 sm:py-24"
          id="reviews"
        >
          <div className={wrap}>
            <div className="mb-10 max-w-2xl sm:mb-14">
              <p className={eyebrow}>Customer love</p>
              <h2 className="mt-3 text-4xl font-black uppercase leading-none tracking-tighter sm:text-6xl text-foreground">
                What customers say
              </h2>
              <p className="mt-4 text-muted-foreground">
                Here&apos;s what our satisfied customers have to say.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {REVIEWS.map((r) => (
                <article
                  key={r.name}
                  className="flex flex-col justify-between bg-card border border-border p-7 sm:p-8 rounded-xl shadow-xs text-card-foreground"
                >
                  <div>
                    <div
                      className="text-sm tracking-[0.2em] text-warning font-bold"
                      aria-label="5 out of 5 stars"
                    >
                      ★★★★★
                    </div>
                    <blockquote className="mt-6 text-xl font-semibold leading-snug tracking-tight text-foreground">
                      “{r.quote}”
                    </blockquote>
                  </div>

                  <div className="mt-10 flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {r.name.charAt(0)}
                    </div>
                    <div className="leading-tight">
                      <strong className="block text-sm text-foreground">
                        {r.name}
                      </strong>
                      <small className="text-xs text-muted-foreground">
                        Verified customer
                      </small>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer
        className="scroll-mt-24 bg-sidebar text-sidebar-foreground border-t border-sidebar-border"
        id="about"
      >
        <div className={`${wrap} py-16 sm:py-20`}>
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
            <div>
              <Link
                to="/"
                className="text-3xl font-black uppercase tracking-tighter text-sidebar-foreground"
              >
                <img
                  src="/mezmani_logo_bg.svg"
                  width="180"
                  height="180"
                  loading="lazy"
                />
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-sidebar-foreground/70">
                Food &amp; drinks delivery.
                <br />
                Let the good times roll.
              </p>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/50">
                Extras
              </h4>
              <Link
                to="/drinks"
                className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
              >
                Cocktail Recipes
              </Link>
              <Link
                to="/drinks"
                className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
              >
                Give a Gift
              </Link>
              <a
                href="#reviews"
                className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
              >
                Reviews
              </a>
              <Link
                to="/drinks"
                className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
              >
                Share &amp; Save 20%
              </Link>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/50">
                About
              </h4>
              <a
                href="#about"
                className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
              >
                About Us
              </a>
              <a
                href="#about"
                className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
              >
                Find Us
              </a>
              <a
                href="tel:+9779802088800"
                className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
              >
                Contact (+977-9802088800)
              </a>
              <a
                href="#about"
                className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
              >
                Help &amp; Support
              </a>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/50">
                Connect
              </h4>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
              >
                Facebook
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
              >
                Instagram
              </a>
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
              >
                TikTok
              </a>
            </div>
          </div>

          <div className="mt-16 flex flex-col gap-5 border-t border-sidebar-border pt-6 text-xs text-sidebar-foreground/60 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Mezmani Pvt. Ltd. All Rights Reserved.</p>

            <div className="flex flex-wrap gap-x-5 gap-y-2 font-medium text-sidebar-foreground/80">
              <span>eSewa</span>
              <span>Khalti</span>
              <span>fonepay</span>
              <span>IME Pay</span>
            </div>
          </div>

          <p className="mt-6 text-xs text-sidebar-foreground/60">
            Please drink responsibly. 18+ only.
          </p>
        </div>
      </footer>
    </div>
  )
}
