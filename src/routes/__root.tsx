import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  isRedirect,
  redirect,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import { ThemeProvider } from 'next-themes'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { CartProvider } from '#/lib/cart-context'
import { CartSheet } from '#/components/store/cart-sheet'
import { AgeGate } from '#/components/store/age-gate'
import { Toaster } from '#/components/ui/sonner'
import { adminQueries } from '#/queries/admin'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ location, context }) => {
    if (
      location.pathname.startsWith('/rider') ||
      location.pathname.startsWith('/admin') ||
      location.pathname.startsWith('/api')
    ) {
      return
    }

    try {
      const access = await context.queryClient.ensureQueryData(
        adminQueries.access(),
      )
      if (access?.authenticated && access.user?.role === 'rider') {
        throw redirect({ to: '/rider' })
      }
      if (
        access?.authenticated &&
        access.user?.role === 'customer' &&
        !access.user?.phoneVerified &&
        location.pathname !== '/verify-phone' &&
        location.pathname !== '/login' &&
        location.pathname !== '/signup'
      ) {
        throw redirect({
          to: '/verify-phone',
          search: {
            phone: access.user.phone || '',
            redirect: location.pathname,
          },
        })
      }
    } catch (err) {
      if (isRedirect(err)) throw err
    }
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: "Mezmani | Nepal's Fastest Late-Night Liquor & Food Delivery",
      },
      {
        name: 'description',
        content:
          'Mezmani offers the fastest late-night drinks, beer, snacks, and ice delivery across Butwal within 45 minutes.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen font-sans bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <CartProvider>
            {children}
            <CartSheet />
            <AgeGate />
            <Toaster position="bottom-right" richColors />
          </CartProvider>
        </ThemeProvider>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
