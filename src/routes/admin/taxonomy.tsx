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
  Wine,
  ShoppingBag,
  Award,
  Plus,
  Edit2,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '#/components/shared/page-header'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardFooter } from '#/components/ui/card'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '#/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'

export const Route = createFileRoute('/admin/taxonomy')({
  loader: async () => {
    const taxonomy = await getAllTaxonomyFn()
    return { taxonomy }
  },
  component: AdminTaxonomyPage,
})

type ActiveTab = 'liquor-cat' | 'grocery-cat' | 'brands'

interface CategoryLike {
  id: string
  name: string
  slug: string
  description?: string | null
  imageUrl?: string | null
  sortOrder?: number | null
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

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

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

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

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
          id: deleteTarget.id,
        },
      })
      toast.success('Deleted successfully')
      setDeleteTarget(null)
      await router.invalidate()
    } catch {
      toast.error('Failed to delete item')
    }
  }

  const tabs: { id: ActiveTab; label: string; count: number; icon: LucideIcon }[] = [
    {
      id: 'liquor-cat',
      label: 'Liquor categories',
      count: taxonomy.liquorCategories.length,
      icon: Wine,
    },
    {
      id: 'grocery-cat',
      label: 'Grocery categories',
      count: taxonomy.groceryCategories.length,
      icon: ShoppingBag,
    },
    {
      id: 'brands',
      label: 'Brands and distilleries',
      count: taxonomy.liquorBrands.length,
      icon: Award,
    },
  ]

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

  const renderCategoryCard = (cat: CategoryLike) => (
    <Card key={cat.id} className="flex flex-col justify-between">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {cat.imageUrl && (
            <img
              src={cat.imageUrl}
              alt={cat.name}
              className="h-12 w-12 shrink-0 rounded-md bg-muted object-cover border border-border"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-foreground">
              {cat.name}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">
              /{cat.slug}
            </div>
            {cat.description && (
              <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                {cat.description}
              </p>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t border-border/50 px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted-foreground">
          Order {cat.sortOrder ?? 0}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEditModal(cat)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteTarget({ id: cat.id, name: cat.name })}
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Catalog"
        title="Taxonomy and categories"
        description="Organize catalog categories, brand origins, and visual portals."
        actions={
          <Button size="sm" onClick={openAddModal} className="h-8 gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </Button>
        }
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as ActiveTab)}>
        <TabsList className="h-9">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2 text-xs">
                <Icon className="h-3.5 w-3.5" />
                <span>
                  {tab.label} <span className="tabular-nums opacity-60">({tab.count})</span>
                </span>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeTab === 'liquor-cat' &&
          taxonomy.liquorCategories.map((cat) => renderCategoryCard(cat))}

        {activeTab === 'grocery-cat' &&
          taxonomy.groceryCategories.map((cat) => renderCategoryCard(cat))}

        {activeTab === 'brands' &&
          taxonomy.liquorBrands.map((brand) => (
            <Card key={brand.id} className="flex flex-col justify-between">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs font-semibold text-foreground">
                    {brand.name}
                  </div>
                  {brand.origin && (
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {brand.origin}
                    </Badge>
                  )}
                </div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  /{brand.slug}
                </div>
                {brand.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {brand.description}
                  </p>
                )}
              </CardContent>

              <CardFooter className="flex items-center justify-end border-t border-border/50 px-4 py-2.5">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditModal(brand)}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget({ id: brand.id, name: brand.name })}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold capitalize">{modalTitle}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="tax-name" className="text-xs">
                Name *
              </Label>
              <Input
                id="tax-name"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Single Malt Whiskey or Old Durbar"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tax-slug" className="text-xs">
                  Slug (optional)
                </Label>
                <Input
                  id="tax-slug"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="auto-derived"
                  className="h-8 font-mono text-xs"
                />
              </div>

              {activeTab === 'brands' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="tax-origin" className="text-xs">
                    Origin country
                  </Label>
                  <Input
                    id="tax-origin"
                    value={formOrigin}
                    onChange={(e) => setFormOrigin(e.target.value)}
                    placeholder="e.g. Nepal, Scotland"
                    className="h-8 text-xs"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="tax-sort" className="text-xs">
                    Sort order
                  </Label>
                  <Input
                    id="tax-sort"
                    type="number"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(Number(e.target.value))}
                    className="h-8 font-mono text-xs"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tax-img" className="text-xs">
                Image or logo URL
              </Label>
              <Input
                id="tax-img"
                type="url"
                value={formImageUrl}
                onChange={(e) => setFormImageUrl(e.target.value)}
                placeholder="https://..."
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tax-desc" className="text-xs">
                Description
              </Label>
              <Textarea
                id="tax-desc"
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief overview..."
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs">
                {isSubmitting ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete item"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
