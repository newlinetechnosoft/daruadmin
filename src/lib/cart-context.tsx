import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { authClient } from '#/lib/auth-client'
import { idbGet, idbSet } from '#/lib/idb'

export interface CartItem {
  id: string // unique identifier: variantId
  productId: string
  productName: string
  productSlug: string
  variantId: string
  variantName: string
  catalogType: 'liquor' | 'grocery'
  price: number // in paisa
  mrp?: number | null // in paisa
  imageUrl?: string | null
  quantity: number
  customBadge?: string | null
  customDiscountLabel?: string | null
}

interface CartContextType {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => boolean
  removeItem: (variantId: string) => void
  updateQuantity: (
    variantId: string,
    quantity: number,
    maxStock?: number,
  ) => boolean
  getItemQuantity: (variantId: string) => number
  clearCart: () => void
  totalPaisa: number
  itemCount: number
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_STORAGE_KEY = 'Mezmani_cart_items_v1'

/**
 * Hook to enforce authentication before customer actions.
 */
export function useRequireAuth() {
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()

  return (callback?: () => void): boolean => {
    if (!session?.user) {
      const redirect =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '/drinks'
      toast.info('Please sign in to add items to your cart')
      navigate({
        to: '/login',
        search: { redirect },
      })
      return false
    }
    callback?.()
    return true
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const { data: session } = authClient.useSession()
  const navigate = useNavigate()

  // Load from IndexedDB (with localStorage fallback) on mount
  useEffect(() => {
    idbGet<CartItem[]>(CART_STORAGE_KEY, []).then((stored) => {
      if (stored.length > 0) {
        setItems(stored)
      }
      setIsLoaded(true)
    })
  }, [])

  // Save to IndexedDB whenever items change
  useEffect(() => {
    if (!isLoaded) return
    idbSet(CART_STORAGE_KEY, items).catch((e) => {
      console.error('Failed to save cart to IDB', e)
    })
  }, [items, isLoaded])

  // Map for fast O(1) quantity lookup
  const itemMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of items) {
      map.set(item.variantId, item.quantity)
    }
    return map
  }, [items])

  const getItemQuantity = (variantId: string) => {
    return itemMap.get(variantId) ?? 0
  }

  const checkAuth = (): boolean => {
    if (!session?.user) {
      const redirect =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '/drinks'
      toast.info('Please sign in to add items to your cart')
      navigate({
        to: '/login',
        search: { redirect },
      })
      return false
    }
    return true
  }

  const addItem = (item: Omit<CartItem, 'quantity'>, quantity = 1): boolean => {
    // 1. LOGIN REQUIRED TO ADD TO CART
    if (!checkAuth()) {
      return false
    }

    const isFirstAdd = !items.some((i) => i.variantId === item.variantId)
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId)
      if (existing) {
        return prev.map((i) =>
          i.variantId === item.variantId
            ? { ...i, quantity: i.quantity + quantity }
            : i,
        )
      }
      return [...prev, { ...item, quantity }]
    })

    // At most one subtle toast on the first add (no toast spam on repeated adds)
    if (isFirstAdd) {
      toast.success(`Added ${item.productName} to cart`)
    }
    return true
  }

  const removeItem = (variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId))
  }

  const updateQuantity = (
    variantId: string,
    quantity: number,
    maxStock?: number,
  ): boolean => {
    const currentQty = getItemQuantity(variantId)

    // If increasing quantity, require auth
    if (quantity > currentQty && !checkAuth()) {
      return false
    }

    if (quantity <= 0) {
      removeItem(variantId)
      return true
    }

    if (maxStock !== undefined && quantity > maxStock) {
      toast.warning(`Only ${maxStock} available in stock`)
      return false
    }

    setItems((prev) =>
      prev.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)),
    )
    return true
  }

  const clearCart = () => {
    setItems([])
  }

  const totalPaisa = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  )
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        getItemQuantity,
        clearCart,
        totalPaisa,
        itemCount,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
