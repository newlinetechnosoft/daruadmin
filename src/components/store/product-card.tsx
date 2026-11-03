import { memo, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Heart,
  Wine,
  Package,
  Plus,
  Minus,
  Sparkles,
  ShoppingBag,
  ShieldCheck,
  Clock,
} from 'lucide-react'
import { useCart } from '#/lib/cart-context'
import { useIsFavorite, toggleFavorite } from '#/lib/favorites'
import { formatNPR } from '#/lib/money'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent } from '#/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '#/components/ui/dialog'
import {
  getFoodProductsFn,
  getGroceryProductsFn,
  getDdcProductsFn,
  getLiquorProductsFn,
} from '#/server/catalog/catalog.functions'

export interface Variant {
  id: string
  name: string
  price: number // in paisa
  mrp?: number | null
  compareAtPrice?: number | null
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
  customBadge?: string | null
  customDiscountLabel?: string | null
  categoryName?: string
  categorySlug?: string
  brandName?: string | null
  brandSlug?: string | null
  primaryImage?: string | null
  catalogType: 'liquor' | 'food' | 'grocery' | 'ddc'
  variants: Variant[]
}

export interface ProductCardProps {
  product: ProductProps
  suggestedProducts?: ProductProps[]
  className?: string
}

function ProductCardComponent({
  product,
  suggestedProducts,
  className = '',
}: ProductCardProps) {
  const { addItem, updateQuantity, getItemQuantity } = useCart()
  const isWishlisted = useIsFavorite(product.id)

  // Card variant state
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product.variants[0]?.id ?? '',
  )

  const activeVariant =
    product.variants.find((v) => v.id === selectedVariantId) ??
    product.variants[0]

  const qty = getItemQuantity(activeVariant.id)
  const isOutOfStock = activeVariant.stock <= 0
  const isMaxStockReached = qty >= activeVariant.stock

  const badgeLabel =
    product.customBadge?.trim() || (product.isFeatured ? 'Popular' : null)

  const discountPercent =
    activeVariant.mrp && activeVariant.mrp > activeVariant.price
      ? Math.round(
          ((activeVariant.mrp - activeVariant.price) / activeVariant.mrp) * 100,
        )
      : null

  const discountLabel =
    product.customDiscountLabel?.trim() ||
    (discountPercent ? `${discountPercent}% off` : null)

  const handleAddToCart = () => {
    if (isOutOfStock) return
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
      customBadge: badgeLabel,
      customDiscountLabel: discountLabel,
    })
    toast.success(`Added ${product.name} to cart`)
  }

  const handleDecrement = () => {
    updateQuantity(activeVariant.id, qty - 1)
  }

  const handleIncrement = () => {
    if (isMaxStockReached) return
    updateQuantity(activeVariant.id, qty + 1, activeVariant.stock)
  }

  const categoryLabel =
    product.categoryName ??
    product.brandName ??
    (product.catalogType === 'liquor' ? 'Beer & Spirits' : 'Food')

  const metaText = [
    activeVariant.volumeMl
      ? `${activeVariant.volumeMl}ml`
      : (activeVariant.quantity ?? activeVariant.name),
    activeVariant.abv ? `${activeVariant.abv}% ABV` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  // -------------------------------------------------------------
  // DETAIL MODAL STATE
  // -------------------------------------------------------------
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [modalProduct, setModalProduct] = useState<ProductProps>(product)
  const [modalVariantId, setModalVariantId] = useState<string>(
    product.variants[0]?.id ?? '',
  )
  const [modalQty, setModalQty] = useState<number>(1)

  const modalActiveVariant =
    modalProduct.variants.find((v) => v.id === modalVariantId) ??
    modalProduct.variants[0]

  const modalDiscountPercent =
    modalActiveVariant.mrp && modalActiveVariant.mrp > modalActiveVariant.price
      ? Math.round(
          ((modalActiveVariant.mrp - modalActiveVariant.price) /
            modalActiveVariant.mrp) *
            100,
        )
      : null

  const modalDiscountLabel =
    modalProduct.customDiscountLabel?.trim() ||
    (modalDiscountPercent ? `${modalDiscountPercent}% off` : null)

  const modalSavingsText =
    modalActiveVariant.mrp && modalActiveVariant.mrp > modalActiveVariant.price
      ? `Save ${formatNPR(modalActiveVariant.mrp - modalActiveVariant.price)}`
      : null

  const modalMetaText = [
    modalActiveVariant.volumeMl
      ? `${modalActiveVariant.volumeMl}ml`
      : (modalActiveVariant.quantity ?? modalActiveVariant.name),
    modalActiveVariant.abv ? `${modalActiveVariant.abv}% ABV` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  // Open Detail Modal
  const handleCardClick = () => {
    setModalProduct(product)
    setModalVariantId(selectedVariantId || product.variants[0]?.id || '')
    setModalQty(1)
    setIsDetailOpen(true)
  }

  // Fetch dynamic suggestions if modal is open and no custom suggestedProducts passed
  const { data: dynamicProducts } = useQuery<ProductProps[]>({
    queryKey: ['storefront', 'suggestions', modalProduct.catalogType],
    queryFn: async () => {
      if (modalProduct.catalogType === 'food') {
        return getFoodProductsFn({ data: {} })
      }
      if (modalProduct.catalogType === 'grocery') {
        return getGroceryProductsFn({ data: {} })
      }
      if (modalProduct.catalogType === 'ddc') {
        return getDdcProductsFn({ data: {} })
      }
      return getLiquorProductsFn({ data: {} })
    },
    enabled: isDetailOpen && !suggestedProducts,
    staleTime: 1000 * 60 * 5,
  })

  // Filter suggested items
  const suggestedList: ProductProps[] = useMemo(() => {
    if (suggestedProducts && suggestedProducts.length > 0) {
      return suggestedProducts
        .filter((p) => p.id !== modalProduct.id)
        .slice(0, 4)
    }

    if (dynamicProducts && dynamicProducts.length > 0) {
      return dynamicProducts
        .filter((p) => p.id !== modalProduct.id)
        .slice(0, 4)
    }

    return []
  }, [suggestedProducts, dynamicProducts, modalProduct.id])

  const handleModalAddToCart = () => {
    if (modalActiveVariant.stock <= 0) return
    addItem({
      id: modalActiveVariant.id,
      productId: modalProduct.id,
      productName: modalProduct.name,
      productSlug: modalProduct.slug,
      variantId: modalActiveVariant.id,
      variantName: modalActiveVariant.name,
      catalogType: modalProduct.catalogType,
      price: modalActiveVariant.price,
      mrp: modalActiveVariant.mrp,
      imageUrl: modalProduct.primaryImage,
      customBadge: modalProduct.customBadge,
      customDiscountLabel: modalDiscountLabel,
    })
  }

  const quickAddSuggested = (item: ProductProps) => {
    const v = item.variants[0]
    if (v.stock <= 0) {
      toast.error('Item is out of stock')
      return
    }
    addItem({
      id: v.id,
      productId: item.id,
      productName: item.name,
      productSlug: item.slug,
      variantId: v.id,
      variantName: v.name,
      catalogType: item.catalogType,
      price: v.price,
      mrp: v.mrp,
      imageUrl: item.primaryImage,
    })
    toast.success(`Added ${item.name} to cart`)
  }

  return (
    <>
      <Card
        onClick={handleCardClick}
        className={`group relative flex flex-col justify-between overflow-hidden transition-all duration-300 hover:border-amber-500/50 hover:shadow-xl bg-card border border-border/80 rounded-2xl cursor-pointer select-none ${className}`}
      >
        {/* 1. PRODUCT IMAGE CONTAINER (100% width, ZERO top/side margins) */}
        <div className="relative aspect-square w-full overflow-hidden bg-zinc-900/30 dark:bg-zinc-900/50 flex items-center justify-center p-0 m-0">
          {/* Top-Left Floating Badges */}
          <div className="absolute left-2.5 top-2.5 z-10 flex flex-col gap-1 items-start pointer-events-none">
            {discountLabel && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md text-emerald-400 bg-emerald-950/80 backdrop-blur-md border border-emerald-500/25 shadow-xs">
                {discountLabel}
              </span>
            )}
            {badgeLabel && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500 text-zinc-950 shadow-xs">
                {badgeLabel}
              </span>
            )}
          </div>

          {/* Top-Right Floating Wishlist Heart */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toggleFavorite(product.id)
            }}
            aria-label={
              isWishlisted
                ? `Remove ${product.name} from favorites`
                : `Add ${product.name} to favorites`
            }
            className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 hover:bg-black/85 text-white/80 hover:text-white backdrop-blur-md transition-all active:scale-90 border border-white/10 shadow-xs cursor-pointer"
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                isWishlisted
                  ? 'fill-rose-500 text-rose-500'
                  : 'text-white/80 hover:text-white'
              }`}
            />
          </button>

          {/* Product Image (Flush 100% to card top and sides) */}
          {product.primaryImage ? (
            <img
              src={product.primaryImage}
              alt={product.name}
              className="w-full h-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
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

        {/* 2. PRODUCT INFO & DETAILS (Consistent stylish padding, gap & perfect alignment) */}
        <CardContent className="p-3.5 sm:p-4 flex flex-1 flex-col justify-between space-y-3">
          <div className="space-y-1">
            {/* Category / Brand */}
            <div className="text-[11px] font-medium text-muted-foreground tracking-wide line-clamp-1 uppercase">
              {categoryLabel}
            </div>

            {/* Product Title */}
            <h3 className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-amber-500 transition-colors">
              {product.name}
            </h3>

            {/* Meta Text: Volume & ABV */}
            {metaText && (
              <p className="text-xs text-muted-foreground font-mono">
                {metaText}
              </p>
            )}

            {/* Description (subtle italic 1 line if present) */}
            {product.description && (
              <p
                className="text-[11px] text-muted-foreground/80 line-clamp-1 italic"
                title={product.description}
              >
                {product.description}
              </p>
            )}

            {/* Variant selector pills (Maintains baseline gap so all cards align) */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 min-h-[26px]">
              {product.variants.length > 1 ? (
                product.variants.map((v) => {
                  const isSelected = v.id === activeVariant.id
                  const label = v.volumeMl
                    ? `${v.volumeMl}ml`
                    : (v.quantity ?? v.name)
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedVariantId(v.id)
                      }}
                      className={`h-6 px-2.5 text-[11px] rounded-md transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-zinc-950 font-bold shadow-xs'
                          : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-medium border border-border/40'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })
              ) : (
                <span className="text-[11px] text-muted-foreground/60 italic">
                  Standard size
                </span>
              )}
            </div>
          </div>

          {/* 3. BOTTOM ROW: PRICE & ORANGE ADD BUTTON */}
          <div className="pt-2.5 border-t border-border/40 flex items-center justify-between gap-2">
            {/* Price display */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold text-foreground font-mono">
                {formatNPR(activeVariant.price)}
              </span>
              {(activeVariant.compareAtPrice || activeVariant.mrp) &&
                (activeVariant.compareAtPrice || activeVariant.mrp)! >
                  activeVariant.price && (
                  <span className="text-xs text-muted-foreground line-through font-mono">
                    {formatNPR(
                      activeVariant.compareAtPrice || activeVariant.mrp!,
                    )}
                  </span>
                )}
            </div>

            {/* Interactive Add Button / Quantity Stepper */}
            {qty >= 1 ? (
              <div
                className="flex items-center justify-between h-8 w-24 rounded-lg border border-amber-500/50 bg-amber-500/10 px-1"
                onClick={(e) => e.stopPropagation()}
                role="group"
                aria-label={`Quantity for ${product.name}`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDecrement()
                  }}
                  aria-label={`Decrease quantity`}
                  className="flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>

                <span
                  aria-live="polite"
                  className="text-xs font-bold font-mono text-amber-500 min-w-4 text-center select-none"
                >
                  {qty}
                </span>

                <button
                  type="button"
                  disabled={isMaxStockReached}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleIncrement()
                  }}
                  aria-label={`Increase quantity`}
                  className={`flex items-center justify-center h-6 w-6 rounded transition-colors ${
                    isMaxStockReached
                      ? 'text-muted-foreground/30 cursor-not-allowed'
                      : 'text-muted-foreground hover:text-foreground cursor-pointer'
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isOutOfStock}
                onClick={(e) => {
                  e.stopPropagation()
                  handleAddToCart()
                }}
                aria-label={
                  isOutOfStock
                    ? `${product.name} is out of stock`
                    : `Add ${product.name} to cart`
                }
                className={`h-8 px-4 rounded-lg text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer ${
                  isOutOfStock
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold'
                }`}
              >
                {isOutOfStock ? 'Sold out' : 'Add'}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* -------------------------------------------------------------
          PRODUCT DETAIL MODAL DIALOG (Opens on Card Click)
      ------------------------------------------------------------- */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl w-[calc(100%-2rem)] max-h-[92vh] flex flex-col p-0 overflow-hidden bg-card text-card-foreground border-border/80 shadow-2xl rounded-2xl">
          {/* Header */}
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 shrink-0 bg-muted/15 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                {modalProduct.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {modalProduct.categoryName || categoryLabel}{' '}
                {modalProduct.brandName ? `· ${modalProduct.brandName}` : ''}
              </DialogDescription>
            </div>
          </DialogHeader>

          {/* Modal Scrollable Body */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 click-scroll">
            {/* Top Grid: Image + Buy Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Left Column: Image */}
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-zinc-900/40 border border-border/50 flex items-center justify-center p-4">
                {modalProduct.primaryImage ? (
                  <img
                    src={modalProduct.primaryImage}
                    alt={modalProduct.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Wine className="h-20 w-20 text-muted-foreground stroke-1" />
                )}

                {modalDiscountLabel && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-emerald-500 text-zinc-950 text-xs font-bold shadow-md">
                    {modalDiscountLabel}
                  </div>
                )}
              </div>

              {/* Right Column: Info & Actions */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant="outline" className="text-xs font-mono uppercase">
                      {modalProduct.catalogType}
                    </Badge>
                    <span className="text-xs text-emerald-500 font-medium flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      {modalActiveVariant.stock > 0
                        ? 'In Stock · Ready to deliver'
                        : 'Currently Out of Stock'}
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {modalProduct.name}
                  </h2>

                  {modalMetaText && (
                    <p className="text-sm text-muted-foreground font-mono mt-1">
                      {modalMetaText}
                    </p>
                  )}
                </div>

                {/* Price Box */}
                <div className="p-4 rounded-xl bg-muted/30 border border-border/60 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-black text-foreground font-mono">
                      {formatNPR(modalActiveVariant.price)}
                    </span>
                    {(modalActiveVariant.compareAtPrice ||
                      modalActiveVariant.mrp) &&
                      (modalActiveVariant.compareAtPrice ||
                        modalActiveVariant.mrp)! > modalActiveVariant.price && (
                        <span className="ml-2.5 text-sm text-muted-foreground line-through font-mono">
                          {formatNPR(
                            modalActiveVariant.compareAtPrice ||
                              modalActiveVariant.mrp!,
                          )}
                        </span>
                      )}
                  </div>

                  {modalSavingsText && (
                    <Badge
                      variant="secondary"
                      className="text-emerald-500 font-bold text-xs"
                    >
                      {modalSavingsText}
                    </Badge>
                  )}
                </div>

                {/* Variant Switcher */}
                {modalProduct.variants.length > 1 && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">
                      Select Variant / Size:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {modalProduct.variants.map((v) => {
                        const isSel = v.id === modalActiveVariant.id
                        const label = v.volumeMl
                          ? `${v.volumeMl}ml`
                          : (v.quantity ?? v.name)
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setModalVariantId(v.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                              isSel
                                ? 'bg-amber-500 border-amber-500 text-zinc-950 font-bold shadow-xs'
                                : 'bg-muted/40 hover:bg-muted text-foreground border-border'
                            }`}
                          >
                            {label} — {formatNPR(v.price)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Description & Tasting Notes */}
                <div className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
                  <h4 className="font-semibold text-foreground text-xs">
                    Product Description
                  </h4>
                  <p>
                    {modalProduct.description ||
                      `Authentic, premium ${modalProduct.name}. Sourced through verified licensed distributors and delivered fresh and chilled to your location.`}
                  </p>
                </div>

                {/* Guarantee perks */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    <span>30–45 Mins Cold Delivery</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    <span>100% Verified Quality</span>
                  </div>
                </div>

                {/* Add to Cart Actions */}
                <div className="pt-3 border-t border-border flex items-center gap-3">
                  <div className="flex items-center h-10 border border-border rounded-lg bg-muted/40 px-2">
                    <button
                      type="button"
                      onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                      className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold font-mono">
                      {modalQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setModalQty((q) => q + 1)}
                      className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <Button
                    className="flex-1 h-10 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-sm shadow-xs gap-2 cursor-pointer"
                    onClick={() => {
                      for (let i = 0; i < modalQty; i++) {
                        handleModalAddToCart()
                      }
                      toast.success(
                        `Added ${modalQty}x ${modalProduct.name} to cart`,
                      )
                      setIsDetailOpen(false)
                    }}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Add to Cart —{' '}
                    {formatNPR(modalActiveVariant.price * modalQty)}
                  </Button>
                </div>
              </div>
            </div>

            {/* Suggested Other Items ("suggested other items. make dynamic.") */}
            {suggestedList.length > 0 && (
              <div className="space-y-3 pt-6 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-bold text-foreground">
                      Suggested Other Items
                    </h3>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Frequently paired together
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {suggestedList.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setModalProduct(item)
                        setModalVariantId(item.variants[0]?.id ?? '')
                        setModalQty(1)
                      }}
                      className="group/suggested p-2.5 rounded-xl border border-border/60 bg-muted/20 hover:border-amber-500/40 hover:bg-muted/40 transition-all flex flex-col justify-between cursor-pointer"
                    >
                      <div className="relative aspect-square w-full rounded-lg bg-zinc-900/30 overflow-hidden mb-2 flex items-center justify-center">
                        {item.primaryImage ? (
                          <img
                            src={item.primaryImage}
                            alt={item.name}
                            className="w-full h-full object-contain group-hover/suggested:scale-105 transition-transform"
                          />
                        ) : (
                          <Wine className="h-8 w-8 text-muted-foreground stroke-1" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold text-foreground line-clamp-1 group-hover/suggested:text-amber-500">
                          {item.name}
                        </h4>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">
                          {item.variants[0]?.volumeMl
                            ? `${item.variants[0].volumeMl}ml`
                            : item.variants[0]?.name}
                        </p>
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-between">
                        <span className="text-xs font-bold font-mono">
                          {formatNPR(item.variants[0].price)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            quickAddSuggested(item)
                          }}
                          className="h-6 px-2 rounded-md bg-amber-500 hover:bg-amber-600 text-zinc-950 text-[10px] font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export const ProductCard = memo(ProductCardComponent)
