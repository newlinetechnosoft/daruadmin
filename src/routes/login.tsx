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
import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, Zap } from 'lucide-react'

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
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Header />

      <main className="flex-1 flex items-center justify-center py-12 sm:py-16 px-4">
        <div className="w-full max-w-sm space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="text-center space-y-1.5 pb-6">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Welcome back
              </span>
              <CardTitle className="text-2xl font-bold tracking-tight">
                Sign in
              </CardTitle>
              <CardDescription className="text-xs">
                Access your orders, saved addresses, and 40-minute express delivery.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email Field */}
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

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs">
                      Password
                    </Label>
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        toast.info(
                          'Password reset: please contact customer care via 9802088800',
                        )
                      }}
                    >
                      Forgot password?
                    </Button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
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

                {/* Remember Me */}
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                  />
                  <Label htmlFor="remember" className="text-xs font-normal text-muted-foreground cursor-pointer">
                    Remember this device
                  </Label>
                </div>

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
                        Signing in...
                      </span>
                    ) : (
                      <>
                        Sign in
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {/* Switch to Sign Up */}
              <div className="mt-6 pt-4 border-t border-border text-center">
                <p className="text-xs text-muted-foreground">
                  Don&apos;t have an account yet?{' '}
                  <Link
                    to="/signup"
                    search={{ redirect: search.redirect }}
                    className="font-medium text-foreground hover:underline"
                  >
                    Create an account
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Compliance & Trust Strip */}
          <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>18+ Verified Platform</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>40-Minute Valley Delivery</span>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
