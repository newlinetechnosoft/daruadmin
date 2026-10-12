import { authClient } from '#/lib/auth-client'
import { clearAllLocalData } from '#/lib/idb'

export default function BetterAuthHeader() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return <div className="h-8 w-8 bg-muted animate-pulse rounded" />
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
          onClick={async () => {
            await authClient.signOut()
            await clearAllLocalData()
          }}
          className="flex-1 h-9 px-4 text-sm font-medium bg-card text-foreground border border-border hover:bg-accent hover:text-accent-foreground transition-colors rounded"
        >
          Sign out
        </button>
      </div>
    )
  }

  return null
}
