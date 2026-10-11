import { createFileRoute } from '@tanstack/react-router'
import { getRidersFn } from '#/server/operations/operations.functions'
import { guardModule } from '#/server/auth/guards'
import { RidersPanel } from '#/components/panels/riders'

export const Route = createFileRoute('/admin/riders')({
  beforeLoad: guardModule('riders'),
  loader: async () => {
    return getRidersFn()
  },
  component: RidersPanel,
})
