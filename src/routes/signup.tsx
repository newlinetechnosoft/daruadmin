import { useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { authClient } from '#/lib/auth-client'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { toast } from 'sonner'
import {
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
} from 'lucide-react'

const signupSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/signup')({
  validateSearch: (search) => signupSearchSchema.parse(search),
  component: SignUpPage,
})

function SignUpPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Please enter your full name')
      return
    }

    if (!email.trim()) {
      toast.error('Please enter your email address')
      return
    }

    if (!phone.trim()) {
      toast.error('Please enter your mobile number for delivery')
      return
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }

    if (!isAgeConfirmed) {
      toast.error(
        'You must confirm that you are 18 years or older to create an account',
      )
      return
    }

    setIsLoading(true)
    try {
      const res = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
      })

      if (res.error) {
        toast.error(res.error.message || 'Failed to create account')
        setIsLoading(false)
        return
      }

      toast.success('Account created successfully! Welcome to Mezmani.')
      navigate({
        to: search.redirect || '/drinks',
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sign up failed')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f5ef] text-[#181818] flex flex-col font-sans">
      <Header />

      <main className="flex-1 flex items-center justify-center py-12 sm:py-16 px-4">
        <div className="w-full max-w-[460px]">
          {/* AUTH CARD */}
          <div className="rounded-[6px] border border-[#dedbd4] bg-white p-7 sm:p-10 shadow-[0_12px_32px_rgba(0,0,0,0.05)]">
            <div className="text-center mb-8">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#777] block mb-2">
                CREATE AN ACCOUNT
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-[-0.05em] text-[#181818] uppercase">
                Join Mezmani
              </h1>
              <p className="mt-2 text-xs text-[#777] leading-relaxed">
                Order genuine liquor, cold beers and late-night munchies with
                40-minute delivery.
              </p>
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
              {/* FULL NAME */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#181818] mb-1.5"
                >
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#888]">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Suman Shrestha"
                    className="w-full h-11 pl-10 pr-3.5 rounded-[3px] border border-[#dedbd4] bg-[#fdfdfc] text-xs text-[#181818] placeholder:text-[#999] focus:outline-none focus:border-[#171717] focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* PHONE NUMBER */}
              <div>
                <label
                  htmlFor="phone"
                  className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#181818] mb-1.5"
                >
                  Mobile Number (For Rider Dispatch)
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#888]">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98XXXXXXXX"
                    className="w-full h-11 pl-10 pr-3.5 rounded-[3px] border border-[#dedbd4] bg-[#fdfdfc] text-xs text-[#181818] placeholder:text-[#999] focus:outline-none focus:border-[#171717] focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* EMAIL ADDRESS */}
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

              {/* PASSWORD */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#181818] mb-1.5"
                >
                  Password (min 8 characters)
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#888]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
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

              {/* 18+ AGE CONFIRMATION CHECKBOX */}
              <div className="rounded-[4px] border border-[#dedbd4] bg-[#f7f4ee] p-3 mt-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAgeConfirmed}
                    onChange={(e) => setIsAgeConfirmed(e.target.checked)}
                    className="mt-0.5 accent-[#171717] rounded"
                  />
                  <span className="text-[11px] leading-relaxed text-[#555]">
                    I certify that I am{' '}
                    <strong className="text-[#181818]">18 years of age</strong>{' '}
                    or older in strict accordance with Nepal Liquor Regulations
                    and agree to drink responsibly.
                  </span>
                </label>
              </div>

              {/* SUBMIT BUTTON */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !isAgeConfirmed}
                  className="w-full h-12 bg-[#171717] text-white rounded-[3px] text-xs font-bold uppercase tracking-wider hover:bg-[#d8ff38] hover:text-[#111] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      CREATING ACCOUNT...
                    </span>
                  ) : (
                    <>
                      CREATE ACCOUNT
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* SWITCH TO SIGN IN */}
            <div className="mt-8 pt-6 border-t border-[#dedbd4] text-center">
              <p className="text-xs text-[#666]">
                Already have an account?{' '}
                <Link
                  to="/login"
                  search={{ redirect: search.redirect }}
                  className="font-bold text-[#181818] hover:underline"
                >
                  Sign in here →
                </Link>
              </p>
            </div>
          </div>

          {/* COMPLIANCE FOOTNOTE */}
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-[#777]">
            <AlertCircle className="h-3.5 w-3.5 text-[#888]" />
            <span>Government of Nepal Verified Liquor Delivery Partner</span>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
