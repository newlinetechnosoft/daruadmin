import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { CartProvider } from '#/lib/cart-context'
import { CartSheet } from '#/components/store/cart-sheet'
import { AgeGate } from '#/components/store/age-gate'
import { Toaster } from '#/components/ui/sonner'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
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
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen font-sans bg-white text-[#101010] antialiased selection:bg-[#d8ff00] selection:text-[#101010]">
        <CartProvider>
          {children}
          <CartSheet />
          <AgeGate />
          <Toaster position="bottom-right" richColors />
        </CartProvider>
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
