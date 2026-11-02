import { useState, useMemo, useRef } from 'react'
import type { FormEvent } from 'react'
import {
  useSuspenseQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import {
  upsertGroceryProductFn,
  toggleProductStatusFn,
  deleteItemFn,
  deleteProductImageFn,
} from '#/server/catalog/catalog.functions'
import { ImageUploader } from '#/components/shared/image-uploader'
import type {
  ImageUploaderRef,
  ExistingImageItem,
} from '#/components/shared/image-uploader'
import { formatNPR, toPaisa, toRupees } from '#/lib/money'
import {
  Search,
  Plus,
  Sparkles,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Store,
} from 'lucide-react'
import { toast } from 'sonner'
import { BrandDialog } from '#/components/panels/brands'
import type { BrandData } from '#/components/panels/brands'
import { DealerDialog } from '#/components/panels/dealers'
import { can } from '#/server/auth/permissions-shared'
import { PageHeader } from '#/components/shared/page-header'
import { DataRefreshButton } from '#/components/shared/data-refresh-button'
import { DataSection } from '#/components/shared/data-section'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { Badge } from '#/components/ui/badge'
import { Checkbox } from '#/components/ui/checkbox'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
import { EmptyState } from '#/components/shared/empty-state'

interface GroceryVariantItem {
  id?: string
  name: string
  unit: string
  quantity: string
  sku: string
  price: number
  mrp?: number
  stock: number
  isActive: boolean
}

export function GroceryPanel() {
  const queryClient = useQueryClient()
  const {
    data: products,
    isFetching,
    refetch,
  } = useSuspenseQuery(adminQueries.groceryProducts())
  const { data: taxonomy } = useSuspenseQuery(adminQueries.taxonomy())
  const { data: access } = useSuspenseQuery(adminQueries.access())

  const grants = access.authenticated ? access.grants : null
  const canCreateBrand = can(grants, 'brands', 'create')
  const canEditBrand = can(grants, 'brands', 'edit')
  const canDeleteBrand = can(grants, 'brands', 'delete')

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedBrand, setSelectedBrand] = useState('all')

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    name: string
  } | null>(null)

  // Brand Dialog & CRUD state
  const [brandDialogOpen, setBrandDialogOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState<BrandData | null>(null)
  const [deleteBrandTarget, setDeleteBrandTarget] = useState<BrandData | null>(
    null,
  )

  const handleDeleteBrand = async () => {
    if (!deleteBrandTarget) return
    try {
      await deleteItemFn({
        data: {
          catalogType: 'grocery-brand',
          id: deleteBrandTarget.id,
        },
      })
      toast.success(`Brand "${deleteBrandTarget.name}" deleted`)
      if (formBrandId === deleteBrandTarget.id) {
        setFormBrandId('')
      }
      setDeleteBrandTarget(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'taxonomy'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'grocery'] }),
      ])
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete brand')
    }
  }

  // Form State
  const [formName, setFormName] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formBrandId, setFormBrandId] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formImageUrl, setFormImageUrl] = useState('')
  const imageUploaderRef = useRef<ImageUploaderRef>(null)
  const [existingImagesList, setExistingImagesList] = useState<
    ExistingImageItem[]
  >([])
  const [formIsFeatured, setFormIsFeatured] = useState(false)
  const [formCustomBadge, setFormCustomBadge] = useState('')
  const [formCustomDiscountLabel, setFormCustomDiscountLabel] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)
  const { data: dealersData } = useQuery(adminQueries.dealers())
  const dealersList = dealersData?.dealers ?? []
  const [formDealerIds, setFormDealerIds] = useState<string[]>([])
  const [dealerDialogOpen, setDealerDialogOpen] = useState(false)

  const [formVariants, setFormVariants] = useState<GroceryVariantItem[]>([
    {
      name: 'Standard Pack',
      unit: 'pack',
      quantity: '1.00',
      sku: '',
      price: 150,
      mrp: 180,
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
        (p as any).brandSlug !== selectedBrand
      ) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = p.name.toLowerCase().includes(q)
        const matchesCat = p.categoryName.toLowerCase().includes(q)
        const matchesBrand = (p as any).brandName?.toLowerCase().includes(q)
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
    setFormCategoryId(taxonomy.groceryCategories[0]?.id ?? '')
    setFormBrandId('')
    setFormDescription('')
    setFormImageUrl('')
    setExistingImagesList([])
    imageUploaderRef.current?.discardDrafts()
    setFormIsFeatured(false)
    setFormCustomBadge('')
    setFormCustomDiscountLabel('')
    setFormIsActive(true)
    setFormDealerIds([])
    setFormVariants([
      {
        name: 'Standard Pack',
        unit: 'pack',
        quantity: '1.00',
        sku: 'GROC-' + Math.floor(1000 + Math.random() * 9000),
        price: 150,
        mrp: 180,
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
    setFormBrandId((p as any).brandId ?? '')
    setFormDescription(p.description ?? '')
    setFormImageUrl(p.primaryImage ?? '')
    setFormIsFeatured(p.isFeatured)
    setFormCustomBadge((p as any).customBadge ?? '')
    setFormCustomDiscountLabel((p as any).customDiscountLabel ?? '')
    setFormIsActive(p.isActive)
    setFormDealerIds((p as any).dealerIds || [])
    const imgs =
      (p as any).images && (p as any).images.length > 0
        ? (p as any).images
        : p.primaryImage
          ? [{ url: p.primaryImage, isPrimary: true, sortOrder: 0 }]
          : []
    setExistingImagesList(imgs)
    setFormVariants(
      p.variants.map((v) => ({
        id: v.id,
        name: v.name,
        unit: v.unit,
        quantity: v.quantity,
        sku: v.sku,
        price: toRupees(v.price),
        mrp: v.mrp ? toRupees(v.mrp) : undefined,
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
        name: 'Pack of 2',
        unit: 'pack',
        quantity: '2.00',
        sku: 'GROC-' + Math.floor(1000 + Math.random() * 9000),
        price: 280,
        mrp: 320,
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
      toast.error('Item name is required')
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
      const uploadedImages = imageUploaderRef.current
        ? await imageUploaderRef.current.uploadStagedAndGetAll()
        : []

      const primaryImg =
        uploadedImages.find((img) => img.isPrimary)?.url ||
        uploadedImages[0]?.url ||
        formImageUrl.trim() ||
        null

      await upsertGroceryProductFn({
        data: {
          id: editingId ?? undefined,
          name: formName.trim(),
          slug: formSlug.trim() || undefined,
          categoryId: formCategoryId,
          brandId: formBrandId || null,
          description: formDescription.trim() || null,
          imageUrl: primaryImg,
          images: uploadedImages,
          isFeatured: formIsFeatured,
          customBadge: formCustomBadge.trim() || null,
          customDiscountLabel: formCustomDiscountLabel.trim() || null,
          isActive: formIsActive,
          dealerIds: formDealerIds,
          variants: formVariants.map((v) => ({
            id: v.id,
            name: v.name.trim(),
            unit: v.unit.trim() || 'pack',
            quantity: String(v.quantity || '1.00'),
            sku: v.sku.trim() || `GROC-${Date.now()}`,
            price: toPaisa(v.price),
            mrp: v.mrp ? toPaisa(v.mrp) : null,
            stock: Number(v.stock),
            isActive: v.isActive,
          })),
        },
      })

      toast.success(
        editingId ? 'Grocery item updated!' : 'Grocery item created!',
      )
      setModalOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'grocery'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'taxonomy'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'dealers'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog'] })
      await queryClient.invalidateQueries({ queryKey: ['storefront'] })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save grocery product')
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
          catalogType: 'grocery',
          id,
          field,
          value: !currentVal,
        },
      })
      toast.success('Updated status')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'grocery'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog'] })
      await queryClient.invalidateQueries({ queryKey: ['storefront'] })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status')
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteItemFn({
        data: {
          catalogType: 'grocery',
          id: deleteTarget.id,
        },
      })
      toast.success('Grocery product deleted')
      setDeleteTarget(null)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'grocery'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'taxonomy'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] })
      await queryClient.invalidateQueries({ queryKey: ['catalog'] })
      await queryClient.invalidateQueries({ queryKey: ['storefront'] })
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete grocery product')
    }
  }

  const updateVariant = (i: number, patch: Partial<GroceryVariantItem>) =>
    setFormVariants((prev) =>
      prev.map((item, idx) => (idx === i ? { ...item, ...patch } : item)),
    )

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Catalog"
        title="Grocery"
        description="Manage grocery items, pantry staples, and daily essentials."
        actions={
          <div className="flex items-center gap-2">
            <DataRefreshButton
              queryKeys={[
                adminQueries.groceryProducts().queryKey,
                adminQueries.taxonomy().queryKey,
              ]}
              onRefresh={() => refetch()}
              isRefreshing={isFetching}
              variant="button"
            />
            <Badge variant="secondary" className="font-mono text-xs">
              {products.length} SKUs
            </Badge>
            <Button
              size="sm"
              onClick={openAddModal}
              className="h-9 px-4 gap-2 text-xs sm:text-sm font-semibold shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add grocery SKU
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search grocery products by name, brand, or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full sm:w-44 h-9 text-xs"
          >
            <NativeSelectOption value="all">
              All categories ({taxonomy.groceryCategories.length})
            </NativeSelectOption>
            {taxonomy.groceryCategories.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="w-full sm:w-40 h-9 text-xs"
          >
            <NativeSelectOption value="all">
              All brands ({taxonomy.groceryBrands.length})
            </NativeSelectOption>
            {taxonomy.groceryBrands.map((b) => (
              <NativeSelectOption key={b.id} value={b.id}>
                {b.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      {/* Table */}
      <DataSection isRefreshing={isFetching}>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-12 text-xs">Image</TableHead>
                <TableHead className="text-xs">Product</TableHead>
                <TableHead className="text-xs">Category & Brand</TableHead>
                <TableHead className="text-xs">Variants & Stock</TableHead>
                <TableHead className="text-xs text-right">Price (NPR)</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
                <TableHead className="text-xs text-center">Featured</TableHead>
                <TableHead className="w-20 text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-8">
                    <EmptyState
                      icon={Store}
                      title="No grocery items found"
                      description={
                        searchQuery || selectedCategory !== 'all'
                          ? 'Try adjusting your search or filters.'
                          : 'Get started by creating your first grocery product.'
                      }
                      action={
                        <Button size="sm" onClick={openAddModal} className="h-8 text-xs">
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Add grocery SKU
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((p) => {
                  const minPrice = p.variants.reduce(
                    (min, v) => Math.min(min, v.price),
                    Infinity,
                  )
                  const maxPrice = p.variants.reduce(
                    (max, v) => Math.max(max, v.price),
                    -Infinity,
                  )
                  const totalStock = p.variants.reduce(
                    (sum, v) => sum + v.stock,
                    0,
                  )

                  return (
                    <TableRow key={p.id} className="group hover:bg-muted/20">
                      <TableCell className="py-2.5">
                        <div className="h-10 w-10 rounded-md border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
                          {p.primaryImage ? (
                            <img
                              src={p.primaryImage}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Store className="h-5 w-5 text-muted-foreground/40" />
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="py-2.5">
                        <div className="font-medium text-xs sm:text-sm text-foreground">
                          {p.name}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          /{p.slug}
                        </div>
                        {(p as any).customBadge && (
                          <span className="inline-block mt-0.5 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded font-medium">
                            {(p as any).customBadge}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="py-2.5">
                        <div className="text-xs font-medium">
                          {p.categoryName}
                        </div>
                        {(p as any).brandName && (
                          <div className="text-xs text-muted-foreground">
                            {(p as any).brandName}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {p.variants.map((v) => (
                            <span
                              key={v.id}
                              className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 font-mono text-xs"
                            >
                              <span>
                                {v.quantity} {v.unit}
                              </span>
                              <span className="text-muted-foreground">·</span>
                              <span
                                className={
                                  v.stock <= 5
                                    ? 'text-destructive font-semibold'
                                    : 'text-muted-foreground'
                                }
                              >
                                {v.stock} in stock
                              </span>
                            </span>
                          ))}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Total stock: {totalStock}
                        </div>
                      </TableCell>

                      <TableCell className="py-2.5 text-right font-mono text-xs">
                        {minPrice === Infinity ? (
                          '—'
                        ) : minPrice === maxPrice ? (
                          formatNPR(minPrice)
                        ) : (
                          <>
                            {formatNPR(minPrice)} – {formatNPR(maxPrice)}
                          </>
                        )}
                      </TableCell>

                      <TableCell className="py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleStatus(p.id, 'isActive', p.isActive)
                          }
                          className="inline-flex items-center transition-opacity hover:opacity-80"
                          title="Click to toggle active status"
                        >
                          {p.isActive ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground/40" />
                          )}
                        </button>
                      </TableCell>

                      <TableCell className="py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleStatus(p.id, 'isFeatured', p.isFeatured)
                          }
                          className="inline-flex items-center transition-opacity hover:opacity-80"
                          title="Click to toggle featured status"
                        >
                          <Sparkles
                            className={`h-4 w-4 ${
                              p.isFeatured
                                ? 'text-amber-500 fill-amber-500'
                                : 'text-muted-foreground/30'
                            }`}
                          />
                        </button>
                      </TableCell>

                      <TableCell className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(p)}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDeleteTarget({ id: p.id, name: p.name })
                            }
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DataSection>

      {/* Add / Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-3xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col h-full min-h-0"
          >
            <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-muted/10">
              <DialogTitle className="text-base sm:text-lg font-semibold">
                {editingId ? 'Edit Grocery Item' : 'New Grocery Item'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure details, pricing, packaging variants, and stock
                levels.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5 click-scroll">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="groc-name" className="text-xs font-semibold">
                    Product Name *
                  </Label>
                  <Input
                    id="groc-name"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Basmati Rice 5kg or Organic Green Tea"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="groc-cat" className="text-xs font-semibold">
                    Category *
                  </Label>
                  <NativeSelect
                    id="groc-cat"
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="h-8 text-xs"
                  >
                    <NativeSelectOption value="" disabled>
                      Select category...
                    </NativeSelectOption>
                    {taxonomy.groceryCategories.map((c) => (
                      <NativeSelectOption key={c.id} value={c.id}>
                        {c.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="groc-brand"
                      className="text-xs font-semibold"
                    >
                      Brand (optional)
                    </Label>
                    {canCreateBrand && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-xs text-primary hover:text-primary/80 gap-1 font-normal"
                        onClick={() => {
                          setEditingBrand(null)
                          setBrandDialogOpen(true)
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        New Brand
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <NativeSelect
                      id="groc-brand"
                      value={formBrandId}
                      onChange={(e) => setFormBrandId(e.target.value)}
                      className="h-8 text-xs flex-1"
                    >
                      <NativeSelectOption value="">
                        None / Unbranded
                      </NativeSelectOption>
                      {taxonomy.groceryBrands.map((b) => (
                        <NativeSelectOption key={b.id} value={b.id}>
                          {b.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    {formBrandId && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {canEditBrand && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            title="Edit selected brand"
                            onClick={() => {
                              const found = taxonomy.groceryBrands.find(
                                (b) => b.id === formBrandId,
                              )
                              if (found) {
                                setEditingBrand(found)
                                setBrandDialogOpen(true)
                              }
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDeleteBrand && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                            title="Delete selected brand"
                            onClick={() => {
                              const found = taxonomy.groceryBrands.find(
                                (b) => b.id === formBrandId,
                              )
                              if (found) {
                                setDeleteBrandTarget(found)
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="groc-slug" className="text-xs">
                  URL slug (optional)
                </Label>
                <Input
                  id="groc-slug"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="auto-generated-from-name"
                  className="h-8 font-mono text-xs"
                />
              </div>

              {/* Supplying Dealers Selection */}
              <div className="space-y-2 border-t border-border/60 pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5 text-emerald-600" />
                      Supplying Dealers
                    </Label>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      Select dealers who supply and fulfill this grocery item.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => setDealerDialogOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                    New Dealer
                  </Button>
                </div>

                {dealersList.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic p-2.5 rounded-lg border border-dashed bg-muted/20">
                    No dealers registered yet. Click &ldquo;New Dealer&rdquo; to
                    add a supplier.
                  </div>
                ) : (
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-border p-2 space-y-1.5 bg-muted/10">
                    {dealersList.map((d) => {
                      const isSelected = formDealerIds.includes(d.id)
                      return (
                        <div
                          key={d.id}
                          onClick={() => {
                            setFormDealerIds((prev) =>
                              isSelected
                                ? prev.filter((id) => id !== d.id)
                                : [...prev, d.id],
                            )
                          }}
                          className={`flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground font-medium'
                              : 'border-transparent hover:bg-muted/60 text-muted-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => {
                                setFormDealerIds((prev) =>
                                  isSelected
                                    ? prev.filter((id) => id !== d.id)
                                    : [...prev, d.id],
                                )
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="truncate">{d.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-xs">
                            {d.pan && (
                              <span className="font-mono text-muted-foreground">
                                PAN: {d.pan}
                              </span>
                            )}
                            <span className="text-muted-foreground">
                              {d.city}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {formDealerIds.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge
                      variant="secondary"
                      className="text-xs py-0 px-2 h-5"
                    >
                      {formDealerIds.length}{' '}
                      {formDealerIds.length === 1 ? 'dealer' : 'dealers'}{' '}
                      selected
                    </Badge>
                    <span>assigned to fulfill this product</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="groc-desc" className="text-xs">
                  Description
                </Label>
                <Textarea
                  id="groc-desc"
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Short description or notes..."
                  className="text-xs"
                />
              </div>

              {/* Product Images (Neon Cloud Storage) */}
              <div className="space-y-2 border-t border-border/60 pt-3">
                <Label className="text-xs font-semibold">Product Images</Label>
                <ImageUploader
                  ref={imageUploaderRef}
                  draftKey={`grocery-${editingId || 'new'}`}
                  existingImages={existingImagesList}
                  onDeleteExisting={async (img) => {
                    if (img.id) {
                      await deleteProductImageFn({
                        data: {
                          catalogType: 'grocery',
                          imageId: img.id,
                          imageUrl: img.url,
                        },
                      })
                      await queryClient.invalidateQueries({
                        queryKey: ['admin', 'grocery'],
                      })
                    }
                  }}
                  prefix="products/grocery"
                />
              </div>

              {/* Flags & Badges */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 border-t border-border/60 pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="groc-badge" className="text-xs">
                    Custom Badge (e.g. &apos;Organic&apos;, &apos;Fresh&apos;)
                  </Label>
                  <Input
                    id="groc-badge"
                    value={formCustomBadge}
                    onChange={(e) => setFormCustomBadge(e.target.value)}
                    placeholder="None"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="groc-discount-lbl" className="text-xs">
                    Custom Discount Label
                  </Label>
                  <Input
                    id="groc-discount-lbl"
                    value={formCustomDiscountLabel}
                    onChange={(e) => setFormCustomDiscountLabel(e.target.value)}
                    placeholder="e.g. 10% OFF"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 border-t border-border/60 pt-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <Checkbox
                    checked={formIsActive}
                    onCheckedChange={(c) => setFormIsActive(Boolean(c))}
                  />
                  <span>Published / Active</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <Checkbox
                    checked={formIsFeatured}
                    onCheckedChange={(c) => setFormIsFeatured(Boolean(c))}
                  />
                  <span>Featured product</span>
                </label>
              </div>

              {/* Variants Section */}
              <div className="space-y-3 border-t border-border/60 pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">
                      Packaging Variants & Pricing *
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Define packaging size (e.g. 500g, 1kg, 5kg), SKU, price,
                      and inventory stock.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddVariantRow}
                    className="h-7 px-2 text-xs gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add variant
                  </Button>
                </div>

                <div className="space-y-2">
                  {formVariants.map((v, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-2 sm:grid-cols-12 gap-2 p-2.5 rounded-lg border border-border bg-muted/10 items-center"
                    >
                      <div className="sm:col-span-3">
                        <Input
                          placeholder="Variant Name (e.g. 1 kg)"
                          value={v.name}
                          onChange={(e) =>
                            updateVariant(i, { name: e.target.value })
                          }
                          className="h-7 text-xs"
                          required
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <Input
                          placeholder="Unit (pack/kg/g)"
                          value={v.unit}
                          onChange={(e) =>
                            updateVariant(i, { unit: e.target.value })
                          }
                          className="h-7 text-xs"
                          required
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <Input
                          placeholder="SKU"
                          value={v.sku}
                          onChange={(e) =>
                            updateVariant(i, { sku: e.target.value })
                          }
                          className="h-7 font-mono text-xs"
                          required
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <Input
                          type="number"
                          placeholder="Price"
                          value={v.price}
                          onChange={(e) =>
                            updateVariant(i, { price: Number(e.target.value) })
                          }
                          className="h-7 font-mono text-xs"
                          required
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <Input
                          type="number"
                          placeholder="MRP"
                          value={v.mrp ?? ''}
                          onChange={(e) =>
                            updateVariant(i, {
                              mrp: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            })
                          }
                          className="h-7 font-mono text-xs"
                          title="Original / strike-through MRP (Rs.)"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <Input
                          type="number"
                          placeholder="Stock"
                          value={v.stock}
                          onChange={(e) =>
                            updateVariant(i, { stock: Number(e.target.value) })
                          }
                          className="h-7 font-mono text-xs"
                        />
                      </div>

                      <div className="col-span-2 flex justify-end sm:col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveVariantRow(i)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
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
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting
                  ? 'Saving...'
                  : editingId
                    ? 'Update item'
                    : 'Create item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete grocery item"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={handleConfirmDelete}
      />

      {/* Brand Dialog for Inline Create/Edit */}
      <BrandDialog
        open={brandDialogOpen}
        onOpenChange={setBrandDialogOpen}
        catalogType="grocery"
        brand={editingBrand}
        onSuccess={(saved) => {
          if (saved.id) {
            setFormBrandId(saved.id)
          }
        }}
      />

      {/* Brand Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteBrandTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteBrandTarget(null)
        }}
        title={`Delete Brand "${deleteBrandTarget?.name}"?`}
        description="Are you sure you want to delete this brand? Products linked to it will remain, but will no longer have an assigned brand."
        confirmLabel="Delete Brand"
        tone="destructive"
        onConfirm={handleDeleteBrand}
      />

      {/* Dealer Dialog for Inline Create/Edit */}
      <DealerDialog
        open={dealerDialogOpen}
        onOpenChange={setDealerDialogOpen}
        onSuccess={(saved) => {
          if (saved.id) {
            setFormDealerIds((prev) => Array.from(new Set([...prev, saved.id])))
          }
        }}
      />
    </div>
  )
}
