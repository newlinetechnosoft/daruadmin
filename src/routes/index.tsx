import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { getFrontpageDataFn } from '#/server/catalog/catalog.functions'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { toast } from 'sonner'
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Clock,
  Award,
  Search,
} from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent } from '#/components/ui/card'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'

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
  '/images/butwal_night_view.png',
  '/images/drinks-bg.jpg',
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1600&auto=format&fit=crop',
  '/images/bg_beer_butwal.png',
  '/images/bg_bike.png',
]

const FEATURES = [
  {
    title: '40-minute express delivery',
    body: 'Fast dispatched couriers directly to your doorstep in Kathmandu Valley.',
    icon: Clock,
  },
  {
    title: 'Secure cashless payments',
    body: 'Fonepay QR, eSewa, Khalti, ConnectIPS and Cash on Delivery.',
    icon: ShieldCheck,
  },
  {
    title: 'Genuine manufacturer stock',
    body: 'Direct excise-stamped bottles and verified supplier relationships.',
    icon: Award,
  },
]

const REVIEWS = [
  {
    quote: 'Too polite and for sure the best late-night delivery service in Kathmandu.',
    name: 'Yogendra Dhami',
  },
  {
    quote: 'Chilled beer delivered within 35 minutes when everything else was closed.',
    name: 'Ramkrishna Baruwal',
  },
  {
    quote: 'Fast dispatch and cooperative couriers. Authentic liquor seal intact.',
    name: 'Krishant Rana',
  },
]

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

  return (
    <div className="min-h-screen bg-background text-foreground antialiased flex flex-col font-sans">
      <Header />

      <main className="flex-1">
        {/* HERO SHOWCASE */}
        <section
          className="relative min-h-[75vh] sm:min-h-[82vh] lg:min-h-[86vh] flex flex-col justify-between overflow-hidden bg-black select-none"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          aria-label="Hero Showcase"
        >
          {/* Horizontal Sliding Backgrounds */}
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
                  alt={`Food and Drinks Delivery ${idx + 1}`}
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  className={`h-full w-full object-cover object-center opacity-40 transition-transform duration-[7000ms] ease-out ${
                    idx === currentSlide ? 'scale-105' : 'scale-100'
                  }`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-black/40 to-black/60" />
              </div>
            ))}
          </div>

          {/* Hero Foreground Content */}
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col items-center justify-center text-center relative z-10 py-16 sm:py-24">
            {/* Top Pill Badge */}
            <Badge
              variant="outline"
              className="gap-1.5 px-3 py-1 text-xs font-medium text-white border-white/20 bg-black/60 backdrop-blur-md mb-6"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Kathmandu Valley Express Delivery</span>
            </Badge>

            {/* Headline */}
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-[1.08]">
              Drinks &amp; Food Delivered In 40 Mins
            </h1>

            {/* Subtitle */}
            <p className="mt-4 text-xs sm:text-sm font-medium tracking-wide text-white/80 max-w-lg">
              Genuine spirits, cold craft beer, wine, snacks, and late-night munchies to your doorstep.
            </p>

            {/* Capsule Search Bar */}
            <form
              onSubmit={handleHeroSearch}
              className="mt-8 sm:mt-10 w-full max-w-xl"
            >
              <div className="relative flex items-center rounded-lg border border-white/20 bg-background/95 p-1.5 shadow-xl backdrop-blur-md">
                <Search className="ml-3 h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  id="hero-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search beer, whiskey, momo, snacks..."
                  className="border-0 shadow-none focus-visible:ring-0 bg-transparent text-xs sm:text-sm placeholder:text-muted-foreground"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="gap-1.5 px-4 h-9 text-xs font-medium shrink-0"
                >
                  <span>Search</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </form>

            {/* Slide Loop Indicators */}
            <div className="mt-8 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-md">
              {HERO_SLIDES.map((_, idx) => (
                <Button
                  key={idx}
                  type="button"
                  variant="ghost"
                  onClick={() => setCurrentSlide(idx)}
                  className={`p-0 h-1.5 rounded-full transition-all duration-300 hover:bg-white/70 min-w-0 ${
                    idx === currentSlide
                      ? 'w-6 bg-white'
                      : 'w-1.5 bg-white/40'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Bottom Trust Strip */}
          <div className="relative z-20 border-t border-white/10 bg-black/40 backdrop-blur-md py-3 text-xs text-white/80">
            <div className="mx-auto flex max-w-7xl items-center justify-around px-4">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>100% Genuine Quality</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-sky-400" />
                <span>40-Minute Express Dispatch</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Award className="h-4 w-4 text-amber-400" />
                <span>Late-Night Delivery</span>
              </div>
            </div>
          </div>
        </section>

        {/* SHOP BY CATEGORY TILES */}
        <section className="py-16 sm:py-20 bg-background" id="drinks">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex items-end justify-between gap-6">
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  Explore Catalog
                </span>
                <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Shop drinks by category
                </h2>
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
                <Link to="/drinks">
                  View all drinks
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {[
                { name: 'Whiskey', slug: 'whiskey', image: '/images/whiskey.png' },
                { name: 'Beer & Cider', slug: 'beer-cider', image: '/images/beer.png' },
                { name: 'Vodka', slug: 'vodka', image: '/images/vodka.png' },
                { name: 'Wine', slug: 'wine', image: '/images/wine.png' },
                { name: 'Spirits', slug: 'whiskey', image: '/images/spirits.png' },
                { name: 'Snacks & More', slug: 'tobacco', image: '/images/tobacco.png' },
              ].map((cat) => (
                <Link
                  key={cat.name}
                  to="/drinks"
                  search={{ category: cat.slug }}
                  className="group"
                >
                  <Card className="overflow-hidden transition-all hover:border-foreground/20 hover:shadow-sm">
                    <CardContent className="p-3 flex flex-col items-center text-center">
                      <div className="h-28 w-full flex items-center justify-center bg-muted/30 rounded-md p-2 mb-2">
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="h-24 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      <span className="text-xs font-semibold text-foreground">
                        {cat.name}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* FOOD & LATE NIGHT BITES */}
        <section className="py-16 sm:py-20 border-t border-border bg-muted/10" id="food">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 items-center">
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                Midnight Cravings
              </span>
              <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Hot food &amp; munchies
              </h2>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Pair your drinks with fresh Kathmandu momo, spicy wings, piping hot biryani, and party snacks.
              </p>
              <div className="mt-6">
                <Button asChild size="sm" className="gap-2 text-xs">
                  <Link to="/grocery">
                    Explore food catalog
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="border border-border rounded-lg bg-card overflow-hidden divide-y divide-border">
              {FOOD_ITEMS.map((item, i) => (
                <Link
                  key={item}
                  to="/grocery"
                  search={{ category: 'late-night-bites' }}
                  className="group flex items-center justify-between p-4 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-mono">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="font-semibold text-sm">{item}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* APP DOWNLOAD */}
        <section className="py-16 sm:py-20 border-t border-border bg-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid items-center gap-12 lg:grid-cols-2">
            <div className="flex justify-center">
              <div className="w-56 rounded-2xl border border-border bg-card p-3 shadow-md">
                <div className="aspect-[9/16] rounded-xl bg-muted/40 flex flex-col justify-between p-5 text-center">
                  <div>
                    <span className="text-xs font-bold tracking-tight block">MEZMANI</span>
                    <p className="mt-2 text-sm font-semibold">Drinks delivered in 40 mins</p>
                  </div>
                  <img
                    src="/images/wine.png"
                    alt="App preview"
                    className="mx-auto h-36 object-contain"
                  />
                  <Badge variant="outline" className="mx-auto text-[10px]">
                    iOS &amp; Android
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <span className="text-xs font-medium text-muted-foreground">
                Mobile Convenience
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Your bar in your pocket
              </h2>
              <p className="text-xs leading-relaxed text-muted-foreground max-w-md">
                Get notified on live courier tracking, reorder your favorites with one click, and access exclusive valley promo vouchers.
              </p>

              <form onSubmit={handleGetApp} className="flex gap-2 max-w-sm pt-2">
                <Input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Mobile number (98XXXXXXXX)"
                  className="text-xs font-mono"
                />
                <Button type="submit" size="sm" className="shrink-0 text-xs">
                  Get app link
                </Button>
              </form>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toast.success('iOS App download link sent!')}
                  className="text-xs"
                >
                  App Store
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toast.success('Google Play download link sent!')}
                  className="text-xs"
                >
                  Google Play
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES / VALUE PROPS */}
        <section className="py-14 sm:py-16 border-t border-border bg-muted/10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid gap-8 sm:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.title} className="space-y-2">
                  <div className="h-9 w-9 grid place-items-center rounded-lg border border-border bg-card text-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {f.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {f.body}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {/* REVIEWS */}
        <section
          className="scroll-mt-14 py-16 sm:py-20 border-t border-border bg-background"
          id="reviews"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-xl">
              <span className="text-xs font-medium text-muted-foreground">
                Verified Feedback
              </span>
              <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                What customers say
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {REVIEWS.map((r) => (
                <Card key={r.name}>
                  <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                    <div className="space-y-2">
                      <div className="flex text-amber-500 text-xs">
                        {'★'.repeat(5)}
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground italic">
                        &ldquo;{r.quote}&rdquo;
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 pt-2 border-t border-border">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs font-semibold">
                          {r.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {r.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Kathmandu Customer
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
