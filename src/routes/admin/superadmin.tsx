import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/superadmin')({
  beforeLoad: () => {
    throw redirect({
      to: '/admin',
    })
  },
  component: () => null,
})
