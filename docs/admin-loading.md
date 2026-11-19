# Admin Loading & Performance Architecture

This document describes the component-scoped loading architecture, skeleton loading patterns, and code-splitting rules for the Mezmani admin panel (`/admin` and `/superadmin`).

---

## 1. Core Principles

1. **The App Shell Never Unmounts After First Load:**
   - Navigating between admin views (`/admin/accounts`, `/admin/orders`, `/admin/riders`, etc.) or switching tabs inside panels must **never** replace the sidebar, navbar, or page shell with a layout skeleton.
   - `AdminLayoutSkeleton` is strictly reserved for the root layout route's initial cold boot before auth credentials and chrome state resolve.
   - `<Outlet />` inside the admin and superadmin layouts is permanently wrapped in `<AsyncBoundary fallback={<AdminContentSkeleton />}>`.
   - Every individual admin route configures a content-only `pendingComponent` matching its primary layout (e.g., `variant="table"`, `variant="stats-table"`, `variant="form"`, or `variant="report"`).
   - Global router transition delays (`defaultPendingMs: 150`, `defaultPendingMinMs: 300` in `src/router.tsx`) ensure instant navigations never flicker a skeleton, and slow navigations display smoothly.

2. **Component-Scoped Boundaries:**
   - Every `useSuspenseQuery` must sit underneath an `<AsyncBoundary>` placed as close to the suspending component as possible.
   - Subscribing queries must not bubble up to layout boundaries.

3. **Skeletons Only for First Load (Empty Data):**
   - Skeletons render strictly during the initial data fetch when no cached data exists.
   - Filtering, pagination, sorting, search parameter updates, and background refetches must retain previous data on screen (`placeholderData: keepPreviousData`) and present progress solely via the non-blocking top bar in `<DataSection>`.
   - Never dim (`opacity-80`) or animate entire sections during background queries.

4. **Zero Layout Shift:**
   - Skeleton fallbacks must closely approximate the shape, padding, and height of the resolved component.
   - Skeleton row counts are capped (max 6 rows) and pulse animations respect `prefers-reduced-motion`.

---

## 2. Adding a New Admin Route

When creating a new route file under `src/routes/admin/`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { guardModule } from '#/server/auth/guards'
import { FeaturePanel } from '#/components/panels/feature'
import { adminQueries } from '#/queries/admin'
import { AdminContentSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/admin/feature')({
  beforeLoad: guardModule('feature'),
  loader: async ({ context }) => {
    // Only prefetch what the initial paint strictly requires
    return context.queryClient.ensureQueryData(adminQueries.featurePrimary())
  },
  // Always supply a content-only pending skeleton matching the content layout
  pendingComponent: () => <AdminContentSkeleton variant="table" />,
  component: FeaturePanel,
})
```

---

## 3. Implementing Tabbed Panels with Lazy Loading

Heavy panels with multiple tabs (such as Accounts, Superadmin, and Marketing) must lazy-load tab components so that inactive tabs are not bundled into the main panel chunk.

### Pattern:
```tsx
import * as React from 'react'
import { AsyncBoundary } from '#/components/shared/async-boundary'
import { TabSkeleton } from '#/components/shared/loading'

// 1. Lazy load tab modules
const OverviewTab = React.lazy(() =>
  import('./tabs/overview-tab').then((m) => ({ default: m.OverviewTab })),
)
const LedgerTab = React.lazy(() =>
  import('./tabs/ledger-tab').then((m) => ({ default: m.LedgerTab })),
)

// 2. Wrap active tab in AsyncBoundary keyed on activeTab
export function FeaturePanel() {
  const [activeTab, setActiveTab] = React.useState('overview')

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger
            value="overview"
            onPointerEnter={() => prefetchTab('overview')}
            onFocus={() => prefetchTab('overview')}
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="ledger"
            onPointerEnter={() => prefetchTab('ledger')}
            onFocus={() => prefetchTab('ledger')}
          >
            Ledger
          </TabsTrigger>
        </TabsList>

        <AsyncBoundary key={activeTab} fallback={<TabSkeleton variant="stats-table" />}>
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'ledger' && <LedgerTab />}
        </AsyncBoundary>
      </Tabs>
    </div>
  )
}
```

### Critical Router Rule for Tabs:
Do **not** place `search.tab` into `loaderDeps` on the route definition if it causes the route loader to re-run and swap the entire route pendingComponent. Instead, handle tab selection at the panel component level and trigger prefetching on `TabsTrigger` (`onPointerEnter` / `onFocus`).

---

## 4. Intent-Driven Query and Module Prefetching

Prefetch both code chunks and API queries when the user hovers over or focuses a tab trigger:

```tsx
const TAB_PREFETCH: Record<string, (queryClient: QueryClient) => void> = {
  overview: (qc) => {
    import('./tabs/overview-tab')
    void qc.prefetchQuery(adminQueries.overview())
  },
  ledger: (qc) => {
    import('./tabs/ledger-tab')
    void qc.prefetchQuery(adminQueries.ledger())
  },
}

// In the component:
const handlePrefetch = (tabKey: string) => {
  TAB_PREFETCH[tabKey]?.(queryClient)
}
```

---

## 5. Lazy Dialogs with Radix Exit Animation Preservation

When dialogs contain heavy forms, editors, or libraries (e.g. Leaflet maps, complex datepickers), lazy-load them on demand. To prevent abrupt unmounting that breaks Radix exit transitions (fade-out/zoom-out), use a sticky open flag (`hasOpened*`):

```tsx
import * as React from 'react'

const HeavyDialog = React.lazy(() =>
  import('./heavy-dialog').then((m) => ({ default: m.HeavyDialog })),
)

export function MyPanel() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [hasOpened, setHasOpened] = React.useState(false)

  const handleOpen = () => {
    setHasOpened(true)
    setIsOpen(true)
  }

  return (
    <div>
      <Button onClick={handleOpen}>Open Dialog</Button>

      {hasOpened && (
        <React.Suspense fallback={null}>
          <HeavyDialog open={isOpen} onOpenChange={setIsOpen} />
        </React.Suspense>
      )}
    </div>
  )
}
```

---

## 6. Shared Loading Primitives (`src/components/shared/loading.tsx`)

| Component | Variant | Typical Usage |
|---|---|---|
| `AdminContentSkeleton` | `table` | Default CRUD list routes (Dealers, Products, Users) |
| `AdminContentSkeleton` | `stats-table` | Operational dashboards, Accounts, Orders, Payments |
| `AdminContentSkeleton` | `form` | Settings, Multi-step forms, Configuration views |
| `AdminContentSkeleton` | `report` | Financial statements, Audit logs, Reports |
| `TabSkeleton` | `table` / `stats-table` / `form` | Child tabs rendered inside panel `<AsyncBoundary>` |
| `AsyncBoundary` | - | Wrapper combining error boundary retry UI and Suspense |
