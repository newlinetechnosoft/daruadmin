import { useState } from 'react'
import { useCart } from '#/lib/cart-context'
import { formatNPR } from '#/lib/money'
import { Check } from 'lucide-react'

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

  const categoryLabel = (
    product.categoryName ??
    product.brandName ??
    (product.catalogType === 'liquor' ? 'SPIRITS' : 'FOOD')
  ).toUpperCase()

  const metaText = [
    activeVariant.volumeMl
      ? `${activeVariant.volumeMl}ml`
      : (activeVariant.quantity ?? activeVariant.name),
    activeVariant.abv ? `${activeVariant.abv}% ABV` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <article className="group relative min-w-0 flex flex-col justify-between">
      {/* PRODUCT IMAGE CONTAINER */}
      <div className="relative aspect-square w-full overflow-hidden rounded-[5px] bg-[#f4f3ef] flex items-center justify-center p-3">
        {/* Subtle shine overlay matching drinks.html */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/35 via-transparent to-transparent pointer-events-none z-10" />

        {/* Badge */}
        {product.isFeatured ? (
          <span className="absolute left-3 top-3 z-20 px-2 py-1 bg-[#171717] text-white text-[9px] font-bold uppercase tracking-[0.08em] select-none">
            Popular
          </span>
        ) : discountPercent ? (
          <span className="absolute left-3 top-3 z-20 px-2 py-1 bg-[#d8ff38] text-[#111] text-[9px] font-bold uppercase tracking-[0.08em] select-none">
            {discountPercent}% OFF
          </span>
        ) : null}

        {/* Wishlist Heart button */}
        <button
          type="button"
          onClick={() => setIsWishlisted(!isWishlisted)}
          aria-label="Add to wishlist"
          className="absolute right-3 top-3 z-20 h-8 w-8 rounded-full bg-white/90 grid place-items-center text-sm transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm border-0 cursor-pointer"
        >
          <span
            className={isWishlisted ? 'text-rose-600 font-bold' : 'text-[#555]'}
          >
            {isWishlisted ? '♥' : '♡'}
          </span>
        </button>

        {/* Product image */}
        {product.primaryImage ? (
          <img
            src={product.primaryImage}
            alt={product.name}
            className="w-[78%] h-[88%] object-contain transition-transform duration-400 ease-out group-hover:scale-106"
            loading="lazy"
          />
        ) : (
          <div className="w-[78%] h-[88%] flex items-center justify-center text-5xl select-none">
            {product.catalogType === 'liquor' ? '🍾' : '🥟'}
          </div>
        )}
      </div>

      {/* PRODUCT INFO */}
      <div className="pt-3.5 flex flex-col flex-1">
        <div className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#999]">
          {categoryLabel}
        </div>

        <h2 className="mt-1 text-sm font-semibold leading-[1.3] text-[#181818] line-clamp-1">
          {product.name}
        </h2>

        <p className="mt-1 text-[11px] text-[#888]">{metaText}</p>

        {/* Volume variants selector (if multiple) */}
        {product.variants.length > 1 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {product.variants.map((v) => {
              const isSelected = v.id === activeVariant.id
              const label = v.volumeMl
                ? `${v.volumeMl}ml`
                : (v.quantity ?? v.name)
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVariantId(v.id)}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded-[3px] transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#171717] text-white'
                      : 'border border-[#dedbd4] bg-white text-[#666] hover:border-[#171717] hover:text-[#111]'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {/* BOTTOM ROW: Price and Add button */}
        <div className="mt-3 pt-1 flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-[#181818]">
              {formatNPR(activeVariant.price)}
            </span>
            {activeVariant.mrp && activeVariant.mrp > activeVariant.price && (
              <span className="text-[10px] text-[#999] line-through">
                {formatNPR(activeVariant.mrp)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            className={`px-3.5 py-2 rounded-[3px] text-[10px] font-semibold tracking-wider uppercase transition-all duration-200 cursor-pointer flex items-center gap-1 active:scale-95 ${
              justAdded
                ? 'bg-[#d8ff38] text-[#111] font-bold'
                : inCart
                  ? 'bg-[#171717] text-[#d8ff38] hover:bg-[#d8ff38] hover:text-[#111]'
                  : 'bg-[#171717] text-white hover:bg-[#d8ff38] hover:text-[#111]'
            }`}
          >
            {justAdded ? (
              <>
                <Check className="h-3 w-3" /> ADDED
              </>
            ) : inCart ? (
              `IN CART (${inCart.quantity})`
            ) : (
              'ADD TO CART'
            )}
          </button>
        </div>
      </div>
    </article>
  )
}
