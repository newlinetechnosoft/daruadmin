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
import type { Coupon, Banner, Review } from '#/server/operations/types'
import { formatNPR } from '#/lib/money'
import { PageHeader } from '#/components/admin/page-header'
import { KpiCard } from '#/components/admin/kpi-card'
import {
  pageClass,
  cardClass,
  tableWrap,
  thClass,
  tdClass,
  btnPrimary,
  btnSecondary,
  btnGhost,
  inputClass,
  selectClass,
  labelClass,
} from '#/components/admin/styles'
import {
  Megaphone,
  Tag,
  Star,
  Plus,
  Copy,
  Trash2,
  CheckCircle,
  Eye,
  X,
  Check,
  XCircle,
  Sparkles,
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
    <div className={pageClass}>
      <PageHeader
        kicker="Growth"
        title="Marketing & Promotions"
        description="Discount promo vouchers, storefront campaign banners, and verified customer review moderation."
        actions={
          activeTab === 'coupons' ? (
            <button type="button" onClick={() => setIsAddCouponOpen(true)} className={btnPrimary}>
              <Plus className="h-4 w-4" />
              Create Coupon
            </button>
          ) : activeTab === 'banners' ? (
            <button type="button" onClick={() => setIsAddBannerOpen(true)} className={btnPrimary}>
              <Plus className="h-4 w-4" />
              Add Banner
            </button>
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
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('coupons')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 cursor-pointer transition ${
            activeTab === 'coupons'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Discount Coupons ({ops.coupons.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('banners')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 cursor-pointer transition ${
            activeTab === 'banners'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>Campaign Banners ({ops.banners.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 cursor-pointer transition ${
            activeTab === 'reviews'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Star className="w-4 h-4" />
          <span>Review Moderation ({ops.reviews.length})</span>
        </button>
      </div>

      {activeTab === 'coupons' ? (
        /* Coupons Table */
        <div className={tableWrap}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className={thClass}>Promo Code</th>
                  <th className={thClass}>Discount Value</th>
                  <th className={thClass}>Min Cart Spend</th>
                  <th className={thClass}>Redemption Usage</th>
                  <th className={thClass}>Expires</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ops.coupons.map((coupon) => {
                  const usagePercent = Math.round((coupon.used / (coupon.usageLimit || 1)) * 100)
                  return (
                    <tr key={coupon.id} className="hover:bg-slate-50/70 transition">
                      <td className={tdClass}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                            {coupon.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(coupon.code)}
                            className="text-slate-400 hover:text-slate-600 p-1"
                            title="Copy coupon code"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>

                      <td className={tdClass}>
                        <span className="font-bold text-slate-900">
                          {coupon.type === 'percent'
                            ? `${coupon.value}% OFF`
                            : `Flat ${formatNPR(coupon.value)} OFF`}
                        </span>
                      </td>

                      <td className={tdClass}>
                        <span className="font-mono text-slate-700 font-semibold">
                          {formatNPR(coupon.minOrder)}
                        </span>
                      </td>

                      <td className={tdClass}>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-blue-600 h-full rounded-full"
                              style={{ width: `${Math.min(100, usagePercent)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 font-medium font-mono">
                            {coupon.used} / {coupon.usageLimit}
                          </span>
                        </div>
                      </td>

                      <td className={tdClass}>
                        <span className="text-xs text-slate-500">{coupon.expiresAt}</span>
                      </td>

                      <td className={tdClass}>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                            coupon.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {coupon.active ? 'Active' : 'Expired'}
                        </span>
                      </td>

                      <td className={`${tdClass} text-right`}>
                        <button
                          type="button"
                          onClick={() => handleDeleteCoupon(coupon.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                          title="Delete coupon"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'banners' ? (
        /* Banners Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ops.banners.map((banner) => (
            <div
              key={banner.id}
              className={`${cardClass} overflow-hidden flex flex-col justify-between hover:shadow-md transition`}
            >
              <div className="relative h-44 bg-slate-900">
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="w-full h-full object-cover opacity-85"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent flex flex-col justify-end p-4 text-white">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-600 w-fit mb-1 uppercase">
                    Placement: {banner.placement}
                  </span>
                  <h4 className="text-base font-bold text-white">{banner.title}</h4>
                  <p className="text-xs text-slate-300 font-mono">Link: {banner.href}</p>
                </div>
              </div>

              <div className="p-4 flex items-center justify-between text-xs border-t border-slate-100">
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                    banner.active
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {banner.active ? 'Active On Store' : 'Inactive'}
                </span>

                <button
                  type="button"
                  onClick={() => handleDeleteBanner(banner.id)}
                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                  title="Delete banner"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Customer Reviews */
        <div className={`${cardClass} p-5 space-y-4`}>
          <div className="divide-y divide-slate-100">
            {ops.reviews.map((rev) => (
              <div key={rev.id} className="py-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-900">{rev.customerName}</span>
                    <span className="text-slate-400 ml-2">&bull; on {rev.productName}</span>
                    <span className="text-slate-400 ml-2">{rev.createdAt}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center text-amber-500 font-bold">
                      {'★'.repeat(rev.rating)}
                      <span className="text-slate-300">{'★'.repeat(5 - rev.rating)}</span>
                    </div>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        rev.status === 'published'
                          ? 'bg-emerald-100 text-emerald-800'
                          : rev.status === 'hidden'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {rev.status}
                    </span>
                  </div>
                </div>

                <p className="text-slate-700 italic">"{rev.body}"</p>

                <div className="pt-2 flex justify-end gap-2">
                  {rev.status !== 'published' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateReview(rev.id, 'published')}
                      className={btnSecondary}
                      style={{ height: '30px', padding: '0 10px', fontSize: '11px' }}
                    >
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Approve
                    </button>
                  )}
                  {rev.status !== 'hidden' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateReview(rev.id, 'hidden')}
                      className={btnSecondary}
                      style={{ height: '30px', padding: '0 10px', fontSize: '11px' }}
                    >
                      <XCircle className="h-3.5 w-3.5 text-rose-600" />
                      Hide
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Coupon Modal */}
      {isAddCouponOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create Promo Coupon</h3>
                <p className="text-xs text-slate-500">Configure cart discounts in Neon DB</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCouponOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="space-y-3.5 text-xs">
              <div>
                <label className={labelClass}>Coupon Code *</label>
                <input
                  type="text"
                  required
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })}
                  placeholder="e.g. TIHAR2026, FESTIVE15"
                  className={`${inputClass} font-mono font-bold uppercase`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Discount Type</label>
                  <select
                    value={couponForm.type}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, type: e.target.value as any })
                    }
                    className={selectClass}
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Flat Amount (NPR)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Discount Value *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={couponForm.value}
                    onChange={(e) => setCouponForm({ ...couponForm, value: Number(e.target.value) })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Minimum Cart Spend (NPR)</label>
                  <input
                    type="number"
                    min="0"
                    value={couponForm.minOrder}
                    onChange={(e) => setCouponForm({ ...couponForm, minOrder: Number(e.target.value) })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Usage Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={couponForm.usageLimit}
                    onChange={(e) => setCouponForm({ ...couponForm, usageLimit: Number(e.target.value) })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Expiry Date</label>
                <input
                  type="date"
                  value={couponForm.expiresAt}
                  onChange={(e) => setCouponForm({ ...couponForm, expiresAt: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCouponOpen(false)}
                  className={btnSecondary}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className={btnPrimary}>
                  {isSubmitting ? 'Activating...' : 'Activate Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Banner Modal */}
      {isAddBannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Campaign Banner</h3>
                <p className="text-xs text-slate-500">Publish storefront slider tile to Neon DB</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddBannerOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBanner} className="space-y-3.5 text-xs">
              <div>
                <label className={labelClass}>Banner Title *</label>
                <input
                  type="text"
                  required
                  value={bannerForm.title}
                  onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                  placeholder="e.g. Premium Single Malt Scotch Deals"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Image URL *</label>
                <input
                  type="url"
                  required
                  value={bannerForm.imageUrl}
                  onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Target Placement</label>
                  <select
                    value={bannerForm.placement}
                    onChange={(e) =>
                      setBannerForm({ ...bannerForm, placement: e.target.value as any })
                    }
                    className={selectClass}
                  >
                    <option value="home">Homepage Hero</option>
                    <option value="drinks">Liquor Drinks Catalog</option>
                    <option value="grocery">Grocery Catalog</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Link Href</label>
                  <input
                    type="text"
                    value={bannerForm.href}
                    onChange={(e) => setBannerForm({ ...bannerForm, href: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddBannerOpen(false)}
                  className={btnSecondary}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className={btnPrimary}>
                  {isSubmitting ? 'Publishing...' : 'Publish Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
