import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { ShieldAlert, Wine } from 'lucide-react'

import { idbGet, idbSet } from '#/lib/idb'

const AGE_VERIFIED_KEY = 'Mezmani_age_verified_18'

export function AgeGate() {
  const [isOpen, setIsOpen] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)

  useEffect(() => {
    idbGet<boolean>(AGE_VERIFIED_KEY, false).then((verified) => {
      if (!verified) {
        setIsOpen(true)
      }
    })
  }, [])

  const handleConfirm = () => {
    idbSet(AGE_VERIFIED_KEY, true).catch(() => {})
    setIsOpen(false)
  }

  const handleDecline = () => {
    setIsBlocked(true)
  }

  if (isBlocked) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 p-6 text-center text-foreground">
        <ShieldAlert className="mb-4 h-16 w-16 text-warning" />
        <h1 className="text-3xl font-bold tracking-tight">Access Restricted</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          You must be 18 years of age or older to enter Mezmani and view alcohol
          products in accordance with Nepal Liquor Regulations.
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          Please revisit when you meet the legal drinking age. Drink
          responsibly.
        </p>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="border-border bg-card text-card-foreground sm:max-w-md"
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Wine className="h-7 w-7" />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight">
            Age Verification
          </DialogTitle>
          <DialogDescription className="mt-2 text-muted-foreground">
            Welcome to{' '}
            <span className="font-semibold text-primary">Mezmani</span>. You
            must be at least{' '}
            <span className="font-semibold text-foreground">
              18 years of age
            </span>{' '}
            to purchase alcohol and enter this site in Nepal.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 flex flex-col gap-3">
          <Button size="lg" className="w-full" onClick={handleConfirm}>
            I am 18 or older
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleDecline}
          >
            I am under 18
          </Button>
        </div>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          By entering, you confirm you are of legal drinking age and accept our
          terms.
        </p>
      </DialogContent>
    </Dialog>
  )
}
