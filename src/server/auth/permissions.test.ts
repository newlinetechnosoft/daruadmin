import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

function expect(actual: any) {
  return {
    toBe(expected: any) {
      assert.strictEqual(actual, expected)
    },
    toEqual(expected: any) {
      assert.deepStrictEqual(actual, expected)
    },
  }
}
import { DEFAULT_GRANTS_BY_ROLE, can, isSuperAdmin } from './permissions-shared'
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

  describe('4. Granular CRUD Isolation and Permission Matrix Operations', () => {
    it('strictly isolates CRUD operations across catalog modules without umbrella leakage', () => {
      // Manager given full CRUD on food, but read-only on liquor
      const customGrants: UserGrants = {
        ...DEFAULT_GRANTS_BY_ROLE.manager,
        food: ['view', 'create', 'edit', 'delete'],
        liquor: ['view'],
        products: ['view', 'create', 'edit', 'delete'], // Even if legacy products row exists in DB
      }

      // Food has full CRUD
      expect(can(customGrants, 'food', 'view')).toBe(true)
      expect(can(customGrants, 'food', 'create')).toBe(true)
      expect(can(customGrants, 'food', 'edit')).toBe(true)
      expect(can(customGrants, 'food', 'delete')).toBe(true)

      // Liquor has view only; CRUD mutation strictly denied
      expect(can(customGrants, 'liquor', 'view')).toBe(true)
      expect(can(customGrants, 'liquor', 'create')).toBe(false)
      expect(can(customGrants, 'liquor', 'edit')).toBe(false)
      expect(can(customGrants, 'liquor', 'delete')).toBe(false)
    })

    it('ensures categories grants do not leak into brands when brands is explicitly configured', () => {
      const customGrants: UserGrants = {
        categories: ['view', 'create', 'edit', 'delete'],
        brands: ['view'],
      }

      expect(can(customGrants, 'categories', 'create')).toBe(true)
      expect(can(customGrants, 'brands', 'view')).toBe(true)
      expect(can(customGrants, 'brands', 'create')).toBe(false)
      expect(can(customGrants, 'brands', 'edit')).toBe(false)
      expect(can(customGrants, 'brands', 'delete')).toBe(false)
    })

    it('ensures inventory grants do not leak into dealers when dealers is explicitly configured', () => {
      const customGrants: UserGrants = {
        inventory: ['view', 'create', 'edit', 'delete'],
        dealers: ['view'],
      }

      expect(can(customGrants, 'inventory', 'create')).toBe(true)
      expect(can(customGrants, 'dealers', 'view')).toBe(true)
      expect(can(customGrants, 'dealers', 'create')).toBe(false)
      expect(can(customGrants, 'dealers', 'edit')).toBe(false)
      expect(can(customGrants, 'dealers', 'delete')).toBe(false)
    })

    it('ensures staff grants do not leak into users when users is explicitly configured', () => {
      const customGrants: UserGrants = {
        staff: ['view', 'create', 'edit'],
        users: ['view'],
      }

      expect(can(customGrants, 'staff', 'edit')).toBe(true)
      expect(can(customGrants, 'users', 'view')).toBe(true)
      expect(can(customGrants, 'users', 'edit')).toBe(false)
      expect(can(customGrants, 'users', 'create')).toBe(false)
    })

    it('completely denies access when module is set to empty array (revoked in matrix)', () => {
      const customGrants: UserGrants = {
        ...DEFAULT_GRANTS_BY_ROLE.manager,
        liquor: [],
        dealers: [],
      }

      for (const act of ACTIONS) {
        expect(can(customGrants, 'liquor', act)).toBe(false)
        expect(can(customGrants, 'dealers', act)).toBe(false)
      }
    })

    it('preserves backwards compatibility when module is completely undefined in legacy records', () => {
      const legacyGrants: UserGrants = {
        categories: ['view', 'create'],
        inventory: ['view', 'create'],
        products: ['view', 'create'],
        staff: ['view'],
      }

      // Brands undefined -> falls back to categories
      expect(can(legacyGrants, 'brands', 'view')).toBe(true)
      expect(can(legacyGrants, 'brands', 'create')).toBe(true)
      expect(can(legacyGrants, 'brands', 'delete')).toBe(false)

      // Dealers undefined -> falls back to inventory
      expect(can(legacyGrants, 'dealers', 'view')).toBe(true)
      expect(can(legacyGrants, 'dealers', 'create')).toBe(true)
      expect(can(legacyGrants, 'dealers', 'delete')).toBe(false)

      // Liquor undefined -> falls back to products
      expect(can(legacyGrants, 'liquor', 'view')).toBe(true)
      expect(can(legacyGrants, 'liquor', 'create')).toBe(true)
      expect(can(legacyGrants, 'liquor', 'delete')).toBe(false)

      // Users undefined -> falls back to staff
      expect(can(legacyGrants, 'users', 'view')).toBe(true)
      expect(can(legacyGrants, 'users', 'create')).toBe(false)
    })

    it('evaluates legacy products query dynamically from granular submodules', () => {
      const grantsWithOnlyLiquor: UserGrants = {
        liquor: ['view', 'create'],
        food: [],
        grocery: [],
        ddc: [],
        categories: [],
        brands: [],
        inventory: [],
        dealers: [],
      }

      expect(can(grantsWithOnlyLiquor, 'products', 'view')).toBe(true)
      expect(can(grantsWithOnlyLiquor, 'products', 'create')).toBe(true)
      expect(can(grantsWithOnlyLiquor, 'products', 'delete')).toBe(false)

      const grantsWithNothing: UserGrants = {
        liquor: [],
        food: [],
        grocery: [],
        ddc: [],
        categories: [],
        brands: [],
        inventory: [],
        dealers: [],
      }

      expect(can(grantsWithNothing, 'products', 'view')).toBe(false)
      expect(can(grantsWithNothing, 'products', 'create')).toBe(false)
    })
  })
  describe('5. Super Admin (Developer Team: admin@newline.com) RBAC Governance', () => {
    it('identifies admin@newline.com and role superadmin as superadmin', () => {
      expect(isSuperAdmin({ email: 'admin@newline.com', role: 'admin' })).toBe(true)
      expect(isSuperAdmin({ email: 'ADMIN@NEWLINE.COM', role: 'customer' })).toBe(true)
      expect(isSuperAdmin({ email: 'dev@example.com', role: 'superadmin' })).toBe(true)
      expect(isSuperAdmin({ email: 'manager@mezmani.com', role: 'admin' })).toBe(false)
      expect(isSuperAdmin({ email: 'rider@mezmani.com', role: 'rider' })).toBe(false)
      expect(isSuperAdmin(null)).toBe(false)
    })

    it('ensures superadmin has unrestricted access across all modules and actions', () => {
      const superGrants = DEFAULT_GRANTS_BY_ROLE.superadmin
      for (const mod of MODULES) {
        for (const act of ACTIONS) {
          expect(can(superGrants, mod, act)).toBe(true)
        }
      }
    })

    it('supports customizing matrix access for an administrator while leaving superadmin unrestricted', () => {
      // Super admin assigns restricted permissions to an admin account
      const customizedAdminGrants: UserGrants = {
        ...DEFAULT_GRANTS_BY_ROLE.admin,
        accounts: ['view'],
        settings: ['view'],
      }

      expect(can(customizedAdminGrants, 'accounts', 'view')).toBe(true)
      // Superadmin default role remains completely unrestricted
      expect(can(DEFAULT_GRANTS_BY_ROLE.superadmin, 'settings', 'delete')).toBe(true)
    })
  })

  describe('6. Granular Accounts Sub-Menu Matrix Permissions', () => {
    it('supports all 21 Accounts sub-modules in the permission matrix without drift', () => {
      const allAccountsModules = [
        'accounts_overview',
        'accounts_chart_of_accounts',
        'accounts_branches',
        'accounts_ledger',
        'accounts_vouchers',
        'accounts_party_accounts',
        'accounts_dealer_ledger',
        'accounts_rider_ledger',
        'accounts_customer_ledger',
        'accounts_supplier_ledger',
        'accounts_employee_ledger',
        'accounts_bank_cash',
        'accounts_expenses',
        'accounts_reconciliation',
        'accounts_financial_reports',
        'accounts_export_center',
        'accounts_period_close',
        'accounts_audit_trail',
        'accounts_settings',
        'accounts_sales_account',
        'accounts_salary_account',
      ] as const

      for (const mod of allAccountsModules) {
        expect(can(DEFAULT_GRANTS_BY_ROLE.admin, mod, 'view')).toBe(true)
      }

      const hrPayrollOfficerGrants: UserGrants = {
        accounts_salary_account: ['view', 'create', 'export', 'approve'],
        accounts_employee_ledger: ['view', 'export'],
      }

      // Can view and approve salary
      expect(can(hrPayrollOfficerGrants, 'accounts_salary_account', 'view')).toBe(true)
      expect(can(hrPayrollOfficerGrants, 'accounts_salary_account', 'approve')).toBe(true)
      expect(can(hrPayrollOfficerGrants, 'accounts_employee_ledger', 'view')).toBe(true)

      // Umbrella accounts is automatically reachable when sub-modules are granted
      expect(can(hrPayrollOfficerGrants, 'accounts', 'view')).toBe(true)

      // But cannot view bank & cash or post general vouchers
      expect(can(hrPayrollOfficerGrants, 'accounts_bank_cash', 'view')).toBe(false)
      expect(can(hrPayrollOfficerGrants, 'accounts_vouchers', 'create')).toBe(false)
      expect(can(hrPayrollOfficerGrants, 'accounts_period_close', 'edit')).toBe(false)
    })

    it('inherits umbrella accounts permissions when sub-modules are undefined in legacy grants', () => {
      const legacyAccountantGrants: UserGrants = {
        accounts: ['view', 'create', 'export'],
      }

      expect(can(legacyAccountantGrants, 'accounts_overview', 'view')).toBe(true)
      expect(can(legacyAccountantGrants, 'accounts_ledger', 'create')).toBe(true)
      expect(can(legacyAccountantGrants, 'accounts_financial_reports', 'export')).toBe(true)
      // Approve was not in umbrella accounts, so it remains denied
      expect(can(legacyAccountantGrants, 'accounts_salary_account', 'approve')).toBe(false)
    })

    it('enforces strict denial when sub-module is explicitly empty [] despite umbrella', () => {
      const restrictedAuditorGrants: UserGrants = {
        accounts: ['view', 'export'],
        accounts_salary_account: [], // Explicitly denied access to payroll
      }

      expect(can(restrictedAuditorGrants, 'accounts_ledger', 'view')).toBe(true)
      expect(can(restrictedAuditorGrants, 'accounts_salary_account', 'view')).toBe(false)
      expect(can(restrictedAuditorGrants, 'accounts_salary_account', 'export')).toBe(false)
    })
  })
})
