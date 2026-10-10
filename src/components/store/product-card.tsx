import { useState } from 'react'
import { useCart } from '#/lib/cart-context'
import { formatNPR } from '#/lib/money'
import { Check, Heart, Wine, Package } from 'lucide-react'
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

export function ProductCard({ product }: { product: ProductProps }) {
  const { addItem, items } = useCart()
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product.variants[0]?.id ?? '',
  )
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  const activeVariant =
    product.variants.find((v) => v.id === selectedVariantId) ??
    product.variants[0]

  const inCart = items.find((i) => i.variantId === activeVariant.id)

  const handleAddToCart = () => {
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
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1200)
  }

  const discountPercent =
    activeVariant.mrp && activeVariant.mrp > activeVariant.price
      ? Math.round(
          ((activeVariant.mrp - activeVariant.price) / activeVariant.mrp) * 100,
        )
      : null

  const categoryLabel =
    product.categoryName ??
    product.brandName ??
    (product.catalogType === 'liquor' ? 'Spirits' : 'Food')

  const metaText = [
    activeVariant.volumeMl
      ? `${activeVariant.volumeMl}ml`
      : (activeVariant.quantity ?? activeVariant.name),
    activeVariant.abv ? `${activeVariant.abv}% ABV` : null,
  ]
    .filter(Boolean)
    .join(' · ')

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
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-semibold">
              {discountPercent}% off
            </Badge>
          )}
        </div>

        {/* Wishlist Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setIsWishlisted(!isWishlisted)}
          aria-label="Add to wishlist"
          className="absolute right-2 top-2 z-10 h-7 w-7 rounded-full bg-background/80 hover:bg-background text-muted-foreground shadow-xs"
        >
          <Heart
            className={`h-3.5 w-3.5 transition-colors ${
              isWishlisted
                ? 'fill-rose-500 text-rose-500'
                : 'text-muted-foreground'
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
                const isSelected = v.id === activeVariant.id
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

        {/* Price and Add button */}
        <div className="mt-3 pt-2.5 flex items-center justify-between border-t border-border">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-semibold text-foreground font-mono">
              {formatNPR(activeVariant.price)}
            </span>
            {activeVariant.mrp && activeVariant.mrp > activeVariant.price && (
              <span className="text-[10px] text-muted-foreground line-through font-mono">
                {formatNPR(activeVariant.mrp)}
              </span>
            )}
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleAddToCart}
            variant={justAdded ? 'secondary' : inCart ? 'outline' : 'default'}
            className="h-7 px-2.5 text-[11px] font-medium"
          >
            {justAdded ? (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" /> Added
              </span>
            ) : inCart ? (
              `In cart (${inCart.quantity})`
            ) : (
              'Add'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
