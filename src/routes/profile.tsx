import { createFileRoute } from '@tanstack/react-router'
import { CustomerProfilePanel } from '#/components/panels/customer/customer-profile-panel'
import { CatalogPageSkeleton } from '#/components/shared/loading'

export const Route = createFileRoute('/profile')({
  pendingComponent: CatalogPageSkeleton,
  component: ProfilePage,
  head: () => ({
    meta: [
      {
        title: 'My Profile & Account Settings — Mezmani Nepal',
      },
      {
        name: 'description',
        content: 'View your customer profile, verified mobile number, security settings, and order history summary.',
      },
    ],
  }),
})

function ProfilePage() {
  return <CustomerProfilePanel />
}
