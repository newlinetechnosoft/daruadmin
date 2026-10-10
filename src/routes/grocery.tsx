import { useState, useMemo } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import {
  getGroceryCategoriesFn,
  getGroceryProductsFn,
} from '#/server/catalog/catalog.functions'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { ProductCard } from '#/components/store/product-card'
import type { ProductProps } from '#/components/store/product-card'
import { ShoppingBag, RotateCcw, SlidersHorizontal } from 'lucide-react'
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

const grocerySearchSchema = z.object({
  category: z.string().optional(),
  query: z.string().optional(),
})

export const Route = createFileRoute('/grocery')({
  validateSearch: (search) => grocerySearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    category: search.category,
    query: search.query,
  }),
  loader: async ({ deps }) => {
    const [categories, products] = await Promise.all([
      getGroceryCategoriesFn(),
      getGroceryProductsFn({
        data: {
          categorySlug: deps.category,
          query: deps.query,
          limit: 50,
          offset: 0,
        },
      }),
    ])

    return {
      categories,
      products,
    }
  },
  component: GroceryPage,
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

function GroceryPage() {
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
      to: '/grocery',
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
      to: '/grocery',
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
              name: 'All Grocery & Food',
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
              <Button
                key={cat.key}
                type="button"
                variant={active ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleCategorySelect(cat.slug)}
                className={`w-full justify-between h-8 px-2.5 text-xs font-normal ${
                  active ? 'font-medium text-foreground' : 'text-muted-foreground'
                }`}
              >
                <span>{cat.name}</span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {cat.count}
                </span>
              </Button>
            )
          })}
        </div>
      </div>

      {/* Price */}
      <div className="border-t border-border pt-6">
        <GroupTitle>Price Range</GroupTitle>
        <div className="space-y-2.5">
          {PRICE_OPTIONS.map((p) => (
            <CheckRow
              key={p.id}
              id={`price-${p.id}`}
              label={p.label}
              checked={selectedPriceRange === p.id}
              onChange={() =>
                setSelectedPriceRange(selectedPriceRange === p.id ? null : p.id)
              }
            />
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground antialiased">
      <Header />

      <main className="flex-1">
        {/* Page Hero */}
        <section className="border-b border-border bg-muted/20 py-8 sm:py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Breadcrumb className="mb-4">
              <BreadcrumbList className="text-xs">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {activeCategoryObj ? (
                    <BreadcrumbLink asChild>
                      <Link to="/grocery">Food &amp; Grocery</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>Food &amp; Grocery</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {activeCategoryObj && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{activeCategoryObj.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>

            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {activeCategoryObj ? activeCategoryObj.name : 'Food & Grocery'}
            </h1>

            <p className="mt-2 max-w-lg text-xs leading-relaxed text-muted-foreground">
              {activeCategoryObj?.description ??
                'Delicious appetizers, hot meals, late-night munchies, and bar snacks delivered fresh.'}
            </p>
          </div>
        </section>

        {/* Shop Area */}
        <section className="py-8 sm:py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground font-mono">
                  {filteredProducts.length}
                </span>{' '}
                of {products.length} products
              </p>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMobileFilterOpen(true)}
                  className="gap-2 text-xs md:hidden"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                </Button>

                <div className="flex items-center gap-2">
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    Sort by
                  </span>
                  <NativeSelect
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="h-8 text-xs"
                  >
                    <option value="recommended">Recommended</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="newest">Newest</option>
                  </NativeSelect>
                </div>
              </div>
            </div>

            {/* Sidebar + Grid */}
            <div className="grid grid-cols-1 gap-8 pt-8 md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr] lg:gap-12">
              <aside className="hidden md:block">
                <div className="sticky top-20">
                  {filterPanel}

                  {hasActiveFilters && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResetFilters}
                      className="mt-6 gap-2 text-xs text-muted-foreground hover:text-foreground w-full justify-start px-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reset all filters
                    </Button>
                  )}
                </div>
              </aside>

              <section>
                {filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
                    {filteredProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product as ProductProps}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={ShoppingBag}
                    title="No groceries match your filters"
                    description="Try clearing some filters or searching for another item."
                    action={
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleResetFilters}
                        className="text-xs"
                      >
                        Clear all filters
                      </Button>
                    }
                  />
                )}

                {/* Real shadcn Pagination component */}
                {filteredProducts.length > 0 && (
                  <Pagination className="mt-12 sm:mt-16">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => e.preventDefault()}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          isActive
                          onClick={(e) => e.preventDefault()}
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => e.preventDefault()}
                        >
                          2
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => e.preventDefault()}
                        >
                          3
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => e.preventDefault()}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </section>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile Filter Sheet */}
      <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
        <SheetContent side="left" className="w-80 p-6 flex flex-col justify-between">
          <SheetHeader className="text-left border-b border-border pb-4">
            <SheetTitle className="text-sm font-semibold">Filter groceries</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-6">
            {filterPanel}
          </div>

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
