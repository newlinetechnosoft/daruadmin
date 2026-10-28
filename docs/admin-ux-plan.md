# Admin and Staff Panel UX Transformation Plan (Mezmani / Daru Gang)

## 1. Executive Summary & Architecture Reference

This plan restructures the `/admin/*` back-office into a streamlined, low-click, non-technical ERP desk modeled on **Frappe / ERPNext Desk** and built strictly from **shadcn/ui** primitives in accordance with `UI_APPROACH.md` and `src/components/AGENT.md`.

The primary objective is empowering shop managers, order desk operators, and accountants to execute their daily workflows (order dispatch, dealer line assignments, rider handovers, settlements) rapidly across desktop and mobile without large, brittle modal dialogs or 4,000-line monolithic files.

---

## 2. Component & Dependency Audit

### 2.1 `@tanstack/react-table` Version

- **Installed Version:** `^8.20.5` (TanStack Table v8).
- **Doc Correction:** `src/components/AGENT.md` erroneously referenced version 9.x. All table logic will target the official v8 API (`useReactTable`, `getCoreRowModel`, `getPaginationRowModel`, `getSortedRowModel`, `getFilteredRowModel`, `ColumnDef`, `flexRender`).

### 2.2 Missing shadcn Primitives Audit

- **Audit Result:** `src/components/ui/` contains 47 installed primitives including:
  `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `chart`, `checkbox`, `collapsible`, `command`, `dialog`, `drawer`, `dropdown-menu`, `empty`, `field`, `form`, `input`, `input-group`, `item`, `kbd`, `label`, `native-select`, `pagination`, `popover`, `progress`, `radio-group`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `spinner`, `switch`, `table`, `tabs`, `textarea`, `toggle`, `toggle-group`, `tooltip`.
- **Status:** **0 missing primitives**. All required foundations are present and ready for composition.

### 2.3 Component Consolidation

- `src/components/admin/` currently contains 8 duplicate 1-line re-exports (`page-header`, `kpi-card`, `status-badge`, `pagination`, `confirm-dialog`, `empty-state`, `charts`, `styles`).
- All shared engines will reside cleanly under `src/components/shared/`.

---

## 3. Information Architecture & Navigation

The sidebar navigation is reorganized from 7 disjointed sections into 6 task-driven groups with a maximum of 12 items:

| Group                   | Nav Items                                 | Target Route                                                                | Purpose                                                                                                  |
| :---------------------- | :---------------------------------------- | :-------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- |
| **Home**                | Workspace                                 | `/admin`                                                                    | Actionable desk: "Needs attention" queue counters, urgent alerts, short activity feed, secondary KPIs.   |
| **Sales**               | Orders<br>Customers<br>Marketing          | `/admin/orders`<br>`/admin/customers`<br>`/admin/marketing`                 | Core commerce desk: order fulfillment, customer profiles, vouchers/campaigns.                            |
| **Sourcing & Delivery** | Dealers<br>Riders<br>Shipping             | `/admin/dealers`<br>`/admin/riders`<br>`/admin/shipping`                    | Supply logistics: dealer line sourcing, rider fleet, cash handovers, delivery zones.                     |
| **Catalog**             | Liquor<br>Grocery<br>Categories<br>Brands | `/admin/liquor`<br>`/admin/grocery`<br>`/admin/taxonomy`<br>`/admin/brands` | Product records, variant matrix, taxonomy, brand directory.                                              |
| **Finance**             | Accounts<br>Payments<br>Reports           | `/admin/accounts/*`<br>`/admin/payments`<br>`/admin/reports`                | Append-only double-entry ledger, dealer settlements, rider payroll, payment tracking, financial reports. |
| **People & System**     | Staff & Users<br>Settings                 | `/admin/staff`<br>`/admin/settings/*`                                       | Role-based access control, system parameters, delivery pricing, tax configuration.                       |

_Inventory Flag:_ The obsolete `/admin/inventory` nav entry is hidden/flagged since the business holds no physical warehouse inventory (pure dealer sourcing).

---

## 4. Route Map (Old vs. Target)

| Old Route / Pattern                     | New Route / Pattern                                                                                                                                                            | UX Pattern                                                                                    |
| :-------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| `/admin` (Report dashboard)             | `/admin` (Workspace)                                                                                                                                                           | Action-oriented queue counters + quick links + activity feed                                  |
| `/admin/brands` (Dialog modal)          | `/admin/brands`                                                                                                                                                                | `ListView` + `QuickEntrySheet` for create/edit                                                |
| `/admin/dealers` (Dialog modal)         | `/admin/dealers`<br>`/admin/dealers/new`<br>`/admin/dealers/$id`                                                                                                               | `ListView` + full-page `FormView` with items `ChildTable`                                     |
| `/admin/orders` (800-line modal)        | `/admin/orders`<br>`/admin/orders/new`<br>`/admin/orders/$id`                                                                                                                  | `ListView` with status tabs + full-page `FormView` with `WorkflowBar`, `ChildTable`, timeline |
| `/admin/accounts` (7 tabs, 4,300 lines) | `/admin/accounts/ledger`<br>`/admin/accounts/dealer-ledger`<br>`/admin/accounts/chart`<br>`/admin/accounts/vouchers`<br>`/admin/accounts/payroll`<br>`/admin/accounts/reports` | Real URL routes for each tab, bookmarkable, decoupled files                                   |
| `/admin/settings` (7 tabs, 1,360 lines) | `/admin/settings/*`                                                                                                                                                            | Two-pane master-detail layout with deep URLs                                                  |
| `/admin/customers`                      | `/admin/customers`, `/admin/customers/$id`                                                                                                                                     | `ListView` + profile `FormView`                                                               |
| `/admin/riders`                         | `/admin/riders`, `/admin/riders/$id`                                                                                                                                           | `ListView` + profile `FormView` with cash handover flow                                       |
| `/admin/staff`, `/admin/users`          | Consolidated under People                                                                                                                                                      | `ListView` with role filter + permissions grid                                                |

---

## 5. Shared Foundation Components (`src/components/shared/`)

1. **`PageShell` / `PageHeader`**: Responsive frame, max-width 1440px on large screens, breadcrumbs, title, status indicator, action buttons.
2. **`ListView` Engine**:
   - `ListView`: Generic typed table with TanStack Table v8.
   - `ListToolbar`: Search, filter popover, column picker, density toggle, primary action.
   - `FilterPopover` & `FilterChips`: Multi-condition filtering (field, operator, value) with removable chips.
   - `SavedViews`: Pre-configured and custom named filters stored in localStorage.
   - `BulkActionBar`: Sticky bottom bar for batch assignment and status updates.
   - `ListCard`: Responsive mobile card fallback below 640px.
3. **`FormView` Engine**:
   - `FormView`: Full-page form on react-hook-form + Zod schema.
   - `FormHeader`: Sticky header with breadcrumbs, title, dirty state ("Not saved"), primary workflow actions, more actions menu.
   - `FormSection` & `FormGrid`: Semantic grouping with responsive 1-3 columns.
   - `WorkflowBar`: Visual status stepper displaying only valid transitions.
   - `ActivityTimeline` & `RelatedRecords`: Audit trail and linked entities.
4. **`LinkField`**: Searchable Popover + Command combobox with inline "Create New" sheet.
5. **`ChildTable`**: Editable line-item grid with keyboard navigation (Tab/Enter), per-row validation, auto-sum footer, and mobile card view.
6. **`StatusIndicator`**: Dot + text with standardized semantic tokens (`success`, `warning`, `destructive`, `info`).
7. **`ResponsiveDialog`**: Radix `Dialog` on desktop (`>= 640px`), Vaul `Drawer` on mobile (`< 640px`).
8. **`QuickEntrySheet`**: Right sheet (desktop) / bottom drawer (mobile) for lightweight records.
9. **`Awesomebar`**: Global command palette (`Cmd/Ctrl+K`, `/`) supporting commands, quick create, navigation, and entity search.
10. **`ShortcutsHelp`**: Keyboard cheat sheet modal (`?`).
11. **`MoneyText` & `DateText`**: Integer paisa rendering and Nepal timezone / BS date display.

---

## 6. Execution Phasing & File Impact

### Phase 0: Audit & Architecture (Completed)

- Inspect table version, primitives, and route structure.
- Produce `docs/admin-ux-plan.md`.

### Phase 1: Foundations & Proof of Concepts

- **Shared Engines Created:**
  - `src/components/shared/page-shell.tsx`
  - `src/components/shared/status-indicator.tsx`
  - `src/components/shared/money-text.tsx`
  - `src/components/shared/date-text.tsx`
  - `src/components/shared/responsive-dialog.tsx`
  - `src/components/shared/quick-entry-sheet.tsx`
  - `src/components/shared/awesomebar.tsx`
  - `src/components/shared/shortcuts-help.tsx`
  - `src/components/shared/link-field.tsx`
  - `src/components/shared/child-table.tsx`
  - `src/components/shared/list-view/*`
  - `src/components/shared/form-view/*`
- **Shell & Navigation:**
  - `src/routes/admin/route.tsx` (Update to 6-group IA, Awesomebar trigger, responsive drawer)
  - `src/routes/admin/index.tsx` & `src/components/panels/dashboard/*` (Frappe-style Workspace)
- **Proof of Concept 1 (Brands - List + QuickEntry):**
  - `src/routes/admin/brands.tsx`
  - `src/components/panels/brands/brands-panel.tsx`
  - `src/components/panels/brands/brand-sheet.tsx`
- **Proof of Concept 2 (Dealers - List + Full-page FormView):**
  - `src/routes/admin/dealers.tsx`
  - `src/routes/admin/dealers/index.tsx`
  - `src/routes/admin/dealers/$id.tsx`
  - `src/routes/admin/dealers/new.tsx`
  - `src/components/panels/dealers/*`
- **Verification & Review:**
  - TypeScript, ESLint, Prettier, tests pass.
  - Multi-breakpoint screenshot capture (375, 768, 1024, 1280, 1440, 1920 px).
  - Stop and submit report for review.

### Phase 2: Orders Module (Highest Value)

- `src/routes/admin/orders.tsx`, `src/routes/admin/orders/index.tsx`, `src/routes/admin/orders/$id.tsx`, `src/routes/admin/orders/new.tsx`
- Refactor `src/components/panels/orders/*` into modular subcomponents (< 400 lines each).
- Remove 800-line dialog modal; implement line item child tables and quick rider/dealer assignment.

### Phase 3: Catalog & People

- Liquor, Grocery, Taxonomy/Categories.
- Customers, Riders, Staff & Users.

### Phase 4: Finance (Split 4,300-Line Accounts Panel)

- Split into discrete sub-routes: `/admin/accounts/ledger`, `/admin/accounts/dealer-ledger`, `/admin/accounts/chart`, `/admin/accounts/vouchers`, `/admin/accounts/payroll`, `/admin/accounts/reports`.
- Payments and financial reports.

### Phase 5: Settings & Polish

- Two-pane settings.
- Cleanup duplicated proxy components in `src/components/admin/`.
- Print stylesheets and density toggle.
