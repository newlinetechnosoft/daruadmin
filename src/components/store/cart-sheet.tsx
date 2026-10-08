import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '#/components/ui/sheet'
import { Separator } from '#/components/ui/separator'
import { useCart } from '#/lib/cart-context'
import { formatNPR } from '#/lib/money'
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Bike,
  ArrowRight,
  ShieldCheck,
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

  const freeDeliveryProgress = Math.min(
    100,
    Math.round((totalPaisa / FREE_DELIVERY_THRESHOLD) * 100),
  )
  const remainingForFree = Math.max(0, FREE_DELIVERY_THRESHOLD - totalPaisa)

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-l border-[#dedbd4] bg-white p-0 text-[#181818] sm:max-w-md shadow-2xl"
      >
        <SheetHeader className="border-b border-[#dedbd4] p-5 bg-[#fdfdfc]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#171717] text-white">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div>
                <SheetTitle className="text-sm font-extrabold tracking-wider uppercase text-[#181818]">
                  Your Cart
                </SheetTitle>
                <p className="text-[11px] text-[#777]">
                  {items.length === 0
                    ? 'Cart is empty'
                    : `${items.reduce((acc, i) => acc + i.quantity, 0)} items selected`}
                </p>
              </div>
            </div>

            {items.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-[11px] font-semibold text-[#888] hover:text-rose-600 transition-colors border-0 bg-transparent cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>

          {/* FREE DELIVERY STATUS BAR */}
          {items.length > 0 && (
            <div className="mt-3 rounded-[4px] border border-[#dedbd4] bg-[#f7f4ee] p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 font-semibold text-[#181818]">
                  <Bike className="h-3.5 w-3.5" />
                  {remainingForFree === 0
                    ? '🎉 You unlocked FREE 40-min delivery!'
                    : `Add ${formatNPR(remainingForFree)} more for FREE delivery`}
                </span>
                <span className="text-[10px] font-bold text-[#777]">
                  {freeDeliveryProgress}%
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#dedbd4]">
                <div
                  className="h-full rounded-full bg-[#171717] transition-all duration-300"
                  style={{ width: `${freeDeliveryProgress}%` }}
                />
              </div>
            </div>
          )}
        </SheetHeader>

        {/* ITEMS LIST */}
        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f4f3ef] text-[#888]">
                <ShoppingBag className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-sm font-bold uppercase tracking-wider text-[#181818]">
                Your cart is empty
              </h3>
              <p className="mt-1 max-w-xs text-xs text-[#777]">
                Discover our selection of spirits, vodka, whiskey, beer, wine
                and midnight bites.
              </p>
              <button
                type="button"
                className="mt-6 px-5 py-2.5 bg-[#171717] text-white rounded-[3px] text-xs font-semibold uppercase tracking-wider hover:bg-[#d8ff38] hover:text-[#111] transition-colors cursor-pointer"
                onClick={() => setIsOpen(false)}
              >
                Browse Drinks
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.variantId}
                  className="flex gap-3 rounded-[4px] border border-[#dedbd4] bg-white p-3 transition-colors hover:border-[#171717]"
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="h-16 w-16 rounded-[3px] object-contain bg-[#f4f3ef] p-1 shrink-0"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[3px] bg-[#f4f3ef] text-xl select-none">
                      {item.catalogType === 'liquor' ? '🍾' : '🥟'}
                    </div>
                  )}

                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="line-clamp-1 text-xs font-bold text-[#181818]">
                          {item.productName}
                        </h4>
                        <button
                          type="button"
                          onClick={() => removeItem(item.variantId)}
                          className="text-[#999] hover:text-rose-600 transition-colors border-0 bg-transparent cursor-pointer p-0.5"
                          title="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-[10px] text-[#777]">
                        {item.variantName}
                      </p>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-bold text-xs text-[#181818]">
                        {formatNPR(item.price * item.quantity)}
                      </span>

                      <div className="flex items-center gap-2 rounded-[3px] border border-[#dedbd4] bg-[#f9f9f8] px-2 py-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.variantId, item.quantity - 1)
                          }
                          className="text-[#777] hover:text-[#181818] border-0 bg-transparent cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-4 text-center text-xs font-semibold text-[#181818]">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.variantId, item.quantity + 1)
                          }
                          className="text-[#777] hover:text-[#181818] border-0 bg-transparent cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER SUMMARY & CHECKOUT */}
        {items.length > 0 && (
          <SheetFooter className="border-t border-[#dedbd4] bg-[#f7f4ee] p-5">
            <div className="w-full space-y-3">
              <div className="space-y-1.5 text-xs text-[#777]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-[#181818]">
                    {formatNPR(totalPaisa)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Kathmandu Valley 40-min Delivery</span>
                  <span className="font-semibold text-[#181818]">
                    {remainingForFree === 0 ? (
                      <span className="text-emerald-600 font-bold">FREE</span>
                    ) : (
                      formatNPR(15000)
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>VAT (13% Included)</span>
                  <span className="text-[#888]">Included</span>
                </div>
              </div>

              <Separator className="bg-[#dedbd4]" />

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#777] block">
                    Estimated Total
                  </span>
                  <span className="text-lg font-black text-[#181818]">
                    {formatNPR(
                      totalPaisa + (remainingForFree === 0 ? 0 : 15000),
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#777]">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  COD / Fonepay
                </div>
              </div>

              <button
                type="button"
                className="w-full py-3.5 bg-[#171717] text-white rounded-[3px] text-xs font-bold uppercase tracking-wider hover:bg-[#d8ff38] hover:text-[#111] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                onClick={() => {
                  alert(
                    'Order placement simulated! Full checkout connected to Kathmandu 40-minute express dispatch.',
                  )
                  setIsOpen(false)
                }}
              >
                PROCEED TO CHECKOUT
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
