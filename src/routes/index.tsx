import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { getFrontpageDataFn } from '#/server/catalog/catalog.functions'
import { Header } from '#/components/store/header'
import { toast } from 'sonner'
import { Sparkles, ArrowRight, ShieldCheck, Clock, Award } from 'lucide-react'

export const Route = createFileRoute('/')({
  loader: async () => {
    return await getFrontpageDataFn()
  },
  component: HomePage,
})

const FOOD_ITEMS = [
  'Momo',
  'Biryani',
  'Spaghetti',
  'Pizza',
  'Wings',
  'Chowmein',
]

const HERO_SLIDES = [
  // '/images/butwal-night.webp',
  '/images/butwal_night_view.png',
  '/images/drinks-bg.jpg',
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1600&auto=format&fit=crop',
  '/images/bg_beer_butwal.png',
  '/images/bg_bike.png',
]

const FEATURES = [
  { title: '40 minute delivery', body: 'Fast delivery whenever you need it.' },
  { title: 'Secure payments', body: 'Safe and convenient payment options.' },
  { title: '24/7 customer service', body: "We're always here to help." },
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

export function HomePage() {
  const navigate = useNavigate()
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
                  className={`h-full w-full object-cover object-center transition-transform duration-[7000ms] ease-out ${
                    idx === currentSlide ? 'scale-110' : 'scale-100'
                  }`}
                />
              </div>
            ))}
          </div>

          {/* HERO FOREGROUND CONTENT */}
          <div className="mx-auto max-w-5xl px-4 sm:px-8 w-full flex-1 flex flex-col items-center justify-center text-center relative z-10 py-16 sm:py-24">
            {/* TOP PILL BADGE */}
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 sm:px-5 py-1.5 text-xs font-bold uppercase tracking-widest text-card-foreground backdrop-blur-md shadow-lg mb-6">
              <Sparkles size={15} className="text-primary" />
              <span>NEPAL&apos;S #1 FASTEST DELIVERY PLATFORM</span>
            </div>

            {/* BOLD HEADLINE */}
            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[5.25rem] font-black tracking-tight uppercase leading-[1.05] text-foreground">
              <span className="text-primary">
                FOOD &amp;{' '}
              </span>
              <span>
                DRINKS{' '}
              </span>
              <span>
                DELIVERY
              </span>
            </h1>

            {/* SUBTITLE */}
            <p className="mt-4 text-xs sm:text-sm md:text-base font-bold tracking-[0.2em] text-muted-foreground uppercase">
              EASY, FAST &amp; CONVENIENT
            </p>

            {/* CAPSULE SEARCH BAR */}
            <form
              onSubmit={handleHeroSearch}
              className="mt-8 sm:mt-10 w-full max-w-2xl"
            >
              <div className="relative flex items-center rounded-full border border-border bg-card/95 p-1.5 sm:p-2 shadow-lg backdrop-blur-md transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/20">
                <SearchIcon className="ml-3 sm:ml-4 h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground shrink-0" />
                <input
                  id="hero-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for food or drinks (beer, whisky, momo, pizza, snacks...)"
                  className="w-full bg-transparent px-3 py-2 text-xs sm:text-sm md:text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground"
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

            {/* SPEED FOOTER */}
            <p className="mt-5 sm:mt-6 text-xs sm:text-sm font-bold tracking-[0.18em] text-muted-foreground uppercase">
              ALCOHOL, BEVERAGES &amp; FOOD DELIVERY WITHIN 45 MINS
            </p>

            {/* 5-SLIDE LOOP INDICATORS */}
            <div className="mt-8 flex items-center gap-2.5 rounded-full bg-card/70 border border-border px-3.5 py-1.5 backdrop-blur-md shadow-md">
              {HERO_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                    idx === currentSlide
                      ? 'w-8 bg-primary shadow-sm'
                      : 'w-2.5 bg-muted-foreground/40 hover:bg-muted-foreground'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* BOTTOM TRUST BADGES */}
          <div className="relative z-20 border-t border-border bg-card/80 backdrop-blur-md py-3.5 text-xs font-semibold text-card-foreground">
            <div className="mx-auto flex max-w-7xl items-center justify-around px-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" />
                <span>100% Genuine Quality</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-info" />
                <span>45 Min Express Delivery</span>
              </div>
              <div className="flex items-center gap-2">
                <Award size={16} className="text-primary" />
                <span>24/7 Late-Night Delivery</span>
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

            <div className="group/bento grid auto-rows-[11rem] grid-cols-2 gap-3 sm:auto-rows-[13rem] sm:gap-4 lg:auto-rows-[18.5rem] lg:grid-cols-12">
              <Link
                to="/drinks"
                search={{ category: 'whiskey' }}
                className={`${drinkTile} col-span-2 lg:col-span-4 lg:col-start-1 lg:row-start-1 bg-secondary/40`}
              >
                <DrinkTileBody
                  lines={['Domestic', 'Spirits']}
                  src="/images/spirits.png"
                  alt="Domestic Spirits"
                  tone="text-foreground"
                  size="md"
                />
              </Link>

              <Link
                to="/drinks"
                search={{ category: 'vodka' }}
                className={`${drinkTile} lg:col-span-2 lg:col-start-1 lg:row-start-2 bg-secondary/40`}
              >
                <DrinkTileBody
                  lines={['Vodka']}
                  src="/images/vodka.png"
                  alt="Vodka"
                  tone="text-foreground"
                  size="sm"
                />
              </Link>

              <Link
                to="/drinks"
                search={{ category: 'whiskey' }}
                className={`${drinkTile} lg:col-span-2 lg:col-start-3 lg:row-start-2 bg-secondary/40`}
              >
                <DrinkTileBody
                  lines={['Whiskey']}
                  src="/images/whiskey.png"
                  alt="Whiskey"
                  tone="text-foreground"
                  size="sm"
                />
              </Link>

              <Link
                to="/drinks"
                search={{ category: 'beer-cider' }}
                className={`${drinkTile} col-span-2 row-span-2 lg:col-span-4 lg:col-start-5 lg:row-start-1 bg-secondary/60`}
              >
                <DrinkTileBody
                  lines={['Beer']}
                  src="/images/beer.png"
                  alt="Beer"
                  tone="text-foreground"
                  chip="bg-primary text-primary-foreground"
                  size="lg"
                />
              </Link>

              <Link
                to="/grocery"
                search={{ category: 'party-essentials' }}
                className={`${drinkTile} lg:col-span-4 lg:col-start-9 lg:row-start-1 bg-secondary/40`}
              >
                <DrinkTileBody
                  lines={['Tobacco']}
                  src="/images/tobacco.png"
                  alt="Tobacco"
                  tone="text-foreground"
                  size="md"
                />
              </Link>

              <Link
                to="/drinks"
                search={{ category: 'wine' }}
                className={`${drinkTile} lg:col-span-4 lg:col-start-9 lg:row-start-2 bg-secondary/40`}
              >
                <DrinkTileBody
                  lines={['Wine']}
                  src="/images/wine.png"
                  alt="Wine"
                  tone="text-foreground"
                  size="md"
                />
              </Link>
            </div>
          </div>
        </section>

        {/* FOOD */}
        <section
          className="scroll-mt-24 border-t border-border py-16 sm:py-24"
          id="food"
        >
          <div
            className={`${wrap} grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20`}
          >
            <div>
              <p className={eyebrow}>Hungry?</p>
              <h2 className="mt-3 text-4xl font-black uppercase leading-none tracking-tighter sm:text-6xl">
                Shop by food
              </h2>
              <Link
                to="/grocery"
                className="mt-8 inline-block border-b border-foreground pb-0.5 text-sm font-semibold transition-opacity hover:opacity-60 text-foreground"
              >
                View all →
              </Link>
            </div>

            <ul className="border-t border-border">
              {FOOD_ITEMS.map((item, i) => (
                <li key={item} className="border-b border-border">
                  <Link
                    to="/grocery"
                    search={{ category: 'late-night-bites' }}
                    className="group flex items-center justify-between gap-4 py-5 transition-colors hover:bg-accent sm:py-6"
                  >
                    <span className="flex items-baseline gap-5 sm:gap-8">
                      <span className="w-6 text-xs font-medium tabular-nums text-muted-foreground">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-2xl font-bold uppercase tracking-tight transition-transform group-hover:translate-x-2 sm:text-4xl text-foreground">
                        {item}
                      </span>
                    </span>
                    <span className="text-xl transition-transform group-hover:translate-x-1 text-foreground">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
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
                        src="/mezmani_logo.png"
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
                    src="/images/wine.png"
                    alt=""
                    aria-hidden="true"
                    className="mx-auto h-[55%] w-full object-contain"
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
                      <strong className="block text-sm text-foreground">{r.name}</strong>
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
      <footer className="scroll-mt-24 bg-sidebar text-sidebar-foreground border-t border-sidebar-border" id="about">
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
              <Link to="/drinks" className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors">
                Cocktail Recipes
              </Link>
              <Link to="/drinks" className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors">
                Give a Gift
              </Link>
              <a href="#reviews" className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors">
                Reviews
              </a>
              <Link to="/drinks" className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors">
                Share &amp; Save 20%
              </Link>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/50">
                About
              </h4>
              <a href="#about" className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors">
                About Us
              </a>
              <a href="#about" className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors">
                Find Us
              </a>
              <a
                href="tel:+9779802088800"
                className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
              >
                Contact (+977-9802088800)
              </a>
              <a href="#about" className="text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors">
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
