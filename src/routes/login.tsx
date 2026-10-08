import { useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { authClient } from '#/lib/auth-client'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { toast } from 'sonner'
import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react'

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/login')({
  validateSearch: (search) => loginSearchSchema.parse(search),
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      toast.error('Please enter both email and password')
      return
    }

    setIsLoading(true)
    try {
      const res = await authClient.signIn.email({
        email: email.trim(),
        password,
        rememberMe,
      })

      if (res.error) {
        toast.error(res.error.message || 'Invalid email or password')
        setIsLoading(false)
        return
      }

      toast.success('Welcome back to Mezmani!')
      navigate({
        to: search.redirect || '/drinks',
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sign in failed')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f5ef] text-[#181818] flex flex-col font-sans">
      <Header />

      <main className="flex-1 flex items-center justify-center py-12 sm:py-16 px-4">
        <div className="w-full max-w-[440px]">
          {/* AUTH CARD */}
          <div className="rounded-[6px] border border-[#dedbd4] bg-white p-7 sm:p-10 shadow-[0_12px_32px_rgba(0,0,0,0.05)]">
            <div className="text-center mb-8">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#777] block mb-2">
                WELCOME BACK
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-[-0.05em] text-[#181818] uppercase">
                Sign In
              </h1>
              <p className="mt-2 text-xs text-[#777] leading-relaxed">
                Access your orders, saved addresses and faster 40-minute drinks
                dispatch.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* EMAIL FIELD */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#181818] mb-1.5"
                >
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#888]">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full h-11 pl-10 pr-3.5 rounded-[3px] border border-[#dedbd4] bg-[#fdfdfc] text-xs text-[#181818] placeholder:text-[#999] focus:outline-none focus:border-[#171717] focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* PASSWORD FIELD */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#181818]"
                  >
                    Password
                  </label>
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault()
                      toast.info(
                        'Password reset: please contact customer care via 9802088800',
                      )
                    }}
                    className="text-[10px] font-semibold text-[#777] hover:text-[#181818] transition-colors"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#888]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-10 pr-10 rounded-[3px] border border-[#dedbd4] bg-[#fdfdfc] text-xs text-[#181818] placeholder:text-[#999] focus:outline-none focus:border-[#171717] focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#888] hover:text-[#181818] border-0 bg-transparent cursor-pointer p-0"
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* REMEMBER ME */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#666]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="accent-[#171717] rounded"
                  />
                  <span>Remember this device</span>
                </label>
              </div>

              {/* SUBMIT BUTTON */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-[#171717] text-white rounded-[3px] text-xs font-bold uppercase tracking-wider hover:bg-[#d8ff38] hover:text-[#111] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      SIGNING IN...
                    </span>
                  ) : (
                    <>
                      SIGN IN
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* SWITCH TO SIGN UP */}
            <div className="mt-8 pt-6 border-t border-[#dedbd4] text-center">
              <p className="text-xs text-[#666]">
                Don&apos;t have an account yet?{' '}
                <Link
                  to="/signup"
                  search={{ redirect: search.redirect }}
                  className="font-bold text-[#181818] hover:underline"
                >
                  Create an account →
                </Link>
              </p>
            </div>
          </div>

          {/* COMPLIANCE & TRUST STRIP */}
          <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-[#777]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>18+ Verified Platform</span>
            </div>
            <span>·</span>
            <span>⚡ 40-Min Valley Delivery</span>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
