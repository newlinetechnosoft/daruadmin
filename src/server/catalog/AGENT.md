# src/server/catalog — products, categories, variants, images

**Read when:** anything about liquor/grocery products, categories, brands, variants, availability, images.
**Conventions:** `src/server/AGENT.md` · **Tables:** `src/db/AGENT.md` · **Helpers:** `src/lib/AGENT.md` (storage, money).

## Model
- **Two separate catalogs** (`liquor_*` and `grocery_*` tables), same shape of API via a `catalogType: 'liquor' | 'grocery'` parameter.
- A **product** has **variants** (liquor: `volumeMl`; grocery: `unit` + `quantity`). Price/stock/SKU live on the **variant**. Prices are integer paisa, VAT-inclusive.
- Liquor has **brands**; both catalogs have categories (optionally nested).
- Slugs are unique per catalog, generated from the name, immutable once published (or redirect).
- Archive instead of delete (`archivedAt`/`isActive`); never delete variants referenced by orders/stock.
- `resolveVariant(catalogType, id)` → returns variant + product snapshot data; used by orders/inventory (no DB FK across catalogs).

## Images
- Storage via `#/lib/storage` adapter (Neon Object Storage, beta). Flow: `createImageUpload` returns a **presigned PUT** → client uploads directly (≤5 MB; jpeg/png/webp) → `confirmImageUpload` triggers `sharp` to make **WebP at 400/800/1200 px** → keys saved in `*_images` (`alt`, `sortOrder`, `isPrimary`). Don't stream files through server functions (Vercel ~4.5 MB body limit).

## Functions
| Function | Roles | Purpose | Status |
|---|---|---|---|
| `listLiquorProducts`, `getLiquorProduct` | public | Filters (category, brand, volume, price), search, pagination, by slug | ⬜ |
| `listGroceryProducts`, `getGroceryProduct` | public | Same for grocery | ⬜ |
| `listCategories(catalogType)`, `searchProducts` | public | Taxonomy, cross-catalog search | ⬜ |
| `upsertProduct`, `upsertVariant`, `archiveProduct` | admin | CRUD (both catalogs) | ⬜ |
| `upsertCategory`, `upsertBrand` | admin | Taxonomy CRUD | ⬜ |
| `setVariantAvailability` | admin, manager | Toggle availability | ⬜ |
| `createImageUpload`, `confirmImageUpload`, `deleteImage`, `reorderImages` | admin | Image pipeline | ⬜ |

Public reads return only active, available items and never expose cost price or dealer data.

## Status: ⬜ not started
_Update the function table with input/output shapes as you implement._
