import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { AuthCard } from '#/components/auth/auth-card'

const signupSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/signup')({
  validateSearch: (search) => signupSearchSchema.parse(search),
  component: SignUpPage,
})

function SignUpPage() {
  const search = Route.useSearch()

  return (
    <div className="storefront min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-300">
      <Header />

      <main className="flex-1 flex items-center justify-center py-8 sm:py-12 md:py-16 px-4">
        <AuthCard initialMode="signup" redirect={search.redirect} />
      </main>

      <Footer />
    </div>
  )
}
