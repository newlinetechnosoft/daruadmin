import { Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react'

export interface AuthPreloaderProps {
  isOpen: boolean
  mode: 'login' | 'signup' | 'verify'
  title?: string
  stage?: string
}

export function AuthPreloader({
  isOpen,
  mode,
  title,
  stage,
}: AuthPreloaderProps) {
  if (!isOpen) return null

  const defaultTitles = {
    login: 'Signing In...',
    signup: 'Creating Your Account...',
    verify: 'Verifying Mobile Number...',
  }

  const defaultStages = {
    login: 'Authenticating your credentials and securing your session...',
    signup: 'Registering your details and setting up express delivery...',
    verify: 'Confirming your 6-digit code and activating your account...',
  }

  const currentTitle = title || defaultTitles[mode]
  const currentStage = stage || defaultStages[mode]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={currentTitle}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 dark:bg-black/85 backdrop-blur-md transition-all duration-300 animate-in fade-in select-none"
    >
      <div className="relative w-full max-w-[380px] bg-card text-card-foreground border border-border shadow-2xl rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Subtle background glow accents */}
        <div className="absolute -top-12 -left-12 w-36 h-36 rounded-full bg-primary/15 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-36 h-36 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

        {/* Mezmani Brand Logo */}
        <div className="relative mb-6 flex items-center justify-center">
          <img
            src="/mezmani_logo.webp"
            alt="Mezmani"
            width="140"
            height="40"
            className="h-8 w-auto object-contain dark:hidden"
            onError={(e) => {
              const target = e.currentTarget
              if (target.src !== 'https://mezmani.com/mezmani_logo.webp') {
                target.src = 'https://mezmani.com/mezmani_logo.webp'
              }
            }}
          />
          <img
            src="/mezmani_logo_bg.svg"
            alt="Mezmani"
            width="140"
            height="40"
            className="h-8 w-auto object-contain hidden dark:block"
            onError={(e) => {
              const target = e.currentTarget
              if (target.src !== 'https://mezmani.com/mezmani_logo_bg.svg') {
                target.src = 'https://mezmani.com/mezmani_logo_bg.svg'
              }
            }}
          />
        </div>

        {/* Central Animated Loader */}
        <div className="relative flex items-center justify-center my-2">
          {/* Subtle Ambient Pulse */}
          <div className="absolute w-20 h-20 rounded-full bg-primary/20 blur-md animate-pulse" />

          {/* Dual spinning ring */}
          <div className="w-16 h-16 rounded-full border-4 border-muted border-t-primary border-r-primary animate-spin" />

          {/* Center Badge Icon */}
          <div className="absolute w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-xs">
            {mode === 'login' ? (
              <Sparkles className="w-4.5 h-4.5 animate-pulse text-primary" />
            ) : mode === 'signup' ? (
              <ShieldCheck className="w-4.5 h-4.5 animate-pulse text-primary" />
            ) : (
              <CheckCircle2 className="w-4.5 h-4.5 animate-pulse text-primary" />
            )}
          </div>
        </div>

        {/* Main Title */}
        <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground mt-4">
          {currentTitle}
        </h3>

        {/* Dynamic Status / Stage Message */}
        <p className="text-xs sm:text-sm text-muted-foreground mt-2 min-h-[2.5rem] flex items-center justify-center text-center leading-relaxed font-normal px-2">
          {currentStage}
        </p>

        {/* Sleek Progress Bar with Shimmer */}
        <div className="w-full max-w-[220px] h-1.5 bg-muted rounded-full overflow-hidden mt-3 relative">
          <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-transparent via-primary to-transparent animate-refresh-shimmer" />
        </div>

        {/* Security & Reassurance Footer */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80 mt-6 pt-3.5 border-t border-border/60 w-full justify-center">
          <ShieldCheck className="w-3.5 h-3.5 text-success" />
          <span>Secured encryption • Please do not refresh</span>
        </div>
      </div>
    </div>
  )
}
