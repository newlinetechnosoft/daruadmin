import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Header } from '#/components/store/header'
import { Footer } from '#/components/store/footer'
import { ForgotPasswordCard } from '#/components/auth/forgot-password-card'

const forgotPasswordSearchSchema = z.object({
  phone: z.string().optional(),
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/forgot-password')({
  validateSearch: (search) => forgotPasswordSearchSchema.parse(search),
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const search = Route.useSearch()

  return (
    <div className="storefront min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-300 w-full overflow-x-hidden">
      <Header />

      <main className="flex-1 flex items-center justify-center py-8 sm:py-12 md:py-16 px-4 w-full overflow-x-hidden">
        <ForgotPasswordCard
          initialPhone={search.phone}
          redirect={search.redirect}
        />
      </main>

      <Footer />
    </div>
  )
}
