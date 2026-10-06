import { useState, useMemo } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getAdminLiquorProductsFn,
  getAllTaxonomyFn,
  upsertLiquorProductFn,
  toggleProductStatusFn,
  deleteItemFn,
} from '#/server/catalog/catalog.functions'
import { formatNPR, toPaisa, toRupees } from '#/lib/money'
import {
  Wine,
  Search,
  Plus,
  Sparkles,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/liquor')({
  loader: async () => {
    const [products, taxonomy] = await Promise.all([
      getAdminLiquorProductsFn(),
      getAllTaxonomyFn(),
    ])
    return { products, taxonomy }
  },
  component: AdminLiquorPage,
})

interface VariantFormItem {
  id?: string
  name: string
  volumeMl: number
  sku: string
  price: number // in NPR rupees for form input
  mrp?: number
  abv: string
  stock: number
  isActive: boolean
}

const labelCls =
  'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500'
const fieldCls =
  'h-11 w-full border border-black/30 bg-white px-3 text-sm outline-none placeholder:text-neutral-400 focus:border-black focus:shadow-[3px_3px_0_0_#000]'
const cellCls =
  'h-9 w-full border border-black/25 bg-white px-2 text-sm outline-none focus:border-black'
const filterCls =
  'h-11 border border-black/30 bg-white px-3 text-sm outline-none focus:border-black'

function AdminLiquorPage() {
  const { products, taxonomy } = Route.useLoaderData()
  const router = useRouter()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedBrand, setSelectedBrand] = useState('all')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formBrandId, setFormBrandId] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formImageUrl, setFormImageUrl] = useState('')
  const [formIsFeatured, setFormIsFeatured] = useState(false)
  const [formIsActive, setFormIsActive] = useState(true)
  const [formVariants, setFormVariants] = useState<VariantFormItem[]>([
    {
      name: '750 ml',
      volumeMl: 750,
      sku: '',
      price: 2500,
      mrp: 2700,
      abv: '40.0',
      stock: 50,
      isActive: true,
    },
  ])

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (
        selectedCategory !== 'all' &&
        p.categoryId !== selectedCategory &&
        p.categorySlug !== selectedCategory
      ) {
        return false
      }
      if (
        selectedBrand !== 'all' &&
        p.brandId !== selectedBrand &&
        p.brandSlug !== selectedBrand
      ) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = p.name.toLowerCase().includes(q)
        const matchesCat = p.categoryName.toLowerCase().includes(q)
        const matchesBrand = p.brandName?.toLowerCase().includes(q)
        const matchesSku = p.variants.some((v) =>
          v.sku.toLowerCase().includes(q),
        )
        return matchesName || matchesCat || matchesBrand || matchesSku
      }
      return true
    })
  }, [products, searchQuery, selectedCategory, selectedBrand])

  const openAddModal = () => {
    setEditingId(null)
    setFormName('')
    setFormSlug('')
    setFormCategoryId(taxonomy.liquorCategories[0]?.id ?? '')
    setFormBrandId(taxonomy.liquorBrands[0]?.id ?? '')
    setFormDescription('')
    setFormImageUrl('')
    setFormIsFeatured(false)
    setFormIsActive(true)
    setFormVariants([
      {
        name: '750 ml',
        volumeMl: 750,
        sku: 'SKU-' + Math.floor(1000 + Math.random() * 9000),
        price: 2500,
        mrp: 2700,
        abv: '40.0',
        stock: 50,
        isActive: true,
      },
    ])
    setModalOpen(true)
  }

  const openEditModal = (p: (typeof products)[0]) => {
    setEditingId(p.id)
    setFormName(p.name)
    setFormSlug(p.slug)
    setFormCategoryId(p.categoryId)
    setFormBrandId(p.brandId ?? '')
    setFormDescription(p.description ?? '')
    setFormImageUrl(p.primaryImage ?? '')
    setFormIsFeatured(p.isFeatured)
    setFormIsActive(p.isActive)
    setFormVariants(
      p.variants.map((v) => ({
        id: v.id,
        name: v.name,
        volumeMl: v.volumeMl,
        sku: v.sku,
        price: toRupees(v.price),
        mrp: v.mrp ? toRupees(v.mrp) : undefined,
        abv: v.abv ?? '40.0',
        stock: v.stock,
        isActive: v.isActive,
      })),
    )
    setModalOpen(true)
  }

  const handleAddVariantRow = () => {
    setFormVariants((prev) => [
      ...prev,
      {
        name: '375 ml',
        volumeMl: 375,
        sku: 'SKU-' + Math.floor(1000 + Math.random() * 9000),
        price: 1300,
        mrp: 1400,
        abv: '40.0',
        stock: 30,
        isActive: true,
      },
    ])
  }

  const handleRemoveVariantRow = (index: number) => {
    if (formVariants.length <= 1) {
      toast.error('A product must have at least one variant')
      return
    }
    setFormVariants((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      toast.error('Product name is required')
      return
    }
    if (!formCategoryId) {
      toast.error('Category is required')
      return
    }
    if (formVariants.length === 0) {
      toast.error('At least one variant is required')
      return
    }

    setIsSubmitting(true)
    try {
      await upsertLiquorProductFn({
        data: {
          id: editingId ?? undefined,
          name: formName.trim(),
          slug: formSlug.trim() || undefined,
          categoryId: formCategoryId,
          brandId: formBrandId || null,
          description: formDescription.trim() || null,
          imageUrl: formImageUrl.trim() || null,
          isFeatured: formIsFeatured,
          isActive: formIsActive,
          variants: formVariants.map((v) => ({
            id: v.id,
            name: v.name.trim(),
            volumeMl: Number(v.volumeMl),
            sku: v.sku.trim() || `SKU-${Date.now()}`,
            price: toPaisa(v.price),
            mrp: v.mrp ? toPaisa(v.mrp) : null,
            abv: v.abv ? String(v.abv) : null,
            stock: Number(v.stock),
            isActive: v.isActive,
          })),
        },
      })

      toast.success(
        editingId
          ? 'Product updated successfully!'
          : 'Product added successfully!',
      )
      setModalOpen(false)
      await router.invalidate()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save product')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async (
    id: string,
    field: 'isActive' | 'isFeatured',
    currentVal: boolean,
  ) => {
    try {
      await toggleProductStatusFn({
        data: {
          catalogType: 'liquor',
          id,
          field,
          value: !currentVal,
        },
      })
      toast.success(`Updated ${field === 'isActive' ? 'status' : 'featured'}`)
      await router.invalidate()
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${name}"?`)) {
      return
    }
    try {
      await deleteItemFn({
        data: {
          catalogType: 'liquor',
          id,
        },
      })
      toast.success('Product deleted')
      await router.invalidate()
    } catch {
      toast.error('Failed to delete product')
    }
  }

  const updateVariant = (i: number, patch: Partial<VariantFormItem>) =>
    setFormVariants((prev) =>
      prev.map((item, idx) => (idx === i ? { ...item, ...patch } : item)),
    )

  return (
    <div className="space-y-8 bg-white p-5 text-[#101010] sm:p-8">
      {/* Header & action */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
            <Wine className="h-3.5 w-3.5" /> Catalog
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <h1 className="text-4xl font-black uppercase leading-[0.9] tracking-tighter sm:text-6xl">
              Liquor catalog
            </h1>
            <span className="border border-black px-2.5 py-1 text-[11px] font-bold tabular-nums">
              {products.length} SKUs
            </span>
          </div>
          <p className="mt-4 max-w-md text-sm text-neutral-600">
            Manage whiskey, rum, vodka, beers, wines, spirits and pricing.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 self-start bg-black px-5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-neutral-800 sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Add liquor SKU
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 bg-[#f3f2ee] p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by bottle name, brand, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${fieldCls} pl-10`}
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          aria-label="Filter by category"
          className={filterCls}
        >
          <option value="all">
            All Categories ({taxonomy.liquorCategories.length})
          </option>
          {taxonomy.liquorCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          aria-label="Filter by brand"
          className={filterCls}
        >
          <option value="all">
            All Brands ({taxonomy.liquorBrands.length})
          </option>
          {taxonomy.liquorBrands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="border border-black">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-black bg-[#f3f2ee] text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                <th className="px-4 py-3.5">Item</th>
                <th className="px-4 py-3.5">Category / Brand</th>
                <th className="px-4 py-3.5">Variants &amp; pricing (NPR)</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-14 text-center text-sm text-neutral-500"
                  >
                    No matching liquor products found.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr
                    key={p.id}
                    className="transition-colors hover:bg-neutral-50"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3.5">
                        <img
                          src={
                            p.primaryImage ||
                            'https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=100&q=80'
                          }
                          alt={p.name}
                          className="h-12 w-12 shrink-0 bg-[#f3f2ee] object-cover"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 font-semibold">
                            <span>{p.name}</span>
                            {p.isFeatured && (
                              <span className="inline-flex items-center gap-1 bg-black px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                                <Sparkles className="h-2.5 w-2.5" /> Featured
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 truncate font-mono text-[11px] text-neutral-400">
                            /{p.slug}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-semibold">{p.categoryName}</div>
                      <div className="text-xs text-neutral-500">
                        {p.brandName || 'No Brand'}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex max-w-sm flex-wrap gap-1.5">
                        {p.variants.map((v) => (
                          <span
                            key={v.id}
                            className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs ${
                              v.stock <= 10
                                ? 'border-red-700 bg-red-50 text-red-800'
                                : 'border-black/20 bg-white'
                            }`}
                          >
                            <span className="font-medium">{v.name}</span>
                            <span className="font-bold tabular-nums">
                              {formatNPR(v.price)}
                            </span>
                            <span className="text-[10px] text-neutral-500">
                              {v.stock} in stock
                            </span>
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleStatus(p.id, 'isActive', p.isActive)
                        }
                        className={`inline-flex cursor-pointer items-center gap-1.5 border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                          p.isActive
                            ? 'border-black bg-black text-white hover:bg-neutral-800'
                            : 'border-black/30 bg-white text-neutral-500 hover:border-black hover:text-black'
                        }`}
                      >
                        {p.isActive ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" /> Draft
                          </>
                        )}
                      </button>
                    </td>

                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="grid h-9 w-9 cursor-pointer place-items-center text-neutral-500 transition-colors hover:bg-black hover:text-white"
                          title="Edit Product"
                          aria-label={`Edit ${p.name}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id, p.name)}
                          className="grid h-9 w-9 cursor-pointer place-items-center text-neutral-500 transition-colors hover:bg-red-700 hover:text-white"
                          title="Delete Product"
                          aria-label={`Delete ${p.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? 'Edit liquor SKU' : 'New liquor SKU'}
        >
          <div className="relative my-8 w-full max-w-2xl border-2 border-black bg-white p-6 text-[#101010] shadow-[8px_8px_0_0_#000] sm:p-8">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 grid h-9 w-9 cursor-pointer place-items-center transition-colors hover:bg-neutral-100"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-3xl font-black uppercase leading-none tracking-tighter">
              {editingId ? 'Edit liquor SKU' : 'New liquor SKU'}
            </h2>
            <p className="mb-7 mt-2 text-sm text-neutral-600">
              Fill in product information, pricing, bottle volume, and stock.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="liq-name" className={labelCls}>
                  Product Name *
                </label>
                <input
                  id="liq-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Old Durbar Black Chimney"
                  className={fieldCls}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="liq-cat" className={labelCls}>
                    Category *
                  </label>
                  <select
                    id="liq-cat"
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    required
                    className={fieldCls}
                  >
                    {taxonomy.liquorCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="liq-brand" className={labelCls}>
                    Brand (Optional)
                  </label>
                  <select
                    id="liq-brand"
                    value={formBrandId}
                    onChange={(e) => setFormBrandId(e.target.value)}
                    className={fieldCls}
                  >
                    <option value="">No Brand</option>
                    {taxonomy.liquorBrands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="liq-img" className={labelCls}>
                    Image URL
                  </label>
                  <input
                    id="liq-img"
                    type="url"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className={fieldCls}
                  />
                </div>

                <div>
                  <label htmlFor="liq-slug" className={labelCls}>
                    URL Slug (Optional)
                  </label>
                  <input
                    id="liq-slug"
                    type="text"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="auto-generated-from-name"
                    className={`${fieldCls} font-mono`}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="liq-desc" className={labelCls}>
                  Description
                </label>
                <textarea
                  id="liq-desc"
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Tasting notes, blend info, heritage..."
                  className="w-full border border-black/30 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-neutral-400 focus:border-black focus:shadow-[3px_3px_0_0_#000]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-black/15 py-4">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="h-4 w-4 accent-black"
                  />
                  <span>Active on storefront</span>
                </label>

                <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={formIsFeatured}
                    onChange={(e) => setFormIsFeatured(e.target.checked)}
                    className="h-4 w-4 accent-black"
                  />
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Featured badge
                  </span>
                </label>
              </div>

              {/* Variants */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`${labelCls} mb-0`}>
                    Bottle volumes &amp; variants
                  </span>
                  <button
                    type="button"
                    onClick={handleAddVariantRow}
                    className="inline-flex cursor-pointer items-center gap-1 border-0 border-b border-black bg-transparent p-0 pb-0.5 text-xs font-semibold transition-opacity hover:opacity-60"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add variant
                  </button>
                </div>

                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {formVariants.map((v, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-2 items-center gap-2 bg-[#f3f2ee] p-3 sm:grid-cols-12"
                    >
                      <div className="col-span-2 sm:col-span-3">
                        <input
                          type="text"
                          placeholder="e.g. 750 ml"
                          aria-label="Variant name"
                          value={v.name}
                          onChange={(e) =>
                            updateVariant(i, { name: e.target.value })
                          }
                          className={cellCls}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          placeholder="Vol ml"
                          aria-label="Volume in ml"
                          value={v.volumeMl}
                          onChange={(e) =>
                            updateVariant(i, {
                              volumeMl: Number(e.target.value),
                            })
                          }
                          className={`${cellCls} tabular-nums`}
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <input
                          type="number"
                          placeholder="Price (Rs)"
                          aria-label="Price in rupees"
                          value={v.price}
                          onChange={(e) =>
                            updateVariant(i, { price: Number(e.target.value) })
                          }
                          className={`${cellCls} font-bold tabular-nums`}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          placeholder="Stock"
                          aria-label="Stock"
                          value={v.stock}
                          onChange={(e) =>
                            updateVariant(i, { stock: Number(e.target.value) })
                          }
                          className={`${cellCls} tabular-nums`}
                        />
                      </div>

                      <div className="col-span-2 flex justify-end sm:col-span-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveVariantRow(i)}
                          aria-label="Remove variant"
                          className="grid h-9 w-9 cursor-pointer place-items-center text-neutral-500 transition-colors hover:bg-red-700 hover:text-white"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-black/15 pt-5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-11 cursor-pointer border border-black bg-white px-5 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-11 cursor-pointer bg-black px-6 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : editingId
                      ? 'Update product'
                      : 'Create product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
