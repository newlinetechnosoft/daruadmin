import type {
  Order,
  OrderItemDealerInfo,
  OrderItem,
} from '#/server/operations/types'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import { Store, MapPin, Phone, MessageCircle, Package } from 'lucide-react'

interface RiderDealerPickupsProps {
  order: Order
}

export function RiderDealerPickups({ order }: RiderDealerPickupsProps) {
  // Group order items by assigned dealer
  const dealerGroups = new Map<
    string,
    {
      dealer: OrderItemDealerInfo
      items: OrderItem[]
    }
  >()

  const unassignedItems: OrderItem[] = []

  for (const item of order.items) {
    if (item.dealer) {
      const existing = dealerGroups.get(item.dealer.id)
      if (existing) {
        existing.items.push(item)
      } else {
        dealerGroups.set(item.dealer.id, {
          dealer: item.dealer,
          items: [item],
        })
      }
    } else {
      unassignedItems.push(item)
    }
  }

  const groups = Array.from(dealerGroups.values())

  if (groups.length === 0 && unassignedItems.length === 0) {
    return null
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
        <div className="flex items-center gap-1.5 text-primary">
          <Store className="h-3.5 w-3.5" />
          <span>Dealer Pickup Stations ({groups.length})</span>
        </div>
        <span className="text-[10px] text-muted-foreground font-normal">
          Collect items before delivery
        </span>
      </div>

      {/* Render each Dealer Pickup station */}
      {groups.map((group, idx) => {
        const dealer = group.dealer
        const phone = dealer.contact.replace(/[^\d+]/g, '')
        const whatsapp = (dealer.whatsappNumber || dealer.contact).replace(
          /[^\d+]/g,
          '',
        )
        const mapUrl =
          dealer.lat && dealer.lng
            ? `https://www.google.com/maps/search/?api=1&query=${dealer.lat},${dealer.lng}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${dealer.name}, ${dealer.address}, ${dealer.city}`)}`

        return (
          <div
            key={dealer.id}
            className="rounded-lg border border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10 p-3 space-y-2.5"
          >
            {/* Dealer Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-xs mt-0.5">
                  {idx + 1}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-foreground text-xs">
                      {dealer.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] py-0 px-1 border-amber-500/30 text-amber-700 dark:text-amber-400"
                    >
                      Station #{idx + 1}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="truncate">
                      {dealer.address}, {dealer.city}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Call, WhatsApp, Map */}
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-7 px-2 text-xs"
                >
                  <a href={`tel:${phone}`} title="Call Dealer">
                    <Phone className="h-3 w-3 mr-1 text-primary" />
                    Call
                  </a>
                </Button>

                {whatsapp && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-7 px-2 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                  >
                    <a
                      href={`https://wa.me/${whatsapp.replace('+', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      title="WhatsApp Dealer"
                    >
                      <MessageCircle className="h-3 w-3 mr-1" />
                      Chat
                    </a>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-7 px-2 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700"
                >
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Navigate to Dealer"
                  >
                    <MapPin className="h-3 w-3 mr-1" />
                    Map
                  </a>
                </Button>
              </div>
            </div>

            {/* Items to collect from this dealer */}
            <div className="pt-2 border-t border-amber-500/15">
              <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Collect from {dealer.name}:</span>
                <span className="font-mono">
                  {group.items.reduce((s, it) => s + it.qty, 0)} pcs
                </span>
              </div>
              <ul className="space-y-1">
                {group.items.map((it) => (
                  <li
                    key={it.id}
                    className="flex justify-between items-center text-[11px] bg-background/70 border border-border/50 rounded px-2.5 py-1"
                  >
                    <span className="font-medium text-foreground">
                      <span className="font-bold text-amber-600 dark:text-amber-400 mr-1.5">
                        {it.qty}x
                      </span>
                      {it.name}{' '}
                      <span className="text-muted-foreground text-[10px]">
                        ({it.variantName})
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {it.sourcingStatus && (
                        <Badge
                          variant="outline"
                          className={`text-[9px] py-0 px-1 font-mono uppercase ${
                            it.sourcingStatus === 'picked_up'
                              ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                              : it.sourcingStatus === 'unavailable'
                                ? 'border-destructive/30 text-destructive bg-destructive/10'
                                : 'border-amber-500/30 text-amber-600 bg-amber-500/10'
                          }`}
                        >
                          {it.sourcingStatus.replace('_', ' ')}
                        </Badge>
                      )}
                      <Badge
                        variant="secondary"
                        className="text-[9px] py-0 px-1 font-mono uppercase"
                      >
                        {it.catalogType}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )
      })}

      {/* Unassigned items if any */}
      {unassignedItems.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/40 p-2.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
            <div className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" />
              <span>Central Warehouse / Unassigned Dealer</span>
            </div>
            <span className="text-[10px]">
              {unassignedItems.reduce((s, it) => s + it.qty, 0)} pcs
            </span>
          </div>
          <ul className="space-y-1">
            {unassignedItems.map((it) => (
              <li
                key={it.id}
                className="flex justify-between items-center text-[11px] text-muted-foreground px-2 py-0.5"
              >
                <span>
                  {it.qty}x {it.name} ({it.variantName})
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] py-0 px-1 font-mono uppercase"
                >
                  {it.catalogType}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
