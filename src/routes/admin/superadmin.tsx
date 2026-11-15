import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/superadmin')({
  beforeLoad: ({ location }) => {
    const search = location.search as any
    throw redirect({
      to: '/superadmin',
      search: search?.tab ? { tab: search.tab } : undefined,
    })
  },
  component: () => null,
})
