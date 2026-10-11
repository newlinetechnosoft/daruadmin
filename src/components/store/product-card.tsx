import { memo, useState } from 'react'
import { useCart } from '#/lib/cart-context'
import { useIsFavorite, toggleFavorite } from '#/lib/favorites'
import { formatNPR } from '#/lib/money'
import { Heart, Wine, Package, Plus, Minus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent } from '#/components/ui/card'

export interface Variant {
  id: string
  name: string
  price: number // in paisa
  mrp?: number | null
  volumeMl?: number | null
  unit?: string | null
  quantity?: string | null
  abv?: string | null
  stock: number
  isActive: boolean
}

export interface ProductProps {
  id: string
  name: string
  slug: string
  description?: string | null
  isFeatured?: boolean
  categoryName?: string
  categorySlug?: string
  brandName?: string | null
  brandSlug?: string | null
  primaryImage?: string | null
  catalogType: 'liquor' | 'grocery'
  variants: Variant[]
}

function ProductCardComponent({ product }: { product: ProductProps }) {
  const { addItem, updateQuantity, getItemQuantity } = useCart()
  const isWishlisted = useIsFavorite(product.id)
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product.variants[0]?.id ?? '',
  )

  const activeVariant =
    product.variants.find((v) => v.id === selectedVariantId) ??
    product.variants[0]

  const qty = activeVariant ? getItemQuantity(activeVariant.id) : 0
  const isOutOfStock = !activeVariant || activeVariant.stock <= 0
  const isMaxStockReached = Boolean(activeVariant && qty >= activeVariant.stock)

  const handleAddToCart = () => {
    if (!activeVariant || isOutOfStock) return
    addItem({
      id: activeVariant.id,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      variantId: activeVariant.id,
      variantName: activeVariant.name,
      catalogType: product.catalogType,
      price: activeVariant.price,
      mrp: activeVariant.mrp,
      imageUrl: product.primaryImage,
    })
  }

  const handleDecrement = () => {
    if (!activeVariant) return
    updateQuantity(activeVariant.id, qty - 1)
  }

  const handleIncrement = () => {
    if (!activeVariant || isMaxStockReached) return
    updateQuantity(activeVariant.id, qty + 1, activeVariant.stock)
  }

  const discountPercent =
    activeVariant?.mrp && activeVariant.mrp > activeVariant.price
      ? Math.round(
          ((activeVariant.mrp - activeVariant.price) / activeVariant.mrp) * 100,
        )
      : null

  const categoryLabel =
    product.categoryName ??
    product.brandName ??
    (product.catalogType === 'liquor' ? 'Spirits' : 'Food')

  const metaText = activeVariant
    ? [
        activeVariant.volumeMl
          ? `${activeVariant.volumeMl}ml`
          : (activeVariant.quantity ?? activeVariant.name),
        activeVariant.abv ? `${activeVariant.abv}% ABV` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <Card className="group relative flex flex-col justify-between overflow-hidden transition-all hover:border-foreground/20">
      {/* Product Image Container */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted/40 p-4 flex items-center justify-center">
        {/* Badges */}
        <div className="absolute left-3 top-3 z-10 flex flex-col gap-1">
          {product.isFeatured && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5">
              Popular
            </Badge>
          )}
          {discountPercent && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-5 font-semibold"
            >
              {discountPercent}% off
            </Badge>
          )}
        </div>

        {/* Wishlist / Favorite Button (local-only IndexedDB, works for guests too) */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => toggleFavorite(product.id)}
          aria-label={
            isWishlisted
              ? `Remove ${product.name} from favorites`
              : `Add ${product.name} to favorites`
          }
          className="absolute right-2 top-2 z-10 h-8 w-8 min-h-[40px] min-w-[40px] sm:min-h-[32px] sm:min-w-[32px] rounded-full bg-background/80 hover:bg-background text-muted-foreground shadow-xs flex items-center justify-center cursor-pointer"
        >
          <Heart
            className={`h-4 w-4 transition-colors ${
              isWishlisted
                ? 'fill-destructive text-destructive'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          />
        </Button>

        {/* Product Image */}
        {product.primaryImage ? (
          <img
            src={product.primaryImage}
            alt={product.name}
            className="h-[85%] w-[85%] object-contain transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            {product.catalogType === 'liquor' ? (
              <Wine className="h-12 w-12 stroke-1" />
            ) : (
              <Package className="h-12 w-12 stroke-1" />
            )}
          </div>
        )}
      </div>

      {/* Product Info */}
      <CardContent className="p-3.5 flex flex-1 flex-col justify-between">
        <div className="space-y-1">
          <span className="text-[10px] font-medium text-muted-foreground tracking-wide">
            {categoryLabel}
          </span>

          <h3 className="text-xs font-semibold text-foreground line-clamp-1">
            {product.name}
          </h3>

          {metaText && (
            <p className="text-[11px] text-muted-foreground">{metaText}</p>
          )}

          {/* Volume variants selector (if multiple) */}
          {product.variants.length > 1 && (
            <div className="pt-1.5 flex flex-wrap gap-1">
              {product.variants.map((v) => {
                const isSelected = v.id === activeVariant?.id
                const label = v.volumeMl
                  ? `${v.volumeMl}ml`
                  : (v.quantity ?? v.name)
                return (
                  <Button
                    key={v.id}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedVariantId(v.id)}
                    className="h-5 px-1.5 text-[10px] font-normal"
                  >
                    {label}
                  </Button>
                )
              })}
            </div>
          )}
        </div>

        {/* Price and Add/Stepper button */}
        <div className="mt-3 pt-2.5 flex items-center justify-between border-t border-border">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-semibold text-foreground font-mono">
              {activeVariant ? formatNPR(activeVariant.price) : '—'}
            </span>
            {activeVariant?.mrp && activeVariant.mrp > activeVariant.price && (
              <span className="text-[10px] text-muted-foreground line-through font-mono">
                {formatNPR(activeVariant.mrp)}
              </span>
            )}
          </div>

          {/* In-place Stepper or Add button with matching dimensions */}
          {qty >= 1 ? (
            <div
              className="flex items-center justify-between h-8 w-24 rounded-md border border-primary/40 bg-muted/40 px-1"
              role="group"
              aria-label={`Quantity for ${product.name}`}
            >
              <button
                type="button"
                onClick={handleDecrement}
                aria-label={`Decrease quantity of ${product.name} (${activeVariant?.name})`}
                className="flex items-center justify-center h-7 w-7 min-h-[36px] min-w-[36px] sm:min-h-[28px] sm:min-w-[28px] rounded text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors cursor-pointer"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>

              <span
                aria-live="polite"
                className="text-xs font-bold font-mono text-foreground min-w-5 text-center select-none"
              >
                {qty}
              </span>

              <button
                type="button"
                disabled={isMaxStockReached}
                onClick={handleIncrement}
                title={isMaxStockReached ? 'Max available' : undefined}
                aria-label={
                  isMaxStockReached
                    ? `Max stock reached for ${product.name}`
                    : `Increase quantity of ${product.name} (${activeVariant?.name})`
                }
                className={`flex items-center justify-center h-7 w-7 min-h-[36px] min-w-[36px] sm:min-h-[28px] sm:min-w-[28px] rounded transition-colors ${
                  isMaxStockReached
                    ? 'text-muted-foreground/30 cursor-not-allowed'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/80 cursor-pointer'
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={isOutOfStock}
              onClick={handleAddToCart}
              aria-label={
                isOutOfStock
                  ? `${product.name} is out of stock`
                  : `Add ${product.name} to cart`
              }
              className="h-8 w-24 text-[11px] font-medium"
            >
              {isOutOfStock ? 'Sold out' : 'Add'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export const ProductCard = memo(ProductCardComponent)
