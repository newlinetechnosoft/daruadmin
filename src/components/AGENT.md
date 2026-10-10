# src/components — UI rules (shadcn-first)

**Scope:** everything visual: forms, tables, dialogs, layouts, states, mobile behavior.
**Read when:** you touch any UI. For adding a shadcn component also read `ui/AGENT.md`.
**Not here:** routes/URLs → `src/routes/AGENT.md` · data/API → `src/server/AGENT.md`.

## The rule

**Never build UI primitives from scratch.** Buttons, inputs, selects, checkboxes, switches, dialogs, sheets, drawers, popovers, tooltips, dropdowns, tabs, tables, cards, badges, avatars, calendars, pagination, skeletons, toasts, sidebars, breadcrumbs, charts — all come from **shadcn/ui**.

Workflow: need a UI piece → check `src/components/ui/` → if missing: `bunx --bun shadcn@latest add <name>` → use it. Browse https://ui.shadcn.com/docs/components first. Custom components are allowed **only as compositions** of shadcn primitives (e.g. `OrderStatusBadge` = `Badge` + status map).

## Folders

| Folder                         | Contents                                                                                                                                      | Status                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `ui/`                          | shadcn-generated only (see `ui/AGENT.md`)                                                                                                     | ✅ All primitives installed & cn imports fixed |
| `shared/`                      | cross-panel compositions: `DataTable`, `PageHeader`, `ConfirmDialog`, `StatusBadge`, `MoneyText`, `EmptyState`, `ThemeToggle`, `Pagination`, `Loading` | ✅ Completed |
| `store/`                       | storefront: `ProductCard`, `CartSheet`, `Header`, `Footer`                                                                                     | ✅ Completed |
| `admin/`, `manager/`, `rider/` | panel-specific compositions (sidebar config, order cards, dashboards, charts)                                                                   | ✅ Completed |

## Patterns

- **Forms:** shadcn `Form` (react-hook-form + `@hookform/resolvers/zod`). **Reuse the same Zod schema as the server function** (export from `src/server/<domain>/*.schemas.ts`). Show field errors, disable submit while pending, toast via **Sonner** on success/failure.
- **Tables:** shadcn Data Table pattern on `@tanstack/react-table`. **Check the installed version (9.x)** — shadcn docs/examples target v8; adapt or pin v8 if the API differs. Use **server-side pagination/sort/filter** driven by URL search params; column visibility + row actions via `DropdownMenu`.
- **Destructive actions:** `AlertDialog` confirmation (deactivate user, cancel order, archive product).
- **Modals vs sheets:** `Dialog` on desktop, `Sheet`/`Drawer` for side panels and mobile.
- **Status display:** one `StatusBadge` mapping (order, payment, user active) — don't re-implement colors per page.
- **Money:** always `<MoneyText paisa={n} />` / `formatNPR()` from `#/lib/money`. Never format inline.
- **Images:** fixed aspect ratio (`AspectRatio`), `loading="lazy"`, `width/height`, `srcset` from the stored WebP variants.
- **Notifications bell:** `Popover` + `Badge` count; new items also surface via Sonner.

## Required states for every list/page

Loading (`Skeleton`) · Empty (message + primary action) · Error (retry) · Pending mutation (disabled button + spinner).

## Layout rules

- Admin/Manager: desktop-first with shadcn `Sidebar` (collapsible); must remain usable on tablets.
- **Rider: mobile-first** — large tap targets, sticky bottom action bar, `Drawer` over `Dialog`, one-tap call/navigate links.
- Storefront: responsive grid, sticky header with cart; age gate must not flash on load.

## Styling

Tailwind utilities + CSS-variable tokens in `src/styles.css`. Use `cn()` from `#/lib/utils`. No inline hex colors, no extra CSS/UI libraries. Icons: `lucide-react` only. Keep labels on inputs, keyboard access, and visible focus.

## Base shadcn set to install in Phase 0

button, input, label, form, select, checkbox, radio-group, switch, textarea, dialog, alert-dialog, sheet, drawer, dropdown-menu, table, tabs, card, badge, sidebar, breadcrumb, separator, skeleton, sonner, tooltip, popover, command, calendar, pagination, chart, avatar, scroll-area, aspect-ratio. Also add deps: `zod`, `react-hook-form`, `@hookform/resolvers`, `sonner`.

_Update the folder/status table when you add shared components._
