import { useState, useMemo } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getAdminGroceryProductsFn,
  getAllTaxonomyFn,
  upsertGroceryProductFn,
  toggleProductStatusFn,
  deleteItemFn,
} from '#/server/catalog/catalog.functions'
import { formatNPR, toPaisa, toRupees } from '#/lib/money'
import {
  Search,
  Plus,
  Sparkles,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '#/components/shared/page-header'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { Badge } from '#/components/ui/badge'
import { Checkbox } from '#/components/ui/checkbox'
import {
  NativeSelect,
  NativeSelectOption,
} from '#/components/ui/native-select'
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

export const Route = createFileRoute('/admin/grocery')({
  loader: async () => {
    const [products, taxonomy] = await Promise.all([
      getAdminGroceryProductsFn(),
      getAllTaxonomyFn(),
    ])
    return { products, taxonomy }
  },
  component: AdminGroceryPage,
})

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

function AdminGroceryPage() {
  const { products, taxonomy } = Route.useLoaderData()
  const router = useRouter()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  // Form State
  const [formName, setFormName] = useState('')
  const [formSlug, setFormSlug] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formImageUrl, setFormImageUrl] = useState('')
  const [formIsFeatured, setFormIsFeatured] = useState(false)
  const [formIsActive, setFormIsActive] = useState(true)
  const [formVariants, setFormVariants] = useState<GroceryVariantItem[]>([
    {
      name: 'Pack of 1',
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
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = p.name.toLowerCase().includes(q)
        const matchesCat = p.categoryName.toLowerCase().includes(q)
        const matchesSku = p.variants.some((v) =>
          v.sku.toLowerCase().includes(q),
        )
        return matchesName || matchesCat || matchesSku
      }
      return true
    })
  }, [products, searchQuery, selectedCategory])

  const openAddModal = () => {
    setEditingId(null)
    setFormName('')
    setFormSlug('')
    setFormCategoryId(taxonomy.groceryCategories[0]?.id ?? '')
    setFormDescription('')
    setFormImageUrl('')
    setFormIsFeatured(false)
    setFormIsActive(true)
    setFormVariants([
      {
        name: 'Pack of 1',
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
    setFormDescription(p.description ?? '')
    setFormImageUrl(p.primaryImage ?? '')
    setFormIsFeatured(p.isFeatured)
    setFormIsActive(p.isActive)
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
        name: 'Pack of 6',
        unit: 'pack',
        quantity: '6.00',
        sku: 'GROC-' + Math.floor(1000 + Math.random() * 9000),
        price: 850,
        mrp: 1000,
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
      await upsertGroceryProductFn({
        data: {
          id: editingId ?? undefined,
          name: formName.trim(),
          slug: formSlug.trim() || undefined,
          categoryId: formCategoryId,
          description: formDescription.trim() || null,
          imageUrl: formImageUrl.trim() || null,
          isFeatured: formIsFeatured,
          isActive: formIsActive,
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
      await router.invalidate()
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
      await router.invalidate()
    } catch {
      toast.error('Failed to update status')
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
      await router.invalidate()
    } catch {
      toast.error('Failed to delete grocery product')
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
        title="Grocery and munchies"
        description="Manage snacks, chips, party ice, mixers, energy drinks, and midnight snacks."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-xs">
              {products.length} SKUs
            </Badge>
            <Button size="sm" onClick={openAddModal} className="h-8 gap-1.5 text-xs">
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
            placeholder="Search by item name, category, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-9 text-xs"
          />
        </div>

        <NativeSelect
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          size="sm"
          className="h-8 text-xs"
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
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Item</TableHead>
              <TableHead className="text-xs">Category</TableHead>
              <TableHead className="text-xs">Variants and pricing (NPR)</TableHead>
              <TableHead className="text-center text-xs">Status</TableHead>
              <TableHead className="text-right text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    title="No matching grocery products found"
                    description="Try adjusting your filter or search query."
                  />
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          p.primaryImage ||
                          'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=100&q=80'
                        }
                        alt={p.name}
                        className="h-10 w-10 shrink-0 rounded-md bg-muted object-cover border border-border"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                          <span>{p.name}</span>
                          {p.isFeatured && (
                            <Badge variant="secondary" className="gap-1 text-[9px] px-1 py-0 font-normal">
                              <Sparkles className="h-2.5 w-2.5" /> Featured
                            </Badge>
                          )}
                        </div>
                        <div className="truncate font-mono text-[11px] text-muted-foreground">
                          /{p.slug}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="font-medium text-xs text-foreground">
                    {p.categoryName}
                  </TableCell>

                  <TableCell>
                    <div className="flex max-w-sm flex-wrap gap-1.5">
                      {p.variants.map((v) => (
                        <span
                          key={v.id}
                          className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs ${
                            v.stock <= 10
                              ? 'border-destructive/30 bg-destructive/10 text-destructive'
                              : 'border-border bg-muted/30 text-foreground'
                          }`}
                        >
                          <span className="font-medium text-[11px]">{v.name}</span>
                          <span className="font-mono font-semibold text-[11px] tabular-nums">
                            {formatNPR(v.price)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {v.stock} in stock
                          </span>
                        </span>
                      ))}
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <Button
                      variant={p.isActive ? 'outline' : 'secondary'}
                      size="sm"
                      onClick={() =>
                        handleToggleStatus(p.id, 'isActive', p.isActive)
                      }
                      className="h-7 gap-1 text-[11px]"
                    >
                      {p.isActive ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Active
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 text-muted-foreground" /> Draft
                        </>
                      )}
                    </Button>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(p)}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        aria-label={`Edit ${p.name}`}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget({ id: p.id, name: p.name })}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {editingId ? 'Edit grocery item' : 'New grocery item'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Manage snack items, mixers, package sizes, and stock.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="gro-name" className="text-xs">
                Item name *
              </Label>
              <Input
                id="gro-name"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Lay's India's Magic Masala"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="gro-cat" className="text-xs">
                  Category *
                </Label>
                <NativeSelect
                  id="gro-cat"
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  required
                  size="sm"
                  className="w-full text-xs"
                >
                  {taxonomy.groceryCategories.map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gro-slug" className="text-xs">
                  URL slug (optional)
                </Label>
                <Input
                  id="gro-slug"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="auto-generated-from-name"
                  className="h-8 font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gro-img" className="text-xs">
                Image URL
              </Label>
              <Input
                id="gro-img"
                type="url"
                value={formImageUrl}
                onChange={(e) => setFormImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gro-desc" className="text-xs">
                Description
              </Label>
              <Textarea
                id="gro-desc"
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Item details, flavor profile, ingredients..."
                className="text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-6 border-y border-border py-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="form-is-active"
                  checked={formIsActive}
                  onCheckedChange={(checked) => setFormIsActive(Boolean(checked))}
                />
                <Label htmlFor="form-is-active" className="text-xs cursor-pointer font-normal">
                  Active on storefront
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="form-is-featured"
                  checked={formIsFeatured}
                  onCheckedChange={(checked) => setFormIsFeatured(Boolean(checked))}
                />
                <Label htmlFor="form-is-featured" className="text-xs cursor-pointer font-normal flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Featured item
                </Label>
              </div>
            </div>

            {/* Variants */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Sizes / pack variants</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddVariantRow}
                  className="h-7 gap-1 text-xs text-primary"
                >
                  <Plus className="h-3 w-3" /> Add variant
                </Button>
              </div>

              <div className="max-h-60 space-y-2 overflow-y-auto">
                {formVariants.map((v, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-2 items-center gap-2 rounded-md border border-border bg-muted/30 p-2 sm:grid-cols-12"
                  >
                    <div className="col-span-2 sm:col-span-3">
                      <Input
                        type="text"
                        placeholder="Variant name"
                        value={v.name}
                        onChange={(e) =>
                          updateVariant(i, { name: e.target.value })
                        }
                        className="h-7 text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Input
                        type="text"
                        placeholder="Unit"
                        value={v.unit}
                        onChange={(e) =>
                          updateVariant(i, { unit: e.target.value })
                        }
                        className="h-7 font-mono text-xs"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <Input
                        type="number"
                        placeholder="Price"
                        value={v.price}
                        onChange={(e) =>
                          updateVariant(i, { price: Number(e.target.value) })
                        }
                        className="h-7 font-mono text-xs"
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

                    <div className="col-span-2 flex justify-end sm:col-span-2">
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

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
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
                {isSubmitting ? 'Saving...' : editingId ? 'Update item' : 'Create item'}
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
    </div>
  )
}
