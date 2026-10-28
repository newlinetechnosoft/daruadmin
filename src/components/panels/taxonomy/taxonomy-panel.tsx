import { useState, useRef } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import {
  upsertCategoryFn,
  upsertBrandFn,
  deleteItemFn,
  createImageUploadFn,
} from '#/server/catalog/catalog.functions'
import { compressImage } from '#/lib/image-compression'
import { adminQueries } from '#/queries/admin'
import {
  Wine,
  ShoppingBag,
  Award,
  Plus,
  Edit2,
  Trash2,
  UploadCloud,
  X,
  Loader2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '#/components/shared/page-header'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { Badge } from '#/components/ui/badge'
import { Checkbox } from '#/components/ui/checkbox'
import { Card, CardContent, CardFooter } from '#/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'

type ActiveTab = 'liquor-cat' | 'grocery-cat' | 'brands'

interface CategoryLike {
  id: string
  name: string
  slug: string
  description?: string | null
  imageUrl?: string | null
  sortOrder?: number | null
  isActive?: boolean
  productCount?: number
}

interface BrandLike {
  id: string
  name: string
  slug: string
  origin?: string | null
  description?: string | null
  logoUrl?: string | null
  isActive?: boolean
  productCount?: number
}

export function TaxonomyPanel() {
  const queryClient = useQueryClient()
  const { data: taxonomy } = useSuspenseQuery(adminQueries.taxonomy())

  const [activeTab, setActiveTab] = useState<ActiveTab>('liquor-cat')

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Generic Form State
  const [formName, setFormName] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formImageUrl, setFormImageUrl] = useState('')
  const [formOrigin, setFormOrigin] = useState('Nepal')
  const [formSortOrder, setFormSortOrder] = useState(0)
  const [formIsActive, setFormIsActive] = useState(true)

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    name: string
    productCount?: number
  } | null>(null)

  const openAddModal = () => {
    setEditingId(null)
    setFormName('')
    setFormSlug('')
    setFormDescription('')
    setFormImageUrl('')
    setFormOrigin('Nepal')
    setFormSortOrder(0)
    setFormIsActive(true)
    setModalOpen(true)
  }

  const openEditModal = (item: CategoryLike | BrandLike | any) => {
    setEditingId(item.id)
    setFormName(item.name)
    setFormSlug(item.slug)
    setFormDescription(item.description ?? '')
    setFormImageUrl(item.imageUrl ?? item.logoUrl ?? '')
    setFormOrigin(item.origin ?? 'Nepal')
    setFormSortOrder(item.sortOrder ?? 0)
    setFormIsActive(item.isActive !== false)
    setModalOpen(true)
  }

  const handleImageFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingImage(true)
    try {
      const compressed = await compressImage(file, {
        maxWidth: 1000,
        maxHeight: 1000,
        quality: 0.85,
        format: 'image/webp',
      })

      const { uploadUrl, publicUrl } = await createImageUploadFn({
        data: {
          filename: `${file.name.replace(/\.[^/.]+$/, '')}.webp`,
          contentType: 'image/webp',
          prefix: activeTab === 'brands' ? 'brands' : 'categories',
        },
      })

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: compressed.blob,
        headers: {
          'Content-Type': 'image/webp',
        },
      })

      if (!uploadRes.ok) {
        throw new Error('Failed to upload image to storage')
      }

      setFormImageUrl(publicUrl)
      toast.success('Image uploaded successfully')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload image')
    } finally {
      setIsUploadingImage(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
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
            isActive: formIsActive,
          },
        })
        toast.success(
          editingId ? 'Liquor category updated' : 'Liquor category created',
        )
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
            isActive: formIsActive,
          },
        })
        toast.success(
          editingId ? 'Grocery category updated' : 'Grocery category created',
        )
      } else {
        await upsertBrandFn({
          data: {
            id: editingId ?? undefined,
            name: formName.trim(),
            slug: formSlug.trim() || undefined,
            origin: formOrigin.trim() || null,
            description: formDescription.trim() || null,
            logoUrl: formImageUrl.trim() || null,
            isActive: formIsActive,
          },
        })
        toast.success(editingId ? 'Brand updated' : 'Brand created')
      }

      setModalOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'taxonomy'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'liquor'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'grocery'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog'] })
      await queryClient.invalidateQueries({ queryKey: ['storefront'] })
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
      toast.success(`${deleteTarget.name} deleted successfully`)
      setDeleteTarget(null)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'taxonomy'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'liquor'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'grocery'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog'] })
      await queryClient.invalidateQueries({ queryKey: ['storefront'] })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete item')
    }
  }

  const tabs: {
    id: ActiveTab
    label: string
    count: number
    icon: LucideIcon
  }[] = [
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
    <Card
      key={cat.id}
      className="flex flex-col justify-between overflow-hidden border-border transition-all hover:shadow-sm"
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {cat.imageUrl ? (
            <img
              src={cat.imageUrl}
              alt={cat.name}
              className="h-12 w-12 shrink-0 rounded-md bg-muted object-cover border border-border"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground border border-border">
              {activeTab === 'liquor-cat' ? (
                <Wine className="h-5 w-5" />
              ) : (
                <ShoppingBag className="h-5 w-5" />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-foreground truncate">
                {cat.name}
              </div>
              <Badge
                variant={cat.isActive !== false ? 'default' : 'secondary'}
                className="text-[10px] px-1.5 py-0 h-4 font-normal shrink-0"
              >
                {cat.isActive !== false ? 'Active' : 'Inactive'}
              </Badge>
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

      <CardFooter className="flex items-center justify-between border-t border-border/50 px-4 py-2.5 bg-muted/20">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] font-mono px-1.5 py-0 h-4"
          >
            {cat.productCount ?? 0}{' '}
            {cat.productCount === 1 ? 'product' : 'products'}
          </Badge>
          <span className="font-mono text-[11px] text-muted-foreground">
            Order {cat.sortOrder ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEditModal(cat)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Edit category"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setDeleteTarget({
                id: cat.id,
                name: cat.name,
                productCount: cat.productCount ?? 0,
              })
            }
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Delete category"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  )

  const renderBrandCard = (brand: BrandLike) => (
    <Card
      key={brand.id}
      className="flex flex-col justify-between overflow-hidden border-border transition-all hover:shadow-sm"
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {brand.logoUrl ? (
            <img
              src={brand.logoUrl}
              alt={brand.name}
              className="h-12 w-12 shrink-0 rounded-md bg-muted object-cover border border-border"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground border border-border">
              <Award className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-foreground truncate">
                {brand.name}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {brand.origin && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal px-1.5 py-0 h-4"
                  >
                    {brand.origin}
                  </Badge>
                )}
                <Badge
                  variant={brand.isActive !== false ? 'default' : 'secondary'}
                  className="text-[10px] px-1.5 py-0 h-4 font-normal"
                >
                  {brand.isActive !== false ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">
              /{brand.slug}
            </div>
            {brand.description && (
              <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                {brand.description}
              </p>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t border-border/50 px-4 py-2.5 bg-muted/20">
        <Badge
          variant="outline"
          className="text-[10px] font-mono px-1.5 py-0 h-4"
        >
          {brand.productCount ?? 0}{' '}
          {brand.productCount === 1 ? 'product' : 'products'}
        </Badge>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEditModal(brand)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Edit brand"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setDeleteTarget({
                id: brand.id,
                name: brand.name,
                productCount: brand.productCount ?? 0,
              })
            }
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Delete brand"
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
          <Button
            size="sm"
            onClick={openAddModal}
            className="h-8 gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </Button>
        }
      />

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as ActiveTab)}
      >
        <TabsList className="h-9">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="gap-2 text-xs"
              >
                <Icon className="h-3.5 w-3.5" />
                <span>
                  {tab.label}{' '}
                  <span className="tabular-nums opacity-60">({tab.count})</span>
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
          taxonomy.liquorBrands.map((brand) => renderBrandCard(brand))}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg md:max-w-xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col h-full min-h-0"
          >
            <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-muted/10">
              <DialogTitle className="text-sm font-semibold capitalize">
                {modalTitle}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 click-scroll">
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="tax-img" className="text-xs">
                    {activeTab === 'brands' ? 'Brand Logo' : 'Category Image'}
                  </Label>
                  <label className="cursor-pointer text-xs text-primary hover:underline font-medium flex items-center gap-1">
                    {isUploadingImage ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-3 w-3" />
                        <span>Upload file</span>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageFileUpload}
                      disabled={isUploadingImage}
                    />
                  </label>
                </div>
                <Input
                  id="tax-img"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://... or upload from disk"
                  className="h-8 text-xs font-mono"
                />
                {formImageUrl && (
                  <div className="relative mt-2 inline-block">
                    <img
                      src={formImageUrl}
                      alt="Preview"
                      className="h-16 w-16 rounded-md object-cover border border-border bg-muted"
                    />
                    <button
                      type="button"
                      onClick={() => setFormImageUrl('')}
                      className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground p-0.5 shadow-sm hover:opacity-90"
                      title="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
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

              <div className="flex items-center gap-2 border-t border-border pt-3">
                <Checkbox
                  id="tax-is-active"
                  checked={formIsActive}
                  onCheckedChange={(checked) =>
                    setFormIsActive(Boolean(checked))
                  }
                />
                <Label
                  htmlFor="tax-is-active"
                  className="text-xs cursor-pointer font-normal"
                >
                  Active on storefront
                </Label>
              </div>
            </div>

            <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || isUploadingImage}
              >
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
        title={`Delete ${activeTab === 'brands' ? 'Brand' : 'Category'}`}
        description={
          deleteTarget?.productCount && deleteTarget.productCount > 0
            ? activeTab === 'brands'
              ? `Are you sure you want to delete "${deleteTarget.name}"? Its ${deleteTarget.productCount} associated product${deleteTarget.productCount > 1 ? 's' : ''} will remain in the catalog, but will have their brand unassigned.`
              : `Warning: "${deleteTarget.name}" currently contains ${deleteTarget.productCount} product${deleteTarget.productCount > 1 ? 's' : ''}. Deleting this category will cascade and permanently remove all associated products, variants, and stock. Are you sure you want to proceed?`
            : `Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`
        }
        confirmLabel={
          deleteTarget?.productCount &&
          deleteTarget.productCount > 0 &&
          activeTab !== 'brands'
            ? 'Delete category and all products'
            : 'Delete'
        }
        tone="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
