import * as React from 'react'
import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { adminQueries } from '#/queries/admin'
import { AsyncBoundary } from '#/components/shared/async-boundary'
import { TabSkeleton, type SkeletonVariant } from '#/components/shared/loading'
import { ENTITY_CONFIGS } from './entity-configs'
import type { SuperAdminTabKey, BulkEntityKey } from './types'

export type { SuperAdminTabKey, BulkEntityKey } from './types'

// Lazy-loaded superadmin tabs
const CsvImportTab = React.lazy(() =>
  import('./components/csv-import-tab').then((m) => ({
    default: m.CsvImportTab,
  })),
)
const FeatureFlagsTab = React.lazy(() =>
  import('./tabs/feature-flags-tab').then((m) => ({
    default: m.FeatureFlagsTab,
  })),
)
const PricingRulesTab = React.lazy(() =>
  import('./tabs/pricing-rules-tab').then((m) => ({
    default: m.PricingRulesTab,
  })),
)
const TelemetryTab = React.lazy(() =>
  import('./tabs/telemetry-tab').then((m) => ({ default: m.TelemetryTab })),
)
const AdminNoticesTab = React.lazy(() =>
  import('./tabs/admin-notices-tab').then((m) => ({
    default: m.AdminNoticesTab,
  })),
)
const SystemManagementTab = React.lazy(() =>
  import('./tabs/system-management-tab').then((m) => ({
    default: m.SystemManagementTab,
  })),
)
const WebsiteManagementTab = React.lazy(() =>
  import('./tabs/website-management-tab').then((m) => ({
    default: m.WebsiteManagementTab,
  })),
)
const UserRolesTab = React.lazy(() =>
  import('./tabs/user-roles-tab').then((m) => ({ default: m.UserRolesTab })),
)
const AuditTrailTab = React.lazy(() =>
  import('./tabs/audit-trail-tab').then((m) => ({ default: m.AuditTrailTab })),
)

function getSuperAdminTabSkeletonVariant(tab: SuperAdminTabKey): SkeletonVariant {
  switch (tab) {
    case 'features':
    case 'pricing':
    case 'system':
    case 'website':
    case 'admin-panel':
      return 'form'
    case 'console':
      return 'stats-table'
    default:
      return 'table'
  }
}

export function SuperAdminPanel() {
  const currentTab = useRouterState({
    select: (s) =>
      ((s.location.search as Record<string, unknown> | undefined)?.tab ??
        'customers') as SuperAdminTabKey,
  })

  // Pre-fetch / query data for the panel tabs
  const { data: overview } = useSuspenseQuery(adminQueries.superAdminOverview())
  const { data: noticesData, refetch: refetchNotices } = useQuery({
    ...adminQueries.adminPanelNotices(),
    enabled: currentTab === 'admin-panel',
  })
  const { data: supportData, refetch: refetchSupport } = useQuery({
    ...adminQueries.superAdminSupport(),
    enabled: currentTab === 'admin-panel',
  })
  const { data: systemData, refetch: refetchSystem } = useQuery({
    ...adminQueries.superAdminSystem(),
    enabled: currentTab === 'system',
  })
  const { data: websiteData, refetch: refetchWebsite } = useQuery({
    ...adminQueries.superAdminWebsite(),
    enabled: currentTab === 'website',
  })
  const { data: featureFlagsData, refetch: refetchFeatureFlags } = useQuery({
    ...adminQueries.superAdminFeatureFlags(),
    enabled: currentTab === 'features',
  })
  const { data: pricingData, refetch: refetchPricing } = useQuery({
    ...adminQueries.superAdminPricingRules(),
    enabled: currentTab === 'pricing',
  })
  const { data: usersData, refetch: refetchUsers } = useQuery({
    ...adminQueries.users(),
    enabled: currentTab === 'users' || currentTab === 'console',
  })
  const { data: auditLogsData } = useQuery({
    ...adminQueries.superAdminAuditLogs(100),
    enabled: currentTab === 'audit',
  })
  const { data: telemetryData } = useQuery({
    ...adminQueries.superAdminTelemetry(),
    enabled: currentTab === 'console',
  })

  const isDataEntity = currentTab in ENTITY_CONFIGS

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <AsyncBoundary
        key={currentTab}
        fallback={
          <TabSkeleton variant={getSuperAdminTabSkeletonVariant(currentTab)} />
        }
      >
        {/* 1-6: Shared Bulk Data & Fleet tabs (Customers, Items, Dealers, Riders, Categories, Brands) */}
        {isDataEntity && (
          <CsvImportTab config={ENTITY_CONFIGS[currentTab as BulkEntityKey]} />
        )}

        {/* 7: Runtime Feature Flags */}
        {currentTab === 'features' && (
          <FeatureFlagsTab
            initialFlags={featureFlagsData}
            onSaved={() => refetchFeatureFlags()}
          />
        )}

        {/* 8: Pricing & Delivery Rules */}
        {currentTab === 'pricing' && (
          <PricingRulesTab
            initialPricing={pricingData}
            onSaved={() => refetchPricing()}
          />
        )}

        {/* 9: Admin Panel Notices & Support */}
        {currentTab === 'admin-panel' && (
          <AdminNoticesTab
            notices={noticesData?.notices}
            initialSupport={supportData}
            onRefetchNotices={() => refetchNotices()}
            onRefetchSupport={() => refetchSupport()}
          />
        )}

        {/* 10: System Management */}
        {currentTab === 'system' && (
          <SystemManagementTab
            initialSystem={systemData}
            onSaved={() => refetchSystem()}
          />
        )}

        {/* 11: Website Management */}
        {currentTab === 'website' && (
          <WebsiteManagementTab
            initialWebsite={websiteData}
            onSaved={() => refetchWebsite()}
          />
        )}

        {/* 12: User & Role Engine */}
        {currentTab === 'users' && (
          <UserRolesTab
            users={usersData}
            onRefetchUsers={() => refetchUsers()}
          />
        )}

        {/* 13: Live Audit Trail */}
        {currentTab === 'audit' && (
          <AuditTrailTab logs={auditLogsData} />
        )}

        {/* 14: Developer Telemetry & Diagnostics */}
        {currentTab === 'console' && (
          <TelemetryTab
            telemetry={telemetryData}
            overview={overview}
            totalUsersCount={usersData?.length}
          />
        )}
      </AsyncBoundary>
    </div>
  )
}
