import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { authClient } from '#/lib/auth-client'
import { useCart } from '#/lib/cart-context'
import { formatNPR } from '#/lib/money'
import {
  checkoutFormSchema,
  normalizeNepaliPhone,
} from '#/server/orders/order.schemas'
import type { CheckoutFormData } from '#/server/orders/order.schemas'
import {
  validatePromoFn,
  createCustomerOrderFn,
} from '#/server/orders/order.functions'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { DeliveryMap } from './delivery-map'
import { DEFAULT_MAP_CENTER } from '#/lib/map-config'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '#/components/ui/card'
import { RadioGroup, RadioGroupItem } from '#/components/ui/radio-group'
import { Separator } from '#/components/ui/separator'
import { Badge } from '#/components/ui/badge'
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
} from 'lucide-react'
import { toast } from 'sonner'

const FREE_DELIVERY_THRESHOLD = 300000 // Rs. 3,000 in paisa
const STANDARD_DELIVERY_CHARGE = 15000 // Rs. 150 in paisa

export function CheckoutPanel() {
  const { data: session } = authClient.useSession()
  const { items, totalPaisa, clearCart } = useCart()
  const navigate = useNavigate()

  // Profile phone check
  const rawProfilePhone =
    (session?.user as { phone?: string | null })?.phone || ''
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
      items: items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
      })),
    },
  })

  const selectedPaymentMethod = watch('paymentMethod')
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
    totalPaisa >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_CHARGE
  const promoDiscount = appliedPromo?.discountPaisa ?? 0
  const orderTotal = Math.max(0, totalPaisa - promoDiscount + deliveryCharge)

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

      if (!result.success) {
        toast.error('Failed to create order. Please try again.')
        setIsSubmitting(false)
        return
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
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Order submission failed',
      )
      setIsSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="storefront min-h-screen bg-background text-foreground flex flex-col font-sans">
        <Header />
        <main className="flex-1 flex items-center justify-center py-16 px-4">
          <Card className="max-w-md w-full text-center p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-4">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              Your cart is empty
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Add spirits, cold beer, or snacks to your cart before proceeding
              to checkout.
            </p>
            <Button asChild className="mt-6 text-xs gap-2" size="sm">
              <Link to="/drinks">
                Browse catalog
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="storefront min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Header />

      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Checkout Header */}
          <div className="border-b border-border pb-6 mb-8">
            <div className="flex items-center gap-2">
              <Badge
                variant="default"
                className="text-[10px] uppercase tracking-wider"
              >
                Express 40-Min Dispatch
              </Badge>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-black uppercase tracking-tight text-foreground">
              Fast Checkout
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Pin your location, confirm payment method, and dispatch your
              order.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* 1. DELIVERY LOCATION SECTION (LEAFLET MAP PIN) */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">
                      1. Delivery Location
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Drop a precise pin on OpenStreetMap for Butwal / Rupandehi
                      express rider routing.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <Controller
                  name="lat"
                  control={control}
                  render={() => (
                    <DeliveryMap
                      value={selectedLocation}
                      disabled={isSubmitting}
                      onChange={(pt) => {
                        setValue('lat', pt.lat, { shouldValidate: true })
                        setValue('lng', pt.lng, { shouldValidate: true })
                      }}
                    />
                  )}
                />
                {(errors.lat || errors.lng) && (
                  <p className="text-xs font-medium text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Please drop a valid delivery location pin on the map.
                  </p>
                )}

                {/* Free-text Landmark / Address Field */}
                <div className="space-y-1.5 pt-2">
                  <Label
                    htmlFor="address-input"
                    className="text-xs font-semibold"
                  >
                    Address / Landmark (Required)
                  </Label>
                  <Input
                    id="address-input"
                    {...register('address')}
                    placeholder="e.g., Near Bhatbhateni Supermarket, House 42, Blue Gate"
                    className="h-9 text-xs"
                    disabled={isSubmitting}
                  />
                  {errors.address && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errors.address.message}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Nepali delivery drivers rely heavily on landmarks and
                    notable gates or shops.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 2. CONTACT PHONE NUMBER SECTION */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">
                      2. Contact Number
                    </CardTitle>
                    <CardDescription className="text-xs">
                      The rider will call this number upon arrival.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                {!isEditingPhone && hasProfilePhone ? (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wider block font-medium">
                        Default Mobile Number
                      </span>
                      <span className="font-mono text-sm font-bold text-foreground">
                        +977 {watchedPhone}
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingPhone(true)}
                      className="text-xs text-primary hover:text-primary/80 font-semibold cursor-pointer"
                    >
                      Change for this order
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="phone-input"
                          className="text-xs font-semibold"
                        >
                          Mobile Phone (10 digits starting with 98 or 97)
                        </Label>
                        {hasProfilePhone && (
                          <button
                            type="button"
                            onClick={() => {
                              setValue('phone', normalizedProfilePhone || '')
                              setIsEditingPhone(false)
                            }}
                            className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                          +977
                        </span>
                        <Input
                          id="phone-input"
                          type="tel"
                          {...register('phone')}
                          placeholder="98XXXXXXXX"
                          className="h-9 pl-14 text-xs font-mono"
                          disabled={isSubmitting}
                        />
                      </div>
                      {errors.phone && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {errors.phone.message}
                        </p>
                      )}
                    </div>

                    {/* Checkbox to save as default */}
                    <div className="flex items-center space-x-2 pt-1">
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
                        className="text-xs text-muted-foreground font-normal cursor-pointer"
                      >
                        Save as my default account phone number
                      </Label>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3. PAYMENT METHOD SECTION (ONLY COD & ESEWA) */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold">
                      3. Payment Method
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Choose between instant cash at your doorstep or eSewa
                      wallet.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <Controller
                  name="paymentMethod"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    >
                      {/* COD Option */}
                      <Label
                        htmlFor="pay-cod"
                        className={`flex flex-col justify-between rounded-lg border p-4 cursor-pointer transition-all ${
                          field.value === 'cod'
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border bg-card hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-foreground">
                            Cash on Delivery
                          </span>
                          <RadioGroupItem value="cod" id="pay-cod" />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Pay the rider in cash when your order arrives at your
                          door.
                        </p>
                      </Label>

                      {/* eSewa Option */}
                      <Label
                        htmlFor="pay-esewa"
                        className={`flex flex-col justify-between rounded-lg border p-4 cursor-pointer transition-all ${
                          field.value === 'esewa'
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border bg-card hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            eSewa Mobile Wallet
                          </span>
                          <RadioGroupItem value="esewa" id="pay-esewa" />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Fast online checkout via official eSewa ePay v2.
                        </p>
                      </Label>
                    </RadioGroup>
                  )}
                />
              </CardContent>
            </Card>

            {/* 4. PROMO CODE SECTION */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-bold">
                    Promo Code (Optional)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {appliedPromo ? (
                  <div className="flex items-center justify-between rounded-md border border-success/40 bg-success/10 p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <div>
                        <span className="font-mono text-xs font-bold text-foreground">
                          {appliedPromo.code}
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          Discount applied: -
                          {formatNPR(appliedPromo.discountPaisa)}
                        </p>
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
                    <Input
                      type="text"
                      value={promoCodeInput}
                      onChange={(e) =>
                        setPromoCodeInput(e.target.value.toUpperCase())
                      }
                      placeholder="e.g. WELCOME10, DASHAIN250"
                      className="h-9 text-xs font-mono uppercase"
                      disabled={isSubmitting || isValidatingPromo}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleApplyPromo}
                      disabled={
                        !promoCodeInput.trim() ||
                        isValidatingPromo ||
                        isSubmitting
                      }
                      className="h-9 px-4 text-xs font-semibold cursor-pointer"
                    >
                      {isValidatingPromo ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Apply'
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 5. REVIEW & CONFIRM ORDER SUMMARY */}
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="border-b border-border pb-4 bg-muted/10">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold">
                      Review &amp; Confirm
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Please verify your order items and dispatch destination.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    {items.reduce((acc, i) => acc + i.quantity, 0)} Items
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* Items Summary Table */}
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
                        className="flex items-center justify-between text-xs gap-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {item.quantity}x
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-medium text-foreground">
                                {item.productName}
                              </p>
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
                            <p className="text-[11px] text-muted-foreground">
                              {item.variantName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-baseline gap-1.5 font-mono shrink-0">
                          <span className="font-semibold text-foreground">
                            {formatNPR(item.price * item.quantity)}
                          </span>
                          {item.mrp && item.mrp > item.price && (
                            <span className="text-[10px] text-muted-foreground line-through">
                              {formatNPR(item.mrp * item.quantity)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <Separator />

                {/* Totals Breakdown */}
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-mono font-medium text-foreground">
                      {formatNPR(totalPaisa)}
                    </span>
                  </div>

                  {totalSavingsPaisa > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                      <span>Total Savings</span>
                      <span className="font-mono font-medium">
                        -{formatNPR(totalSavingsPaisa)}
                      </span>
                    </div>
                  )}

                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Promo Discount ({appliedPromo?.code})</span>
                      <span className="font-mono font-medium">
                        -{formatNPR(promoDiscount)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="flex items-center gap-1">
                      <Bike className="h-3.5 w-3.5 text-primary" />
                      40-Min Express Delivery
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      {deliveryCharge === 0 ? (
                        <span className="text-success font-semibold">Free</span>
                      ) : (
                        formatNPR(deliveryCharge)
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px]">
                    <span>VAT (13% included)</span>
                    <span>Included</span>
                  </div>
                </div>

                <Separator />

                {/* Final Total */}
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Total Payable Amount
                    </span>
                    <span className="text-2xl font-black font-mono text-foreground">
                      {formatNPR(orderTotal)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block">
                      Payment
                    </span>
                    <Badge
                      variant="secondary"
                      className="font-semibold text-xs"
                    >
                      {selectedPaymentMethod === 'cod'
                        ? 'Cash on Delivery'
                        : 'eSewa'}
                    </Badge>
                  </div>
                </div>

                {/* Delivery Note */}
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    {selectedPaymentMethod === 'cod' ? (
                      <p>
                        <strong className="text-foreground">
                          Payment on delivery:
                        </strong>{' '}
                        Pay the rider in cash when your order arrives.
                      </p>
                    ) : (
                      <p>
                        <strong className="text-foreground">
                          Digital payment:
                        </strong>{' '}
                        You will be routed to eSewa to authorize payment
                        securely.
                      </p>
                    )}
                    <p className="mt-1 text-[11px]">
                      Destination:{' '}
                      <span className="text-foreground">
                        {watchedAddress || 'Landmark specified above'}
                      </span>{' '}
                      (+977 {watchedPhone || '—'})
                    </p>
                  </div>
                </div>

                {/* Place Order Button */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 text-sm font-bold uppercase tracking-wide gap-2 cursor-pointer shadow-md"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Placing Order...
                    </>
                  ) : (
                    <>
                      Place Order · {formatNPR(orderTotal)}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  )
}
