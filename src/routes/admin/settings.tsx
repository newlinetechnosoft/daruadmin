import { createFileRoute } from '@tanstack/react-router'
import { getSettingsFn } from '#/server/operations/operations.functions'
import { guardModule } from '#/server/auth/guards'
import { SettingsPanel } from '#/components/panels/settings'

export const Route = createFileRoute('/admin/settings')({
  beforeLoad: guardModule('settings'),
  loader: async () => {
    return getSettingsFn()
  },
  component: SettingsPanel,
})
