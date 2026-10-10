import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  getOpsBundleFn,
  upsertCouponFn,
  deleteCouponFn,
  upsertBannerFn,
  deleteBannerFn,
  updateReviewFn,
} from '#/server/operations/operations.functions'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/shared/page-header'
import { KpiCard } from '#/components/shared/kpi-card'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '#/components/ui/tabs'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { NativeSelect } from '#/components/ui/native-select'
import { Badge } from '#/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  Megaphone,
  Tag,
  Star,
  Plus,
  Copy,
  Trash2,
  Check,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/admin/marketing')({
  loader: async () => {
    return getOpsBundleFn()
  },
  component: AdminMarketingPage,
})

function AdminMarketingPage() {
  const { ops } = Route.useLoaderData()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'coupons' | 'banners' | 'reviews'>('coupons')
  const [isAddCouponOpen, setIsAddCouponOpen] = useState(false)
  const [isAddBannerOpen, setIsAddBannerOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Coupon form state
  const [couponForm, setCouponForm] = useState({
    code: '',
    type: 'percent' as 'percent' | 'fixed',
    value: 15,
    minOrder: 2500,
    usageLimit: 300,
    expiresAt: '2026-12-31',
    active: true,
  })

  // Banner form state
  const [bannerForm, setBannerForm] = useState({
    title: '',
    imageUrl: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800&auto=format&fit=crop&q=80',
    href: '/drinks',
    placement: 'home' as 'home' | 'drinks' | 'grocery',
    active: true,
  })

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success(`Coupon code ${code} copied to clipboard!`)
  }

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!couponForm.code.trim()) {
      toast.error('Coupon code is required')
      return
    }

    try {
      setIsSubmitting(true)
      await upsertCouponFn({
        data: {
          code: couponForm.code.toUpperCase().replace(/\s+/g, ''),
          type: couponForm.type,
          value: Number(couponForm.value),
          minOrder: Number(couponForm.minOrder),
          usageLimit: Number(couponForm.usageLimit),
          expiresAt: couponForm.expiresAt,
          active: couponForm.active,
        },
      })
      toast.success('Coupon code activated in Neon DB!')
      setIsAddCouponOpen(false)
      setCouponForm({
        code: '',
        type: 'percent',
        value: 15,
        minOrder: 2500,
        usageLimit: 300,
        expiresAt: '2026-12-31',
        active: true,
      })
      await router.invalidate()
    } catch {
      toast.error('Failed to create coupon')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCoupon = async (id: string) => {
    try {
      setIsSubmitting(true)
      await deleteCouponFn({ data: { id } })
      toast.success('Coupon deleted from database')
      await router.invalidate()
    } catch {
      toast.error('Failed to delete coupon')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateBanner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bannerForm.title.trim()) {
      toast.error('Banner title is required')
      return
    }

    try {
      setIsSubmitting(true)
      await upsertBannerFn({
        data: {
          title: bannerForm.title,
          imageUrl: bannerForm.imageUrl,
          href: bannerForm.href,
          placement: bannerForm.placement,
          active: bannerForm.active,
        },
      })
      toast.success('Campaign banner published to Neon DB!')
      setIsAddBannerOpen(false)
      setBannerForm({
        title: '',
        imageUrl: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800&auto=format&fit=crop&q=80',
        href: '/drinks',
        placement: 'home',
        active: true,
      })
      await router.invalidate()
    } catch {
      toast.error('Failed to create banner')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteBanner = async (id: string) => {
    try {
      setIsSubmitting(true)
      await deleteBannerFn({ data: { id } })
      toast.success('Banner removed from database')
      await router.invalidate()
    } catch {
      toast.error('Failed to delete banner')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateReview = async (id: string, status: 'published' | 'hidden') => {
    try {
      setIsSubmitting(true)
      await updateReviewFn({ data: { id, status } })
      toast.success(`Review marked as ${status.toUpperCase()}!`)
      await router.invalidate()
    } catch {
      toast.error('Failed to moderate review')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Growth"
        title="Marketing & Promotions"
        description="Discount promo vouchers, storefront campaign banners, and verified customer review moderation."
        actions={
          activeTab === 'coupons' ? (
            <Button onClick={() => setIsAddCouponOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Coupon
            </Button>
          ) : activeTab === 'banners' ? (
            <Button onClick={() => setIsAddBannerOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Banner
            </Button>
          ) : null
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Active Coupons"
          value={ops.coupons.filter((c) => c.active).length}
          note="Promotional voucher codes"
          icon={Tag}
        />
        <KpiCard
          label="Hero Campaign Sliders"
          value={ops.banners.length}
          note="Storefront marketing tiles"
          icon={Megaphone}
          tone="success"
        />
        <KpiCard
          label="Customer Reviews"
          value={ops.reviews.length}
          note="Testimonials on catalog items"
          icon={Star}
        />
      </div>

      {/* Sub Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'coupons' | 'banners' | 'reviews')}
        className="w-full space-y-4"
      >
        <TabsList>
          <TabsTrigger value="coupons" className="gap-2">
            <Tag className="h-3.5 w-3.5" />
            <span>Discount Coupons ({ops.coupons.length})</span>
          </TabsTrigger>
          <TabsTrigger value="banners" className="gap-2">
            <Megaphone className="h-3.5 w-3.5" />
            <span>Campaign Banners ({ops.banners.length})</span>
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-2">
            <Star className="h-3.5 w-3.5" />
            <span>Review Moderation ({ops.reviews.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coupons" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Promo Code</TableHead>
                    <TableHead>Discount Value</TableHead>
                    <TableHead>Min Cart Spend</TableHead>
                    <TableHead>Redemption Usage</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ops.coupons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        No coupons found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ops.coupons.map((coupon) => {
                      const usagePercent = Math.round(
                        (coupon.used / (coupon.usageLimit || 1)) * 100
                      )
                      return (
                        <TableRow key={coupon.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded border border-border bg-muted">
                                {coupon.code}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => handleCopyCode(coupon.code)}
                                title="Copy coupon code"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>

                          <TableCell>
                            <span className="font-medium text-foreground">
                              {coupon.type === 'percent'
                                ? `${coupon.value}% off`
                                : `Flat ${formatNPR(coupon.value)} off`}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span className="font-mono text-muted-foreground">
                              {formatNPR(coupon.minOrder)}
                            </span>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-muted h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-primary h-full rounded-full"
                                  style={{ width: `${Math.min(100, usagePercent)}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground font-mono">
                                {coupon.used} / {coupon.usageLimit}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs text-muted-foreground font-mono">
                              {coupon.expiresAt}
                            </span>
                          </TableCell>

                          <TableCell>
                            <Badge variant={coupon.active ? 'success' : 'secondary'}>
                              {coupon.active ? 'Active' : 'Expired'}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteCoupon(coupon.id)}
                              title="Delete coupon"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banners" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ops.banners.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-muted-foreground text-sm">
                No campaign banners currently published.
              </div>
            ) : (
              ops.banners.map((banner) => (
                <Card key={banner.id} className="overflow-hidden flex flex-col justify-between">
                  <div className="relative h-44 bg-muted">
                    <img
                      src={banner.imageUrl}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-4 text-white">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary text-primary-foreground w-fit mb-1">
                        Placement: {banner.placement}
                      </span>
                      <h4 className="text-sm font-semibold text-white">{banner.title}</h4>
                      <p className="text-xs text-white/80 font-mono">Link: {banner.href}</p>
                    </div>
                  </div>

                  <CardContent className="p-3.5 flex items-center justify-between text-xs border-t border-border">
                    <Badge variant={banner.active ? 'success' : 'secondary'}>
                      {banner.active ? 'Active on store' : 'Inactive'}
                    </Badge>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteBanner(banner.id)}
                      title="Delete banner"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="divide-y divide-border">
                {ops.reviews.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No customer reviews to moderate.
                  </div>
                ) : (
                  ops.reviews.map((rev) => (
                    <div key={rev.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-foreground">{rev.customerName}</span>
                          <span className="text-muted-foreground ml-2">on {rev.productName}</span>
                          <span className="text-muted-foreground ml-2 font-mono">{rev.createdAt}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center text-amber-500 font-bold">
                            {'★'.repeat(rev.rating)}
                            <span className="text-muted-foreground/30">{'★'.repeat(5 - rev.rating)}</span>
                          </div>
                          <Badge
                            variant={
                              rev.status === 'published'
                                ? 'success'
                                : rev.status === 'hidden'
                                ? 'destructive'
                                : 'warning'
                            }
                          >
                            {rev.status}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-muted-foreground italic">&ldquo;{rev.body}&rdquo;</p>

                      <div className="pt-1 flex justify-end gap-2">
                        {rev.status !== 'published' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleUpdateReview(rev.id, 'published')}
                          >
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            Approve
                          </Button>
                        )}
                        {rev.status !== 'hidden' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                            onClick={() => handleUpdateReview(rev.id, 'hidden')}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Hide
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Coupon Dialog */}
      <Dialog open={isAddCouponOpen} onOpenChange={setIsAddCouponOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Promo Coupon</DialogTitle>
            <DialogDescription>Configure cart discounts in Neon DB</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCoupon} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-code">Coupon Code *</Label>
              <Input
                id="coupon-code"
                required
                value={couponForm.code}
                onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })}
                placeholder="e.g. TIHAR2026, FESTIVE15"
                className="font-mono font-semibold uppercase"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="coupon-type">Discount Type</Label>
                <NativeSelect
                  id="coupon-type"
                  value={couponForm.type}
                  onChange={(e) =>
                    setCouponForm({
                      ...couponForm,
                      type: e.target.value as 'percent' | 'fixed',
                    })
                  }
                >
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Flat Amount (NPR)</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coupon-val">Discount Value *</Label>
                <Input
                  id="coupon-val"
                  type="number"
                  min="1"
                  required
                  value={couponForm.value}
                  onChange={(e) => setCouponForm({ ...couponForm, value: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="coupon-min">Minimum Cart Spend (NPR)</Label>
                <Input
                  id="coupon-min"
                  type="number"
                  min="0"
                  value={couponForm.minOrder}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, minOrder: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coupon-limit">Usage Limit</Label>
                <Input
                  id="coupon-limit"
                  type="number"
                  min="1"
                  value={couponForm.usageLimit}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, usageLimit: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="coupon-expiry">Expiry Date</Label>
              <Input
                id="coupon-expiry"
                type="date"
                value={couponForm.expiresAt}
                onChange={(e) => setCouponForm({ ...couponForm, expiresAt: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddCouponOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Activating...' : 'Activate Coupon'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Banner Dialog */}
      <Dialog open={isAddBannerOpen} onOpenChange={setIsAddBannerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Campaign Banner</DialogTitle>
            <DialogDescription>Publish storefront slider tile to Neon DB</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateBanner} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="banner-title">Banner Title *</Label>
              <Input
                id="banner-title"
                required
                value={bannerForm.title}
                onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                placeholder="e.g. Premium Single Malt Scotch Deals"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="banner-img">Image URL *</Label>
              <Input
                id="banner-img"
                type="url"
                required
                value={bannerForm.imageUrl}
                onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="banner-placement">Target Placement</Label>
                <NativeSelect
                  id="banner-placement"
                  value={bannerForm.placement}
                  onChange={(e) =>
                    setBannerForm({
                      ...bannerForm,
                      placement: e.target.value as 'home' | 'drinks' | 'grocery',
                    })
                  }
                >
                  <option value="home">Homepage Hero</option>
                  <option value="drinks">Liquor Drinks Catalog</option>
                  <option value="grocery">Grocery Catalog</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="banner-href">Link Href</Label>
                <Input
                  id="banner-href"
                  value={bannerForm.href}
                  onChange={(e) => setBannerForm({ ...bannerForm, href: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddBannerOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Publishing...' : 'Publish Banner'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
