import { useState } from 'react'
import { getRouteApi, useRouter } from '@tanstack/react-router'
import {
  upsertCouponFn,
  deleteCouponFn,
  upsertBannerFn,
  deleteBannerFn,
  updateReviewFn,
} from '#/server/operations/operations.functions'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/shared/page-header'
import { KpiCard } from '#/components/shared/kpi-card'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
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
  History,
  Download,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'

const routeApi = getRouteApi('/admin/marketing')

export function MarketingPanel() {
  const { ops } = routeApi.useLoaderData()
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<
    'coupons' | 'banners' | 'reviews' | 'redemptions'
  >('coupons')
  const [redemptionSearch, setRedemptionSearch] = useState('')
  const [isAddCouponOpen, setIsAddCouponOpen] = useState(false)
  const [isAddBannerOpen, setIsAddBannerOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteCouponTarget, setDeleteCouponTarget] = useState<{
    id: string
    code: string
  } | null>(null)
  const [deleteBannerTarget, setDeleteBannerTarget] = useState<{
    id: string
    title: string
  } | null>(null)

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
    imageUrl:
      'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800&auto=format&fit=crop&q=80',
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

  const handleDeleteCoupon = async () => {
    if (!deleteCouponTarget) return
    try {
      setIsSubmitting(true)
      await deleteCouponFn({ data: { id: deleteCouponTarget.id } })
      toast.success(`Coupon "${deleteCouponTarget.code}" deleted from database`)
      setDeleteCouponTarget(null)
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
        imageUrl:
          'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800&auto=format&fit=crop&q=80',
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

  const handleDeleteBanner = async () => {
    if (!deleteBannerTarget) return
    try {
      setIsSubmitting(true)
      await deleteBannerFn({ data: { id: deleteBannerTarget.id } })
      toast.success(`Banner "${deleteBannerTarget.title}" removed from database`)
      setDeleteBannerTarget(null)
      await router.invalidate()
    } catch {
      toast.error('Failed to delete banner')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateReview = async (
    id: string,
    status: 'published' | 'hidden',
  ) => {
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

  const redemptions = ops.couponRedemptions ?? []

  const filteredRedemptions = redemptions.filter((r) => {
    if (!redemptionSearch.trim()) return true
    const q = redemptionSearch.toLowerCase()
    return (
      r.customerName.toLowerCase().includes(q) ||
      r.customerEmail.toLowerCase().includes(q) ||
      r.customerPhone.toLowerCase().includes(q) ||
      r.couponCode.toLowerCase().includes(q)
    )
  })

  const exportRedemptionsCSV = () => {
    if (filteredRedemptions.length === 0) {
      toast.info('No redemption data to export')
      return
    }

    const headers = [
      'Customer Name',
      'Email',
      'Phone',
      'Coupon Code',
      'Order Total (NPR)',
      'Discount (NPR)',
      'Date (AD)',
    ]

    const rows = filteredRedemptions.map((r) => [
      `"${r.customerName.replace(/"/g, '""')}"`,
      `"${r.customerEmail.replace(/"/g, '""')}"`,
      `"${r.customerPhone.replace(/"/g, '""')}"`,
      `"${r.couponCode.replace(/"/g, '""')}"`,
      (r.orderTotal / 100).toFixed(2),
      (r.discountAmount / 100).toFixed(2),
      `"${new Date(r.createdAt).toISOString()}"`,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `promo_redemptions_${new Date().toISOString().slice(0, 10)}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Promo redemptions CSV downloaded')
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
          ) : activeTab === 'redemptions' ? (
            <Button
              variant="outline"
              onClick={exportRedemptionsCSV}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          ) : null
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Active Coupons"
          value={ops.coupons.filter((c) => c.active).length}
          note="Promotional voucher codes"
          icon={Tag}
        />
        <KpiCard
          label="Promo Redemptions"
          value={redemptions.length}
          note="Customer orders with discounts"
          icon={History}
          tone="default"
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
        onValueChange={(val) =>
          setActiveTab(val as 'coupons' | 'banners' | 'reviews' | 'redemptions')
        }
        className="w-full space-y-4"
      >
        <TabsList>
          <TabsTrigger value="coupons" className="gap-2">
            <Tag className="h-3.5 w-3.5" />
            <span>Discount Coupons ({ops.coupons.length})</span>
          </TabsTrigger>
          <TabsTrigger value="redemptions" className="gap-2">
            <History className="h-3.5 w-3.5" />
            <span>Usage History ({redemptions.length})</span>
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
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No coupons found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ops.coupons.map((coupon) => {
                      const usagePercent = Math.round(
                        (coupon.used / (coupon.usageLimit || 1)) * 100,
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
                                  style={{
                                    width: `${Math.min(100, usagePercent)}%`,
                                  }}
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
                            <Badge
                              variant={coupon.active ? 'success' : 'secondary'}
                            >
                              {coupon.active ? 'Active' : 'Expired'}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
                              onClick={() =>
                                setDeleteCouponTarget({
                                  id: coupon.id,
                                  code: coupon.code,
                                })
                              }
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

        <TabsContent value="redemptions" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer, phone, code..."
                value={redemptionSearch}
                onChange={(e) => setRedemptionSearch(e.target.value)}
                className="pl-8 text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={exportRedemptionsCSV}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Promo Code</TableHead>
                    <TableHead>Order Total</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Redeemed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRedemptions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-xs text-muted-foreground"
                      >
                        {redemptionSearch
                          ? 'No redemptions matching search query.'
                          : 'No promo codes redeemed yet.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRedemptions.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-semibold text-foreground text-xs">
                            {r.customerName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-mono">
                            {r.customerPhone}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.customerEmail}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="font-mono font-bold text-xs uppercase"
                          >
                            {r.couponCode}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-medium">
                          {formatNPR(r.orderTotal)}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          -{formatNPR(r.discountAmount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(r.createdAt).toLocaleString('en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </TableCell>
                      </TableRow>
                    ))
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
                <Card
                  key={banner.id}
                  className="overflow-hidden flex flex-col justify-between"
                >
                  <div className="relative h-44 bg-muted">
                    <img
                      src={banner.imageUrl}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent flex flex-col justify-end p-4 text-foreground">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary text-primary-foreground w-fit mb-1">
                        Placement: {banner.placement}
                      </span>
                      <h4 className="text-sm font-semibold text-foreground">
                        {banner.title}
                      </h4>
                      <p className="text-xs text-muted-foreground font-mono">
                        Link: {banner.href}
                      </p>
                    </div>
                  </div>

                  <CardContent className="p-3.5 flex items-center justify-between text-xs border-t border-border">
                    <Badge variant={banner.active ? 'success' : 'secondary'}>
                      {banner.active ? 'Active on store' : 'Inactive'}
                    </Badge>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
                      onClick={() =>
                        setDeleteBannerTarget({
                          id: banner.id,
                          title: banner.title,
                        })
                      }
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
                    <div
                      key={rev.id}
                      className="py-3.5 first:pt-0 last:pb-0 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-foreground">
                            {rev.customerName}
                          </span>
                          <span className="text-muted-foreground ml-2">
                            on {rev.productName}
                          </span>
                          <span className="text-muted-foreground ml-2 font-mono">
                            {rev.createdAt}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center text-warning font-bold">
                            {'★'.repeat(rev.rating)}
                            <span className="text-muted-foreground/30">
                              {'★'.repeat(5 - rev.rating)}
                            </span>
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

                      <p className="text-muted-foreground italic">
                        &ldquo;{rev.body}&rdquo;
                      </p>

                      <div className="pt-1 flex justify-end gap-2">
                        {rev.status !== 'published' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() =>
                              handleUpdateReview(rev.id, 'published')
                            }
                          >
                            <Check className="h-3.5 w-3.5 text-success" />
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
        <DialogContent className="sm:max-w-lg md:max-w-xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
          <form
            onSubmit={handleCreateCoupon}
            className="flex flex-col h-full min-h-0"
          >
            <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-muted/10">
              <DialogTitle className="text-sm font-semibold">
                Create Promo Coupon
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure cart discounts in Neon DB
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 click-scroll">
              <div className="space-y-1.5">
                <Label htmlFor="coupon-code">Coupon Code *</Label>
                <Input
                  id="coupon-code"
                  required
                  value={couponForm.code}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, code: e.target.value })
                  }
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
                    onChange={(e) =>
                      setCouponForm({
                        ...couponForm,
                        value: Number(e.target.value),
                      })
                    }
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
                      setCouponForm({
                        ...couponForm,
                        minOrder: Number(e.target.value),
                      })
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
                      setCouponForm({
                        ...couponForm,
                        usageLimit: Number(e.target.value),
                      })
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
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, expiresAt: e.target.value })
                  }
                />
              </div>
            </div>

            <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddCouponOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Activating...' : 'Activate Coupon'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Banner Dialog */}
      <Dialog open={isAddBannerOpen} onOpenChange={setIsAddBannerOpen}>
        <DialogContent className="sm:max-w-lg md:max-w-xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
          <form
            onSubmit={handleCreateBanner}
            className="flex flex-col h-full min-h-0"
          >
            <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-muted/10">
              <DialogTitle className="text-sm font-semibold">
                Add Campaign Banner
              </DialogTitle>
              <DialogDescription className="text-xs">
                Publish storefront slider tile to Neon DB
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 click-scroll">
              <div className="space-y-1.5">
                <Label htmlFor="banner-title">Banner Title *</Label>
                <Input
                  id="banner-title"
                  required
                  value={bannerForm.title}
                  onChange={(e) =>
                    setBannerForm({ ...bannerForm, title: e.target.value })
                  }
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
                  onChange={(e) =>
                    setBannerForm({ ...bannerForm, imageUrl: e.target.value })
                  }
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
                        placement: e.target.value as
                          'home' | 'drinks' | 'grocery',
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
                    onChange={(e) =>
                      setBannerForm({ ...bannerForm, href: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddBannerOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Publishing...' : 'Publish Banner'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteCouponTarget)}
        onOpenChange={(open) => !open && setDeleteCouponTarget(null)}
        title={`Delete Coupon "${deleteCouponTarget?.code}"?`}
        description="This coupon will be permanently removed. Any pending checkout carts attempting to redeem this voucher will no longer receive the discount."
        confirmLabel="Delete Coupon"
        tone="destructive"
        isLoading={isSubmitting}
        onConfirm={handleDeleteCoupon}
      />

      <ConfirmDialog
        open={Boolean(deleteBannerTarget)}
        onOpenChange={(open) => !open && setDeleteBannerTarget(null)}
        title={`Delete Banner "${deleteBannerTarget?.title}"?`}
        description="This promotional banner will be permanently removed from the storefront hero banner slider."
        confirmLabel="Delete Banner"
        tone="destructive"
        isLoading={isSubmitting}
        onConfirm={handleDeleteBanner}
      />
    </div>
  )
}
