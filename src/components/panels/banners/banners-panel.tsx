import * as React from 'react'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Megaphone,
  Plus,
  Search,
  Eye,
  Trash2,
  Edit2,
  Image as ImageIcon,
  Type as TypeIcon,
  Code as CodeIcon,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Sparkles,
  Layers,
} from 'lucide-react'
import { adminQueries } from '#/queries/admin'
import {
  upsertLandingNoticeFn,
  deleteLandingNoticeFn,
  toggleLandingNoticeFn,
  reorderLandingNoticesFn,
  upsertBannerFn,
  deleteBannerFn,
} from '#/server/operations/operations.functions'
import type {
  LandingNotice,
  NoticeType,
  NoticeColorTheme,
  Banner,
} from '#/server/operations/types'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { Badge } from '#/components/ui/badge'
import { Switch } from '#/components/ui/switch'
import { NativeSelect } from '#/components/ui/native-select'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '#/components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '#/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '#/components/ui/dialog'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'
import { LandingPopup } from '#/components/store/landing-popup'

export function BannersPanel() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery(adminQueries.banners())

  const notices: LandingNotice[] = data?.notices ?? []
  const heroBanners: Banner[] = data?.banners ?? []

  const [activeTab, setActiveTab] = useState<'popups' | 'hero'>('popups')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Notice Form Dialog State
  const [isNoticeDialogOpen, setIsNoticeDialogOpen] = useState(false)
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null)
  const [noticeType, setNoticeType] = useState<NoticeType>('image')

  // Notice Form State
  const [formData, setFormData] = useState<{
    title: string
    active: boolean
    priority: number
    // Image
    imageUrl: string
    imageAlt: string
    linkUrl: string
    linkTarget: '_self' | '_blank'
    imageCaption: string
    imageActionText: string
    // Text
    textBadge: string
    textHeading: string
    textBody: string
    textActionText: string
    textActionUrl: string
    textColorTheme: NoticeColorTheme
    // HTML / CSS
    htmlContent: string
    customCss: string
  }>({
    title: '',
    active: true,
    priority: 1,
    imageUrl: '',
    imageAlt: '',
    linkUrl: '',
    linkTarget: '_self',
    imageCaption: '',
    imageActionText: '',
    textBadge: 'Special Notice',
    textHeading: '',
    textBody: '',
    textActionText: 'Shop Deals',
    textActionUrl: '/drinks',
    textColorTheme: 'default',
    htmlContent: '<div style="padding: 24px; text-align: center;">\n  <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 8px;">Exclusive Offer!</h2>\n  <p style="color: #888; font-size: 14px;">Get 10% off your first liquor and grocery delivery.</p>\n</div>',
    customCss: '',
  })

  // Delete Notice State
  const [deleteNoticeTarget, setDeleteNoticeTarget] = useState<LandingNotice | null>(null)

  // Live Preview State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewNotices, setPreviewNotices] = useState<LandingNotice[]>([])

  // Hero Banner Dialog State
  const [isHeroBannerDialogOpen, setIsHeroBannerDialogOpen] = useState(false)
  const [heroBannerForm, setHeroBannerForm] = useState({
    id: '',
    title: '',
    imageUrl: '',
    href: '/drinks',
    placement: 'home' as 'home' | 'drinks' | 'food',
    active: true,
  })
  const [deleteHeroBannerTarget, setDeleteHeroBannerTarget] = useState<Banner | null>(null)

  // Mutations
  const upsertNoticeMutation = useMutation({
    mutationFn: (payload: any) => upsertLandingNoticeFn({ data: payload }),
    onSuccess: () => {
      toast.success(editingNoticeId ? 'Notice updated' : 'Notice created')
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] })
      queryClient.invalidateQueries({ queryKey: ['storefront', 'landing-popups'] })
      setIsNoticeDialogOpen(false)
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save notice')
    },
  })

  const deleteNoticeMutation = useMutation({
    mutationFn: (id: string) => deleteLandingNoticeFn({ data: { id } }),
    onSuccess: () => {
      toast.success('Notice removed')
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] })
      queryClient.invalidateQueries({ queryKey: ['storefront', 'landing-popups'] })
      setDeleteNoticeTarget(null)
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete notice')
    },
  })

  const toggleNoticeMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      toggleLandingNoticeFn({ data: { id, active } }),
    onSuccess: () => {
      toast.success('Status updated')
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] })
      queryClient.invalidateQueries({ queryKey: ['storefront', 'landing-popups'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to toggle status')
    },
  })

  const reorderNoticeMutation = useMutation({
    mutationFn: (ids: string[]) => reorderLandingNoticesFn({ data: { ids } }),
    onSuccess: () => {
      toast.success('Order saved')
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] })
      queryClient.invalidateQueries({ queryKey: ['storefront', 'landing-popups'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reorder')
    },
  })

  const upsertHeroBannerMutation = useMutation({
    mutationFn: (payload: any) => upsertBannerFn({ data: payload }),
    onSuccess: () => {
      toast.success('Storefront banner published')
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] })
      setIsHeroBannerDialogOpen(false)
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save banner')
    },
  })

  const deleteHeroBannerMutation = useMutation({
    mutationFn: (id: string) => deleteBannerFn({ data: { id } }),
    onSuccess: () => {
      toast.success('Storefront banner deleted')
      queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] })
      setDeleteHeroBannerTarget(null)
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete banner')
    },
  })

  // Filtered Notices
  const filteredNotices = useMemo(() => {
    return notices
      .filter((item) => {
        if (statusFilter === 'active') return item.active
        if (statusFilter === 'inactive') return !item.active
        return true
      })
      .filter((item) => {
        if (!searchQuery.trim()) return true
        const q = searchQuery.toLowerCase()
        return (
          item.title.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q) ||
          (item.textHeading && item.textHeading.toLowerCase().includes(q)) ||
          (item.textBody && item.textBody.toLowerCase().includes(q))
        )
      })
  }, [notices, statusFilter, searchQuery])

  // Move priority up or down
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= notices.length) return

    const newOrder = [...notices]
    const temp = newOrder[index]
    newOrder[index] = newOrder[targetIndex]
    newOrder[targetIndex] = temp

    reorderNoticeMutation.mutate(newOrder.map((n) => n.id))
  }

  // Open Create Dialog
  const handleOpenCreate = () => {
    setEditingNoticeId(null)
    setNoticeType('image')
    setFormData({
      title: '',
      active: true,
      priority: notices.length + 1,
      imageUrl: '',
      imageAlt: '',
      linkUrl: '',
      linkTarget: '_self',
      imageCaption: '',
      imageActionText: 'Shop Deals',
      textBadge: 'Special Notice',
      textHeading: '',
      textBody: '',
      textActionText: 'Order Now',
      textActionUrl: '/drinks',
      textColorTheme: 'default',
      htmlContent: '<div style="padding: 24px; text-align: center;">\n  <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 8px;">Welcome to Mezmani!</h2>\n  <p style="color: #a1a1aa; font-size: 14px;">Instant liquor and food delivery in Nepal.</p>\n</div>',
      customCss: '',
    })
    setIsNoticeDialogOpen(true)
  }

  // Open Edit Dialog
  const handleOpenEdit = (notice: LandingNotice) => {
    setEditingNoticeId(notice.id)
    setNoticeType(notice.type)
    setFormData({
      title: notice.title || '',
      active: notice.active,
      priority: notice.priority,
      imageUrl: notice.imageUrl || '',
      imageAlt: notice.imageAlt || '',
      linkUrl: notice.linkUrl || '',
      linkTarget: notice.linkTarget || '_self',
      imageCaption: notice.imageCaption || '',
      imageActionText: notice.imageActionText || '',
      textBadge: notice.textBadge || '',
      textHeading: notice.textHeading || '',
      textBody: notice.textBody || '',
      textActionText: notice.textActionText || '',
      textActionUrl: notice.textActionUrl || '',
      textColorTheme: notice.textColorTheme || 'default',
      htmlContent: notice.htmlContent || '',
      customCss: notice.customCss || '',
    })
    setIsNoticeDialogOpen(true)
  }

  // Save notice handler
  const handleSaveNotice = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      toast.error('Notice title is required')
      return
    }

    if (noticeType === 'image' && !formData.imageUrl.trim()) {
      toast.error('Please enter an image URL')
      return
    }

    upsertNoticeMutation.mutate({
      id: editingNoticeId || undefined,
      title: formData.title.trim(),
      type: noticeType,
      active: formData.active,
      priority: formData.priority,
      imageUrl: formData.imageUrl.trim(),
      imageAlt: formData.imageAlt.trim(),
      linkUrl: formData.linkUrl.trim(),
      linkTarget: formData.linkTarget,
      imageCaption: formData.imageCaption.trim(),
      imageActionText: formData.imageActionText.trim(),
      textBadge: formData.textBadge.trim(),
      textHeading: formData.textHeading.trim(),
      textBody: formData.textBody.trim(),
      textActionText: formData.textActionText.trim(),
      textActionUrl: formData.textActionUrl.trim(),
      textColorTheme: formData.textColorTheme,
      htmlContent: formData.htmlContent,
      customCss: formData.customCss,
      showOncePerSession: true,
    })
  }

  // Preview all active notices or a single notice
  const handlePreviewAll = () => {
    const active = notices.filter((n) => n.active)
    if (active.length === 0) {
      toast.info('No active notices to preview. Showing all saved notices.')
      setPreviewNotices(notices.length > 0 ? notices : [getDummyNotice()])
    } else {
      setPreviewNotices(active)
    }
    setIsPreviewOpen(true)
  }

  const handlePreviewSingle = (notice: LandingNotice) => {
    setPreviewNotices([{ ...notice, active: true }])
    setIsPreviewOpen(true)
  }

  function getDummyNotice(): LandingNotice {
    return {
      id: 'demo',
      title: 'Sample Welcome Popup',
      type: 'text',
      active: true,
      priority: 1,
      textBadge: 'Special Announcement',
      textHeading: 'Welcome to Mezmani Delivery',
      textBody: 'Enjoy swift delivery of your favorite beverages, snacks, and grocery essentials across Butwal & Kathmandu.',
      textActionText: 'Explore Catalog',
      textActionUrl: '/drinks',
      textColorTheme: 'wine',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  return (
    <div className="flex-1 p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Desk Page Shell Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Website Banners & Popups
            </h1>
            <Badge variant="outline" className="text-xs font-mono">
              Website Management
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage promotional popups, announcement notices, and storefront banners on the Mezmani landing page.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviewAll}
            className="text-xs gap-1.5 shadow-xs"
          >
            <Eye className="h-3.5 w-3.5" />
            Live Preview
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="text-xs gap-1.5 shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Notice
          </Button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-medium">Total Notices</CardDescription>
            <CardTitle className="text-2xl font-bold">{notices.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-muted-foreground">
            Landing page notices
          </CardContent>
        </Card>

        <Card className="shadow-xs border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Active Popups
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {notices.filter((n) => n.active).length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-muted-foreground">
            Visible on store landing
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-medium">Notice Formats</CardDescription>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex items-center gap-1 font-mono text-xs">
                <ImageIcon className="h-3.5 w-3.5" />
                {notices.filter((n) => n.type === 'image').length}
              </span>
              <span className="flex items-center gap-1 font-mono text-xs">
                <TypeIcon className="h-3.5 w-3.5" />
                {notices.filter((n) => n.type === 'text').length}
              </span>
              <span className="flex items-center gap-1 font-mono text-xs">
                <CodeIcon className="h-3.5 w-3.5" />
                {notices.filter((n) => n.type === 'html').length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-muted-foreground">
            Image / Text / HTML
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-medium">Storefront Sliders</CardDescription>
            <CardTitle className="text-2xl font-bold">{heroBanners.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-muted-foreground">
            Hero catalog banners
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'popups' | 'hero')}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="popups" className="gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Landing Page Popups ({notices.length})</span>
            </TabsTrigger>
            <TabsTrigger value="hero" className="gap-2">
              <Layers className="h-3.5 w-3.5" />
              <span>Hero Slider Banners ({heroBanners.length})</span>
            </TabsTrigger>
          </TabsList>

          {activeTab === 'popups' && (
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search notices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>

              <NativeSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs h-8 w-28"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </NativeSelect>
            </div>
          )}

          {activeTab === 'hero' && (
            <Button
              size="sm"
              onClick={() => {
                setHeroBannerForm({
                  id: '',
                  title: '',
                  imageUrl: '',
                  href: '/drinks',
                  placement: 'home',
                  active: true,
                })
                setIsHeroBannerDialogOpen(true)
              }}
              className="text-xs gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Hero Banner
            </Button>
          )}
        </div>

        {/* TAB 1: LANDING PAGE POPUPS */}
        <TabsContent value="popups" className="space-y-4 mt-0">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-muted-foreground">
              Loading banners...
            </div>
          ) : filteredNotices.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Megaphone className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-sm">No landing page notices found</h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
                  Add image notices, text announcements, or custom HTML code popups that will greet visitors on the landing page.
                </p>
                <Button size="sm" onClick={handleOpenCreate} className="text-xs gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Create Your First Notice
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotices.map((notice, index) => (
                <Card
                  key={notice.id}
                  className="flex flex-col justify-between overflow-hidden shadow-xs hover:border-border transition-colors"
                >
                  <CardHeader className="p-4 pb-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {notice.type === 'image' && (
                          <Badge variant="outline" className="text-[11px] gap-1 font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                            <ImageIcon className="h-3 w-3" />
                            Image
                          </Badge>
                        )}
                        {notice.type === 'text' && (
                          <Badge variant="outline" className="text-[11px] gap-1 font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                            <TypeIcon className="h-3 w-3" />
                            Text
                          </Badge>
                        )}
                        {notice.type === 'html' && (
                          <Badge variant="outline" className="text-[11px] gap-1 font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                            <CodeIcon className="h-3 w-3" />
                            HTML/CSS
                          </Badge>
                        )}

                        <span className="text-[11px] text-muted-foreground font-mono">
                          Order #{notice.priority}
                        </span>
                      </div>

                      {/* Active Status Switch */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {notice.active ? 'Active' : 'Inactive'}
                        </span>
                        <Switch
                          checked={notice.active}
                          onCheckedChange={(checked) =>
                            toggleNoticeMutation.mutate({
                              id: notice.id,
                              active: checked,
                            })
                          }
                          aria-label="Toggle active status"
                        />
                      </div>
                    </div>

                    <CardTitle className="text-sm font-semibold truncate" title={notice.title}>
                      {notice.title}
                    </CardTitle>
                  </CardHeader>

                  {/* Notice Preview Thumbnail */}
                  <CardContent className="p-4 pt-0 space-y-3">
                    {notice.type === 'image' && (
                      <div className="relative h-32 w-full rounded-lg bg-muted/30 border border-border/50 overflow-hidden flex items-center justify-center">
                        {notice.imageUrl ? (
                          <img
                            src={notice.imageUrl}
                            alt={notice.imageAlt || notice.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">No image URL</span>
                        )}
                        {notice.linkUrl && (
                          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] text-white flex items-center gap-1">
                            <ExternalLink className="h-2.5 w-2.5" />
                            Link
                          </div>
                        )}
                      </div>
                    )}

                    {notice.type === 'text' && (
                      <div className="h-32 w-full rounded-lg p-3 border border-border/50 bg-muted/20 flex flex-col justify-between overflow-hidden text-xs">
                        <div>
                          {notice.textBadge && (
                            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider block mb-0.5">
                              {notice.textBadge}
                            </span>
                          )}
                          <h4 className="font-semibold text-foreground line-clamp-1">
                            {notice.textHeading || notice.title}
                          </h4>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                            {notice.textBody || 'No text body entered.'}
                          </p>
                        </div>
                        {notice.textActionText && (
                          <span className="text-[10px] text-primary font-medium">
                            Button: {notice.textActionText}
                          </span>
                        )}
                      </div>
                    )}

                    {notice.type === 'html' && (
                      <div className="h-32 w-full rounded-lg p-2.5 border border-border/50 bg-zinc-950 text-zinc-300 font-mono text-[10px] overflow-hidden overflow-ellipsis">
                        <code>{notice.htmlContent?.slice(0, 180) || '<p>HTML Code</p>'}</code>
                      </div>
                    )}

                    {/* Controls Footer */}
                    <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          disabled={index === 0}
                          onClick={() => handleMove(index, 'up')}
                          title="Move Up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          disabled={index === filteredNotices.length - 1}
                          onClick={() => handleMove(index, 'down')}
                          title="Move Down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => handlePreviewSingle(notice)}
                          title="Preview Popup"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenEdit(notice)}
                          title="Edit Notice"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteNoticeTarget(notice)}
                          title="Delete Notice"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: STOREFRONT HERO SLIDERS */}
        <TabsContent value="hero" className="space-y-4 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {heroBanners.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-muted-foreground text-sm">
                No hero banners published yet.
              </div>
            ) : (
              heroBanners.map((banner) => (
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
                      onClick={() => setDeleteHeroBannerTarget(banner)}
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
      </Tabs>

      {/* CREATE / EDIT NOTICE DIALOG */}
      <Dialog open={isNoticeDialogOpen} onOpenChange={setIsNoticeDialogOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl w-[calc(100%-2rem)] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
          <form onSubmit={handleSaveNotice} className="flex flex-col h-full min-h-0">
            <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border shrink-0 bg-muted/10">
              <DialogTitle className="text-base font-semibold">
                {editingNoticeId ? 'Edit Landing Popup Notice' : 'Add Landing Popup Notice'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configure an image popup, text announcement, or custom HTML code banner with an X button to close.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Type Switcher */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Notice Type *</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNoticeType('image')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                      noticeType === 'image'
                        ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                        : 'border-border hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <ImageIcon className="h-4 w-4" />
                    Image Notice
                  </button>

                  <button
                    type="button"
                    onClick={() => setNoticeType('text')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                      noticeType === 'text'
                        ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                        : 'border-border hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <TypeIcon className="h-4 w-4" />
                    Text Notice
                  </button>

                  <button
                    type="button"
                    onClick={() => setNoticeType('html')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                      noticeType === 'html'
                        ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                        : 'border-border hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <CodeIcon className="h-4 w-4" />
                    HTML / CSS
                  </button>
                </div>
              </div>

              {/* Notice Title */}
              <div className="space-y-1.5">
                <Label htmlFor="notice-title" className="text-xs">
                  Title (Internal / Heading) *
                </Label>
                <Input
                  id="notice-title"
                  required
                  placeholder="e.g. Festival Delivery Update, 20% Off Liquor Deals"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="text-xs"
                />
              </div>

              {/* 1. IMAGE FORM FIELDS */}
              {noticeType === 'image' && (
                <div className="space-y-3.5 border rounded-lg p-3.5 bg-muted/10">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-primary" />
                    Image Configuration
                  </h4>

                  <div className="space-y-1.5">
                    <Label htmlFor="notice-img" className="text-xs">Image URL *</Label>
                    <Input
                      id="notice-img"
                      type="url"
                      placeholder="https://images.unsplash.com/photo-..."
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  {formData.imageUrl && (
                    <div className="relative max-h-36 w-full rounded-md border overflow-hidden bg-muted flex items-center justify-center">
                      <img
                        src={formData.imageUrl}
                        alt="Preview"
                        className="max-h-36 w-full object-contain"
                        onError={(e) => {
                          ;(e.target as HTMLElement).style.display = 'none'
                        }}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="notice-img-alt" className="text-xs">Image Alt Text</Label>
                      <Input
                        id="notice-img-alt"
                        placeholder="e.g. Dashain discounts"
                        value={formData.imageAlt}
                        onChange={(e) => setFormData({ ...formData, imageAlt: e.target.value })}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="notice-action-text" className="text-xs">Button Text (Optional)</Label>
                      <Input
                        id="notice-action-text"
                        placeholder="e.g. Shop Now, Claim Offer"
                        value={formData.imageActionText}
                        onChange={(e) => setFormData({ ...formData, imageActionText: e.target.value })}
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="notice-link" className="text-xs">Click Link / Destination URL</Label>
                      <Input
                        id="notice-link"
                        placeholder="e.g. /drinks or /food"
                        value={formData.linkUrl}
                        onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="notice-target" className="text-xs">Link Target</Label>
                      <NativeSelect
                        id="notice-target"
                        value={formData.linkTarget}
                        onChange={(e) =>
                          setFormData({ ...formData, linkTarget: e.target.value as any })
                        }
                        className="text-xs"
                      >
                        <option value="_self">Same tab (_self)</option>
                        <option value="_blank">New tab (_blank)</option>
                      </NativeSelect>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notice-caption" className="text-xs">Image Caption / Note (Optional)</Label>
                    <Textarea
                      id="notice-caption"
                      rows={2}
                      placeholder="Brief note or disclaimer below the image banner..."
                      value={formData.imageCaption}
                      onChange={(e) => setFormData({ ...formData, imageCaption: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                </div>
              )}

              {/* 2. TEXT FORM FIELDS */}
              {noticeType === 'text' && (
                <div className="space-y-3.5 border rounded-lg p-3.5 bg-muted/10">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <TypeIcon className="h-3.5 w-3.5 text-primary" />
                    Text Content & Styling
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="notice-badge" className="text-xs">Badge Tag</Label>
                      <Input
                        id="notice-badge"
                        placeholder="e.g. Announcement, Limited Offer"
                        value={formData.textBadge}
                        onChange={(e) => setFormData({ ...formData, textBadge: e.target.value })}
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="notice-theme" className="text-xs">Visual Color Theme</Label>
                      <NativeSelect
                        id="notice-theme"
                        value={formData.textColorTheme}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            textColorTheme: e.target.value as NoticeColorTheme,
                          })
                        }
                        className="text-xs"
                      >
                        <option value="default">Clean Dark/Light (Default)</option>
                        <option value="dark">Charcoal Black (Dark)</option>
                        <option value="wine">Mezmani Wine Red</option>
                        <option value="emerald">Deep Emerald Green</option>
                        <option value="amber">Warm Amber Gold</option>
                        <option value="blue">Royal Sapphire Blue</option>
                      </NativeSelect>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notice-headline" className="text-xs">Notice Headline</Label>
                    <Input
                      id="notice-headline"
                      placeholder="e.g. Free Delivery on Orders Above Rs. 2,000"
                      value={formData.textHeading}
                      onChange={(e) => setFormData({ ...formData, textHeading: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notice-body" className="text-xs">Body Message / Content</Label>
                    <Textarea
                      id="notice-body"
                      rows={3}
                      placeholder="Enter detailed notice message here..."
                      value={formData.textBody}
                      onChange={(e) => setFormData({ ...formData, textBody: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="notice-action-btn" className="text-xs">Action Button Text</Label>
                      <Input
                        id="notice-action-btn"
                        placeholder="e.g. Order Drinks"
                        value={formData.textActionText}
                        onChange={(e) =>
                          setFormData({ ...formData, textActionText: e.target.value })
                        }
                        className="text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="notice-action-url" className="text-xs">Action Button Link</Label>
                      <Input
                        id="notice-action-url"
                        placeholder="e.g. /drinks or /food"
                        value={formData.textActionUrl}
                        onChange={(e) =>
                          setFormData({ ...formData, textActionUrl: e.target.value })
                        }
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 3. HTML & CSS FORM FIELDS */}
              {noticeType === 'html' && (
                <div className="space-y-3.5 border rounded-lg p-3.5 bg-muted/10">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <CodeIcon className="h-3.5 w-3.5 text-primary" />
                    Custom HTML & CSS Code
                  </h4>

                  <div className="space-y-1.5">
                    <Label htmlFor="notice-html" className="text-xs">HTML Code *</Label>
                    <Textarea
                      id="notice-html"
                      rows={6}
                      placeholder="<div class='custom-banner'>...</div>"
                      value={formData.htmlContent}
                      onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
                      className="font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notice-css" className="text-xs">Custom CSS Styles (Optional)</Label>
                    <Textarea
                      id="notice-css"
                      rows={3}
                      placeholder="h2 { color: #f43f5e; } p { font-size: 13px; }"
                      value={formData.customCss}
                      onChange={(e) => setFormData({ ...formData, customCss: e.target.value })}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              {/* General Options */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div className="space-y-1.5">
                  <Label htmlFor="notice-priority" className="text-xs">Priority / Sequence Order</Label>
                  <Input
                    id="notice-priority"
                    type="number"
                    min={1}
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })
                    }
                    className="text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Lower numbers display first (e.g. 1 before 2)
                  </p>
                </div>

                <div className="space-y-1.5 flex flex-col justify-center">
                  <div className="flex items-center gap-2 pt-3">
                    <Switch
                      id="notice-active"
                      checked={formData.active}
                      onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                    />
                    <Label htmlFor="notice-active" className="text-xs font-semibold cursor-pointer">
                      Publish on Landing Page
                    </Label>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Notice will be active immediately when checked
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="p-3 sm:p-4 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNoticeDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={upsertNoticeMutation.isPending}
              >
                {upsertNoticeMutation.isPending ? 'Saving...' : editingNoticeId ? 'Update Notice' : 'Publish Notice'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE HERO BANNER DIALOG */}
      <Dialog open={isHeroBannerDialogOpen} onOpenChange={setIsHeroBannerDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              upsertHeroBannerMutation.mutate(heroBannerForm)
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold">
                Add Hero Slider Banner
              </DialogTitle>
              <DialogDescription className="text-xs">
                Publish a wide image banner to store hero sliders.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label htmlFor="hero-title">Title *</Label>
                <Input
                  id="hero-title"
                  required
                  placeholder="e.g. Single Malt Deals"
                  value={heroBannerForm.title}
                  onChange={(e) =>
                    setHeroBannerForm({ ...heroBannerForm, title: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="hero-img">Image URL *</Label>
                <Input
                  id="hero-img"
                  type="url"
                  required
                  placeholder="https://..."
                  value={heroBannerForm.imageUrl}
                  onChange={(e) =>
                    setHeroBannerForm({ ...heroBannerForm, imageUrl: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="hero-placement">Placement</Label>
                  <NativeSelect
                    id="hero-placement"
                    value={heroBannerForm.placement}
                    onChange={(e) =>
                      setHeroBannerForm({
                        ...heroBannerForm,
                        placement: e.target.value as any,
                      })
                    }
                  >
                    <option value="home">Home Page Hero</option>
                    <option value="drinks">Drinks Catalog</option>
                    <option value="food">Food Catalog</option>
                  </NativeSelect>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="hero-href">Link URL</Label>
                  <Input
                    id="hero-href"
                    value={heroBannerForm.href}
                    onChange={(e) =>
                      setHeroBannerForm({ ...heroBannerForm, href: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsHeroBannerDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={upsertHeroBannerMutation.isPending}
              >
                {upsertHeroBannerMutation.isPending ? 'Publishing...' : 'Publish'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DELETE NOTICE DIALOG */}
      <ConfirmDialog
        open={!!deleteNoticeTarget}
        onOpenChange={(open) => !open && setDeleteNoticeTarget(null)}
        title="Delete Landing Notice?"
        description={`Are you sure you want to delete the notice "${deleteNoticeTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete Notice"
        tone="destructive"
        isLoading={deleteNoticeMutation.isPending}
        onConfirm={() => {
          if (deleteNoticeTarget) {
            deleteNoticeMutation.mutate(deleteNoticeTarget.id)
          }
        }}
      />

      {/* CONFIRM DELETE HERO BANNER DIALOG */}
      <ConfirmDialog
        open={!!deleteHeroBannerTarget}
        onOpenChange={(open) => !open && setDeleteHeroBannerTarget(null)}
        title="Delete Hero Banner?"
        description={`Delete banner "${deleteHeroBannerTarget?.title}" from storefront?`}
        confirmLabel="Delete Banner"
        tone="destructive"
        isLoading={deleteHeroBannerMutation.isPending}
        onConfirm={() => {
          if (deleteHeroBannerTarget) {
            deleteHeroBannerMutation.mutate(deleteHeroBannerTarget.id)
          }
        }}
      />

      {/* LIVE PREVIEW POPUP MODAL */}
      <LandingPopup
        notices={previewNotices}
        forceOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  )
}
