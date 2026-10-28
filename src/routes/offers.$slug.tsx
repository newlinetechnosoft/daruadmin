import { createFileRoute, Link } from '@tanstack/react-router'
import { getOfferBySlugFn } from '#/server/operations/operations.functions'
import { storefrontQueries } from '#/queries/storefront'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { ProductCard } from '#/components/store/product-card'
import type { ProductProps } from '#/components/store/product-card'
import { formatNPR } from '#/lib/money'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '#/components/ui/breadcrumb'
import { EmptyState } from '#/components/shared/empty-state'
import {
  AlertCircle,
  ArrowRight,
  Gift,
  Percent,
  Sparkles,
  Tag,
  Truck,
} from 'lucide-react'

export const Route = createFileRoute('/offers/$slug')({
  loader: async ({ params, context }) => {
    try {
      const offer = await getOfferBySlugFn({ data: { slug: params.slug } })

      // Fetch products to display
      const [liquorProducts, groceryProducts] = await Promise.all([
        context.queryClient.ensureQueryData(
          storefrontQueries.liquorProducts({ limit: 50 }),
        ),
        context.queryClient.ensureQueryData(
          storefrontQueries.groceryProducts({ limit: 50 }),
        ),
      ])

      const allProducts: ProductProps[] = [
        ...liquorProducts.map((p: any) => ({
          ...p,
          catalogType: 'liquor' as const,
        })),
        ...groceryProducts.map((p: any) => ({
          ...p,
          catalogType: 'grocery' as const,
        })),
      ]

      // Filter products based on offer scope
      let matchingProducts = allProducts
      if (offer.scope === 'category' && offer.scopeId) {
        matchingProducts = allProducts.filter(
          (p: any) =>
            p.categoryId === offer.scopeId || p.categorySlug === offer.scopeId,
        )
      } else if (offer.scope === 'brand' && offer.scopeId) {
        matchingProducts = allProducts.filter(
          (p: any) =>
            p.brandId === offer.scopeId || p.brandSlug === offer.scopeId,
        )
      } else if (offer.scope === 'product' && offer.scopeId) {
        matchingProducts = allProducts.filter(
          (p: any) => p.id === offer.scopeId || p.slug === offer.scopeId,
        )
      }

      return { offer, products: matchingProducts, error: null }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Offer not found'
      return { offer: null, products: [], error: msg }
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.offer
          ? `${loaderData.offer.title} — Mezmani Nepal`
          : 'Exclusive Offers — Mezmani Nepal',
      },
      {
        name: 'description',
        content:
          loaderData?.offer?.description ||
          'Exclusive promotions, festive discounts, and BOGO offers at Mezmani.',
      },
    ],
  }),
  component: OfferDetailPage,
})

function OfferDetailPage() {
  const { offer, products, error } = Route.useLoaderData()

  if (error || !offer) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">
                Offer Unavailable
              </h2>
              <p className="text-xs text-muted-foreground">
                {error ||
                  'The requested promotion has ended or is temporarily unavailable.'}
              </p>
            </div>
            <Button size="sm" asChild className="gap-1.5">
              <Link to="/drinks">
                Explore All Drinks
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  const getOfferBadge = () => {
    switch (offer.type) {
      case 'bogo':
        return {
          icon: Gift,
          label: 'Buy 1 Get 1 Free',
          color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
        }
      case 'percent':
        return {
          icon: Percent,
          label: `${offer.discountValue}% OFF`,
          color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        }
      case 'free_delivery':
        return {
          icon: Truck,
          label: 'FREE DELIVERY',
          color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
        }
      case 'fixed':
        return {
          icon: Tag,
          label: `Rs. ${offer.discountValue / 100} Flat Discount`,
          color: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
        }
      default:
        return {
          icon: Sparkles,
          label: 'Special Promotion',
          color: 'bg-primary/10 text-primary border-primary/20',
        }
    }
  }

  const badge = getOfferBadge()
  const BadgeIcon = badge.icon

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Breadcrumb Navigation */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/drinks">Offers</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{offer.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Hero Banner Section */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/40 p-6 sm:p-10">
          <div className="relative z-10 max-w-2xl space-y-4">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.color}`}
            >
              <BadgeIcon className="h-3.5 w-3.5" />
              <span>{badge.label}</span>
            </span>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {offer.heading || offer.title}
            </h1>

            {offer.description && (
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {offer.description}
              </p>
            )}

            {offer.minOrderAmount > 0 && (
              <p className="text-xs text-muted-foreground font-mono">
                * Minimum order amount: {formatNPR(offer.minOrderAmount)}
              </p>
            )}
          </div>

          {offer.bannerUrl && (
            <div className="mt-4 sm:mt-0 sm:absolute sm:right-6 sm:top-6 sm:bottom-6 sm:w-1/3 rounded-xl overflow-hidden shadow-sm border border-border/50">
              <img
                src={offer.bannerUrl}
                alt={offer.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Products Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Eligible Items for this Offer
              </h2>
              <p className="text-xs text-muted-foreground">
                Discounts automatically apply at checkout
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {products.length} products
            </Badge>
          </div>

          {products.length === 0 ? (
            <EmptyState
              title="No products available"
              description="There are currently no items available under this promotion."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
