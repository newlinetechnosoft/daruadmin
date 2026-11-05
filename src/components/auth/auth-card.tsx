import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { authClient } from '#/lib/auth-client'
import { toast } from 'sonner'
import {
  User,
  Lock,
  Phone,
  Mail,
  ShieldCheck,
  Zap,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Check,
} from 'lucide-react'
import { normalizeNepaliPhone } from '#/server/orders/order.schemas'
import {
  resolveLoginIdentifierFn,
  sendPhoneOtpFn,
  prepareSignupFn,
} from '#/server/otp/otp.functions'
import { setPendingSignup } from '#/lib/pending-auth'

interface AuthCardProps {
  initialMode?: 'login' | 'signup'
  redirect?: string
}

export function AuthCard({ initialMode = 'login', redirect }: AuthCardProps) {
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)
  const [isAnimating, setIsAnimating] = useState(false)

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [isLoginLoading, setIsLoginLoading] = useState(false)

  // Signup form state
  const [signupGender, setSignupGender] = useState<'male' | 'female' | 'other'>(
    'male',
  )
  const [signupName, setSignupName] = useState('')
  const [signupPhone, setSignupPhone] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('')
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] =
    useState(false)
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false)
  const [isSignupLoading, setIsSignupLoading] = useState(false)

  // Real-time email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const isSignupEmailValid =
    signupEmail.trim().length > 0 ? emailRegex.test(signupEmail.trim()) : null

  // Password confirmation matching check
  const passwordsMatch =
    signupConfirmPassword.length > 0
      ? signupPassword === signupConfirmPassword
      : null

  // Login identifier email check
  const isLoginEmailCheck = loginIdentifier.includes('@')
    ? emailRegex.test(loginIdentifier.trim())
    : null

  // Smooth mode switch animation
  const handleModeSwitch = (newMode: 'login' | 'signup') => {
    if (newMode === mode || isAnimating) return
    setIsAnimating(true)
    setTimeout(() => {
      setMode(newMode)
      setIsAnimating(false)
      navigate({
        to: newMode === 'login' ? '/login' : '/signup',
        search: { redirect },
      })
    }, 220)
  }

  // Handle Login submission: STRICT - Do not allow login without verified phone number
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    const trimmedId = loginIdentifier.trim()
    if (!trimmedId || !loginPassword.trim()) {
      toast.error('Please enter both your mobile number / email and password')
      return
    }

    setIsLoginLoading(true)
    try {
      const resolution = await resolveLoginIdentifierFn({
        data: { identifier: trimmedId },
      })

      if (!resolution.found || !resolution.email) {
        toast.error(
          resolution.error ||
            'No account found with this mobile number or email. Please check your credentials.',
        )
        setIsLoginLoading(false)
        return
      }

      // STRICT: If phone is NOT verified, DO NOT ALLOW LOGIN!
      if (!resolution.phoneVerified) {
        const phoneToVerify = resolution.phone
        if (phoneToVerify) {
          try {
            await sendPhoneOtpFn({
              data: { phone: phoneToVerify },
            })
          } catch {}
          if (resolution.email) {
            setPendingSignup({
              name: '',
              email: resolution.email,
              password: loginPassword,
              phone: phoneToVerify,
              gender: 'male',
              image: '',
            })
          }
          toast.error(
            'Your mobile number is not verified yet. Please verify your phone to log in.',
          )
          navigate({
            to: '/verify-phone',
            search: {
              phone: phoneToVerify,
              redirect,
            },
          })
          setIsLoginLoading(false)
          return
        } else {
          toast.error(
            'Your account phone number is not verified. Please contact customer care via 9847820683.',
          )
          setIsLoginLoading(false)
          return
        }
      }

      const res = await authClient.signIn.email({
        email: resolution.email,
        password: loginPassword,
        rememberMe: true,
      })

      if (res.error) {
        toast.error(
          res.error.message || 'Invalid mobile number/email or password',
        )
        setIsLoginLoading(false)
        return
      }

      // Post-sign-in check safeguard
      const userRole = (res.data as any)?.user?.role || 'customer'
      const isPhoneVerified = Boolean(
        (res.data as any)?.user?.phoneVerified ?? resolution.phoneVerified,
      )

      if (userRole === 'customer' && !isPhoneVerified) {
        await authClient.signOut()
        queryClient.clear()
        await router.invalidate()
        const phoneToVerify = resolution.phone || (res.data as any)?.user?.phone
        if (phoneToVerify) {
          try {
            await sendPhoneOtpFn({
              data: { phone: phoneToVerify },
            })
          } catch {}
          toast.error(
            'Your mobile number is not verified yet. Please verify your phone to log in.',
          )
          navigate({
            to: '/verify-phone',
            search: {
              phone: phoneToVerify,
              redirect,
            },
          })
          setIsLoginLoading(false)
          return
        }
      }

      queryClient.clear()
      await router.invalidate()

      toast.success('Welcome back to Mezmani!')
      if (userRole === 'rider') {
        navigate({
          to: redirect?.startsWith('/rider') ? redirect : '/rider',
        })
        return
      }
      if (userRole === 'admin' || userRole === 'manager') {
        navigate({
          to: redirect?.startsWith('/admin') ? redirect : '/admin',
        })
        return
      }
      navigate({
        to: redirect || '/',
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sign in failed')
      setIsLoginLoading(false)
    }
  }

  // Handle Sign Up submission: creates user in DB with phoneVerified=false & emailVerified=false, then sends OTP
  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault()
    if (!signupName.trim() || signupName.trim().length < 2) {
      toast.error('Please enter your full name (at least 2 characters)')
      return
    }

    const normalizedPhone = normalizeNepaliPhone(signupPhone)
    if (!normalizedPhone) {
      toast.error(
        'Enter a valid 10-digit Nepali mobile number starting with 98 or 97',
      )
      return
    }

    if (
      signupEmail.trim() &&
      !z.string().email().safeParse(signupEmail.trim()).success
    ) {
      toast.error('Please enter a valid email address')
      return
    }

    if (!signupPassword || signupPassword.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }

    if (signupPassword !== signupConfirmPassword) {
      toast.error(
        'Passwords do not match. Please verify your confirm password.',
      )
      return
    }

    if (!isAgeConfirmed) {
      toast.error('You must confirm that you are 18 years of age or older')
      return
    }

    setIsSignupLoading(true)
    try {
      const emailToUse =
        signupEmail && signupEmail.trim().length > 0
          ? signupEmail.trim().toLowerCase()
          : `${normalizedPhone}@phone.mezmani.local`

      // 1. Validate & prepare signup: check phone/email duplicates or clear unverified stale attempts
      const prep = await prepareSignupFn({
        data: {
          phone: normalizedPhone,
          email: emailToUse,
        },
      })

      if (!prep.allowed) {
        toast.error(prep.message || 'Unable to sign up with these details')
        if (prep.code === 'ALREADY_REGISTERED') {
          handleModeSwitch('login')
        }
        setIsSignupLoading(false)
        return
      }

      // 2. Clear any lingering session before creating the account
      try {
        await authClient.signOut()
      } catch {}

      // 3. Create user in database user table immediately via Better-Auth
      // This inserts user with:
      // - id: unique user id
      // - name: signupName
      // - email: emailToUse
      // - phone: normalizedPhone
      // - emailVerified: false (default)
      // - phoneVerified: false (default)
      const res = await authClient.signUp.email({
        name: signupName.trim(),
        email: emailToUse,
        password: signupPassword,
        phone: normalizedPhone,
        image: `/images/gender/${signupGender}.png`,
      })

      if (res.error) {
        toast.error(res.error.message || 'Failed to create account')
        setIsSignupLoading(false)
        return
      }

      // 4. Save pending signup payload in sessionStorage as fallback
      setPendingSignup({
        name: signupName.trim(),
        email: emailToUse,
        password: signupPassword,
        phone: normalizedPhone,
        gender: signupGender,
        image: `/images/gender/${signupGender}.png`,
      })

      // 5. Send OTP code to verify mobile number
      await sendPhoneOtpFn({
        data: { phone: normalizedPhone },
      })

      toast.success(
        'Account created! A 6-digit verification code has been sent to your mobile number.',
      )
      navigate({
        to: '/verify-phone',
        search: {
          phone: normalizedPhone,
          redirect,
        },
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sign up failed')
      setIsSignupLoading(false)
    }
  }

  const handleForgotPassword = () => {
    const rawId = loginIdentifier.trim()
    const normalized = rawId ? normalizeNepaliPhone(rawId) : null
    const phoneToPass =
      normalized || (rawId && !rawId.includes('@') ? rawId : undefined)

    navigate({
      to: '/forgot-password',
      search: {
        phone: phoneToPass,
        redirect,
      },
    })
  }

  const isLogin = mode === 'login'

  return (
    <div className="w-full max-w-[960px] mx-auto relative z-10">
      {/* Decorative ambient background glows aligned to system theme */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-16 -left-16 w-80 h-80 rounded-full bg-primary/10 dark:bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full bg-primary/10 dark:bg-primary/5 blur-3xl" />
      </div>

      {/* Main Auth Card Container */}
      <div className="relative w-full rounded-3xl bg-card text-card-foreground shadow-xl border border-border overflow-hidden flex flex-col md:flex-row transition-all duration-300">
        {/* ==================== LEFT PANEL (Mezmani Midnight Brand Panel) ==================== */}
        <div className="relative w-full md:w-[56%] bg-sidebar text-sidebar-foreground p-6 sm:p-9 md:p-11 flex flex-col justify-center overflow-hidden z-10 transition-colors duration-300">
          {/* Decorative Organic Shapes matching UI theme */}
          {/* Top-Right Midnight Accent Shape */}
          <div className="w-52 h-52 rounded-full bg-sidebar-accent/50 absolute -top-16 -right-12 pointer-events-none" />

          {/* Bottom-Right Midnight Accent Shape */}
          <div className="w-64 h-64 rounded-full bg-sidebar-accent/30 absolute -bottom-24 -right-16 pointer-events-none" />

          {/* Bottom-Left Luminous Amber Glow */}
          <div className="w-56 h-56 rounded-full bg-primary/10 blur-2xl absolute -bottom-16 -left-16 pointer-events-none" />

          {/* Organic Wave Divider on Desktop Edge */}
          <svg
            className="absolute -right-16 lg:-right-20 top-0 h-full w-16 lg:w-20 pointer-events-none hidden md:block text-sidebar fill-current z-10 transition-colors duration-300"
            viewBox="0 0 100 600"
            preserveAspectRatio="none"
          >
            <path d="M0,0 L0,600 Q95,450 35,300 Q105,150 0,0 Z" />
          </svg>

          {/* Form Content with Smooth Fade/Scale Shift Animation */}
          <div
            className={`relative z-20 w-full max-w-[370px] mx-auto transition-all duration-300 ease-out ${
              isAnimating
                ? 'opacity-0 scale-[0.97] translate-y-1.5'
                : 'opacity-100 scale-100 translate-y-0'
            }`}
          >
            {isLogin ? (
              /* ==================== LOGIN FORM ==================== */
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="text-center mb-6">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Welcome Back
                  </h1>
                  <p className="text-xs sm:text-sm text-sidebar-foreground/75 mt-1.5 font-normal leading-relaxed">
                    Sign in to access your orders, cart, and express delivery
                  </p>
                </div>

                {/* User Name / Mobile or Email Field */}
                <div className="relative flex items-center bg-card text-card-foreground rounded-xl px-4 py-3 sm:py-3.5 border border-border shadow-xs focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
                  <User className="h-5 w-5 text-muted-foreground shrink-0 mr-3" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Mobile number or email"
                    className="bg-transparent border-0 outline-none w-full flex-1 min-w-0 text-[16px] text-card-foreground placeholder:text-muted-foreground font-medium"
                  />
                  {/* Email validation icon if user types an email */}
                  {isLoginEmailCheck !== null && (
                    <div
                      className="ml-2 shrink-0"
                      title={
                        isLoginEmailCheck
                          ? 'Valid email address'
                          : 'Invalid email format'
                      }
                    >
                      {isLoginEmailCheck ? (
                        <CheckCircle2 className="h-5 w-5 text-success animate-in fade-in zoom-in-75 duration-200" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive animate-in fade-in zoom-in-75 duration-200" />
                      )}
                    </div>
                  )}
                </div>

                {/* Password Field with Eye Icon Toggle */}
                <div className="relative flex items-center bg-card text-card-foreground rounded-xl px-4 py-3 sm:py-3.5 border border-border shadow-xs focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
                  <Lock className="h-5 w-5 text-muted-foreground shrink-0 mr-3" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Password"
                    className="bg-transparent border-0 outline-none w-full flex-1 min-w-0 text-[16px] text-card-foreground placeholder:text-muted-foreground font-medium pr-2"
                  />
                  {/* Eye Toggle Icon */}
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="p-1.5 text-muted-foreground hover:text-card-foreground transition-colors shrink-0 cursor-pointer rounded-md hover:bg-muted"
                    aria-label={
                      showLoginPassword ? 'Hide password' : 'Show password'
                    }
                    title={
                      showLoginPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showLoginPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {/* Primary Button matching Mezmani Primary Theme */}
                <button
                  type="submit"
                  disabled={isLoginLoading}
                  className="w-full mt-2 py-3.5 sm:py-4 rounded-xl bg-primary hover:bg-primary/90 active:scale-[0.99] text-primary-foreground font-bold text-[16px] shadow-md shadow-primary/25 transition-all flex items-center justify-center cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoginLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    'Login'
                  )}
                </button>

                {/* Forgot Password Link */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs sm:text-sm text-sidebar-foreground/75 hover:text-sidebar-foreground hover:underline cursor-pointer transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
              </form>
            ) : (
              /* ==================== SIGNUP FORM ==================== */
              <form onSubmit={handleSignUp} className="space-y-3.5">
                <div className="text-center mb-3">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Create Account
                  </h1>
                  <p className="text-xs sm:text-sm text-sidebar-foreground/75 mt-1 font-normal leading-relaxed">
                    Join Mezmani for genuine liquor and 30-min express delivery
                  </p>
                </div>

                {/* 1. SELECT GENDER */}
                <div className="space-y-1.5 pb-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-sidebar-foreground px-1">
                    <span>Select Gender</span>
                    <span className="text-[11px] text-primary capitalize font-semibold">
                      Selected: {signupGender}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Male PNG Option */}
                    <button
                      type="button"
                      onClick={() => setSignupGender('male')}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
                        signupGender === 'male'
                          ? 'bg-card text-card-foreground shadow-md ring-2 ring-primary scale-[1.02]'
                          : 'bg-card/75 hover:bg-card text-card-foreground/75 hover:text-card-foreground border border-border/50 hover:scale-[1.01]'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-muted mb-1 border border-border/60 shadow-inner">
                        <img
                          src="/images/gender/male.png"
                          alt="Male"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-[12px] font-bold">Male</span>
                      {signupGender === 'male' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </button>

                    {/* Female PNG Option */}
                    <button
                      type="button"
                      onClick={() => setSignupGender('female')}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
                        signupGender === 'female'
                          ? 'bg-card text-card-foreground shadow-md ring-2 ring-primary scale-[1.02]'
                          : 'bg-card/75 hover:bg-card text-card-foreground/75 hover:text-card-foreground border border-border/50 hover:scale-[1.01]'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-muted mb-1 border border-border/60 shadow-inner">
                        <img
                          src="/images/gender/female.png"
                          alt="Female"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-[12px] font-bold">Female</span>
                      {signupGender === 'female' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </button>

                    {/* Other PNG Option */}
                    <button
                      type="button"
                      onClick={() => setSignupGender('other')}
                      className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
                        signupGender === 'other'
                          ? 'bg-card text-card-foreground shadow-md ring-2 ring-primary scale-[1.02]'
                          : 'bg-card/75 hover:bg-card text-card-foreground/75 hover:text-card-foreground border border-border/50 hover:scale-[1.01]'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-muted mb-1 border border-border/60 shadow-inner">
                        <img
                          src="/images/gender/other.png"
                          alt="Other"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-[12px] font-bold">Other</span>
                      {signupGender === 'other' && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                {/* 2. Full Name */}
                <div className="relative flex items-center bg-card text-card-foreground rounded-xl px-4 py-2.5 sm:py-3 border border-border shadow-xs focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
                  <User className="h-5 w-5 text-muted-foreground shrink-0 mr-3" />
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="Full Name"
                    className="bg-transparent border-0 outline-none w-full flex-1 min-w-0 text-[16px] text-card-foreground placeholder:text-muted-foreground font-medium"
                  />
                </div>

                {/* 3. Mobile Number */}
                <div className="relative flex items-center bg-card text-card-foreground rounded-xl px-4 py-2.5 sm:py-3 border border-border shadow-xs focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
                  <Phone className="h-5 w-5 text-muted-foreground shrink-0 mr-3" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    autoComplete="tel"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    placeholder="Mobile (98XXXXXXXX)"
                    className="bg-transparent border-0 outline-none w-full flex-1 min-w-0 text-[16px] text-card-foreground placeholder:text-muted-foreground font-medium font-mono"
                  />
                </div>

                {/* 4. Email Address with Live Validation */}
                <div className="relative flex items-center bg-card text-card-foreground rounded-xl px-4 py-2.5 sm:py-3 border border-border shadow-xs focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
                  <Mail className="h-5 w-5 text-muted-foreground shrink-0 mr-3" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="Email Address"
                    className="bg-transparent border-0 outline-none w-full flex-1 min-w-0 text-[16px] text-card-foreground placeholder:text-muted-foreground font-medium"
                  />
                  {/* Validation Indicator: Green Tick or Red Cross */}
                  {isSignupEmailValid !== null && (
                    <div
                      className="ml-2 shrink-0"
                      title={
                        isSignupEmailValid
                          ? 'Valid email address'
                          : 'Invalid email format'
                      }
                    >
                      {isSignupEmailValid ? (
                        <CheckCircle2 className="h-5 w-5 text-success animate-in fade-in zoom-in-75 duration-200" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive animate-in fade-in zoom-in-75 duration-200" />
                      )}
                    </div>
                  )}
                </div>

                {/* 5. Password with Eye Icon Toggle */}
                <div className="relative flex items-center bg-card text-card-foreground rounded-xl px-4 py-2.5 sm:py-3 border border-border shadow-xs focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
                  <Lock className="h-5 w-5 text-muted-foreground shrink-0 mr-3" />
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Password (min 8 chars)"
                    className="bg-transparent border-0 outline-none w-full flex-1 min-w-0 text-[16px] text-card-foreground placeholder:text-muted-foreground font-medium pr-2"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="p-1.5 text-muted-foreground hover:text-card-foreground transition-colors shrink-0 cursor-pointer rounded-md hover:bg-muted"
                    aria-label={
                      showSignupPassword ? 'Hide password' : 'Show password'
                    }
                    title={
                      showSignupPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showSignupPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {/* 6. CONFIRM PASSWORD with Eye Icon Toggle and Match Validation */}
                <div className="relative flex items-center bg-card text-card-foreground rounded-xl px-4 py-2.5 sm:py-3 border border-border shadow-xs focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
                  <Lock className="h-5 w-5 text-muted-foreground shrink-0 mr-3" />
                  <input
                    type={showSignupConfirmPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder="Confirm Password"
                    className="bg-transparent border-0 outline-none w-full flex-1 min-w-0 text-[16px] text-card-foreground placeholder:text-muted-foreground font-medium pr-2"
                  />
                  {/* Match Indicator */}
                  {passwordsMatch !== null && (
                    <div
                      className="mr-1 shrink-0"
                      title={
                        passwordsMatch
                          ? 'Passwords match'
                          : 'Passwords do not match'
                      }
                    >
                      {passwordsMatch ? (
                        <CheckCircle2 className="h-5 w-5 text-success animate-in fade-in zoom-in-75 duration-200" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive animate-in fade-in zoom-in-75 duration-200" />
                      )}
                    </div>
                  )}
                  {/* Eye Toggle Icon */}
                  <button
                    type="button"
                    onClick={() =>
                      setShowSignupConfirmPassword(!showSignupConfirmPassword)
                    }
                    className="p-1.5 text-muted-foreground hover:text-card-foreground transition-colors shrink-0 cursor-pointer rounded-md hover:bg-muted"
                    aria-label={
                      showSignupConfirmPassword
                        ? 'Hide confirm password'
                        : 'Show confirm password'
                    }
                    title={
                      showSignupConfirmPassword
                        ? 'Hide confirm password'
                        : 'Show confirm password'
                    }
                  >
                    {showSignupConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {/* 7. HIGHLY VISIBLE 18+ LEGAL AGE CERTIFICATION CHECKBOX */}
                <div
                  onClick={() => setIsAgeConfirmed(!isAgeConfirmed)}
                  className={`rounded-xl p-3 sm:p-3.5 border transition-all cursor-pointer flex items-start gap-3 select-none ${
                    isAgeConfirmed
                      ? 'bg-primary/15 border-primary/50 shadow-xs'
                      : 'bg-card/30 hover:bg-card/50 border-border/60'
                  }`}
                >
                  {/* Distinct Checkbox */}
                  <div
                    className={`mt-0.5 h-5 w-5 rounded-md shrink-0 flex items-center justify-center transition-all ${
                      isAgeConfirmed
                        ? 'bg-primary border border-primary text-primary-foreground scale-105'
                        : 'bg-card border border-border shadow-xs'
                    }`}
                  >
                    {isAgeConfirmed && (
                      <Check className="h-3.5 w-3.5 stroke-[3] text-primary-foreground" />
                    )}
                  </div>

                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] sm:text-sm font-bold text-white leading-tight">
                        I certify that I am 18 years of age or older
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-bold text-[10px] tracking-wider uppercase">
                        18+
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-sidebar-foreground/75 mt-0.5 leading-snug">
                      Mandatory in accordance with Nepal Liquor Regulations.
                    </p>
                  </div>
                </div>

                {/* 8. Verify & Create Account Button */}
                <button
                  type="submit"
                  disabled={isSignupLoading}
                  className="w-full mt-2 py-3.5 sm:py-4 rounded-xl bg-primary hover:bg-primary/90 active:scale-[0.99] text-primary-foreground font-bold text-[16px] shadow-md shadow-primary/25 transition-all flex items-center justify-center cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSignupLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                      Verifying details...
                    </span>
                  ) : (
                    'Verify & Create Account'
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Smooth Mobile Bottom Wave Divider */}
          <svg
            className="w-full h-6 text-card fill-current block md:hidden absolute bottom-0 left-0 -mb-[1px] pointer-events-none transition-colors duration-300"
            viewBox="0 0 400 30"
            preserveAspectRatio="none"
          >
            <path d="M0,0 C150,30 250,30 400,0 L400,30 L0,30 Z" />
          </svg>
        </div>

        {/* ==================== RIGHT PANEL (Clean Card Surface with Amber Gold Accent) ==================== */}
        <div className="relative w-full md:w-[44%] bg-card text-card-foreground flex flex-col items-center justify-center px-6 sm:px-10 py-10 sm:py-14 text-center overflow-hidden transition-colors duration-300">
          {/* Decorative Warm Ambient Circle */}
          <div className="w-44 sm:w-52 h-44 sm:h-52 rounded-full bg-primary/10 absolute -bottom-16 -right-16 pointer-events-none blur-xl transition-colors duration-300" />

          {/* Content Container with Smooth Transition */}
          <div
            className={`relative z-10 max-w-[300px] sm:max-w-xs flex flex-col items-center transition-all duration-300 ease-out ${
              isAnimating
                ? 'opacity-0 scale-[0.97] translate-y-1.5'
                : 'opacity-100 scale-100 translate-y-0'
            }`}
          >
            {isLogin ? (
              <>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  New Here?
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-3 mb-8 leading-relaxed font-normal">
                   Get exclusive access to beverages items <b>
                    (MRP)</b> , drinks and 
                   foods. 30-40 minutes express delivery.
                </p>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('signup')}
                  className="border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-bold text-[15px] sm:text-[16px] px-10 sm:px-12 py-3 sm:py-3.5 rounded-xl shadow-xs transition-all min-w-[170px] cursor-pointer active:scale-[0.99]"
                >
                  Sign Up
                </button>
              </>
            ) : (
              <>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  One of Us?
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-3 mb-8 leading-relaxed font-normal">
                  If you already have an account, just sign in to access your
                  orders, saved addresses, and express delivery.
                </p>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('login')}
                  className="border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-bold text-[15px] sm:text-[16px] px-10 sm:px-12 py-3 sm:py-3.5 rounded-xl shadow-xs transition-all min-w-[170px] cursor-pointer active:scale-[0.99]"
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Compliance & Trust Badges aligned to theme */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-6">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-success" />
          <span>18+ Verified Platform</span>
        </div>
        <span>•</span>
        <div className="flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-warning" />
          <span>30-Minute Valley Delivery</span>
        </div>
      </div>
    </div>
  )
}
