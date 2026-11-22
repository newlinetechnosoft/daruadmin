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
import { StoreClosedPopup } from '#/components/store/store-closed-popup'
import { MobileBottomNav } from '#/components/store/mobile-bottom-nav'
import { Toaster } from '#/components/ui/sonner'
import { adminQueries } from '#/queries/admin'
import { storefrontQueries } from '#/queries/storefront'

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
  loader: async ({ context }) => {
    const settings = await context.queryClient
      .ensureQueryData(storefrontQueries.publicSettings())
      .catch(() => null)
    return { settings }
  },
  head: ({ loaderData }) => {
    const storeName = loaderData?.settings?.storeName || 'Mezmani'
    const tagline =
      loaderData?.settings?.tagline ||
      "Nepal's Fastest Late-Night Liquor & Food Delivery"
    return {
      meta: [
        {
          charSet: 'utf-8',
        },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
        },
        {
          title: `${storeName} | ${tagline}`,
        },
        {
          name: 'description',
          content: `${storeName} offers fast drinks, beer, snacks, and grocery delivery across ${loaderData?.settings?.city || 'Butwal'} & Tilottama.`,
        },
      ],
      links: [
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '32x32',
          href: '/favicon-32x32.png',
        },
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '16x16',
          href: '/favicon-16x16.png',
        },
        {
          rel: 'icon',
          type: 'image/png',
          href: '/favicon.png',
        },
        {
          rel: 'shortcut icon',
          href: '/favicon.ico',
        },
        {
          rel: 'apple-touch-icon',
          sizes: '180x180',
          href: '/apple-touch-icon.png',
        },
        {
          rel: 'preconnect',
          href: 'https://images.unsplash.com',
        },
        {
          rel: 'dns-prefetch',
          href: 'https://images.unsplash.com',
        },
        {
          rel: 'stylesheet',
          href: appCss,
        },
      ],
    }
  },
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
            <StoreClosedPopup />
            <MobileBottomNav />
            <Toaster position="bottom-right" richColors visibleToasts={1} />
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
