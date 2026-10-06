import { useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getAllTaxonomyFn,
  upsertCategoryFn,
  upsertBrandFn,
  deleteItemFn,
} from '#/server/catalog/catalog.functions'
import {
  Tags,
  Wine,
  ShoppingBag,
  Award,
  Plus,
  Edit2,
  Trash2,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/taxonomy')({
  loader: async () => {
    const taxonomy = await getAllTaxonomyFn()
    return { taxonomy }
  },
  component: AdminTaxonomyPage,
})

type ActiveTab = 'liquor-cat' | 'grocery-cat' | 'brands'

const labelCls =
  'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500'
const fieldCls =
  'h-11 w-full border border-black/30 bg-white px-3 text-sm outline-none placeholder:text-neutral-400 focus:border-black focus:shadow-[3px_3px_0_0_#000]'

interface CategoryLike {
  id: string
  name: string
  slug: string
  description?: string | null
  imageUrl?: string | null
  sortOrder?: number | null
}

function CardActions({
  onEdit,
  onDelete,
  name,
}: {
  onEdit: () => void
  onDelete: () => void
  name: string
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${name}`}
        className="grid h-9 w-9 cursor-pointer place-items-center border-0 bg-transparent text-neutral-500 transition-colors hover:bg-black hover:text-white"
      >
        <Edit2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${name}`}
        className="grid h-9 w-9 cursor-pointer place-items-center border-0 bg-transparent text-neutral-500 transition-colors hover:bg-red-700 hover:text-white"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function AdminTaxonomyPage() {
  const { taxonomy } = Route.useLoaderData()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<ActiveTab>('liquor-cat')

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Generic Form State
  const [formName, setFormName] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formImageUrl, setFormImageUrl] = useState('')
  const [formOrigin, setFormOrigin] = useState('Nepal')
  const [formSortOrder, setFormSortOrder] = useState(0)

  const openAddModal = () => {
    setEditingId(null)
    setFormName('')
    setFormSlug('')
    setFormDescription('')
    setFormImageUrl('')
    setFormOrigin('Nepal')
    setFormSortOrder(0)
    setModalOpen(true)
  }

  const openEditModal = (item: any) => {
    setEditingId(item.id)
    setFormName(item.name)
    setFormSlug(item.slug)
    setFormDescription(item.description ?? '')
    setFormImageUrl(item.imageUrl ?? item.logoUrl ?? '')
    setFormOrigin(item.origin ?? 'Nepal')
    setFormSortOrder(item.sortOrder ?? 0)
    setModalOpen(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      toast.error('Name is required')
      return
    }

    setIsSubmitting(true)
    try {
      if (activeTab === 'liquor-cat') {
        await upsertCategoryFn({
          data: {
            catalogType: 'liquor',
            id: editingId ?? undefined,
            name: formName.trim(),
            slug: formSlug.trim() || undefined,
            description: formDescription.trim() || null,
            imageUrl: formImageUrl.trim() || null,
            sortOrder: Number(formSortOrder),
            isActive: true,
          },
        })
        toast.success(editingId ? 'Category updated' : 'Category created')
      } else if (activeTab === 'grocery-cat') {
        await upsertCategoryFn({
          data: {
            catalogType: 'grocery',
            id: editingId ?? undefined,
            name: formName.trim(),
            slug: formSlug.trim() || undefined,
            description: formDescription.trim() || null,
            imageUrl: formImageUrl.trim() || null,
            sortOrder: Number(formSortOrder),
            isActive: true,
          },
        })
        toast.success(editingId ? 'Category updated' : 'Category created')
      } else {
        await upsertBrandFn({
          data: {
            id: editingId ?? undefined,
            name: formName.trim(),
            slug: formSlug.trim() || undefined,
            origin: formOrigin.trim() || null,
            description: formDescription.trim() || null,
            logoUrl: formImageUrl.trim() || null,
            isActive: true,
          },
        })
        toast.success(editingId ? 'Brand updated' : 'Brand created')
      }

      setModalOpen(false)
      await router.invalidate()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save item')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return

    try {
      const catalogType =
        activeTab === 'liquor-cat'
          ? 'liquor-category'
          : activeTab === 'grocery-cat'
            ? 'grocery-category'
            : 'liquor-brand'

      await deleteItemFn({
        data: {
          catalogType,
          id,
        },
      })
      toast.success('Deleted successfully')
      await router.invalidate()
    } catch {
      toast.error('Failed to delete item')
    }
  }

  const tabs: { id: ActiveTab; label: string; count: number; icon: LucideIcon }[] =
    [
      {
        id: 'liquor-cat',
        label: 'Liquor Categories',
        count: taxonomy.liquorCategories.length,
        icon: Wine,
      },
      {
        id: 'grocery-cat',
        label: 'Grocery Categories',
        count: taxonomy.groceryCategories.length,
        icon: ShoppingBag,
      },
      {
        id: 'brands',
        label: 'Brands & Distilleries',
        count: taxonomy.liquorBrands.length,
        icon: Award,
      },
    ]

  const renderCategoryCard = (cat: CategoryLike) => (
    <div
      key={cat.id}
      className="flex flex-col justify-between gap-5 border border-black bg-white p-5"
    >
      <div className="flex items-start gap-4">
        {cat.imageUrl && (
          <img
            src={cat.imageUrl}
            alt={cat.name}
            className="h-14 w-14 shrink-0 bg-[#f3f2ee] object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-lg font-black uppercase leading-tight tracking-tight">
            {cat.name}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-neutral-400">
            /{cat.slug}
          </div>
          {cat.description && (
            <p className="mt-2 line-clamp-2 text-sm text-neutral-600">
              {cat.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-black/10 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Order {cat.sortOrder}
        </span>
        <CardActions
          name={cat.name}
          onEdit={() => openEditModal(cat)}
          onDelete={() => handleDelete(cat.id, cat.name)}
        />
      </div>
    </div>
  )

  const addLabel =
    activeTab === 'liquor-cat'
      ? 'New liquor category'
      : activeTab === 'grocery-cat'
        ? 'New grocery category'
        : 'New liquor brand'

  const modalTitle = `${editingId ? 'Edit' : 'Create'} ${
    activeTab === 'liquor-cat'
      ? 'liquor category'
      : activeTab === 'grocery-cat'
        ? 'grocery category'
        : 'brand'
  }`

  return (
    <div className="space-y-8 bg-white p-5 text-[#101010] sm:p-8">
      {/* Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
            <Tags className="h-3.5 w-3.5" /> Catalog
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase leading-[0.9] tracking-tighter sm:text-6xl">
            Taxonomy
          </h1>
          <p className="mt-4 max-w-md text-sm text-neutral-600">
            Organize catalog categories, brand origins, and visual portals.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 self-start bg-black px-5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-neutral-800 sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          {addLabel}
        </button>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        className="-mx-5 flex items-center gap-1 overflow-x-auto border-b border-black px-5 sm:mx-0 sm:px-0"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px inline-flex shrink-0 cursor-pointer items-center gap-2 border border-b-0 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                active
                  ? 'border-black bg-black text-white'
                  : 'border-transparent bg-transparent text-neutral-500 hover:text-black'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>
                {tab.label}{' '}
                <span className="tabular-nums opacity-60">({tab.count})</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeTab === 'liquor-cat' &&
          taxonomy.liquorCategories.map((cat) => renderCategoryCard(cat))}

        {activeTab === 'grocery-cat' &&
          taxonomy.groceryCategories.map((cat) => renderCategoryCard(cat))}

        {activeTab === 'brands' &&
          taxonomy.liquorBrands.map((brand) => (
            <div
              key={brand.id}
              className="flex flex-col justify-between gap-5 border border-black bg-white p-5"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-lg font-black uppercase leading-tight tracking-tight">
                    {brand.name}
                  </div>
                  {brand.origin && (
                    <span className="shrink-0 border border-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      {brand.origin}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-neutral-400">
                  /{brand.slug}
                </div>
                {brand.description && (
                  <p className="mt-3 line-clamp-2 text-sm text-neutral-600">
                    {brand.description}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end border-t border-black/10 pt-3">
                <CardActions
                  name={brand.name}
                  onEdit={() => openEditModal(brand)}
                  onDelete={() => handleDelete(brand.id, brand.name)}
                />
              </div>
            </div>
          ))}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={modalTitle}
        >
          <div className="relative my-8 w-full max-w-lg border-2 border-black bg-white p-6 text-[#101010] shadow-[8px_8px_0_0_#000] sm:p-8">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 grid h-9 w-9 cursor-pointer place-items-center border-0 bg-transparent transition-colors hover:bg-neutral-100"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="mb-7 pr-8 text-3xl font-black uppercase leading-none tracking-tighter">
              {modalTitle}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="tax-name" className={labelCls}>
                  Name *
                </label>
                <input
                  id="tax-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Single Malt Whiskey or Old Durbar"
                  className={fieldCls}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="tax-slug" className={labelCls}>
                    Slug (Optional)
                  </label>
                  <input
                    id="tax-slug"
                    type="text"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="auto-derived"
                    className={`${fieldCls} font-mono`}
                  />
                </div>

                {activeTab === 'brands' ? (
                  <div>
                    <label htmlFor="tax-origin" className={labelCls}>
                      Origin Country
                    </label>
                    <input
                      id="tax-origin"
                      type="text"
                      value={formOrigin}
                      onChange={(e) => setFormOrigin(e.target.value)}
                      placeholder="e.g. Nepal, Scotland"
                      className={fieldCls}
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="tax-sort" className={labelCls}>
                      Sort Order
                    </label>
                    <input
                      id="tax-sort"
                      type="number"
                      value={formSortOrder}
                      onChange={(e) => setFormSortOrder(Number(e.target.value))}
                      className={`${fieldCls} tabular-nums`}
                    />
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="tax-img" className={labelCls}>
                  Image or Logo URL
                </label>
                <input
                  id="tax-img"
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://..."
                  className={fieldCls}
                />
              </div>

              <div>
                <label htmlFor="tax-desc" className={labelCls}>
                  Description
                </label>
                <textarea
                  id="tax-desc"
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief overview..."
                  className="w-full border border-black/30 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-neutral-400 focus:border-black focus:shadow-[3px_3px_0_0_#000]"
                />
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
                  {isSubmitting ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
