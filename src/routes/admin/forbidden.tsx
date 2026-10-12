import { createFileRoute, Link } from '@tanstack/react-router'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'

export const Route = createFileRoute('/admin/forbidden')({
  component: ForbiddenPage,
})

function ForbiddenPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-6 min-h-[60vh]">
      <Card className="max-w-md w-full text-center border-border">
        <CardContent className="pt-8 pb-8 px-6 flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Access Restricted
          </h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-sm">
            You do not possess the necessary role or permissions to view this
            module. Please reach out to an administrator if you believe this is
            an error.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Button asChild size="sm" variant="default" className="text-xs">
              <Link to="/admin">
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Return to Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
