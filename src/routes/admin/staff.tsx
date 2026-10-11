import { createFileRoute } from '@tanstack/react-router'
import { getStaffOpsFn } from '#/server/operations/operations.functions'
import { guardModule } from '#/server/auth/guards'
import { StaffPanel } from '#/components/panels/staff'

export const Route = createFileRoute('/admin/staff')({
  beforeLoad: guardModule('staff'),
  loader: async () => {
    return getStaffOpsFn()
  },
  component: StaffPanel,
})
