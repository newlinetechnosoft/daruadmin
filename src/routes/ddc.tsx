import { useState, useMemo } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { storefrontQueries } from '#/queries/storefront'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { ProductCard } from '#/components/store/product-card'
import { Package, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { Label } from '#/components/ui/label'
import { NativeSelect } from '#/components/ui/native-select'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '#/components/ui/breadcrumb'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '#/components/ui/pagination'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { EmptyState } from '#/components/shared/empty-state'

const ddcSearchSchema = z.object({
  category: z.string().optional(),
  query: z.string().optional(),
})

export const Route = createFileRoute('/ddc')({
  validateSearch: (search) => ddcSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    category: search.category,
    query: search.query,
  }),
  loader: async ({ deps, context }) => {
    const [categories, products] = await Promise.all([
      context.queryClient.ensureQueryData(
        storefrontQueries.ddcCategories(),
      ),
      context.queryClient.ensureQueryData(
        storefrontQueries.ddcProducts({
          categorySlug: deps.category,
          query: deps.query,
          limit: 50,
          offset: 0,
        }),
      ),
    ])

    return {
      categories,
      products,
    }
  },
  component: DdcPage,
})

const PRICE_OPTIONS = [
  { id: 'under-500', label: 'Under Rs. 500' },
  { id: '500-1000', label: 'Rs. 500 – 1,000' },
  { id: '1000-2500', label: 'Rs. 1,000 – 2,500' },
  { id: 'above-2500', label: 'Above Rs. 2,500' },
]

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold text-foreground tracking-tight">
      {children}
    </h3>
  )
}

function CheckRow({
  id,
  checked,
  onChange,
  label,
}: {
  id: string
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <Label
        htmlFor={id}
        className={`text-xs cursor-pointer ${
          checked ? 'font-medium text-foreground' : 'text-muted-foreground'
        }`}
      >
        {label}
      </Label>
    </div>
  )
}

function DdcPage() {
  const { categories, products } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate()

  const [sortBy, setSortBy] = useState('recommended')
  const [selectedPriceRange, setSelectedPriceRange] = useState<string | null>(
    null,
  )
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const currentCategory = search.category ?? 'all'

  const handleCategorySelect = (slug: string) => {
    navigate({
      to: '/ddc',
      search: {
        ...search,
        category: slug === 'all' ? undefined : slug,
      },
    })
    setMobileFilterOpen(false)
  }

  const handleResetFilters = () => {
    setSelectedPriceRange(null)
    navigate({
      to: '/ddc',
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
        if (selectedPriceRange === 'under-500') return minPrice < 50000
        if (selectedPriceRange === '500-1000')
          return minPrice >= 50000 && minPrice <= 100000
        if (selectedPriceRange === '1000-2500')
          return minPrice >= 100000 && minPrice <= 250000
        if (selectedPriceRange === 'above-2500') return minPrice > 250000
        return true
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
      list.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0))
    }

    return list
  }, [products, selectedPriceRange, sortBy])

  const activeCategoryObj = useMemo(
    () => categories.find((c) => c.slug === search.category),
    [categories, search.category],
  )

  const hasActiveFilters = Boolean(
    search.category || search.query || selectedPriceRange,
  )

  const filterPanel = (
    <div className="space-y-8">
      {/* Categories */}
      <div>
        <GroupTitle>Categories</GroupTitle>
        <div className="space-y-0.5">
          {[
            {
              key: 'all',
              slug: 'all',
              name: 'All DDC products',
              count: products.length,
            },
            ...categories.map((c) => ({
              key: c.id,
              slug: c.slug,
              name: c.name,
              count: null,
            })),
          ].map((cat) => {
            const active = currentCategory === cat.slug
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => handleCategorySelect(cat.slug)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                <span className="truncate">{cat.name}</span>
                {cat.count !== null && (
                  <span className="text-[10px] text-muted-foreground/70 ml-2">
                    {cat.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <GroupTitle>Price Range</GroupTitle>
        <div className="space-y-2.5">
          {PRICE_OPTIONS.map((opt) => (
            <CheckRow
              key={opt.id}
              id={`filter-${opt.id}`}
              checked={selectedPriceRange === opt.id}
              onChange={() =>
                setSelectedPriceRange(
                  selectedPriceRange === opt.id ? null : opt.id,
                )
              }
              label={opt.label}
            />
          ))}
        </div>
      </div>

      {/* Reset */}
      {hasActiveFilters && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetFilters}
          className="w-full text-xs h-8 text-muted-foreground hover:text-foreground gap-1.5"
        >
          <RotateCcw className="h-3 w-3" />
          Reset all filters
        </Button>
      )}
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header
        onSearch={(q) => {
          navigate({
            to: '/ddc',
            search: { ...search, query: q || undefined },
          })
        }}
      />

      <main className="flex-1">
        {/* Top Breadcrumb & Title Area */}
        <div className="border-b border-border/40 bg-muted/20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            <Breadcrumb className="mb-3">
              <BreadcrumbList className="text-xs">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {search.category ? (
                    <BreadcrumbLink asChild>
                      <Link to="/ddc">DDC</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>DDC</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {search.category && activeCategoryObj && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {activeCategoryObj.name}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {activeCategoryObj
                    ? activeCategoryObj.name
                    : search.query
                      ? `Search: "${search.query}"`
                      : 'DDC Dairy & Provisions'}
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  {activeCategoryObj?.description ??
                    'Pure milk, fresh dairy goods, and authentic DDC dairy products delivered directly.'}
                </p>
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMobileFilterOpen(true)}
                  className="lg:hidden text-xs gap-1.5"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                </Button>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Sort by:
                  </span>
                  <NativeSelect
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="h-8 text-xs w-36"
                  >
                    <option value="recommended">Featured</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="newest">Name: A to Z</option>
                  </NativeSelect>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Pill Ribbon */}
        {categories.length > 0 && (
          <div className="border-b border-border/40 bg-background overflow-x-auto scrollbar-none">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 min-w-max">
              <button
                type="button"
                onClick={() => handleCategorySelect('all')}
                className={`text-xs px-3.5 py-1.5 rounded-full border transition-colors ${
                  currentCategory === 'all'
                    ? 'bg-primary text-primary-foreground border-primary font-medium'
                    : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'
                }`}
              >
                All DDC Items
              </button>
              {categories.map((c) => {
                const active = currentCategory === c.slug
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleCategorySelect(c.slug)}
                    className={`text-xs px-3.5 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary font-medium'
                        : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {c.imageUrl && (
                      <img
                        src={c.imageUrl}
                        alt=""
                        className="h-3.5 w-3.5 rounded-full object-cover"
                      />
                    )}
                    <span>{c.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Main Content Layout */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
            {/* Desktop Filter Sidebar */}
            <aside className="hidden lg:block shrink-0">
              <div className="sticky top-20">{filterPanel}</div>
            </aside>

            {/* Product Grid / Empty State */}
            <div>
              {filteredProducts.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No DDC items found"
                  description={
                    hasActiveFilters
                      ? 'Try clearing active filters to see available DDC products.'
                      : 'No DDC products are currently available in this section.'
                  }
                  action={
                    hasActiveFilters ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetFilters}
                      >
                        Reset filters
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <>
                  <div className="text-xs text-muted-foreground mb-4">
                    Showing {filteredProducts.length} item
                    {filteredProducts.length === 1 ? '' : 's'}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                    {filteredProducts.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={{
                          ...p,
                          catalogType: 'ddc',
                          variants: p.variants.map((v) => ({
                            ...v,
                            volumeMl: null,
                            abv: null,
                          })),
                        }}
                      />
                    ))}
                  </div>

                  {filteredProducts.length >= 50 && (
                    <div className="mt-12 flex justify-center">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious href="#" />
                          </PaginationItem>
                          <PaginationItem>
                            <PaginationLink href="#" isActive>
                              1
                            </PaginationLink>
                          </PaginationItem>
                          <PaginationItem>
                            <PaginationNext href="#" />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Filter Sheet */}
      <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
        <SheetContent
          side="left"
          className="w-80 p-6 flex flex-col justify-between"
        >
          <SheetHeader className="text-left border-b border-border pb-4">
            <SheetTitle className="text-sm font-semibold">
              Filter DDC
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-6">{filterPanel}</div>

          <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs"
            >
              Reset all
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setMobileFilterOpen(false)}
              className="text-xs"
            >
              Apply
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Footer />
    </div>
  )
}
