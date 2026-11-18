import * as React from 'react'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Megaphone,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Send,
  RefreshCw,
  Eye,
  Trash2,
  Plus,
  Search,
  Users,
  Smartphone,
  Bell,
  Mail,
  MessageSquare,
  ShieldAlert,
  Globe,
  ArrowRight,
  TrendingUp,
  RotateCcw,
} from 'lucide-react'
import { adminQueries } from '#/queries/admin'
import {
  saveCampaignDraftFn,
  scheduleCampaignFn,
  publishCampaignNowFn,
  rescheduleCampaignFn,
  cancelScheduledCampaignFn,
  deleteCampaignFn,
  reconcileCampaignsFn,
} from '#/server/operations/campaign.functions'
import type {
  Campaign,
  CampaignStatus,
  CampaignChannel,
  CampaignDeliveryItem,
} from '#/server/operations/types'
import {
  SUPPORTED_TIMEZONES,
  DEFAULT_TIMEZONE,
  getTimezoneMeta,
  formatInTimezone,
  validateCampaignSchedule,
  formatUtcToParts,
} from '#/lib/campaign-timezone'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { Badge } from '#/components/ui/badge'
import { NativeSelect } from '#/components/ui/native-select'
import { Card, CardContent } from '#/components/ui/card'
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '#/components/ui/dialog'
import { ConfirmDialog } from '#/components/shared/confirm-dialog'

const STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; tone: string; icon: React.ComponentType<{ className?: string }> }
> = {
  draft: {
    label: 'Draft',
    tone: 'bg-muted text-muted-foreground border-border',
    icon: Clock,
  },
  scheduled: {
    label: 'Scheduled',
    tone: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
    icon: Calendar,
  },
  publishing: {
    label: 'Publishing',
    tone: 'bg-blue-500/10 text-blue-600 border-blue-500/30 animate-pulse',
    icon: RefreshCw,
  },
  published: {
    label: 'Published',
    tone: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    icon: CheckCircle2,
  },
  expired: {
    label: 'Expired',
    tone: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
    icon: Clock,
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
    icon: XCircle,
  },
  failed: {
    label: 'Failed',
    tone: 'bg-destructive/10 text-destructive border-destructive/30',
    icon: AlertCircle,
  },
}

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All Registered Users', desc: 'Broadcast to entire user base' },
  { value: 'customers', label: 'Past Customers', desc: 'Users who have completed >= 1 order' },
  { value: 'active_30d', label: 'Active (Last 30 Days)', desc: 'Frequent & recent buyers' },
  { value: 'inactive_60d', label: 'Dormant (60+ Days Inactive)', desc: 'Win-back reactivation campaign' },
  { value: 'riders', label: 'Delivery Riders', desc: 'Operations & logistics fleet' },
  { value: 'staff', label: 'Admin & Staff', desc: 'Internal test & team announcements' },
]

export function CampaignsTab() {
  const queryClient = useQueryClient()
  const { data: rawCampaigns = [], isLoading } = useQuery(
    adminQueries.campaigns(),
  )
  const campaignsList: Campaign[] = Array.isArray(rawCampaigns)
    ? (rawCampaigns as Campaign[])
    : []

  const [statusFilter, setStatusFilter] = useState<'all' | CampaignStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Create / Edit Dialog State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)
  const [publishOption, setPublishOption] = useState<'schedule' | 'now' | 'draft'>('schedule')

  // Form State
  const [formState, setFormState] = useState({
    name: '',
    title: '',
    channels: ['push', 'in-app'] as CampaignChannel[],
    audience: 'all',
    body: '',
    imageUrl: '',
    ctaUrl: '/drinks',
    ctaText: 'Claim Offer',
    bannerPlacement: 'none' as 'none' | 'home' | 'drinks' | 'food' | 'all',
    offerSlug: '',
    scheduledDate: '',
    scheduledTime: '12:00',
    expiryDate: '',
    expiryTime: '23:59',
    timezone: DEFAULT_TIMEZONE,
  })

  // Live Audience Estimate Query
  const { data: audienceEstimate } = useQuery(
    adminQueries.audienceEstimate(formState.audience),
  )

  // Admin Campaign Preview State (Requirement 7)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewConfirmedAll, setPreviewConfirmedAll] = useState(false)

  // Reschedule Dialog State (Requirement 2 & 5)
  const [rescheduleTarget, setRescheduleTarget] = useState<Campaign | null>(null)
  const [rescheduleForm, setRescheduleForm] = useState({
    scheduledDate: '',
    scheduledTime: '',
    expiryDate: '',
    expiryTime: '',
    timezone: DEFAULT_TIMEZONE,
  })

  // Cancel & Delete Dialog State
  const [cancelTarget, setCancelTarget] = useState<Campaign | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null)

  // Analytics & Delivery Log State (Requirement 8)
  const [analyticsTarget, setAnalyticsTarget] = useState<Campaign | null>(null)
  const { data: deliveriesList = [], isLoading: isLoadingDeliveries } = useQuery(
    adminQueries.campaignDeliveries(analyticsTarget?.id || ''),
  )

  // Mutations
  const invalidateCampaigns = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'marketing'] })
  }

  const saveDraftMutation = useMutation({
    mutationFn: (payload: any) => saveCampaignDraftFn({ data: payload }),
    onSuccess: () => {
      toast.success('Campaign draft saved successfully')
      setIsFormOpen(false)
      invalidateCampaigns()
    },
    onError: (err) => toast.error(`Failed to save draft: ${err.message}`),
  })

  const scheduleMutation = useMutation({
    mutationFn: (payload: any) => scheduleCampaignFn({ data: payload }),
    onSuccess: (res) => {
      toast.success(res.message || 'Campaign scheduled successfully')
      setIsFormOpen(false)
      setIsPreviewOpen(false)
      invalidateCampaigns()
    },
    onError: (err) => toast.error(`Failed to schedule campaign: ${err.message}`),
  })

  const publishNowMutation = useMutation({
    mutationFn: (payload: any) => publishCampaignNowFn({ data: payload }),
    onSuccess: (res) => {
      toast.success(res.message || 'Campaign published and delivered successfully!')
      setIsFormOpen(false)
      setIsPreviewOpen(false)
      invalidateCampaigns()
    },
    onError: (err) => toast.error(`Failed to publish: ${err.message}`),
  })

  const rescheduleMutation = useMutation({
    mutationFn: (payload: any) => rescheduleCampaignFn({ data: payload }),
    onSuccess: () => {
      toast.success('Campaign rescheduled successfully')
      setRescheduleTarget(null)
      invalidateCampaigns()
    },
    onError: (err) => toast.error(`Failed to reschedule: ${err.message}`),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelScheduledCampaignFn({ data: { id } }),
    onSuccess: () => {
      toast.success('Scheduled campaign cancelled. Pending delivery prevented.')
      setCancelTarget(null)
      invalidateCampaigns()
    },
    onError: (err) => toast.error(`Failed to cancel: ${err.message}`),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCampaignFn({ data: { id } }),
    onSuccess: () => {
      toast.success('Campaign moved to recycle bin')
      setDeleteTarget(null)
      invalidateCampaigns()
    },
    onError: (err) => toast.error(`Failed to delete: ${err.message}`),
  })

  const reconcileMutation = useMutation({
    mutationFn: () => reconcileCampaignsFn(),
    onSuccess: (report) => {
      toast.success(
        `Scheduler reconciliation complete: ${report.publishedCount} published, ${report.expiredCount} expired, ${report.resumedCount} resumed.`,
      )
      invalidateCampaigns()
    },
    onError: (err) => toast.error(`Reconciliation failed: ${err.message}`),
  })

  // Open Edit Form
  const handleOpenEdit = (c: Campaign) => {
    setEditingCampaignId(c.id)
    const scheduledParts = formatUtcToParts(c.scheduledAt, c.timezone)
    const expiryParts = c.expiresAt ? formatUtcToParts(c.expiresAt, c.timezone) : { dateStr: '', timeStr: '' }

    setFormState({
      name: c.name,
      title: c.title || c.name,
      channels: c.channels.length > 0 ? c.channels : [c.channel],
      audience: c.audience,
      body: c.body,
      imageUrl: c.imageUrl || '',
      ctaUrl: c.ctaUrl || '/drinks',
      ctaText: c.ctaText || 'Claim Offer',
      bannerPlacement: (c.bannerPlacement as any) || 'none',
      offerSlug: c.offerSlug || '',
      scheduledDate: c.scheduledDate || scheduledParts.dateStr,
      scheduledTime: c.scheduledTime || scheduledParts.timeStr,
      expiryDate: c.expiryDate || expiryParts.dateStr,
      expiryTime: c.expiryTime || expiryParts.timeStr,
      timezone: c.timezone || DEFAULT_TIMEZONE,
    })
    setPublishOption(c.status === 'draft' ? 'schedule' : (c.status === 'scheduled' ? 'schedule' : 'now'))
    setIsFormOpen(true)
  }

  // Open Create Form with Nepal Defaults
  const handleOpenCreate = () => {
    setEditingCampaignId(null)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const schedParts = formatUtcToParts(tomorrow, DEFAULT_TIMEZONE)
    const expParts = formatUtcToParts(nextWeek, DEFAULT_TIMEZONE)

    setFormState({
      name: '',
      title: '',
      channels: ['push', 'in-app'],
      audience: 'all',
      body: '',
      imageUrl: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800&auto=format&fit=crop&q=80',
      ctaUrl: '/drinks',
      ctaText: 'Claim Offer',
      bannerPlacement: 'none',
      offerSlug: '',
      scheduledDate: schedParts.dateStr,
      scheduledTime: '12:00',
      expiryDate: expParts.dateStr,
      expiryTime: '23:59',
      timezone: DEFAULT_TIMEZONE,
    })
    setPublishOption('schedule')
    setIsFormOpen(true)
  }

  // Open Reschedule Dialog
  const handleOpenReschedule = (c: Campaign) => {
    setRescheduleTarget(c)
    const schedParts = formatUtcToParts(c.scheduledAt, c.timezone)
    const expParts = c.expiresAt ? formatUtcToParts(c.expiresAt, c.timezone) : { dateStr: '', timeStr: '' }

    setRescheduleForm({
      scheduledDate: c.scheduledDate || schedParts.dateStr,
      scheduledTime: c.scheduledTime || schedParts.timeStr,
      expiryDate: c.expiryDate || expParts.dateStr,
      expiryTime: c.expiryTime || expParts.timeStr,
      timezone: c.timezone || DEFAULT_TIMEZONE,
    })
  }

  // Form Submit handler
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formState.name.trim() || !formState.body.trim()) {
      toast.error('Campaign Name and Announcement Body are required')
      return
    }

    if (formState.channels.length === 0) {
      toast.error('Select at least one notification delivery channel')
      return
    }

    if (publishOption === 'draft') {
      saveDraftMutation.mutate({
        id: editingCampaignId || undefined,
        ...formState,
      })
      return
    }

    // Schedule or Publish Now triggers Campaign Preview Modal (Requirement 7)
    const val = validateCampaignSchedule({
      scheduledDate: formState.scheduledDate,
      scheduledTime: formState.scheduledTime,
      expiryDate: formState.expiryDate,
      expiryTime: formState.expiryTime,
      timezone: formState.timezone,
      isDraft: false,
      isPublishNow: publishOption === 'now',
    })

    if (!val.valid) {
      toast.error(val.errors.join('\n'))
      return
    }

    setPreviewConfirmedAll(false)
    setIsPreviewOpen(true)
  }

  // Confirm and Execute from Preview Modal
  const handleConfirmPublishFromPreview = () => {
    if (formState.audience === 'all' && !previewConfirmedAll) {
      toast.error('Please confirm acknowledgment before sending to ALL users')
      return
    }

    if (publishOption === 'now') {
      publishNowMutation.mutate({
        id: editingCampaignId || undefined,
        campaignData: {
          id: editingCampaignId || undefined,
          ...formState,
        },
      })
    } else {
      scheduleMutation.mutate({
        id: editingCampaignId || undefined,
        ...formState,
      })
    }
  }

  // Channel toggling helper
  const toggleChannel = (ch: CampaignChannel) => {
    if (formState.channels.includes(ch)) {
      if (formState.channels.length === 1) {
        toast.error('At least one channel must remain selected')
        return
      }
      setFormState({
        ...formState,
        channels: formState.channels.filter((c) => c !== ch),
      })
    } else {
      setFormState({
        ...formState,
        channels: [...formState.channels, ch],
      })
    }
  }

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaignsList.filter((c) => {
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        !query ||
        c.name.toLowerCase().includes(query) ||
        (c.title && c.title.toLowerCase().includes(query)) ||
        c.body.toLowerCase().includes(query) ||
        c.audience.toLowerCase().includes(query) ||
        c.channel.toLowerCase().includes(query)

      return matchesStatus && matchesSearch
    })
  }, [campaignsList, statusFilter, searchQuery])

  // Counts for status filters
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: campaignsList.length }
    for (const c of campaignsList) {
      counts[c.status] = (counts[c.status] || 0) + 1
    }
    return counts
  }, [campaignsList])

  return (
    <div className="space-y-6">
      {/* Top Controls & Reconciliation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Filter announcements & campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reconcileMutation.mutate()}
            disabled={reconcileMutation.isPending}
            title="Recover missed scheduled jobs & sync expiry"
            className="gap-1.5 text-xs h-9"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${reconcileMutation.isPending ? 'animate-spin' : ''}`} />
            <span>Reconcile Overdue</span>
          </Button>
        </div>

        <Button onClick={handleOpenCreate} className="gap-1.5 text-xs h-9">
          <Plus className="h-4 w-4" />
          <span>New Announcement Campaign</span>
        </Button>
      </div>

      {/* Status Filter Badges (Requirement 8) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-full font-medium transition-colors border ${
            statusFilter === 'all'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted border-transparent'
          }`}
        >
          All ({statusCounts.all || 0})
        </button>

        {(
          [
            'draft',
            'scheduled',
            'publishing',
            'published',
            'expired',
            'cancelled',
            'failed',
          ] as CampaignStatus[]
        ).map((status) => {
          const cfg = STATUS_CONFIG[status]
          const count = statusCounts[status] || 0
          const isSelected = statusFilter === status
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-full font-medium transition-colors border flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-foreground text-background border-foreground font-semibold'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted border-border/50'
              }`}
            >
              <span>{cfg.label}</span>
              <span className="text-[11px] opacity-75 font-mono">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Campaigns Listing Table (Requirement 6) */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign & Announcement</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Target Audience</TableHead>
                <TableHead>Scheduled Publish</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status & Progress</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground text-xs">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-muted-foreground" />
                    Loading scheduled campaigns...
                  </TableCell>
                </TableRow>
              ) : filteredCampaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground text-xs">
                    No announcement campaigns found matching the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredCampaigns.map((c) => {
                  const statusCfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.draft
                  const StatusIcon = statusCfg.icon
                  const meta = getTimezoneMeta(c.timezone)
                  const progress = c.deliveryProgress

                  return (
                    <TableRow key={c.id}>
                      {/* Title & Body Snippet */}
                      <TableCell className="max-w-xs">
                        <div className="flex items-start gap-2.5">
                          {c.imageUrl ? (
                            <img
                              src={c.imageUrl}
                              alt={c.name}
                              className="h-10 w-10 rounded-md object-cover border border-border shrink-0 mt-0.5"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0 border border-border mt-0.5">
                              <Megaphone className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="space-y-0.5 min-w-0">
                            <div className="font-semibold text-xs text-foreground truncate">
                              {c.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground line-clamp-1">
                              {c.body}
                            </div>
                            {c.ctaUrl && (
                              <div className="text-[10px] text-primary/80 font-mono truncate">
                                CTA: {c.ctaUrl}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Channels Badges */}
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {c.channels.map((ch) => (
                            <Badge
                              key={ch}
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 capitalize gap-1 font-mono"
                            >
                              {ch === 'push' && <Bell className="h-2.5 w-2.5 text-sky-500" />}
                              {ch === 'in-app' && <Smartphone className="h-2.5 w-2.5 text-indigo-500" />}
                              {ch === 'sms' && <MessageSquare className="h-2.5 w-2.5 text-emerald-500" />}
                              {ch === 'email' && <Mail className="h-2.5 w-2.5 text-amber-500" />}
                              <span>{ch}</span>
                            </Badge>
                          ))}
                        </div>
                      </TableCell>

                      {/* Audience */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="text-xs font-medium text-foreground capitalize flex items-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span>{c.audience.replace(/_/g, ' ')}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            ~{c.estimatedRecipients.toLocaleString()} recipients
                          </div>
                        </div>
                      </TableCell>

                      {/* Scheduled Date/Time with Timezone */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="text-xs font-medium text-foreground">
                            {formatInTimezone(c.scheduledAt, c.timezone, false)}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Globe className="h-2.5 w-2.5" />
                            <span>{meta.shortLabel} ({meta.offsetLabel})</span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Expiry Date/Time */}
                      <TableCell>
                        {c.expiresAt ? (
                          <div className="space-y-0.5">
                            <div className="text-xs text-foreground">
                              {formatInTimezone(c.expiresAt, c.timezone, false)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {new Date(c.expiresAt) <= new Date() ? (
                                <span className="text-rose-500 font-medium">Expired</span>
                              ) : (
                                <span>Active window</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No expiry set</span>
                        )}
                      </TableCell>

                      {/* Status & Delivery Progress */}
                      <TableCell>
                        <div className="space-y-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusCfg.tone}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            <span>{statusCfg.label}</span>
                          </span>

                          {progress && (
                            <div className="space-y-1 min-w-[110px]">
                              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                                <span>{progress.sent} / {progress.total}</span>
                                <span>
                                  {progress.total > 0
                                    ? Math.round((progress.sent / progress.total) * 100)
                                    : 100}%
                                </span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-primary h-1.5 rounded-full transition-all duration-300"
                                  style={{
                                    width: `${
                                      progress.total > 0
                                        ? Math.min(100, Math.round((progress.sent / progress.total) * 100))
                                        : 100
                                    }%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Publish Now (for draft or failed) */}
                          {(c.status === 'draft' || c.status === 'scheduled' || c.status === 'failed') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                              onClick={() => {
                                publishNowMutation.mutate({ id: c.id })
                              }}
                              disabled={publishNowMutation.isPending}
                              title="Publish Now immediately"
                            >
                              <Send className="h-3.5 w-3.5 mr-1" />
                              Publish
                            </Button>
                          )}

                          {/* Reschedule Button */}
                          {(c.status === 'scheduled' || c.status === 'draft') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-sky-600 hover:text-sky-700 hover:bg-sky-500/10"
                              onClick={() => handleOpenReschedule(c)}
                              title="Reschedule publication date and time"
                            >
                              <Calendar className="h-3.5 w-3.5 mr-1" />
                              Reschedule
                            </Button>
                          )}

                          {/* Cancel Button (if scheduled) */}
                          {c.status === 'scheduled' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                              onClick={() => setCancelTarget(c)}
                              title="Cancel scheduled delivery before publication"
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Cancel
                            </Button>
                          )}

                          {/* Analytics / Delivery Log Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setAnalyticsTarget(c)}
                            title="View Campaign Analytics & Delivery Log"
                          >
                            <TrendingUp className="h-3.5 w-3.5" />
                          </Button>

                          {/* Edit / Draft */}
                          {c.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => handleOpenEdit(c)}
                              title="Edit draft campaign"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(c)}
                            title="Delete campaign"
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
        </CardContent>
      </Card>

      {/* =========================================================================
          CREATE / EDIT CAMPAIGN DIALOG WITH SEPARATE DATE & TIME PICKERS
         ========================================================================= */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingCampaignId ? 'Edit Campaign Announcement' : 'Create Notification Campaign & Announcement'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure multi-channel push announcements, promotional banners, and scheduled delivery times.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4 py-2">
            {/* Campaign Name & Title */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Internal Campaign Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  required
                  placeholder="e.g. Dashain Mega Festive Discount 2026"
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Notification Headline / Title</Label>
                <Input
                  placeholder="e.g. 🍷 Special Dashain 15% OFF Tonight!"
                  value={formState.title}
                  onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Notification Channels Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Notification Channels <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'push' as const, label: 'Browser Push', icon: Bell, desc: 'Web push alert' },
                  { id: 'in-app' as const, label: 'In-App Notice', icon: Smartphone, desc: 'Notification center' },
                  { id: 'sms' as const, label: 'SMS Carrier', icon: MessageSquare, desc: 'NepalOTP carrier' },
                  { id: 'email' as const, label: 'Customer Email', icon: Mail, desc: 'HTML newsletter' },
                ].map((item) => {
                  const isChecked = formState.channels.includes(item.id)
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleChannel(item.id)}
                      className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition-all ${
                        isChecked
                          ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${isChecked ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div>
                        <div className="text-xs font-semibold">{item.label}</div>
                        <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Target Audience */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Target Audience</Label>
                <NativeSelect
                  value={formState.audience}
                  onChange={(e) => setFormState({ ...formState, audience: e.target.value })}
                  className="h-9 text-xs"
                >
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Estimated Audience Scope</Label>
                <div className="h-9 rounded-md border border-border bg-muted/30 px-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Calculated Recipients:</span>
                  <span className="font-mono font-semibold text-foreground">
                    ~{(audienceEstimate?.count ?? 0).toLocaleString()} users
                  </span>
                </div>
              </div>
            </div>

            {/* Message Body */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Announcement Message Body <span className="text-destructive">*</span>
              </Label>
              <Textarea
                required
                rows={3}
                placeholder="Get flat 15% off on all single malts and craft beers delivered under 45 minutes in Butwal & Tilottama. Use promo code FESTIVE15."
                value={formState.body}
                onChange={(e) => setFormState({ ...formState, body: e.target.value })}
                className="text-xs"
              />
            </div>

            {/* Promotional Banner & CTA Destination */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-medium">Campaign Image / Banner URL</Label>
                <Input
                  placeholder="https://.../banner.webp"
                  value={formState.imageUrl}
                  onChange={(e) => setFormState({ ...formState, imageUrl: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Auto-Activate Banner</Label>
                <NativeSelect
                  value={formState.bannerPlacement}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      bannerPlacement: e.target.value as any,
                    })
                  }
                  className="h-9 text-xs"
                >
                  <option value="none">No Storefront Tile</option>
                  <option value="home">Home Hero Slider</option>
                  <option value="drinks">Drinks Catalog Hero</option>
                  <option value="food">Food Catalog Hero</option>
                </NativeSelect>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Call-to-Action Destination URL</Label>
                <Input
                  placeholder="e.g. /drinks or /offers/festive-deal"
                  value={formState.ctaUrl}
                  onChange={(e) => setFormState({ ...formState, ctaUrl: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Linked Promotional Offer Slug (Optional)</Label>
                <Input
                  placeholder="e.g. festive-deal"
                  value={formState.offerSlug}
                  onChange={(e) => setFormState({ ...formState, offerSlug: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* =================================================================
                SCHEDULE & EXPIRY MANAGEMENT (Requirement 1 & 5)
               ================================================================= */}
            <div className="border border-border rounded-xl p-3.5 bg-muted/10 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>Publication Schedule & Expiry Timeframe</span>
                </div>

                {/* Timezone Selector (Defaults to Asia/Kathmandu) */}
                <div className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <NativeSelect
                    value={formState.timezone}
                    onChange={(e) => setFormState({ ...formState, timezone: e.target.value })}
                    className="h-7 text-[11px] py-0 w-auto font-mono"
                  >
                    {SUPPORTED_TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              {/* Publication Option Selector */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'schedule' as const, label: 'Schedule for Later', desc: 'Publish at exact date & time' },
                  { id: 'now' as const, label: 'Publish Now', desc: 'Dispatch immediately' },
                  { id: 'draft' as const, label: 'Save as Draft', desc: 'Save without sending' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPublishOption(opt.id)}
                    className={`p-2 rounded-lg border text-left text-xs transition-colors ${
                      publishOption === opt.id
                        ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/40'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <div>{opt.label}</div>
                    <div className="text-[10px] text-muted-foreground font-normal">{opt.desc}</div>
                  </button>
                ))}
              </div>

              {/* Separate Date & Time Pickers for Scheduled Publication (Requirement 1) */}
              {publishOption === 'schedule' && (
                <div className="p-3 rounded-lg border border-border/80 bg-background/60 space-y-2">
                  <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Schedule Notification Date & Time</span>
                    <span className="text-[11px] font-mono text-primary">
                      Timezone: {getTimezoneMeta(formState.timezone).shortLabel} (UTC+05:45)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Notification Date</Label>
                      <Input
                        type="date"
                        required
                        value={formState.scheduledDate}
                        onChange={(e) => setFormState({ ...formState, scheduledDate: e.target.value })}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Notification Time</Label>
                      <Input
                        type="time"
                        required
                        value={formState.scheduledTime}
                        onChange={(e) => setFormState({ ...formState, scheduledTime: e.target.value })}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Separate Date & Time Pickers for Expiry (Requirement 1 & 3) */}
              <div className="p-3 rounded-lg border border-border/80 bg-background/60 space-y-2">
                <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Campaign Expiry Date & Time</span>
                  <span className="text-[11px] text-muted-foreground">
                    Auto-expires & hides banners
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Expiry Date</Label>
                    <Input
                      type="date"
                      value={formState.expiryDate}
                      onChange={(e) => setFormState({ ...formState, expiryDate: e.target.value })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Expiry Time</Label>
                    <Input
                      type="time"
                      value={formState.expiryTime}
                      onChange={(e) => setFormState({ ...formState, expiryTime: e.target.value })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFormOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  saveDraftMutation.isPending ||
                  scheduleMutation.isPending ||
                  publishNowMutation.isPending
                }
              >
                {publishOption === 'draft'
                  ? 'Save as Draft'
                  : publishOption === 'now'
                  ? 'Preview & Publish Now'
                  : 'Preview & Schedule Campaign'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          ADMIN CAMPAIGN PREVIEW & ALL-USERS CONFIRMATION MODAL (Requirement 7)
         ========================================================================= */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span>Admin Campaign Summary & Confirmation</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review campaign specifications before delivery begins.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Summary Grid */}
            <div className="rounded-xl border border-border p-3.5 space-y-3 bg-muted/10 text-xs">
              <div className="flex justify-between items-start pb-2 border-b border-border">
                <div>
                  <div className="font-bold text-sm text-foreground">{formState.name}</div>
                  <div className="text-[11px] text-muted-foreground">{formState.title || 'No custom headline'}</div>
                </div>
                <Badge variant="outline" className="capitalize font-mono">
                  {publishOption === 'now' ? 'Instant Delivery' : 'Scheduled Delivery'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <span className="text-muted-foreground text-[11px] block">Target Audience:</span>
                  <span className="font-semibold capitalize">{formState.audience.replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px] block">Estimated Recipients:</span>
                  <span className="font-mono font-bold text-primary">
                    ~{(audienceEstimate?.count ?? 0).toLocaleString()} users
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px] block">Channels:</span>
                  <div className="flex gap-1 mt-0.5">
                    {formState.channels.map((ch) => (
                      <Badge key={ch} variant="secondary" className="text-[10px] uppercase font-mono px-1">
                        {ch}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px] block">Selected Timezone:</span>
                  <span className="font-mono">{formState.timezone}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px] block">Scheduled Publish:</span>
                  <span className="font-mono">
                    {publishOption === 'now'
                      ? 'Immediate'
                      : `${formState.scheduledDate} ${formState.scheduledTime}`}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px] block">Campaign Expiry:</span>
                  <span className="font-mono">
                    {formState.expiryDate
                      ? `${formState.expiryDate} ${formState.expiryTime}`
                      : 'None configured'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground text-[11px] block">CTA Destination:</span>
                  <span className="font-mono text-foreground font-semibold">{formState.ctaUrl || '/'}</span>
                </div>
              </div>
            </div>

            {/* Mobile Notification Preview Card */}
            <div className="rounded-xl border border-border p-3 bg-background space-y-2">
              <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                <span>Push & In-App Notification Preview</span>
                <span className="text-[10px] font-mono">Mezmani Nepal</span>
              </div>
              <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-1.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                    MZ
                  </div>
                  <div className="font-semibold text-xs text-foreground truncate">
                    {formState.title || formState.name}
                  </div>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed">{formState.body}</p>
                {formState.imageUrl && (
                  <img
                    src={formState.imageUrl}
                    alt="Banner preview"
                    className="h-28 w-full object-cover rounded-md mt-1 border border-border"
                  />
                )}
                {formState.ctaUrl && (
                  <div className="pt-1 flex justify-end">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                      <span>{formState.ctaText || 'Claim Offer'}</span>
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Confirmation required for "All Users" (Requirement 7) */}
            {formState.audience === 'all' && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <span className="font-semibold text-amber-900 dark:text-amber-200 block">
                      Broad Audience Confirmation Required
                    </span>
                    <p className="text-amber-800 dark:text-amber-300/90 text-[11px] leading-relaxed">
                      You are about to dispatch this campaign to ALL registered customer accounts (~
                      {(audienceEstimate?.count ?? 0).toLocaleString()} recipients).
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={previewConfirmedAll}
                    onChange={(e) => setPreviewConfirmedAll(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  <span className="text-xs font-semibold text-foreground select-none">
                    I confirm sending this announcement to all users
                  </span>
                </label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsPreviewOpen(false)}>
              Back to Edit
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmPublishFromPreview}
              disabled={
                (formState.audience === 'all' && !previewConfirmedAll) ||
                scheduleMutation.isPending ||
                publishNowMutation.isPending
              }
            >
              {publishOption === 'now' ? 'Confirm & Publish Now' : 'Confirm & Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          RESCHEDULE DIALOG (Requirement 2 & 5)
         ========================================================================= */}
      <Dialog open={!!rescheduleTarget} onOpenChange={(open) => !open && setRescheduleTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Reschedule Campaign</DialogTitle>
            <DialogDescription className="text-xs">
              Change the scheduled publication date, time, and expiry for &ldquo;{rescheduleTarget?.name}&rdquo;.
            </DialogDescription>
          </DialogHeader>

          {rescheduleTarget && (
            <div className="space-y-4 py-2 text-xs">
              {/* Timezone display */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">Selected Timezone</Label>
                <NativeSelect
                  value={rescheduleForm.timezone}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, timezone: e.target.value })}
                  className="h-8 text-xs font-mono"
                >
                  {SUPPORTED_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              {/* Publication Date & Time */}
              <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/10">
                <div className="font-semibold text-foreground">New Publication Date & Time</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Date</Label>
                    <Input
                      type="date"
                      required
                      value={rescheduleForm.scheduledDate}
                      onChange={(e) =>
                        setRescheduleForm({ ...rescheduleForm, scheduledDate: e.target.value })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Time</Label>
                    <Input
                      type="time"
                      required
                      value={rescheduleForm.scheduledTime}
                      onChange={(e) =>
                        setRescheduleForm({ ...rescheduleForm, scheduledTime: e.target.value })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Expiry Date & Time */}
              <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/10">
                <div className="font-semibold text-foreground">New Expiry Date & Time</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Date</Label>
                    <Input
                      type="date"
                      value={rescheduleForm.expiryDate}
                      onChange={(e) =>
                        setRescheduleForm({ ...rescheduleForm, expiryDate: e.target.value })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Time</Label>
                    <Input
                      type="time"
                      value={rescheduleForm.expiryTime}
                      onChange={(e) =>
                        setRescheduleForm({ ...rescheduleForm, expiryTime: e.target.value })
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRescheduleTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={rescheduleMutation.isPending}
              onClick={() => {
                if (!rescheduleTarget) return
                rescheduleMutation.mutate({
                  id: rescheduleTarget.id,
                  ...rescheduleForm,
                })
              }}
            >
              Update Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          CAMPAIGN ANALYTICS & RECIPIENT DELIVERY LOG MODAL (Requirement 8)
         ========================================================================= */}
      <Dialog open={!!analyticsTarget} onOpenChange={(open) => !open && setAnalyticsTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span>Campaign Performance & Delivery Log</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Delivery attempts, recipient statuses, and expiry info for &ldquo;{analyticsTarget?.name}&rdquo;.
            </DialogDescription>
          </DialogHeader>

          {analyticsTarget && (
            <div className="space-y-4 py-2">
              {/* KPI cards for delivery stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Status</div>
                  <div className="text-sm font-bold text-foreground capitalize mt-0.5">
                    {analyticsTarget.status}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Total Expected</div>
                  <div className="text-sm font-mono font-bold text-foreground mt-0.5">
                    {analyticsTarget.deliveryProgress?.total ?? analyticsTarget.estimatedRecipients}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                  <div className="text-[10px] text-emerald-600 uppercase font-mono">Sent Successfully</div>
                  <div className="text-sm font-mono font-bold text-emerald-600 mt-0.5">
                    {analyticsTarget.deliveryProgress?.sent ?? 0}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/5">
                  <div className="text-[10px] text-rose-600 uppercase font-mono">Failed Attempts</div>
                  <div className="text-sm font-mono font-bold text-rose-600 mt-0.5">
                    {analyticsTarget.deliveryProgress?.failed ?? 0}
                  </div>
                </div>
              </div>

              {/* Timeframe Info */}
              <div className="rounded-lg border border-border p-3 text-xs space-y-1.5 bg-muted/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Scheduled At:</span>
                    <span className="font-mono text-foreground font-semibold">
                      {formatInTimezone(analyticsTarget.scheduledAt, analyticsTarget.timezone)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Published At:</span>
                    <span className="font-mono text-foreground font-semibold">
                      {analyticsTarget.publishedAt
                        ? formatInTimezone(analyticsTarget.publishedAt, analyticsTarget.timezone)
                        : 'Not yet published'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Expiry Timeframe:</span>
                    <span className="font-mono text-foreground font-semibold">
                      {analyticsTarget.expiresAt
                        ? formatInTimezone(analyticsTarget.expiresAt, analyticsTarget.timezone)
                        : 'No expiry configured'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Associated Offer:</span>
                    <span className="font-mono text-foreground font-semibold">
                      {analyticsTarget.offerSlug || 'None linked'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Delivery Items Table */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Recipient Delivery History ({deliveriesList.length})</span>
                  {isLoadingDeliveries && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>

                <div className="rounded-lg border border-border max-h-56 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[11px]">Recipient</TableHead>
                        <TableHead className="text-[11px]">Channel</TableHead>
                        <TableHead className="text-[11px]">Status</TableHead>
                        <TableHead className="text-[11px]">Sent At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveriesList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                            {analyticsTarget.status === 'draft' || analyticsTarget.status === 'scheduled'
                              ? 'Deliveries will be recorded once publication begins.'
                              : 'No recipient delivery records found.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        deliveriesList.map((del: CampaignDeliveryItem) => (
                          <TableRow key={del.id}>
                            <TableCell className="text-xs font-mono">
                              <div>{del.userName || del.recipient}</div>
                              {del.error && (
                                <div className="text-[10px] text-destructive truncate max-w-xs">
                                  {del.error}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] uppercase font-mono px-1">
                                {del.channel}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  del.status === 'sent'
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : del.status === 'failed'
                                    ? 'bg-rose-500/10 text-rose-600'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {del.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {del.sentAt ? new Date(del.sentAt).toLocaleTimeString() : '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="sm" onClick={() => setAnalyticsTarget(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel Scheduled Campaign?"
        description={`Are you sure you want to cancel "${cancelTarget?.name}"? Pending background delivery jobs will be safely cancelled and no notifications will be dispatched.`}
        confirmLabel="Yes, Cancel Campaign"
        tone="destructive"
        onConfirm={() => {
          if (cancelTarget) cancelMutation.mutate(cancelTarget.id)
        }}
        isLoading={cancelMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Campaign?"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This record will be moved to the recycle bin.`}
        confirmLabel="Yes, Delete"
        tone="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
