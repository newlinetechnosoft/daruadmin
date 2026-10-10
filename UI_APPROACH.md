# UI_APPROACH.md — Visual Design System (Mezmani)

> **Scope:** How every screen should look and feel — tokens, typography, shape, component recipes,
> page layouts, responsive and accessibility rules.
> **Not here:** Component file structure, forms/tables logic, and shadcn install rules → `src/components/AGENT.md`;
> routes/loaders → `src/routes/AGENT.md`.
>
> **Read when:** Creating or restyling ANY page, component, form, table, dialog, or layout.
> Read this first, then `src/components/AGENT.md`.
>
> UI work is **visual only** — never touch loaders, server functions, routing, cart logic, form state,
> validation, zod schemas, or data shapes unless explicitly asked.

---

## 1. Aesthetic in One Line

**Vercel-style minimal design system.** Clean, structured, monochrome-first typography with lots of whitespace,
hairline 1px borders, subtle neutral surfaces, sentence-case headings, and flat compact controls.
No brutalist hard offset shadows, no uppercase tracked-out labels, no heavy black borders, no gradients,
no glows, and no emoji.

---

## 2. Core Rules

- **shadcn components only:** Never build UI primitives from scratch. All buttons, inputs, selects,
  checkboxes, switches, dialogs, sheets, tables, tabs, cards, badges, avatars, and tooltips come from shadcn/ui.
- **Tailwind utilities only:** No new global/semantic classes (`.hero`, `.card`, `.nav`, etc.).
  Element defaults live strictly in `@layer base`.
- **Typography:** **Geist Sans** (`font-sans`) and **Geist Mono** (`font-mono`), with system fallbacks.
  Hierarchy is established through scale and weight (`font-semibold` / `font-medium`), never `font-black`.
- **Sentence case everywhere:** No tracked-out uppercase eyebrow labels or all-caps buttons.
- **Theme support:** Full light and dark mode supported via next-themes tokens (`class` attribute).
  Light is the clean default (#ffffff / #fafafa); dark is refined (#000000 / #0a0a0a / #111111).
- **Icons:** `lucide-react` only. Sized consistently (16px `size-4` / `h-4 w-4` for controls and table actions).
- **Never emoji:** Use real product PNGs from `/images/*.png` or clean Lucide icons.
- **Accessibility:** Inputs must have matching `<Label htmlFor>` and `id`; icon-only buttons get `aria-label`;
  non-submit buttons get `type="button"`; visible focus via shadcn's default ring.

---

## 3. Design Tokens

### Surface & Border Tokens

| Token | Light Value | Dark Value | Purpose |
| --- | --- | --- | --- |
| `--background` | `#ffffff` | `#000000` | Main content canvas |
| `--foreground` | `#171717` | `#ededed` | Primary text and headings |
| `--card` | `#ffffff` | `#0a0a0a` | Elevated surfaces, cards, modals |
| `--card-foreground` | `#171717` | `#ededed` | Text on cards |
| `--sidebar` | `#fafafa` | `#0a0a0a` | Admin sidebar, shell canvas |
| `--sidebar-border` | `#eaeaea` | `#262626` | Hairline sidebar separation |
| `--border` | `#eaeaea` | `#262626` | Standard 1px dividers and card borders |
| `--input` | `#e5e5e5` | `#333333` | Input, select, and checkbox borders |
| `--muted` | `#f5f5f5` | `#171717` | Subtle pill backgrounds, table headers |
| `--muted-foreground` | `#666666` | `#a1a1a1` | Secondary copy, captions, timestamps |
| `--accent` | `#f5f5f5` | `#171717` | Hover states, active tabs |
| `--primary` | `#171717` | `#ededed` | Solid primary buttons and badges |
| `--primary-foreground`| `#ffffff` | `#000000` | Text on primary elements |
| `--ring` | `rgba(163,163,163,0.4)` | `rgba(82,82,82,0.5)` | Focus-visible ring |

### Semantic Tokens (Status Only — Never Giant Colored Surfaces)

- `--success`: `#16a34a` (dark: `#22c55e`) — Completed orders, verified status, active pills.
- `--warning`: `#d97706` (dark: `#f59e0b`) — Pending reviews, low stock warning.
- `--destructive`: `#dc2626` (dark: `#ef4444`) — Suspended, cancelled, destructive actions.
- `--info`: `#0070f3` — In-progress, out for delivery, active link ring.

No purple, lime, indigo, cyan, or sky anywhere.

### Radii Hierarchy (`--radius: 0.5rem`)

- `rounded-sm` (4px): Small badges, inner chips, tiny tags.
- `rounded-md` (6px): Buttons, text inputs, selects, dropdown items.
- `rounded-lg` (8px): Cards, dialogs, sheets, datatables, popovers.
- `rounded-xl` (12px): Maximum container radius (rarely used).
- `rounded-full`: Strictly for Avatars and the Cart item count pill.
- **Forbidden:** No `rounded-2xl` or `rounded-3xl`.

### Shadows

- Almost none: Prefer clean 1px hairline borders (`border border-border`).
- Allowed: `shadow-xs` on inputs and outline buttons; soft `shadow-md` on dropdowns, popovers, and dialogs.
- No heavy black offset shadows (`shadow-[3px_3px_0_0_#000]`).

---

## 4. Typography Scale & Formatting

| Role | Tailwind Classes | Example Usage |
| --- | --- | --- |
| Page title | `text-2xl font-semibold tracking-tight` | Admin dashboard header, listing title |
| Storefront hero H1 | `text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight` | Homepage hero headline |
| Section title | `text-lg font-semibold tracking-tight` | Card section titles, settings groups |
| Body / base text | `text-sm text-foreground` (admin) / `text-base` (store) | Main paragraph copy, table contents |
| Secondary copy | `text-xs sm:text-sm text-muted-foreground` | Subtitles, field descriptions |
| Field label | `text-sm font-medium text-foreground` | Form field labels |
| Caption / Meta | `text-xs text-muted-foreground` | Timestamps, table captions |
| Code / Identifiers | `font-mono text-xs text-muted-foreground` | Order IDs, SKUs, tracking codes |
| Numbers / Prices | `tabular-nums` | Table amounts, metrics, stock numbers |

**Sentence case rule:** Write "Shop by category", "Add to order", "Recent deliveries", not "SHOP BY CATEGORY" or "ADD TO ORDER".

---

## 5. Component Recipes & shadcn Mapping

Always use shadcn primitives directly or compose thin wrappers in `src/components/shared/`:

| Element | Primitive / Recipe | Classes & Styling |
| --- | --- | --- |
| Primary action | `Button variant="default"` | `h-9 rounded-md bg-primary text-primary-foreground hover:bg-primary/90` |
| Secondary action | `Button variant="outline"` | `h-9 rounded-md border border-border bg-background hover:bg-accent` |
| Tertiary action | `Button variant="ghost"` | `h-9 rounded-md hover:bg-accent hover:text-accent-foreground` |
| Inputs & Selects | `Input`, `Select` | `h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:ring-[3px]` |
| Status Badge | `StatusBadge` (shared) | `Badge variant="outline"` with a 6px status dot + sentence-case label |
| KPI Metric Card | `KpiCard` (shared) | `Card` with muted small label + `text-2xl font-semibold tabular-nums` |
| Data Table | `DataTable` (shared) | `@tanstack/react-table` + shadcn `Table`, search input, filter selects, pagination |
| Confirmation | `AlertDialog` | Restrained modal with cancel button and destructive/primary submit |
| Modal Form | `Dialog` | Centered `max-w-lg rounded-lg border bg-card p-6 shadow-md` |
| Filter Drawer | `Sheet side="right"` | Mobile filters panel using identical filter components as desktop |
| Navigation Tabs | `Tabs` | `TabsList` with clean understated triggers (`hover:text-foreground`) |
| Theme Switcher | `ThemeToggle` (shared) | DropdownMenu with Light, Dark, System options |

---

## 6. Page Patterns

### Admin Shell (`/admin/*`)
- Sidebar: shadcn `Sidebar` (`#fafafa` light / `#0a0a0a` dark, 1px hairline border). Active item = `bg-accent text-foreground font-medium`; inactive = `text-muted-foreground hover:bg-accent/50`.
- Top bar: `h-14 border-b border-border bg-background px-4 flex items-center justify-between`. Contains `SidebarTrigger`, `Breadcrumb`, global search Command palette (`Cmd+K`), notifications Popover, `ThemeToggle`, and user profile DropdownMenu.
- Page layout: `max-w-7xl mx-auto p-6 space-y-6`. PageHeader → Toolbar → DataTable / KPI Grid.

### Storefront Header & Home (`/`)
- Header: Sticky `h-14 sm:h-16 border-b border-border bg-background/80 backdrop-blur-sm`. Clean sentence-case logo, search input/command, ThemeToggle, cart outline button with rounded-full pill.
- Hero: Minimal, impactful sentence-case headline, muted description, compact search input, clean category cards with subtle `scale-[1.02]` hover.
- Product listings (`/drinks`, `/grocery`): Breadcrumb → Toolbar with sort Select and product count → Sidebar filters (collapsible checkbox groups) → ProductCard grid (Aspect ratio images on subtle muted tile) → shadcn `Pagination`.

---

## 7. Don'ts

- ❌ No uppercase tracked-out labels (`uppercase tracking-[0.22em]`).
- ❌ No `font-black`.
- ❌ No hard offset shadows (`shadow-[3px_3px_0_0_#000]`).
- ❌ No black sidebar or heavy black borders.
- ❌ No gradients, glows, glassmorphism, blur blobs, or colored shadows.
- ❌ No rounded-2xl or rounded-3xl (and avoid rounded-xl on small controls).
- ❌ No raw hex colors or inline style overrides (use CSS variable tokens).
- ❌ No hand-built primitives (`<button>`, `<input>`, `<select>`, `<table>`).
- ❌ No emoji.
- ❌ No touching business logic, server functions, cart state, or schemas.

---

## 8. Status

| Area | Status | Notes |
| --- | --- | --- |
| Design Tokens & `styles.css` | ✅ Completed | Vercel tokens, Geist fonts, `--radius: 0.5rem`, semantic tokens |
| Theme Provider & Toggle | ✅ Completed | `next-themes` wired in `__root.tsx`, `ThemeToggle` in headers |
| `src/components/ui/*` Bug Fix | ✅ Completed | All primitives import from `#/lib/utils`; `cn` package removed |
| shadcn Primitive Installation | ✅ Completed | Installed all primitives: table, select, checkbox, switch, textarea, etc. |
| Shared Compositions (`src/components/shared/*`) | ✅ Completed | `PageHeader`, `KpiCard`, `StatusBadge`, `ConfirmDialog`, `DataTable`, `EmptyState`, `ThemeToggle`, `Pagination` |
| Admin Shell (`/admin/route.tsx`) | ✅ Completed | shadcn `Sidebar`, `Breadcrumb`, `CommandDialog` (Cmd+K), `Popover`, `DropdownMenu` |
| Admin Pages (All 16 pages) | ✅ Completed | All pages migrated: index, users, reports, inventory, customers, staff, taxonomy, shipping, payments, riders, accounts, grocery, liquor, marketing, orders, settings |
| Auth Pages (`/login`, `/signup`) | ✅ Completed | Centered clean card layout with shadcn Input, Label, Checkbox, Button |
| Storefront (`Header`, `Footer`, `/`, `/drinks`, `/grocery`) | ✅ Completed | Vercel style + shadcn primitives, real shadcn Pagination component wired |
| CartSheet, AgeGate, ProductCard | ✅ Completed | Logic preserved, updated to shadcn Sheet, Progress, Button, Badge |
