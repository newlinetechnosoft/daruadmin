# PROMPT FOR AI CODING AGENT: Admin and Staff Panel UX Transformation (Mezmani / Daru Gang)

## ROLE

You are a senior product designer and front-end engineer who has shipped ERP back-offices. You are redesigning the **UX and structure** of the Mezmani admin and manager console (`/admin/*`) so that non-technical staff (shop managers, accountants, order desk operators) can do their daily work quickly, with few clicks and little training.

Your reference for structure and behavior is the **Frappe / ERPNext Desk**: List view, Form view, Report view, Workspace, Awesomebar, child tables, link fields, status indicators, activity timeline. Your reference for implementation is **shadcn/ui**. Do not copy Frappe's colors or its Bootstrap look. Copy its information architecture and interaction model, built from shadcn primitives in this repo's existing visual language.

---

## 1. PROJECT CONTEXT (read before coding)

- Stack: TanStack Start (React 19, file routing) on Vercel, Tailwind v4, shadcn/ui (new-york, zinc), lucide-react, TanStack Query, `@tanstack/react-table`, react-hook-form, Zod, cmdk, vaul, recharts, sonner. Path alias `#/*` maps to `./src/*`.
- Read first: root `AGENT.md` (it is a router), then only the files it points to for UI work: `UI_APPROACH.md`, `src/components/AGENT.md`, `src/routes/AGENT.md`, `src/components/ui/AGENT.md`. Read the relevant `src/server/*/AGENT.md` only when you touch a data shape.
- Roles that use this console: `admin` (everything) and `manager` (orders, dealers, riders, settlements, limited ledger). Permissions come from `can()` in `#/server/auth/permissions-shared` and the `ModuleKey` list. The rider panel (`/rider`) and the storefront are out of scope.
- Business flow that the UI must make obvious: customer places order (COD or eSewa) -> manager confirms -> manager assigns a dealer per line -> manager assigns a rider -> rider picks up and delivers -> rider hands cash to manager -> manager settles dealer and rider -> everything posts to the ledger. There is **no inventory** in this business model (see `prompt.md`).

### Rule overrides for this task

`AGENT.md` rule 10 says UI tasks are "visual only". **For this task you are explicitly allowed to restructure pages, routes, component trees and form state in the admin console.** Everything else in `AGENT.md` still applies:

- Do not change server functions, Zod schemas, DB schema, ledger logic or data shapes unless a change is unavoidable. If it is, list it under "Server changes needed" in your report and keep it backward compatible.
- Money is integer paisa. Render it only through `MoneyText` or `formatNPR()`.
- Do not hand-edit `src/routeTree.gen.ts` or `src/components/ui/*`.
- Compose from shadcn primitives. Add missing ones with `bunx --bun shadcn@latest add <name>` (if bun fails, use npx).
- Keep the visual tokens in `UI_APPROACH.md` (monochrome, hairline borders, Geist, sentence case, no emoji, no gradients, `rounded-lg` max for containers). You may add **semantic status tokens** and a **density setting** if needed.
- Do not commit or push. Do not read or print `.env.local`.
- Before finishing, `bun run lint`, `bun run check` and `bunx tsc --noEmit` must pass.

---

## 2. DIAGNOSIS (verified in the code; this is what to fix)

1. **Giant single-file panels.** `accounts-panel.tsx` is about 4,300 lines, `orders-panel.tsx` about 2,300, `staff-panel.tsx` about 1,460, `settings-panel.tsx` about 1,360, `liquor-panel.tsx` and `grocery-panel.tsx` about 1,230 each. Each mixes list, filters, create form, edit form, detail view and dialogs. Nobody can maintain this, and users get lost in it.
2. **Everything is a modal.** Order detail is a `Dialog` of roughly 800 lines (`max-w-2xl`, `max-h-[90vh]`, internal scrolling) containing a line-items table, assignment and payment controls. Create order is a second large dialog. Dialogs cannot be linked, bookmarked, or opened side by side, and they break on phones.
3. **Hand-rolled tables.** Panels build raw `<Table>` markup with their own filters and pagination. `shared/data-table.tsx` exists but is basic (search box plus pagination), and it is not used consistently. Wide tables (8+ columns, for example Orders) scroll sideways on small screens.
4. **Inconsistent forms.** Several panels use many `useState` fields (for example `orderForm` in orders) instead of the shadcn `Form` with react-hook-form and the shared Zod schema that `src/components/AGENT.md` requires. Validation, dirty state and error display differ per page.
5. **Navigation does not match how people work.**
   - The "Accounts" submenu lists Ledger, Transaction, Dealer Ledger, Sales Account, Salary Account and Chart of Accounts, but every entry points to `/admin/accounts` (same URL, different internal tab).
   - Accounts has a 7-column tab bar; Settings has 7 tabs; Staff has 3 tabs. Deep state is invisible in the URL.
   - "Users", "Staff" and "Customers" overlap conceptually and sit in different groups.
   - An **Inventory** item exists even though the business holds no stock (check `prompt.md` and `TODO.md`; do not build on it, flag it, and hide it behind a feature flag or remove it if the TODO confirms it is being replaced by dealer sourcing).
6. **Duplicate shared components.** `src/components/admin/` (`page-header`, `kpi-card`, `status-badge`, `pagination`, `confirm-dialog`, `empty-state`, `charts`) duplicates `src/components/shared/`. Consolidate into `shared/`.
7. **Not responsive end to end.** Several panels were built desktop-only. Some tab bars use `grid-cols-7`. Dialogs are not full-screen on mobile. Tables overflow.
8. **No power-user affordances.** No saved filters, no bulk actions, no keyboard shortcuts, no "recently viewed", no inline editing, no quick-create from inside a form.
9. **Dashboard is a report, not a workspace.** Staff need to see "what needs my action now" (orders awaiting confirmation, unassigned orders, pending settlements), not only charts.
10. **Version drift in docs.** `src/components/AGENT.md` says `@tanstack/react-table` 9.x is installed, but `package.json` says `^8.20.5`. Verify the installed version and code against it.

---

## 3. TARGET UX: THE FRAPPE / ERPNEXT MODEL, IN SHADCN

Adopt these concepts, named the same way in code and in folder structure so staff and developers share vocabulary.

### 3.1 Workspace (replaces the current dashboard as the landing page)

- `/admin` shows a **Workspace**: shortcut cards, "Needs attention" counts (each count is a link to a pre-filtered List view), a short recent-activity feed, and 3 to 4 KPI cards with a single chart. Charts are secondary.
- Each role gets a tailored workspace. Manager: order desk (new orders, unassigned, out for delivery, cash to collect from riders). Admin: the manager view plus approvals (settlements, payroll runs), staff and settings shortcuts.
- Sidebar items link to a module's List view. Keep shadcn `Sidebar` (collapsible to icons, `SidebarRail`), but regroup (see 3.9).

### 3.2 Awesomebar (global command palette)

- Upgrade the existing `CommandDialog` search into a true Awesomebar, opened with `Ctrl/Cmd+K` and `/`. It must support:
  - navigation ("orders", "new order", "settle dealer"),
  - **create actions** ("New order", "New dealer", "New rider"),
  - record search (order number, customer phone, dealer name, product),
  - recently visited records,
  - results grouped by type, each with an icon and a status indicator.
- Show the shortcut as a `Kbd` in the header search button.

### 3.3 List view (one reusable engine for every module)

Build `ListView` on top of `@tanstack/react-table` and shadcn `Table`. Required features:

- **Toolbar:** search, filter popover (field, operator, value rows like Frappe's "Add a Filter"), active filter chips with remove buttons, "Clear all", sort menu, column picker (show/hide and reorder), density toggle (comfortable/compact), refresh, primary action button ("New X") on the right.
- **Saved views:** save the current filters, sort and columns under a name per user (store in localStorage first, with a clean adapter so it can move to the server). Include sensible defaults per module ("My open orders", "Unassigned", "Cash pending").
- **Sidebar filters or quick-filter row:** the top 3 to 5 status filters as segmented tabs with counts (for example Orders: All, New, Confirmed, Assigned, Out for delivery, Delivered, Cancelled).
- **Bulk actions:** row checkboxes plus a sticky `BulkActionBar` (assign rider, change status, export CSV). Destructive bulk actions go through `AlertDialog`.
- **Rows:** primary identifier is a link to the Form view, status shown with `StatusIndicator` (dot plus label), money right-aligned, tabular numbers, relative time with absolute time in a tooltip. Row hover shows quick actions in a `DropdownMenu`.
- **State in the URL:** page, page size, search, filters, sort, view. Use TanStack Router `validateSearch` with Zod. Use server-side pagination, sort and filter where the existing server functions support it. Do not change them; if a filter cannot be done server-side today, do it client-side for the loaded page and note it in the report.
- **States:** skeleton rows, empty state with a primary action, error state with retry, and refetch indicator (thin progress bar, not a spinner that replaces content).
- **Footer:** total count, page-size select, shadcn `Pagination`, optional totals row for money columns.
- **Responsive:** see section 5. On phones, rows become **cards** (`ListCard`) showing 3 to 4 key fields with the status and a primary action. No horizontal scrolling of the page.

### 3.4 Form view (one reusable engine for every document)

Create `FormView` and friends. Documents (order, dealer, rider, product, brand, staff member, voucher, promo) open as **full pages**, not modals:

- Routes: list `/admin/<module>`, new `/admin/<module>/new`, record `/admin/<module>/$id`.
- **Header (sticky):** breadcrumb, title (record name or number), `StatusIndicator`, "Not saved" badge when the form is dirty, primary action on the right (Save, or the next workflow step such as "Confirm order"), and a "More" `DropdownMenu` (Duplicate, Print, Cancel order, Archive).
- **Layout:** sections (`FormSection`) with a title and optional collapse, 1 to 3 responsive columns of fields (`FormGrid`), tabs only when a document has distinct areas (for example Dealer: Details, Items and prices, Settlements). Prefer one scrollable page with a sticky section index over many tabs.
- **Fields:** shadcn `Form` + react-hook-form + the **same Zod schema as the server function**. Every field has a label, help text where useful, an inline error and a required marker. Autofocus the first field. Enter does not submit multi-line forms accidentally.
- **Link fields (`LinkField`):** a `Popover` + `Command` combobox with async search for relations (customer, dealer, rider, product, category, brand, account), showing a secondary line (phone, PAN, SKU). Includes "Create new" inside the list that opens a **quick-entry `Sheet`** without leaving the form.
- **Child tables (`ChildTable`):** an editable grid for line items (order lines, dealer item prices, voucher lines): add row, delete row, reorder, inline edit with keyboard navigation (Tab, Enter, arrow keys), auto-computed totals footer, per-row validation. On phones it becomes a stacked list of row cards with an "Edit" `Drawer`.
- **Dirty state and safety:** `Ctrl/Cmd+S` saves; leaving a dirty form triggers a confirm (`useBlocker` from TanStack Router plus `beforeunload`). Show a Sonner toast on success and keep the user on the page. Disable the submit button and show a spinner while pending.
- **Right rail or bottom section:** `ActivityTimeline` (status changes, assignments, payments, comments if supported by existing data, otherwise the audit log) and `Related` (linked records such as the order's rider, dealer settlement, payment and voucher, each a link).
- **Workflow:** for documents with a state machine (orders use `src/lib/order-status.ts`), show a `WorkflowBar` (a stepper of statuses with the current one highlighted) and only the **allowed next actions** as buttons, with role checks. Illegal transitions are never offered. Terminal states make the form read-only with a clear banner.
- **Read-only mode:** when the user lacks permission, render the same layout with fields as text, not disabled inputs.

### 3.5 Report view

For Reports and finance tables (ledger, dealer ledger, sales, payroll), reuse `ListView` in "report" mode: group-by, totals row, date-range presets (Today, This week, This month, This fiscal year with the Nepal fiscal year and `Asia/Kathmandu`), CSV export, and a chart toggle. Charts use shadcn `chart` (recharts).

### 3.6 Quick entry

Small documents (brand, category, rider, promo) are created in a right-hand `Sheet` (a `Drawer` on mobile) from the List view toolbar and from any `LinkField`, using the same `FormView` building blocks. Large documents (order, dealer, staff, product) use full pages.

### 3.7 Status indicators

One `StatusIndicator` (dot + text, optional tooltip) with a single mapping module for order, payment, settlement, user-active and rider-availability states, replacing all per-page color logic. Keep color for status only. Use the existing semantic tokens (`success`, `warning`, `destructive`, `info`). Never rely on color alone: always show the text.

### 3.8 Print and export

Order, voucher and invoice records get a **Print** action using a print stylesheet scoped with Tailwind `print:` utilities (no new global CSS classes). Lists get CSV export of the currently filtered set.

### 3.9 Navigation (information architecture)

Regroup the sidebar around daily tasks, with a maximum of about 12 top-level items and no submenus that point at the same URL:

| Group                 | Items                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                  | Workspace                                                                                                                                           |
| Sales                 | Orders, Customers, Promotions (Marketing)                                                                                                           |
| Sourcing and delivery | Dealers, Riders, Shipping                                                                                                                           |
| Catalog               | Products (Liquor and Grocery as a filter or tab inside one Products list, if the data layer allows; otherwise keep two entries), Categories, Brands |
| Finance               | Accounts, Payments, Reports                                                                                                                         |
| People and system     | Staff and users (one list with a role filter, keeping their separate permissions), Settings                                                         |

- Accounts submenu entries must become **real routes** (for example `/admin/accounts/ledger`, `/admin/accounts/dealer-ledger`, `/admin/accounts/chart`, `/admin/accounts/payroll`) so they can be linked and bookmarked, and so the giant `accounts-panel.tsx` is split by route.
- Settings becomes a **two-pane layout** (left list of sections, right form), with each section its own route (`/admin/settings/delivery`, `/tax`, `/gateways`, ...). On mobile the left list is a full-screen menu that drills into a section.
- Show only items the user may access (`can()`), hide empty groups, keep the active item and its parents highlighted, show badge counts for work queues (for example new orders).
- Breadcrumbs on every page. The header has: sidebar trigger, breadcrumb, Awesomebar button, notifications, theme toggle, user menu.
- Persist sidebar collapsed state.

---

## 4. SHARED COMPONENT LIBRARY TO BUILD (all composed from shadcn)

Create under `src/components/shared/` (and delete the duplicates in `src/components/admin/` once migrated). Each gets a short usage comment and is added to the status table in `src/components/AGENT.md`.

| Component                                                                                                               | Purpose                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `PageShell`, `PageHeader`                                                                                               | Standard page frame: breadcrumb, title, description, count badge, actions; max width and padding rules for all breakpoints |
| `ListView` (+ `ListToolbar`, `FilterPopover`, `FilterChips`, `ColumnPicker`, `SavedViews`, `BulkActionBar`, `ListCard`) | Frappe-style list engine                                                                                                   |
| `FormView` (+ `FormHeader`, `FormSection`, `FormGrid`, `FormField` wrapper, `FormFooter`)                               | Frappe-style form engine on shadcn `Form`                                                                                  |
| `LinkField`                                                                                                             | Async combobox with quick-create                                                                                           |
| `ChildTable`                                                                                                            | Editable line-item grid with totals                                                                                        |
| `WorkflowBar`                                                                                                           | Status stepper and allowed actions                                                                                         |
| `StatusIndicator`                                                                                                       | Single status mapping                                                                                                      |
| `ActivityTimeline`, `RelatedRecords`                                                                                    | Record history and links                                                                                                   |
| `QuickEntrySheet`                                                                                                       | Right sheet / mobile drawer for small docs                                                                                 |
| `ResponsiveDialog`                                                                                                      | `Dialog` on desktop, `Drawer` on mobile                                                                                    |
| `Awesomebar`                                                                                                            | Global command palette                                                                                                     |
| `StickyActionBar`                                                                                                       | Bottom bar for primary actions on mobile                                                                                   |
| `MoneyText`, `DateText`                                                                                                 | Money and Nepal-timezone dates, one place                                                                                  |
| `EmptyState`, `ErrorState`, `TableSkeleton`                                                                             | Required states                                                                                                            |
| `ShortcutsHelp`                                                                                                         | `?` opens a shortcut cheat sheet in a `Dialog`                                                                             |

Rules for these components: typed generics, no module-specific logic inside them, no `any`, props documented, accessible by keyboard, and every icon-only button has an `aria-label`.

---

## 5. RESPONSIVE AND DESKTOP REQUIREMENTS

Every admin page must work and look intentional at **375, 768, 1024, 1280, 1440 and 1920 px** wide.

**Phones (below 640 px)**

- Sidebar becomes an off-canvas `Sheet`. The page never scrolls horizontally.
- Lists render as `ListCard`s. Filters open in a bottom `Drawer`. Primary actions sit in a `StickyActionBar` or a floating "New" button. Tap targets are at least 40 px.
- Forms are a single column. Dialogs become full-height `Drawer`s. Child tables become row cards with an edit drawer.
- Use the existing `use-mobile` hook or CSS container/breakpoint classes. Prefer CSS (Tailwind responsive utilities) over JS when possible to avoid layout flash.

**Tablets (640 to 1023 px)**

- Sidebar collapsed to icons by default. Lists use a table with fewer columns (hide secondary columns with the column-priority system below). Forms use 2 columns.

**Desktop (1024 px and up)**

- Full sidebar, dense tables, sticky table header and sticky toolbar, forms with 2 to 3 columns plus the right rail for timeline and related records.
- Content max width about 1440 px, centered on very wide screens, so lines of text and form fields do not stretch across 1920 px. Tables may use the full width.
- Keyboard-first: `Ctrl/Cmd+K` Awesomebar, `/` focus search, `n` new record on a list, `j/k` move row focus, `Enter` open row, `Ctrl/Cmd+S` save, `Esc` close sheet/dialog, `?` shortcuts help. Shortcuts are disabled while typing in inputs.
- Density toggle (compact for power users on large monitors).

**Column priority system:** every column definition declares a priority (`1` always, `2` from tablet, `3` desktop only). The table hides lower priorities as width shrinks, and the column picker can override.

**Scrolling rules:** only the main content area scrolls; the header and sidebar stay fixed; table headers stick under the toolbar; use `min-w-0` on flex children and `truncate` with tooltips for long text.

---

## 6. MODULE-BY-MODULE SPEC

For each module, split the current panel into a route folder with `list`, `form` and small feature components, each file under about 400 lines.

| Module                         | List view (key columns and filters)                                                                                                                                    | Form view / actions                                                                                                                                                                     | Notes                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Orders**                     | Number and date, customer, items count, total, status, payment, dealer, rider. Status tabs with counts; filters: payment method, date range, rider, dealer, unassigned | Full page. Customer and delivery details, lines (`ChildTable`), dealer assignment per line, rider assignment, payment and cash status, `WorkflowBar`, `ActivityTimeline`, print invoice | Highest priority. Assignment of dealer and rider must be possible in 2 clicks from the list (bulk) and from the form. |
| **Customers**                  | Name, phone, orders, lifetime spend, last order                                                                                                                        | Profile, addresses, order history (`RelatedRecords`)                                                                                                                                    | Read-mostly.                                                                                                          |
| **Dealers**                    | Name, PAN/VAT, contact, items count, payable balance                                                                                                                   | Details, items and cost prices (`ChildTable`), settlement history                                                                                                                       | Show "Settle" as a primary action when a balance exists.                                                              |
| **Riders**                     | Name, status, active orders, cash held, earnings                                                                                                                       | Profile, shifts, deliveries, cash handover, payroll                                                                                                                                     | Cash handover is a prominent flow.                                                                                    |
| **Products (Liquor, Grocery)** | Image, name, category, brand, variants, price, active. Filter by category, brand, availability                                                                         | Details, variants (`ChildTable`), images (existing uploader), pricing, availability                                                                                                     | Keep the image uploader logic; only relocate it into `FormView`.                                                      |
| **Categories, Brands**         | Simple lists                                                                                                                                                           | `QuickEntrySheet`                                                                                                                                                                       |                                                                                                                       |
| **Accounts**                   | Separate routes: Ledger, Dealer ledger, Chart of accounts, Vouchers, Payroll, Financial reports                                                                        | Voucher as a full page with `ChildTable` lines and totals; settlement approval flows as guided steps (`Dialog` with stepper, or a page)                                                 | Split the 4,300-line panel by route; do not alter posting logic.                                                      |
| **Payments**                   | Date, order, method, amount, status                                                                                                                                    | Detail page                                                                                                                                                                             |                                                                                                                       |
| **Marketing**                  | Promos, offers, banners as tabs or routes                                                                                                                              | Promo form with usage history in `RelatedRecords`                                                                                                                                       |                                                                                                                       |
| **Reports**                    | Report picker (cards) then Report view                                                                                                                                 | Date presets, group-by, export                                                                                                                                                          | Nepal fiscal year presets.                                                                                            |
| **Staff and users**            | One people list with role filter                                                                                                                                       | Staff form, permissions matrix as a clear grid with presets, audit log tab                                                                                                              | Permission matrix must be readable on mobile (accordion per module).                                                  |
| **Settings**                   | Two-pane sections                                                                                                                                                      | Autosave-free explicit Save per section, dirty indicator                                                                                                                                | Group fields with `FormSection`.                                                                                      |
| **Shipping**                   | Zones and fees list                                                                                                                                                    | Quick entry                                                                                                                                                                             |                                                                                                                       |
| **Inventory**                  | Flag as obsolete or hide (see Diagnosis 5)                                                                                                                             |                                                                                                                                                                                         | Do not build new features here.                                                                                       |

---

## 7. UX WRITING AND ACCESSIBILITY

- Plain, short, sentence-case labels. Say "Assign rider", not "Allocate logistics resource". Buttons are verbs. Confirmation text names the record and the consequence ("Cancel order #1042? The customer will be notified.").
- Every list has a helpful empty state with the next action. Every error says what happened and what to do.
- Destructive actions use `AlertDialog`. Prefer archive over delete (soft-delete rule).
- WCAG AA contrast, visible focus rings, correct `Label htmlFor`/`id`, `aria-live` for toasts and async results, logical focus return after closing a sheet or dialog, reduced-motion respected.
- No emoji. Icons from `lucide-react` only, 16 px in controls.

---

## 8. EXECUTION PLAN (work in phases; stop after Phase 1 for review)

**Phase 0: Audit (no code changes).** List every file you will touch, confirm the installed `@tanstack/react-table` version, confirm which shadcn components are missing, and write a one-page plan with the final route map. Save it as `docs/admin-ux-plan.md`.

**Phase 1: Foundations.** Build `PageShell`, `ListView`, `FormView`, `LinkField`, `ChildTable`, `StatusIndicator`, `ResponsiveDialog`, `QuickEntrySheet`, `Awesomebar`, the new sidebar IA and the Workspace. Migrate **Brands** (small) as the proof of the list + quick-entry pattern and **Dealers** as the proof of the full-page form pattern. **Stop and report with screenshots** at the six widths. Wait for my approval before continuing.

**Phase 2: Orders.** The highest-value module: list with status tabs and bulk assignment, full-page form with `WorkflowBar`, line items, assignment and timeline. Remove the old dialogs.

**Phase 3: Catalog and people.** Products (Liquor, Grocery), Categories, Customers, Riders, Staff and users.

**Phase 4: Finance.** Accounts split into routes, vouchers, settlements, payments, reports.

**Phase 5: Settings and polish.** Two-pane settings, keyboard shortcuts help, saved views defaults, density toggle, print styles, empty/error states sweep, deletion of dead code and the duplicated `components/admin/` files.

Within each phase, finish a module completely (list, form, responsive, states) before starting the next. Do not leave both the old and the new implementation of a module in the repo; delete the old one when the new one works.

---

## 9. ACCEPTANCE CRITERIA (a module is done only when all are true)

1. List and form work at all six widths with no horizontal page scroll, and no clipped or overlapping controls.
2. List state (filters, sort, page, search, view) is in the URL; refresh and back/forward restore it.
3. Forms use shadcn `Form` + react-hook-form + the server's Zod schema, show a dirty indicator, support `Ctrl/Cmd+S` and warn before discarding changes.
4. Loading, empty, error and pending-mutation states exist and look consistent.
5. Only allowed workflow actions are shown; unauthorized users see read-only views or no menu entry.
6. Keyboard-only use is possible for the main flow (open list, search, open row, edit, save).
7. No file in the module exceeds about 400 lines; no duplicate shared components remain.
8. No server, schema or ledger behavior changed (or the change is listed under "Server changes needed").
9. `bun run lint`, `bun run check` and `bunx tsc --noEmit` pass. Existing tests (`*.test.ts`) still pass.
10. Visual verification: run the app and capture screenshots of the list and form at 375, 768, 1024 and 1440 px in light and dark mode (Playwright is acceptable) and attach them to the phase report.

---

## 10. REPORTING FORMAT (end of every phase)

1. What changed (modules, new shared components, deleted files) in 10 lines or fewer.
2. Route map (old -> new).
3. Screenshots at the widths above.
4. Decisions you made where the docs were silent, and questions for me ("Assumptions to confirm").
5. "Server changes needed" (ideally empty).
6. Anything you saw in the code that looks wrong but was out of scope (for example the stock logic, the demo reset function, secrets in the archive) so I can decide.

Do not commit or push. If a decision is not documented and a wrong guess would be costly, ask me; otherwise choose the simplest option, state it in the report, and continue.
