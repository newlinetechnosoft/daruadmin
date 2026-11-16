import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { adminQueries } from '#/queries/admin'
import { ENTITY_CONFIGS } from './entity-configs'
import { CsvImportTab } from './components/csv-import-tab'
import { FeatureFlagsTab } from './tabs/feature-flags-tab'
import { PricingRulesTab } from './tabs/pricing-rules-tab'
import { TelemetryTab } from './tabs/telemetry-tab'
import { AdminNoticesTab } from './tabs/admin-notices-tab'
import { SystemManagementTab } from './tabs/system-management-tab'
import { WebsiteManagementTab } from './tabs/website-management-tab'
import { UserRolesTab } from './tabs/user-roles-tab'
import { AuditTrailTab } from './tabs/audit-trail-tab'
import type { SuperAdminTabKey, BulkEntityKey } from './types'

export type { SuperAdminTabKey, BulkEntityKey } from './types'

export function SuperAdminPanel() {
  const routerState = useRouterState()

  const search = routerState.location.search as Record<string, unknown>
  const currentTab = (typeof search.tab === 'string' ? search.tab : 'customers') as SuperAdminTabKey

  // Pre-fetch / query data for the panel tabs
  const { data: overview } = useSuspenseQuery(adminQueries.superAdminOverview())
  const { data: noticesData, refetch: refetchNotices } = useQuery(
    adminQueries.adminPanelNotices(),
  )
  const { data: supportData, refetch: refetchSupport } = useQuery(
    adminQueries.superAdminSupport(),
  )
  const { data: systemData, refetch: refetchSystem } = useQuery(
    adminQueries.superAdminSystem(),
  )
  const { data: websiteData, refetch: refetchWebsite } = useQuery(
    adminQueries.superAdminWebsite(),
  )
  const { data: featureFlagsData, refetch: refetchFeatureFlags } = useQuery(
    adminQueries.superAdminFeatureFlags(),
  )
  const { data: pricingData, refetch: refetchPricing } = useQuery(
    adminQueries.superAdminPricingRules(),
  )
  const { data: usersData, refetch: refetchUsers } = useQuery(
    adminQueries.users(),
  )
  const { data: auditLogsData } = useQuery(
    adminQueries.superAdminAuditLogs(100),
  )
  const { data: telemetryData } = useQuery(
    adminQueries.superAdminTelemetry(),
  )

  const isDataEntity = currentTab in ENTITY_CONFIGS

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
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
    </div>
  )
}
