import { useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { authClient } from '#/lib/auth-client'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Checkbox } from '#/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import {
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
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
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
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
                Order genuine liquor, cold beers, and groceries with 40-minute express delivery.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSignUp} className="space-y-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs">
                    Full name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Suman Shrestha"
                      className="pl-9 text-xs"
                    />
                  </div>
                </div>

                {/* Mobile Number */}
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs">
                    Mobile number (for delivery)
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="98XXXXXXXX"
                      className="pl-9 text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="pl-9 text-xs"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs">
                    Password (min 8 characters)
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-9 pr-9 text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* 18+ Age Confirmation Checkbox */}
                <div className="rounded-lg border border-border bg-muted/20 p-3 mt-1">
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="age-confirm"
                      checked={isAgeConfirmed}
                      onCheckedChange={(checked) => setIsAgeConfirmed(Boolean(checked))}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="age-confirm"
                      className="text-[11px] leading-relaxed text-muted-foreground font-normal cursor-pointer"
                    >
                      I certify that I am <strong className="text-foreground">18 years of age</strong> or older in accordance with Nepal Liquor Regulations.
                    </Label>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isLoading || !isAgeConfirmed}
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
