import { useState, useMemo } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import {
  getLiquorCategoriesFn,
  getLiquorBrandsFn,
  getLiquorProductsFn,
} from '#/server/catalog/catalog.functions'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { ProductCard } from '#/components/store/product-card'
import type { ProductProps } from '#/components/store/product-card'
import { Wine, X, RotateCcw, SlidersHorizontal } from 'lucide-react'

const drinksSearchSchema = z.object({
  category: z.string().optional(),
  brand: z.string().optional(),
  query: z.string().optional(),
})

export const Route = createFileRoute('/drinks')({
  validateSearch: (search) => drinksSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    category: search.category,
    brand: search.brand,
    query: search.query,
  }),
  loader: async ({ deps }) => {
    const [categories, brands, products] = await Promise.all([
      getLiquorCategoriesFn(),
      getLiquorBrandsFn(),
      getLiquorProductsFn({
        data: {
          categorySlug: deps.category,
          brandSlug: deps.brand,
          query: deps.query,
          limit: 50,
          offset: 0,
        },
      }),
    ])

    return {
      categories,
      brands,
      products,
    }
  },
  component: DrinksPage,
})

const PRICE_OPTIONS = [
  { id: 'under-1000', label: 'Under Rs. 1,000' },
  { id: '1000-2500', label: 'Rs. 1,000 – 2,500' },
  { id: '2500-5000', label: 'Rs. 2,500 – 5,000' },
  { id: 'above-5000', label: 'Above Rs. 5,000' },
]

const VOLUME_OPTIONS = [
  { id: '375', label: '375ml' },
  { id: '500', label: '500ml / 650ml' },
  { id: '750', label: '750ml' },
  { id: '1000', label: '1L+' },
]

const wrap = 'mx-auto w-full max-w-7xl px-5 sm:px-8'

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
      {children}
    </h3>
  )
}

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-neutral-600 transition-colors hover:text-black">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 accent-black"
      />
      <span className={checked ? 'font-semibold text-black' : ''}>{label}</span>
    </label>
  )
}

function DrinksPage() {
  const { categories, brands, products } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate()

  const [sortBy, setSortBy] = useState('recommended')
  const [selectedPriceRange, setSelectedPriceRange] = useState<string | null>(
    null,
  )
  const [selectedVolume, setSelectedVolume] = useState<string | null>(null)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const currentCategory = search.category ?? 'all'
  const currentBrand = search.brand ?? 'all'

  const handleCategorySelect = (slug: string) => {
    navigate({
      to: '/drinks',
      search: {
        ...search,
        category: slug === 'all' ? undefined : slug,
      },
    })
    setMobileFilterOpen(false)
  }

  const handleBrandSelect = (slug: string) => {
    navigate({
      to: '/drinks',
      search: {
        ...search,
        brand: slug === 'all' ? undefined : slug,
      },
    })
    setMobileFilterOpen(false)
  }

  const handleResetFilters = () => {
    setSelectedPriceRange(null)
    setSelectedVolume(null)
    navigate({
      to: '/drinks',
      search: {},
    })
    setMobileFilterOpen(false)
  }

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let list = [...products]

    // Price range filter
    if (selectedPriceRange) {
      list = list.filter((p) => {
        const minPrice = p.variants[0]?.price ?? 0
        if (selectedPriceRange === 'under-1000') return minPrice < 100000
        if (selectedPriceRange === '1000-2500')
          return minPrice >= 100000 && minPrice <= 250000
        if (selectedPriceRange === '2500-5000')
          return minPrice >= 250000 && minPrice <= 500000
        if (selectedPriceRange === 'above-5000') return minPrice > 500000
        return true
      })
    }

    // Volume filter
    if (selectedVolume) {
      list = list.filter((p) => {
        return p.variants.some((v) => {
          if (selectedVolume === '375') return v.volumeMl === 375
          if (selectedVolume === '500')
            return v.volumeMl === 500 || v.volumeMl === 650
          if (selectedVolume === '750') return v.volumeMl === 750
          if (selectedVolume === '1000') return v.volumeMl && v.volumeMl >= 1000
          return true
        })
      })
    }

    // Sort order
    if (sortBy === 'price-low') {
      list.sort(
        (a, b) => (a.variants[0]?.price ?? 0) - (b.variants[0]?.price ?? 0),
      )
    } else if (sortBy === 'price-high') {
      list.sort(
        (a, b) => (b.variants[0]?.price ?? 0) - (a.variants[0]?.price ?? 0),
      )
    } else if (sortBy === 'newest') {
      list.sort((a, b) => b.name.localeCompare(a.name))
    } else {
      // Recommended: featured first
      list.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0))
    }

    return list
  }, [products, selectedPriceRange, selectedVolume, sortBy])

  const activeCategoryObj = useMemo(
    () => categories.find((c) => c.slug === search.category),
    [categories, search.category],
  )

  const hasActiveFilters = Boolean(
    search.category ||
      search.brand ||
      search.query ||
      selectedPriceRange ||
      selectedVolume,
  )

  // Shared by the desktop sidebar and the mobile drawer
  const filterPanel = (
    <div className="space-y-10">
      <div>
        <GroupTitle>Categories</GroupTitle>
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {[
            {
              key: 'all',
              slug: 'all',
              name: 'All Drinks',
              count: products.length,
            },
            ...categories.map((cat) => ({
              key: cat.id,
              slug: cat.slug,
              name: cat.name,
              count: products.filter((p) => p.categorySlug === cat.slug).length,
            })),
          ].map((cat) => {
            const active = currentCategory === cat.slug
            return (
              <li key={cat.key}>
                <button
                  type="button"
                  onClick={() => handleCategorySelect(cat.slug)}
                  className={`flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                    active
                      ? 'bg-black font-semibold text-white'
                      : 'text-neutral-600 hover:bg-[#f3f2ee] hover:text-black'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span
                    className={`text-[11px] tabular-nums ${
                      active ? 'text-neutral-400' : 'text-neutral-400'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="border-t border-black/10 pt-8">
        <GroupTitle>Price</GroupTitle>
        <div className="space-y-3">
          {PRICE_OPTIONS.map((p) => (
            <CheckRow
              key={p.id}
              label={p.label}
              checked={selectedPriceRange === p.id}
              onChange={() =>
                setSelectedPriceRange(selectedPriceRange === p.id ? null : p.id)
              }
            />
          ))}
        </div>
      </div>

      <div className="border-t border-black/10 pt-8">
        <GroupTitle>Volume</GroupTitle>
        <div className="space-y-3">
          {VOLUME_OPTIONS.map((v) => (
            <CheckRow
              key={v.id}
              label={v.label}
              checked={selectedVolume === v.id}
              onChange={() =>
                setSelectedVolume(selectedVolume === v.id ? null : v.id)
              }
            />
          ))}
        </div>
      </div>

      <div className="border-t border-black/10 pt-8">
        <GroupTitle>Brands</GroupTitle>
        <div className="space-y-3">
          <CheckRow
            label="All Brands"
            checked={currentBrand === 'all'}
            onChange={() => handleBrandSelect('all')}
          />
          {brands.map((b) => (
            <CheckRow
              key={b.id}
              label={b.name}
              checked={currentBrand === b.slug}
              onChange={() => handleBrandSelect(b.slug)}
            />
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#101010] antialiased">
      <Header />

      <main className="flex-1">
        {/* PAGE HERO */}
        <section className="bg-[#f3f2ee]">
          <div className={`${wrap} py-12 sm:py-16 lg:py-20`}>
            <nav
              aria-label="Breadcrumb"
              className="mb-6 flex flex-wrap items-center text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500"
            >
              <Link to="/" className="transition-colors hover:text-black">
                Home
              </Link>
              <span className="mx-2.5 text-neutral-300">/</span>
              <span className={activeCategoryObj ? '' : 'text-black'}>
                Drinks
              </span>
              {activeCategoryObj && (
                <>
                  <span className="mx-2.5 text-neutral-300">/</span>
                  <span className="text-black">{activeCategoryObj.name}</span>
                </>
              )}
            </nav>

            <h1 className="text-[clamp(3rem,10vw,7.5rem)] font-black uppercase leading-[0.88] tracking-tighter">
              {activeCategoryObj ? activeCategoryObj.name : 'Drinks'}
            </h1>

            <p className="mt-6 max-w-lg text-base leading-relaxed text-neutral-600">
              {activeCategoryObj?.description ??
                'Discover our selection of spirits, vodka, whiskey, beer, wine and more with 40-minute late-night delivery.'}
            </p>
          </div>
        </section>

        {/* SHOP AREA */}
        <section className="py-10 sm:py-14 lg:pb-24">
          <div className={wrap}>
            {/* TOOLBAR */}
            <div className="flex items-center justify-between gap-4 border-b border-black pb-5">
              <p className="text-sm text-neutral-500">
                <span className="font-semibold tabular-nums text-black">
                  {filteredProducts.length}
                </span>{' '}
                of {products.length} products
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(true)}
                  className="inline-flex h-10 cursor-pointer items-center gap-2 border border-black px-4 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-black hover:text-white md:hidden"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                </button>

                <div className="flex items-center gap-3 text-sm">
                  <label
                    htmlFor="sort"
                    className="hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500 sm:inline"
                  >
                    Sort by
                  </label>
                  <select
                    id="sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="h-10 cursor-pointer border border-black bg-white px-3 pr-8 text-sm outline-none focus:shadow-[3px_3px_0_0_#000]"
                  >
                    <option value="recommended">Recommended</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="newest">Newest</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SIDEBAR + GRID */}
            <div className="grid grid-cols-1 gap-12 pt-10 md:grid-cols-[230px_1fr] lg:grid-cols-[250px_1fr] lg:gap-16">
              <aside className="hidden md:block">
                <div className="sticky top-6">
                  {filterPanel}

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="mt-8 inline-flex cursor-pointer items-center gap-2 border-0 border-b border-black bg-transparent p-0 pb-0.5 text-xs font-semibold uppercase tracking-wider transition-opacity hover:opacity-60"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reset all filters
                    </button>
                  )}
                </div>
              </aside>

              <section>
                {filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-12 lg:grid-cols-3">
                    {filteredProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product as ProductProps}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#f3f2ee] px-6 py-20 text-center">
                    <Wine
                      className="mx-auto mb-4 h-10 w-10 text-neutral-400"
                      strokeWidth={1.5}
                    />
                    <h3 className="text-2xl font-black uppercase tracking-tighter">
                      No drinks match your filters
                    </h3>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-600">
                      Try clearing some filters or searching for another liquor.
                    </p>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="mt-7 h-12 cursor-pointer bg-black px-8 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-neutral-800"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}

                {/* PAGINATION */}
                {filteredProducts.length > 0 && (
                  <div className="mt-14 flex items-center justify-center gap-2 sm:mt-20">
                    <button
                      type="button"
                      className="grid h-11 w-11 place-items-center border border-black bg-black text-xs font-bold text-white"
                    >
                      1
                    </button>
                    {['2', '3', '→'].map((label) => (
                      <button
                        key={label}
                        type="button"
                        className="grid h-11 w-11 place-items-center border border-black/20 bg-white text-xs font-medium transition-colors hover:border-black"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </section>
      </main>

      {/* MOBILE FILTER DRAWER */}
      {mobileFilterOpen && (
        <div
          className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filter drinks"
          onClick={() => setMobileFilterOpen(false)}
        >
          <div
            className="ml-auto flex h-full w-full max-w-sm flex-col bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black px-6 py-5">
              <h3 className="text-xl font-black uppercase tracking-tighter">
                Filter drinks
              </h3>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setMobileFilterOpen(false)}
                className="grid h-9 w-9 cursor-pointer place-items-center border-0 bg-transparent transition-colors hover:bg-neutral-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-7">{filterPanel}</div>

            <div className="grid grid-cols-2 gap-3 border-t border-black/10 p-6">
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-12 cursor-pointer border border-black bg-white text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-neutral-100"
              >
                Reset all
              </button>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="h-12 cursor-pointer bg-black text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-neutral-800"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
