# src/components/ui — shadcn generated components

**Scope:** shadcn/ui primitives only (config: `components.json` — style `new-york`, base `zinc`, alias `#/components/ui`).
**Read when:** adding, updating, or debugging a shadcn component.

## Rules

- Add with `bunx --bun shadcn@latest add <component>` (npm fallback: `npx shadcn@latest add <component>`). **Never hand-write a file here.**
- Do **not** edit these files except to fix a real bug or apply a deliberate global design tweak (note it below) — future `shadcn add --overwrite` must stay safe.
- Put product-specific components in `../shared/`, `../store/`, or the panel folder — **not here**.
- After adding a component that brings a new dependency, make sure `package.json` and `bun.lock` are updated and committed.

## Installed components

- `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `chart`, `checkbox`, `collapsible`, `command`, `dialog`, `drawer`, `dropdown-menu`, `empty`, `field`, `form`, `input`, `input-group`, `item`, `kbd`, `label`, `native-select`, `pagination`, `popover`, `progress`, `radio-group`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `sonner`, `spinner`, `switch`, `table`, `tabs`, `textarea`, `toggle`, `toggle-group`, `tooltip`.

## Local modifications to generated files

1. **`cn` import fix (All primitives)**:
   - Fixed generated import from `'cn'` (an unrelated npm package) to `'#/lib/utils'` (our tailwind-merge + clsx helper).
   - Removed unused `'cn'` npm dependency from `package.json`.

2. **`badge.tsx` variants**:
   - Added semantic `success` (`bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20`), `warning` (`bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20`), and `info` (`bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20`) badge variants to match Vercel design system conventions.
