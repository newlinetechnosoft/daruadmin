import { useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { clearAllLocalData } from '#/lib/idb'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
import { LogOut } from 'lucide-react'

export default function BetterAuthHeader() {
  const { data: session, isPending } = authClient.useSession()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  if (isPending) {
    return <div className="h-8 w-8 bg-muted animate-pulse rounded" />
  }

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      await authClient.signOut()
      await clearAllLocalData()
    } finally {
      setIsSigningOut(false)
    }
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        {session.user.image ? (
          <img src={session.user.image} alt="" className="h-8 w-8 rounded" />
        ) : (
          <div className="h-8 w-8 bg-muted flex items-center justify-center rounded">
            <span className="text-xs font-medium text-muted-foreground">
              {session.user.name.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
        )}
        <button
          onClick={() => setIsConfirmOpen(true)}
          className="flex-1 h-9 px-4 text-sm font-medium bg-card text-foreground border border-border hover:bg-accent hover:text-accent-foreground transition-colors rounded cursor-pointer"
        >
          Sign out
        </button>

        <ConfirmDialog
          open={isConfirmOpen}
          onOpenChange={setIsConfirmOpen}
          title="Sign out?"
          description="Are you sure you want to sign out of your account?"
          confirmLabel="Sign out"
          tone="destructive"
          isLoading={isSigningOut}
          icon={<LogOut className="h-5 w-5 text-destructive" />}
          onConfirm={handleSignOut}
        />
      </div>
    )
  }

  return null
}
