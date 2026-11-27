import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { authClient } from '#/lib/auth-client'
import { useCart } from '#/lib/cart-context'
import { formatNPR } from '#/lib/money'
import { storeQueries, adminQueries } from '#/queries/admin'
import { useActiveServiceZones } from '#/queries/zones'
import { isPointInsideAnyZone } from '#/lib/geo-utils'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { Skeleton } from '#/components/ui/skeleton'

import {
  checkoutFormSchema,
  normalizeNepaliPhone,
} from '#/server/orders/order.schemas'
import type { CheckoutFormData } from '#/server/orders/order.schemas'
import {
  validatePromoFn,
  createCustomerOrderFn,
  getCustomerOrdersFn,
} from '#/server/orders/order.functions'
import {
  getCustomerAddressesFn,
  upsertCustomerAddressFn,
} from '#/server/operations/operations.functions'
import type { CustomerAddress } from '#/server/operations/types'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { StoreCountdownTimer } from '#/components/store/countdown-timer'
import { ThemeToggle } from '#/components/shared/theme-toggle'
import { DEFAULT_MAP_CENTER, isWithinButwalArea } from '#/lib/map-config'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Checkbox } from '#/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { Separator } from '#/components/ui/separator'
import { cn } from '#/lib/utils'
import {
  MapPin,
  Phone,
  CreditCard,
  Tag,
  ShieldCheck,
  Bike,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Home,
  Briefcase,
  Check,
  Clock,
  Lock,
  Navigation,
  ShoppingCart,
  ChevronLeft,
  User,
} from 'lucide-react'
import { toast } from 'sonner'

const DeliveryMap = lazy(() =>
  import('./delivery-map').then((m) => ({ default: m.DeliveryMap })),
)

/* ─────────────────────────── Date / time helpers ─────────────────────────── */

function getTodayDateString(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getTomorrowDateString(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDefaultCustomTimeString(): string {
  const now = new Date()
  const target = new Date(now.getTime() + 45 * 60 * 1000)
  const rem = target.getMinutes() % 5
  if (rem !== 0) {
    target.setMinutes(target.getMinutes() + (5 - rem))
  }
  const hours = String(target.getHours()).padStart(2, '0')
  const minutes = String(target.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function formatTimeTo12Hour(timeStr: string): string {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (isNaN(h) || isNaN(m)) return timeStr
  const period = h >= 12 ? 'PM' : 'AM'
  const displayH = h % 12 === 0 ? 12 : h % 12
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`
}

/* ─────────────────────── Payment visual config ─────────────────────── */

interface PaymentVisualConfig {
  subtitle: string
  badgeLabel?: string
  badgeColor?: {
    bg: string
    text: string
    border: string
  }
}

const PAYMENT_VISUALS: Record<string, PaymentVisualConfig> = {
  cod: {
    subtitle: 'Pay the rider in cash.',
  },
  esewa: {
    subtitle: 'Fast and secure checkout.',
    badgeLabel: 'Recommended',
    badgeColor: {
      bg: 'bg-orange-100',
      text: 'text-orange-700',
      border: 'border-orange-200',
    },
  },
  khalti: {
    subtitle: 'Pay with your Khalti wallet.',
  },
  fonepay: {
    subtitle: 'Scan & pay via Fonepay QR.',
  },
  connectips: {
    subtitle: 'Direct bank payment via ConnectIPS.',
  },
}

/* ──────────────────── Payment Gateway Logos ──────────────────── */

const PAYMENT_GATEWAY_LOGOS: Record<string, { src: string; alt: string }> = {
  esewa: {
    src: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQgXxABSU_LxK7mGPYG7JgqsO8eD2g_1_pJvdAjrropVw&s=10',
    alt: 'eSewa',
  },
  khalti: {
    src: 'https://nepdora.com/images/payment-gateway/khalti.png',
    alt: 'Khalti',
  },
  fonepay: {
    src: 'https://play-lh.googleusercontent.com/9Gn2R4yJ-lkoqeoIhj4ihYYU5Mli-Wn_GOUgNoqGSv6rbySeYzSH_3xH3Ve9yergDwZ2D4UyWwCosuePwBDx0g',
    alt: 'Fonepay',
  },
  connectips: {
    src: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT6S-vkdgbJPJNIUcpYNd9anfMWns5jDpVPnJ1FyF_5oQ&s=10',
    alt: 'ConnectIPS',
  },
  cod: {
    src: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQSXNxvOav8W4IMVntLybNA-e0x-Ad72FyK86LJkT-ShQ&s=10',
    alt: 'Cash on Delivery',
  },
}

function getPaymentIcon(id: string): React.ReactNode {
  const logo = PAYMENT_GATEWAY_LOGOS[id.toLowerCase()]
  if (!logo) {
    return (
      <div className="size-11 sm:size-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
        <CreditCard className="size-5 text-gray-400" />
      </div>
    )
  }

  return (
    <div className="size-11 sm:size-12 rounded-xl bg-white border border-gray-200/80 p-1 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
      <img
        src={logo.src}
        alt={logo.alt}
        className="size-full object-contain"
        loading="eager"
        decoding="async"
      />
    </div>
  )
}

/* ──────────────────── Dynamic Payment Method Grid ──────────────────── */

function getPaymentMethodGridClass(count: number): string {
  switch (count) {
    case 1:
      return 'grid grid-cols-1 gap-3'
    case 2:
      return 'grid grid-cols-1 sm:grid-cols-2 gap-3'
    case 3:
      return 'grid grid-cols-1 sm:grid-cols-3 gap-3'
    case 4:
      return 'grid grid-cols-1 sm:grid-cols-2 gap-3' // 2 columns, 2 rows
    case 5:
      return 'grid grid-cols-1 sm:grid-cols-3 gap-3' // 3 in 1st row, 2 in 2nd row
    case 6:
      return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3' // 6 in 1 row on desktop
    default:
      if (count > 6) {
        return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3'
      }
      return 'grid grid-cols-1 sm:grid-cols-2 gap-3'
  }
}

/* ─────────────────────── Progress Step Indicator ─────────────────────── */

function CheckoutProgress({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: 'Cart', icon: ShoppingCart },
    { label: 'Address', icon: MapPin },
    { label: 'Payment', icon: CreditCard },
    { label: 'Done', icon: Check },
  ]

  return (
    <div className="flex items-center justify-center w-full max-w-md mx-auto py-2">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isActive = index === currentStep
        const StepIcon = step.icon

        return (
          <div key={step.label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'size-9 md:size-10 rounded-full flex items-center justify-center transition-all duration-300 border-2',
                  isCompleted
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : isActive
                      ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/30'
                      : 'bg-muted border-border text-muted-foreground',
                )}
              >
                {isCompleted ? (
                  <Check className="size-4 md:size-5 stroke-[3]" />
                ) : (
                  <StepIcon className="size-4 md:size-5" />
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] md:text-xs font-semibold transition-colors',
                  isCompleted || isActive ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className="flex-1 mx-1.5 md:mx-2.5 mb-5">
                <div
                  className={cn(
                    'h-[2px] w-full rounded-full transition-all duration-300',
                    isCompleted ? 'bg-orange-500' : 'bg-border',
                  )}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN CHECKOUT PANEL
   ══════════════════════════════════════════════════════════════════════════ */

export function CheckoutPanel() {
  const { data: session } = authClient.useSession()
  const { items, totalPaisa, clearCart, itemCount, setIsOpen } = useCart()
  const navigate = useNavigate()

  // Dynamic delivery pricing from admin store configuration
  const { data: deliverySettings } = useQuery(storeQueries.deliveryPricing())
  const dynamicBaseFee = deliverySettings?.deliveryFee ?? 0
  const dynamicFreeThresh = deliverySettings?.freeDeliveryThreshold ?? 0
  const isGrowthFreeDelivery = dynamicBaseFee === 0

  // Profile phone check
  const rawProfilePhone =
    (session?.user as { phone?: string | null } | undefined)?.phone || ''
  const normalizedProfilePhone = normalizeNepaliPhone(rawProfilePhone)
  const hasProfilePhone = Boolean(normalizedProfilePhone)

  const [isEditingPhone, setIsEditingPhone] = useState(!hasProfilePhone)
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string
    discountPaisa: number
  } | null>(null)
  const [isValidatingPromo, setIsValidatingPromo] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch past orders to suggest previously used phone numbers
  const { data: pastOrders = [] } = useQuery({
    queryKey: ['customer', 'past-orders-phone'],
    queryFn: () => getCustomerOrdersFn(),
    enabled: Boolean(session?.user),
  })

  // Extract distinct phone suggestions from profile & past orders
  const phoneSuggestions = useMemo(() => {
    const suggestions: Array<{
      phone: string
      label: string
      isDefault: boolean
    }> = []
    const seen = new Set<string>()

    if (normalizedProfilePhone) {
      seen.add(normalizedProfilePhone)
      suggestions.push({
        phone: normalizedProfilePhone,
        label: 'Default / Profile',
        isDefault: true,
      })
    }

    if (Array.isArray(pastOrders)) {
      for (const order of pastOrders) {
        if (!order?.customerPhone) continue
        const norm = normalizeNepaliPhone(order.customerPhone)
        if (norm && !seen.has(norm)) {
          seen.add(norm)
          suggestions.push({
            phone: norm,
            label: 'Previously Used',
            isDefault: false,
          })
        }
      }
    }

    return suggestions
  }, [normalizedProfilePhone, pastOrders])

  const { data: storeStatus } = useQuery(storeQueries.operatingStatus())
  const { data: activePaymentGateways = [] } = useQuery(
    adminQueries.activePaymentGateways(),
  )
  const {
    features: serviceZoneFeatures,
    isLoading: isZonesLoading,
  } = useActiveServiceZones()
  const [selectedZoneId, setSelectedZoneId] = useState<string>('')

  // Saved Addresses
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>('custom')
  const [saveAddressForLater, setSaveAddressForLater] = useState(false)
  const [addressLabel, setAddressLabel] = useState('Home')

  // Compute centroid of polygon for map centering
  const getZoneCenter = (polygon: any): [number, number] => {
    const ring = polygon?.coordinates?.[0] || []
    if (ring.length === 0) return DEFAULT_MAP_CENTER
    let sumLat = 0
    let sumLng = 0
    // GeoJSON coordinates are [lng, lat]
    for (const coord of ring) {
      sumLng += coord[0]
      sumLat += coord[1]
    }
    return [sumLat / ring.length, sumLng / ring.length]
  }

  // Initialize checkout form
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      paymentMethod: 'cod',
      promoCode: '',
      lat: DEFAULT_MAP_CENTER[0],
      lng: DEFAULT_MAP_CENTER[1],
      address: '',
      city: 'Butwal',
      phone: normalizedProfilePhone || '',
      savePhoneAsDefault: false,
      deliverySlot: 'express',
      customDeliveryDate: getTodayDateString(),
      customDeliveryTime: getDefaultCustomTimeString(),
      deliveryNotes: '',
      items: items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
      })),
    },
  })

  // Sync profile phone into form when session loads
  useEffect(() => {
    if (normalizedProfilePhone && !watch('phone')) {
      setValue('phone', normalizedProfilePhone, { shouldValidate: true })
      setIsEditingPhone(false)
    }
  }, [normalizedProfilePhone, watch, setValue])

  const watchedDeliverySlot = watch('deliverySlot')

  // Handle explicit Area / Service Zone selection
  const handleAreaSelect = (zoneId: string) => {
    setSelectedZoneId(zoneId)
    const feat = serviceZoneFeatures.find((f) => f.id === zoneId)
    if (!feat) return
    const zoneName = feat.properties.name
    setValue('city', zoneName, { shouldValidate: true })
    const [cLat, cLng] = getZoneCenter(feat.geometry)
    setValue('lat', cLat, { shouldValidate: true })
    setValue('lng', cLng, { shouldValidate: true })
  }

  // Auto-select initial area when active service zones load
  useEffect(() => {
    if (serviceZoneFeatures.length === 0) return
    if (!selectedZoneId) {
      const currentCity = watch('city')
      const matched = serviceZoneFeatures.find(
        (f) => f.properties.name.toLowerCase() === currentCity?.toLowerCase(),
      )
      if (matched) {
        setSelectedZoneId(matched.id)
      } else if (serviceZoneFeatures[0]) {
        setSelectedZoneId(serviceZoneFeatures[0].id)
        setValue('city', serviceZoneFeatures[0].properties.name, {
          shouldValidate: true,
        })
      }
    }
  }, [serviceZoneFeatures, selectedZoneId, watch, setValue])

  // Sync active payment gateways with form paymentMethod
  useEffect(() => {
    if (activePaymentGateways.length === 0) return
    const currentMethod = watch('paymentMethod')
    const isCurrentActive = activePaymentGateways.some(
      (g) => g.id === currentMethod,
    )
    if (!isCurrentActive && activePaymentGateways[0]) {
      setValue('paymentMethod', activePaymentGateways[0].id)
    }
  }, [activePaymentGateways, watch, setValue])

  // When store is closed, automatically route from express to custom scheduled delivery
  useEffect(() => {
    if (storeStatus && !storeStatus.isOpen && watchedDeliverySlot === 'express') {
      setValue('deliverySlot', 'custom')
    }
  }, [storeStatus, watchedDeliverySlot, setValue])
  const watchedCustomDate = watch('customDeliveryDate')
  const watchedCustomTime = watch('customDeliveryTime')
  const selectedLocation = {
    lat: watch('lat'),
    lng: watch('lng'),
  }
  const watchedAddress = watch('address')
  const watchedPhone = watch('phone')

  // Financial calculations
  const totalSavingsPaisa = items.reduce((sum, item) => {
    if (item.mrp && item.mrp > item.price) {
      return sum + (item.mrp - item.price) * item.quantity
    }
    return sum
  }, 0)
  const deliveryCharge =
    isGrowthFreeDelivery ||
    (dynamicFreeThresh > 0 && totalPaisa >= dynamicFreeThresh)
      ? 0
      : dynamicBaseFee
  const promoDiscount = appliedPromo?.discountPaisa ?? 0
  const orderTotal = Math.max(0, totalPaisa - promoDiscount + deliveryCharge)

  // Load saved delivery addresses
  useEffect(() => {
    let isMounted = true
    void getCustomerAddressesFn()
      .then((addrs) => {
        if (!isMounted || addrs.length === 0) return
        setSavedAddresses(addrs)
        const defaultAddr = addrs.find((a) => a.isDefault) ?? addrs[0]
        setSelectedAddressId(defaultAddr.id)
        setValue('address', defaultAddr.address, { shouldValidate: true })
        setValue('city', defaultAddr.city || 'Butwal')
        if (
          defaultAddr.lat != null &&
          defaultAddr.lng != null &&
          isWithinButwalArea(Number(defaultAddr.lat), Number(defaultAddr.lng))
        ) {
          setValue('lat', Number(defaultAddr.lat), { shouldValidate: true })
          setValue('lng', Number(defaultAddr.lng), { shouldValidate: true })
        } else {
          setValue('lat', DEFAULT_MAP_CENTER[0], { shouldValidate: true })
          setValue('lng', DEFAULT_MAP_CENTER[1], { shouldValidate: true })
        }
      })
      .catch(() => {
        // Guest or unauthenticated
      })
    return () => {
      isMounted = false
    }
  }, [setValue])

  const handleSelectSavedAddress = (id: string) => {
    setSelectedAddressId(id)
    if (id === 'custom') {
      setValue('address', '')
      return
    }
    const addr = savedAddresses.find((a) => a.id === id)
    if (addr) {
      setValue('address', addr.address, { shouldValidate: true })
      setValue('city', addr.city || 'Butwal')
      if (
        addr.lat != null &&
        addr.lng != null &&
        isWithinButwalArea(Number(addr.lat), Number(addr.lng))
      ) {
        setValue('lat', Number(addr.lat), { shouldValidate: true })
        setValue('lng', Number(addr.lng), { shouldValidate: true })
      } else {
        setValue('lat', DEFAULT_MAP_CENTER[0], { shouldValidate: true })
        setValue('lng', DEFAULT_MAP_CENTER[1], { shouldValidate: true })
      }
    }
  }

  // Handle Promo Validation
  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim()) {
      toast.error('Please enter a promo code')
      return
    }

    try {
      setIsValidatingPromo(true)
      const res = await validatePromoFn({
        data: {
          code: promoCodeInput.trim(),
          subtotal: totalPaisa,
        },
      })

      if (!res.valid) {
        toast.error(res.error || 'Invalid promo code')
        return
      }

      setAppliedPromo({
        code: res.code,
        discountPaisa: res.discountPaisa,
      })
      setValue('promoCode', res.code)
      toast.success(
        `Coupon ${res.code} applied! Saved ${formatNPR(res.discountPaisa)}`,
      )
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to validate promo code',
      )
    } finally {
      setIsValidatingPromo(false)
    }
  }

  const handleRemovePromo = () => {
    setAppliedPromo(null)
    setPromoCodeInput('')
    setValue('promoCode', '')
    toast.info('Promo code removed')
  }

  // Handle Order Placement
  const onSubmit = async (data: CheckoutFormData) => {
    if (items.length === 0) {
      toast.error('Your cart is empty. Add items to checkout.')
      return
    }

    try {
      setIsSubmitting(true)

      const idempotencyKey = crypto.randomUUID()
      const submissionData: CheckoutFormData = {
        ...data,
        items: items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
        })),
        idempotencyKey,
      }

      const result = await createCustomerOrderFn({
        data: submissionData,
      })



      // If user opted to save this address for later, persist it
      if (saveAddressForLater && session?.user) {
        try {
          await upsertCustomerAddressFn({
            data: {
              label: addressLabel,
              address: data.address,
              city: data.city || 'Butwal',
              lat: data.lat,
              lng: data.lng,
              isDefault: savedAddresses.length === 0,
            },
          })
        } catch (addrErr) {
          console.error('Failed to save customer address:', addrErr)
        }
      }

      // Clear cart ONLY after server confirms success
      clearCart()

      if (result.paymentMethod === 'cod') {
        toast.success(`Order placed successfully! Order #${result.orderNumber}`)
        navigate({
          to: '/order-confirmation/$orderId',
          params: { orderId: result.orderId },
        })
      } else if (result.paymentMethod === 'esewa' && result.esewaPayload) {
        toast.info('Redirecting to eSewa payment gateway...')

        // Submit standard eSewa form payload
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = result.esewaPayload.actionUrl

        Object.entries(result.esewaPayload).forEach(([key, val]) => {
          if (key === 'actionUrl') return
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = key
          input.value = val
          form.appendChild(input)
        })

        document.body.appendChild(form)
        form.submit()
      } else {
        // Any active online gateway (Khalti, Fonepay, ConnectIPS)
        toast.success(`Order placed successfully! Order #${result.orderNumber}`)
        navigate({
          to: '/order-confirmation/$orderId',
          params: { orderId: result.orderId },
        })
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Order submission failed',
      )
      setIsSubmitting(false)
    }
  }

  /* ────────────────────── EMPTY CART STATE ────────────────────── */

  if (items.length === 0) {
    return (
      <div className="storefront min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
        <Header />
        <main className="flex-1 flex items-center justify-center py-16 px-4">
          <div className="max-w-md w-full text-center p-8 bg-card rounded-2xl shadow-sm border border-border">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/10 text-orange-500 mb-4">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              Your cart is empty
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Add delicious food & drinks to your cart before proceeding
              to checkout.
            </p>
            <Button asChild className="mt-6 gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full px-6 h-11 text-sm font-semibold shadow-md">
              <Link to="/food">
                Browse Menu
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const userName = session?.user?.name || 'Customer'
  const userPhone = watchedPhone || normalizedProfilePhone || ''

  /* ══════════════════════════════════════════════════════════════════════════
     MAIN RENDER
     ══════════════════════════════════════════════════════════════════════════ */

  return (
    <div className="storefront min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200">
      {/* ─── DESKTOP HEADER (lg+) ─── */}
      <header className="hidden md:block sticky top-0 z-50 bg-gray-900 border-b border-border/40 text-white shadow-lg">
        <div className="mx-auto max-w-7xl flex h-16 items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center">
              <img
                src="https://mezmani.com/mezmani_logo_bg.svg"
                onError={(e) => {
                  const target = e.currentTarget
                  if (target.src !== `${window.location.origin}/mezmani_logo_bg.svg`) {
                    target.src = '/mezmani_logo_bg.svg'
                  }
                }}
                alt="Mezmani"
                className="h-8 w-auto"
              />
            </Link>
            <nav className="flex items-center gap-6">
              <Link to="/" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Home</Link>
              <Link to="/food" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Menu</Link>
              <Link to="/drinks" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Drinks</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle className="text-gray-300 hover:text-white hover:bg-gray-800 rounded-full" />
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="relative flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full px-4 h-9 text-sm font-semibold transition-colors cursor-pointer"
            >
              <ShoppingCart className="size-4" />
              {itemCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white text-orange-600 px-1 text-[10px] font-bold">
                  {itemCount}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2 bg-gray-800 rounded-full px-3 h-9">
              <User className="size-4 text-gray-400" />
              <span className="text-sm text-gray-300 max-w-24 truncate">{userName.split(' ')[0]}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ─── MOBILE HEADER (md-) ─── */}
      <header className="md:hidden sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border shadow-xs text-foreground">
        <div className="flex h-14 items-center justify-between px-4">
          <button type="button" onClick={() => navigate({ to: '/' })} className="flex items-center justify-center size-9 rounded-full hover:bg-muted transition-colors cursor-pointer">
            <ChevronLeft className="size-5 text-foreground" />
          </button>
          <Link to="/" className="flex items-center">
            {/* Light Theme Logo */}
            <img
              src="https://mezmani.com/mezmani_logo.webp"
              onError={(e) => {
                const target = e.currentTarget
                if (target.src !== `${window.location.origin}/mezmani_logo.webp`) {
                  target.src = '/mezmani_logo.webp'
                }
              }}
              alt="Mezmani"
              className="h-7 w-auto object-contain dark:hidden"
            />
            {/* Dark Theme Logo */}
            <img
              src="https://mezmani.com/mezmani_logo_bg.svg"
              onError={(e) => {
                const target = e.currentTarget
                if (target.src !== `${window.location.origin}/mezmani_logo_bg.svg`) {
                  target.src = '/mezmani_logo_bg.svg'
                }
              }}
              alt="Mezmani"
              className="h-7 w-auto object-contain hidden dark:block"
            />
          </Link>
          <div className="flex items-center gap-1.5">
            <ThemeToggle variant="ghost" className="h-9 w-9 rounded-full text-foreground" />
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="relative flex items-center justify-center size-9 rounded-full hover:bg-muted transition-colors cursor-pointer"
            >
              <ShoppingCart className="size-5 text-foreground" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 text-white px-1 text-[10px] font-bold shadow-sm">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ─── CHECKOUT BANNER (desktop only) ─── */}
      <div className="hidden md:block relative bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-96 h-full">
            <svg viewBox="0 0 400 200" fill="none" className="w-full h-full">
              <circle cx="300" cy="100" r="150" fill="white" fillOpacity="0.1" />
              <circle cx="350" cy="50" r="80" fill="white" fillOpacity="0.08" />
            </svg>
          </div>
        </div>
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8 py-10">
          <h1 className="text-3xl lg:text-4xl font-black text-white">
            Checkout
          </h1>
          <p className="mt-1.5 text-sm text-orange-100 font-medium">
            Complete your order and enjoy your favourite food & drinks!
          </p>
        </div>
      </div>

      <main className="flex-1">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-6 md:py-8">

            {/* ─── PROGRESS INDICATOR ─── */}
            <div className="mb-6 md:mb-8">
              <CheckoutProgress currentStep={1} />
            </div>

            {/* Store Operating Status Notice */}
            {storeStatus && !storeStatus.isOpen && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-6 md:mb-8 text-amber-950 dark:text-amber-200">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-amber-900 dark:text-amber-200">Store is Currently Closed</span>
                      {storeStatus.nextOpeningFormatted && (
                        <span className="text-xs bg-amber-500/20 border border-amber-500/40 text-amber-800 dark:text-amber-300 font-mono font-bold px-2 py-0.5 rounded-full">
                          Reopens: {storeStatus.nextOpeningFormatted}
                        </span>
                      )}
                      <StoreCountdownTimer
                        targetDateTime={storeStatus.nextOpeningDateTime}
                        fallbackFormatted={storeStatus.nextOpeningFormatted}
                        variant="header-badge"
                      />
                    </div>
                    <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                      {storeStatus.allowAdvanceOrders
                        ? `Advance Ordering Active: You can place your order now! Please select a scheduled delivery date and time that falls on or after our reopening (${storeStatus.nextOpeningFormatted || 'our next shift'}).`
                        : `Store is currently closed and new orders cannot be placed. Please return after our reopening (${storeStatus.nextOpeningFormatted || 'soon'}).`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ─── DESKTOP TWO-COLUMN LAYOUT ─── */}
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">

              {/* ═══════════ LEFT COLUMN ═══════════ */}
              <div className="flex-1 min-w-0 space-y-6">

                {/* ── 1. DELIVERY ADDRESS CARD ── */}
                <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-xs">
                        <MapPin className="h-4.5 w-4.5" />
                      </div>
                      <h2 className="text-base font-bold text-foreground">1. Delivery Address</h2>
                    </div>
                    {savedAddresses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleSelectSavedAddress('custom')}
                        className="text-sm font-semibold text-orange-500 hover:text-orange-600 transition-colors cursor-pointer"
                      >
                        Change Address
                      </button>
                    )}
                  </div>
                  <div className="p-5 space-y-4">
                    {/* Saved Addresses */}
                    {savedAddresses.length > 0 && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {savedAddresses.map((addr) => {
                            const isSelected = selectedAddressId === addr.id
                            const isWork = addr.label.toLowerCase() === 'work'
                            return (
                              <button
                                key={addr.id}
                                type="button"
                                onClick={() => handleSelectSavedAddress(addr.id)}
                                className={cn(
                                  'flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer',
                                  isSelected
                                    ? 'border-orange-500 bg-orange-500/10 dark:bg-orange-500/15 ring-1 ring-orange-500 text-foreground'
                                    : 'border-border bg-card hover:border-border/80 hover:bg-muted/40 text-muted-foreground',
                                )}
                              >
                                <div
                                  className={cn(
                                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5',
                                    isSelected
                                      ? 'bg-orange-500 text-white'
                                      : 'bg-muted text-muted-foreground',
                                  )}
                                >
                                  {isWork ? <Briefcase className="h-3.5 w-3.5" /> : <Home className="h-3.5 w-3.5" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-bold text-foreground capitalize">{addr.label || 'Saved Address'}</span>
                                    {addr.isDefault && (
                                      <span className="text-[10px] px-1.5 py-0 bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 rounded font-semibold">Default</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">{addr.address}</p>
                                </div>
                                {isSelected && <Check className="h-4 w-4 text-orange-500 shrink-0 mt-1" />}
                              </button>
                            )
                          })}
                          <button
                            type="button"
                            onClick={() => handleSelectSavedAddress('custom')}
                            className={cn(
                              'flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer',
                              selectedAddressId === 'custom'
                                ? 'border-orange-500 bg-orange-500/10 dark:bg-orange-500/15 ring-1 ring-orange-500 text-foreground'
                                : 'border-border border-dashed hover:border-border/80 hover:bg-muted/40 text-muted-foreground',
                            )}
                          >
                            <div className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                              selectedAddressId === 'custom' ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground',
                            )}>
                              <MapPin className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-bold text-foreground">+ New Address</span>
                              <p className="text-xs text-muted-foreground">Pin a new delivery location</p>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Current selected address preview */}
                    {selectedAddressId !== 'custom' && (
                      <div className="rounded-xl bg-muted/40 border border-border p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col gap-2.5">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-semibold text-foreground">{userName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{userPhone || '—'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-orange-500" />
                              <span className="text-sm text-foreground/90">{watchedAddress || 'Butwal, Rupandehi, Nepal'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2 bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/20 rounded-lg px-3 py-2">
                          <Bike className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">Estimated Delivery: 30–40 min</span>
                        </div>
                      </div>
                    )}

                    {/* Area Selection */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="checkout-area-select" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Navigation className="h-3.5 w-3.5 text-orange-500" />
                          <span>Area / Delivery Zone</span>
                        </Label>
                        {selectedZoneId && (
                          <span className="text-[10px] border border-orange-500/30 text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full font-semibold">
                            Verified Area
                          </span>
                        )}
                      </div>
                      <NativeSelect
                        id="checkout-area-select"
                        value={selectedZoneId}
                        onChange={(e) => handleAreaSelect(e.target.value)}
                        className="w-full text-sm font-medium bg-background border-input text-foreground"
                        disabled={isSubmitting || isZonesLoading}
                      >
                        <NativeSelectOption value="" disabled>
                          {isZonesLoading ? 'Loading active areas...' : '-- Choose your delivery area / zone --'}
                        </NativeSelectOption>
                        {serviceZoneFeatures.map((feat) => (
                          <NativeSelectOption key={feat.id} value={feat.id}>
                            {feat.properties.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>

                    {/* Map */}
                    <Controller
                      name="lat"
                      control={control}
                      render={() => (
                        <Suspense
                          fallback={
                            <div className="h-[220px] md:h-[280px] w-full rounded-xl border border-border bg-muted/40 flex flex-col items-center justify-center gap-2 p-4 animate-pulse">
                              <Skeleton className="h-8 w-8 rounded-full" />
                              <Skeleton className="h-4 w-48" />
                            </div>
                          }
                        >
                          <DeliveryMap
                            value={selectedLocation}
                            disabled={isSubmitting}
                            onChange={(pt) => {
                              setValue('lat', pt.lat, { shouldValidate: true })
                              setValue('lng', pt.lng, { shouldValidate: true })
                              const matchingZone = serviceZoneFeatures.find((f) =>
                                isPointInsideAnyZone(pt.lat, pt.lng, [
                                  { polygon: f.geometry, isActive: true },
                                ]),
                              )
                              if (matchingZone && matchingZone.id !== selectedZoneId) {
                                setSelectedZoneId(matchingZone.id)
                                setValue('city', matchingZone.properties.name, {
                                  shouldValidate: true,
                                })
                              }
                            }}
                          />
                        </Suspense>
                      )}
                    />
                    {(errors.lat || errors.lng) && (
                      <p className="text-xs font-medium text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Please drop a valid delivery location pin on the map.
                      </p>
                    )}

                    {/* Address Input */}
                    <div className="space-y-1.5">
                      <Label htmlFor="address-input" className="text-sm font-semibold text-foreground/90">
                        Address / Landmark (Required)
                      </Label>
                      <Input
                        id="address-input"
                        {...register('address')}
                        placeholder="e.g., Near Bhatbhateni Supermarket, House 42, Blue Gate"
                        className="h-10 text-sm rounded-xl border-input bg-background/50 focus:border-orange-500 focus:ring-orange-500/20 text-foreground placeholder:text-muted-foreground"
                        disabled={isSubmitting}
                      />
                      {errors.address && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {errors.address.message}
                        </p>
                      )}
                    </div>

                    {/* Delivery Instructions */}
                    <div className="space-y-1.5">
                      <Label htmlFor="delivery-notes" className="text-sm font-semibold text-foreground/90">
                        Delivery Instructions (Optional)
                      </Label>
                      <Input
                        id="delivery-notes"
                        {...register('deliveryNotes')}
                        placeholder="e.g., Ring doorbell twice, leave with guard"
                        className="h-10 text-sm rounded-xl border-input bg-background/50 focus:border-orange-500 focus:ring-orange-500/20 text-foreground placeholder:text-muted-foreground"
                        disabled={isSubmitting}
                      />
                      {errors.deliveryNotes && (
                        <p className="text-xs text-destructive">{errors.deliveryNotes.message}</p>
                      )}
                    </div>

                    {/* Save Address for Later */}
                    {session?.user && (
                      <div className="pt-2 border-t border-border space-y-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="save-address"
                            checked={saveAddressForLater}
                            onChange={(e) => setSaveAddressForLater(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                          />
                          <Label htmlFor="save-address" className="text-xs font-medium text-foreground/80 cursor-pointer">
                            Save this address for future orders
                          </Label>
                        </div>
                        {saveAddressForLater && (
                          <div className="flex items-center gap-2 pl-6 pt-1">
                            <span className="text-xs text-muted-foreground font-medium">Save as:</span>
                            {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                              <button
                                key={lbl}
                                type="button"
                                onClick={() => setAddressLabel(lbl)}
                                className={cn(
                                  'px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer',
                                  addressLabel === lbl
                                    ? 'bg-orange-500 text-white border-orange-500'
                                    : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted',
                                )}
                              >
                                {lbl}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── 2. CONTACT NUMBER CARD ── */}
                <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
                  <div className="px-5 py-4 border-b border-border">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-xs shrink-0 mt-0.5">
                        <Phone className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-foreground">2. Contact Number</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          The rider will call this number upon arrival.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    {!isEditingPhone && watchedPhone ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card/60 dark:bg-card/40 p-4 transition-all">
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase block">
                            {watchedPhone === normalizedProfilePhone
                              ? 'DEFAULT MOBILE NUMBER'
                              : 'CONTACT NUMBER FOR THIS ORDER'}
                          </span>
                          <div className="text-base sm:text-lg font-bold font-mono text-foreground tracking-wide">
                            +977 {watchedPhone}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setIsEditingPhone(true)}
                          className="text-sm font-semibold text-orange-500 hover:text-orange-600 hover:bg-orange-500/10 self-start sm:self-center h-auto p-0 cursor-pointer"
                        >
                          Change for this order
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {phoneSuggestions.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Select from Saved Numbers
                            </Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {phoneSuggestions.map((item) => {
                                const isSelected = watchedPhone === item.phone
                                return (
                                  <button
                                    key={item.phone}
                                    type="button"
                                    onClick={() => {
                                      setValue('phone', item.phone, {
                                        shouldValidate: true,
                                      })
                                      setIsEditingPhone(false)
                                      toast.success(
                                        `Selected +977 ${item.phone}`,
                                      )
                                    }}
                                    className={cn(
                                      'flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer group',
                                      isSelected
                                        ? 'border-orange-500 bg-orange-500/10 dark:bg-orange-500/15 ring-1 ring-orange-500 text-foreground'
                                        : 'border-border bg-card hover:border-border/80 hover:bg-muted/40 text-muted-foreground',
                                    )}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div
                                        className={cn(
                                          'size-4 rounded-full border-2 flex items-center justify-center shrink-0',
                                          isSelected
                                            ? 'border-orange-500 bg-orange-500'
                                            : 'border-input group-hover:border-muted-foreground',
                                        )}
                                      >
                                        {isSelected && (
                                          <div className="size-1.5 rounded-full bg-white" />
                                        )}
                                      </div>
                                      <div>
                                        <div className="font-mono text-sm font-bold text-foreground">
                                          +977 {item.phone}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground font-medium">
                                          {item.label}
                                        </span>
                                      </div>
                                    </div>
                                    {item.isDefault && (
                                      <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 rounded font-semibold">
                                        Default
                                      </span>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Custom / Different Phone Input */}
                        <div className="space-y-3 pt-2 border-t border-border">
                          <div className="flex items-center justify-between">
                            <Label
                              htmlFor="phone-input"
                              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                            >
                              {phoneSuggestions.length > 0
                                ? 'Or Enter a Different Number'
                                : 'Mobile Phone (10 Digits)'}
                            </Label>
                            {watchedPhone && (
                              <button
                                type="button"
                                onClick={() => setIsEditingPhone(false)}
                                className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                          </div>

                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono text-muted-foreground select-none">
                              +977
                            </span>
                            <Input
                              id="phone-input"
                              type="tel"
                              maxLength={10}
                              {...register('phone')}
                              placeholder="98XXXXXXXX"
                              className="h-10 pl-14 text-sm font-mono rounded-xl border-input bg-background/50 focus:border-orange-500 focus:ring-orange-500/20 text-foreground"
                              disabled={isSubmitting}
                            />
                          </div>

                          {errors.phone && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5" />
                              {errors.phone.message}
                            </p>
                          )}

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                            <div className="flex items-center space-x-2">
                              <Controller
                                name="savePhoneAsDefault"
                                control={control}
                                render={({ field }) => (
                                  <Checkbox
                                    id="save-phone-default"
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={isSubmitting}
                                  />
                                )}
                              />
                              <Label
                                htmlFor="save-phone-default"
                                className="text-xs text-muted-foreground font-normal cursor-pointer select-none"
                              >
                                Save as default phone number for profile
                              </Label>
                            </div>

                            <Button
                              type="button"
                              size="sm"
                              disabled={!watchedPhone || watchedPhone.length < 10}
                              onClick={() => {
                                const norm = normalizeNepaliPhone(watchedPhone)
                                if (!norm) {
                                  toast.error(
                                    'Please enter a valid 10-digit Nepali mobile number (starting with 98 or 97)',
                                  )
                                  return
                                }
                                setValue('phone', norm, { shouldValidate: true })
                                setIsEditingPhone(false)
                                toast.success(`Contact number set to +977 ${norm}`)
                              }}
                              className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-4 h-8 text-xs font-semibold cursor-pointer shrink-0 self-end sm:self-auto"
                            >
                              Done
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── 3. DELIVERY SCHEDULE CARD ── */}
                <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
                  <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-xs">
                      <Clock className="h-4.5 w-4.5" />
                    </div>
                    <h2 className="text-base font-bold text-foreground">3. Delivery Schedule</h2>
                  </div>
                  <div className="p-5 space-y-4">
                    <Controller
                      name="deliverySlot"
                      control={control}
                      render={({ field }) => {
                        const isClosed = Boolean(storeStatus && !storeStatus.isOpen)
                        const slots = [
                          {
                            id: 'express',
                            title: '⚡ Express Delivery',
                            time: isClosed ? 'Unavailable' : 'Within 30–45 mins',
                            disabled: isClosed,
                          },
                          {
                            id: 'evening',
                            title: '🌙 Evening Slot',
                            time: '6:00 PM – 8:00 PM',
                            disabled: false,
                          },
                          {
                            id: 'late_night',
                            title: '✨ Late Night',
                            time: '8:00 PM – 10:00 PM',
                            disabled: false,
                          },
                          {
                            id: 'custom',
                            title: '📅 Custom',
                            time: isClosed ? 'Pick Reopen Time' : 'Pick Date & Time',
                            disabled: false,
                          },
                        ]
                        return (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {slots.map((slot) => {
                              const isSelected = field.value === slot.id
                              return (
                                <div
                                  key={slot.id}
                                  onClick={() => { if (!slot.disabled) field.onChange(slot.id) }}
                                  className={cn(
                                    'p-3 rounded-xl border transition-all flex flex-col gap-1',
                                    slot.disabled
                                      ? 'opacity-40 cursor-not-allowed bg-muted/30 border-dashed border-border'
                                      : 'cursor-pointer hover:border-orange-500/40 hover:bg-orange-500/5',
                                    isSelected && !slot.disabled
                                      ? 'border-orange-500 bg-orange-500/10 dark:bg-orange-500/15 ring-1 ring-orange-500'
                                      : !slot.disabled
                                        ? 'border-border bg-card'
                                        : '',
                                  )}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-xs text-foreground">{slot.title}</span>
                                    {isSelected && <Check className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                                  </div>
                                  <span className={cn(
                                    'text-[11px] font-medium',
                                    slot.disabled ? 'text-muted-foreground line-through' : 'text-orange-600 dark:text-orange-400',
                                  )}>
                                    {slot.time}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )
                      }}
                    />

                    {watchedDeliverySlot === 'custom' && (
                      <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 dark:bg-orange-500/10 p-4 space-y-3 animate-in fade-in-50 duration-200">
                        {storeStatus && !storeStatus.isOpen && (
                          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300">
                            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                            <div>
                              <p className="font-semibold">Advance Notice</p>
                              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                                Store is closed. {storeStatus.nextOpeningFormatted ? `Reopening: ${storeStatus.nextOpeningFormatted}. ` : ''}Select a time after reopening.
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-orange-500" />
                            Preferred Date & Time
                          </span>
                          {watchedCustomTime && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 font-mono">
                              {watchedCustomDate === getTodayDateString()
                                ? 'Today'
                                : watchedCustomDate === getTomorrowDateString()
                                  ? 'Tomorrow'
                                  : watchedCustomDate}{' '}
                              at {formatTimeTo12Hour(watchedCustomTime)}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="custom-delivery-date" className="text-xs font-medium text-muted-foreground">Date</Label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setValue('customDeliveryDate', getTodayDateString())}
                                className={cn(
                                  'text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer',
                                  watchedCustomDate === getTodayDateString()
                                    ? 'bg-orange-500 text-white border-orange-500'
                                    : 'bg-card hover:bg-muted text-foreground border-border',
                                )}
                              >
                                Today
                              </button>
                              <button
                                type="button"
                                onClick={() => setValue('customDeliveryDate', getTomorrowDateString())}
                                className={cn(
                                  'text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer',
                                  watchedCustomDate === getTomorrowDateString()
                                    ? 'bg-orange-500 text-white border-orange-500'
                                    : 'bg-card hover:bg-muted text-foreground border-border',
                                )}
                              >
                                Tomorrow
                              </button>
                              <Input
                                id="custom-delivery-date"
                                type="date"
                                min={getTodayDateString()}
                                {...register('customDeliveryDate')}
                                className="h-8 text-xs flex-1 rounded-lg border-input bg-background/50 text-foreground"
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="custom-delivery-time" className="text-xs font-medium text-muted-foreground">Time</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                id="custom-delivery-time"
                                type="time"
                                {...register('customDeliveryTime')}
                                className="h-8 text-xs flex-1 rounded-lg border-input bg-background/50 text-foreground"
                              />
                              <button
                                type="button"
                                onClick={() => setValue('customDeliveryTime', getDefaultCustomTimeString())}
                                className="text-xs px-2 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground cursor-pointer"
                              >
                                +45 Mins
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── 4. PAYMENT METHOD CARD ── */}
                <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-xs">
                        <CreditCard className="h-4.5 w-4.5" />
                      </div>
                      <h2 className="text-base font-bold text-foreground">4. Payment Method</h2>
                    </div>
                    {activePaymentGateways.some((g) => g.id === 'esewa') && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Secure Payment</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <Controller
                      name="paymentMethod"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className={getPaymentMethodGridClass(activePaymentGateways.length)}
                        >
                          {activePaymentGateways.map((gw) => {
                            const isSelected = field.value === gw.id
                            const visual = PAYMENT_VISUALS[gw.id]
                            const isEsewa = gw.id === 'esewa'

                            return (
                              <Label
                                key={gw.id}
                                htmlFor={`pay-${gw.id}`}
                                className={cn(
                                  'relative flex items-center gap-3 rounded-2xl p-3.5 sm:p-4 cursor-pointer transition-all duration-200 select-none group',
                                  isSelected
                                    ? 'border-2 border-orange-500 bg-orange-500/10 dark:bg-orange-500/15 shadow-xs text-foreground'
                                    : 'border border-border bg-card hover:border-border/80 hover:bg-muted/40 text-foreground',
                                )}
                              >
                                {/* Radio circle */}
                                <div className="shrink-0">
                                  {isSelected ? (
                                    <div className="size-5 rounded-full border-[2.5px] border-orange-500 flex items-center justify-center">
                                      <div className="size-2 rounded-full bg-orange-500" />
                                    </div>
                                  ) : (
                                    <div className="size-5 rounded-full border-2 border-input group-hover:border-muted-foreground transition-colors" />
                                  )}
                                </div>

                                {/* Payment icon */}
                                <div className="shrink-0">
                                  {getPaymentIcon(gw.id)}
                                </div>

                                {/* Label & subtitle */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-sm text-foreground leading-snug">
                                      {gw.name}
                                    </span>
                                    {isEsewa && visual?.badgeLabel && (
                                      <span className="text-[10px] font-semibold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                                        {visual.badgeLabel}
                                      </span>
                                    )}
                                  </div>
                                  {(visual?.subtitle || gw.description) && (
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                      {visual?.subtitle || gw.description}
                                    </p>
                                  )}
                                </div>

                                <RadioGroupItem value={gw.id} id={`pay-${gw.id}`} className="sr-only" />
                              </Label>
                            )
                          })}
                        </RadioGroup>
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* ═══════════ RIGHT COLUMN (Order Summary) ═══════════ */}
              <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0">
                <div className="lg:sticky lg:top-24 space-y-5">

                  {/* ── ORDER SUMMARY CARD ── */}
                  <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                      <h2 className="text-base font-bold text-foreground">Order Summary</h2>
                      <span className="text-xs text-muted-foreground font-medium">
                        {items.reduce((acc, i) => acc + i.quantity, 0)} Items
                      </span>
                    </div>
                    <div className="p-5 space-y-4">
                      {/* Items */}
                      <div className="space-y-3">
                        {items.map((item) => (
                          <div key={item.variantId} className="flex items-center gap-3">
                            {/* Product image */}
                            <div className="size-14 md:size-16 rounded-xl bg-muted overflow-hidden shrink-0 border border-border">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.productName}
                                  className="size-full object-cover"
                                />
                              ) : (
                                <div className="size-full flex items-center justify-center">
                                  <ShoppingBag className="size-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{item.productName}</p>
                              <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-sm font-bold text-foreground">{formatNPR(item.price * item.quantity)}</span>
                              {item.mrp && item.mrp > item.price && (
                                <span className="block text-xs text-muted-foreground line-through">{formatNPR(item.mrp * item.quantity)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <Separator className="bg-border" />

                      {/* Totals */}
                      <div className="space-y-2.5 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Subtotal</span>
                          <span className="font-semibold text-foreground">{formatNPR(totalPaisa)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Delivery Charge</span>
                          <span className="font-semibold text-foreground">
                            {deliveryCharge === 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400">Free</span>
                            ) : (
                              formatNPR(deliveryCharge)
                            )}
                          </span>
                        </div>
                        {promoDiscount > 0 && (
                          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                            <span>Discount</span>
                            <span className="font-semibold">- {formatNPR(promoDiscount)}</span>
                          </div>
                        )}
                        {totalSavingsPaisa > 0 && (
                          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                            <span>Savings</span>
                            <span className="font-semibold">- {formatNPR(totalSavingsPaisa)}</span>
                          </div>
                        )}
                      </div>

                      <Separator className="bg-border" />

                      {/* Total */}
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-foreground">Total Payable</span>
                        <span className="text-xl font-black text-orange-600 dark:text-orange-400">{formatNPR(orderTotal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* ── COUPON SECTION ── */}
                  <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden p-5">
                    {appliedPromo ? (
                      <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          <div>
                            <span className="font-mono text-xs font-bold text-foreground">{appliedPromo.code}</span>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">-{formatNPR(appliedPromo.discountPaisa)}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemovePromo}
                          className="text-xs text-destructive hover:bg-destructive/10"
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="text"
                            value={promoCodeInput}
                            onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                            placeholder="Have a coupon?"
                            className="h-10 pl-10 text-sm font-mono uppercase rounded-xl border-input bg-background/50 focus:border-orange-500 focus:ring-orange-500/20 text-foreground"
                            disabled={isSubmitting || isValidatingPromo}
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={handleApplyPromo}
                          disabled={!promoCodeInput.trim() || isValidatingPromo || isSubmitting}
                          className="h-10 px-5 text-sm font-semibold rounded-xl bg-orange-500 hover:bg-orange-600 text-white cursor-pointer"
                        >
                          {isValidatingPromo ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Apply'
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* ── DESKTOP PLACE ORDER BUTTON ── */}
                  <div className="hidden lg:block">
                    {storeStatus && !storeStatus.isOpen && !storeStatus.allowAdvanceOrders ? (
                      <div className="space-y-2">
                        <Button
                          type="button"
                          disabled
                          className="w-full h-14 text-base font-bold rounded-xl bg-muted text-muted-foreground cursor-not-allowed"
                        >
                          <Lock className="h-5 w-5 mr-2" />
                          Orders Closed · Reopens {storeStatus.nextOpeningFormatted || 'Soon'}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-14 text-base font-bold rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25 transition-all gap-2 cursor-pointer"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Placing Order...
                          </>
                        ) : storeStatus && !storeStatus.isOpen && storeStatus.allowAdvanceOrders ? (
                          <>
                            <Lock className="h-4 w-4" />
                            Place Scheduled Order →
                          </>
                        ) : (
                          <>
                            <Lock className="h-4 w-4" />
                            Place Order →
                          </>
                        )}
                      </Button>
                    )}
                    <p className="text-center text-[11px] text-muted-foreground mt-2 flex items-center justify-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Secure checkout · Your data is protected
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── MOBILE STICKY BOTTOM BAR ─── */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.15)] pb-[env(safe-area-inset-bottom,0px)]">
            <div className="flex items-center justify-between px-4 py-3 gap-4">
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground font-medium block">Total Payable</span>
                <span className="text-lg font-black text-orange-600 dark:text-orange-400">{formatNPR(orderTotal)}</span>
              </div>
              {storeStatus && !storeStatus.isOpen && !storeStatus.allowAdvanceOrders ? (
                <Button
                  type="button"
                  disabled
                  className="h-12 px-6 rounded-xl bg-muted text-muted-foreground font-bold text-sm cursor-not-allowed"
                >
                  <Lock className="h-4 w-4 mr-1.5" />
                  Closed
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm shadow-lg shadow-orange-500/25 transition-all gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Placing...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Place Order →
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>

        {/* Bottom spacer for mobile sticky bar */}
        <div className="lg:hidden h-24" />
      </main>

      {/* ─── CHECKOUT FOOTER (desktop simplified) ─── */}
      <div className="hidden md:block bg-card/60 border-t border-border">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-6">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <img
                src="https://mezmani.com/mezmani_logo.webp"
                onError={(e) => {
                  const target = e.currentTarget
                  if (target.src !== `${window.location.origin}/mezmani_logo.webp`) {
                    target.src = '/mezmani_logo.webp'
                  }
                }}
                alt="Mezmani"
                className="h-5 w-auto opacity-50 dark:hidden"
              />
              <img
                src="https://mezmani.com/mezmani_logo_bg.svg"
                onError={(e) => {
                  const target = e.currentTarget
                  if (target.src !== `${window.location.origin}/mezmani_logo_bg.svg`) {
                    target.src = '/mezmani_logo_bg.svg'
                  }
                }}
                alt="Mezmani"
                className="h-5 w-auto opacity-50 hidden dark:block"
              />
              <span className="text-xs text-muted-foreground">Food · Drinks · More</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Bike className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs">Fast Delivery<br /><strong className="text-foreground">30–40 min</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs">Secure Payment<br /><strong className="text-foreground">100% Safe</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs">24/7 Support<br /><strong className="text-foreground">We're here to help</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
