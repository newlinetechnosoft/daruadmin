import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '#/components/ui/command'
import { globalSearchFn } from '#/server/operations/operations.functions'
import {
  ClipboardList,
  Store,
  Bike,
  Wine,
  ShoppingBag,
  Users,
  Settings,
  PlusCircle,
  LayoutDashboard,
  Wallet,
  Tags,
  Award,
  CreditCard,
  BarChart3,
  Clock,
  Loader2,
} from 'lucide-react'

export interface AwesomebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface RecentItem {
  id: string
  title: string
  type: string
  href: string
  timestamp: number
}

const RECENT_KEY = 'mezmani_awesomebar_recents'

export function recordRecentItem(item: Omit<RecentItem, 'timestamp'>) {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const existing: RecentItem[] = raw ? JSON.parse(raw) : []
    const updated = [
      { ...item, timestamp: Date.now() },
      ...existing.filter((x) => x.href !== item.href),
    ].slice(0, 6)
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
  } catch {
    // ignore localStorage errors
  }
}

export function Awesomebar({ open, onOpenChange }: AwesomebarProps) {
  const navigate = useNavigate()
  const [query, setQuery] = React.useState('')
  const [isSearching, setIsSearching] = React.useState(false)
  const [searchResults, setSearchResults] = React.useState<{
    products: { id: string; name: string; href: string }[]
    orders: { id: string; name: string; href: string }[]
    customers: { id: string; name: string; href: string }[]
    riders: { id: string; name: string; href: string }[]
  }>({ products: [], orders: [], customers: [], riders: [] })

  const [recents, setRecents] = React.useState<RecentItem[]>([])

  // Load recents on modal open
  React.useEffect(() => {
    if (open) {
      try {
        const raw = localStorage.getItem(RECENT_KEY)
        if (raw) setRecents(JSON.parse(raw))
      } catch {
        setRecents([])
      }
    }
  }, [open])

  // Debounced search
  React.useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSearchResults({ products: [], orders: [], customers: [], riders: [] })
      setIsSearching(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await globalSearchFn({ data: { q: query.trim() } })
        setSearchResults(res)
      } catch {
        setSearchResults({
          products: [],
          orders: [],
          customers: [],
          riders: [],
        })
      } finally {
        setIsSearching(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (href: string, title?: string, type?: string) => {
    if (title && type) {
      recordRecentItem({ id: href, title, type, href })
    }
    onOpenChange(false)
    navigate({ to: href as never })
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Type a command, search records (e.g. order #, dealer, customer)..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[70vh]">
        <CommandEmpty>
          {isSearching ? (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Searching records...
            </div>
          ) : (
            'No matching commands or records found.'
          )}
        </CommandEmpty>

        {/* Live Search Results */}
        {(searchResults.orders.length > 0 ||
          searchResults.products.length > 0 ||
          searchResults.customers.length > 0 ||
          searchResults.riders.length > 0) && (
          <>
            {searchResults.orders.length > 0 && (
              <CommandGroup heading="Orders">
                {searchResults.orders.map((o) => (
                  <CommandItem
                    key={o.id}
                    onSelect={() => handleSelect(o.href, o.name, 'Order')}
                    className="flex items-center gap-2 text-xs"
                  >
                    <ClipboardList className="size-4 text-muted-foreground" />
                    <span className="font-mono">{o.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {searchResults.products.length > 0 && (
              <CommandGroup heading="Catalog Products">
                {searchResults.products.map((p) => (
                  <CommandItem
                    key={p.id}
                    onSelect={() => handleSelect(p.href, p.name, 'Product')}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Wine className="size-4 text-muted-foreground" />
                    <span>{p.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {searchResults.customers.length > 0 && (
              <CommandGroup heading="Customers">
                {searchResults.customers.map((c) => (
                  <CommandItem
                    key={c.id}
                    onSelect={() => handleSelect(c.href, c.name, 'Customer')}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Users className="size-4 text-muted-foreground" />
                    <span>{c.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {searchResults.riders.length > 0 && (
              <CommandGroup heading="Riders">
                {searchResults.riders.map((r) => (
                  <CommandItem
                    key={r.id}
                    onSelect={() => handleSelect(r.href, r.name, 'Rider')}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Bike className="size-4 text-muted-foreground" />
                    <span>{r.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
          </>
        )}

        {/* Recently Visited */}
        {!query && recents.length > 0 && (
          <>
            <CommandGroup heading="Recently Visited">
              {recents.map((item) => (
                <CommandItem
                  key={item.href}
                  onSelect={() =>
                    handleSelect(item.href, item.title, item.type)
                  }
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="size-3.5 text-muted-foreground" />
                    <span>{item.title}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {item.type}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Quick Actions / Create */}
        {!query && (
          <CommandGroup heading="Quick Create">
            <CommandItem
              onSelect={() =>
                handleSelect('/admin/orders/new', 'New Order', 'Action')
              }
              className="flex items-center gap-2 text-xs"
            >
              <PlusCircle className="size-4 text-emerald-600" />
              <span>New Order</span>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                handleSelect('/admin/dealers/new', 'New Dealer', 'Action')
              }
              className="flex items-center gap-2 text-xs"
            >
              <PlusCircle className="size-4 text-emerald-600" />
              <span>New Dealer</span>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                handleSelect('/admin/brands', 'New Brand', 'Action')
              }
              className="flex items-center gap-2 text-xs"
            >
              <PlusCircle className="size-4 text-emerald-600" />
              <span>New Brand</span>
            </CommandItem>
          </CommandGroup>
        )}

        {/* Global Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => handleSelect('/admin', 'Workspace', 'Navigation')}
            className="flex items-center gap-2 text-xs"
          >
            <LayoutDashboard className="size-4 text-muted-foreground" />
            <span>Workspace</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect('/admin/orders', 'Orders', 'Navigation')
            }
            className="flex items-center gap-2 text-xs"
          >
            <ClipboardList className="size-4 text-muted-foreground" />
            <span>Orders Desk</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect('/admin/dealers', 'Dealers', 'Navigation')
            }
            className="flex items-center gap-2 text-xs"
          >
            <Store className="size-4 text-muted-foreground" />
            <span>Dealers & Sourcing</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect('/admin/riders', 'Riders', 'Navigation')
            }
            className="flex items-center gap-2 text-xs"
          >
            <Bike className="size-4 text-muted-foreground" />
            <span>Riders & Fleet</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect('/admin/liquor', 'Liquor Catalog', 'Navigation')
            }
            className="flex items-center gap-2 text-xs"
          >
            <Wine className="size-4 text-muted-foreground" />
            <span>Liquor Catalog</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect('/admin/grocery', 'Grocery Catalog', 'Navigation')
            }
            className="flex items-center gap-2 text-xs"
          >
            <ShoppingBag className="size-4 text-muted-foreground" />
            <span>Grocery Catalog</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect('/admin/brands', 'Brands', 'Navigation')
            }
            className="flex items-center gap-2 text-xs"
          >
            <Award className="size-4 text-muted-foreground" />
            <span>Brands</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect('/admin/taxonomy', 'Categories', 'Navigation')
            }
            className="flex items-center gap-2 text-xs"
          >
            <Tags className="size-4 text-muted-foreground" />
            <span>Categories</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect('/admin/accounts', 'Accounts & Ledger', 'Navigation')
            }
            className="flex items-center gap-2 text-xs"
          >
            <Wallet className="size-4 text-muted-foreground" />
            <span>Accounts & General Ledger</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect('/admin/payments', 'Payments', 'Navigation')
            }
            className="flex items-center gap-2 text-xs"
          >
            <CreditCard className="size-4 text-muted-foreground" />
            <span>Payments</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect('/admin/reports', 'Reports', 'Navigation')
            }
            className="flex items-center gap-2 text-xs"
          >
            <BarChart3 className="size-4 text-muted-foreground" />
            <span>Financial & Sales Reports</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect('/admin/staff', 'Staff & Users', 'Navigation')
            }
            className="flex items-center gap-2 text-xs"
          >
            <Users className="size-4 text-muted-foreground" />
            <span>Staff & Access Management</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect('/admin/settings', 'Settings', 'Navigation')
            }
            className="flex items-center gap-2 text-xs"
          >
            <Settings className="size-4 text-muted-foreground" />
            <span>Store & Delivery Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
