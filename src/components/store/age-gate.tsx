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

const AGE_VERIFIED_KEY = 'Mezmani_age_verified_18'

export function AgeGate() {
  const [isOpen, setIsOpen] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)

  useEffect(() => {
    try {
      const verified = localStorage.getItem(AGE_VERIFIED_KEY)
      if (!verified) {
        setIsOpen(true)
      }
    } catch {
      setIsOpen(true)
    }
  }, [])

  const handleConfirm = () => {
    try {
      localStorage.setItem(AGE_VERIFIED_KEY, 'true')
    } catch {
      // ignore
    }
    setIsOpen(false)
  }

  const handleDecline = () => {
    setIsBlocked(true)
  }

  if (isBlocked) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-6 text-center text-white">
        <ShieldAlert className="mb-4 h-16 w-16 text-amber-500" />
        <h1 className="text-3xl font-bold tracking-tight">Access Restricted</h1>
        <p className="mt-3 max-w-md text-zinc-400">
          You must be 18 years of age or older to enter Mezmani and view alcohol
          products in accordance with Nepal Liquor Regulations.
        </p>
        <p className="mt-6 text-sm text-zinc-500">
          Please revisit when you meet the legal drinking age. Drink
          responsibly.
        </p>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="border-zinc-800 bg-zinc-950 text-white sm:max-w-md"
        showCloseButton={false}
      >
        <DialogHeader className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
            <Wine className="h-7 w-7" />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight">
            Age Verification
          </DialogTitle>
          <DialogDescription className="mt-2 text-zinc-400">
            Welcome to{' '}
            <span className="font-semibold text-amber-400">Mezmani</span>. You must
            be at least{' '}
            <span className="font-semibold text-white">18 years of age</span> to
            purchase alcohol and enter this site in Nepal.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full bg-amber-500 font-semibold text-zinc-950 hover:bg-amber-400"
            onClick={handleConfirm}
          >
            I am 18 or older
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full border-zinc-800 bg-transparent text-zinc-400 hover:bg-zinc-900 hover:text-white"
            onClick={handleDecline}
          >
            I am under 18
          </Button>
        </div>

        <p className="mt-2 text-center text-xs text-zinc-500">
          By entering, you confirm you are of legal drinking age and accept our
          terms.
        </p>
      </DialogContent>
    </Dialog>
  )
}
