import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { verifyEsewaPaymentFn } from '#/server/orders/order.functions'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { Card, CardContent } from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

const searchSchema = z.object({
  orderId: z.string().optional(),
  data: z.string().optional(),
})

export const Route = createFileRoute('/checkout/payment/esewa/success')({
  validateSearch: (s) => searchSchema.parse(s),
  component: EsewaSuccessPage,
})

function EsewaSuccessPage() {
  const { orderId, data } = Route.useSearch()
  const navigate = useNavigate()
  const [isVerifying, setIsVerifying] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId) {
      setError('Missing order ID in payment callback')
      setIsVerifying(false)
      return
    }

    let isMounted = true
    verifyEsewaPaymentFn({
      data: {
        orderId,
        encodedResponse: data,
      },
    })
      .then(() => {
        if (!isMounted) return
        navigate({
          to: '/order-confirmation/$orderId',
          params: { orderId },
        })
      })
      .catch((err) => {
        if (!isMounted) return
        setError(
          err instanceof Error ? err.message : 'Payment verification failed',
        )
      })
      .finally(() => {
        if (isMounted) setIsVerifying(false)
      })

    return () => {
      isMounted = false
    }
  }, [orderId, data, navigate])

  return (
    <div className="storefront min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Header />
      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <Card className="max-w-md w-full text-center p-8 border-border">
          <CardContent className="p-0 space-y-4">
            {isVerifying ? (
              <>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  Verifying eSewa Payment
                </h2>
                <p className="text-xs text-muted-foreground">
                  Please hold on while our server confirms your transaction with
                  eSewa...
                </p>
              </>
            ) : error ? (
              <>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertCircle className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  Verification Issue
                </h2>
                <p className="text-xs text-muted-foreground">{error}</p>
                <div className="pt-4 flex flex-col gap-2">
                  {orderId && (
                    <Button asChild size="sm">
                      <Link
                        to="/order-confirmation/$orderId"
                        params={{ orderId }}
                      >
                        View Order Details
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <Link to="/drinks">Return to Store</Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  Payment Verified!
                </h2>
                <p className="text-xs text-muted-foreground">
                  Redirecting to order confirmation...
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
