# UI_APPROACH.md — Visual design system (Daru / Barmandoo)

> **Scope:** how every screen should *look and feel* — tokens, typography, shape, class recipes, page
> layouts, responsive + a11y rules. **Not** here: component file structure, forms/tables logic and shadcn
> install rules → `src/components/AGENT.md`; routes/loaders → `src/routes/AGENT.md`.
>
> **Read when:** creating or restyling ANY page, component, form, table, dialog or layout.
> Read this first, then `src/components/AGENT.md`.
>
> UI work is **visual only** — never touch loaders, server functions, routing, cart logic, form state,
> validation or data shapes unless asked.

## Assumptions to confirm (ask the owner — do not guess)

1. **shadcn theming approach.** Rule: UI is built from shadcn components and `src/components/ui/*` is not
   hand-edited. This design needs square corners + hard-offset focus. Proposed: (a) set `--radius: 0rem`
   once in `styles.css` and (b) apply the recipes below via `className` / thin wrappers. Allowed to edit
   `ui/*` variants instead? _Default until answered: className overrides only._
2. **Existing redesigned pages** (see Status) use native `<button>/<input>/<select>/<table>` with these
   classes. They should migrate to the shadcn equivalents (§4) with identical classes/appearance.
3. **Pagination** on `/drinks` and `/grocery` is visual only (static 1·2·3·→). Wire up or remove?

## 1. Aesthetic in one line

**Editorial, premium, minimal.** Bold uppercase type, hard black/white contrast, warm-grey canvas, square
corners, hairline borders, real product photography. No gradients, glows, glassmorphism, emoji or rounded
"SaaS card" look.

## 2. Rules

- **Tailwind utilities only.** No new global/semantic classes (`.hero`, `.card`, `.container`, `.header`,
  `.nav`, `.logo`…). No `style={{}}` for things Tailwind can do.
- **No unlayered global CSS on elements** (`a{}`, `button{}`, `body{}`): unlayered CSS beats Tailwind v4
  utilities and breaks `text-*`, `hover:underline`, `transition-*`. Element defaults go in `@layer base`.
- Font: **Inter** (`font-sans`); hierarchy via weight/size/case, no second typeface.
- Icons: `lucide-react`, **functional/admin UI only** (search, edit, delete, filter, status). Storefront
  marketing sections use typography/numerals (`01 02 03`) instead of icons.
- **Never emoji** as imagery. Use real product PNGs in `/images/*.png`
  (`spirits beer tobacco vodka whiskey wine`) with `object-contain`.
- **Light theme only** — no `dark:` variants unless asked.
- Non-submit buttons get `type="button"`; icon-only buttons get `aria-label`; inputs get `<Label htmlFor>`
  + matching `id`; clickable elements get `cursor-pointer`.

## 3. Tokens

| Token | Value | Use |
| --- | --- | --- |
| Ink | `#101010` | Body text |
| Black | `black` | Primary actions, bento tiles, footer, admin sidebar |
| Paper | `#f3f2ee` | Muted sections, filter bars, table headers, thumbnails |
| White | `white` | Page bg, cards, modals |
| Muted text | `neutral-500` (labels) / `neutral-600` (copy) | Never lighter for essential info |
| Hairline | `black/10` rows · `black/20–30` inputs · `black` structure | Dividers/borders |
| Alert | `red-700` (+ `red-50`) | Low stock, suspended, delete hover — the **only** semantic accent |
| Live | `emerald-400` | The "Live" DB dot in the admin sidebar only |

No lime, sky, amber, purple. Product tile colours allowed **only** in the storefront bento
(wine `#5a1f2b`, whiskey `#3a2a1a`, beer `#e9e6df`, vodka white, others `#161616`).

| Type role | Classes |
| --- | --- |
| Hero H1 | `text-[clamp(3.25rem,10vw,7.5rem)] font-black uppercase leading-[0.88] tracking-tighter` (2nd line `text-neutral-400`) |
| Page / section H1–H2 | `text-4xl sm:text-6xl font-black uppercase leading-[0.9] tracking-tighter` |
| Card / modal title | `text-lg font-black uppercase tracking-tight` · modal `text-3xl … tracking-tighter` |
| Eyebrow / label | `text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500` (forms `tracking-[0.18em]`) |
| Body | `text-base leading-relaxed text-neutral-600` (admin `text-sm`) · numbers add `tabular-nums` |

**Shape & spacing:** square corners (only avatars/cart pill are `rounded-full`) · wrapper
`mx-auto w-full max-w-7xl px-5 sm:px-8` · sections `py-16 sm:py-24` (store), `space-y-8` (admin) ·
bento `gap-3 sm:gap-4` · product grid `gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-12`.
**Focus = hard offset shadow**, not a ring: `focus:border-black focus:shadow-[3px_3px_0_0_#000]`.
**Motion:** colour inversion on hover, `hover:opacity-60` on text links, `group-hover:scale-105 duration-500`
on product images. Nothing bouncy.

## 4. Component recipes → shadcn mapping

Use the shadcn component, add these classes via `className` (see Assumption 1).

| Need | shadcn component | Classes to apply |
| --- | --- | --- |
| Primary button | `Button` | `h-11 rounded-none bg-black px-5 text-xs font-semibold uppercase tracking-wider text-white hover:bg-neutral-800` |
| Secondary button | `Button variant="outline"` | `h-11 rounded-none border-black bg-white px-5 text-xs font-semibold uppercase tracking-wider hover:bg-black hover:text-white` |
| Text link | `Link` | `border-b border-black pb-0.5 text-sm font-semibold hover:opacity-60` + " →" |
| Cart pill | `Button` | `h-10 rounded-full bg-black px-5 text-sm font-semibold text-white` (count: `rounded-full bg-white text-black`) |
| Input / Select / Textarea | `Input` `Select` `Textarea` | `h-11 w-full rounded-none border-black/30 bg-white px-3 text-sm shadow-none placeholder:text-neutral-400 focus-visible:border-black focus-visible:ring-0 focus-visible:shadow-[3px_3px_0_0_#000]` |
| Table-cell input | `Input` | `h-9 rounded-none border-black/25 px-2 text-sm` |
| Checkbox | `Checkbox` | black when checked (`accent-black` on native) |
| Status chip | `Badge` / `Button` | base `border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-none` · Active `border-black bg-black text-white` · Draft `border-black/30 text-neutral-500` |
| Role/tag badge | `Badge` | `rounded-none border px-2 py-1 text-[10px] font-bold uppercase tracking-wider` |
| Card | `Card` | `rounded-none border border-black bg-white p-5 shadow-none` |
| Icon button | `Button variant="ghost"` | `h-9 w-9 rounded-none text-neutral-500 hover:bg-black hover:text-white` (delete → `hover:bg-red-700`) |
| Filter bar | div | `flex flex-col gap-3 bg-[#f3f2ee] p-4 md:flex-row md:items-center` |
| Stat tile grid | div | wrapper `grid gap-px border border-black bg-black`; tile `bg-[#f3f2ee] p-5`; number `text-4xl sm:text-5xl font-black tabular-nums tracking-tighter` |
| Empty state | div | `bg-[#f3f2ee] px-6 py-20 text-center` + uppercase black title + `text-sm text-neutral-600` + primary button |
| Dialog | `Dialog` | content `max-w-2xl rounded-none border-2 border-black bg-white p-6 shadow-[8px_8px_0_0_#000] sm:p-8`; overlay `bg-black/70 backdrop-blur-sm`; footer `border-t border-black/15 pt-5`, Cancel + Submit right-aligned |
| Mobile filter drawer | `Sheet side="right"` | `max-w-sm bg-white`; pinned Reset / Apply footer; same filter JSX as the desktop sidebar |
| Tabs | `Tabs` | list `border-b border-black`; trigger `-mb-px border px-4 py-3 text-xs font-semibold uppercase tracking-wider`; active `border-black bg-black text-white`; inactive `border-transparent text-neutral-500` |
| Table | `Table` | see below |
| Toast | `sonner` | keep as is |

**Tables (admin):** wrapper `border border-black` → `overflow-x-auto` → `Table` `min-w-[720px]`. Header row
`border-b border-black bg-[#f3f2ee]` with eyebrow-style heads; body `divide-y divide-black/10`, row
`hover:bg-neutral-50`, cells `px-4 py-4`; thumbnails `h-12 w-12 bg-[#f3f2ee] object-cover` (square);
low stock (≤10) `border-red-700 bg-red-50 text-red-800`; empty row `py-14 text-center text-neutral-500`.

**Line-item rows in dialogs (variants):** `grid grid-cols-2 gap-2 bg-[#f3f2ee] p-3 sm:grid-cols-12` — stack on mobile.

## 5. Page patterns

### Storefront home `/`

```
[ sticky header: BARMANDOO · Drinks Food Reviews About · search · Cart(n) ]
[ HERO bg-paper: eyebrow / giant H1 / copy / boxed search / delivery note | 3 product PNGs on white circle ]
[ SHOP BY DRINKS bg-black ]   asymmetric bento (below)
[ SHOP BY FOOD white ]        numbered typographic rows  01 MOMO →
[ APP bg-paper ]              black phone mockup (product image) | headline + phone form + store buttons
[ FEATURES ]                  3 cols, border-t-2 border-black, numerals 01/02/03
[ REVIEWS bg-paper ]          3 white cards, black-circle initial avatar
[ FOOTER bg-black ]
```

Bento — `grid auto-rows-[190px] grid-cols-2 gap-3 sm:auto-rows-[240px] sm:gap-4 lg:grid-cols-12 lg:auto-rows-[230px]`

```
lg (12 cols)
┌──────────────┬────────────┬─────────┐
│  DOMESTIC    │   BEER     │ TOBACCO │ col-span-3
│  SPIRITS     │ (light bg) ├─────────┤
│  span-5 ×2   │ span-4 ×2  │  WINE   │ col-span-3
├──────────────┴─────┬──────┴─────────┤
│   VODKA (white)    │    WHISKEY     │ col-span-6 each
└────────────────────┴────────────────┘
mobile 2 cols: Spirits(2) Beer(2) · Tobacco Wine · Vodka Whiskey
```

Tile: `group relative isolate block overflow-hidden bg-[#161616] text-white`; label top-left
`p-5 sm:p-7 font-black uppercase leading-[0.95] tracking-tight` (`text-3xl sm:text-5xl` large /
`text-xl sm:text-3xl` small); image `absolute bottom-0 right-0 h-[78%] w-[78%] object-contain
object-bottom-right p-3 sm:p-6` + hover scale; `→` fades in top-right.

### Listing pages `/drinks`, `/grocery`

```
[ Header ]
[ page hero bg-paper: eyebrow breadcrumb / giant uppercase title / description ]
[ toolbar: "N of M products"  [Filters (mobile)] [Sort ▾]   border-b border-black ]
[ sidebar 230–250px sticky | product grid 2 cols → 3 cols lg ]
[ pagination squares h-11 w-11 ]
[ Footer ]
```

Sidebar: eyebrow group titles; active category row solid black (`bg-black text-white`), inactive
`text-neutral-600 hover:bg-[#f3f2ee]`; checkboxes black. Desktop sidebar and mobile `Sheet` render the
**same `filterPanel`** JSX.

### Admin shell `/admin/*`

- Sidebar `bg-black text-white w-72`: sticky full-height on `md+`, off-canvas on mobile. Active item
  `bg-white text-black font-semibold`; inactive `text-neutral-400 hover:bg-white/10 hover:text-white`.
- Top bar white, `border-b border-black`, eyebrow breadcrumb, black "View store" button.
- **Each admin page owns its padding:** root `space-y-8 bg-white p-5 text-[#101010] sm:p-8`
  (the layout adds none).
- Page header: eyebrow (+icon) → giant H1 + outlined count chip
  (`border border-black px-2.5 py-1 text-[11px] font-bold tabular-nums`) → one-line description;
  primary action aligned right. Then filter bar → bordered table / card grid → dialog.
- New panels (manager, rider) reuse this shell; the rider panel is mobile-first (large `h-12` targets).

## 6. Responsive & accessibility

- Mobile-first; verify **375 / 768 / 1280**; no horizontal page scroll; tables scroll inside `overflow-x-auto`.
- Touch targets ≥ 40px. Storefront mobile nav = scrollable row under the header; admin = off-canvas drawer.
- Images: meaningful `alt` (decorative → `alt="" aria-hidden="true"`), product images `loading="lazy"`.
- Dialogs/sheets keep Radix a11y (`role="dialog"`, focus trap); tabs use `role="tab"` / `aria-selected`.
- Visible focus via the offset-shadow style; never remove outlines without replacing them.

## 7. Don'ts

❌ emoji · ❌ gradients/glows/blur blobs · ❌ `rounded-lg/xl/2xl` on cards, inputs, buttons ·
❌ coloured accents · ❌ new global classes or element selectors · ❌ dark admin theme ·
❌ lorem ipsum — use realistic Nepal copy and `formatNPR` · ❌ touching data/logic while restyling.

## 8. Before finishing a UI task

1. shadcn components used (no hand-built primitives), styled with the recipes above?
2. Square corners, hairlines, black/white/paper only?
3. Works at 375 / 768 / 1280? Labels, aria, alt present?
4. Loaders, handlers, routes untouched?
5. `bun run lint` · `bun run check` · `bunx tsc --noEmit` pass.
6. Looks like the same product as the reference screens in `docs/ui/`?

## 9. Status

| Area | State |
| --- | --- |
| Storefront home `/` | 🟨 redesigned, native elements → migrate to shadcn |
| `/drinks`, `/grocery` | 🟨 redesigned, native elements → migrate; pagination is visual only |
| `Header`, `Footer`, `ProductCard` (`src/components/store/*`) | ⬜ not yet restyled |
| Admin shell + dashboard, liquor, grocery, taxonomy, users | 🟨 redesigned, native elements → migrate |
| Cart drawer, checkout, login, age gate, rider/manager panels | ⬜ not yet restyled |
| `styles.css` cleanup (legacy homepage block, unlayered `a{}`) | ✅ |

Legend: ⬜ not started · 🟨 in progress · ✅ done
