import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { Card, CardContent } from '#/components/ui/card'
import { Button } from '#/components/ui/button'
import { XCircle, ArrowLeft } from 'lucide-react'

const searchSchema = z.object({
  orderId: z.string().optional(),
})

export const Route = createFileRoute('/checkout/payment/esewa/failure')({
  validateSearch: (s) => searchSchema.parse(s),
  component: EsewaFailurePage,
})

function EsewaFailurePage() {
  const { orderId } = Route.useSearch()

  return (
    <div className="storefront min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Header />
      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <Card className="max-w-md w-full text-center p-8 border-border">
          <CardContent className="p-0 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <XCircle className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              Payment Not Completed
            </h2>
            <p className="text-xs text-muted-foreground">
              Your eSewa transaction was cancelled or could not be processed. No funds were debited.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row gap-2 justify-center">
              <Button asChild size="sm" className="gap-1.5 text-xs">
                <Link to="/checkout">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Try Again / Choose COD
                </Link>
              </Button>
              {orderId && (
                <Button asChild variant="outline" size="sm" className="text-xs">
                  <Link
                    to="/order-confirmation/$orderId"
                    params={{ orderId }}
                  >
                    View Order
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}
