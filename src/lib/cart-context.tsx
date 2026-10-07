import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { formatNPR } from './money'

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
}

interface CartContextType {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void
  removeItem: (variantId: string) => void
  updateQuantity: (variantId: string, quantity: number) => void
  clearCart: () => void
  totalPaisa: number
  itemCount: number
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_STORAGE_KEY = 'Mezmani_cart_items_v1'

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Load from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY)
      if (stored) {
        setItems(JSON.parse(stored))
      }
    } catch (e) {
      console.error('Failed to load cart from localStorage', e)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // Save to localStorage whenever items change
  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
    } catch (e) {
      console.error('Failed to save cart to localStorage', e)
    }
  }, [items, isLoaded])

  const addItem = (item: Omit<CartItem, 'quantity'>, quantity = 1) => {
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
    toast.success(`Added ${item.productName} (${item.variantName}) to cart`, {
      description: formatNPR(item.price),
    })
  }

  const removeItem = (variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId))
  }

  const updateQuantity = (variantId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(variantId)
      return
    }
    setItems((prev) =>
      prev.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)),
    )
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
