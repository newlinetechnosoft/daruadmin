import { useState, useMemo } from 'react'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { can } from '#/server/auth/permissions-shared'
import { deleteItemFn } from '#/server/catalog/catalog.functions'
import { PageShell, PageHeader } from '#/components/shared/page-shell'
import { StatusIndicator } from '#/components/shared/status-indicator'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
import { ListView, ListToolbar, ListCard } from '#/components/shared/list-view'
import type {
  ListViewColumnDef,
  FilterRule,
  FilterableField,
  TableDensity,
} from '#/components/shared/list-view'
import { BrandSheet } from './brand-sheet'
import type { BrandData } from './brand-sheet'
import { Button } from '#/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Badge } from '#/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  Award,
  Wine,
  ShoppingBag,
  Plus,
  MoreHorizontal,
  Edit2,
  Trash2,
  Globe,
} from 'lucide-react'
import { toast } from 'sonner'

type CatalogTab = 'liquor' | 'grocery'

export function BrandsPanel() {
  const queryClient = useQueryClient()
  const { data: brandsData } = useSuspenseQuery(adminQueries.brands())
  const { data: access } = useSuspenseQuery(adminQueries.access())

  const grants = access.authenticated ? access.grants : null
  const canCreate = can(grants, 'brands', 'create')
  const canEdit = can(grants, 'brands', 'edit')
  const canDelete = can(grants, 'brands', 'delete')

  const [activeTab, setActiveTab] = useState<CatalogTab>('liquor')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([])
  const [density, setDensity] = useState<TableDensity>('comfortable')

  // Sheet State
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState<BrandData | null>(null)

  // Delete Confirm State
  const [deleteTarget, setDeleteTarget] = useState<BrandData | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const liquorBrands = brandsData.liquorBrands as unknown as BrandData[]
  const groceryBrands = brandsData.groceryBrands as unknown as BrandData[]
  const currentBrands = activeTab === 'liquor' ? liquorBrands : groceryBrands

  // Filter fields config
  const filterableFields: FilterableField[] = [
    { id: 'origin', label: 'Origin', type: 'string' },
    {
      id: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
    },
  ]

  // Filtered dataset
  const filteredBrands = useMemo(() => {
    return currentBrands.filter((b) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matches =
          b.name.toLowerCase().includes(q) ||
          b.slug.toLowerCase().includes(q) ||
          (b.origin && b.origin.toLowerCase().includes(q))
        if (!matches) return false
      }

      // Dynamic filters
      for (const f of activeFilters) {
        if (f.field === 'origin') {
          if (
            !b.origin ||
            !b.origin.toLowerCase().includes(f.value.toLowerCase())
          ) {
            return false
          }
        }
        if (f.field === 'status') {
          const isActive = b.isActive !== false
          if (f.value === 'active' && !isActive) return false
          if (f.value === 'inactive' && isActive) return false
        }
      }

      return true
    })
  }, [currentBrands, searchQuery, activeFilters])

  const handleOpenCreate = () => {
    setEditingBrand(null)
    setSheetOpen(true)
  }

  const handleOpenEdit = (b: BrandData) => {
    setEditingBrand(b)
    setSheetOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await deleteItemFn({
        data: {
          catalogType:
            activeTab === 'liquor' ? 'liquor-brand' : 'grocery-brand',
          id: deleteTarget.id,
        },
      })
      toast.success(`Brand "${deleteTarget.name}" deleted`)
      queryClient.invalidateQueries({
        queryKey: adminQueries.brands().queryKey,
      })
      setDeleteTarget(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete brand'
      toast.error(msg)
    } finally {
      setIsDeleting(false)
    }
  }

  const columns = useMemo<ListViewColumnDef<BrandData>[]>(() => {
    return [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Brand Name',
        meta: { priority: 1 },
        cell: ({ row }) => {
          const b = row.original
          return (
            <div className="flex items-center gap-2.5">
              {b.logoUrl ? (
                <img
                  src={b.logoUrl}
                  alt={b.name}
                  className="size-7 rounded-md object-contain bg-background border p-0.5 shrink-0"
                />
              ) : (
                <div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                  <Award className="size-3.5" />
                </div>
              )}
              <div className="min-w-0">
                <span
                  className="font-medium text-foreground hover:underline cursor-pointer"
                  onClick={() => canEdit && handleOpenEdit(b)}
                >
                  {b.name}
                </span>
                {b.description && (
                  <p className="text-xs text-muted-foreground truncate max-w-xs">
                    {b.description}
                  </p>
                )}
              </div>
            </div>
          )
        },
      },
      {
        id: 'slug',
        accessorKey: 'slug',
        header: 'URL Slug',
        meta: { priority: 2 },
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.slug}
          </span>
        ),
      },
      {
        id: 'origin',
        accessorKey: 'origin',
        header: 'Origin',
        meta: { priority: 2 },
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe className="size-3 shrink-0" />
            <span>{row.original.origin || 'Nepal'}</span>
          </div>
        ),
      },
      {
        id: 'productCount',
        accessorKey: 'productCount',
        header: 'Products Linked',
        meta: { priority: 2, align: 'center' },
        cell: ({ row }) => (
          <Badge variant="outline" className="font-mono text-xs tabular-nums">
            {row.original.productCount ?? 0}
          </Badge>
        ),
      },
      {
        id: 'status',
        accessorKey: 'isActive',
        header: 'Status',
        meta: { priority: 1 },
        cell: ({ row }) => (
          <StatusIndicator
            status={row.original.isActive !== false ? 'active' : 'inactive'}
            asBadge
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        meta: { priority: 1, align: 'right' },
        cell: ({ row }) => {
          const b = row.original
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label={`Actions for ${b.name}`}
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {canEdit && (
                  <DropdownMenuItem
                    onSelect={() => handleOpenEdit(b)}
                    className="text-xs gap-2 cursor-pointer"
                  >
                    <Edit2 className="size-3.5" />
                    <span>Edit</span>
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setDeleteTarget(b)}
                      className="text-xs gap-2 text-rose-600 focus:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ]
  }, [canEdit, canDelete])

  return (
    <PageShell>
      <PageHeader
        kicker="Catalog Management"
        title="Brands"
        description="Master brand directory for liquor and grocery product catalogs."
        count={filteredBrands.length}
        actions={
          canCreate && (
            <Button
              type="button"
              size="sm"
              onClick={handleOpenCreate}
              className="h-8 gap-1.5 text-xs"
            >
              <Plus className="size-3.5" />
              New Brand
            </Button>
          )
        }
      />

      <ListToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search brands by name, slug, origin..."
        filterableFields={filterableFields}
        activeFilters={activeFilters}
        onAddFilter={(filter) => setActiveFilters([...activeFilters, filter])}
        onRemoveFilter={(idx) =>
          setActiveFilters(activeFilters.filter((_, i) => i !== idx))
        }
        onClearFilters={() => setActiveFilters([])}
        density={density}
        onDensityChange={setDensity}
        quickFilterTabs={
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as CatalogTab)}
            className="w-full"
          >
            <TabsList className="h-8 p-0.5 bg-muted/60">
              <TabsTrigger
                value="liquor"
                className="h-7 text-xs gap-1.5 data-[state=active]:bg-background"
              >
                <Wine className="size-3.5" />
                <span>Liquor Brands</span>
                <span className="font-mono text-xs text-muted-foreground ml-1">
                  ({liquorBrands.length})
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="grocery"
                className="h-7 text-xs gap-1.5 data-[state=active]:bg-background"
              >
                <ShoppingBag className="size-3.5" />
                <span>Grocery Brands</span>
                <span className="font-mono text-xs text-muted-foreground ml-1">
                  ({groceryBrands.length})
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <ListView<BrandData>
        data={filteredBrands}
        columns={columns}
        density={density}
        emptyMessage={`No ${activeTab} brands found.`}
        emptyAction={
          canCreate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenCreate}
              className="text-xs h-7 gap-1"
            >
              <Plus className="size-3" />
              Add first brand
            </Button>
          )
        }
        renderCard={(brand: BrandData) => (
          <ListCard
            title={
              <div className="flex items-center gap-2">
                {brand.logoUrl ? (
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    className="size-6 rounded object-contain bg-background border p-0.5"
                  />
                ) : (
                  <Award className="size-4 text-muted-foreground" />
                )}
                <span className="font-semibold text-xs">{brand.name}</span>
              </div>
            }
            subtitle={brand.description || brand.slug}
            status={
              <StatusIndicator
                status={brand.isActive !== false ? 'active' : 'inactive'}
                asBadge
              />
            }
            details={[
              { label: 'Origin', value: brand.origin || 'Nepal' },
              {
                label: 'Linked Products',
                value: `${brand.productCount ?? 0} items`,
              },
            ]}
            actions={
              canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEdit(brand)}
                  className="h-7 text-xs gap-1"
                >
                  <Edit2 className="size-3" /> Edit
                </Button>
              )
            }
            onClick={() => canEdit && handleOpenEdit(brand)}
          />
        )}
      />

      <BrandSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        catalogType={activeTab}
        brand={editingBrand}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete Brand "${deleteTarget?.name}"?`}
        description="This will permanently delete the brand. Any catalog products linked to this brand will remain intact without a brand reference."
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
        danger
        onConfirm={handleDelete}
      />
    </PageShell>
  )
}
