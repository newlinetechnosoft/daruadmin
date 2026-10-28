import { useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '#/components/ui/sheet'
import { Separator } from '#/components/ui/separator'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Progress } from '#/components/ui/progress'
import { useCart } from '#/lib/cart-context'
import { useNavigate } from '@tanstack/react-router'
import { formatNPR } from '#/lib/money'
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Bike,
  ArrowRight,
  ShieldCheck,
  Package,
} from 'lucide-react'

const FREE_DELIVERY_THRESHOLD = 300000 // Rs. 3,000 in paisa

export function CartSheet() {
  const {
    items,
    isOpen,
    setIsOpen,
    updateQuantity,
    removeItem,
    totalPaisa,
    clearCart,
  } = useCart()
  const navigate = useNavigate()

  const totalSavingsPaisa = useMemo(() => {
    return items.reduce((sum, item) => {
      if (item.mrp && item.mrp > item.price) {
        return sum + (item.mrp - item.price) * item.quantity
      }
      return sum
    }, 0)
  }, [items])

  const freeDeliveryProgress = Math.min(
    100,
    Math.round((totalPaisa / FREE_DELIVERY_THRESHOLD) * 100),
  )
  const remainingForFree = Math.max(0, FREE_DELIVERY_THRESHOLD - totalPaisa)

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border p-4 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold text-foreground">
                  Your cart
                </SheetTitle>
                <p className="text-xs text-muted-foreground">
                  {items.length === 0
                    ? 'Cart is empty'
                    : `${items.reduce((acc, i) => acc + i.quantity, 0)} items selected`}
                </p>
              </div>
            </div>

            {items.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearCart}
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
              >
                Clear all
              </Button>
            )}
          </div>

          {/* Free delivery status bar */}
          {items.length > 0 && (
            <div className="mt-3 rounded-lg border border-border bg-background p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Bike className="h-3.5 w-3.5 text-primary" />
                  {remainingForFree === 0
                    ? 'Free 40-minute express delivery unlocked'
                    : `Add ${formatNPR(remainingForFree)} more for free delivery`}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {freeDeliveryProgress}%
                </span>
              </div>
              <Progress value={freeDeliveryProgress} className="h-1.5" />
            </div>
          )}
        </SheetHeader>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">
                Your cart is empty
              </h3>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Discover our selection of spirits, cold beers, wines, and
                late-night snacks.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-4 text-xs"
                onClick={() => setIsOpen(false)}
              >
                Browse catalog
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const discountPercent =
                  item.mrp && item.mrp > item.price
                    ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
                    : null
                const discountLabel =
                  item.customDiscountLabel?.trim() ||
                  (discountPercent ? `${discountPercent}% off` : null)
                const badgeLabel = item.customBadge?.trim() || null

                return (
                  <div
                    key={item.variantId}
                    className="flex gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-foreground/20"
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="h-14 w-14 rounded-md object-contain bg-muted/30 p-1 shrink-0"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted/30 text-muted-foreground">
                        <Package className="h-6 w-6" />
                      </div>
                    )}

                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="line-clamp-1 text-xs font-semibold text-foreground">
                            {item.productName}
                          </h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.variantId)}
                            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="text-[11px] text-muted-foreground">
                            {item.variantName}
                          </span>
                          {badgeLabel && (
                            <Badge
                              variant="default"
                              className="text-[9px] px-1.5 py-0 h-4 font-medium leading-none"
                            >
                              {badgeLabel}
                            </Badge>
                          )}
                          {discountLabel && (
                            <Badge
                              variant="secondary"
                              className="text-[9px] px-1.5 py-0 h-4 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 leading-none"
                            >
                              {discountLabel}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="font-semibold text-xs text-foreground font-mono">
                            {formatNPR(item.price * item.quantity)}
                          </span>
                          {item.mrp && item.mrp > item.price && (
                            <span className="text-[11px] text-muted-foreground line-through font-mono">
                              {formatNPR(item.mrp * item.quantity)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 px-1.5 py-0.5 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              updateQuantity(item.variantId, item.quantity - 1)
                            }
                            className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="min-w-4 text-center text-xs font-semibold text-foreground font-mono">
                            {item.quantity}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              updateQuantity(item.variantId, item.quantity + 1)
                            }
                            className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer Summary & Checkout */}
        {items.length > 0 && (
          <SheetFooter className="border-t border-border bg-muted/20 p-4">
            <div className="w-full space-y-3">
              {totalSavingsPaisa > 0 && (
                <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  🎉 You are saving {formatNPR(totalSavingsPaisa)} on this
                  order!
                </div>
              )}

              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-medium text-foreground font-mono">
                    {formatNPR(totalPaisa)}
                  </span>
                </div>
                {totalSavingsPaisa > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Total savings</span>
                    <span className="font-semibold font-mono">
                      -{formatNPR(totalSavingsPaisa)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Express delivery (Butwal & Tilottama)</span>
                  <span className="font-medium text-foreground font-mono">
                    {remainingForFree === 0 ? (
                      <span className="text-success font-semibold">Free</span>
                    ) : (
                      formatNPR(15000)
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>VAT (13% included)</span>
                  <span>Included</span>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-medium text-muted-foreground block">
                    Estimated total
                  </span>
                  <span className="text-base font-bold text-foreground font-mono">
                    {formatNPR(
                      totalPaisa + (remainingForFree === 0 ? 0 : 15000),
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  <span>COD / Fonepay</span>
                </div>
              </div>

              <Button
                type="button"
                className="w-full h-10 text-xs font-medium gap-2 cursor-pointer"
                onClick={() => {
                  setIsOpen(false)
                  navigate({ to: '/checkout' })
                }}
              >
                Proceed to checkout
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
