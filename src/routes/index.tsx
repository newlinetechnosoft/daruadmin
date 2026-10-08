import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { getFrontpageDataFn } from '#/server/catalog/catalog.functions'
import { useCart } from '#/lib/cart-context'
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
  '/images/butwal-night.webp',
  '/images/butwal_night_view.png',
  '/images/drinks-bg.jpg',
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1600&auto=format&fit=crop',
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

const tileBase =
  'group relative isolate block overflow-hidden bg-[#161616] text-white transition-colors hover:bg-[#222] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black'

function TileContent({
  label,
  src,
  alt,
  large = false,
}: {
  label: React.ReactNode
  src: string
  alt: string
  large?: boolean
}) {
  return (
    <>
      <div
        className={`relative z-10 p-5 font-black uppercase leading-[0.95] tracking-tight sm:p-7 ${
          large ? 'text-3xl sm:text-5xl' : 'text-xl sm:text-3xl'
        }`}
      >
        {label}
      </div>
      <span className="absolute right-5 top-5 z-10 text-lg opacity-0 transition-opacity group-hover:opacity-100 sm:right-7 sm:top-7">
        →
      </span>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="absolute bottom-0 right-0 -z-0 h-[78%] w-[78%] object-contain object-bottom-right p-3 transition-transform duration-500 ease-out group-hover:scale-105 sm:p-6"
      />
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
  const { itemCount, setIsOpen } = useCart()
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
    'text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500'

  return (
    <div className="min-h-screen bg-white text-[#101010] antialiased">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white/90 backdrop-blur">
        <div className={`${wrap} flex h-16 items-center justify-between gap-6`}>
          <Link
            to="/"
            className="text-xl font-black uppercase tracking-tighter sm:text-2xl"
          >
            Mezmani
          </Link>

          <nav className="hidden items-center gap-9 text-sm font-medium md:flex">
            <Link to="/drinks" className="hover:underline underline-offset-8">
              Drinks
            </Link>
            <Link to="/grocery" className="hover:underline underline-offset-8">
              Food
            </Link>
            <a href="#reviews" className="hover:underline underline-offset-8">
              Reviews
            </a>
            <a href="#about" className="hover:underline underline-offset-8">
              About
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Search"
              className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-neutral-100"
              onClick={() => {
                const el = document.getElementById('hero-search-input')
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el?.focus()
              }}
            >
              <SearchIcon />
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-black px-5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
              onClick={() => setIsOpen(true)}
            >
              Cart
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold text-black">
                {itemCount}
              </span>
            </button>
          </div>
        </div>

        {/* mobile nav */}
        <nav className="flex items-center gap-6 overflow-x-auto border-t border-black/5 px-5 py-2.5 text-sm font-medium md:hidden">
          <Link to="/drinks">Drinks</Link>
          <Link to="/grocery">Food</Link>
          <a href="#reviews">Reviews</a>
          <a href="#about">About</a>
        </nav>
      </header>

      <main>
        {/* HERO WITH 5 AUTO-SCROLLING BACKGROUNDS IN 5-SECOND LOOP */}
        {/* HERO SECTION MATCHING USER REFERENCE DESIGN */}
        <section
          className="relative min-h-[82vh] sm:min-h-[88vh] lg:min-h-[90vh] flex flex-col justify-between overflow-hidden bg-[#16082b] select-none"
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
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 sm:px-5 py-1.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-md shadow-lg mb-6">
              <Sparkles size={15} className="text-[#ff5b00]" />
              <span>NEPAL&apos;S #1 FASTEST DELIVERY PLATFORM</span>
            </div>

            {/* BOLD HEADLINE */}
            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[5.25rem] font-black tracking-tight uppercase leading-[1.05] drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">
              <span className="text-[#ff5b00] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">FOOD &amp; </span>
              <span className="text-[#00e5ff] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">DRINKS </span>
              <span className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">DELIVERY</span>
            </h1>

            {/* SUBTITLE */}
            <p className="mt-4 text-xs sm:text-sm md:text-base font-bold tracking-[0.2em] text-white uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              EASY, FAST &amp; CONVENIENT
            </p>

            {/* CAPSULE SEARCH BAR */}
            <form
              onSubmit={handleHeroSearch}
              className="mt-8 sm:mt-10 w-full max-w-2xl"
            >
              <div className="relative flex items-center rounded-full border border-white/40 bg-white/95 p-1.5 sm:p-2 shadow-[0_8px_30px_rgb(0,0,0,0.4)] backdrop-blur-md transition-all focus-within:border-[#ff5b00] focus-within:ring-4 focus-within:ring-orange-500/30">
                <SearchIcon className="ml-3 sm:ml-4 h-5 w-5 sm:h-6 sm:w-6 text-slate-400 shrink-0" />
                <input
                  id="hero-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for food or drinks (beer, whisky, momo, pizza, snacks...)"
                  className="w-full bg-transparent px-3 py-2 text-xs sm:text-sm md:text-base font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-full bg-[#ff5b00] hover:bg-[#e05000] px-5 sm:px-7 py-2.5 sm:py-3 text-xs sm:text-sm font-black text-white shadow-lg transition-transform hover:scale-105 shrink-0 cursor-pointer"
                >
                  <span>SHOP</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>

            {/* SPEED FOOTER */}
            <p className="mt-5 sm:mt-6 text-xs sm:text-sm font-bold tracking-[0.18em] text-cyan-300 uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              ALCOHOL, BEVERAGES &amp; FOOD DELIVERY WITHIN 45 MINS
            </p>

            {/* 5-SLIDE LOOP INDICATORS */}
            <div className="mt-8 flex items-center gap-2.5 rounded-full bg-black/50 px-3.5 py-1.5 backdrop-blur-md shadow-md">
              {HERO_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                    idx === currentSlide
                      ? 'w-8 bg-[#ff5b00] shadow-md shadow-orange-500/50'
                      : 'w-2.5 bg-white/70 hover:bg-white'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

          </div>

          {/* BOTTOM TRUST BADGES */}
          <div className="relative z-20 border-t border-white/15 bg-black/60 backdrop-blur-md py-3.5 text-xs font-semibold text-slate-200">
            <div className="mx-auto flex max-w-7xl items-center justify-around px-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#ff5b00]" />
                <span>100% Genuine Quality</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-cyan-400" />
                <span>45 Min Express Delivery</span>
              </div>
              <div className="flex items-center gap-2">
                <Award size={16} className="text-[#ff5b00]" />
                <span>24/7 Late-Night Delivery</span>
              </div>
            </div>
          </div>
        </section>

        {/* SHOP BY DRINKS — BENTO */}
        <section
          className="scroll-mt-24 bg-black py-16 text-white sm:py-24"
          id="drinks"
        >
          <div className={wrap}>
            <div className="mb-10 flex items-end justify-between gap-6 sm:mb-14">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
                  Explore
                </p>
                <h2 className="mt-3 text-4xl font-black uppercase leading-none tracking-tighter sm:text-6xl">
                  Shop by drinks
                </h2>
              </div>
              <Link
                to="/drinks"
                className="shrink-0 border-b border-white pb-0.5 text-sm font-semibold transition-opacity hover:opacity-70"
              >
                View all →
              </Link>
            </div>

            <div className="grid auto-rows-[190px] grid-cols-2 gap-3 sm:auto-rows-[240px] sm:gap-4 lg:grid-cols-12 lg:auto-rows-[230px]">
              <Link
                to="/drinks"
                search={{ category: 'whiskey' }}
                className={`${tileBase} col-span-2 lg:col-span-5 lg:row-span-2`}
              >
                <TileContent
                  large
                  label={
                    <>
                      Domestic
                      <br />
                      Spirits
                    </>
                  }
                  src="/images/spirits.png"
                  alt="Domestic Spirits"
                />
              </Link>

              <Link
                to="/drinks"
                search={{ category: 'beer-cider' }}
                className={`${tileBase} col-span-2 bg-[#e9e6df] !text-black hover:!bg-[#dedad1] lg:col-span-4 lg:row-span-2`}
              >
                <TileContent
                  large
                  label="Beer"
                  src="/images/beer.png"
                  alt="Beer"
                />
              </Link>

              <Link
                to="/grocery"
                search={{ category: 'party-essentials' }}
                className={`${tileBase} lg:col-span-3`}
              >
                <TileContent
                  label="Tobacco"
                  src="/images/tobacco.png"
                  alt="Tobacco"
                />
              </Link>

              <Link
                to="/drinks"
                search={{ category: 'wine' }}
                className={`${tileBase} bg-[#5a1f2b] hover:!bg-[#6b2634] lg:col-span-3`}
              >
                <TileContent label="Wine" src="/images/wine.png" alt="Wine" />
              </Link>

              <Link
                to="/drinks"
                search={{ category: 'vodka' }}
                className={`${tileBase} bg-white !text-black hover:!bg-neutral-200 lg:col-span-6`}
              >
                <TileContent
                  label="Vodka"
                  src="/images/vodka.png"
                  alt="Vodka"
                />
              </Link>

              <Link
                to="/drinks"
                search={{ category: 'whiskey' }}
                className={`${tileBase} bg-[#3a2a1a] hover:!bg-[#47331f] lg:col-span-6`}
              >
                <TileContent
                  label="Whiskey"
                  src="/images/whiskey.png"
                  alt="Whiskey"
                />
              </Link>
            </div>
          </div>
        </section>

        {/* FOOD */}
        <section className="scroll-mt-24 py-16 sm:py-24" id="food">
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
                className="mt-8 inline-block border-b border-black pb-0.5 text-sm font-semibold transition-opacity hover:opacity-60"
              >
                View all →
              </Link>
            </div>

            <ul className="border-t border-black">
              {FOOD_ITEMS.map((item, i) => (
                <li key={item} className="border-b border-black/15">
                  <Link
                    to="/grocery"
                    search={{ category: 'late-night-bites' }}
                    className="group flex items-center justify-between gap-4 py-5 transition-colors hover:bg-neutral-50 sm:py-6"
                  >
                    <span className="flex items-baseline gap-5 sm:gap-8">
                      <span className="w-6 text-xs font-medium tabular-nums text-neutral-400">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-2xl font-bold uppercase tracking-tight transition-transform group-hover:translate-x-2 sm:text-4xl">
                        {item}
                      </span>
                    </span>
                    <span className="text-xl transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* APP */}
        <section className="bg-[#f3f2ee]">
          <div
            className={`${wrap} grid items-center gap-14 py-16 sm:py-24 lg:grid-cols-2`}
          >
            <div className="flex justify-center lg:justify-start">
              <div className="w-60 rounded-[2.5rem] bg-black p-2.5 shadow-2xl sm:w-72">
                <div className="relative flex aspect-[9/17] flex-col justify-between overflow-hidden rounded-[2rem] bg-white p-6">
                  <div>
                    <span className="text-xs font-black uppercase tracking-tighter">
                      Mezmani
                    </span>
                    <strong className="mt-4 block text-3xl font-black uppercase leading-[0.92] tracking-tighter">
                      Good times
                      <br />
                      delivered.
                    </strong>
                  </div>
                  <img
                    src="/images/beer.png"
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
                <span className="text-neutral-400">Wherever you go.</span>
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed text-neutral-600">
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
                  className="h-14 min-w-0 flex-1 border-2 border-black bg-white px-4 text-base outline-none placeholder:text-neutral-400 focus:shadow-[4px_4px_0_0_#000]"
                />
                <button
                  type="submit"
                  className="h-14 bg-black px-8 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-neutral-800"
                >
                  Get App
                </button>
              </form>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="h-11 border border-black px-5 text-sm font-semibold transition-colors hover:bg-black hover:text-white"
                  onClick={() => toast.success('iOS App download link sent!')}
                >
                  App Store
                </button>
                <button
                  type="button"
                  className="h-11 border border-black px-5 text-sm font-semibold transition-colors hover:bg-black hover:text-white"
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
              <div key={f.title} className="border-t-2 border-black pt-5">
                <span className="text-xs font-medium tabular-nums text-neutral-400">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 text-xl font-bold tracking-tight">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm text-neutral-600">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* REVIEWS */}
        <section
          className="scroll-mt-24 border-t border-black/10 bg-[#f3f2ee] py-16 sm:py-24"
          id="reviews"
        >
          <div className={wrap}>
            <div className="mb-10 max-w-2xl sm:mb-14">
              <p className={eyebrow}>Customer love</p>
              <h2 className="mt-3 text-4xl font-black uppercase leading-none tracking-tighter sm:text-6xl">
                What customers say
              </h2>
              <p className="mt-4 text-neutral-600">
                Here&apos;s what our satisfied customers have to say.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {REVIEWS.map((r) => (
                <article
                  key={r.name}
                  className="flex flex-col justify-between bg-white p-7 sm:p-8"
                >
                  <div>
                    <div
                      className="text-sm tracking-[0.2em]"
                      aria-label="5 out of 5 stars"
                    >
                      ★★★★★
                    </div>
                    <blockquote className="mt-6 text-xl font-semibold leading-snug tracking-tight">
                      “{r.quote}”
                    </blockquote>
                  </div>

                  <div className="mt-10 flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-black text-sm font-bold text-white">
                      {r.name.charAt(0)}
                    </div>
                    <div className="leading-tight">
                      <strong className="block text-sm">{r.name}</strong>
                      <small className="text-xs text-neutral-500">
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
      <footer className="scroll-mt-24 bg-black text-white" id="about">
        <div className={`${wrap} py-16 sm:py-20`}>
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
            <div>
              <Link
                to="/"
                className="text-3xl font-black uppercase tracking-tighter"
              >
                Mezmani
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-400">
                Food &amp; drinks delivery.
                <br />
                Let the good times roll.
              </p>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                Extras
              </h4>
              <Link to="/drinks" className="text-neutral-300 hover:text-white">
                Cocktail Recipes
              </Link>
              <Link to="/drinks" className="text-neutral-300 hover:text-white">
                Give a Gift
              </Link>
              <a href="#reviews" className="text-neutral-300 hover:text-white">
                Reviews
              </a>
              <Link to="/drinks" className="text-neutral-300 hover:text-white">
                Share &amp; Save 20%
              </Link>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                About
              </h4>
              <a href="#about" className="text-neutral-300 hover:text-white">
                About Us
              </a>
              <a href="#about" className="text-neutral-300 hover:text-white">
                Find Us
              </a>
              <a
                href="tel:+9779802088800"
                className="text-neutral-300 hover:text-white"
              >
                Contact (+977-9802088800)
              </a>
              <a href="#about" className="text-neutral-300 hover:text-white">
                Help &amp; Support
              </a>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                Connect
              </h4>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-300 hover:text-white"
              >
                Facebook
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-300 hover:text-white"
              >
                Instagram
              </a>
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-300 hover:text-white"
              >
                TikTok
              </a>
            </div>
          </div>

          <div className="mt-16 flex flex-col gap-5 border-t border-white/15 pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Mezmani Pvt. Ltd. All Rights Reserved.</p>

            <div className="flex flex-wrap gap-x-5 gap-y-2 font-medium text-neutral-300">
              <span>eSewa</span>
              <span>Khalti</span>
              <span>fonepay</span>
              <span>IME Pay</span>
            </div>
          </div>

          <p className="mt-6 text-xs text-neutral-500">
            Please drink responsibly. 18+ only.
          </p>
        </div>
      </footer>
    </div>
  )
}
