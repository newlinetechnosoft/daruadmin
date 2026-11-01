import { describe, expect, it } from 'bun:test'
import { DEFAULT_GRANTS_BY_ROLE, can } from './permissions-shared'
import type { UserGrants } from './permissions-shared'
import { MODULES, ACTIONS } from '#/server/operations/types'

describe('Role & Financial Permissions Alignment (ACC-0.7 / G8)', () => {
  describe('1. Default Grants by Role Architecture', () => {
    it('ensures admin has unrestricted access across all modules and actions', () => {
      const adminGrants = DEFAULT_GRANTS_BY_ROLE.admin
      for (const mod of MODULES) {
        for (const act of ACTIONS) {
          expect(can(adminGrants, mod, act)).toBe(true)
        }
      }
    })

    it('ensures manager has accounts.view, accounts.create, and accounts.export', () => {
      const managerGrants = DEFAULT_GRANTS_BY_ROLE.manager
      expect(can(managerGrants, 'accounts', 'view')).toBe(true)
      expect(can(managerGrants, 'accounts', 'create')).toBe(true)
      expect(can(managerGrants, 'accounts', 'export')).toBe(true)
    })

    it('ensures manager is strictly denied accounts.approve, accounts.edit, and accounts.delete', () => {
      const managerGrants = DEFAULT_GRANTS_BY_ROLE.manager
      expect(can(managerGrants, 'accounts', 'approve')).toBe(false)
      expect(can(managerGrants, 'accounts', 'edit')).toBe(false)
      expect(can(managerGrants, 'accounts', 'delete')).toBe(false)
    })

    it('ensures rider and customer roles have zero accounts permissions', () => {
      const riderGrants = DEFAULT_GRANTS_BY_ROLE.rider
      const customerGrants = DEFAULT_GRANTS_BY_ROLE.customer

      for (const act of ACTIONS) {
        expect(can(riderGrants, 'accounts', act)).toBe(false)
        expect(can(customerGrants, 'accounts', act)).toBe(false)
      }
    })
  })

  describe('2. Financial Function Permission Alignment (§14.2 Owner Decision)', () => {
    const managerGrants = DEFAULT_GRANTS_BY_ROLE.manager
    const adminGrants = DEFAULT_GRANTS_BY_ROLE.admin

    it('allows Manager to record cash handovers (requires accounts.create)', () => {
      expect(can(managerGrants, 'accounts', 'create')).toBe(true)
      expect(can(adminGrants, 'accounts', 'create')).toBe(true)
    })

    it('allows Manager to create dealer settlement batches / drafts (requires accounts.create)', () => {
      expect(can(managerGrants, 'accounts', 'create')).toBe(true)
      expect(can(adminGrants, 'accounts', 'create')).toBe(true)
    })

    it('allows Manager to generate monthly rider payroll runs (requires accounts.create)', () => {
      expect(can(managerGrants, 'accounts', 'create')).toBe(true)
      expect(can(adminGrants, 'accounts', 'create')).toBe(true)
    })

    it('allows Manager to view accounting overview and unsettled items (requires accounts.view)', () => {
      expect(can(managerGrants, 'accounts', 'view')).toBe(true)
      expect(can(adminGrants, 'accounts', 'view')).toBe(true)
    })

    it('denies Manager from posting arbitrary manual journal vouchers (requires accounts.approve)', () => {
      // Must be admin / accounts.approve only so managers holding accounts.create cannot post manual JVs
      expect(can(managerGrants, 'accounts', 'approve')).toBe(false)
      expect(can(adminGrants, 'accounts', 'approve')).toBe(true)
    })

    it('denies Manager from disbursing dealer payments (requires accounts.approve)', () => {
      expect(can(managerGrants, 'accounts', 'approve')).toBe(false)
      expect(can(adminGrants, 'accounts', 'approve')).toBe(true)
    })

    it('denies Manager from approving rider settlements / payouts (requires accounts.approve)', () => {
      expect(can(managerGrants, 'accounts', 'approve')).toBe(false)
      expect(can(adminGrants, 'accounts', 'approve')).toBe(true)
    })

    it('denies Manager from reversing journal vouchers (requires accounts.approve)', () => {
      expect(can(managerGrants, 'accounts', 'approve')).toBe(false)
      expect(can(adminGrants, 'accounts', 'approve')).toBe(true)
    })
  })

  describe('3. Custom User Grants and Overrides', () => {
    it('allows granting explicit accounts.approve to a senior finance manager', () => {
      const seniorFinanceManagerGrants: UserGrants = {
        ...DEFAULT_GRANTS_BY_ROLE.manager,
        accounts: ['view', 'create', 'export', 'approve'],
      }

      expect(can(seniorFinanceManagerGrants, 'accounts', 'create')).toBe(true)
      expect(can(seniorFinanceManagerGrants, 'accounts', 'approve')).toBe(true)
    })

    it('allows restricting an intern manager to view-only accounts access', () => {
      const internGrants: UserGrants = {
        ...DEFAULT_GRANTS_BY_ROLE.manager,
        accounts: ['view'],
      }

      expect(can(internGrants, 'accounts', 'view')).toBe(true)
      expect(can(internGrants, 'accounts', 'create')).toBe(false)
      expect(can(internGrants, 'accounts', 'approve')).toBe(false)
    })
  })
})
