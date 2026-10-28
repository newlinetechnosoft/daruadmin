import { useState, useMemo } from 'react'
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'
import { adminQueries } from '#/queries/admin'
import { can } from '#/server/auth/permissions-shared'
import { deleteItemFn } from '#/server/catalog/catalog.functions'
import { PageHeader } from '#/components/shared/page-header'
import { EmptyState } from '#/components/shared/empty-state'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
import { BrandDialog } from './brand-dialog'
import type { BrandData } from './brand-dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Badge } from '#/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Award,
  Wine,
  ShoppingBag,
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  Globe,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Link } from '@tanstack/react-router'

type CatalogTab = 'liquor' | 'grocery'
type StatusFilter = 'all' | 'active' | 'inactive'

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState<BrandData | null>(null)

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<BrandData | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const liquorBrands = brandsData.liquorBrands ?? []
  const groceryBrands = brandsData.groceryBrands ?? []

  const currentBrands = activeTab === 'liquor' ? liquorBrands : groceryBrands

  // Filtered brand list
  const filteredBrands = useMemo(() => {
    return currentBrands.filter((b) => {
      if (statusFilter === 'active' && b.isActive === false) return false
      if (statusFilter === 'inactive' && b.isActive !== false) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        (b.origin && b.origin.toLowerCase().includes(q)) ||
        (b.description && b.description.toLowerCase().includes(q))
      )
    })
  }, [currentBrands, searchQuery, statusFilter])

  // Stats calculation
  const totalLiquorCount = liquorBrands.length
  const totalGroceryCount = groceryBrands.length
  const totalActiveCurrent = currentBrands.filter(
    (b) => b.isActive !== false,
  ).length
  const totalProductsLinked = currentBrands.reduce(
    (acc, b) => acc + (b.productCount ?? 0),
    0,
  )

  const handleOpenCreate = () => {
    setSelectedBrand(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (brand: BrandData) => {
    setSelectedBrand(brand)
    setDialogOpen(true)
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
      setDeleteTarget(null)

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'taxonomy'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'liquor'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'grocery'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'inventory'] }),
      ])
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete brand')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        kicker="Catalog"
        title="Brands Management"
        description="Configure brands and distilleries for Liquor and Grocery catalogs with live product linkage."
        actions={
          canCreate ? (
            <Button
              size="sm"
              onClick={handleOpenCreate}
              className="gap-1.5 text-xs shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New Brand
            </Button>
          ) : undefined
        }
      />

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/60 shadow-none">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-normal text-muted-foreground flex items-center justify-between">
              <span>Liquor Brands</span>
              <Wine className="h-3.5 w-3.5 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-bold tracking-tight">
              {totalLiquorCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Distilleries &amp; makers
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-none">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-normal text-muted-foreground flex items-center justify-between">
              <span>Grocery Brands</span>
              <ShoppingBag className="h-3.5 w-3.5 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-bold tracking-tight">
              {totalGroceryCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Food, snacks &amp; mixers
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-none">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-normal text-muted-foreground flex items-center justify-between">
              <span>
                Active in {activeTab === 'liquor' ? 'Liquor' : 'Grocery'}
              </span>
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-bold tracking-tight">
              {totalActiveCurrent}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Enabled for customers
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-none">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-normal text-muted-foreground flex items-center justify-between">
              <span>Linked Products</span>
              <Package className="h-3.5 w-3.5 text-purple-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-bold tracking-tight">
              {totalProductsLinked}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Products assigned to {activeTab}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as CatalogTab)
            setSearchQuery('')
          }}
          className="w-auto"
        >
          <TabsList className="h-9">
            <TabsTrigger value="liquor" className="text-xs gap-1.5 px-3">
              <Wine className="h-3.5 w-3.5" />
              Liquor Brands
              <Badge
                variant="secondary"
                className="ml-1 text-[10px] px-1 py-0 h-4"
              >
                {totalLiquorCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="grocery" className="text-xs gap-1.5 px-3">
              <ShoppingBag className="h-3.5 w-3.5" />
              Grocery Brands
              <Badge
                variant="secondary"
                className="ml-1 text-[10px] px-1 py-0 h-4"
              >
                {totalGroceryCount}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {/* Status filters */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-background text-foreground shadow-xs font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'active'
                  ? 'bg-background text-foreground shadow-xs font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'inactive'
                  ? 'bg-background text-foreground shadow-xs font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Inactive
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder={`Search ${activeTab} brands...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs w-full"
            />
          </div>
        </div>
      </div>

      {/* Brands Grid */}
      {filteredBrands.length === 0 ? (
        <EmptyState
          title={`No ${activeTab} brands found`}
          description={
            searchQuery
              ? `No brand matching "${searchQuery}". Try adjusting your search.`
              : `You haven't created any ${activeTab} brands yet.`
          }
          action={
            canCreate ? (
              <Button
                size="sm"
                onClick={handleOpenCreate}
                className="gap-1.5 text-xs shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Add First {activeTab === 'liquor' ? 'Liquor' : 'Grocery'} Brand
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBrands.map((brand) => (
            <Card
              key={brand.id}
              className="flex flex-col justify-between border-border/70 hover:border-border transition-colors shadow-xs"
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-12 shrink-0 rounded-lg border border-border/80 bg-muted/30 p-1 flex items-center justify-center overflow-hidden">
                      {brand.logoUrl ? (
                        <img
                          src={brand.logoUrl}
                          alt={brand.name}
                          className="h-full w-full object-contain rounded"
                        />
                      ) : (
                        <Award className="h-6 w-6 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-semibold text-sm text-foreground truncate">
                          {brand.name}
                        </h3>
                        {brand.isActive !== false ? (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0 font-normal"
                          >
                            Active
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground text-[10px] px-1.5 py-0 font-normal"
                          >
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">
                        /{brand.slug}
                      </p>
                    </div>
                  </div>

                  {brand.origin && (
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px] gap-1 px-1.5 py-0 font-normal text-muted-foreground"
                    >
                      <Globe className="h-2.5 w-2.5" />
                      {brand.origin}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-4 pt-1 pb-3 flex-1">
                {brand.description ? (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {brand.description}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic">
                    No description provided
                  </p>
                )}
              </CardContent>

              <div className="border-t border-border/50 px-4 py-2.5 bg-muted/15 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground font-medium text-[11px]">
                  <Package className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span>
                    {brand.productCount ?? 0}{' '}
                    {brand.productCount === 1 ? 'product' : 'products'}
                  </span>
                  {activeTab === 'liquor' ? (
                    <Link
                      to="/admin/liquor"
                      className="text-primary hover:underline ml-1 text-[10px]"
                    >
                      view
                    </Link>
                  ) : (
                    <Link
                      to="/admin/grocery"
                      className="text-primary hover:underline ml-1 text-[10px]"
                    >
                      view
                    </Link>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(brand)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      title="Edit brand"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(brand)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      title="Delete brand"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Brand Create/Edit Dialog */}
      <BrandDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        catalogType={activeTab}
        brand={selectedBrand}
        allowTypeSwitch={!selectedBrand}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={`Delete Brand "${deleteTarget?.name}"?`}
        description={
          deleteTarget?.productCount && deleteTarget.productCount > 0
            ? `Warning: This brand has ${deleteTarget.productCount} associated products. Deleting the brand will unset their brand affiliation (they won't be deleted, but will have no brand).`
            : `Are you sure you want to delete this brand? This action cannot be undone.`
        }
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete Brand'}
        tone="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
