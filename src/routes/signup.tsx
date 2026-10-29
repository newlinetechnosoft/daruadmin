import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { authClient } from '#/lib/auth-client'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Checkbox } from '#/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '#/components/ui/form'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import {
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  LogIn,
} from 'lucide-react'
import { normalizeNepaliPhone } from '#/server/orders/order.schemas'
import {
  checkPhoneRegisteredFn,
  sendPhoneOtpFn,
} from '#/server/otp/otp.functions'

const signupSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/signup')({
  validateSearch: (search) => signupSearchSchema.parse(search),
  component: SignUpPage,
})

const signupFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Please enter your full name')
    .min(2, 'Name must be at least 2 characters'),
  phone: z
    .string()
    .trim()
    .min(1, 'Please enter your mobile number')
    .refine((val) => {
      const normalized = normalizeNepaliPhone(val)
      return normalized !== null
    }, 'Enter a valid 10-digit Nepali mobile number starting with 98 or 97'),
  email: z
    .string()
    .trim()
    .optional()
    .refine((val) => {
      if (!val || val === '') return true
      return z.string().email().safeParse(val).success
    }, 'Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  isAgeConfirmed: z
    .boolean()
    .refine(
      (val) => val === true,
      'You must confirm that you are 18 years of age or older',
    ),
})

type SignupFormValues = z.infer<typeof signupFormSchema>

function SignUpPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [phoneRegisteredError, setPhoneRegisteredError] = useState<
    string | null
  >(null)

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      password: '',
      isAgeConfirmed: false,
    },
  })

  const onSubmit = async (values: SignupFormValues) => {
    setPhoneRegisteredError(null)

    const normalizedPhone = normalizeNepaliPhone(values.phone)
    if (!normalizedPhone) {
      form.setError('phone', {
        message: 'Invalid Nepali mobile number format',
      })
      return
    }

    setIsLoading(true)

    try {
      // 1. Check if the mobile number is already registered
      const phoneCheck = await checkPhoneRegisteredFn({
        data: { phone: normalizedPhone },
      })

      if (phoneCheck.exists) {
        setPhoneRegisteredError(normalizedPhone)
        toast.error('This mobile number is already registered')
        setIsLoading(false)
        return
      }

      // 2. Determine email to register with Better-Auth:
      // If user provided an email, use it.
      // If blank, generate deterministic placeholder email: <normalizedPhone>@phone.mezmani.local
      const emailToUse =
        values.email && values.email.trim().length > 0
          ? values.email.trim().toLowerCase()
          : `${normalizedPhone}@phone.mezmani.local`

      // 3. Register user with better-auth
      const res = await authClient.signUp.email({
        name: values.name.trim(),
        email: emailToUse,
        password: values.password,
        phone: normalizedPhone,
      })

      if (res.error) {
        const errorMsg = res.error.message || 'Failed to create account'
        if (
          errorMsg.toLowerCase().includes('email already') ||
          errorMsg.toLowerCase().includes('already exist')
        ) {
          if (values.email && values.email.trim().length > 0) {
            form.setError('email', {
              message:
                'This email address is already in use by another account.',
            })
            toast.error('This email address is already registered.')
          } else {
            setPhoneRegisteredError(normalizedPhone)
            toast.error('An account already exists for this mobile number.')
          }
        } else {
          toast.error(errorMsg)
        }
        setIsLoading(false)
        return
      }

      // 4. Trigger OTP dispatch to the normalized mobile number
      try {
        await sendPhoneOtpFn({
          data: { phone: normalizedPhone },
        })
      } catch (otpErr) {
        console.warn('Initial OTP send warning:', otpErr)
      }

      toast.success('Account created! Please verify your mobile number.')

      // 5. Navigate to phone verification route, preserving the redirect target
      navigate({
        to: '/verify-phone',
        search: {
          phone: normalizedPhone,
          redirect: search.redirect,
        },
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sign up failed')
      setIsLoading(false)
    }
  }

  return (
    <div className="storefront min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Header />

      <main className="flex-1 flex items-center justify-center py-12 sm:py-16 px-4">
        <div className="w-full max-w-sm space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="text-center space-y-1.5 pb-6">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Create an account
              </span>
              <CardTitle className="text-2xl font-bold tracking-tight">
                Join Mezmani
              </CardTitle>
              <CardDescription className="text-xs">
                Order genuine liquor, cold beers, and groceries with 30-minute
                express delivery.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {/* Friendly alert if phone is already registered */}
              {phoneRegisteredError && (
                <Alert className="mb-4 border-amber-500/40 bg-amber-500/10 text-xs py-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                    Mobile number already registered
                  </AlertTitle>
                  <AlertDescription className="text-[11px] text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                    An account already exists for{' '}
                    <span className="font-mono font-semibold">
                      {phoneRegisteredError}
                    </span>
                    .{' '}
                    <Link
                      to="/login"
                      search={{ redirect: search.redirect }}
                      className="font-semibold underline inline-flex items-center gap-1 hover:text-amber-950 dark:hover:text-amber-100"
                    >
                      Sign in here
                      <LogIn className="h-3 w-3 inline" />
                    </Link>
                  </AlertDescription>
                </Alert>
              )}

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  {/* 1. Full Name Field */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs">Full name</FormLabel>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <FormControl>
                            <Input
                              type="text"
                              autoComplete="name"
                              placeholder="Suman Shrestha"
                              className="pl-9 text-xs"
                              disabled={isLoading}
                              {...field}
                            />
                          </FormControl>
                        </div>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />

                  {/* 2. Mobile Number Field (Required, Primary Identifier, placed right after Name) */}
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs">
                          Mobile number (required)
                        </FormLabel>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <FormControl>
                            <Input
                              type="tel"
                              inputMode="numeric"
                              autoComplete="tel"
                              placeholder="98XXXXXXXX"
                              className="pl-9 text-xs font-mono"
                              disabled={isLoading}
                              {...field}
                              onChange={(e) => {
                                field.onChange(e)
                                if (phoneRegisteredError) {
                                  setPhoneRegisteredError(null)
                                }
                              }}
                            />
                          </FormControl>
                        </div>
                        <FormDescription className="text-[11px] text-muted-foreground">
                          We&apos;ll send a 6-digit code to verify your number.
                        </FormDescription>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />

                  {/* 3. Email Address Field (Optional) */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs">
                          Email address (optional)
                        </FormLabel>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <FormControl>
                            <Input
                              type="email"
                              autoComplete="email"
                              placeholder="name@example.com"
                              className="pl-9 text-xs"
                              disabled={isLoading}
                              {...field}
                            />
                          </FormControl>
                        </div>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />

                  {/* 4. Password Field (min 8 characters) */}
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className="text-xs">
                          Password (min 8 characters)
                        </FormLabel>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <FormControl>
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              placeholder="••••••••"
                              className="pl-9 pr-9 text-xs"
                              disabled={isLoading}
                              {...field}
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                            aria-label={
                              showPassword ? 'Hide password' : 'Show password'
                            }
                          >
                            {showPassword ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />

                  {/* 5. 18+ Age Confirmation Checkbox */}
                  <FormField
                    control={form.control}
                    name="isAgeConfirmed"
                    render={({ field }) => (
                      <FormItem className="space-y-1 mt-1">
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="flex items-start gap-2.5">
                            <FormControl>
                              <Checkbox
                                id="age-confirm"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={isLoading}
                                className="mt-0.5"
                              />
                            </FormControl>
                            <label
                              htmlFor="age-confirm"
                              className="text-[11px] leading-relaxed text-muted-foreground font-normal cursor-pointer"
                            >
                              I certify that I am{' '}
                              <strong className="text-foreground">
                                18 years of age
                              </strong>{' '}
                              or older in accordance with Nepal Liquor
                              Regulations.
                            </label>
                          </div>
                        </div>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />

                  {/* Submit Button */}
                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-10 text-xs font-medium gap-2"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                          Creating account...
                        </span>
                      ) : (
                        <>
                          Create account
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>

              {/* Switch to Sign In */}
              <div className="mt-6 pt-4 border-t border-border text-center">
                <p className="text-xs text-muted-foreground">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    search={{ redirect: search.redirect }}
                    className="font-medium text-foreground hover:underline"
                  >
                    Sign in here
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Compliance Footnote */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Government of Nepal Verified Liquor Delivery Partner</span>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
